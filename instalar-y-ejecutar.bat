@echo off
echo ======================================
echo    Sistema de Gestion de Actas
echo ======================================
echo.
echo Instalando dependencias...
cd backend
npm install
echo.
echo Iniciando servidor...
echo.
echo IMPORTANTE: No cierres esta ventana!
echo La aplicacion estara disponible en: http://localhost:3001
echo.
echo Credenciales de prueba:
echo Admin: admin / admin123
echo Courier: courier1 / courier123
echo.
echo ======================================
npm start
pause 