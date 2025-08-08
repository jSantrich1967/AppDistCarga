const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

console.log('📦 Servidor simplificado - Procesamiento Excel/CSV en frontend');

// Cargar variables de entorno
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro-aqui';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

// Plantilla Excel - Procesamiento en frontend
app.get('/api/plantilla-excel', (req, res) => {
    res.json({ 
        message: 'Plantilla generada en frontend',
        instructions: 'Usa el botón "Plantilla Excel" en la interfaz para descargar'
    });
});

// Base de datos en memoria usando archivo JSON
let db = {};
const dbPath = path.join(__dirname, 'db.json');

// Función para cargar base de datos
function loadDatabase() {
    try {
        if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath, 'utf8');
            db = JSON.parse(data);
            
            // Asegurar que todas las propiedades existan
            if (!db.users) db.users = [];
            if (!db.actas) db.actas = [];
            if (!db.agents) db.agents = [];
            if (!db.cityRates) db.cityRates = {};
            if (!db.invoices) db.invoices = [];
            if (!db.payments) db.payments = [];
            if (!db.paymentReminders) db.paymentReminders = [];
            
            console.log('✅ Base de datos cargada exitosamente');
        } else {
            // Crear base de datos inicial
            db = {
                users: [],
                actas: [],
                agents: [],
                cityRates: {},
                invoices: [],
                payments: [],
                paymentReminders: []
            };
            saveDatabase();
            console.log('📁 Nueva base de datos creada');
        }
    } catch (error) {
        console.error('❌ Error cargando base de datos:', error);
        db = {
            users: [],
            actas: [],
            agents: [],
            cityRates: {},
            invoices: [],
            payments: [],
            paymentReminders: []
        };
    }
}

// Función para guardar base de datos
function saveDatabase() {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    } catch (error) {
        console.error('❌ Error guardando base de datos:', error);
    }
}

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
        
        const user = db.users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );

        res.json({ 
            token, 
            user: { 
                id: user.id, 
                username: user.username, 
                role: user.role,
                fullName: user.fullName || username
            } 
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// Ruta protegida de prueba
app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({ message: 'Esta es una ruta protegida', user: req.user });
});

// CRUD para Agentes
app.get('/api/agents', authenticateToken, (req, res) => {
    try {
        res.json(db.agents || []);
    } catch (error) {
        console.error('Error obteniendo agentes:', error);
        res.status(500).json({ error: 'Error obteniendo agentes' });
    }
});

app.post('/api/agents', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    try {
        const newAgent = {
            id: Date.now().toString(),
            ...req.body,
            createdAt: new Date().toISOString()
        };
        
        if (!db.agents) {
            db.agents = [];
        }
        
        db.agents.push(newAgent);
        saveDatabase();
        res.status(201).json(newAgent);
    } catch (error) {
        console.error('Error creando agente:', error);
        res.status(500).json({ error: 'Error creando agente' });
    }
});

app.delete('/api/agents/:id', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    try {
        const { id } = req.params;
        db.agents = db.agents.filter(agent => agent.id !== id);
        saveDatabase();
        res.json({ message: 'Agente eliminado' });
    } catch (error) {
        console.error('Error eliminando agente:', error);
        res.status(500).json({ error: 'Error eliminando agente' });
    }
});

// CRUD para Tarifas de Ciudad
app.get('/api/city-rates', authenticateToken, (req, res) => {
    try {
        res.json(db.cityRates || {});
    } catch (error) {
        console.error('Error obteniendo tarifas:', error);
        res.status(500).json({ error: 'Error obteniendo tarifas' });
    }
});

app.post('/api/city-rates', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    try {
        const { city, rate } = req.body;
        
        if (!city || rate === undefined) {
            return res.status(400).json({ error: 'Ciudad y tarifa son requeridos' });
        }
        
        if (!db.cityRates) {
            db.cityRates = {};
        }
        
        db.cityRates[city] = parseFloat(rate);
        saveDatabase();
        res.json({ message: 'Tarifa actualizada', city, rate: db.cityRates[city] });
    } catch (error) {
        console.error('Error actualizando tarifa:', error);
        res.status(500).json({ error: 'Error actualizando tarifa' });
    }
});

app.delete('/api/city-rates/:city', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    try {
        const { city } = req.params;
        delete db.cityRates[city];
        saveDatabase();
        res.json({ message: 'Tarifa eliminada' });
    } catch (error) {
        console.error('Error eliminando tarifa:', error);
        res.status(500).json({ error: 'Error eliminando tarifa' });
    }
});

// CRUD para Actas con filtrado por rol
app.get('/api/actas', authenticateToken, (req, res) => {
    try {
        let actas = db.actas || [];
        
        // Filtrar por rol
        if (req.user.role === 'courier') {
            actas = actas.filter(acta => acta.courierId === req.user.id);
        }
        
        res.json(actas);
    } catch (error) {
        console.error('Error obteniendo actas:', error);
        res.status(500).json({ error: 'Error obteniendo actas' });
    }
});

