const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const cookieParser = require('cookie-parser');

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
        const totalActas = db.actas.length;
        const totalInvoices = db.invoices.length;

        const totalBilled = db.invoices.reduce((sum, inv) => sum + inv.total, 0);
        const totalCollected = db.payments.reduce((sum, p) => sum + p.amount, 0);
        const pendingBalance = totalBilled - totalCollected;

        res.json({
            totalActas,
            totalInvoices,
            totalBilled,
            totalCollected,
            pendingBalance
        });
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
        console.log('📝 POST /api/actas - Recibido:', req.body);
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('❌ Errores de validación:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }
        
        try {
            const newActa = {
                id: Date.now().toString(), // ID simple para desarrollo
                ...req.body,
                createdAt: new Date(),
                updatedAt: new Date(),
                status: 'pending' // Agregar estado por defecto
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
            const subtotal = acta.guides ? acta.guides.reduce((sum, guide) => sum + (parseFloat(guide.subtotal) || 0), 0) : 0;
            const total = subtotal; // Total igual al subtotal (sin IVA)
            
            // Generar número de factura
            const invoiceNumber = `INV-${Date.now()}`;
            
            // Crear factura con formato profesional
            const newInvoice = {
                id: Date.now().toString(),
                number: invoiceNumber,
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

app.post('/api/agents', authenticateToken, authorizeRoles(['admin']),
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