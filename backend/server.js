const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const cookieParser = require('cookie-parser');

// Cargar variables de entorno
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware
// Añadimos la URL de Netlify a la lista de orígenes permitidos
const allowedOrigins = [
    'http://localhost:8080', 
    'http://127.0.0.1:5500',
    'https://illustrious-cassata-b59f1f.netlify.app',
    'https://darling-kangaroo-a3f22e.netlify.app'
];

const corsOptions = {
    origin: function (origin, callback) {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
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

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// ===================================================
//                  DATABASE CONNECTION
// ===================================================
mongoose.connect(process.env.DATABASE_URL)
  .then(() => {
    console.log('Successfully connected to MongoDB Atlas!');
    seedInitialData(); // Llama a la función para sembrar datos iniciales
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB Atlas:', error);
    process.exit(1);
  });

// ===================================================
//                  DATABASE MODELS (SCHEMAS)
// ===================================================
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['admin', 'courier'] },
    name: { type: String, required: true, trim: true },
});
const User = mongoose.model('User', UserSchema);

const GuideSchema = new mongoose.Schema({
    noGuia: String,
    nombreCliente: String,
    direccion: String,
    telefono: String,
    bultos: Number,
    pies: Number,
    kgs: Number,
    via: String,
    subtotal: Number,
}, { _id: false });

const ActaSchema = new mongoose.Schema({
    fecha: { type: Date, required: true },
    ciudad: { type: String, required: true },
    agente: { type: String, required: true },
    guides: [GuideSchema],
    courierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, default: 'draft' },
}, { timestamps: true });
const Acta = mongoose.model('Acta', ActaSchema);

const InvoiceSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true },
    actaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Acta', required: true },
    total: { type: Number, required: true },
    status: { type: String, default: 'pending', enum: ['pending', 'paid', 'partial'] },
}, { timestamps: true });
const Invoice = mongoose.model('Invoice', InvoiceSchema);

const PaymentSchema = new mongoose.Schema({
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    amount: { type: Number, required: true },
    description: { type: String },
}, { timestamps: true });
const Payment = mongoose.model('Payment', PaymentSchema);

const CityRateSchema = new mongoose.Schema({
    city: { type: String, required: true, unique: true },
    rate: { type: Number, required: true },
});
const CityRate = mongoose.model('CityRate', CityRateSchema);

// ===================================================
//             DATABASE SEEDING (INITIAL DATA)
// ===================================================
async function seedInitialData() {
    try {
        const userCount = await User.countDocuments();
        if (userCount === 0) {
            console.log('No users found, seeding default users...');
            const hashedAdminPassword = await bcrypt.hash('admin123', 10);
            const hashedCourierPassword = await bcrypt.hash('courier123', 10);

            await User.create([
                { username: 'admin', password: hashedAdminPassword, role: 'admin', name: 'Administrator' },
                { username: 'courier1', password: hashedCourierPassword, role: 'courier', name: 'Courier One' }
            ]);
            console.log('Default users seeded.');
        }

        const cityRateCount = await CityRate.countDocuments();
        if (cityRateCount === 0) {
            console.log('No city rates found, seeding default rates...');
            await CityRate.create([
                { city: 'Caracas', rate: 10.5 },
                { city: 'Maracaibo', rate: 12.0 },
                { city: 'Valencia', rate: 11.0 },
                { city: 'Barquisimeto', rate: 11.5 },
                { city: 'Maracay', rate: 10.8 }
            ]);
            console.log('Default city rates seeded.');
        }
    } catch (error) {
        console.error('Error seeding initial data:', error);
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

// ===================================================
//                     API ROUTES
// ===================================================

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
    
    const user = await User.findOne({ username: username });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Error en el login:', error);
    res.status(500).json({ error: 'Error interno del servidor durante el login' });
  }
});

app.post('/api/logout', (req, res) => {
    res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0)
    });
    res.status(200).json({ message: 'Logout successful' });
});

