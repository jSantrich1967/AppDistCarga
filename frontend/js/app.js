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
            const ratesArray = await App.apiCall('/api/city_rates');
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
            await App.apiCall(`/api/city_rates/${cityId}`, {
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
            const response = await App.apiCall('/api/city_rates', {
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
                await App.apiCall(`/api/city_rates/${cityId}`, {
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
                <td><span class="status-badge status-${acta.status || 'pending'}">${App.getStatusText(acta.status || 'pending')}</span></td>
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
        // Crear modal de detalles
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'actaDetailsModal';
        
        // Generar filas de guías con controles de estado (usando nuevos campos profesionales)
        let guidesHTML = '';
        if (acta.guides && acta.guides.length > 0) {
            console.log('📦 Mostrando guías del acta:', acta.guides);
            guidesHTML = acta.guides.map((guide, index) => {
                const status = guide.status || 'En Almacén';
                
                // Mapear campos antiguos a nuevos si es necesario
                const displayGuide = {
                    no: guide.no || guide.noGuia || (index + 1),
                    warehouse: guide.warehouse || guide.almacen || '-',
                    file: guide.file || guide.expediente || '-',
                    cliente: guide.cliente || guide.nombreCliente || '-',
                    direccion: guide.direccion || '-',
                    cantDespachada: guide.cantDespachada || guide.bultos || guide.cantidad || 0,
                    piesCubicos: guide.piesCubicos || guide.pies || 0,
                    peso: guide.peso || guide.kgs || 0,
                    via: guide.via || 'terrestre',
                    subtotal: guide.subtotal || 0
                };
                
                console.log(`📋 Guía ${index + 1}:`, displayGuide);
                
                return "<tr><td>SIMPLIFIED TEST</td></tr>";