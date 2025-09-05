# 📋 Sistema de Gestión de Actas de Despacho

Una aplicación web para la gestión de actas de despacho, facturas y pagos.

## 🚀 Instalación Rápida (Para Asistente)

### **Prerrequisitos:**
- Node.js instalado (versión 14 o superior)
- Navegador web moderno

### **Pasos para ejecutar:**

1. **Descargar y extraer** los archivos del proyecto
2. **Abrir terminal** en la carpeta del proyecto
3. **Ejecutar estos comandos:**

```bash
# Ir a la carpeta backend
cd backend

# Instalar dependencias
npm install

# Iniciar el servidor
npm start
```

4. **Abrir navegador** y ir a: `http://localhost:3001`

## 🔑 Credenciales de Prueba

### **Administrador:**
- **Usuario:** `admin`
- **Contraseña:** `admin123`

### **Courier:**
- **Usuario:** `courier1`
- **Contraseña:** `courier123`

## 📱 Funcionalidades Principales

### **Como Administrador:**
- ✅ Dashboard con estadísticas generales
- ✅ Crear y gestionar actas de despacho
- ✅ Generar facturas automáticamente
- ✅ Registrar pagos
- ✅ Configurar ciudades y tarifas
- ✅ Acceso completo a todas las funciones

### **Como Courier:**
- ✅ Ver sus propias actas
- ✅ Crear nuevas actas
- ✅ Dashboard con sus estadísticas
- ❌ No puede generar facturas
- ❌ No puede configurar ciudades

## 🏗️ Arquitectura

- **Frontend:** HTML, CSS, JavaScript vanilla
- **Backend:** Node.js con Express
- **Base de datos:** JSON file (para desarrollo)
- **Autenticación:** JWT con cookies

## 🔧 Configuración Avanzada

### **Variables de Entorno (.env):**
```
PORT=3001
JWT_SECRET=mi-clave-secreta-para-desarrollo
NODE_ENV=development
DATABASE_URL=mongodb://localhost:27017/app-dist-carga
```

### **Estructura del Proyecto:**
```
APP Dist.Carga/
├── backend/
│   ├── server-simple.js    # Servidor principal (versión simplificada)
│   ├── server.js          # Servidor original (requiere MongoDB)
│   ├── db.json            # Base de datos en archivo
│   ├── package.json       # Dependencias y scripts
│   └── .env              # Variables de entorno
├── frontend/
│   ├── index.html        # Página principal
│   ├── css/styles.css    # Estilos
│   └── js/app.js         # Lógica del frontend
└── README.md             # Este archivo
```

## 🌐 Deploy en Línea (Opcional)

### **Render.com (Gratuito):**
1. Crear cuenta en [render.com](https://render.com)
2. Conectar repositorio de GitHub
3. Usar la configuración en `render.yaml`
4. Deploy automático

### **Heroku (Gratuito con límites):**
1. Instalar Heroku CLI
2. `heroku create tu-app-name`
3. `git push heroku main`

## 🐛 Solución de Problemas

### **El servidor no inicia:**
- Verificar que Node.js está instalado: `node --version`
- Verificar que estás en la carpeta `backend`
- Ejecutar `npm install` primero

### **No puedo hacer login:**
- Verificar que el servidor esté corriendo
- Usar las credenciales exactas proporcionadas
- Verificar que estés en `http://localhost:3001`

### **Puerto ocupado:**
- Cambiar el puerto en `.env`: `PORT=3002`
- O detener otros procesos: `taskkill /F /IM node.exe`

## 📞 Contacto

Para problemas o dudas, contactar al desarrollador principal.

---

**¡Disfruta probando la aplicación!** 🎉