app.post('/api/actas', authenticateToken, (req, res) => {
    try {
        const newActa = {
            id: Date.now().toString(),
            ...req.body,
            status: 'pending',
            courierId: req.user.role === 'courier' ? req.user.id : req.body.courierId,
            createdAt: new Date().toISOString()
        };
        
        if (!db.actas) {
            db.actas = [];
        }
        
        db.actas.push(newActa);
        saveDatabase();
        
        console.log('✅ Nueva acta creada:', newActa.id);
        res.status(201).json(newActa);
    } catch (error) {
        console.error('Error creando acta:', error);
        res.status(500).json({ error: 'Error creando acta' });
    }
});

app.get('/api/actas/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const acta = db.actas.find(a => a.id === id);
        
        if (!acta) {
            return res.status(404).json({ error: 'Acta no encontrada' });
        }
        
        // Verificar permisos
        if (req.user.role === 'courier' && acta.courierId !== req.user.id) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        res.json(acta);
    } catch (error) {
        console.error('Error obteniendo acta:', error);
        res.status(500).json({ error: 'Error obteniendo acta' });
    }
});

app.put('/api/actas/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const actaIndex = db.actas.findIndex(a => a.id === id);
        
        if (actaIndex === -1) {
            return res.status(404).json({ error: 'Acta no encontrada' });
        }
        
        // Verificar permisos
        if (req.user.role === 'courier' && db.actas[actaIndex].courierId !== req.user.id) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        db.actas[actaIndex] = { ...db.actas[actaIndex], ...req.body, updatedAt: new Date().toISOString() };
        saveDatabase();
        
        res.json(db.actas[actaIndex]);
    } catch (error) {
        console.error('Error actualizando acta:', error);
        res.status(500).json({ error: 'Error actualizando acta' });
    }
});

app.delete('/api/actas/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const actaIndex = db.actas.findIndex(a => a.id === id);
        
        if (actaIndex === -1) {
            return res.status(404).json({ error: 'Acta no encontrada' });
        }
        
        // Verificar permisos
        if (req.user.role === 'courier' && db.actas[actaIndex].courierId !== req.user.id) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        db.actas.splice(actaIndex, 1);
        saveDatabase();
        
        res.json({ message: 'Acta eliminada' });
    } catch (error) {
        console.error('Error eliminando acta:', error);
        res.status(500).json({ error: 'Error eliminando acta' });
    }
});

// CRUD para Facturas con filtrado por rol
app.get('/api/invoices', authenticateToken, (req, res) => {
    try {
        let invoices = db.invoices || [];
        
        // Filtrar por rol
        if (req.user.role === 'courier') {
            invoices = invoices.filter(invoice => invoice.courierId === req.user.id);
        }
        
        res.json(invoices);
    } catch (error) {
        console.error('Error obteniendo facturas:', error);
        res.status(500).json({ error: 'Error obteniendo facturas' });
    }
});

app.post('/api/invoices', authenticateToken, (req, res) => {
    try {
        const { actaId, ciudad } = req.body;

        const acta = db.actas.find(a => a.id === actaId);
        if (!acta) {
            return res.status(404).json({ error: 'Acta no encontrada' });
        }

        // Verificar permisos
        if (req.user.role === 'courier' && acta.courierId !== req.user.id) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }

        // Calcular subtotal/total de forma robusta
        const guides = acta.guides || acta.guias || [];
        const cityRates = db.cityRates || {};
        const usedCity = ciudad || acta.ciudad;
        const rate = cityRates[usedCity] || 0;

        const subtotal = guides.reduce((sum, guide) => {
            const guideSubtotal = parseFloat(guide.subtotal);
            if (!isNaN(guideSubtotal)) {
                return sum + guideSubtotal;
            }
            const pies = parseFloat(
                guide.piesCubicos !== undefined ? guide.piesCubicos : guide.pies
            ) || 0;
            return sum + pies * rate;
        }, 0);
        const total = subtotal; // exento de IVA

        const invoiceId = Date.now().toString();
        const invoiceNumber = `FAC-${invoiceId}`;

        const newInvoice = {
            id: invoiceId,
            actaId: actaId,
            numero: invoiceNumber,
            number: invoiceNumber, // compatibilidad con frontend
            fecha: new Date().toISOString().split('T')[0],
            ciudad: usedCity,
            agente: acta.agente,
            guides: guides,
            numGuides: guides.length,
            subtotal: subtotal,
            total: total,
            courierId: acta.courierId,
            status: 'pending',
            currency: 'USD',
            paymentTerms: '30 días',
            notes: `Factura generada automáticamente para el Acta ${acta.id} | Exenta de IVA`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (!db.invoices) {
            db.invoices = [];
        }

        db.invoices.push(newInvoice);
        saveDatabase();

        res.status(201).json(newInvoice);
    } catch (error) {
        console.error('Error creando factura:', error);
        res.status(500).json({ error: 'Error creando factura' });
    }
});

