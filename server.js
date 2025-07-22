// Servidor principal para Render
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const cookieParser = require('cookie-parser');

// Variables de entorno
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'clave-secreta-desarrollo';
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('=== INICIANDO SERVIDOR ===');
console.log('NODE_ENV:', NODE_ENV);
console.log('PORT:', PORT);
console.log('Working directory:', process.cwd());

const app = express();

// Definir frontendPath al principio para uso en todas las rutas
const frontendPath = path.join(__dirname, 'frontend');
console.log('Frontend path:', frontendPath);

// CORS configurado para desarrollo y producción
app.use(cors({
    origin: NODE_ENV === 'production' ? true : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Base de datos JSON
let db = {};
const dbPath = path.join(__dirname, 'backend', 'db.json');

function loadDatabase() {
    try {
        console.log('Loading database from:', dbPath);
        const data = fs.readFileSync(dbPath, 'utf8');
        db = JSON.parse(data);
        console.log('Database loaded successfully');
        console.log('Users found:', db.users ? db.users.length : 0);
    } catch (error) {
        console.error('Error loading database:', error);
        // Base de datos de respaldo
        db = {
            users: [
                {
                    id: "admin-001",
                    username: "admin",
                    password: "$2b$10$14p/8jDKJQwi7rhpQQomMO/OD6DKJRXmhudvsqoFLcyqcvNHSjPny", // admin123
                    role: "admin",
                    name: "Administrator"
                },
                {
                    id: "courier-001",
                    username: "courier1",
                    password: "$2b$10$NlilbYVXdrKqg.POXsBI9O0YcC.E2Vkk8jzROXe0PrY6jGG/5Qz1S", // courier123
                    role: "courier",
                    name: "Courier One"
                }
            ],
            actas: [],
            invoices: [],
            payments: [],
            cityRates: {
                "Miami": 2.5,
                "New York": 3,
                "Los Angeles": 2.8,
                "Houston": 2.2,
                "Chicago": 2.7
            }
        };
        console.log('Using fallback database');
    }
}

// === NUEVA FUNCIÓN PARA GUARDAR LA BASE DE DATOS ===
function saveDatabase() {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    } catch (error) {
        console.error('Error saving database:', error);
    }
}

// === MIDDLEWARE DE AUTORIZACIÓN POR ROL ===
const authorizeRoles = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
        }
        next();
    };
};

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: 'Token de acceso requerido' });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido' });
        }
        req.user = user;
        next();
    });
};

// Las rutas estáticas se configuran al final

// API de diagnóstico temporal
app.get('/api/debug', (req, res) => {
    res.json({
        status: 'ok',
        nodeEnv: NODE_ENV,
        port: PORT,
        jwtSecret: JWT_SECRET ? 'configured' : 'missing',
        dbUsers: db.users ? db.users.length : 0,
        dbLoaded: db.users ? true : false,
        frontendPath: frontendPath,
        workingDirectory: process.cwd(),
        timestamp: new Date().toISOString()
    });
});

