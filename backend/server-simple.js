const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const cookieParser = require('cookie-parser');
// Dependencias Excel - Configuración simplificada para Render
console.log('📦 Servidor simplificado - Procesamiento Excel/CSV en frontend');

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

// Plantilla Excel - Procesamiento en frontend
app.get('/api/plantilla-excel', (req, res) => {
    res.json({ 
        message: 'Plantilla generada en frontend',
        instructions: 'Usa el botón "Plantilla Excel" en la interfaz para descargar'
    });
});
// Base de datos en memoria usando archivo JSON
            'No', 'WAREHOUSE', 'FILE', 'ORIGEN', 'VIA', 'CLIENTE', 'EMBARCADOR', 
            'CANT. TEORICA', 'CANT. DESPACHADA', 'PIES CUBICOS', 'PESO', 'DESTINO', 'DIRECCION'
        ];

        // Ejemplos SOLO de guías (sin datos de acta)
        const ejemplos = [
            [
                '1', 'ALM-VLC-01', 'EXP-2024-001', 'Caracas', 'terrestre', 'Distribuidora Centro C.A.', 'Comercial El Progreso', '5', '5', '15.5', '30', 'Valencia', 'Av. Bolívar Norte, Valencia, Carabobo'
            ],
            [
                '2', 'ALM-MCB-02', 'EXP-2024-002', 'Maracaibo', 'aereo', 'Comercial Zulia S.A.', 'Auto Repuestos Zulia', '3', '3', '8.2', '20', 'Cabimas', 'Av. 5 de Julio, Maracaibo, Zulia'
            ],
            [
                '3', 'ALM-MCB-03', 'EXP-2024-003', 'Valencia', 'terrestre', 'Empresa ABC C.A.', 'Distribuidora Centro', '2', '2', '5.1', '15', 'Maracay', 'Calle 72, Valencia, Carabobo'
            ],
            [
                '4', 'ALM-BQM-01', 'EXP-2024-004', 'Caracas', 'aereo', 'Distribuidora Norte', 'Comercial Oriente', '4', '4', '12.3', '35', 'Barquisimeto', 'Av. Delicias, Barquisimeto, Lara'
            ],
            [
                '5', 'ALM-CCS-01', 'EXP-2024-005', 'Valencia', 'terrestre', 'Logística Lara C.A.', 'Distribuidora Centro Occidental', '8', '8', '22.1', '45', 'Acarigua', 'Carrera 19, Barquisimeto, Lara'
            ]
        ];

        // Hoja de instrucciones
        const instrucciones = [
            ['📦 PLANTILLA PARA IMPORTACIÓN DE GUÍAS'],
            [''],
            ['🔵 DESCRIPCIÓN DE CAMPOS:'],
            ['• No - Número secuencial de la guía (1, 2, 3...)'],
            ['• WAREHOUSE - Código del almacén (ALM-XXX-XX)'],
            ['• FILE - Número de expediente (EXP-YYYY-XXX)'],
            ['• ORIGEN - Ciudad de origen de la carga'],
            ['• VIA - Método de transporte (terrestre/aereo/maritimo)'],
            ['• CLIENTE - Empresa/persona destinataria (OBLIGATORIO)'],
            ['• EMBARCADOR - Empresa que envía la mercancía'],
            ['• CANT. TEORICA - Cantidad esperada'],
            ['• CANT. DESPACHADA - Cantidad real enviada'],
            ['• PIES CUBICOS - Volumen en pies cúbicos (para facturación)'],
            ['• PESO - Peso en kilogramos'],
            ['• DESTINO - Ciudad de destino'],
            ['• DIRECCION - Dirección completa de entrega (OBLIGATORIO)'],
            [''],
            ['📋 INSTRUCCIONES:'],
                            ['1. Ve a la hoja "GUÍAS" (pestaña principal)'],
            ['2. Llena una fila por cada guía'],
            ['3. Solo CLIENTE y DIRECCION son obligatorios'],
            ['4. Los demás campos son opcionales pero recomendados'],
            ['5. El campo No se puede dejar automático (1, 2, 3...)'],
            ['6. Guarda como .xlsx y sube a la aplicación'],
            [''],
            ['🇻🇪 CÓDIGOS VENEZOLANOS SUGERIDOS:'],
            ['• WAREHOUSE: ALM-CCS-01, ALM-MCB-02, ALM-VLC-03'],
            ['• ORIGEN/DESTINO: Caracas, Maracaibo, Valencia, Barquisimeto'],
            ['• VIA: terrestre (más común), aereo, maritimo'],
            [''],
            ['💡 EJEMPLOS DE LLENADO:'],
            ['CLIENTE: "Distribuidora Centro C.A."'],
            ['EMBARCADOR: "Comercial El Progreso"'],
            ['DIRECCION: "Av. Bolívar Norte, Valencia, Carabobo"'],
            ['PIES CUBICOS: "15.5" (usado para calcular el costo)']
        ];

        // Crear workbook usando XLSX
        const wb = xlsx.utils.book_new();

        // PRIMERO: Hoja de guías (será la hoja activa al abrir)
        const datosGuias = [headers, ...ejemplos];
        const wsGuias = xlsx.utils.aoa_to_sheet(datosGuias);
        
        // Configurar ancho de columnas para guías
        const colWidths = [
            {wch: 5},   // No
            {wch: 12},  // WAREHOUSE
            {wch: 15},  // FILE
            {wch: 12},  // ORIGEN
            {wch: 10},  // VIA
            {wch: 25},  // CLIENTE
            {wch: 20},  // EMBARCADOR
            {wch: 12},  // CANT. TEORICA
            {wch: 12},  // CANT. DESPACHADA
            {wch: 12},  // PIES CUBICOS
            {wch: 8},   // PESO
            {wch: 12},  // DESTINO
            {wch: 35}   // DIRECCION
        ];
        wsGuias['!cols'] = colWidths;
        xlsx.utils.book_append_sheet(wb, wsGuias, "GUÍAS");

        // SEGUNDO: Hoja de instrucciones (como referencia)
        const wsInstrucciones = xlsx.utils.aoa_to_sheet(instrucciones);
        wsInstrucciones['!cols'] = [{wch: 60}]; // Ancho de columna
        xlsx.utils.book_append_sheet(wb, wsInstrucciones, "Instrucciones");

        // Generar buffer usando XLSX
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Configurar headers de respuesta
        const today = new Date().toISOString().split('T')[0];
        const filename = `Plantilla_Guias_${today}.xlsx`;
        
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Length', buffer.length);

        res.send(buffer);

    } catch (error) {
        console.error('Error generando plantilla Excel:', error);
        res.status(500).json({ error: 'Error generando plantilla Excel' });
    }
});

