const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const cookieParser = require('cookie-parser');

// Cargar variables de entorno
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'clave-secreta-desarrollo';

// Middleware
const allowedOrigins = [
    'http://localhost:8080', 
    'http://127.0.0.1:5500',
    'http://localhost:3001',
    'https://illustrious-cassata-b59f1f.netlify.app',
    'https://darling-kangaroo-a3f22e.netlify.app'
];

const corsOptions = {
    origin: function (origin, callback) {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Base de datos en memoria usando archivo JSON
let db = {};
const dbPath = path.join(__dirname, 'db.json');

// Cargar datos desde el archivo JSON
function loadDatabase() {
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        db = JSON.parse(data);
        console.log('Base de datos cargada desde db.json');
    } catch (error) {
        console.error('Error cargando base de datos:', error);
        // Inicializar con datos básicos si no existe el archivo
        db = {
            users: [],
            actas: [],
            invoices: [],
            payments: [],
            cityRates: {}
        };
    }
}

// Guardar datos al archivo JSON
function saveDatabase() {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    } catch (error) {
        console.error('Error guardando base de datos:', error);
    }
}

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

// Middleware de autorización por roles
const authorizeRoles = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
        }
        next();
    };
};

// Rutas de autenticación
app.post('/api/login',
    body('username').notEmpty().withMessage('El nombre de usuario es requerido'),
    body('password').notEmpty().withMessage('La contraseña es requerida'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const { username, password } = req.body;
            
            const user = db.users.find(u => u.username === username);
            if (!user) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Credenciales inválidas' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'none',
                maxAge: 24 * 60 * 60 * 1000
            });

            res.json({
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    name: user.name
                }
            });
        } catch (error) {
            console.error('Error en el login:', error);
            res.status(500).json({ error: 'Error interno del servidor durante el login' });
        }
    }
);

app.post('/api/logout', (req, res) => {
    res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0)
    });
    res.status(200).json({ message: 'Logout successful' });
});

app.get('/api/user-profile', authenticateToken, async (req, res) => {
    try {
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
    } catch (error) {
        console.error('Error obteniendo perfil de usuario:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
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
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        res.status(500).json({ message: "Error loading dashboard data" });
    }
});

// Rutas de actas
app.get('/api/actas', authenticateToken, async (req, res) => {
    try {
        let actas = db.actas;
        if (req.user.role === 'courier') {
            actas = actas.filter(acta => acta.courierId === req.user.id);
        }
        res.json(actas);
    } catch (error) {
        console.error('Error al obtener actas:', error);
        res.status(500).json({ error: 'Error al obtener actas' });
    }
});

app.post('/api/actas', authenticateToken, authorizeRoles(['admin', 'courier']),
    body('fecha').isISO8601(),
    body('ciudad').notEmpty(),
    body('agente').notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const newActa = {
                id: Date.now().toString(), // ID simple para desarrollo
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
            console.error('Error al crear acta:', error);
            res.status(500).json({ error: 'Error al crear acta' });
        }
    }
);

// City Rates Routes
app.get('/api/city-rates', authenticateToken, async (req, res) => {
    try {
        res.json(db.cityRates || {});
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/city-rates', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        db.cityRates = { ...db.cityRates, ...req.body };
        saveDatabase();
        res.json({ message: 'Rates updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Inicializar y arrancar servidor
loadDatabase();

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log('Base de datos JSON cargada correctamente');
    console.log('Usuarios disponibles:');
    db.users.forEach(user => {
        console.log(`- ${user.username} (${user.role})`);
    });
}); 