const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

console.log('📦 Servidor con base de datos PostgreSQL');

// Cargar variables de entorno
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro-aqui';
const DATABASE_URL = process.env.DATABASE_URL;

// Configuración de la base de datos
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
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
                id SERIAL PRIMARY KEY,
                data JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS invoices (
                id SERIAL PRIMARY KEY,
                data JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                data JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('✅ Base de datos inicializada exitosamente');
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

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend')));

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
                fullName: user.full_name || username
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// CRUD para Agentes
app.get('/api/agents', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM agents');
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo agentes:', error);
        res.status(500).json({ error: 'Error obteniendo agentes' });
    }
});

app.post('/api/agents', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { name } = req.body;
        const result = await pool.query('INSERT INTO agents (name) VALUES ($1) RETURNING *', [name]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creando agente:', error);
        res.status(500).json({ error: 'Error creando agente' });
    }
});

app.delete('/api/agents/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM agents WHERE id = $1', [id]);
        res.json({ message: 'Agente eliminado' });
    } catch (error) {
        console.error('Error eliminando agente:', error);
        res.status(500).json({ error: 'Error eliminando agente' });
    }
});

// CRUD para Tarifas de Ciudad
app.get('/api/city-rates', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT city, rate FROM city_rates');
        const rates = result.rows.reduce((acc, row) => {
            acc[row.city] = row.rate;
            return acc;
        }, {});
        res.json(rates);
    } catch (error) {
        console.error('Error obteniendo tarifas:', error);
        res.status(500).json({ error: 'Error obteniendo tarifas' });
    }
});

app.post('/api/city-rates', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { city, rate } = req.body;
        if (!city || rate === undefined) {
            return res.status(400).json({ error: 'La ciudad y la tarifa son requeridas' });
        }
        const result = await pool.query('INSERT INTO city_rates (city, rate) VALUES ($1, $2) ON CONFLICT (city) DO UPDATE SET rate = $2 RETURNING city, rate', [city, rate]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creando tarifa:', error);
        res.status(500).json({ error: 'Error creando tarifa' });
    }
});

app.delete('/api/city-rates/:city', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { city } = req.params;
        await pool.query('DELETE FROM city_rates WHERE city = $1', [city]);
        res.json({ message: 'Tarifa eliminada' });
    } catch (error) {
        console.error('Error eliminando tarifa:', error);
        res.status(500).json({ error: 'Error eliminando tarifa' });
    }
});

// CRUD para Actas
app.get('/api/actas', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM actas');
        res.json(result.rows.map(r => r.data));
    } catch (error) {
        console.error('Error obteniendo actas:', error);
        res.status(500).json({ error: 'Error obteniendo actas' });
    }
});

app.post('/api/actas', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const newActa = {
            id: Date.now().toString(),
            ...req.body,
            createdAt: new Date().toISOString()
        };
        await pool.query('INSERT INTO actas (data) VALUES ($1)', [newActa]);
        res.status(201).json(newActa);
    } catch (error) {
        console.error('Error creando acta:', error);
        res.status(500).json({ error: 'Error creando acta' });
    }
});

app.get('/api/actas/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM actas WHERE data->>'id' = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Acta no encontrada' });
        }
        res.json(result.rows[0].data);
    } catch (error) {
        console.error('Error obteniendo acta:', error);
        res.status(500).json({ error: 'Error obteniendo acta' });
    }
});

app.put('/api/actas/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const updatedActa = { ...req.body, updatedAt: new Date().toISOString() };
        const result = await pool.query('UPDATE actas SET data = $1 WHERE data->>'id' = $2 RETURNING *', [updatedActa, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Acta no encontrada' });
        }
        res.json(result.rows[0].data);
    } catch (error) {
        console.error('Error actualizando acta:', error);
        res.status(500).json({ error: 'Error actualizando acta' });
    }
});

app.delete('/api/actas/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM actas WHERE data->>'id' = $1', [id]);
        res.json({ message: 'Acta eliminada' });
    } catch (error) {
        console.error('Error eliminando acta:', error);
        res.status(500).json({ error: 'Error eliminando acta' });
    }
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