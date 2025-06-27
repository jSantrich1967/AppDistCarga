# Sistema de Gestión de Actas de Despacho

Una aplicación web completa y responsiva para la gestión de actas de despacho de carga con autenticación, roles, facturación y pagos.

## Características Principales

### 1. **Autenticación y Roles**
- Sistema de login con usuario y contraseña
- Dos roles principales:
  - **Admin**: Acceso completo a todas las funcionalidades
  - **Courier Agent**: Acceso limitado a sus propias actas, facturas y pagos

### 2. **Gestión de Actas de Despacho**
- Formulario completo para crear actas con:
  - **Header de Acta**: Fecha, ciudad, agente, destino, información del vehículo
  - **Personal**: Datos del chofer y ayudante
  - **Detalle de Guías**: Tabla dinámica para agregar múltiples guías
  - **Cálculos Automáticos**: Subtotales basados en tarifas por ciudad

### 3. **Sistema de Facturación**
- Generación automática de facturas desde actas
- Vista detallada de facturas con desglose
- Estados de factura: Pendiente, Parcial, Pagada

### 4. **Gestión de Pagos**
- Registro de pagos parciales o completos
- Seguimiento de cuentas por cobrar
- Dashboard con estadísticas financieras

### 5. **Dashboard Interactivo**
- Estadísticas en tiempo real
- Vista diferenciada por rol
- Exportación a PDF

### 6. **Configuración de Tarifas**
- Panel para definir tarifas por ciudad (USD por pie³)
- Solo accesible para administradores

## Tecnologías Utilizadas

### Frontend
- **HTML5**: Estructura semántica
- **CSS3**: Diseño responsivo con variables CSS y Flexbox/Grid
- **JavaScript (Vanilla)**: Lógica de aplicación sin frameworks
- **Font Awesome**: Iconografía

### Backend
- **Node.js**: Runtime de JavaScript
- **Express.js**: Framework web
- **JWT**: Autenticación basada en tokens
- **bcryptjs**: Encriptación de contraseñas
- **CORS**: Soporte para peticiones cross-origin

## Instalación y Configuración

### Prerrequisitos
- Node.js 18+ instalado
- npm o yarn

### Pasos de Instalación

1. **Clonar o descargar el proyecto**
   ```bash
   cd cargo-dispatch-app
   ```

2. **Instalar dependencias del backend**
   ```bash
   cd backend
   npm install
   ```

3. **Iniciar el servidor**
   ```bash
   npm start
   ```

4. **Acceder a la aplicación**
   - Abrir navegador en: `http://localhost:3000`

## Cuentas de Demostración

### Administrador
- **Usuario**: `admin`
- **Contraseña**: `admin123`
- **Permisos**: Acceso completo a todas las funcionalidades

### Courier Agents
- **Usuario**: `courier1` | **Contraseña**: `courier123`
- **Usuario**: `courier2` | **Contraseña**: `courier123`
- **Permisos**: Solo sus propias actas, facturas y pagos

## Guía de Uso

### 1. **Inicio de Sesión**
- Ingresar credenciales en la pantalla de login
- El sistema redirige automáticamente al dashboard correspondiente

### 2. **Crear Nueva Acta**
1. Ir a la sección "Actas"
2. Hacer clic en "Nueva Acta"
3. Completar información general del acta
4. Agregar guías usando el botón "+ Agregar Guía"
5. Los subtotales se calculan automáticamente
6. Guardar la acta

### 3. **Generar Factura**
1. En la lista de actas, hacer clic en "Facturar"
2. La factura se genera automáticamente
3. Revisar en la sección "Facturas"

### 4. **Registrar Pagos**
1. En la sección "Facturas", hacer clic en "Pagar"
2. Ingresar monto y descripción del pago
3. El estado de la factura se actualiza automáticamente

### 5. **Configurar Tarifas** (Solo Admin)
1. Ir a "Configuración"
2. Modificar tarifas por ciudad
3. Guardar cambios

### 6. **Exportar e Imprimir**
- Usar botones "Exportar PDF" en dashboard
- Usar "Imprimir" en facturas individuales

## Características Técnicas

### Responsividad
- Diseño adaptable para desktop, tablet y móvil
- Navegación optimizada para pantallas pequeñas
- Tablas con scroll horizontal en dispositivos móviles

### Seguridad
- Autenticación JWT con expiración
- Contraseñas encriptadas con bcrypt
- Validación de permisos por rol
- Sanitización de inputs

### Performance
- Carga asíncrona de datos
- Indicadores de carga
- Optimización de consultas

### Usabilidad
- Validaciones en tiempo real
- Mensajes de error claros
- Interfaz intuitiva
- Atajos de teclado

## API Endpoints

### Autenticación
- `POST /api/login` - Iniciar sesión

### Actas
- `GET /api/actas` - Listar actas
- `POST /api/actas` - Crear acta
- `PUT /api/actas/:id` - Actualizar acta

### Facturas
- `GET /api/invoices` - Listar facturas
- `POST /api/invoices` - Generar factura

### Pagos
- `GET /api/payments` - Listar pagos
- `POST /api/payments` - Registrar pago

### Configuración
- `GET /api/city-rates` - Obtener tarifas
- `PUT /api/city-rates` - Actualizar tarifas

### Dashboard
- `GET /api/dashboard` - Estadísticas

## Estructura del Proyecto

```
cargo-dispatch-app/
├── backend/
│   ├── server.js          # Servidor principal
│   ├── package.json       # Dependencias
│   └── node_modules/      # Módulos de Node
├── frontend/
│   ├── index.html         # Página principal
│   ├── css/
│   │   └── styles.css     # Estilos CSS
│   ├── js/
│   │   └── app.js         # Lógica JavaScript
│   └── assets/            # Recursos estáticos
└── README.md              # Documentación
```

## Personalización

### Agregar Nuevas Ciudades
1. Acceder como administrador
2. Ir a "Configuración"
3. Agregar nueva ciudad con su tarifa

### Modificar Campos de Acta
- Editar formulario en `index.html`
- Actualizar validaciones en `app.js`
- Ajustar endpoints en `server.js`

### Cambiar Estilos
- Modificar variables CSS en `styles.css`
- Personalizar colores, fuentes y espaciado

## Soporte y Mantenimiento

### Logs del Servidor
- Los logs se muestran en la consola del servidor
- Errores de API se registran automáticamente

### Backup de Datos
- Los datos se almacenan en memoria (para demo)
- Para producción, integrar con base de datos real

### Actualizaciones
- Mantener dependencias actualizadas
- Revisar vulnerabilidades de seguridad regularmente

## Licencia

Este proyecto es un prototipo de demostración. Para uso comercial, contactar al desarrollador.

---

**Desarrollado con ❤️ para la gestión eficiente de actas de despacho**

