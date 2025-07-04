const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'clave-secreta-desarrollo';

// Middleware básico
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'frontend')));

// Usuarios de prueba
const users = [
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
];

// API de login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
        }
        
        const user = users.find(u => u.username === username);
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
            sameSite: 'lax',
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
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

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

// API del dashboard
app.get('/api/dashboard', authenticateToken, (req, res) => {
    res.json({
        totalActas: 0,
        totalInvoices: 0,
        totalBilled: 0,
        totalCollected: 0,
        pendingBalance: 0
    });
});

// API de perfil de usuario
app.get('/api/user-profile', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
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

// Logout
app.post('/api/logout', (req, res) => {
    res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
    res.json({ message: 'Logout successful' });
});

// Ruta de prueba
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Servidor funcionando!', 
        timestamp: new Date().toISOString(),
        port: PORT 
    });
});

// Servir index.html para todas las rutas (debe ir al final)
app.get('*', (req, res) => {
    // Solo aplicar catch-all a rutas que no sean API
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
    } else {
        res.status(404).json({ error: 'API endpoint not found' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
    console.log('Usuarios disponibles:');
    users.forEach(user => {
        console.log(`- ${user.username} (${user.role})`);
    });
}); 