// Estado global de la aplicación
let currentUser = null;
let cityRates = {};
let currentActa = null;

// 🌙 Tema oscuro/claro
const THEME_KEY = 'app-theme';
let currentTheme = localStorage.getItem(THEME_KEY) || 'light';

// API Base URL - Dinámico según el host actual
// Si estamos en producción en Render, el dominio será appdistcarga.onrender.com
// Si estamos en desarrollo (localhost), usará ese mismo origen.
const API_BASE = `${window.location.origin}/api`;

// Elementos del DOM
const loginScreen = document.getElementById('loginScreen');
const mainScreen = document.getElementById('mainScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const loadingOverlay = document.getElementById('loadingOverlay');

// ========================================
// 🎉 SISTEMA DE NOTIFICACIONES MODERNO
// ========================================

const Toast = {
    show: function(message, type = 'info', duration = 4000) {
        // Crear contenedor si no existe
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }

        // Crear toast
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${this.getColor(type)};
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            margin-bottom: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            pointer-events: auto;
            font-family: 'Inter', sans-serif;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 10px;
        `;

        toast.innerHTML = `
            <i class="fas ${this.getIcon(type)}" style="font-size: 16px;"></i>
            <span style="flex: 1;">${message}</span>
            <button onclick="this.parentElement.remove()" style="
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 12px;
            ">×</button>
        `;

        container.appendChild(toast);

        // Animación de entrada
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);

        // Auto remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    getColor: function(type) {
        const colors = {
            success: 'linear-gradient(135deg, #10b981, #059669)',
            error: 'linear-gradient(135deg, #ef4444, #dc2626)',
            warning: 'linear-gradient(135deg, #f59e0b, #d97706)',
            info: 'linear-gradient(135deg, #3b82f6, #2563eb)'
        };
        return colors[type] || colors.info;
    },

    getIcon: function(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-triangle',
            warning: 'fa-exclamation-circle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    },

    success: function(message, duration) { this.show(message, 'success', duration); },
    error: function(message, duration) { this.show(message, 'error', duration); },
    warning: function(message, duration) { this.show(message, 'warning', duration); },
    info: function(message, duration) { this.show(message, 'info', duration); }
};

const App = {
    // Inicialización
    initializeApp: function() {
        const today = new Date().toISOString().split('T')[0];
        const fechaInput = document.getElementById('fecha');
        if (fechaInput) {
            fechaInput.value = today;
        }
        App.setupTheme();
        App.setupEventListeners();
        App.checkAuthToken();
    },

    // ========================================
    // 🌙 SISTEMA DE TEMAS
    // ========================================

    setupTheme: function() {
        // Aplicar tema inicial
        document.documentElement.setAttribute('data-theme', currentTheme);
        App.updateThemeIcon();
    },

    toggleTheme: function() {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem(THEME_KEY, currentTheme);
        App.updateThemeIcon();
        
        // Animación suave
        document.body.style.transition = 'background-color 300ms ease, color 300ms ease';
        setTimeout(() => {
            document.body.style.transition = '';
        }, 300);
    },

    updateThemeIcon: function() {
        const themeToggle = document.getElementById('themeToggle');
        const icon = themeToggle?.querySelector('i');
        if (icon) {
            icon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            themeToggle.title = currentTheme === 'light' ? 'Modo oscuro' : 'Modo claro';
        }
    },

    // Event Listeners
    setupEventListeners: function() {
        // Solo configurar los event listeners que existen en la pantalla de login
        loginForm.addEventListener('submit', App.handleLogin);
    },

    // Configurar event listeners de la pantalla principal
    setupMainScreenListeners: function() {
        // Configurar event listeners solo si los elementos existen
        const safeAddListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            } else {
                console.warn(`Elemento con ID '${id}' no encontrado para agregar event listener`);
            }
        };

        // Event listeners principales
        safeAddListener('logoutBtn', 'click', App.handleLogout);
        safeAddListener('themeToggle', 'click', App.toggleTheme);
        
        // Navegación
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.dataset.section;
                App.showSection(section);
            });
        });

        // Botón Nueva Acta - SIMPLIFICADO
        const newActaBtn = document.getElementById('newActaBtn');
        if (newActaBtn) {
            newActaBtn.addEventListener('click', function(e) {
                e.preventDefault();
                App.showNewActaModal();
            });
        }
        safeAddListener('filterFechaDesde', 'change', App.applyActasFilters);
        safeAddListener('filterFechaHasta', 'change', App.applyActasFilters);
        safeAddListener('filterCiudad', 'change', App.applyActasFilters);
        safeAddListener('filterAgente', 'change', App.applyActasFilters);
        safeAddListener('clearFiltersBtn', 'click', App.clearActasFilters);
        safeAddListener('exportActasBtn', 'click', App.exportActas);
        
        // Modales
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', App.closeModals);
        });
        
        // Formularios
        safeAddListener('actaForm', 'submit', App.handleActaSubmit);
        safeAddListener('cancelActaBtn', 'click', App.closeModals);
        safeAddListener('addGuideBtn', 'click', () => App.addGuideRow());
        safeAddListener('paymentForm', 'submit', App.handlePaymentSubmit);
        safeAddListener('saveCityRatesBtn', 'click', App.saveCityRates);
        safeAddListener('addCityForm', 'submit', App.handleAddCity);
        safeAddListener('addAgentForm', 'submit', App.handleAddAgent);
        
        // Backup event listeners
        safeAddListener('exportBackupBtn', 'click', App.exportBackup);
        safeAddListener('selectBackupFileBtn', 'click', () => {
            document.getElementById('importBackupFile').click();
        });
        safeAddListener('importBackupFile', 'change', App.handleBackupFileSelection);
        safeAddListener('importBackupBtn', 'click', App.importBackup);
        
        // Accounts Receivable event listeners
        safeAddListener('refreshAccountsBtn', 'click', App.loadAccountsReceivable);
        safeAddListener('applyArFiltersBtn', 'click', App.applyAccountsFilters);
        safeAddListener('clearArFiltersBtn', 'click', App.clearAccountsFilters);
        safeAddListener('exportArBtn', 'click', App.exportAccountsReceivable);
        
        // Excel Import event listeners removido - ahora está integrado en el modal de actas
        safeAddListener('excelFileInput', 'change', App.handleFileSelection);
        console.log('🔗 Agregando event listener para processExcelBtn');
        safeAddListener('processExcelBtn', 'click', App.processExcelFile);
        
        // Guides Import event listeners (dentro del modal de acta)
        safeAddListener('importGuidesBtn', 'click', App.showGuidesImport);
        safeAddListener('guidesFileInput', 'change', App.handleGuidesFileSelection);
        safeAddListener('processGuidesBtn', 'click', App.processGuidesFile);
        
        // Modales click fuera para cerrar
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    App.closeModals();
                }
            });
        });

        console.log('Event listeners de pantalla principal configurados correctamente');
    },

    // Autenticación
    checkAuthToken: function() {
        App.validateToken();
    },

    validateToken: async function() {
        const token = localStorage.getItem('token');

        // Si no hay token, no forzar el reseteo de la pantalla de login
        if (!token) {
            return;
        }

        try {
            // Usar apiCall que ya envía el token correctamente.
            const data = await App.apiCall('/user-profile'); 
                console.log('Data from user-profile:', data); 
                currentUser = data.user;
                console.log('currentUser after setting:', currentUser);
            App.showMainScreen();
        } catch (error) {
            console.error('Token validation failed:', error);
            localStorage.removeItem('token'); // Limpiar token inválido
            App.showLoginScreen();
        }
    },

    handleLogin: async function(e) {
        e.preventDefault();
        const formData = new FormData(loginForm);
        const credentials = Object.fromEntries(formData.entries());
        
        App.showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(credentials)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('token', data.token);
                currentUser = data.user;
                App.showMainScreen();
            } else {
                App.showError(data.error || 'Error de autenticación');
            }
        } catch (error) {
            console.error('Login error:', error);
            App.showError('Error de conexión');
        } finally {
            App.showLoading(false);
        }
    },

    handleLogout: async function() {
        App.showLoading(true);
        try {
            await App.apiCall('/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout request failed:', error);
        }
 finally {
            currentUser = null;
            App.showLoginScreen();
            App.showLoading(false);
        }
    },

    // UI Management
    showLoginScreen: function() {
        loginScreen.classList.add('active');
        mainScreen.classList.remove('active');
        loginError.style.display = 'none';
        loginForm.reset();
    },

    showMainScreen: async function() {
        loginScreen.classList.remove('active');
        mainScreen.classList.add('active');
        
        // Configurar UI según el rol del usuario
        App.setupUserInterface();
        
        // Configurar event listeners de la pantalla principal
        App.setupMainScreenListeners();
        
        // Setup drag and drop functionality after DOM is ready
        setTimeout(() => App.setupDragAndDrop(), 100);
        
        // Cargar datos esenciales al iniciar la pantalla principal
        await App.loadCityRates(); // Cargar tarifas de ciudades
        
        App.showSection('dashboard'); // Mostrar el dashboard después de cargar los datos
    },

    // Utilidades generales
    formatDate: function(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('es-VE', { year: 'numeric', month: '2-digit', day: '2-digit' });
    },

    getStatusText: function(status) {
        const map = {
            pending: 'Pendiente',
            generated: 'Generada',
            invoiced: 'Facturada',
            paid: 'Pagada',
            partial: 'Pago Parcial',
            cancelled: 'Anulada',
            active: 'Activa',
            cancelled: 'Anulada'
        };
        return map[status] || status || 'Pendiente';
    },

    setupDragAndDrop: function() {
        // No-op básico para evitar errores si no hay elementos de DnD.
        // Podremos ampliar esta funcionalidad más adelante si es necesario.
        return;
    },

    // Cargar facturas y renderizar tabla
    loadInvoices: async function() {
        try {
            const invoices = await App.apiCall('/invoices');
            const tbody = document.querySelector('#invoicesTable tbody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (!Array.isArray(invoices) || invoices.length === 0) {
                const row = tbody.insertRow();
                row.innerHTML = '<td colspan="7" style="text-align:center; padding: 16px; color: #666;">No hay facturas</td>';
                return;
            }

            invoices.forEach(inv => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${inv.numero || inv.id}</td>
                    <td>${App.formatDate(inv.fecha)}</td>
                    <td>${inv.ciudad || '-'}</td>
                    <td>${inv.numGuides || (inv.guides ? inv.guides.length : 0)}</td>
                    <td>${(inv.total || 0).toFixed(2)}</td>
                    <td>${App.getStatusText(inv.status || 'pending')}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="App.viewInvoice('${inv.id}')" title="Ver"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-success btn-sm" onclick="App.printInvoice('${inv.id}')" title="Imprimir"><i class="fas fa-print"></i></button>
                        <button class="btn btn-warning btn-sm" onclick="App.cancelInvoice('${inv.id}')" title="Anular"><i class="fas fa-ban"></i></button>
                    </td>
                `;
            });
        } catch (error) {
            console.error('Error loading invoices:', error);
        }
    },

    cancelInvoice: async function(invoiceId) {
        if (!confirm('¿Seguro que deseas anular esta factura?')) return;
        try {
            App.showLoading(true);
            await App.apiCall(`/invoices/${invoiceId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'cancelled' })
            });
            Toast.success('Factura anulada');
            await App.loadInvoices();
            await App.loadActas();
            await App.loadAccountsReceivable();
        } catch (error) {
            console.error('Error cancelling invoice:', error);
            Toast.error('No se pudo anular: ' + error.message);
        } finally {
            App.showLoading(false);
        }
    },

    viewInvoice: async function(invoiceId) {
        try {
            const invoice = await App.apiCall(`/invoices/${invoiceId}`);
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'invoiceModal';
            const guides = invoice.guides || [];
            const rows = guides.map((g, i) => `
                <tr>
                    <td>${i+1}</td>
                    <td>${g.cliente||''}</td>
                    <td>${g.direccion||''}</td>
                    <td>${(parseFloat(g.piesCubicos)||0).toFixed(2)}</td>
                    <td>${(parseFloat(g.subtotal)||0).toFixed(2)}</td>
                </tr>
            `).join('');
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Factura ${invoice.numero || invoice.id}</h3>
                        <button class="modal-close">×</button>
                    </div>
                    <div class="modal-body">
                        <div><strong>Fecha:</strong> ${App.formatDate(invoice.fecha)} · <strong>Ciudad:</strong> ${invoice.ciudad||''} · <strong>Agente:</strong> ${invoice.agente||''}</div>
                        <table class="data-table" style="margin-top:10px;">
                            <thead>
                                <tr><th>#</th><th>Cliente</th><th>Dirección</th><th>Pies³</th><th>Subtotal</th></tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                        <div style="text-align:right; margin-top:10px;"><strong>Total: $${(invoice.total||0).toFixed(2)}</strong></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-success" onclick="App.printInvoice('${invoice.id}')"><i class="fas fa-print"></i> Imprimir</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('.modal-close').addEventListener('click', App.closeModals);
            modal.addEventListener('click', (e)=>{ if(e.target===modal) App.closeModals(); });
        } catch (error) {
            console.error('Error viendo factura:', error);
            Toast.error('No se pudo cargar la factura: ' + error.message);
        }
    },

    printInvoice: async function(invoiceId) {
        try {
            const invoice = await App.apiCall(`/invoices/${invoiceId}`);
            const guides = invoice.guides || [];
            const rows = guides.map((g, i) => `
                <tr>
                    <td>${i+1}</td>
                    <td>${g.cliente||''}</td>
                    <td>${g.direccion||''}</td>
                    <td>${(parseFloat(g.piesCubicos)||0).toFixed(2)}</td>
                    <td>${(parseFloat(g.subtotal)||0).toFixed(2)}</td>
                </tr>
            `).join('');
            const html = `
                <html>
                <head>
                    <title>Factura ${invoice.numero || invoice.id}</title>
                    <style>
                        body{font-family: Arial, sans-serif; padding:20px;}
                        h1,h2,h3{margin:0;}
                        .header{display:flex; justify-content:space-between; margin-bottom:16px;}
                        table{width:100%; border-collapse: collapse;}
                        th,td{border:1px solid #333; padding:6px; font-size:12px;}
                        .right{text-align:right}
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <h2>Factura ${invoice.numero || invoice.id}</h2>
                            <div>Fecha: ${App.formatDate(invoice.fecha)}</div>
                            <div>Ciudad: ${invoice.ciudad||''}</div>
                            <div>Agente: ${invoice.agente||''}</div>
                        </div>
                        <div class="right">
                            <h3>Total: $${(invoice.total||0).toFixed(2)}</h3>
                        </div>
                    </div>
                    <table>
                        <thead><tr><th>#</th><th>Cliente</th><th>Dirección</th><th>Pies³</th><th>Subtotal</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <div class="right" style="margin-top:10px;">Subtotal: $${(invoice.subtotal||invoice.total||0).toFixed(2)}</div>
                    <script>window.print();</script>
                </body>
                </html>
            `;
            const w = window.open('', '_blank');
            if (w) {
                w.document.open();
                w.document.write(html);
                w.document.close();
            } else {
                Toast.error('El navegador bloqueó la ventana de impresión. Habilita pop-ups.');
            }
        } catch (error) {
            console.error('Error imprimiendo factura:', error);
            Toast.error('No se pudo imprimir: ' + error.message);
        }
    },

    // Stub de pagos para evitar errores al navegar a la sección
    loadPayments: async function() {
        const tbody = document.querySelector('#paymentsTable tbody');
        if (!tbody) return;
        try {
            const [payments, invoices] = await Promise.all([
                App.apiCall('/payments'),
                App.apiCall('/invoices')
            ]);
            const invById = new Map((invoices || []).map(inv => [inv.id, inv]));
            tbody.innerHTML = '';
            if (!payments || payments.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 16px; color: #666;">No hay pagos registrados</td></tr>';
                return;
            }
            payments.forEach(p => {
                const inv = invById.get(p.invoiceId);
                const num = inv ? (inv.numero || inv.id) : p.invoiceId;
                const estado = inv ? App.getStatusText(inv.status || 'pending') : '-';
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${App.formatDate(p.fecha)}</td>
                    <td>${p.concepto || ''}</td>
                    <td>${p.referencia || ''}</td>
                    <td>${(p.monto || 0).toFixed(2)}</td>
                    <td>${num}</td>
                    <td>${p.metodoPago || ''}</td>
                    <td>${estado}</td>
                    <td><button class="btn btn-info btn-sm" title="Ver" disabled><i class="fas fa-eye"></i></button></td>
                `;
            });
        } catch (error) {
            console.error('Error loading payments:', error);
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 16px; color: #c00;">Error al cargar pagos</td></tr>';
        }
    },

    openPaymentModal: async function(invoiceId) {
        document.getElementById('paymentInvoiceId').value = invoiceId;
        try {
            const invoices = await App.apiCall('/invoices');
            const inv = invoices.find(i => i.id === invoiceId);
            const info = document.getElementById('paymentInvoiceInfo');
            if (inv && info) {
                const paid = inv.paid || 0;
                const balance = (inv.total || 0) - paid;
                info.innerHTML = `Factura: <strong>${inv.numero || inv.id}</strong> · Fecha: ${App.formatDate(inv.fecha)} · Total: $${(inv.total||0).toFixed(2)} · Pagado: $${paid.toFixed(2)} · Saldo: $${balance.toFixed(2)}`;
            }
        } catch (e) {}
        document.getElementById('paymentModal').classList.add('active');
    },

    handlePaymentSubmit: async function(e) {
        e.preventDefault();
        try {
            App.showLoading(true);
            const invoiceId = document.getElementById('paymentInvoiceId').value;
            const fecha = document.getElementById('paymentDate').value;
            const monto = parseFloat(document.getElementById('paymentAmount').value);
            const concepto = document.getElementById('paymentConcept').value;
            const referencia = document.getElementById('paymentReference').value;
            const metodoPago = document.getElementById('paymentMethod').value;
            const notas = document.getElementById('paymentNotes').value;

            await App.apiCall('/payments', {
                method: 'POST',
                body: JSON.stringify({ invoiceId, fecha, monto, concepto, referencia, metodoPago, notas })
            });

            Toast.success('Pago registrado');
            App.closeModals();
            await App.loadAccountsReceivable();
            await App.loadInvoices();
        } catch (error) {
            if (String(error.message).includes('403')) {
                Toast.error('Solo admin puede registrar pagos');
            } else {
                Toast.error('No se pudo registrar el pago: ' + error.message);
            }
        } finally {
            App.showLoading(false);
        }
    },

    // ======== Cuentas por Cobrar ========
    loadAccountsReceivable: async function() {
        try {
            const invoices = await App.apiCall('/invoices');
            const pending = (invoices || []).filter(inv => (inv.status || 'pending') !== 'paid');
            // cache para filtros por antigüedad
            App._arPendingCache = pending;

            // Resumen
            const total = pending.reduce((sum, inv) => sum + (inv.total || 0), 0);
            const summary = document.getElementById('arSummary');
            if (summary) {
                summary.innerHTML = `
                    <div class="stat-content">
                        <h3>${pending.length}</h3>
                        <p>Facturas pendientes</p>
                        <h4 style="margin-top:8px;">$${total.toFixed(2)}</h4>
                        <p>Monto pendiente</p>
                    </div>
                `;
            }

            // Render inicial de tabla
            App.renderAccountsTable(pending);

            // Aging (0-30,31-60,61-90,+90)
            const sums = { a030: 0, a3160: 0, a6190: 0, a90p: 0 };
            pending.forEach(inv => {
                const paid = inv.paid || 0;
                const balance = Math.max(0, (inv.total || 0) - paid);
                const days = App.daysSince(inv.fecha);
                if (days <= 30) sums.a030 += balance; else
                if (days <= 60) sums.a3160 += balance; else
                if (days <= 90) sums.a6190 += balance; else sums.a90p += balance;
            });
            const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = `$${val.toFixed(2)}`; };
            setText('aging030', sums.a030);
            setText('aging3160', sums.a3160);
            setText('aging6190', sums.a6190);
            setText('aging90plus', sums.a90p);

            // Activar clic en tarjetas de antigüedad para filtrar
            const setClick = (selector, range) => {
                const el = document.querySelector(selector);
                if (el) {
                    el.style.cursor = 'pointer';
                    el.onclick = () => App.filterAccountsByAging(range);
                }
            };
            setClick('.aging-current', '0-30');
            setClick('.aging-warning', '31-60');
            setClick('.aging-danger', '61-90');
            setClick('.aging-critical', '90+');
        } catch (error) {
            console.error('Error loading accounts receivable:', error);
        }
    },

    renderAccountsTable: function(list) {
        const tbody = document.querySelector('#accountsReceivableTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!list || list.length === 0) {
            const row = tbody.insertRow();
            row.innerHTML = '<td colspan="10" style="text-align:center; padding: 16px; color:#666;">No hay facturas pendientes</td>';
            return;
        }
        list.forEach(inv => {
            const paid = inv.paid || 0;
            const balance = (inv.total || 0) - paid;
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${inv.numero || inv.id}</td>
                <td>${App.formatDate(inv.fecha)}</td>
                <td>${inv.agente || inv.agent || ''}</td>
                <td>${inv.ciudad || ''}</td>
                <td>${(inv.total || 0).toFixed(2)}</td>
                <td>${paid.toFixed(2)}</td>
                <td>${balance.toFixed(2)}</td>
                <td>${App.daysSince(inv.fecha)}</td>
                <td>${App.getStatusText(inv.status || 'pending')}</td>
                <td><button class="btn btn-primary btn-sm" onclick="App.openPaymentModal('${inv.id}')">Registrar pago</button></td>
            `;
        });
    },

    filterAccountsByAging: function(range) {
        const list = Array.isArray(App._arPendingCache) ? App._arPendingCache : [];
        const filtered = list.filter(inv => {
            const days = App.daysSince(inv.fecha);
            if (range === '0-30') return days <= 30;
            if (range === '31-60') return days >= 31 && days <= 60;
            if (range === '61-90') return days >= 61 && days <= 90;
            if (range === '90+') return days >= 91;
            return true;
        });
        App.renderAccountsTable(filtered);
    },

    daysSince: function(dateStr) {
        const d = new Date(dateStr);
        if (isNaN(d)) return '-';
        const diff = Date.now() - d.getTime();
        return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    },

    applyAccountsFilters: function() {
        // Simplificado: recarga todo por ahora
        App.loadAccountsReceivable();
    },

    clearAccountsFilters: function() {
        document.getElementById('arStatusFilter').value = '';
        document.getElementById('arAgentFilter').value = '';
        document.getElementById('arDateFrom').value = '';
        document.getElementById('arDateTo').value = '';
        App.loadAccountsReceivable();
    },

    exportAccountsReceivable: async function() {
        try {
            const invoices = await App.apiCall('/invoices');
            const pending = (invoices || []).filter(inv => (inv.status || 'pending') !== 'paid');
            const headers = ['Factura','Fecha','Agente','Ciudad','Total','Pagado','Saldo','Días','Estado'];
            let csv = headers.join(',') + '\n';
            pending.forEach(inv => {
                const paid = inv.paid || 0;
                const balance = (inv.total || 0) - paid;
                const row = [
                    inv.numero || inv.id,
                    App.formatDate(inv.fecha),
                    inv.agente || inv.agent || '',
                    inv.ciudad || '',
                    (inv.total || 0).toFixed(2),
                    paid.toFixed(2),
                    balance.toFixed(2),
                    App.daysSince(inv.fecha),
                    App.getStatusText(inv.status || 'pending')
                ];
                csv += row.map(v => `"${v}"`).join(',') + '\n';
            });
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'cuentas_por_cobrar.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting AR:', error);
        }
    },

    // Nueva función para configurar la UI según el rol
    setupUserInterface: function() {
        console.log("Verificando rol de usuario para UI:", currentUser);
        const userRole = currentUser && currentUser.role ? currentUser.role : 'guest';
        const isAdmin = userRole === 'admin';
        const isCourier = userRole === 'courier';
        
        // Configurar clases CSS para styling
        document.body.classList.toggle('admin', isAdmin);
        document.body.classList.toggle('courier', isCourier);
        
        // Actualizar información del usuario
        document.getElementById('userInfo').textContent = 
            `${currentUser && currentUser.fullName ? currentUser.fullName : 'Usuario Desconocido'} (${isAdmin ? 'Administrador' : 'Agente/Cliente'})`;
        
        
        
        // Configurar visibilidad de elementos según rol
        App.configureElementVisibility(isAdmin);
        
        // Añadir mensajes informativos para usuarios no-admin
        App.addRoleBasedMessages(isAdmin);
        
        console.log(`🔐 UI configurada para rol: ${currentUser.role}`);
    },

    // Configurar visibilidad de elementos según permisos
    configureElementVisibility: function(isAdmin) {
        // Elementos solo para administradores
        const adminOnlyElements = document.querySelectorAll('.admin-only');
        adminOnlyElements.forEach(element => {
            element.style.display = isAdmin ? 'block' : 'none';
        });

        // Botones específicos del navbar
        const navButtons = {
            'settings': isAdmin, // Solo admin puede ver configuración
            'accountsReceivable': isAdmin, // Solo admin ve cuentas por cobrar
        };

        Object.entries(navButtons).forEach(([section, allowed]) => {
            const button = document.querySelector(`[data-section="${section}"]`);
            if (button) {
                button.style.display = allowed ? 'block' : 'none';
            }
        });

        // Ocultar funciones administrativas en las secciones
        const adminFunctions = [
            '#exportBackupBtn', // Respaldo
            '#importBackupBtn', // Restauración
            '.bulk-status-controls', // Control masivo de estados
            '#newActaBtn', // Botón para crear nueva acta
        ];

        adminFunctions.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = isAdmin ? 'block' : 'none';
            });
        });

        // Configurar tablas para mostrar solo datos del usuario
        if (!isAdmin) {
            App.addUserFilterMessages();
        }
    },

    // Añadir mensajes informativos para usuarios no-admin
    addRoleBasedMessages: function(isAdmin) {
        if (!isAdmin) {
            // Añadir mensaje en el dashboard
            const dashboardSection = document.getElementById('dashboardSection');
            if (dashboardSection && !dashboardSection.querySelector('.user-role-info')) {
                const infoMessage = document.createElement('div');
                infoMessage.className = 'user-role-info';
                infoMessage.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle"></i>
                        <span><strong>Vista de Agente:</strong> Solo puedes ver tus propias actas, facturas y guías.</span>
                    </div>
                `;
                dashboardSection.insertBefore(infoMessage, dashboardSection.querySelector('.dashboard-stats'));
            }
        }
    },

    // Añadir mensajes de filtrado por usuario
    addUserFilterMessages: function() {
        const sections = [
            { id: 'actasSection', message: 'Mostrando solo tus actas' },
            { id: 'invoicesSection', message: 'Mostrando solo tus facturas' },
            { id: 'paymentsSection', message: 'Mostrando solo tus pagos' }
        ];

        sections.forEach(({ id, message }) => {
            const section = document.getElementById(id);
            if (section && !section.querySelector('.filter-info')) {
                const filterInfo = document.createElement('div');
                filterInfo.className = 'filter-info';
                filterInfo.innerHTML = `
                    <div class="alert alert-primary">
                        <i class="fas fa-filter"></i>
                        <span>${message}</span>
                    </div>
                `;
                const header = section.querySelector('.section-header');
                if (header) {
                    header.insertAdjacentElement('afterend', filterInfo);
                }
            }
        });
    },

    // Función mejorada para verificar permisos
    hasPermission: function(action) {
        const permissions = {
            'admin': ['view_all', 'create', 'edit', 'delete', 'export', 'import', 'settings', 'accounts_receivable'],
            'courier': ['view_own', 'create', 'edit_own']
        };

        const userPermissions = permissions[currentUser.role] || [];
        return userPermissions.includes(action);
    },

    // Función para verificar si el usuario puede ver datos específicos
    canViewData: function(dataOwnerId) {
        if (currentUser.role === 'admin') {
            return true; // Admin puede ver todo
        }
        
        // Couriers solo pueden ver sus propios datos
        return dataOwnerId === currentUser.id;
    },

    showSection: function(sectionName) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionName);
        });
        
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.toggle('active', section.id === `${sectionName}Section`);
        });
        
        switch(sectionName) {
            case 'dashboard': 
                console.log('📊 Cargando Dashboard...');
                App.loadDashboard(); 
                break;
            case 'actas': 
                console.log('📋 Mostrando sección Actas - Cargando datos...');
                App.loadActas(); 
                break;
            case 'invoices': 
                console.log('🧾 Cargando Facturas...');
                App.loadInvoices(); 
                break;
            case 'payments': 
                console.log('💳 Cargando Pagos...');
                App.loadPayments(); 
                break;
            case 'accountsReceivable':
                console.log('💰 Cargando Cuentas por Cobrar...');
                App.loadAccountsReceivable();
                break;
            case 'settings': 
                console.log('⚙️ Cargando Configuración...');
                App.loadSettings(); 
                break;
        }
    },

    showError: function(message) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    },

    showLoading: function(show) {
        loadingOverlay.classList.toggle('active', show);
    },

    closeModals: function() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
        // Asegurar que el loading overlay se cierre cuando se cierren los modales
        App.showLoading(false);
    },

    // API Calls
    apiCall: async function(endpoint, options = {}) {
        const token = localStorage.getItem('token');
        const finalEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            headers,
            ...options
        };
        
        try {
            const response = await fetch(`${API_BASE}/${finalEndpoint}`, config);
            console.log('Raw API Response:', response); // Log the raw response
        
            if (!response.ok) {
                let errorMessage = `Error ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    console.warn('No se pudo parsear la respuesta de error:', e);
                }
                throw new Error(errorMessage);
            }
        
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json();
            } else {
                return response.text();
            }
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Error de conexión: No se pudo conectar al servidor');
            }
            throw error;
        }
    },

    // Dashboard
    loadDashboard: async function() {
        try {
            console.log('🔄 Cargando dashboard...');
            const stats = await App.apiCall('/dashboard');
            console.log('📊 Stats recibidas:', stats);
            
            // Actualizar estadísticas básicas
            document.getElementById('totalActas').textContent = stats.totalActas;
            document.getElementById('totalInvoices').textContent = stats.totalInvoices;
            const totalBilled = stats.totalBilled || 0;
            const totalCollected = stats.totalCollected || 0;
            const pendingBalance = stats.pendingBalance || 0;

            document.getElementById('totalBilled').textContent = `Bs. ${totalBilled.toFixed(2)}`;
            document.getElementById('totalCollected').textContent = `Bs. ${totalCollected.toFixed(2)}`;
            document.getElementById('pendingBalance').textContent = `Bs. ${pendingBalance.toFixed(2)}`;
            
            // Actualizar títulos según el rol
            App.updateDashboardTitles(stats.userRole);
            
            // Mostrar estadísticas adicionales para couriers
            if (stats.userRole === 'courier' && stats.totalGuides !== undefined) {
                App.addCourierDashboardStats(stats);
            }
            
            console.log('✅ Dashboard actualizado correctamente');
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    },

    // Actualizar títulos del dashboard según el rol
    updateDashboardTitles: function(userRole) {
        const titles = {
            'admin': {
                actas: 'Total Actas',
                invoices: 'Facturas',
                billed: 'Total Facturado',
                collected: 'Total Cobrado',
                pending: 'Saldo Pendiente'
            },
            'courier': {
                actas: 'Mis Actas',
                invoices: 'Mis Facturas', 
                billed: 'Mi Total Facturado',
                collected: 'Mi Total Cobrado',
                pending: 'Mi Saldo Pendiente'
            }
        };

        const currentTitles = titles[userRole] || titles['courier'];
        
        const stats = document.querySelectorAll('.stat-card p');
        if (stats.length >= 5) {
            stats[0].textContent = currentTitles.actas;
            stats[1].textContent = currentTitles.invoices;
            stats[2].textContent = currentTitles.billed;
            stats[3].textContent = currentTitles.collected;
            stats[4].textContent = currentTitles.pending;
        }
    },

    // Añadir estadísticas específicas para couriers
    addCourierDashboardStats: function(stats) {
        const dashboardStats = document.querySelector('.dashboard-stats');
        
        // Remover estadísticas anteriores de courier si existen
        const existingCourierStats = dashboardStats.querySelectorAll('.courier-stat-card');
        existingCourierStats.forEach(card => card.remove());
        
        // Añadir card de total de guías
        const guidesCard = document.createElement('div');
        guidesCard.className = 'stat-card courier-stat-card';
        guidesCard.innerHTML = `
            <div class="stat-icon">
                <i class="fas fa-shipping-fast"></i>
            </div>
            <div class="stat-content">
                <h3>${stats.totalGuides || 0}</h3>
                <p>Mis Guías</p>
            </div>
        `;
        dashboardStats.appendChild(guidesCard);
        
        // Añadir distribución de estados si existe
        if (stats.guidesByStatus && Object.keys(stats.guidesByStatus).length > 0) {
            const statusCard = document.createElement('div');
            statusCard.className = 'stat-card courier-stat-card status-breakdown';
            
            const statusList = Object.entries(stats.guidesByStatus)
                .map(([status, count]) => `<span class="status-item">${status}: ${count}</span>`)
                .join('');
            
            statusCard.innerHTML = `
                <div class="stat-icon">
                    <i class="fas fa-chart-pie"></i>
                </div>
                <div class="stat-content">
                    <h3>Estados</h3>
                    <div class="status-breakdown-list">${statusList}</div>
                </div>
            `;
            dashboardStats.appendChild(statusCard);
        }
    },

    // Settings Management (City Rates and Agents)
    loadSettings: async function() {
        await App.loadCityRates();
        await App.loadAgents();
    },

    // Agent Management
    loadAgents: async function() {
        try {
            const agents = await App.apiCall('/agents');
            App.updateAgentsUI(agents);
            App.updateAgentSelects(agents);
        } catch (error) {
            console.error('Error loading agents:', error);
        }
    },

    updateAgentsUI: function(agents) {
        const container = document.getElementById('agentsContainer');
        container.innerHTML = '';
        agents.forEach(agent => {
            const div = document.createElement('div');
            div.className = 'agent-item';
            div.innerHTML = `
                <span>${agent.name}</span>
                <button class="btn btn-danger btn-sm" onclick="App.deleteAgent('${agent.id}')"><i class="fas fa-trash"></i></button>
            `;
            container.appendChild(div);
        });
    },

    handleAddAgent: async function(e) {
        e.preventDefault();
        const nameInput = document.getElementById('newAgentName');
        const name = nameInput.value.trim();

        if (!name) {
            alert('Por favor, introduce un nombre para el agente.');
            return;
        }

        try {
            App.showLoading(true);
            await App.apiCall('/agents', {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            nameInput.value = '';
            Toast.success('Agente añadido exitosamente');
            
            // Recargar y actualizar inmediatamente toda la UI de agentes
            await App.loadAgents(); // Recarga la lista en configuración
            
            // También actualizar inmediatamente todos los selects de agentes en la aplicación
            try {
                const agents = await App.apiCall('/agents');
                App.updateAgentSelects(agents);
            } catch (error) {
                console.error('Error updating agent selects after add:', error);
            }
        } catch (error) {
            console.error('Error adding agent:', error);
            if (error.message.includes('403')) {
                Toast.error('No tienes permisos de administrador para añadir agentes.');
            } else {
                Toast.error('Error al añadir el agente: ' + error.message);
            }
        } finally {
            App.showLoading(false);
        }
    },

    deleteAgent: async function(agentId) {
        if (confirm('¿Estás seguro de que quieres eliminar este agente?')) {
            try {
                App.showLoading(true);
                await App.apiCall(`/agents/${agentId}`, {
                    method: 'DELETE'
                });
                Toast.success('Agente eliminado exitosamente');
                
                // Recargar y actualizar inmediatamente toda la UI de agentes
                await App.loadAgents(); // Recarga la lista en configuración
                
                // También actualizar inmediatamente todos los selects de agentes en la aplicación
                try {
                    const agents = await App.apiCall('/agents');
                    App.updateAgentSelects(agents);
                } catch (error) {
                    console.error('Error updating agent selects after delete:', error);
                }
            } catch (error) {
                console.error('Error deleting agent:', error);
                alert('Error al eliminar el agente.');
            }
 finally {
                App.showLoading(false);
            }
        }
    },

    updateAgentSelects: function(agents) {
        const selects = document.querySelectorAll('select[name="agente"]');
        const agentOptions = agents.map(agent => `<option value="${agent.name}">${agent.name}</option>`).join('');
        
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = `<option value="">Seleccionar agente</option>${agentOptions}`;
            select.value = currentValue;
        });
    },
        

    // City Rates
    loadCityRates: async function() {
        try {
            // La API ahora devuelve un array de objetos: [{id, city, rate}]
            const ratesArray = await App.apiCall('/city_rates');
            // Guardamos el array directamente. Ya no es un objeto.
            cityRates = ratesArray;
            App.updateCityRatesUI();
            App.updateCitySelects();
        } catch (error) {
            console.error('Error loading city rates:', error);
            Toast.error('No se pudieron cargar las tarifas de las ciudades.');
        }
    },

    updateCityRatesUI: function() {
        const container = document.getElementById('cityRatesContainer');
        container.innerHTML = '';
        
        cityRates.forEach(rateData => {
            const div = document.createElement('div');
            div.className = 'city-rate-item';
            div.innerHTML = `
                <span class="city-name">${rateData.city}</span>
                <div class="rate-input-group">
                    <input type="number" step="0.01" value="${rateData.rate}" id="rate-input-${rateData.id}">
                    <button class="btn btn-primary btn-sm" onclick="App.handleUpdateCityRate('${rateData.id}')">Guardar</button>
                </div>
                <button class="btn btn-danger btn-sm" onclick="App.deleteCity('${rateData.id}')"><i class="fas fa-trash"></i></button>
            `;
            container.appendChild(div);
        });
    },

    updateCitySelects: function() {
        const selects = document.querySelectorAll('select[name="ciudad"]');
        // Mapeamos el array para crear las opciones
        const cityOptions = cityRates.map(rateData => `<option value="${rateData.city}">${rateData.city}</option>`).join('');
        
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = `<option value="">Seleccionar ciudad</option>${cityOptions}`;
            select.value = currentValue;
        });
    },

    handleUpdateCityRate: async function(cityId) {
        const rateInput = document.getElementById(`rate-input-${cityId}`);
        const newRate = parseFloat(rateInput.value);

        if (isNaN(newRate)) {
            Toast.warning('Por favor, introduce una tarifa válida.');
            return;
        }

        try {
            App.showLoading(true);
            await App.apiCall(`/city_rates/${cityId}`, {
                method: 'PUT',
                body: JSON.stringify({ rate: newRate })
            });
            Toast.success('Tarifa actualizada exitosamente');
            await App.loadCityRates(); // Recargar para asegurar consistencia
        } catch (error) {
            console.error('Error updating city rate:', error);
            Toast.error('Error al actualizar la tarifa: ' + error.message);
        }
 finally {
            App.showLoading(false);
        }
    },

    // La función saveCityRates ya no es necesaria con este modelo
    // La eliminamos para evitar confusión.

    handleAddCity: async function(e) {
        e.preventDefault();
        console.log("Intentando agregar una nueva ciudad.");
        const nameInput = document.getElementById('newCityName');
        const rateInput = document.getElementById('newCityRate');
        const name = nameInput.value.trim();
        const rate = parseFloat(rateInput.value);

        console.log(`Datos de la nueva ciudad: Nombre='${name}', Tarifa='${rate}'`);

        if (!name || isNaN(rate)) {
            Toast.warning('Por favor, introduce un nombre y una tarifa válidos.');
            return;
        }

        const cityExists = cityRates.some(
            rateData => rateData.city.toLowerCase() === name.toLowerCase()
        );

        if (cityExists) {
            Toast.error(`La ciudad "${name}" ya existe.`);
            return;
        }

        try {
            App.showLoading(true);
            console.log("Enviando datos de la nueva ciudad a la API.");
            const response = await App.apiCall('/city_rates', {
                method: 'POST',
                body: JSON.stringify({ city: name, rate: rate })
            });
            console.log("Respuesta de la API al agregar ciudad:", response);
            nameInput.value = '';
            rateInput.value = '';
            Toast.success('Ciudad añadida exitosamente');
            await App.loadCityRates(); // Recargar la lista desde el servidor
        } catch (error) {
            console.error('Error adding city:', error);
            Toast.error('Error al añadir la ciudad: ' + error.message);
        }
 finally {
            App.showLoading(false);
        }
    },

    deleteCity: async function(cityId) {
        if (confirm('¿Estás seguro de que quieres eliminar esta ciudad?')) {
            try {
                App.showLoading(true);
                await App.apiCall(`/city_rates/${cityId}`, {
                    method: 'DELETE'
                });
                Toast.success('Ciudad eliminada exitosamente');
                await App.loadCityRates(); // Recargar la lista desde el servidor
            } catch (error) {
                console.error('Error deleting city:', error);
                Toast.error('Error al eliminar la ciudad: ' + error.message);
            }
 finally {
                App.showLoading(false);
            }
        }
    },

    // Actas Management - VERSIÓN SIMPLIFICADA
    loadActas: async function() {
        try {
            const allActas = await App.apiCall('/actas');
            
            // Aplicar filtros básicos
            const filterCiudad = document.getElementById('filterCiudad')?.value || '';
            const filterAgente = document.getElementById('filterAgente')?.value || '';

            let filteredActas = allActas;
            
            if (filterCiudad) {
                filteredActas = filteredActas.filter(acta => acta.ciudad === filterCiudad);
            }
            
            if (filterAgente) {
                filteredActas = filteredActas.filter(acta => acta.agente === filterAgente);
            }

            // Ordenar por fecha (más recientes primero)
            filteredActas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            // Actualizar tabla
            App.updateActasTable(filteredActas);
            
            // Mostrar contador
            const counter = document.getElementById('actasCounter');
            if (counter) {
                counter.textContent = `${filteredActas.length} de ${allActas.length} actas`;
            }
            
            // Poblar filtros
            App.populateFilterDropdowns(allActas);
            
        } catch (error) {
            console.error('Error loading actas:', error);
            const tbody = document.querySelector('#actasTable tbody');
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center text-red-500">
                                No tienes actas asignadas
                                <p class="text-sm text-gray-500">Contacta al administrador para más información.</p>
                            </td></tr>`;
            }
            
            // Actualizar contador
            const counter = document.getElementById('actasCounter');
            if (counter) {
                counter.textContent = 'Error al cargar';
                counter.style.color = '#f56565';
            }
        }
    },

    populateFilterDropdowns: function(actas) {
        const filterCiudadSelect = document.getElementById('filterCiudad');
        const filterAgenteSelect = document.getElementById('filterAgente');

        // Save current selections
        const currentCiudad = filterCiudadSelect.value;
        const currentAgente = filterAgenteSelect.value;

        // Clear existing options (except the default "Todas/Todos")
        filterCiudadSelect.innerHTML = '<option value="">Todas las ciudades</option>';
        filterAgenteSelect.innerHTML = '<option value="">Todos los agentes</option>';

        const uniqueCiudades = [...new Set(actas.map(acta => acta.ciudad).filter(Boolean))];
        uniqueCiudades.sort().forEach(ciudad => {
            const option = document.createElement('option');
            option.value = ciudad;
            option.textContent = ciudad;
            filterCiudadSelect.appendChild(option);
        });

        const uniqueAgentes = [...new Set(actas.map(acta => acta.agente).filter(Boolean))];
        uniqueAgentes.sort().forEach(agente => {
            const option = document.createElement('option');
            option.value = agente;
            option.textContent = agente;
            filterAgenteSelect.appendChild(option);
        });

        // Restore previous selections
        filterCiudadSelect.value = currentCiudad;
        filterAgenteSelect.value = currentAgente;
    },

    applyActasFilters: function() {
        App.loadActas(); // Reload actas with current filter selections
    },

    clearActasFilters: function() {
        document.getElementById('filterFechaDesde').value = '';
        document.getElementById('filterFechaHasta').value = '';
        document.getElementById('filterCiudad').value = '';
        document.getElementById('filterAgente').value = '';
        App.loadActas(); // Reload actas to show all
    },

    // Versión simplificada de la tabla de actas
    updateActasTableSimple: function(actas) {
        const tbody = document.querySelector('#actasTable tbody');
        if (!tbody) {
            console.error('No se encontró la tabla de actas');
            return;
        }
        
        tbody.innerHTML = '';

        if (actas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No hay actas registradas</td></tr>';
            return;
        }

        actas.forEach(acta => {
            const numGuias = acta.guides ? acta.guides.length : 0;
            const total = acta.guides ? acta.guides.reduce((sum, guide) => sum + (parseFloat(guide.subtotal) || 0), 0) : 0;
            
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${App.formatDate(acta.fecha)}</td>
                <td>${acta.ciudad || '-'}</td>
                <td>${acta.agente || '-'}</td>
                <td>${numGuias}</td>
                <td>$${total.toFixed(2)}</td>
                <td><span class="badge badge-success">Generada</span></td>
                <td><span class="badge badge-info">Activa</span></td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="App.viewActaDetails('${acta.id}')" title="Ver">👁️</button>
                    <button class="btn btn-secondary btn-sm" onclick="App.editActa('${acta.id}')" title="Editar">✏️</button>
                </td>
            `;
        });
    },

    exportActas: async function() {
        try {
            console.log('📊 Exportando actas...');
            App.showLoading(true);
            
            // Obtener actas filtradas (mismo filtro que la tabla)
            const allActas = await App.apiCall('/actas');
            const invoices = await App.apiCall('/invoices');
            
            // Aplicar filtros actuales
            const filterFechaDesde = document.getElementById('filterFechaDesde').value;
            const filterFechaHasta = document.getElementById('filterFechaHasta').value;
            const filterCiudad = document.getElementById('filterCiudad').value;
            const filterAgente = document.getElementById('filterAgente').value;

            let filteredActas = allActas;
            
            if (filterFechaDesde) {
                filteredActas = filteredActas.filter(acta => new Date(acta.fecha) >= new Date(filterFechaDesde));
            }
            if (filterFechaHasta) {
                filteredActas = filteredActas.filter(acta => new Date(acta.fecha) <= new Date(filterFechaHasta));
            }
            if (filterCiudad) {
                filteredActas = filteredActas.filter(acta => acta.ciudad === filterCiudad);
            }
            if (filterAgente) {
                filteredActas = filteredActas.filter(acta => acta.agente === filterAgente);
            }
            
            // Crear CSV
            const headers = ['Fecha', 'Ciudad', 'Agente', 'N° Guías', 'Total', 'N° Factura', 'Estado'];
            let csvContent = headers.join(',') + '\n';
            
            filteredActas.forEach(acta => {
                const invoice = invoices.find(inv => inv.actaId === acta.id);
                const numGuias = acta.guides ? acta.guides.length : 0;
                const total = acta.guides ? acta.guides.reduce((sum, guide) => sum + (parseFloat(guide.subtotal) || 0), 0) : 0;
                
                const row = [
                    App.formatDate(acta.fecha),
                    acta.ciudad || '',
                    acta.agente || '',
                    numGuias,
                    `$${total.toFixed(2)}`,
                    invoice ? `#${invoice.number || invoice.id}` : 'Pendiente',
                    App.getStatusText(acta.status || 'pending')
                ];
                
                csvContent += row.map(field => `"${field}"`).join(',') + '\n';
            });
            
            // Descargar archivo
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            
            const now = new Date();
            const timestamp = now.toISOString().split('T')[0];
            link.setAttribute('download', `actas-${timestamp}.csv`);
            
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`✅ Exportadas ${filteredActas.length} actas`);
            alert(`Se exportaron ${filteredActas.length} actas exitosamente`);
            
        } catch (error) {
            console.error('❌ Error exportando actas:', error);
            alert('Error al exportar actas');
        }
 finally {
        App.showLoading(false);
        }
    },

    updateActasTable: async function(actas) {
        console.log(`🏗️ Actualizando tabla con ${actas.length} actas`);
        
        const tbody = document.querySelector('#actasTable tbody');
        if (!tbody) {
            console.error('❌ No se encontró el tbody de la tabla de actas');
            return;
        }
        
        console.log('🧹 Limpiando tabla actual...');
        tbody.innerHTML = '';

        // Cargar facturas para mostrar información relacionada
        let invoices = [];
        try {
            console.log('💰 Cargando facturas para relacionar...');
            invoices = await App.apiCall('/invoices');
            console.log(`✅ Facturas cargadas: ${invoices.length}`);
        } catch (error) {
            console.warn('⚠️ No se pudieron cargar las facturas para mostrar en actas:', error);
        }

        if (actas.length === 0) {
            console.log('📝 No hay actas para mostrar');
            const row = tbody.insertRow();
            row.innerHTML = '<td colspan="8" style="text-align: center; padding: 20px; color: #666;">No hay actas registradas</td>';
            return;
        }

        console.log('🔄 Procesando cada acta...');
        actas.forEach((acta, index) => {
            console.log(`📄 Procesando acta ${index + 1}:`, acta);
            
            // Buscar la factura relacionada con esta acta
            const invoice = invoices.find(inv => inv.actaId === acta.id);
            
            // Calcular número de guías y total
            const numGuias = acta.guides ? acta.guides.length : 0;
            const total = acta.guides ? acta.guides.reduce((sum, guide) => sum + (parseFloat(guide.subtotal) || 0), 0) : 0;
            
            console.log(`📊 Acta ${acta.id}: ${numGuias} guías, total $${total.toFixed(2)}, factura: ${invoice ? 'Sí' : 'No'}`);
            
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${App.formatDate(acta.fecha)}</td>
                <td>${acta.ciudad || '-'}</td>
                <td>${acta.agente || '-'}</td>
                <td><span class="badge badge-info">${numGuias}</span></td>
                <td><strong>${total.toFixed(2)}</strong></td>
                <td>${invoice ? `<span class="badge badge-success">#${invoice.number || invoice.id}</span>` : '<span class="badge badge-warning">Pendiente</span>'}</td>
                <td><span class="status-badge status-${acta.status || (invoice ? 'invoiced' : 'pending')}">${App.getStatusText(acta.status || (invoice ? 'invoiced' : 'pending'))}</span></td>
                <td class="actions">
                    <button class="btn btn-info btn-sm" onclick="App.viewActaDetails('${acta.id}')" title="Ver Detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${currentUser.role === 'admin' ? `
                    <button class="btn btn-secondary btn-sm" onclick="App.editActa('${acta.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${!invoice ? `<button class="btn btn-success btn-sm" onclick="App.generateInvoice('${acta.id}')" title="Generar Factura"><i class="fas fa-receipt"></i></button>` : ''}
                    <button class="btn btn-danger btn-sm" onclick="App.deleteActa('${acta.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                    ` : ''}
                </td>
            `;
        });
        
        console.log(`✅ Tabla actualizada con ${actas.length} filas`);
    },

    showNewActaModal: async function() {        
        const modal = document.getElementById('actaModal');
        if (!modal) {
            alert('Error: No se encontró el modal');
            return;
        }

        // Limpiar modal
        currentActa = null;
        document.getElementById('actaModalTitle').textContent = 'Nueva Acta de Despacho';
        document.getElementById('actaForm').reset();
        
        // Limpiar tabla de guías
        const guidesTableBody = document.querySelector('#guidesTable tbody');
        if (guidesTableBody) {
            guidesTableBody.innerHTML = '';
        }
        
        // Asegurar que las tarifas de ciudad estén cargadas
        if (Object.keys(cityRates).length === 0) {
            console.log('🔄 Cargando tarifas de ciudad...');
            await App.loadCityRates();
        }
        
        console.log(`💰 Tarifas disponibles:`, cityRates);
        
        // Actualizar selectores
        App.updateCitySelects();
        try {
            const agents = await App.apiCall('/agents');
            App.updateAgentSelects(agents);
        } catch (error) {
            console.warn('Error cargando agentes:', error);
        }
        
        App.updateTotal();
        modal.classList.add('active');
    },

    viewActaDetails: async function(actaId) {
        try {
            const allActas = await App.apiCall('/actas');
            const acta = allActas.find(a => a.id === actaId);
            
            if (!acta) {
                alert('No se encontró el acta');
                return;
            }
            
            // Inicializar estados de guías si no existen
            if (acta.guides) {
                acta.guides.forEach(guide => {
                    if (!guide.status) {
                        guide.status = 'almacen';
                    }
                });
            }
            
            App.showActaDetailsModal(acta);
            
        } catch (error) {
            console.error('Error loading acta details:', error);
            alert('Error al cargar los detalles del acta: ' + error.message);
        }
    },

    showActaDetailsModal: function(acta) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'actaDetailsModal';
        
        const header = `
            <div class="modal-header">
                <h3>Acta ${acta.id} - ${App.formatDate(acta.fecha)} (${acta.ciudad})</h3>
                <button class="modal-close">×</button>
            </div>
        `;

        const tableHeader = `
            <thead>
                <tr>
                    <th>No</th>
                    <th>WAREHOUSE</th>
                    <th>FILE</th>
                    <th>ORIGEN</th>
                    <th>VIA</th>
                    <th>CLIENTE</th>
                    <th>EMBARCADOR</th>
                    <th>CANT. TEORICA</th>
                    <th>CANT. DESPACH.</th>
                    <th>PIES CUBICOS</th>
                    <th>PESO</th>
                    <th>DESTINO</th>
                    <th>DIRECCION</th>
                    <th>ESTADO</th>
                    <th>Acciones</th>
                    <th>Subtotal</th>
                </tr>
            </thead>
        `;

        const guidesHTML = (acta.guides || []).map((g, i) => {
            return `
                <tr>
                    <td>${g.no || i + 1}</td>
                    <td>${g.warehouse || ''}</td>
                    <td>${g.file || ''}</td>
                    <td>${g.origen || ''}</td>
                    <td>${g.via || ''}</td>
                    <td>${g.cliente || ''}</td>
                    <td>${g.embarcador || ''}</td>
                    <td>${g.cantTeorica || 0}</td>
                    <td>${g.cantDespachada || 0}</td>
                    <td>${(parseFloat(g.piesCubicos) || 0).toFixed(2)}</td>
                    <td>${(parseFloat(g.peso) || 0).toFixed(2)}</td>
                    <td>${g.destino || ''}</td>
                    <td>${g.direccion || ''}</td>
                    <td><span class="status-badge">${g.status || 'almacen'}</span></td>
                    <td>
                        <select onchange="App.updateGuideStatus('${acta.id}','${g.no || i + 1}', this.value)">
                            <option value="almacen" ${String(g.status||'almacen')==='almacen'?'selected':''}>En almacén</option>
                            <option value="despacho" ${String(g.status)==='despacho'?'selected':''}>Despacho</option>
                            <option value="entregado" ${String(g.status)==='entregado'?'selected':''}>Entregado</option>
                        </select>
                    </td>
                    <td>${(parseFloat(g.subtotal) || 0).toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        const body = `
            <div class="modal-body">
                <table class="guides-table">
                    ${tableHeader}
                    <tbody>${guidesHTML}</tbody>
                </table>
            </div>
        `;

        modal.innerHTML = `<div class="modal-content">${header}${body}</div>`;
        document.body.appendChild(modal);

        // Cerrar modal
        modal.querySelector('.modal-close').addEventListener('click', App.closeModals);
        modal.addEventListener('click', (e) => { if (e.target === modal) App.closeModals(); });
    },

    updateGuideStatus: async function(actaId, guideNo, status) {
        try {
            await App.apiCall(`/actas/${actaId}/guides/${guideNo}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            Toast.success('Estado de guía actualizado');
        } catch (error) {
            console.error('Error actualizando estado de guía:', error);
            Toast.error('No se pudo actualizar: ' + error.message);
        }
    },

    // Añadir una fila de guía al formulario
    addGuideRow: function() {
        const tbody = document.querySelector('#guidesTable tbody');
        if (!tbody) return;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="text" name="no" style="width:80px"></td>
            <td><input type="text" name="warehouse" style="width:120px"></td>
            <td><input type="text" name="file" style="width:120px"></td>
            <td><input type="text" name="origen" style="width:120px"></td>
            <td>
                <select name="via">
                    <option value="terrestre">Terrestre</option>
                    <option value="aereo">Aéreo</option>
                    <option value="maritimo">Marítimo</option>
                </select>
            </td>
            <td><input type="text" name="cliente" style="width:160px"></td>
            <td><input type="text" name="embarcador" style="width:160px"></td>
            <td><input type="number" name="cantTeorica" min="0" step="1" style="width:100px"></td>
            <td><input type="number" name="cantDespachada" min="0" step="1" style="width:120px"></td>
            <td><input type="number" name="piesCubicos" min="0" step="0.01" style="width:120px"></td>
            <td><input type="number" name="peso" min="0" step="0.01" style="width:100px"></td>
            <td><input type="text" name="destino" style="width:140px"></td>
            <td><input type="text" name="direccion" style="width:180px"></td>
            <td><button type="button" class="btn btn-danger btn-sm">Eliminar</button></td>
        `;

        // Eventos para recalcular total o eliminar fila
        row.querySelectorAll('input[name="piesCubicos"], select[name="via"]').forEach(el => {
            el.addEventListener('input', App.updateTotal);
            el.addEventListener('change', App.updateTotal);
        });
        row.querySelector('button').addEventListener('click', function() {
            row.remove();
            App.updateTotal();
        });

        tbody.appendChild(row);
        App.updateTotal();
    },

    // Recalcular total general del acta
    updateTotal: function() {
        const ciudadSelect = document.getElementById('ciudad');
        const ciudad = ciudadSelect ? ciudadSelect.value : '';

        // Buscar tarifa de la ciudad seleccionada
        const rateItem = Array.isArray(cityRates) ? cityRates.find(c => c.city === ciudad) : null;
        const rate = rateItem ? parseFloat(rateItem.rate) : 0;

        let total = 0;
        document.querySelectorAll('#guidesTable tbody tr').forEach(tr => {
            const pies = parseFloat(tr.querySelector('input[name="piesCubicos"]').value || '0');
            if (!isNaN(pies) && !isNaN(rate)) {
                total += pies * rate;
            }
        });
        const totalEl = document.getElementById('totalGeneral');
        if (totalEl) totalEl.textContent = total.toFixed(2);
    },

    // Enviar el formulario de Acta
    handleActaSubmit: async function(e) {
        e.preventDefault();
        try {
            App.showLoading(true);

            const fecha = document.getElementById('fecha')?.value;
            const ciudad = document.getElementById('ciudad')?.value;
            const agente = document.getElementById('agente')?.value;
            if (!fecha || !ciudad || !agente) {
                Toast.error('Completa Fecha, Ciudad y Agente.');
                return;
            }

            // Datos de vehículo (opcionales)
            const modeloCamion = document.getElementById('modeloCamion')?.value || '';
            const anioCamion = document.getElementById('anioCamion')?.value || '';
            const placaCamion = document.getElementById('placaCamion')?.value || '';
            const nombreChofer = document.getElementById('nombreChofer')?.value || '';
            const telefonoChofer = document.getElementById('telefonoChofer')?.value || '';
            const nombreAyudante = document.getElementById('nombreAyudante')?.value || '';
            const telefonoAyudante = document.getElementById('telefonoAyudante')?.value || '';

            // Construir guías desde la tabla
            const guides = [];
            document.querySelectorAll('#guidesTable tbody tr').forEach((tr, idx) => {
                const get = name => tr.querySelector(`[name="${name}"]`)?.value || '';
                const guide = {
                    no: get('no') || (idx + 1),
                    warehouse: get('warehouse'),
                    file: get('file'),
                    origen: get('origen'),
                    via: get('via') || 'terrestre',
                    cliente: get('cliente'),
                    embarcador: get('embarcador'),
                    cantTeorica: parseFloat(get('cantTeorica') || '0') || 0,
                    cantDespachada: parseFloat(get('cantDespachada') || '0') || 0,
                    piesCubicos: parseFloat(get('piesCubicos') || '0') || 0,
                    peso: parseFloat(get('peso') || '0') || 0,
                    destino: get('destino'),
                    direccion: get('direccion'),
                };
                // Calcular subtotal con tarifa si existe
                const rateItem = Array.isArray(cityRates) ? cityRates.find(c => c.city === ciudad) : null;
                const rate = rateItem ? parseFloat(rateItem.rate) : 0;
                guide.subtotal = (guide.piesCubicos || 0) * (isNaN(rate) ? 0 : rate);
                guides.push(guide);
            });

            const actaData = {
                fecha,
                ciudad,
                agente,
                vehiculo: {
                    modeloCamion,
                    anioCamion,
                    placaCamion,
                    nombreChofer,
                    telefonoChofer,
                    nombreAyudante,
                    telefonoAyudante,
                },
                guides,
                status: 'pending'
            };

            const created = await App.apiCall('/actas', {
                method: 'POST',
                body: JSON.stringify(actaData)
            });

            Toast.success('Acta creada exitosamente');
            // Generar factura automáticamente si es admin
            try {
                if (currentUser && currentUser.role === 'admin' && created && created.id) {
                    await App.generateInvoice(created.id);
                }
            } catch (e) {
                console.warn('No se generó factura automáticamente:', e);
            }
            App.closeModals();
            await App.loadActas();
        } catch (error) {
            console.error('Error al crear acta:', error);
            Toast.error('No se pudo crear el acta: ' + error.message);
        } finally {
            App.showLoading(false);
        }
    },

    // Generar factura para un acta
    generateInvoice: async function(actaId) {
        try {
            App.showLoading(true);
            const invoice = await App.apiCall('/invoices', {
                method: 'POST',
                body: JSON.stringify({ actaId })
            });
            Toast.success(`Factura generada: ${invoice.numero || invoice.id}`);
            await App.loadActas();
        } catch (error) {
            if (String(error.message).includes('403')) {
                Toast.error('No tienes permisos de administrador para generar facturas');
            } else {
                Toast.error('No se pudo generar la factura: ' + error.message);
            }
            throw error;
        } finally {
            App.showLoading(false);
        }
    },

    // ======== Importación de Guías (modal de acta) ========
    showGuidesImport: function() {
        const section = document.getElementById('guidesImportSection');
        if (section) section.style.display = 'block';
    },

    hideGuidesImport: function() {
        const section = document.getElementById('guidesImportSection');
        if (section) section.style.display = 'none';
        const input = document.getElementById('guidesFileInput');
        if (input) input.value = '';
        const info = document.getElementById('guidesFileInfo');
        if (info) info.style.display = 'none';
        const btn = document.getElementById('processGuidesBtn');
        if (btn) btn.disabled = true;
    },

    handleGuidesFileSelection: function(e) {
        const file = e.target.files[0];
        const info = document.getElementById('guidesFileInfo');
        const nameEl = document.getElementById('guidesFileName');
        const sizeEl = document.getElementById('guidesFileSize');
        const btn = document.getElementById('processGuidesBtn');
        if (file) {
            if (nameEl) nameEl.textContent = file.name;
            if (sizeEl) sizeEl.textContent = ` (${(file.size/1024).toFixed(1)} KB)`;
            if (info) info.style.display = 'inline-flex';
            if (btn) btn.disabled = false;
        } else {
            if (info) info.style.display = 'none';
            if (btn) btn.disabled = true;
        }
    },

    processGuidesFile: async function() {
        try {
            const input = document.getElementById('guidesFileInput');
            if (!input || !input.files || input.files.length === 0) {
                Toast.warning('Selecciona un archivo Excel/CSV primero');
                return;
            }
            const file = input.files[0];
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (!rows.length) {
                Toast.warning('La hoja está vacía');
                return;
            }

            // Normalizar encabezados (remover acentos y puntos)
            const normalizeKey = (s) => String(s)
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // quitar acentos
                .replace(/[\.]/g, '') // quitar puntos
                .trim()
                .toLowerCase();

            // Mapas de columnas esperadas (según tu plantilla)
            const colMap = {
                no: ['no'],
                warehouse: ['warehouse', 'almacen', 'almacen'],
                file: ['file', 'expediente'],
                origen: ['origen'],
                via: ['via', 'via'],
                cliente: ['cliente'],
                embarcador: ['embarcador', 'shipper'],
                cantTeorica: ['cant teorica', 'cantidad teorica'],
                cantDespachada: ['cant despach', 'cant despachada', 'cantidad despachada'],
                piesCubicos: ['pies cubicos', 'pies'],
                peso: ['peso', 'kgs'],
                destino: ['destino'],
                direccion: ['direccion']
            };

            const tbody = document.querySelector('#guidesTable tbody');
            if (!tbody) {
                Toast.error('No se encontró la tabla de guías');
                return;
            }

            let imported = 0;
            rows.forEach((row, idx) => {
                const getByAliases = (aliases) => {
                    for (const alias of aliases) {
                        const matchKey = Object.keys(row).find(k => normalizeKey(k) === normalizeKey(alias));
                        if (matchKey) return row[matchKey];
                    }
                    return '';
                };

                const guide = {
                    no: getByAliases(colMap.no) || (idx + 1),
                    warehouse: getByAliases(colMap.warehouse),
                    file: getByAliases(colMap.file),
                    origen: getByAliases(colMap.origen),
                    via: (getByAliases(colMap.via) || 'terrestre').toString().toLowerCase(),
                    cliente: getByAliases(colMap.cliente),
                    embarcador: getByAliases(colMap.embarcador),
                    cantTeorica: getByAliases(colMap.cantTeorica),
                    cantDespachada: getByAliases(colMap.cantDespachada),
                    piesCubicos: getByAliases(colMap.piesCubicos),
                    peso: getByAliases(colMap.peso),
                    destino: getByAliases(colMap.destino),
                    direccion: getByAliases(colMap.direccion),
                };

                // Crear fila usando el mismo formato que addGuideRow
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><input type="text" name="no" value="${guide.no}" style="width:80px"></td>
                    <td><input type="text" name="warehouse" value="${guide.warehouse}" style="width:120px"></td>
                    <td><input type="text" name="file" value="${guide.file}" style="width:120px"></td>
                    <td><input type="text" name="origen" value="${guide.origen}" style="width:120px"></td>
                    <td>
                        <select name="via">
                            <option value="terrestre" ${guide.via.includes('terr') ? 'selected' : ''}>Terrestre</option>
                            <option value="aereo" ${guide.via.includes('aer') ? 'selected' : ''}>Aéreo</option>
                            <option value="maritimo" ${guide.via.includes('mar') ? 'selected' : ''}>Marítimo</option>
                        </select>
                    </td>
                    <td><input type="text" name="cliente" value="${guide.cliente}" style="width:160px"></td>
                    <td><input type="text" name="embarcador" value="${guide.embarcador}" style="width:160px"></td>
                    <td><input type="number" name="cantTeorica" value="${guide.cantTeorica}" min="0" step="1" style="width:100px"></td>
                    <td><input type="number" name="cantDespachada" value="${guide.cantDespachada}" min="0" step="1" style="width:120px"></td>
                    <td><input type="number" name="piesCubicos" value="${guide.piesCubicos}" min="0" step="0.01" style="width:120px"></td>
                    <td><input type="number" name="peso" value="${guide.peso}" min="0" step="0.01" style="width:100px"></td>
                    <td><input type="text" name="destino" value="${guide.destino}" style="width:140px"></td>
                    <td><input type="text" name="direccion" value="${guide.direccion}" style="width:180px"></td>
                    <td><button type="button" class="btn btn-danger btn-sm">Eliminar</button></td>
                `;
                tr.querySelectorAll('input[name="piesCubicos"], select[name="via"]').forEach(el => {
                    el.addEventListener('input', App.updateTotal);
                    el.addEventListener('change', App.updateTotal);
                });
                tr.querySelector('button').addEventListener('click', function() {
                    tr.remove();
                    App.updateTotal();
                });
                tbody.appendChild(tr);
                imported++;
            });

            App.updateTotal();
            Toast.success(`Se importaron ${imported} guías`);
            App.hideGuidesImport();
        } catch (error) {
            console.error('Error importando guías:', error);
            Toast.error('No se pudo importar el archivo: ' + error.message);
        }
    },

    generateExcelTemplate: function() {
        const data = [
            {
                'No Guia': 'VLC001',
                'Cliente': 'Empresa A',
                'Direccion': 'Av. Principal #123',
                'Bultos': 3,
                'Pies': 12.5,
                'Kgs': 50,
                'Via': 'Terrestre'
            }
        ];
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Guias');
        XLSX.writeFile(wb, 'plantilla_guias.xlsx');
    },

    downloadCSVTemplate: function() {
        const headers = ['No Guia', 'Cliente', 'Direccion', 'Bultos', 'Pies', 'Kgs', 'Via'];
        const sample = ['VLC001', 'Empresa A', 'Av. Principal #123', '3', '12.5', '50', 'Terrestre'];
        const csv = headers.join(',') + '\n' + sample.map(v => `"${v}"`).join(',') + '\n';
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_guias.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // ======== Importación Excel general (sección superior) ========
    handleFileSelection: function(e) {
        const file = e.target.files[0];
        const info = document.getElementById('selectedFileInfo');
        const nameEl = document.getElementById('fileName');
        const sizeEl = document.getElementById('fileSize');
        const btn = document.getElementById('processExcelBtn');
        if (file) {
            if (nameEl) nameEl.textContent = file.name;
            if (sizeEl) sizeEl.textContent = `${(file.size/1024).toFixed(1)} KB`;
            if (info) info.style.display = 'block';
            if (btn) btn.disabled = false;
        } else {
            if (info) info.style.display = 'none';
            if (btn) btn.disabled = true;
        }
    },

    processExcelFile: async function() {
        try {
            const input = document.getElementById('excelFileInput');
            if (!input || !input.files || input.files.length === 0) {
                Toast.warning('Selecciona un archivo Excel');
                return;
            }
            const file = input.files[0];
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data, { type: 'array' });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            Toast.info(`Archivo leído: ${rows.length} filas`);
        } catch (error) {
            console.error('Error leyendo Excel:', error);
            Toast.error('No se pudo leer el Excel: ' + error.message);
        }
    },

    // ======== Respaldo (Export/Import) ========
    exportBackup: async function() {
        try {
            App.showLoading(true);
            // recolectar datos de todas las entidades disponibles
            const [actas, invoices, payments, agents, cityRates] = await Promise.all([
                App.apiCall('/actas').catch(()=>[]),
                App.apiCall('/invoices').catch(()=>[]),
                App.apiCall('/payments').catch(()=>[]),
                App.apiCall('/agents').catch(()=>[]),
                App.apiCall('/city_rates').catch(()=>[]),
            ]);
            const backup = {
                exportedAt: new Date().toISOString(),
                app: 'AppDistCarga',
                version: 1,
                actas, invoices, payments, agents, cityRates,
            };
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            Toast.success('Respaldo exportado correctamente');
        } catch (error) {
            console.error('Error exportando respaldo:', error);
            Toast.error('No se pudo exportar el respaldo: ' + error.message);
        } finally {
            App.showLoading(false);
        }
    },

    handleBackupFileSelection: function(e) {
        const file = e.target.files[0];
        const info = document.querySelector('#selectedFileInfo small #fileName') || document.getElementById('fileName');
        const importBtn = document.getElementById('importBackupBtn');
        if (file) {
            if (info) info.textContent = file.name;
            if (importBtn) importBtn.disabled = false;
        } else {
            if (info) info.textContent = '';
            if (importBtn) importBtn.disabled = true;
        }
    },

    importBackup: async function() {
        try {
            const input = document.getElementById('importBackupFile');
            if (!input || !input.files || input.files.length === 0) {
                Toast.warning('Selecciona un archivo de respaldo (.json)');
                return;
            }
            const file = input.files[0];
            const text = await file.text();
            const data = JSON.parse(text);
            // Sólo restauramos catálogos simples (agents y city_rates) por seguridad
            if (Array.isArray(data.agents)) {
                for (const ag of data.agents) {
                    if (ag && ag.name) {
                        try {
                            await App.apiCall('/agents', { method: 'POST', body: JSON.stringify({ name: ag.name }) });
                        } catch {}
                    }
                }
            }
            if (Array.isArray(data.cityRates)) {
                // crear si no existen
                for (const cr of data.cityRates) {
                    if (cr && cr.city && cr.rate !== undefined) {
                        try {
                            await App.apiCall('/city_rates', { method: 'POST', body: JSON.stringify({ city: cr.city, rate: cr.rate }) });
                        } catch {}
                    }
                }
            }
            Toast.success('Respaldo importado (catálogos)');
            await App.loadSettings();
        } catch (error) {
            console.error('Error importando respaldo:', error);
            Toast.error('No se pudo importar el respaldo: ' + error.message);
        }
    },

};

document.addEventListener('DOMContentLoaded', App.initializeApp);