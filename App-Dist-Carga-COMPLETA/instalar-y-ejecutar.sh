#!/bin/bash
echo "======================================"
echo "   Sistema de Gestión de Actas"
echo "======================================"
echo
echo "Instalando dependencias..."
cd backend
npm install
echo
echo "Iniciando servidor..."
echo
echo "IMPORTANTE: No cierres esta terminal!"
echo "La aplicación estará disponible en: http://localhost:3001"
echo
echo "Credenciales de prueba:"
echo "Admin: admin / admin123"
echo "Courier: courier1 / courier123"
echo
echo "======================================"
npm start 