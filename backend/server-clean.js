const express = require('express');
require('dotenv').config({ path: __dirname + '/.env' });
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

console.log('📦 Servidor con base de datos PostgreSQL - v3 - Manual Connection');

// Cargar variables de entorno
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro-aqui';

const DATABASE_URL = process.env.DATABASE_URL;

// Configuración de la base de datos
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Función para inicializar la base de datos
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                full_name VARCHAR(255)
            );

            CREATE TABLE IF NOT EXISTS agents (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS city_rates (
                id SERIAL PRIMARY KEY,
                city VARCHAR(255) UNIQUE NOT NULL,
                rate NUMERIC NOT NULL
            );

            CREATE TABLE IF NOT EXISTS actas (
                id VARCHAR(255) PRIMARY KEY,
                data JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS invoices (
                id VARCHAR(255) PRIMARY KEY,
                acta_id VARCHAR(255) REFERENCES actas(id),
                data JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS payments (
                id VARCHAR(255) PRIMARY KEY,
                invoice_id VARCHAR(255) REFERENCES invoices(id),
                data JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('✅ Base de datos inicializada exitosamente');

        // Seed admin user if no users exist
        const res = await client.query('SELECT COUNT(*) as count FROM users');
        if (res.rows[0].count === '0') {
            console.log('No users found. Creating default admin user...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('1234', salt);
            await client.query(
                'INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4)',
                ['admin', hashedPassword, 'admin', 'Admin User']
            );
            console.log('✅ Default admin user created (admin/1234)');
        }

    } catch (error) {
        console.error('❌ Error inicializando base de datos:', error);
    } finally {
        client.release();
    }
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Middleware de autenticación
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Middleware para verificar roles
function authorizeRoles(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        next();
    };
}

// Rutas de autenticación
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, fullName: user.full_name || user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                fullName: user.full_name || username
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// CRUD para Actas
app.post('/api/actas', authenticateToken, async (req, res) => {
    try {
        const newActa = {
            id: Date.now().toString(),
            ...req.body,
            createdAt: new Date().toISOString()
        };
        // Guardar como JSON explícito para garantizar compatibilidad con JSONB
        await pool.query('INSERT INTO actas (id, data) VALUES ($1, $2)', [newActa.id, JSON.stringify(newActa)]);
        res.status(201).json(newActa);
    } catch (error) {
        console.error('Error creando acta:', error);
        res.status(500).json({ error: 'Error creando acta' });
    }
});

app.get('/api/actas', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT data FROM actas');
        // Asegurar parseo del JSON almacenado como texto
        const actas = result.rows.map(r => (typeof r.data === 'string' ? JSON.parse(r.data) : r.data));
        res.json(actas);
    } catch (error) {
        console.error('Error obteniendo actas:', error);
        res.status(500).json({ error: 'Error obteniendo actas' });
    }
});

app.get('/api/actas/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT data FROM actas WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Acta no encontrada' });
        }
        const data = result.rows[0].data;
        res.json(typeof data === 'string' ? JSON.parse(data) : data);
    } catch (error) {
        console.error('Error obteniendo acta:', error);
        res.status(500).json({ error: 'Error obteniendo acta' });
    }
});

// Actualizar estado de una guía dentro de un acta
app.put('/api/actas/:id/guides/:no/status', authenticateToken, async (req, res) => {
    try {
        const { id, no } = req.params;
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'status requerido' });
        }

        const result = await pool.query('SELECT data FROM actas WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Acta no encontrada' });
        }
        const acta = typeof result.rows[0].data === 'string' ? JSON.parse(result.rows[0].data) : result.rows[0].data;
        if (!Array.isArray(acta.guides)) acta.guides = [];

        const guideIndex = acta.guides.findIndex(g => String(g.no) === String(no));
        if (guideIndex === -1) {
            return res.status(404).json({ error: 'Guía no encontrada en el acta' });
        }
        acta.guides[guideIndex].status = status;

        await pool.query('UPDATE actas SET data = $1 WHERE id = $2', [JSON.stringify(acta), id]);
        res.json({ ok: true, acta });
    } catch (error) {
        console.error('Error actualizando estado de guía:', error);
        res.status(500).json({ error: 'Error actualizando estado de guía' });
    }
});

// CRUD para Agentes
app.post('/api/agents', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }
        const result = await pool.query('INSERT INTO agents (name) VALUES ($1) RETURNING *', [name]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creando agente:', error);
        res.status(500).json({ error: 'Error creando agente' });
    }
});

app.get('/api/agents', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM agents ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo agentes:', error);
        res.status(500).json({ error: 'Error obteniendo agentes' });
    }
});

app.delete('/api/agents/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM agents WHERE id = $1', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Error eliminando agente:', error);
        res.status(500).json({ error: 'Error eliminando agente' });
    }
});

// CRUD para Ciudades y Tarifas
app.post('/api/city_rates', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { city, rate } = req.body;
        if (!city || !rate) {
            return res.status(400).json({ error: 'La ciudad y la tarifa son requeridas' });
        }
        const result = await pool.query('INSERT INTO city_rates (city, rate) VALUES ($1, $2) RETURNING *', [city, rate]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creando ciudad/tarifa:', error);
        res.status(500).json({ error: 'Error creando ciudad/tarifa' });
    }
});

