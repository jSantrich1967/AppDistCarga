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

// En producción, permitir el dominio de Render
if (process.env.NODE_ENV === 'production') {
    allowedOrigins.push('https://app-dist-carga.onrender.com');
    allowedOrigins.push('https://app-dist-carga-*.onrender.com');
}

const corsOptions = {
    origin: function (origin, callback) {
        // En producción, ser más permisivo con CORS
        if (process.env.NODE_ENV === 'production') {
            callback(null, true);
        } else if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
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

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));



// Base de datos en memoria usando archivo JSON
let db = {};
const dbPath = path.join(__dirname, 'db.json');
console.log('Database path:', dbPath);

// Cargar datos desde el archivo JSON
function loadDatabase() {
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        db = JSON.parse(data);
        
        // Asegurar que todas las propiedades existan
        const requiredProperties = ['users', 'actas', 'invoices', 'payments', 'cityRates', 'agents'];
        let needsSave = false;
        
        requiredProperties.forEach(prop => {
            if (!db[prop]) {
                db[prop] = (prop === 'cityRates') ? {} : [];
                needsSave = true;
                console.log(`Inicializando propiedad faltante: ${prop}`);
            }
        });
        
        if (needsSave) {
            saveDatabase();
        }
        
        console.log('Base de datos cargada desde db.json');
    } catch (error) {
        console.error('Error cargando base de datos:', error);
        // Inicializar con datos básicos si no existe el archivo
        db = {
            users: [],
            actas: [],
            invoices: [],
            payments: [],
            cityRates: {},
            agents: []
        };
        saveDatabase();
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
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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

// Health Check
app.get('/api/debug', (req, res) => {
    res.status(200).json({ message: 'Backend is healthy' });
});

// Test Route
app.get('/api/test', (req, res) => {
    res.status(200).json({ message: 'Test route is working!' });
});

// Rutas de actas
app.get('/api/actas', authenticateToken, async (req, res) => {
    try {
        console.log(`📋 GET /api/actas - Usuario: ${req.user.username} (${req.user.role})`);
        console.log(`📊 Total actas en DB: ${db.actas.length}`);
        
        let actas = db.actas;
        if (req.user.role === 'courier') {
            console.log(`🔍 Filtrando actas para courier: ${req.user.id}`);
            actas = actas.filter(acta => acta.courierId === req.user.id);
            console.log(`📝 Actas para este courier: ${actas.length}`);
        }
        
        console.log(`✅ Enviando ${actas.length} actas al frontend`);
        console.log('📋 Primeras 3 actas:', actas.slice(0, 3).map(a => ({ id: a.id, fecha: a.fecha, ciudad: a.ciudad })));
        
        res.json(actas);
    } catch (error) {
        console.error('❌ Error al obtener actas:', error);
        res.status(500).json({ error: 'Error al obtener actas' });
    }
});

app.post('/api/actas', authenticateToken, authorizeRoles(['admin', 'courier']),
    body('fecha').isISO8601(),
    body('ciudad').notEmpty(),
    body('agente').notEmpty(),
    async (req, res) => {
        console.log('📝 POST /api/actas - Recibido:', req.body);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('❌ Errores de validación:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const newActa = {
                id: Date.now().toString(), // ID simple para desarrollo
                ...req.body,
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'pending' // Agregar estado por defecto
            };
            
            if (req.user.role === 'courier') {
                newActa.courierId = req.user.id;
            }
            
            console.log('💾 Guardando acta:', newActa);
            
            db.actas.push(newActa);
            saveDatabase();
            
            console.log(`✅ Acta guardada. Total actas en DB: ${db.actas.length}`);
            console.log('📋 Últimas 3 actas:', db.actas.slice(-3).map(a => ({ id: a.id, fecha: a.fecha, ciudad: a.ciudad })));
            
            res.status(201).json(newActa);
        } catch (error) {
            console.error('❌ Error al crear acta:', error);
            res.status(500).json({ error: 'Error al crear acta' });
        }
    }
);