// API de login
app.post('/api/login', async (req, res) => {
    try {
        console.log('=== LOGIN ATTEMPT ===');
        console.log('Request body:', req.body);
        console.log('JWT_SECRET exists:', !!JWT_SECRET);
        console.log('Database users:', db.users ? db.users.length : 0);
        
        const { username, password } = req.body;
        
        if (!username || !password) {
            console.log('Missing credentials');
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        }
        
        console.log('Looking for user:', username);
        
        const user = db.users.find(u => u.username === username);
        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        console.log('Found user, checking password...');
        console.log('User hash:', user.password);
        
        let isValidPassword = false;
        try {
            isValidPassword = await bcrypt.compare(password, user.password);
            console.log('Password check result:', isValidPassword);
        } catch (bcryptError) {
            console.error('Bcrypt error:', bcryptError);
            return res.status(500).json({ error: 'Error de autenticación' });
        }
        
        if (!isValidPassword) {
            console.log('Invalid password for user:', username);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        console.log('Creating JWT token...');
        let token;
        try {
            token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            console.log('JWT token created successfully');
        } catch (jwtError) {
            console.error('JWT error:', jwtError);
            return res.status(500).json({ error: 'Error generando token' });
        }

        console.log('Setting cookie...');
        res.cookie('token', token, {
            httpOnly: true,
            secure: NODE_ENV === 'production',
            sameSite: NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000
        });

        console.log('Login successful for user:', username);
        res.json({
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name
            }
        });
    } catch (error) {
        console.error('=== LOGIN ERROR ===');
        console.error('Error details:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
});

// API de perfil de usuario
app.get('/api/user-profile', authenticateToken, (req, res) => {
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({
        user: {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name
        }
    });
});

// API del dashboard
app.get('/api/dashboard', authenticateToken, (req, res) => {
    const totalActas = db.actas.length;
    const totalInvoices = db.invoices.length;
    const totalBilled = db.invoices.reduce((sum, inv) => sum + inv.total, 0);
    const totalCollected = db.payments.reduce((sum, p) => sum + p.amount, 0);
    const pendingBalance = totalBilled - totalCollected;

    res.json({
        totalActas,
        totalInvoices,
        totalBilled,
        totalCollected,
        pendingBalance
    });
});

// API de city rates
app.get('/api/city-rates', authenticateToken, (req, res) => {
    res.json(db.cityRates || {});
});

// Logout
app.post('/api/logout', (req, res) => {
    res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
    res.json({ message: 'Logout successful' });
});

// ===== RUTAS DE ACTAS =====
app.get('/api/actas', authenticateToken, (req, res) => {
    try {
        let actas = db.actas;
        // Si es courier solo ve sus actas
        if (req.user.role === 'courier') {
            actas = actas.filter(a => a.courierId === req.user.id);
        }
        res.json(actas);
    } catch (error) {
        console.error('Error obteniendo actas:', error);
        res.status(500).json({ error: 'Error obteniendo actas' });
    }
});

app.post('/api/actas', authenticateToken, authorizeRoles(['admin', 'courier']), (req, res) => {
    try {
        const newActa = {
            id: Date.now().toString(),
            ...req.body,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        if (req.user.role === 'courier') {
            newActa.courierId = req.user.id;
        }
        db.actas.push(newActa);
        saveDatabase();
        res.status(201).json(newActa);
    } catch (error) {
        console.error('Error creando acta:', error);
        res.status(500).json({ error: 'Error creando acta' });
    }
});

app.put('/api/actas/:id', authenticateToken, authorizeRoles(['admin', 'courier']), (req, res) => {
    try {
        const acta = db.actas.find(a => a.id === req.params.id);
        if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });
        Object.assign(acta, req.body, { updatedAt: new Date() });
        saveDatabase();
        res.json(acta);
    } catch (error) {
        console.error('Error actualizando acta:', error);
        res.status(500).json({ error: 'Error actualizando acta' });
    }
});

// ===== RUTAS DE FACTURAS =====
app.get('/api/invoices', authenticateToken, (req, res) => {
    try {
        let invoices = db.invoices;
        if (req.user.role === 'courier') {
            invoices = invoices.filter(inv => inv.courierId === req.user.id);
        }
        res.json(invoices);
    } catch (error) {
        console.error('Error obteniendo facturas:', error);
        res.status(500).json({ error: 'Error obteniendo facturas' });
    }
});

app.post('/api/invoices', authenticateToken, authorizeRoles(['admin', 'courier']), (req, res) => {
    try {
        const { actaId } = req.body;
        const acta = db.actas.find(a => a.id === actaId);
        if (!acta) return res.status(404).json({ error: 'Acta no encontrada' });

        const total = (acta.guides || []).reduce((sum, g) => sum + (parseFloat(g.subtotal) || 0), 0);

        const newInvoice = {
            id: Date.now().toString(),
            number: db.invoices.length + 1,
            actaId,
            courierId: acta.courierId || null,
            total,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        db.invoices.push(newInvoice);
        saveDatabase();
        res.status(201).json(newInvoice);
    } catch (error) {
        console.error('Error creando factura:', error);
        res.status(500).json({ error: 'Error creando factura' });
    }
});

// ===== RUTAS DE PAGOS =====
app.get('/api/payments', authenticateToken, (req, res) => {
    try {
        let payments = db.payments;
        if (req.user.role === 'courier') {
            const courierInvoices = db.invoices.filter(inv => inv.courierId === req.user.id).map(inv => inv.id);
            payments = payments.filter(p => courierInvoices.includes(p.invoiceId));
        }
        res.json(payments);
    } catch (error) {
        console.error('Error obteniendo pagos:', error);
        res.status(500).json({ error: 'Error obteniendo pagos' });
    }
});

app.post('/api/payments', authenticateToken, authorizeRoles(['admin']), (req, res) => {
    try {
        const { invoiceId, amount, description } = req.body;
        const invoice = db.invoices.find(inv => inv.id === invoiceId);
        if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });

        const payment = {
            id: Date.now().toString(),
            invoiceId,
            amount: parseFloat(amount),
            description: description || '',
            createdAt: new Date()
        };

        db.payments.push(payment);

        // Calcular pagos totales para la factura
        const totalPagado = db.payments.filter(p => p.invoiceId === invoiceId).reduce((sum, p) => sum + p.amount, 0);
        if (totalPagado >= invoice.total) {
            invoice.status = 'paid';
        } else {
            invoice.status = totalPagado > 0 ? 'partial' : 'pending';
        }
        invoice.updatedAt = new Date();

        saveDatabase();
        res.status(201).json(payment);
    } catch (error) {
        console.error('Error registrando pago:', error);
        res.status(500).json({ error: 'Error registrando pago' });
    }
});

// ===== DESPUÉS DE TODAS LAS APIS, SERVIR ARCHIVOS ESTÁTICOS =====
app.use(express.static(frontendPath));

// Catch-all handler: enviar index.html para todas las rutas no API
// Esto es necesario para aplicaciones SPA (Single Page Application)
app.get('*', (req, res) => {
    // Solo aplicar catch-all a rutas que no sean API
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(frontendPath, 'index.html'));
    } else {
        res.status(404).json({ error: 'API endpoint not found' });
    }
});

// Cargar base de datos e iniciar servidor
loadDatabase();

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== SERVIDOR INICIADO ===`);
    console.log(`URL: http://0.0.0.0:${PORT}`);
    console.log(`NODE_ENV: ${NODE_ENV}`);
    console.log(`Frontend path: ${frontendPath}`);
    console.log(`Working directory: ${process.cwd()}`);
    console.log('Usuarios disponibles:');
    if (db.users) {
        db.users.forEach(user => {
            console.log(`- ${user.username} (${user.role})`);
        });
    }
    console.log('========================');
});

server.on('error', (err) => {
    console.error('Error starting server:', err);
    process.exit(1);
});

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
}); 