// Configuración de multer ya realizada en la sección de dependencias arriba

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
        console.log(`📊 Dashboard - Usuario: ${req.user.username} (${req.user.role})`);
        
        let actas = db.actas;
        let invoices = db.invoices;
        let payments = db.payments || [];

        // Filtrar datos según el rol del usuario
        if (req.user.role === 'courier') {
            // Filtrar actas del courier
            actas = actas.filter(acta => acta.courierId === req.user.id);
            
            // Filtrar facturas de actas del courier
            const courierActaIds = actas.map(acta => acta.id);
            invoices = invoices.filter(invoice => courierActaIds.includes(invoice.actaId));
            
            // Filtrar pagos de facturas del courier
            const courierInvoiceIds = invoices.map(invoice => invoice.id);
            payments = payments.filter(payment => courierInvoiceIds.includes(payment.invoiceId));
            
            console.log(`🔍 Datos filtrados para courier: ${actas.length} actas, ${invoices.length} facturas, ${payments.length} pagos`);
        }

        const totalActas = actas.length;
        const totalInvoices = invoices.length;
        const totalBilled = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const totalCollected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const pendingBalance = totalBilled - totalCollected;

        // Estadísticas adicionales por rol
        const dashboardData = {
            totalActas,
            totalInvoices,
            totalBilled,
            totalCollected,
            pendingBalance,
            userRole: req.user.role,
            userName: req.user.name
        };

        // Añadir estadísticas específicas para couriers
        if (req.user.role === 'courier') {
            const totalGuides = actas.reduce((sum, acta) => sum + (acta.guides?.length || 0), 0);
            const guidesbyStatus = actas.reduce((acc, acta) => {
                acta.guides?.forEach(guide => {
                    const status = guide.status || 'Sin Estado';
                    acc[status] = (acc[status] || 0) + 1;
                });
                return acc;
            }, {});

            dashboardData.totalGuides = totalGuides;
            dashboardData.guidesByStatus = guidesbyStatus;
        }

        console.log(`✅ Dashboard data enviada:`, dashboardData);
        res.json(dashboardData);
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
        console.log('📝 POST /api/actas - Recibido:', JSON.stringify(req.body, null, 2));
        console.log('📝 POST /api/actas - Guías recibidas en req.body:', req.body.guides ? req.body.guides.length : 0);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('❌ Errores de validación:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const newActa = {
                id: Date.now().toString(), // ID simple para desarrollo
                fecha: req.body.fecha,
                ciudad: req.body.ciudad,
                agente: req.body.agente,
                modeloCamion: req.body.modeloCamion || '',
                anioCamion: req.body.anioCamion || '',
                placaCamion: req.body.placaCamion || '',
                nombreChofer: req.body.nombreChofer || '',
                telefonoChofer: req.body.telefonoChofer || '',
                nombreAyudante: req.body.nombreAyudante || '',
                telefonoAyudante: req.body.telefonoAyudante || '',
                guides: req.body.guides || [],
                status: 'pending', // Agregar estado por defecto
                createdAt: new Date(),
                updatedAt: new Date()
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

// Invoices Routes
app.get('/api/invoices', authenticateToken, async (req, res) => {
    try {
        let invoices = db.invoices;
        if (req.user.role === 'courier') {
            // Filtrar facturas solo de actas del courier
            const courierActas = db.actas.filter(acta => acta.courierId === req.user.id);
            const courierActaIds = courierActas.map(acta => acta.id);
            invoices = invoices.filter(invoice => courierActaIds.includes(invoice.actaId));
        }
        res.json(invoices);
    } catch (error) {
        console.error('Error al obtener facturas:', error);
        res.status(500).json({ error: 'Error al obtener facturas' });
    }
});

app.post('/api/invoices', authenticateToken, authorizeRoles(['admin', 'courier']),
    body('actaId').notEmpty().withMessage('El ID del acta es requerido'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const { actaId } = req.body;

            // Verificar que el acta existe
            const acta = db.actas.find(a => a.id === actaId);
            console.log(`🧾 POST /api/invoices - Acta recuperada para factura (${actaId}):`, acta ? `Guías: ${acta.guides?.length || 0}` : 'Acta no encontrada');
            if (!acta) {
                return res.status(404).json({ error: 'Acta no encontrada' });
            }
            
            // Verificar permisos
            if (req.user.role === 'courier' && acta.courierId !== req.user.id) {
                return res.status(403).json({ error: 'No tiene permisos para facturar esta acta' });
            }
            
            // Verificar que no exista ya una factura para esta acta
            const existingInvoice = db.invoices.find(inv => inv.actaId === actaId);
            if (existingInvoice) {
                return res.status(400).json({ error: 'Ya existe una factura para esta acta' });
            }
            
            // Calcular totales (sin IVA)
            const cityRates = db.cityRates || {};
            const rate = cityRates[acta.ciudad] || 0;
            const subtotal = acta.guides ? acta.guides.reduce((sum, guide) => {
                const guideSubtotal = (parseFloat(guide.piesCubicos) || 0) * rate;
                return sum + guideSubtotal;
            }, 0) : 0;
            const total = subtotal; // Total igual al subtotal (sin IVA)
            
            // Generar número de factura
            const invoiceNumber = `FAC-${Date.now()}`;
            
            // Crear factura con formato profesional
            const newInvoice = {
                id: Date.now().toString(),
                numero: invoiceNumber, // Corregido a 'numero'
                actaId: actaId,
                
                // Información del acta
                fecha: acta.fecha,
                ciudad: acta.ciudad,
                agente: acta.agente,
                
                // Información del vehículo
                vehicleInfo: {
                    modelo: acta.modeloCamion,
                    anio: acta.anioCamion,
                    placa: acta.placaCamion,
                    chofer: acta.nombreChofer,
                    telefonoChofer: acta.telefonoChofer,
                    ayudante: acta.nombreAyudante,
                    telefonoAyudante: acta.telefonoAyudante
                },
                
                // Detalle de guías
                guides: acta.guides || [],
                numGuides: acta.guides ? acta.guides.length : 0,
                
                // Totales (sin IVA)
                subtotal: subtotal,
                total: total,
                
                // Estado y fechas
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
                
                // Información adicional
                currency: 'USD',
                paymentTerms: '30 días',
                notes: `Factura generada automáticamente para el Acta ${acta.id} | Exenta de IVA`
            };
            
            db.invoices.push(newInvoice);
            saveDatabase();
            
            console.log(`✅ Factura ${invoiceNumber} creada para acta ${actaId}`);
            res.status(201).json(newInvoice);
            
        } catch (error) {
            console.error('Error al crear factura:', error);
            res.status(500).json({ error: 'Error al crear factura' });
        }
    }
);

