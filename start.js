// Archivo de inicio para Render
const path = require('path');

console.log('Starting App Dist Carga...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT || 3001);
console.log('Working directory:', process.cwd());

try {
    // Usar path absoluto para el require
    const serverPath = path.join(__dirname, 'backend', 'server-simple.js');
    console.log('Server path:', serverPath);
    
    // Cambiar al directorio backend para que las rutas internas funcionen
    process.chdir(path.join(__dirname, 'backend'));
    console.log('Changed to backend directory:', process.cwd());
    
    // Requerir el servidor principal usando path absoluto
    require(serverPath);
} catch (error) {
    console.error('Error starting server:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
} 