app.get('/api/dashboard', authenticateToken, async (req, res) => {
    try {
        const totalActas = await Acta.countDocuments();
        const totalInvoices = await Invoice.countDocuments();

        const invoices = await Invoice.find();
        const payments = await Payment.find();

        const totalBilled = invoices.reduce((sum, inv) => sum + inv.total, 0);
        const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
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


// Rutas de actas
app.get('/api/actas', authenticateToken, async (req, res) => {
  try {
    const query = req.user.role === 'courier' ? { courierId: req.user.id } : {};
    const actas = await Acta.find(query).sort({ createdAt: -1 });
    res.json(actas);
  } catch (error) {
    console.error('Error al obtener actas:', error);
    res.status(500).json({ error: 'Error al obtener actas' });
  }
});

app.post('/api/actas', authenticateToken, authorizeRoles(['admin', 'courier']),
  body('fecha').isISO8601(),
  body('ciudad').notEmpty(),
  body('agente').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  try {
    const newActaData = { ...req.body };
    if (req.user.role === 'courier') {
      newActaData.courierId = req.user.id;
    }
    
    const newActa = new Acta(newActaData);
    await newActa.save();
    res.status(201).json(newActa);
  } catch (error) {
    console.error('Error al crear acta:', error);
    res.status(500).json({ error: 'Error al crear acta' });
  }
});

app.put('/api/actas/:id', authenticateToken, authorizeRoles(['admin', 'courier']), async (req, res) => {
    try {
        const updatedActa = await Acta.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedActa) {
            return res.status(404).json({ message: "Acta not found" });
        }
        res.json(updatedActa);
    } catch (error) {
        console.error('Error al actualizar acta:', error);
        res.status(500).json({ error: 'Error al actualizar acta' });
    }
});

app.get('/api/actas/:id', authenticateToken, async (req, res) => {
    try {
        const acta = await Acta.findById(req.params.id);
        if (!acta) {
            return res.status(404).json({ message: "Acta not found" });
        }
        res.json(acta);
    } catch (error) {
        console.error('Error al obtener acta:', error);
        res.status(500).json({ error: 'Error al obtener acta' });
    }
});

// City Rates Routes
app.get('/api/city-rates', authenticateToken, async (req, res) => {
    try {
        const rates = await CityRate.find();
        const rateMap = rates.reduce((acc, rate) => {
            acc[rate.city] = rate.rate;
            return acc;
        }, {});
        res.json(rateMap);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/city-rates', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const newRates = req.body;
        const promises = Object.keys(newRates).map(city => {
            return CityRate.findOneAndUpdate(
                { city: city },
                { rate: newRates[city] },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        });
        await Promise.all(promises);
        res.json({ message: 'Rates updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Invoice Routes
app.get('/api/invoices', authenticateToken, async (req, res) => {
    try {
        const invoices = await Invoice.find().sort({ createdAt: -1 });
        res.json(invoices);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/invoices', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { actaId } = req.body;
        const acta = await Acta.findById(actaId);
        if (!acta) return res.status(404).json({ message: "Acta not found" });

        const existingInvoice = await Invoice.findOne({ actaId: actaId });
        if (existingInvoice) return res.status(400).json({ message: "Invoice already exists for this acta" });

        const cityRates = await CityRate.find();
        const rateMap = cityRates.reduce((acc, rate) => {
            acc[rate.city] = rate.rate;
            return acc;
        }, {});
        
        const total = acta.guides.reduce((sum, guide) => {
            const rate = rateMap[acta.ciudad] || 0;
            return sum + (guide.pies * rate);
        }, 0);

        const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
        const lastNumber = lastInvoice ? parseInt(lastInvoice.number.split('-')[1]) : 0;
        const newNumber = `INV-${(lastNumber + 1).toString().padStart(4, '0')}`;

        const newInvoice = new Invoice({
            number: newNumber,
            actaId: actaId,
            total: total
        });

        await newInvoice.save();
        res.status(201).json(newInvoice);
    } catch (error) {
        console.error("Error creating invoice:", error);
        res.status(500).json({ message: error.message });
    }
});


// Payment Routes
app.get('/api/payments', authenticateToken, async (req, res) => {
    try {
        const payments = await Payment.find().sort({ createdAt: -1 });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/payments', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { invoiceId, amount, description } = req.body;
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

        const newPayment = new Payment({
            invoiceId: invoiceId,
            amount: parseFloat(amount),
            description: description,
        });
        await newPayment.save();

        const paymentsForInvoice = await Payment.find({ invoiceId: invoiceId });
        const totalPaid = paymentsForInvoice.reduce((sum, p) => sum + p.amount, 0);

        if (totalPaid >= invoice.total) {
            invoice.status = 'paid';
        } else if (totalPaid > 0) {
            invoice.status = 'partial';
        }
        await invoice.save();

        res.status(201).json(newPayment);
    } catch (error) {
        console.error("Error creating payment:", error);
        res.status(500).json({ message: error.message });
    }
});


// Servir el index.html para cualquier otra ruta no reconocida (para SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;

