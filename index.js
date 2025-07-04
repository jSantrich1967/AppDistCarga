const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('=== SERVIDOR ULTRA SIMPLE ===');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// API simple de login
app.post('/api/login', (req, res) => {
    console.log('Login attempt:', req.body);
    const { username, password } = req.body;
    
    // Credenciales hardcodeadas
    if ((username === 'admin' && password === 'admin123') || 
        (username === 'courier1' && password === 'courier123')) {
        
        console.log('Login successful for:', username);
        res.json({
            user: {
                id: username + '-001',
                username: username,
                role: username === 'admin' ? 'admin' : 'courier',
                name: username === 'admin' ? 'Administrator' : 'Courier One'
            }
        });
    } else {
        console.log('Login failed for:', username);
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
});

// API simple de dashboard
app.get('/api/dashboard', (req, res) => {
    res.json({
        totalActas: 0,
        totalInvoices: 0,
        totalBilled: 0,
        totalCollected: 0,
        pendingBalance: 0
    });
});

// API simple de perfil
app.get('/api/user-profile', (req, res) => {
    res.json({
        user: {
            id: 'admin-001',
            username: 'admin',
            role: 'admin',
            name: 'Administrator'
        }
    });
});

// API de logout
app.post('/api/logout', (req, res) => {
    res.json({ message: 'Logout successful' });
});

// Catch-all
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'API not found' });
    } else {
        res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
    }
});

app.listen(PORT, () => {
    console.log(`=== SERVIDOR FUNCIONANDO EN PUERTO ${PORT} ===`);
    console.log('Usuarios: admin/admin123, courier1/courier123');
}); 