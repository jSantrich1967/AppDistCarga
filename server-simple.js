const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware básico
app.use(express.static(path.join(__dirname, 'frontend')));

// Ruta de prueba
app.get('/test', (req, res) => {
    res.json({ 
        message: 'Servidor funcionando!', 
        timestamp: new Date().toISOString(),
        port: PORT 
    });
});

// Servir index.html para todas las rutas
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
}); 