app.get('/api/invoices/:id', authenticateToken, async (req, res) => {
    try {
        const invoice = db.invoices.find(inv => inv.id === req.params.id);
        if (!invoice) {
            return res.status(404).json({ error: 'Factura no encontrada' });
        }
        
        // Verificar permisos
        if (req.user.role === 'courier') {
            const acta = db.actas.find(a => a.id === invoice.actaId);
            if (acta && acta.courierId !== req.user.id) {
                return res.status(403).json({ error: 'No tiene permisos para ver esta factura' });
            }
        }
        
        res.json(invoice);
    } catch (error) {
        console.error('Error al obtener factura:', error);
        res.status(500).json({ error: 'Error al obtener factura' });
    }
});

// Payments Routes
app.get('/api/payments', authenticateToken, async (req, res) => {
    try {
        let payments = db.payments || [];
        if (req.user.role === 'courier') {
            // Filtrar pagos solo de facturas del courier
            const courierActas = db.actas.filter(acta => acta.courierId === req.user.id);
            const courierActaIds = courierActas.map(acta => acta.id);
            const courierInvoiceIds = db.invoices
                .filter(invoice => courierActaIds.includes(invoice.actaId))
                .map(invoice => invoice.id);
            payments = payments.filter(payment => courierInvoiceIds.includes(payment.invoiceId));
        }
        res.json(payments);
    } catch (error) {
        console.error('Error al obtener pagos:', error);
        res.status(500).json({ error: 'Error al obtener pagos' });
    }
});

app.post('/api/payments', authenticateToken, authorizeRoles(['admin', 'courier']),
    body('invoiceId').notEmpty().withMessage('El ID de la factura es requerido'),
    body('fecha').isISO8601().withMessage('La fecha debe ser válida'),
    body('monto').isFloat({ min: 0.01 }).withMessage('El monto debe ser mayor que 0'),
    body('concepto').notEmpty().withMessage('El concepto es requerido'),
    body('referencia').notEmpty().withMessage('La referencia es requerida'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const { invoiceId, fecha, monto, concepto, referencia, metodoPago, notas, estado } = req.body;
            
            // Verificar que la factura existe
            const invoice = db.invoices.find(inv => inv.id === invoiceId);
            if (!invoice) {
                return res.status(404).json({ error: 'Factura no encontrada' });
            }
            
            // Verificar permisos
            if (req.user.role === 'courier') {
                const acta = db.actas.find(a => a.id === invoice.actaId);
                if (acta && acta.courierId !== req.user.id) {
                    return res.status(403).json({ error: 'No tiene permisos para registrar pagos de esta factura' });
                }
            }
            
            // Crear registro de pago completo
            const newPayment = {
                id: Date.now().toString(),
                invoiceId: invoiceId,
                
                // Campos principales solicitados
                fecha: fecha,
                concepto: concepto,
                referencia: referencia,
                monto: parseFloat(monto),
                
                // Información adicional
                metodoPago: metodoPago || 'Transferencia bancaria',
                notas: notas || '',
                estado: estado || 'completado',
                
                // Información de la factura relacionada
                facturaNumero: invoice.number,
                facturaTotal: invoice.total,
                
                // Metadatos del sistema
                fechaRegistro: new Date(),
                registradoPor: req.user.id,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Guardar pago
            if (!db.payments) {
                db.payments = [];
            }
            db.payments.push(newPayment);
            
            // Verificar si la factura está completamente pagada
            const totalPaid = db.payments
                .filter(p => p.invoiceId === invoiceId && p.estado === 'completado')
                .reduce((sum, p) => sum + p.monto, 0);
            
            // Actualizar estado de la factura
            if (totalPaid >= invoice.total) {
                invoice.status = 'paid';
                invoice.paidAt = new Date();
                invoice.updatedAt = new Date();
            } else if (totalPaid > 0) {
                invoice.status = 'partial';
                invoice.updatedAt = new Date();
            }
            
            saveDatabase();
            
            console.log(`✅ Pago registrado: ${referencia} - $${monto} para factura ${invoice.number}`);
            res.status(201).json(newPayment);
            
        } catch (error) {
            console.error('Error al registrar pago:', error);
            res.status(500).json({ error: 'Error al registrar pago' });
        }
    }
);

app.get('/api/payments/:id', authenticateToken, async (req, res) => {
    try {
        const payment = db.payments.find(p => p.id === req.params.id);
        if (!payment) {
            return res.status(404).json({ error: 'Pago no encontrado' });
        }
        
        // Verificar permisos
        if (req.user.role === 'courier') {
            const invoice = db.invoices.find(inv => inv.id === payment.invoiceId);
            if (invoice) {
                const acta = db.actas.find(a => a.id === invoice.actaId);
                if (acta && acta.courierId !== req.user.id) {
                    return res.status(403).json({ error: 'No tiene permisos para ver este pago' });
                }
            }
        }
        
        res.json(payment);
    } catch (error) {
        console.error('Error al obtener pago:', error);
        res.status(500).json({ error: 'Error al obtener pago' });
    }
});

