// Archivo de redirección para Render
// Render ejecuta 'node server.js', así que redirigimos a index.js

console.log('=== REDIRECT FROM SERVER.JS TO INDEX.JS ===');
console.log('Render is calling server.js, redirecting to index.js...');

// Simplemente requerir index.js
require('./index.js'); 