app.get('/api/actas/:id', authenticateToken, async (req, res) => {
    try {
        const acta = db.actas.find(a => a.id === req.params.id);
        if (!acta) {
            return res.status(404).json({ error: 'Acta no encontrada' });
        }
        
        // Solo admins pueden ver todas las actas, couriers solo las suyas
        if (req.user.role === 'courier' && acta.courierId !== req.user.id) {
            return res.status(403).json({ error: 'No tiene permisos para ver esta acta' });
        }
        
        res.json(acta);
    } catch (error) {
        console.error('Error al obtener acta:', error);
        res.status(500).json({ error: 'Error al obtener acta' });
    }
});

app.put('/api/actas/:id', authenticateToken, authorizeRoles(['admin', 'courier']),
    body('fecha').isISO8601(),
    body('ciudad').notEmpty(),
    body('agente').notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const actaIndex = db.actas.findIndex(a => a.id === req.params.id);
            if (actaIndex === -1) {
                return res.status(404).json({ error: 'Acta no encontrada' });
            }
            
            const existingActa = db.actas[actaIndex];
            
            // Solo admins pueden editar todas las actas, couriers solo las suyas
            if (req.user.role === 'courier' && existingActa.courierId !== req.user.id) {
                return res.status(403).json({ error: 'No tiene permisos para editar esta acta' });
            }
            
            const updatedActa = {
                ...existingActa,
                ...req.body,
                updatedAt: new Date()
            };
            
            db.actas[actaIndex] = updatedActa;
            saveDatabase();
            res.json(updatedActa);
        } catch (error) {
            console.error('Error al actualizar acta:', error);
            res.status(500).json({ error: 'Error al actualizar acta' });
        }
    }
);

app.delete('/api/actas/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const actaIndex = db.actas.findIndex(a => a.id === req.params.id);
        if (actaIndex === -1) {
            return res.status(404).json({ error: 'Acta no encontrada' });
        }
        
        // Verificar si tiene facturas asociadas
        const relatedInvoices = db.invoices.filter(inv => inv.actaId === req.params.id);
        if (relatedInvoices.length > 0) {
            return res.status(400).json({ 
                error: 'No se puede eliminar el acta porque tiene facturas asociadas. Elimine primero las facturas.' 
            });
        }
        
        db.actas.splice(actaIndex, 1);
        saveDatabase();
        res.status(204).send();
    } catch (error) {
        console.error('Error al eliminar acta:', error);
        res.status(500).json({ error: 'Error al eliminar acta' });
    }
});

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

// Agent Routes
app.get('/api/agents', authenticateToken, async (req, res) => {
    try {
        // Inicializar agents si no existe
        if (!db.agents) {
            db.agents = [];
            saveDatabase();
        }
        res.json(db.agents);
    } catch (error) {
        console.error('Error loading agents:', error);
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/agents', authenticateToken, authorizeRoles(['admin']),
    body('name').notEmpty().withMessage('El nombre del agente es requerido'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const newAgent = {
                id: Date.now().toString(), // Simple ID for development
                name: req.body.name,
                createdAt: new Date().toISOString()
            };
            db.agents.push(newAgent);
            saveDatabase();
            res.status(201).json(newAgent);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
);

app.put('/api/agents/:id', authenticateToken, authorizeRoles(['admin']),
    body('name').notEmpty().withMessage('El nombre del agente es requerido'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const agentIndex = db.agents.findIndex(a => a.id === req.params.id);
            if (agentIndex === -1) {
                return res.status(404).json({ message: 'Agente no encontrado' });
            }
            db.agents[agentIndex] = { ...db.agents[agentIndex], name: req.body.name };
            saveDatabase();
            res.json(db.agents[agentIndex]);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
);

app.delete('/api/agents/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const initialLength = db.agents.length;
        db.agents = db.agents.filter(a => a.id !== req.params.id);
        if (db.agents.length === initialLength) {
            return res.status(404).json({ message: 'Agente no encontrado' });
        }
        saveDatabase();
        res.status(204).send(); // No Content
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Inicializar y arrancar servidor
loadDatabase();

// Catch-all route for serving frontend
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
    console.log('Base de datos JSON cargada correctamente');
    console.log('Usuarios disponibles:');
    if (db.users && db.users.length > 0) {
        db.users.forEach(user => {
            console.log(`- ${user.username} (${user.role})`);
        });
    } else {
        console.log('No hay usuarios en la base de datos');
    }
}).on('error', (err) => {
    console.error('Error starting server:', err);
    process.exit(1);
}); 