// Backup Routes
app.get('/api/backup/export', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        // Crear respaldo completo de la base de datos
        const backup = {
            metadata: {
                exportDate: new Date().toISOString(),
                version: '1.0',
                exportedBy: req.user.username,
                description: 'Respaldo completo del Sistema de Distribución de Carga'
            },
            data: {
                users: db.users || [],
                actas: db.actas || [],
                invoices: db.invoices || [],
                payments: db.payments || [],
                agents: db.agents || [],
                cityRates: db.cityRates || {}
            },
            statistics: {
                totalUsers: (db.users || []).length,
                totalActas: (db.actas || []).length,
                totalInvoices: (db.invoices || []).length,
                totalPayments: (db.payments || []).length,
                totalAgents: (db.agents || []).length
            }
        };

        // Configurar headers para descarga
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="backup-distcarga-${new Date().toISOString().split('T')[0]}.json"`);
        
        console.log(`✅ Respaldo exportado por ${req.user.username}`);
        res.json(backup);
        
    } catch (error) {
        console.error('Error al exportar respaldo:', error);
        res.status(500).json({ error: 'Error al generar respaldo' });
    }
});

app.post('/api/backup/import', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { backupData, options } = req.body;
        
        if (!backupData || !backupData.data) {
            return res.status(400).json({ error: 'Datos de respaldo inválidos' });
        }

        // Validar estructura del respaldo
        const requiredTables = ['users', 'actas', 'invoices', 'payments', 'agents', 'cityRates'];
        const backupTables = Object.keys(backupData.data);
        
        // Crear respaldo de los datos actuales antes de importar
        const currentBackup = {
            users: db.users || [],
            actas: db.actas || [],
            invoices: db.invoices || [],
            payments: db.payments || [],
            agents: db.agents || [],
            cityRates: db.cityRates || {}
        };

        try {
            // Opciones de importación
            const importOptions = {
                overwrite: options?.overwrite || false,
                mergeUsers: options?.mergeUsers || false,
                preservePasswords: options?.preservePasswords !== false
            };

            let importStats = {
                imported: {},
                skipped: {},
                errors: []
            };

            // Importar cada tabla
            for (const table of requiredTables) {
                if (backupData.data[table]) {
                    const result = await importTable(table, backupData.data[table], importOptions);
                    importStats.imported[table] = result.imported;
                    importStats.skipped[table] = result.skipped;
                    if (result.errors) {
                        importStats.errors.push(...result.errors);
                    }
                }
            }

            // Guardar base de datos actualizada
            saveDatabase();

            console.log(`✅ Respaldo importado por ${req.user.username}:`, importStats);
            
            res.json({
                success: true,
                message: 'Respaldo importado exitosamente',
                statistics: importStats,
                backupInfo: backupData.metadata || {}
            });

        } catch (importError) {
            // Restaurar datos originales en caso de error
            console.error('Error durante importación, restaurando datos originales:', importError);
            
            db.users = currentBackup.users;
            db.actas = currentBackup.actas;
            db.invoices = currentBackup.invoices;
            db.payments = currentBackup.payments;
            db.agents = currentBackup.agents;
            db.cityRates = currentBackup.cityRates;
            
            saveDatabase();
            
            throw importError;
        }
        
    } catch (error) {
        console.error('Error al importar respaldo:', error);
        res.status(500).json({ error: 'Error al importar respaldo: ' + error.message });
    }
});

// Función auxiliar para importar tablas
async function importTable(tableName, data, options) {
    let imported = 0;
    let skipped = 0;
    let errors = [];

    try {
        if (tableName === 'users' && options.mergeUsers) {
            // Fusionar usuarios (no sobrescribir usuarios existentes)
            for (const user of data) {
                const existingUser = db.users.find(u => u.username === user.username);
                if (!existingUser) {
                    if (!options.preservePasswords) {
                        // Regenerar hash de contraseña si es necesario
                        user.password = await bcrypt.hash(user.password || 'defaultPassword', 10);
                    }
                    db.users.push(user);
                    imported++;
                } else {
                    skipped++;
                }
            }
        } else if (tableName === 'cityRates') {
            // Fusionar tarifas de ciudades
            if (options.overwrite) {
                db.cityRates = data;
                imported = Object.keys(data).length;
            } else {
                for (const [city, rate] of Object.entries(data)) {
                    if (!db.cityRates[city]) {
                        db.cityRates[city] = rate;
                        imported++;
                    } else {
                        skipped++;
                    }
                }
            }
        } else {
            // Para otras tablas (actas, invoices, payments, agents)
            if (options.overwrite) {
                db[tableName] = data;
                imported = data.length;
            } else {
                // Fusionar sin sobrescribir
                for (const item of data) {
                    const existingItem = db[tableName].find(existing => existing.id === item.id);
                    if (!existingItem) {
                        db[tableName].push(item);
                        imported++;
                    } else {
                        skipped++;
                    }
                }
            }
        }
    } catch (error) {
        errors.push(`Error en tabla ${tableName}: ${error.message}`);
    }

    return { imported, skipped, errors };
}

// Guide Status Routes
app.put('/api/actas/:actaId/guides/:guideIndex/status', authenticateToken, authorizeRoles(['admin']),
    body('status').isIn(['almacen', 'lista_despacho', 'en_despacho', 'despachada']).withMessage('Estado inválido'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { actaId, guideIndex } = req.params;
            const { status, notes } = req.body;
            
            // Encontrar el acta
            const acta = db.actas.find(a => a.id === actaId);
            if (!acta) {
                return res.status(404).json({ error: 'Acta no encontrada' });
            }
            
            // Verificar que el índice de guía es válido
            const index = parseInt(guideIndex);
            if (isNaN(index) || index < 0 || index >= acta.guides.length) {
                return res.status(400).json({ error: 'Índice de guía inválido' });
            }
            
            // Actualizar estado de la guía
            const guide = acta.guides[index];
            const previousStatus = guide.status || 'almacen';
            
            guide.status = status;
            guide.statusHistory = guide.statusHistory || [];
            guide.statusHistory.push({
                status: status,
                changedBy: req.user.username,
                changedAt: new Date(),
                notes: notes || '',
                previousStatus: previousStatus
            });
            guide.lastStatusUpdate = new Date();
            
            // Actualizar acta
            acta.updatedAt = new Date();
            saveDatabase();
            
            console.log(`✅ Estado de guía ${guide.noGuia} actualizado a: ${status} por ${req.user.username}`);
            
            res.json({
                success: true,
                guide: guide,
                message: `Estado actualizado a: ${getStatusText(status)}`
            });
            
        } catch (error) {
            console.error('Error al actualizar estado de guía:', error);
            res.status(500).json({ error: 'Error al actualizar estado de guía' });
        }
    }
);

app.put('/api/actas/:actaId/guides/bulk-status', authenticateToken, authorizeRoles(['admin']),
    body('guides').isArray().withMessage('Se requiere un array de guías'),
    body('guides.*.index').isInt({ min: 0 }).withMessage('Índice de guía inválido'),
    body('guides.*.status').isIn(['almacen', 'lista_despacho', 'en_despacho', 'despachada']).withMessage('Estado inválido'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { actaId } = req.params;
            const { guides, notes } = req.body;
            
            // Encontrar el acta
            const acta = db.actas.find(a => a.id === actaId);
            if (!acta) {
                return res.status(404).json({ error: 'Acta no encontrada' });
            }
            
            let updatedCount = 0;
            let errors = [];
            
            // Actualizar cada guía
            for (const guideUpdate of guides) {
                try {
                    const { index, status } = guideUpdate;
                    
                    if (index >= 0 && index < acta.guides.length) {
                        const guide = acta.guides[index];
                        const previousStatus = guide.status || 'almacen';
                        
                        guide.status = status;
                        guide.statusHistory = guide.statusHistory || [];
                        guide.statusHistory.push({
                            status: status,
                            changedBy: req.user.username,
                            changedAt: new Date(),
                            notes: notes || 'Actualización masiva',
                            previousStatus: previousStatus
                        });
                        guide.lastStatusUpdate = new Date();
                        
                        updatedCount++;
                    } else {
                        errors.push(`Índice ${index} fuera de rango`);
                    }
                } catch (err) {
                    errors.push(`Error en guía ${guideUpdate.index}: ${err.message}`);
                }
            }
            
            // Actualizar acta
            acta.updatedAt = new Date();
            saveDatabase();
            
            console.log(`✅ ${updatedCount} guías actualizadas por ${req.user.username}`);
            
            res.json({
                success: true,
                updatedCount: updatedCount,
                errors: errors,
                message: `${updatedCount} guías actualizadas exitosamente`
            });
            
        } catch (error) {
            console.error('Error en actualización masiva:', error);
            res.status(500).json({ error: 'Error en actualización masiva' });
        }
    }
);

// Función auxiliar para obtener texto de estado
function getStatusText(status) {
    const statusMap = {
        'almacen': 'En Almacén',
        'lista_despacho': 'Lista para Despacho',
        'en_despacho': 'En Despacho',
        'despachada': 'Despachada'
    };
    return statusMap[status] || status;
}

// Accounts Receivable Routes
app.get('/api/accounts-receivable', authenticateToken, async (req, res) => {
    try {
        const { status, agente, dateFrom, dateTo } = req.query;
        
        // Obtener todas las facturas
        let invoices = db.invoices || [];
        
        // Filtrar por rol de usuario
        if (req.user.role === 'courier') {
            const courierActas = db.actas.filter(acta => acta.courierId === req.user.id);
            const courierActaIds = courierActas.map(acta => acta.id);
            invoices = invoices.filter(invoice => courierActaIds.includes(invoice.actaId));
        }
        
        // Calcular estado de pago para cada factura
        const accountsReceivable = invoices.map(invoice => {
            // Calcular total pagado para esta factura
            const payments = db.payments.filter(p => p.invoiceId === invoice.id && p.estado === 'completado');
            const totalPaid = payments.reduce((sum, p) => sum + (p.monto || 0), 0);
            const balance = invoice.total - totalPaid;
            
            // Determinar estado de pago
            let paymentStatus;
            if (totalPaid === 0) {
                paymentStatus = 'pending';
            } else if (balance <= 0) {
                paymentStatus = 'paid';
            } else {
                paymentStatus = 'partial';
            }
            
            // Calcular días vencidos
            const invoiceDate = new Date(invoice.fecha);
            const today = new Date();
            const daysDue = Math.floor((today - invoiceDate) / (1000 * 60 * 60 * 24));
            
            // Determinar aging
            let aging;
            if (daysDue <= 30) {
                aging = '0-30';
            } else if (daysDue <= 60) {
                aging = '31-60';
            } else if (daysDue <= 90) {
                aging = '61-90';
            } else {
                aging = '90+';
            }
            
            return {
                invoiceId: invoice.id,
                invoiceNumber: invoice.number,
                fecha: invoice.fecha,
                agente: invoice.agente,
                ciudad: invoice.ciudad,
                total: invoice.total,
                totalPaid: totalPaid,
                balance: balance,
                paymentStatus: paymentStatus,
                daysDue: daysDue,
                aging: aging,
                payments: payments,
                actaId: invoice.actaId,
                createdAt: invoice.createdAt,
                paymentTerms: invoice.paymentTerms || '30 días'
            };
        });
        
        // Aplicar filtros
        let filtered = accountsReceivable;
        
        if (status) {
            filtered = filtered.filter(ar => ar.paymentStatus === status);
        }
        
        if (agente) {
            filtered = filtered.filter(ar => ar.agente.toLowerCase().includes(agente.toLowerCase()));
        }
        
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            filtered = filtered.filter(ar => new Date(ar.fecha) >= fromDate);
        }
        
        if (dateTo) {
            const toDate = new Date(dateTo);
            filtered = filtered.filter(ar => new Date(ar.fecha) <= toDate);
        }
        
        // Calcular estadísticas
        const stats = {
            totalInvoices: filtered.length,
            totalAmount: filtered.reduce((sum, ar) => sum + ar.total, 0),
            totalPaid: filtered.reduce((sum, ar) => sum + ar.totalPaid, 0),
            totalPending: filtered.reduce((sum, ar) => sum + ar.balance, 0),
            byStatus: {
                pending: filtered.filter(ar => ar.paymentStatus === 'pending').length,
                partial: filtered.filter(ar => ar.paymentStatus === 'partial').length,
                paid: filtered.filter(ar => ar.paymentStatus === 'paid').length
            },
            byAging: {
                '0-30': filtered.filter(ar => ar.aging === '0-30' && ar.balance > 0).reduce((sum, ar) => sum + ar.balance, 0),
                '31-60': filtered.filter(ar => ar.aging === '31-60' && ar.balance > 0).reduce((sum, ar) => sum + ar.balance, 0),
                '61-90': filtered.filter(ar => ar.aging === '61-90' && ar.balance > 0).reduce((sum, ar) => sum + ar.balance, 0),
                '90+': filtered.filter(ar => ar.aging === '90+' && ar.balance > 0).reduce((sum, ar) => sum + ar.balance, 0)
            }
        };
        
        res.json({
            accounts: filtered,
            statistics: stats
        });
        
    } catch (error) {
        console.error('Error al obtener cuentas por cobrar:', error);
        res.status(500).json({ error: 'Error al obtener cuentas por cobrar' });
    }
});

app.post('/api/accounts-receivable/:invoiceId/reminder', authenticateToken, authorizeRoles(['admin']),
    body('message').optional().isLength({ max: 500 }).withMessage('Mensaje demasiado largo'),
    async (req, res) => {
        try {
            const { invoiceId } = req.params;
            const { message } = req.body;
            
            // Verificar que la factura existe
            const invoice = db.invoices.find(inv => inv.id === invoiceId);
            if (!invoice) {
                return res.status(404).json({ error: 'Factura no encontrada' });
            }
            
            // Calcular balance pendiente
            const payments = db.payments.filter(p => p.invoiceId === invoiceId && p.estado === 'completado');
            const totalPaid = payments.reduce((sum, p) => sum + (p.monto || 0), 0);
            const balance = invoice.total - totalPaid;
            
            if (balance <= 0) {
                return res.status(400).json({ error: 'Esta factura ya está pagada completamente' });
            }
            
            // Crear recordatorio
            const reminder = {
                id: Date.now().toString(),
                invoiceId: invoiceId,
                invoiceNumber: invoice.number,
                agente: invoice.agente,
                balance: balance,
                message: message || `Recordatorio de pago para factura ${invoice.number}. Monto pendiente: $${balance.toFixed(2)}`,
                sentBy: req.user.username,
                sentAt: new Date(),
                status: 'sent'
            };
            
            // Guardar recordatorio en la base de datos
            if (!db.paymentReminders) {
                db.paymentReminders = [];
            }
            db.paymentReminders.push(reminder);
            saveDatabase();
            
            console.log(`📧 Recordatorio enviado para factura ${invoice.number} por ${req.user.username}`);
            
            res.json({
                success: true,
                reminder: reminder,
                message: 'Recordatorio registrado exitosamente'
            });
            
        } catch (error) {
            console.error('Error al enviar recordatorio:', error);
            res.status(500).json({ error: 'Error al enviar recordatorio' });
        }
    }
);

// Debug route para verificar estado de librerías
app.get('/api/debug/libraries', (req, res) => {
    res.json({
        hasExcelSupport,
        hasUploadSupport,
        xlsxLoaded: !!xlsx,
        multerLoaded: !!multer,
        uploadConfigured: !!upload,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// Excel Import Routes
app.post('/api/actas/import-excel', authenticateToken, authorizeRoles(['admin']), (req, res, next) => {
    // Verificar que las librerías estén disponibles
    if (!hasExcelSupport || !hasUploadSupport || !upload) {
        return res.status(503).json({ 
            error: 'Funcionalidad de importación Excel no disponible',
            message: 'Las librerías necesarias no están instaladas correctamente',
            details: {
                excelSupport: hasExcelSupport,
                uploadSupport: hasUploadSupport,
                uploadConfigured: !!upload
            }
        });
    }
    upload.single('excelFile')(req, res, next);
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
        }

        console.log(`📊 Procesando archivo Excel: ${req.file.originalname}`);

        // Leer el archivo Excel desde el buffer usando XLSX
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convertir a JSON
        const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawData.length < 2) {
            return res.status(400).json({ error: 'El archivo debe tener al menos una fila de encabezados y una fila de datos' });
        }

        // Procesar datos del Excel
        const result = await processExcelData(rawData, req.user);

        console.log(`✅ Importación completada: ${result.success} exitosas, ${result.errors.length} errores`);

        res.json({
            success: true,
            imported: result.success,
            errors: result.errors,
            summary: result.summary,
            message: `Importación completada: ${result.success} actas creadas${result.errors.length > 0 ? `, ${result.errors.length} errores` : ''}`
        });

    } catch (error) {
        console.error('Error procesando archivo Excel:', error);
        res.status(500).json({ error: 'Error procesando archivo Excel: ' + error.message });
    }
});

// Nuevo endpoint para importar solo guías
app.post('/api/guias/import-excel', authenticateToken, authorizeRoles(['admin']), (req, res, next) => {
    // Verificar que las librerías estén disponibles
    if (!hasExcelSupport || !hasUploadSupport || !upload) {
        return res.status(503).json({ 
            error: 'Funcionalidad de importación Excel no disponible',
            message: 'Las librerías necesarias no están instaladas correctamente',
            details: {
                excelSupport: hasExcelSupport,
                uploadSupport: hasUploadSupport,
                uploadConfigured: !!upload
            }
        });
    }
    upload.single('excelFile')(req, res, next);
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
        }

        console.log(`📦 Procesando archivo de guías: ${req.file.originalname}`);

        // Leer el archivo Excel desde el buffer usando XLSX
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convertir a JSON
        const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawData.length < 2) {
            return res.status(400).json({ error: 'El archivo debe tener al menos una fila de encabezados y una fila de datos' });
        }

        // Procesar datos de guías
        const result = await processGuiasData(rawData, req.user);

        console.log(`✅ Importación de guías completada: ${result.success} exitosas, ${result.errors.length} errores`);

        res.json({
            success: true,
            imported: result.success,
            errors: result.errors,
            message: `Importación completada: ${result.success} guías creadas${result.errors.length > 0 ? `, ${result.errors.length} errores` : ''}`
        });

    } catch (error) {
        console.error('Error procesando archivo de guías:', error);
        res.status(500).json({ error: 'Error procesando archivo de guías: ' + error.message });
    }
});

// Endpoint simplificado para procesar guías (versión más robusta)
app.post('/api/guias/process-excel', authenticateToken, (req, res, next) => {
    console.log('🔍 Verificando estado de librerías...');
    console.log(`📊 XLSX: ${hasExcelSupport}, Multer: ${hasUploadSupport}, Upload: ${!!upload}`);
    
    // Verificación más permisiva - solo XLSX es absolutamente necesario
    if (!hasExcelSupport || !xlsx) {
        console.error('❌ XLSX no disponible');
        return res.status(503).json({ 
            error: 'Funcionalidad de importación Excel no disponible - XLSX requerido',
            details: { xlsxAvailable: hasExcelSupport }
        });
    }

    // Si no hay multer, usar middleware básico
    if (!upload || !hasUploadSupport) {
        console.warn('⚠️ Usando procesamiento básico sin Multer');
        return res.status(503).json({
            error: 'Sistema de uploads no disponible',
            details: { multerAvailable: hasUploadSupport }
        });
    }

    upload.single('excelFile')(req, res, next);
}, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
        }

        console.log(`📦 Procesando archivo: ${req.file.originalname}, Tamaño: ${req.file.size} bytes`);

        // Verificar que XLSX esté disponible antes de usarlo
        if (!xlsx) {
            throw new Error('XLSX no está disponible en este momento');
        }

        // Leer el archivo Excel desde el buffer
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('El archivo Excel no contiene hojas válidas');
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convertir a JSON
        const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rawData || rawData.length < 2) {
            return res.status(400).json({ 
                error: 'El archivo debe tener al menos una fila de encabezados y una fila de datos',
                found: rawData ? rawData.length : 0
            });
        }

        console.log(`📊 Datos extraídos: ${rawData.length} filas`);

        // Procesar solo para extraer guías
        const result = await extractGuidesFromExcel(rawData, req.user);

        console.log(`✅ Resultado: ${result.success} guías exitosas, ${result.errors.length} errores`);

        res.json({
            success: true,
            guides: result.guides || [],
            imported: result.success || 0,
            errors: result.errors || [],
            message: `${result.success || 0} guías extraídas${result.errors && result.errors.length > 0 ? `, ${result.errors.length} errores` : ''}`
        });

    } catch (error) {
        console.error('❌ Error procesando archivo:', error);
        res.status(500).json({ 
            error: 'Error procesando archivo: ' + error.message,
            details: error.stack
        });
    }
});

// Función para procesar datos del Excel
async function processExcelData(rawData, user) {
    const headers = rawData[0];
    const dataRows = rawData.slice(1);
    
    let successCount = 0;
    let errors = [];
    let createdActas = [];

    // Mapeo de columnas esperadas (flexible)
    const columnMapping = getColumnMapping(headers);

    for (let i = 0; i < dataRows.length; i++) {
        const rowIndex = i + 2; // +2 porque empezamos desde la fila 2 (fila 1 son headers)
        const row = dataRows[i];

        try {
            // Saltar filas vacías
            if (!row || row.every(cell => !cell)) {
                continue;
            }

            // Extraer datos de la fila
            const actaData = extractActaDataFromRow(row, columnMapping, rowIndex);
            
            // Validar datos requeridos
            const validation = validateActaData(actaData, rowIndex);
            if (!validation.isValid) {
                errors.push(...validation.errors);
                continue;
            }

            // Crear el acta
            const newActa = {
                id: Date.now().toString() + '_' + i,
                fecha: actaData.fecha,
                ciudad: actaData.ciudad,
                agente: actaData.agente,
                modeloCamion: actaData.modeloCamion || '',
                anioCamion: actaData.anioCamion || '',
                placaCamion: actaData.placaCamion || '',
                nombreChofer: actaData.nombreChofer || '',
                telefonoChofer: actaData.telefonoChofer || '',
                nombreAyudante: actaData.nombreAyudante || '',
                telefonoAyudante: actaData.telefonoAyudante || '',
                guides: actaData.guides || [],
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
                importedFrom: 'excel',
                importedBy: user.username,
                importedAt: new Date()
            };

            // Agregar a la base de datos
            db.actas.push(newActa);
            createdActas.push(newActa);
            successCount++;

        } catch (error) {
            errors.push({
                row: rowIndex,
                error: `Error procesando fila: ${error.message}`
            });
        }
    }

    // Guardar cambios
    if (successCount > 0) {
        saveDatabase();
    }

    return {
        success: successCount,
        errors: errors,
        summary: {
            totalRows: dataRows.length,
            processed: successCount,
            failed: errors.length,
            createdActas: createdActas
        }
    };
}

// Función para mapear columnas del Excel
function getColumnMapping(headers) {
    const mapping = {};
    
    // Mapeo flexible de columnas (insensible a mayúsculas/minúsculas y espacios)
    const columnPatterns = {
        fecha: /fecha|date/i,
        ciudad: /ciudad|city/i,
        agente: /agente|agent/i,
        modeloCamion: /modelo\s*camion|truck\s*model|modelo/i,
        anioCamion: /año\s*camion|year\s*truck|año|year/i,
        placaCamion: /placa|plate|license/i,
        nombreChofer: /chofer|driver|conductor/i,
        telefonoChofer: /telefono\s*chofer|phone\s*driver|tel\s*chofer/i,
        nombreAyudante: /ayudante|helper|assistant/i,
        telefonoAyudante: /telefono\s*ayudante|phone\s*helper|tel\s*ayudante/i,
        // Nuevos campos de guías
        no: /^no\.?$|numero|number/i,
        warehouse: /warehouse|almacen|bodega/i,
        file: /file|expediente|archivo/i,
        origen: /origen|origin|source/i,
        via: /via|route|tipo|transporte/i,
        cliente: /cliente|client|customer/i,
        embarcador: /embarcador|shipper|sender/i,
        cantTeorica: /cant\.?\s*teorica|theoretical\s*qty|cantidad\s*teorica/i,
        cantDespachada: /cant\.?\s*despachada|dispatched\s*qty|cantidad\s*despachada/i,
        piesCubicos: /pies\s*cubicos|cubic\s*feet|ft3|pies³/i,
        peso: /peso|weight|kg|kgs|kilos/i,
        destino: /destino|destination|dest/i,
        direccion: /direccion|address|addr/i
    };

    headers.forEach((header, index) => {
        if (!header) return;
        
        const cleanHeader = header.toString().trim();
        
        Object.keys(columnPatterns).forEach(field => {
            if (columnPatterns[field].test(cleanHeader)) {
                mapping[field] = index;
            }
        });
    });

    return mapping;
}

// Función para extraer datos del acta de una fila
function extractActaDataFromRow(row, mapping, rowIndex) {
    const data = {};
    
    // Campos principales del acta
    Object.keys(mapping).forEach(field => {
        const colIndex = mapping[field];
        if (colIndex !== undefined && row[colIndex] !== undefined) {
            data[field] = row[colIndex];
        }
    });

    // Convertir fecha si es necesario
    if (data.fecha) {
        try {
            // Si es un número (fecha Excel), convertir
            if (typeof data.fecha === 'number') {
                const excelDate = new Date((data.fecha - 25569) * 86400 * 1000);
                data.fecha = excelDate.toISOString().split('T')[0];
            } else if (typeof data.fecha === 'string') {
                // Intentar parsear como fecha
                const parsedDate = new Date(data.fecha);
                if (!isNaN(parsedDate.getTime())) {
                    data.fecha = parsedDate.toISOString().split('T')[0];
                }
            }
        } catch (error) {
            console.warn(`Error parsing date in row ${rowIndex}:`, error);
        }
    }

    // Procesar múltiples guías (separadas por punto y coma o múltiples columnas)
    data.guides = [];
    
    // Método 1: Guías separadas por punto y coma en una celda
    if (data.noGuia && data.noGuia.includes(';')) {
        const guias = data.noGuia.split(';');
        const clientes = (data.nombreCliente || '').split(';');
        const direcciones = (data.direccion || '').split(';');
        const telefonos = (data.telefono || '').split(';');
        const bultos = (data.bultos || '').toString().split(';');
        const pies = (data.pies || '').toString().split(';');
        const kgs = (data.kgs || '').toString().split(';');
        const vias = (data.via || '').split(';');
        const subtotales = (data.subtotal || '').toString().split(';');

        guias.forEach((guia, index) => {
            if (guia.trim()) {
                data.guides.push({
                    noGuia: guia.trim(),
                    nombreCliente: (clientes[index] || clientes[0] || 'Cliente Importado').trim(),
                    direccion: (direcciones[index] || direcciones[0] || '').trim(),
                    telefono: (telefonos[index] || telefonos[0] || '').trim(),
                    bultos: parseInt(bultos[index] || bultos[0] || '1') || 1,
                    pies: parseFloat(pies[index] || pies[0] || '0') || 0,
                    kgs: parseFloat(kgs[index] || kgs[0] || '0') || 0,
                    via: (vias[index] || vias[0] || 'terrestre').trim(),
                    subtotal: parseFloat(subtotales[index] || subtotales[0] || '0') || 0,
                    status: 'almacen',
                    createdAt: new Date()
                });
            }
        });
    }
    // Método 2: Guía única tradicional
    else if (data.noGuia || data.nombreCliente) {
        data.guides.push({
            noGuia: data.noGuia || `AUTO-${rowIndex}`,
            nombreCliente: data.nombreCliente || 'Cliente Importado',
            direccion: data.direccion || '',
            telefono: data.telefono || '',
            bultos: parseInt(data.bultos) || 1,
            pies: parseFloat(data.pies) || 0,
            kgs: parseFloat(data.kgs) || 0,
            via: data.via || 'terrestre',
            subtotal: parseFloat(data.subtotal) || 0,
            status: 'almacen',
            createdAt: new Date()
        });
    }

    return data;
}

// Función para validar datos del acta
function validateActaData(data, rowIndex) {
    const errors = [];

    // Validaciones requeridas
    if (!data.fecha) {
        errors.push({ row: rowIndex, error: 'Fecha es requerida' });
    }
    
    if (!data.ciudad) {
        errors.push({ row: rowIndex, error: 'Ciudad es requerida' });
    }
    
    if (!data.agente) {
        errors.push({ row: rowIndex, error: 'Agente es requerido' });
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

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

app.post('/api/agents', authenticateToken,
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

// Función para procesar datos de guías específicamente
async function processGuiasData(rawData, user) {
    const headers = rawData[0];
    const dataRows = rawData.slice(1);
    
    let successCount = 0;
    let errors = [];

    // Mapeo de columnas para guías
    const columnMapping = getGuiasColumnMapping(headers);

    for (let i = 0; i < dataRows.length; i++) {
        const rowIndex = i + 2; // +2 porque empezamos desde la fila 2
        const row = dataRows[i];

        try {
            // Saltar filas vacías
            if (!row || row.every(cell => !cell)) {
                continue;
            }

            // Extraer datos de la guía
            const guiaData = extractGuiaDataFromRow(row, columnMapping, rowIndex);
            
            // Validar que al menos tenga cliente y dirección
            if (!guiaData.cliente || !guiaData.direccion) {
                errors.push({
                    row: rowIndex,
                    error: 'CLIENTE y DIRECCION son campos obligatorios'
                });
                continue;
            }

            // Crear una acta simple para contener esta guía
            const newActa = {
                id: Date.now().toString() + '_' + i,
                fecha: new Date().toISOString().split('T')[0],
                ciudad: guiaData.destino || 'Ciudad no especificada',
                agente: user.name || user.username,
                modeloCamion: '',
                anioCamion: '',
                placaCamion: '',
                nombreChofer: '',
                telefonoChofer: '',
                nombreAyudante: '',
                telefonoAyudante: '',
                guides: [guiaData],
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
                importedFrom: 'excel-guias',
                importedBy: user.username,
                importedAt: new Date()
            };

            // Agregar el courier ID si el usuario es courier
            if (user.role === 'courier') {
                newActa.courierId = user.id;
            }

            // Guardar en la base de datos
            db.actas.push(newActa);
            successCount++;

        } catch (error) {
            errors.push({
                row: rowIndex,
                error: error.message || 'Error procesando fila'
            });
        }
    }

    // Guardar cambios
    saveDatabase();

    return {
        success: successCount,
        errors: errors
    };
}

// Función para mapear columnas de guías
function getGuiasColumnMapping(headers) {
    const mapping = {};
    
    const columnPatterns = {
        no: /^no\.?$|numero/i,
        warehouse: /warehouse|almacen|bodega/i,
        file: /file|expediente|archivo/i,
        origen: /origen|origin|source/i,
        via: /via|route|tipo|transporte/i,
        cliente: /cliente|client|customer/i,
        embarcador: /embarcador|shipper|sender/i,
        cantTeorica: /cant\.?\s*teorica|theoretical\s*qty|cantidad\s*teorica/i,
        cantDespachada: /cant\.?\s*despachada|dispatched\s*qty|cantidad\s*despachada/i,
        piesCubicos: /pies\s*cubicos|cubic\s*feet|ft3|pies³/i,
        peso: /peso|weight|kg|kgs|kilos/i,
        destino: /destino|destination|dest/i,
        direccion: /direccion|address|addr/i
    };

    headers.forEach((header, index) => {
        if (!header) return;
        
        const cleanHeader = header.toString().trim();
        
        Object.keys(columnPatterns).forEach(field => {
            if (columnPatterns[field].test(cleanHeader)) {
                mapping[field] = index;
            }
        });
    });

    return mapping;
}

// Función para extraer datos de guía de una fila
function extractGuiaDataFromRow(row, mapping, rowIndex) {
    const guia = {
        no: row[mapping.no] || rowIndex - 1,
        warehouse: row[mapping.warehouse] || '',
        file: row[mapping.file] || '',
        origen: row[mapping.origen] || '',
        via: row[mapping.via] || 'terrestre',
        cliente: row[mapping.cliente] || '',
        embarcador: row[mapping.embarcador] || '',
        cantTeorica: parseInt(row[mapping.cantTeorica]) || 0,
        cantDespachada: parseInt(row[mapping.cantDespachada]) || 0,
        piesCubicos: parseFloat(row[mapping.piesCubicos]) || 0,
        peso: parseFloat(row[mapping.peso]) || 0,
        destino: row[mapping.destino] || '',
        direccion: row[mapping.direccion] || '',
        status: 'En Almacén',
        createdAt: new Date()
    };

    return guia;
}

// Función para extraer solo guías del Excel (sin crear actas)
async function extractGuidesFromExcel(rawData, user) {
    const headers = rawData[0];
    const dataRows = rawData.slice(1);
    
    let successCount = 0;
    let errors = [];
    let extractedGuides = [];

    // Mapeo de columnas para guías
    const columnMapping = getGuiasColumnMapping(headers);

    for (let i = 0; i < dataRows.length; i++) {
        const rowIndex = i + 2; // +2 porque empezamos desde la fila 2
        const row = dataRows[i];

        try {
            // Saltar filas vacías
            if (!row || row.every(cell => !cell)) {
                continue;
            }

            // Extraer datos de la guía
            const guiaData = extractGuiaDataFromRow(row, columnMapping, rowIndex);
            
            // Validar que al menos tenga cliente y dirección
            if (!guiaData.cliente || !guiaData.direccion) {
                errors.push({
                    row: rowIndex,
                    error: 'CLIENTE y DIRECCION son campos obligatorios'
                });
                continue;
            }

            extractedGuides.push(guiaData);
            successCount++;

        } catch (error) {
            errors.push({
                row: rowIndex,
                error: error.message || 'Error procesando fila'
            });
        }
    }

    return {
        success: successCount,
        errors: errors,
        guides: extractedGuides
    };
}

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