app.get('/api/city_rates', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM city_rates ORDER BY city');
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo ciudades/tarifas:', error);
        res.status(500).json({ error: 'Error obteniendo ciudades/tarifas' });
    }
});

app.delete('/api/city_rates/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM city_rates WHERE id = $1', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Error eliminando ciudad/tarifa:', error);
        res.status(500).json({ error: 'Error eliminando ciudad/tarifa' });
    }
});

app.put('/api/city_rates/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { rate } = req.body;

        if (rate === undefined || isNaN(parseFloat(rate))) {
            return res.status(400).json({ error: 'La tarifa es requerida y debe ser un número.' });
        }

        const result = await pool.query(
            'UPDATE city_rates SET rate = $1 WHERE id = $2 RETURNING *',
            [rate, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ciudad no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error actualizando ciudad/tarifa:', error);
        res.status(500).json({ error: 'Error actualizando ciudad/tarifa' });
    }
});

// CRUD para Facturas
app.post('/api/invoices', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { actaId } = req.body;
        const actaResult = await pool.query('SELECT data FROM actas WHERE id = $1', [actaId]);
        if (actaResult.rows.length === 0) {
            return res.status(404).json({ error: 'Acta no encontrada' });
        }
        const acta = typeof actaResult.rows[0].data === 'string' ? JSON.parse(actaResult.rows[0].data) : actaResult.rows[0].data;

        const cityRatesResult = await pool.query('SELECT city, rate FROM city_rates');
        const cityRates = cityRatesResult.rows.reduce((acc, row) => {
            acc[row.city] = parseFloat(row.rate);
            return acc;
        }, {});

        const rate = cityRates[acta.ciudad] || 0;
        const guides = acta.guides || [];
        const subtotal = guides.reduce((sum, guide) => {
            const pies = parseFloat(guide.piesCubicos) || 0;
            return sum + pies * rate;
        }, 0);

        const total = subtotal; // IVA exento

        const invoiceId = Date.now().toString();
        const newInvoice = {
            id: invoiceId,
            actaId: actaId,
            numero: `FAC-${invoiceId}`,
            fecha: new Date().toISOString().split('T')[0],
            ciudad: acta.ciudad,
            agente: acta.agente,
            guides: guides,
            numGuides: guides.length,
            subtotal: subtotal,
            total: total,
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        // Guardar como JSON explícito para garantizar compatibilidad con JSONB
        await pool.query('INSERT INTO invoices (id, acta_id, data) VALUES ($1, $2, $3)', [newInvoice.id, actaId, JSON.stringify(newInvoice)]);
        // Marcar el acta como facturada (invoiced)
        try {
            acta.status = (acta.status === 'paid') ? 'paid' : 'invoiced';
            await pool.query('UPDATE actas SET data = $1 WHERE id = $2', [JSON.stringify(acta), actaId]);
        } catch (e) {
            console.warn('No se pudo actualizar el estado del acta a invoiced:', e.message);
        }

        res.status(201).json(newInvoice);
    } catch (error) {
        console.error('Error creando factura:', error);
        res.status(500).json({ error: 'Error creando factura' });
    }
});

app.get('/api/invoices', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT data FROM invoices');
        const invoices = result.rows.map(r => (typeof r.data === 'string' ? JSON.parse(r.data) : r.data));
        res.json(invoices);
    } catch (error) {
        console.error('Error obteniendo facturas:', error);
        res.status(500).json({ error: 'Error obteniendo facturas' });
    }
});

app.get('/api/invoices/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT data FROM invoices WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }
        const data = result.rows[0].data;
        res.json(typeof data === 'string' ? JSON.parse(data) : data);
    } catch (error) {
        console.error('Error obteniendo factura:', error);
        res.status(500).json({ error: 'Error obteniendo factura' });
    }
});

// Actualizar estado de factura (cancelled/paid/partial)
app.put('/api/invoices/:id/status', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'status requerido' });
        }

        const invRes = await pool.query('SELECT data FROM invoices WHERE id = $1', [id]);
        if (invRes.rows.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }
        const invoice = typeof invRes.rows[0].data === 'string' ? JSON.parse(invRes.rows[0].data) : invRes.rows[0].data;
        invoice.status = status;
        await pool.query('UPDATE invoices SET data = $1 WHERE id = $2', [JSON.stringify(invoice), id]);

        // Propagar a acta
        try {
            if (invoice.actaId) {
                const actaRes = await pool.query('SELECT data FROM actas WHERE id = $1', [invoice.actaId]);
                if (actaRes.rows.length > 0) {
                    const acta = typeof actaRes.rows[0].data === 'string' ? JSON.parse(actaRes.rows[0].data) : actaRes.rows[0].data;
                    if (status === 'cancelled') acta.status = 'cancelled';
                    if (status === 'paid') acta.status = 'paid';
                    if (status === 'partial') acta.status = 'invoiced';
                    await pool.query('UPDATE actas SET data = $1 WHERE id = $2', [JSON.stringify(acta), invoice.actaId]);
                }
            }
        } catch (e) {
            console.warn('No se pudo propagar estado a acta:', e.message);
        }

        res.json(invoice);
    } catch (error) {
        console.error('Error actualizando estado de factura:', error);
        res.status(500).json({ error: 'Error actualizando estado de factura' });
    }
});