// CRUD para Pagos con filtrado por rol
app.get('/api/payments', authenticateToken, (req, res) => {
    try {
        let payments = db.payments || [];
        
        // Filtrar por rol
        if (req.user.role === 'courier') {
            payments = payments.filter(payment => payment.courierId === req.user.id);
        }
        
        res.json(payments);
    } catch (error) {
        console.error('Error obteniendo pagos:', error);
        res.status(500).json({ error: 'Error obteniendo pagos' });
    }
});

app.post('/api/payments', authenticateToken, (req, res) => {
    try {
        const { invoiceId, fecha, concepto, referencia, monto, metodo } = req.body;
        
        const invoice = db.invoices.find(inv => inv.id === invoiceId);
        if (!invoice) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }
        
        // Verificar permisos
        if (req.user.role === 'courier' && invoice.courierId !== req.user.id) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
        
        const newPayment = {
            id: Date.now().toString(),
            invoiceId,
            fecha,
            concepto,
            referencia,
            monto: parseFloat(monto),
            metodo,
            estado: 'completado',
            courierId: invoice.courierId,
            createdAt: new Date().toISOString()
        };
        
        if (!db.payments) {
            db.payments = [];
        }
        
        db.payments.push(newPayment);
        saveDatabase();
        
        res.status(201).json(newPayment);
    } catch (error) {
        console.error('Error creando pago:', error);
        res.status(500).json({ error: 'Error creando pago' });
    }
});

// Dashboard con filtrado por rol
app.get('/api/dashboard', authenticateToken, (req, res) => {
    try {
        let actas = db.actas || [];
        let invoices = db.invoices || [];
        let payments = db.payments || [];
        
        // Filtrar por rol
        if (req.user.role === 'courier') {
            actas = actas.filter(acta => acta.courierId === req.user.id);
            invoices = invoices.filter(invoice => invoice.courierId === req.user.id);
            payments = payments.filter(payment => payment.courierId === req.user.id);
        }
        
        const totalActas = actas.length;
        const totalInvoices = invoices.length;
        const totalPayments = payments.length;
        const totalRevenue = payments.reduce((sum, payment) => sum + (payment.monto || 0), 0);
        
        res.json({
            totalActas,
            totalInvoices,
            totalPayments,
            totalRevenue
        });
    } catch (error) {
        console.error('Error obteniendo dashboard:', error);
        res.status(500).json({ error: 'Error obteniendo dashboard' });
    }
});

// Cuentas por cobrar con filtrado por rol
app.get('/api/accounts-receivable', authenticateToken, (req, res) => {
    try {
        let invoices = db.invoices || [];
        const payments = db.payments || [];
        
        // Filtrar por rol
        if (req.user.role === 'courier') {
            invoices = invoices.filter(invoice => invoice.courierId === req.user.id);
        }
        
        const accountsReceivable = invoices.map(invoice => {
            const totalPaid = payments
                .filter(payment => payment.invoiceId === invoice.id)
                .reduce((sum, payment) => sum + payment.monto, 0);
            
            const balance = invoice.total - totalPaid;
            
            return {
                ...invoice,
                totalPaid,
                balance,
                status: balance <= 0 ? 'paid' : 'pending'
            };
        }).filter(account => account.balance > 0);
        
        const totalPending = accountsReceivable.reduce((sum, ar) => sum + ar.balance, 0);

        console.log('Enviando cuentas por cobrar:', { accounts: accountsReceivable, summary: { totalInvoices: accountsReceivable.length, totalPending } });

        res.json({
            accounts: accountsReceivable,
            summary: {
                totalInvoices: accountsReceivable.length,
                totalPending
            }
        });
    } catch (error) {
        console.error('Error obteniendo cuentas por cobrar:', error);
        res.status(500).json({ error: 'Error obteniendo cuentas por cobrar' });
    }
});

// Backup y restore
app.get('/api/backup/export', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    try {
        const backup = {
            ...db,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=backup.json');
        res.json(backup);
    } catch (error) {
        console.error('Error exportando backup:', error);
        res.status(500).json({ error: 'Error exportando backup' });
    }
});

app.post('/api/backup/import', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    try {
        const backupData = req.body;
        
        // Validar estructura del backup
        if (!backupData.users || !Array.isArray(backupData.users)) {
            return res.status(400).json({ error: 'Formato de backup inválido' });
        }
        
        // Restaurar base de datos
        db = {
            users: backupData.users || [],
            actas: backupData.actas || [],
            agents: backupData.agents || [],
            cityRates: backupData.cityRates || {},
            invoices: backupData.invoices || [],
            payments: backupData.payments || [],
            paymentReminders: backupData.paymentReminders || []
        };
        
        saveDatabase();
        res.json({ message: 'Backup restaurado exitosamente' });
    } catch (error) {
        console.error('Error importando backup:', error);
        res.status(500).json({ error: 'Error importando backup' });
    }
});

// Ruta para servir la aplicación (debe ir al final)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Inicializar servidor
loadDatabase();

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Aplicación disponible en: http://localhost:${PORT}`);
});

module.exports = app; 