// Pagos
app.post('/api/payments', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { invoiceId, fecha, monto, concepto, referencia, metodoPago, notas } = req.body;
        if (!invoiceId || monto === undefined) {
            return res.status(400).json({ error: 'invoiceId y monto son requeridos' });
        }

        // Obtener factura actual
        const invRes = await pool.query('SELECT data FROM invoices WHERE id = $1', [invoiceId]);
        if (invRes.rows.length === 0) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }
        const invoice = typeof invRes.rows[0].data === 'string' ? JSON.parse(invRes.rows[0].data) : invRes.rows[0].data;

        const paymentId = Date.now().toString();
        const payment = {
            id: paymentId,
            invoiceId,
            fecha: fecha || new Date().toISOString().split('T')[0],
            monto: parseFloat(monto) || 0,
            concepto: concepto || 'Pago',
            referencia: referencia || '',
            metodoPago: metodoPago || 'Transferencia bancaria',
            notas: notas || '',
            createdAt: new Date().toISOString()
        };

        // Actualizar factura (paid y status)
        const paidPrev = parseFloat(invoice.paid || 0);
        const total = parseFloat(invoice.total || 0);
        const paidNew = paidPrev + payment.monto;
        invoice.paid = paidNew;
        invoice.status = paidNew >= total ? 'paid' : 'partial';

        // Guardar pago y actualizar factura
        await pool.query('INSERT INTO payments (id, invoice_id, data) VALUES ($1, $2, $3)', [payment.id, invoiceId, JSON.stringify(payment)]);
        await pool.query('UPDATE invoices SET data = $1 WHERE id = $2', [JSON.stringify(invoice), invoiceId]);

        // Si la factura quedó totalmente pagada, marcar el acta como "paid"
        try {
            if (invoice.status === 'paid' && invoice.actaId) {
                const actaRes = await pool.query('SELECT data FROM actas WHERE id = $1', [invoice.actaId]);
                if (actaRes.rows.length > 0) {
                    const acta = typeof actaRes.rows[0].data === 'string' ? JSON.parse(actaRes.rows[0].data) : actaRes.rows[0].data;
                    acta.status = 'paid';
                    await pool.query('UPDATE actas SET data = $1 WHERE id = $2', [JSON.stringify(acta), invoice.actaId]);
                }
            }
        } catch (e) {
            console.warn('No se pudo actualizar status del acta tras pago:', e.message);
        }

        res.status(201).json({ payment, invoice });
    } catch (error) {
        console.error('Error registrando pago:', error);
        res.status(500).json({ error: 'Error registrando pago' });
    }
});

app.get('/api/payments', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { invoiceId } = req.query;
        if (invoiceId) {
            const result = await pool.query('SELECT data FROM payments WHERE invoice_id = $1', [invoiceId]);
            const payments = result.rows.map(r => (typeof r.data === 'string' ? JSON.parse(r.data) : r.data));
            return res.json(payments);
        }
        const result = await pool.query('SELECT data FROM payments');
        const payments = result.rows.map(r => (typeof r.data === 'string' ? JSON.parse(r.data) : r.data));
        res.json(payments);
    } catch (error) {
        console.error('Error obteniendo pagos:', error);
        res.status(500).json({ error: 'Error obteniendo pagos' });
    }
});

// Dashboard
app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const actasResult = await pool.query('SELECT COUNT(*) FROM actas');
        const invoicesResult = await pool.query('SELECT data FROM invoices');
        
        const totalActas = parseInt(actasResult.rows[0].count, 10);
        const invoices = invoicesResult.rows.map(r => r.data);
        const totalInvoices = invoices.length;

        const totalBilled = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

        res.json({
            totalActas,
            totalInvoices,
            totalBilled,
            totalCollected: 0, // Placeholder
            pendingBalance: totalBilled, // Placeholder
            userRole: req.user.role
        });
    } catch (error) {
        console.error('Error obteniendo dashboard:', error);
        res.status(500).json({ error: 'Error obteniendo dashboard' });
    }
});


// Ruta para obtener el perfil del usuario autenticado
app.get('/api/user-profile', authenticateToken, (req, res) => {
    // req.user es establecido por el middleware authenticateToken
    res.json({ user: req.user });
});

// Servir archivos estáticos (mapeos explícitos para evitar 404 de estilos/scripts)
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));
app.use(express.static(path.join(__dirname, '../frontend')));

// Ruta para servir la aplicación (debe ir al final)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Ruta para servir la aplicación (debe ir al final)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Inicializar y arrancar servidor
async function startServer() {
    await initializeDatabase();
    app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
        console.log(`📱 Aplicación disponible en: http://localhost:${PORT}`);
    });
}

startServer();

module.exports = app;
