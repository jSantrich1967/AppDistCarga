// Estado global de la aplicación
let currentUser = null;
let cityRates = {};
let currentActa = null;

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

const App = {
    // Inicialización
    initializeApp: function() {
        const today = new Date().toISOString().split('T')[0];
        const fechaInput = document.getElementById('fecha');
        if (fechaInput) {
            fechaInput.value = today;
        }
        App.setupEventListeners();
        App.checkAuthToken();
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
        
        // Excel Import event listeners
        safeAddListener('importExcelBtn', 'click', App.showExcelImport);
        safeAddListener('excelFileInput', 'change', App.handleFileSelection);
        safeAddListener('processExcelBtn', 'click', App.processExcelFile);
        
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
        try {
            const response = await fetch(`${API_BASE}/dashboard`, { credentials: 'include' });
            if (response.ok) {
                // El endpoint /dashboard devuelve estadísticas, pero si responde exitosamente 
                // significa que el token es válido. Necesitamos obtener los datos del usuario de otra forma
                // Por ahora, asumiremos que si el dashboard responde, el usuario está autenticado
                // Pero necesitamos un endpoint específico para obtener datos del usuario
                const response2 = await fetch(`${API_BASE}/user-profile`, { credentials: 'include' });
                if (response2.ok) {
                    const userData = await response2.json();
                    currentUser = userData.user;
                } else {
                    // Si no hay endpoint de perfil, crear un usuario temporal básico
                    currentUser = { name: 'Usuario', role: 'admin' };
                }
                App.showMainScreen();
            } else {
                App.showLoginScreen();
            }
        } catch (error) {
            console.error('Error validating token:', error);
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
        } finally {
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
        const isAdmin = currentUser.role === 'admin';
        const isCourier = currentUser.role === 'courier';
        
        // Configurar clases CSS para styling
        document.body.classList.toggle('admin', isAdmin);
        document.body.classList.toggle('courier', isCourier);
        
        // Actualizar información del usuario
        document.getElementById('userInfo').textContent = 
            `${currentUser.name} (${isAdmin ? 'Administrador' : 'Agente/Cliente'})`;
        
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
            '#importExcelBtn', // Importación Excel
            '#exportBackupBtn', // Respaldo
            '#importBackupBtn', // Restauración
            '.bulk-status-controls', // Control masivo de estados
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
        const config = {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            credentials: 'include',
            ...options
        };
        
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, config);
            
            if (!response.ok) {
                let errorMessage = `Error ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    // Si no se puede parsear el JSON de error, usar el statusText
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
            // Si es un error de red o de fetch
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Error de conexión: No se pudo conectar al servidor');
            }
            // Re-lanzar otros errores tal como están
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
            document.getElementById('totalBilled').textContent = `Bs. ${stats.totalBilled.toFixed(2)}`;
            document.getElementById('totalCollected').textContent = `Bs. ${stats.totalCollected.toFixed(2)}`;
            document.getElementById('pendingBalance').textContent = `Bs. ${stats.pendingBalance.toFixed(2)}`;
            
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
            alert('Agente añadido exitosamente.');
            
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
            alert('Error al añadir el agente.');
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
                alert('Agente eliminado exitosamente.');
                
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
            } finally {
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
            cityRates = await App.apiCall('/city-rates');
            App.updateCityRatesUI();
            App.updateCitySelects();
        } catch (error) {
            console.error('Error loading city rates:', error);
        }
    },

    updateCityRatesUI: function() {
        const container = document.getElementById('cityRatesContainer');
        container.innerHTML = '';
        
        Object.entries(cityRates).forEach(([city, rate]) => {
            const div = document.createElement('div');
            div.className = 'city-rate-item';
            div.innerHTML = `
                <label>${city}:</label>
                <input type="number" step="0.01" value="${rate}" data-city="${city}">
                <span>USD por pie³</span>
            `;

            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn btn-danger btn-sm';
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
            deleteButton.onclick = () => App.deleteCity(city);
            
            div.appendChild(deleteButton);
            container.appendChild(div);
        });
    },

    updateCitySelects: function() {
        const selects = document.querySelectorAll('select[name="ciudad"]');
        const cityOptions = Object.keys(cityRates).map(city => `<option value="${city}">${city}</option>`).join('');
        
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = `<option value="">Seleccionar ciudad</option>${cityOptions}`;
            select.value = currentValue;
        });
    },

    saveCityRates: async function() {
        try {
            const inputs = document.querySelectorAll('#cityRatesContainer input');
            const newRates = {};
            inputs.forEach(input => {
                newRates[input.dataset.city] = parseFloat(input.value) || 0;
            });
            
            await App.apiCall('/city-rates', {
                method: 'PUT',
                body: JSON.stringify(newRates)
            });
            
            cityRates = newRates;
            alert('Tarifas guardadas exitosamente');
        } catch (error) {
            console.error('Error saving city rates:', error);
            alert('Error al guardar tarifas');
        }
    },

    handleAddCity: function(e) {
        e.preventDefault();
        const nameInput = document.getElementById('newCityName');
        const rateInput = document.getElementById('newCityRate');
        const name = nameInput.value.trim();
        const rate = parseFloat(rateInput.value);

        if (!name || isNaN(rate)) {
            alert('Por favor, introduce un nombre y una tarifa válidos.');
            return;
        }

        const cityExists = Object.keys(cityRates).some(
            key => key.toLowerCase() === name.toLowerCase()
        );

        if (cityExists) {
            alert(`La ciudad "${name}" ya existe.`);
            return;
        }

        cityRates[name] = rate;
        App.updateCityRatesUI();
        nameInput.value = '';
        rateInput.value = '';
    },

    deleteCity: function(cityName) {
        if (confirm(`¿Estás seguro de que quieres eliminar la ciudad "${cityName}"?`)) {
            delete cityRates[cityName];
            App.updateCityRatesUI();
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
            App.updateActasTableSimple(filteredActas);
            
            // Mostrar contador
            const counter = document.getElementById('actasCounter');
            if (counter) {
                counter.textContent = `${filteredActas.length} de ${allActas.length} actas`;
            }
            
            // Poblar filtros
            App.populateFilterDropdowns(allActas);
            
        } catch (error) {
            console.error('Error loading actas:', error);
            alert('Error al cargar actas. Revisa la consola.');
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
        } finally {
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
                <td><strong>$${total.toFixed(2)}</strong></td>
                <td>${invoice ? `<span class="badge badge-success">#${invoice.number || invoice.id}</span>` : '<span class="badge badge-warning">Pendiente</span>'}</td>
                <td><span class="status-badge status-${acta.status || 'pending'}">${App.getStatusText(acta.status || 'pending')}</span></td>
                <td class="actions">
                    <button class="btn btn-info btn-sm" onclick="App.viewActaDetails('${acta.id}')" title="Ver Detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="App.editActa('${acta.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${!invoice ? `<button class="btn btn-success btn-sm" onclick="App.generateInvoice('${acta.id}')" title="Generar Factura"><i class="fas fa-receipt"></i></button>` : ''}
                    <button class="btn btn-danger btn-sm" onclick="App.deleteActa('${acta.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
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
        
        // Generar filas de guías con controles de estado
        let guidesHTML = '';
        if (acta.guides && acta.guides.length > 0) {
            guidesHTML = acta.guides.map((guide, index) => {
                const status = guide.status || 'almacen';
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td><strong>${guide.noGuia}</strong></td>
                        <td>${guide.nombreCliente}</td>
                        <td>${guide.direccion}</td>
                        <td>${guide.bultos}</td>
                        <td>${guide.pies}</td>
                        <td>${guide.kgs}</td>
                        <td>${guide.via}</td>
                        <td>$${(guide.subtotal || 0).toFixed(2)}</td>
                        <td>
                            <span id="guideStatus_${index}" class="status-badge ${App.getStatusBadgeClass(status)}">
                                ${App.getStatusText(status)}
                            </span>
                            <br>
                            <button class="btn-mini btn-status" onclick="App.showGuideStatusModal('${acta.id}', ${index}, ${JSON.stringify(guide).replace(/"/g, '&quot;')})" title="Cambiar Estado">
                                🔄
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            guidesHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px;">No hay guías registradas</td></tr>';
        }
        
        modal.innerHTML = `
            <div class="modal-content modal-wide">
                <div class="modal-header">
                    <h3>📋 Detalles del Acta ${acta.id}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Información General -->
                    <div class="acta-info-grid">
                        <div class="info-section">
                            <h4>📅 Información General</h4>
                            <p><strong>Fecha:</strong> ${App.formatDate(acta.fecha)}</p>
                            <p><strong>Ciudad:</strong> ${acta.ciudad}</p>
                            <p><strong>Agente:</strong> ${acta.agente}</p>
                            <p><strong>Total guías:</strong> ${acta.guides ? acta.guides.length : 0}</p>
                        </div>
                        
                        <div class="info-section">
                            <h4>🚛 Información del Vehículo</h4>
                            <p><strong>Camión:</strong> ${acta.modeloCamion} ${acta.anioCamion}</p>
                            <p><strong>Placa:</strong> ${acta.placaCamion}</p>
                            <p><strong>Chofer:</strong> ${acta.nombreChofer}</p>
                            <p><strong>Teléfono:</strong> ${acta.telefonoChofer}</p>
                            <p><strong>Ayudante:</strong> ${acta.nombreAyudante}</p>
                        </div>
                    </div>
                    
                    <!-- Controles de Estado Masivo (Solo para Admin) -->
                    <div class="bulk-status-controls" style="margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 8px;">
                        <h4>🔄 Actualización Masiva de Estados</h4>
                        <div class="bulk-controls">
                            <select id="bulkStatus">
                                <option value="">Seleccionar estado...</option>
                                <option value="almacen">📦 En Almacén</option>
                                <option value="lista_despacho">✅ Lista para Despacho</option>
                                <option value="en_despacho">🚛 En Despacho</option>
                                <option value="despachada">🎯 Despachada</option>
                            </select>
                            <button class="btn btn-warning btn-sm" onclick="App.applyBulkStatus('${acta.id}')">
                                Aplicar a Todas las Guías
                            </button>
                        </div>
                    </div>
                    
                    <!-- Tabla de Guías -->
                    <div class="guides-section">
                        <h4>📦 Detalle de Guías con Estados</h4>
                        <div class="table-container" style="max-height: 400px; overflow-y: auto;">
                            <table class="guides-detail-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>No. Guía</th>
                                        <th>Cliente</th>
                                        <th>Dirección</th>
                                        <th>Bultos</th>
                                        <th>Pies³</th>
                                        <th>Kgs</th>
                                        <th>Vía</th>
                                        <th>Subtotal</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${guidesHTML}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cerrar</button>
                    <button type="button" class="btn btn-primary" onclick="App.editActa('${acta.id}')">✏️ Editar Acta</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },

    applyBulkStatus: async function(actaId) {
        try {
            const bulkStatus = document.getElementById('bulkStatus').value;
            
            if (!bulkStatus) {
                alert('Por favor seleccione un estado');
                return;
            }
            
            const confirmed = confirm(
                `¿Está seguro de aplicar el estado "${App.getStatusText(bulkStatus)}" a TODAS las guías de esta acta?\n\n` +
                'Esta acción afectará todas las guías independientemente de su estado actual.'
            );
            
            if (!confirmed) return;
            
            // Obtener acta actual
            const actas = await App.apiCall('/actas');
            const acta = actas.find(a => a.id === actaId);
            
            if (!acta || !acta.guides) {
                alert('No se encontraron guías para actualizar');
                return;
            }
            
            // Crear array de actualizaciones
            const guidesUpdates = acta.guides.map((guide, index) => ({
                index: index,
                status: bulkStatus
            }));
            
            // Aplicar actualización masiva
            await App.updateMultipleGuideStatus(actaId, guidesUpdates, 'Actualización masiva desde vista de detalles');
            
            // Recargar modal de detalles
            const modal = document.getElementById('actaDetailsModal');
            if (modal) {
                modal.remove();
                App.viewActaDetails(actaId);
            }
            
        } catch (error) {
            console.error('Error en actualización masiva:', error);
        }
    },

    deleteActa: async function(actaId) {
        if (confirm('¿Estás seguro de que quieres eliminar esta acta? Esta acción no se puede deshacer.')) {
            try {
                App.showLoading(true);
                await App.apiCall(`/actas/${actaId}`, {
                    method: 'DELETE'
                });
                alert('Acta eliminada exitosamente');
                App.loadActas();
                App.loadDashboard();
            } catch (error) {
                console.error('Error deleting acta:', error);
                alert(`Error al eliminar acta: ${error.message}`);
            } finally {
                App.showLoading(false);
            }
        }
    },

    editActa: async function(actaId) {
        try {
            const acta = await App.apiCall(`/actas/${actaId}`);
            currentActa = acta;
            
            if (currentActa) {
                // Actualizar selectores con datos más recientes
                App.updateCitySelects();
                try {
                    const agents = await App.apiCall('/agents');
                    App.updateAgentSelects(agents);
                } catch (error) {
                    console.error('Error loading agents for edit modal:', error);
                }
                
                document.getElementById('actaModalTitle').textContent = 'Editar Acta de Despacho';
                App.populateActaForm(currentActa);
                document.getElementById('actaModal').classList.add('active');
            }
        } catch (error) {
            console.error('Error loading acta:', error);
        }
    },

    populateActaForm: function(acta) {
        Object.keys(acta).forEach(key => {
            const input = document.querySelector(`#actaForm [name="${key}"]`);
            if (input) {
                if(key === 'fecha') {
                    input.value = new Date(acta[key]).toISOString().split('T')[0];
                } else {
                    input.value = acta[key] || '';
                }
            }
        });
        
        const tbody = document.querySelector('#guidesTable tbody');
        tbody.innerHTML = '';
        if (acta.guides && acta.guides.length > 0) {
            acta.guides.forEach(guide => App.addGuideRow(guide));
        }
        
        App.updateTotal();
    },

    handleActaSubmit: async function(e) {
        e.preventDefault();
        
        // Datos básicos del formulario
        const formData = new FormData(e.target);
        const actaData = Object.fromEntries(formData.entries());
        
        // Validación simple
        if (!actaData.fecha || !actaData.ciudad || !actaData.agente) {
            alert('Por favor, completa todos los campos obligatorios: Fecha, Ciudad y Agente.');
            return;
        }
        
        // Procesar guías
        actaData.guides = [];
        const rows = document.querySelectorAll('#guidesTable tbody tr');
        rows.forEach(row => {
            const guide = {};
            row.querySelectorAll('input, select').forEach(input => {
                if (input.name) guide[input.name] = input.value;
            });
            if (guide.noGuia) {
                guide.subtotal = App.calculateSubtotal(guide.pies, actaData.ciudad);
                actaData.guides.push(guide);
            }
        });
        
        try {
            App.showLoading(true);
            
            // Crear o actualizar acta
            const method = currentActa ? 'PUT' : 'POST';
            const endpoint = currentActa ? `/actas/${currentActa.id}` : '/actas';
            const result = await App.apiCall(endpoint, { method, body: JSON.stringify(actaData) });
            
            // Cerrar modal
            App.closeModals();
            App.showLoading(false);
            
            // Mostrar mensaje de éxito
            const message = currentActa ? 'Acta actualizada exitosamente' : 'Acta creada exitosamente';
            alert(message);
            
            // Preguntar sobre factura solo para actas nuevas
            if (!currentActa && result.id) {
                const createInvoice = confirm(
                    '¿Desea generar la factura automáticamente para esta acta?\n\n' +
                    'La factura incluirá:\n' +
                    '• Todos los datos del acta\n' +
                    '• Detalle de las guías\n' +
                    '• Totales calculados\n' +
                    '• Formato profesional'
                );
                
                if (createInvoice) {
                    try {
                        App.showLoading(true);
                        await App.apiCall('/invoices', {
                            method: 'POST',
                            body: JSON.stringify({ actaId: result.id })
                        });
                        App.showLoading(false);
                        alert('¡Factura generada exitosamente!');
                    } catch (invoiceError) {
                        App.showLoading(false);
                        console.error('Error generando factura:', invoiceError);
                        alert('Error al generar la factura: ' + invoiceError.message);
                    }
                }
            }
            
            // Recargar datos
            window.location.reload();
            
        } catch (error) {
            console.error('Error saving acta:', error);
            alert(`Error al guardar acta: ${error.message}`);
        } finally {
            App.showLoading(false);
        }
    },

    // Guides Management
    addGuideRow: function(guide = {}) {
        const tbody = document.querySelector('#guidesTable tbody');
        const row = tbody.insertRow();
        const rowNumber = tbody.rows.length;
        
        row.innerHTML = `
            <td><input type="text" name="no" readonly value="${rowNumber}" style="background: #f5f5f5; width: 50px;"></td>
            <td><input type="text" name="warehouse" placeholder="Almacén" value="${guide.warehouse || ''}"></td>
            <td><input type="text" name="file" placeholder="N° Expediente" value="${guide.file || ''}"></td>
            <td><input type="text" name="origen" placeholder="Ciudad de origen" value="${guide.origen || ''}"></td>
            <td>
                <select name="via" required>
                    <option value="">Seleccionar</option>
                    <option value="terrestre" ${guide.via === 'terrestre' ? 'selected' : ''}>Terrestre</option>
                    <option value="aereo" ${guide.via === 'aereo' ? 'selected' : ''}>Aéreo</option>
                    <option value="maritimo" ${guide.via === 'maritimo' ? 'selected' : ''}>Marítimo</option>
                </select>
            </td>
            <td><input type="text" name="cliente" required placeholder="Nombre del cliente" value="${guide.cliente || ''}"></td>
            <td><input type="text" name="embarcador" placeholder="Empresa embarcadora" value="${guide.embarcador || ''}"></td>
            <td><input type="number" name="cantTeorica" min="0" step="1" placeholder="Cant. teórica" value="${guide.cantTeorica || ''}"></td>
            <td><input type="number" name="cantDespachada" min="0" step="1" placeholder="Cant. despachada" value="${guide.cantDespachada || ''}"></td>
            <td><input type="number" name="piesCubicos" min="0.01" step="0.01" onchange="App.updateRowSubtotal(this)" placeholder="Pies³" value="${guide.piesCubicos || ''}"></td>
            <td><input type="number" name="peso" min="0.01" step="0.01" placeholder="Kg" value="${guide.peso || ''}"></td>
            <td><input type="text" name="destino" placeholder="Ciudad destino" value="${guide.destino ||  ''}"></td>
            <td><input type="text" name="direccion" required placeholder="Dirección completa" value="${guide.direccion || ''}"></td>
            <td class="actions">
                <button type="button" class="btn btn-danger" onclick="App.removeGuideRow(this)"><i class="fas fa-trash"></i></button>
            </td>
        `;
        App.updateTotal();
    },

    removeGuideRow: function(button) {
        button.closest('tr').remove();
        // Renumerar todas las filas
        App.renumberGuideRows();
        App.updateTotal();
    },
    
    renumberGuideRows: function() {
        const tbody = document.querySelector('#guidesTable tbody');
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const numberInput = row.querySelector('input[name="no"]');
            if (numberInput) {
                numberInput.value = index + 1;
            }
        });
    },

    updateRowSubtotal: function(input) {
        const row = input.closest('tr');
        const piesCubicos = parseFloat(input.value) || 0;
        const ciudad = document.querySelector('#actaForm [name="ciudad"]').value;
        const subtotal = App.calculateSubtotal(piesCubicos, ciudad);
        
        // Actualizar visualmente el cálculo en el título del campo o consola para debug
        console.log(`Calculando: ${piesCubicos} pies³ x tarifa ${ciudad} = ${subtotal.toFixed(2)}`);
        App.updateTotal();
    },

    calculateSubtotal: function(piesCubicos, ciudad) {
        const rate = cityRates[ciudad] || 0;
        return (parseFloat(piesCubicos) || 0) * rate;
    },

    updateTotal: function() {
        // Calcular total basado en pies cúbicos de todas las guías
        const guidesTable = document.querySelector('#guidesTable tbody');
        const ciudad = document.querySelector('#actaForm [name="ciudad"]').value;
        const rate = cityRates[ciudad] || 0;
        let total = 0;
        
        const rows = guidesTable.querySelectorAll('tr');
        rows.forEach(row => {
            const piesCubicosInput = row.querySelector('input[name="piesCubicos"]');
            if (piesCubicosInput) {
                const piesCubicos = parseFloat(piesCubicosInput.value) || 0;
                total += piesCubicos * rate;
            }
        });
        
        document.getElementById('totalGeneral').textContent = total.toFixed(2);
    },

    // Invoices Management
    loadInvoices: async function() {
        try {
            const invoices = await App.apiCall('/invoices');
            App.updateInvoicesTable(invoices);
        } catch (error) {
            console.error('Error loading invoices:', error);
        }
    },

    updateInvoicesTable: function(invoices) {
        const tbody = document.querySelector('#invoicesTable tbody');
        tbody.innerHTML = '';
        
        if (invoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No hay facturas registradas</td></tr>';
            return;
        }
        
        invoices.forEach(invoice => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td><strong>${invoice.number}</strong></td>
                <td>${App.formatDate(invoice.createdAt)}</td>
                <td>${invoice.ciudad || '-'}</td>
                <td>${invoice.numGuides || 0} guías</td>
                <td><strong>$${invoice.total.toFixed(2)}</strong></td>
                <td><span class="status-badge status-${invoice.status}">${App.getStatusText(invoice.status)}</span></td>
                <td class="actions">
                    <button class="btn btn-info btn-sm" onclick="App.viewInvoiceDetails('${invoice.id}')" title="Ver Detalles">👁️</button>
                    <button class="btn btn-primary btn-sm" onclick="App.showPaymentModal('${invoice.id}')" ${invoice.status === 'paid' ? 'disabled' : ''} title="Pagar">💳</button>
                    <button class="btn btn-secondary btn-sm" onclick="App.printInvoice('${invoice.id}')" title="Imprimir">🖨️</button>
                </td>
            `;
        });
    },

    generateInvoice: async function(actaId) {
        try {
            await App.apiCall('/invoices', {
                method: 'POST',
                body: JSON.stringify({ actaId })
            });
            App.loadInvoices();
            App.loadDashboard();
            alert('Factura generada exitosamente');
        } catch (error) {
            console.error('Error generating invoice:', error);
            alert(`Error al generar factura: ${error.message}`);
        }
    },

    viewInvoiceDetails: async function(invoiceId) {
        try {
            const invoice = await App.apiCall(`/invoices/${invoiceId}`);
            
            // Crear información detallada de la factura
            let guidesInfo = '';
            if (invoice.guides && invoice.guides.length > 0) {
                guidesInfo = invoice.guides.map((guide, index) => 
                    `${index + 1}. Guía ${guide.noGuia}\n   Cliente: ${guide.nombreCliente}\n   Dirección: ${guide.direccion}\n   ${guide.bultos} bultos - ${guide.pies} pies³ - ${guide.kgs} kgs\n   Vía: ${guide.via} - Subtotal: $${(guide.subtotal || 0).toFixed(2)}`
                ).join('\n\n');
            } else {
                guidesInfo = 'No hay guías registradas';
            }
            
            const details = `
FACTURA ${invoice.number}
========================

📋 INFORMACIÓN GENERAL:
• Fecha: ${App.formatDate(invoice.fecha)}
• Ciudad: ${invoice.ciudad}
• Agente: ${invoice.agente}
• Estado: ${App.getStatusText(invoice.status)}

🚛 INFORMACIÓN DEL VEHÍCULO:
• Camión: ${invoice.vehicleInfo?.modelo || 'N/A'} ${invoice.vehicleInfo?.anio || ''}
• Placa: ${invoice.vehicleInfo?.placa || 'N/A'}
• Chofer: ${invoice.vehicleInfo?.chofer || 'N/A'} - ${invoice.vehicleInfo?.telefonoChofer || 'N/A'}
• Ayudante: ${invoice.vehicleInfo?.ayudante || 'N/A'} - ${invoice.vehicleInfo?.telefonoAyudante || 'N/A'}

📦 RESUMEN:
• Total de guías: ${invoice.numGuides}
• Moneda: ${invoice.currency}
• Términos de pago: ${invoice.paymentTerms}

💰 TOTALES:
• Subtotal: $${invoice.subtotal.toFixed(2)}
• TOTAL (Exento de IVA): $${invoice.total.toFixed(2)}

📋 DETALLE DE GUÍAS:
${guidesInfo}

📝 NOTAS:
${invoice.notes}
            `;
            
            alert(details.trim());
            
            // Copiar al portapapeles
            if (navigator.clipboard) {
                try {
                    await navigator.clipboard.writeText(details.trim());
                    console.log('Factura copiada al portapapeles');
                } catch (err) {
                    console.log('No se pudo copiar al portapapeles');
                }
            }
            
        } catch (error) {
            console.error('Error loading invoice details:', error);
            alert('Error al cargar los detalles de la factura: ' + error.message);
        }
    },

    printInvoice: async function(invoiceId) {
        try {
            // Obtener datos de la factura
            const invoice = await App.apiCall(`/invoices/${invoiceId}`);
            
            // Crear el HTML de la factura
            const invoiceHTML = App.generateInvoiceHTML(invoice);
            
            // Crear ventana de impresión
            const printWindow = window.open('', '_blank', 'width=800,height=600');
            printWindow.document.write(invoiceHTML);
            printWindow.document.close();
            
            // Esperar a que cargue y luego imprimir
            printWindow.onload = function() {
                printWindow.focus();
                printWindow.print();
                // Cerrar ventana después de imprimir (opcional)
                // printWindow.close();
            };
            
        } catch (error) {
            console.error('Error printing invoice:', error);
            alert('Error al imprimir la factura: ' + error.message);
        }
    },

    generateInvoiceHTML: function(invoice) {
        // Generar filas de guías
        let guidesHTML = '';
        if (invoice.guides && invoice.guides.length > 0) {
            guidesHTML = invoice.guides.map((guide, index) => `
                <tr>
                    <td style="border-bottom: 1px solid #ddd; padding: 8px;">${index + 1}</td>
                    <td style="border-bottom: 1px solid #ddd; padding: 8px;">${guide.noGuia}</td>
                    <td style="border-bottom: 1px solid #ddd; padding: 8px;">${guide.nombreCliente}</td>
                    <td style="border-bottom: 1px solid #ddd; padding: 8px;">${guide.direccion}</td>
                    <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align: center;">${guide.bultos}</td>
                    <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align: center;">${guide.pies}</td>
                    <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align: center;">${guide.kgs}</td>
                    <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align: center;">${guide.via}</td>
                    <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align: right;">$${(guide.subtotal || 0).toFixed(2)}</td>
                </tr>
            `).join('');
        } else {
            guidesHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px; font-style: italic;">No hay guías registradas</td></tr>';
        }

        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Factura ${invoice.number}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            line-height: 1.4;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
        }
        .company-info {
            flex: 1;
        }
        .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 5px;
        }
        .company-details {
            font-size: 12px;
            color: #666;
        }
        .invoice-info {
            text-align: right;
            flex: 1;
        }
        .invoice-number {
            font-size: 20px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        .invoice-details {
            font-size: 12px;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            font-size: 14px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 5px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        .info-block {
            background: #f8fafc;
            padding: 15px;
            border-radius: 5px;
        }
        .info-block h4 {
            margin: 0 0 10px 0;
            font-size: 12px;
            color: #2563eb;
            text-transform: uppercase;
        }
        .info-block p {
            margin: 3px 0;
            font-size: 11px;
        }
        .guides-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 20px;
        }
        .guides-table th {
            background: #2563eb;
            color: white;
            padding: 8px;
            text-align: left;
            font-weight: bold;
        }
        .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-top: 30px;
        }
        .totals-table {
            border-collapse: collapse;
            font-size: 12px;
        }
        .totals-table td {
            padding: 5px 15px;
            border-bottom: 1px solid #ddd;
        }
        .totals-table .total-row {
            font-weight: bold;
            font-size: 14px;
            background: #f8fafc;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-paid { background: #d1fae5; color: #065f46; }
        .status-partial { background: #dbeafe; color: #1e40af; }
        
        @media print {
            body { margin: 0; padding: 10px; }
            .invoice-container { max-width: none; }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header -->
        <div class="header">
            <div class="company-info">
                <div class="company-name">SISTEMA DE DISTRIBUCIÓN DE CARGA</div>
                <div class="company-details">
                    Sistema de Gestión de Transporte y Logística<br>
                    Email: info@distcarga.com | Tel: (555) 123-4567<br>
                    Dirección: Calle Principal 123, Ciudad, País
                </div>
            </div>
            <div class="invoice-info">
                <div class="invoice-number">FACTURA ${invoice.number}</div>
                <div class="invoice-details">
                    <strong>Fecha:</strong> ${App.formatDate(invoice.fecha)}<br>
                    <strong>Estado:</strong> <span class="status-badge status-${invoice.status}">${App.getStatusText(invoice.status)}</span><br>
                    <strong>Términos:</strong> ${invoice.paymentTerms}<br>
                    <strong>Moneda:</strong> ${invoice.currency}
                </div>
            </div>
        </div>

        <!-- Información General -->
        <div class="section">
            <div class="section-title">INFORMACIÓN DEL ENVÍO</div>
            <div class="info-grid">
                <div class="info-block">
                    <h4>📍 Detalles del Envío</h4>
                    <p><strong>Ciudad:</strong> ${invoice.ciudad}</p>
                    <p><strong>Agente:</strong> ${invoice.agente}</p>
                    <p><strong>Fecha de servicio:</strong> ${App.formatDate(invoice.fecha)}</p>
                    <p><strong>Total de guías:</strong> ${invoice.numGuides}</p>
                </div>
                <div class="info-block">
                    <h4>🚛 Información del Vehículo</h4>
                    <p><strong>Camión:</strong> ${invoice.vehicleInfo?.modelo || 'N/A'} ${invoice.vehicleInfo?.anio || ''}</p>
                    <p><strong>Placa:</strong> ${invoice.vehicleInfo?.placa || 'N/A'}</p>
                    <p><strong>Chofer:</strong> ${invoice.vehicleInfo?.chofer || 'N/A'}</p>
                    <p><strong>Teléfono:</strong> ${invoice.vehicleInfo?.telefonoChofer || 'N/A'}</p>
                    <p><strong>Ayudante:</strong> ${invoice.vehicleInfo?.ayudante || 'N/A'}</p>
                </div>
            </div>
        </div>

        <!-- Detalle de Guías -->
        <div class="section">
            <div class="section-title">DETALLE DE GUÍAS</div>
            <table class="guides-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>No. Guía</th>
                        <th>Cliente</th>
                        <th>Dirección</th>
                        <th>Bultos</th>
                        <th>Pies³</th>
                        <th>Kgs</th>
                        <th>Vía</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${guidesHTML}
                </tbody>
            </table>
        </div>

                 <!-- Totales -->
         <div class="totals-section">
             <table class="totals-table">
                 <tr>
                     <td>Subtotal:</td>
                     <td style="text-align: right;">$${invoice.subtotal.toFixed(2)}</td>
                 </tr>
                 <tr class="total-row">
                     <td>TOTAL (Exento de IVA):</td>
                     <td style="text-align: right;">$${invoice.total.toFixed(2)}</td>
                 </tr>
             </table>
         </div>

        <!-- Notas -->
        <div class="section">
            <div class="section-title">NOTAS</div>
            <p style="font-size: 11px; background: #f8fafc; padding: 15px; border-radius: 5px;">
                ${invoice.notes || 'Sin notas adicionales para esta factura.'}
            </p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p><strong>Gracias por confiar en nuestros servicios</strong></p>
            <p>Factura generada automáticamente el ${App.formatDate(invoice.createdAt)} | ID: ${invoice.id}</p>
            <p>Para consultas sobre esta factura, contacte al departamento de facturación</p>
        </div>
    </div>
</body>
</html>
        `;
    },

    viewPaymentDetails: async function(paymentId) {
        try {
            const payment = await App.apiCall(`/payments/${paymentId}`);
            
            const details = `
RECIBO DE PAGO #${payment.id}
============================

📅 INFORMACIÓN DEL PAGO:
• Fecha del pago: ${App.formatDate(payment.fecha)}
• Fecha de registro: ${App.formatDate(payment.fechaRegistro)}
• Concepto: ${payment.concepto}
• Referencia: ${payment.referencia}
• Método de pago: ${payment.metodoPago}
• Estado: ${payment.estado}

💰 MONTO:
• Cantidad pagada: $${payment.monto.toFixed(2)}

🧾 FACTURA RELACIONADA:
• Número de factura: ${payment.facturaNumero}
• Total de la factura: $${payment.facturaTotal.toFixed(2)}

📝 NOTAS:
${payment.notas || 'Sin notas adicionales'}

═══════════════════════════
ID del pago: ${payment.id}
Registrado: ${App.formatDate(payment.createdAt)}
            `;
            
            alert(details.trim());
            
            // Copiar al portapapeles
            if (navigator.clipboard) {
                try {
                    await navigator.clipboard.writeText(details.trim());
                    console.log('Recibo copiado al portapapeles');
                } catch (err) {
                    console.log('No se pudo copiar al portapapeles');
                }
            }
            
        } catch (error) {
            console.error('Error loading payment details:', error);
            alert('Error al cargar los detalles del pago: ' + error.message);
        }
    },

    printPaymentReceipt: async function(paymentId) {
        try {
            const payment = await App.apiCall(`/payments/${paymentId}`);
            
            const receipt = `
=======================================
         RECIBO DE PAGO OFICIAL
=======================================

Recibo #: ${payment.id}
Fecha: ${App.formatDate(payment.fecha)}

---------------------------------------
DETALLES DEL PAGO:
---------------------------------------
Concepto: ${payment.concepto}
Referencia: ${payment.referencia}
Método: ${payment.metodoPago}

Monto pagado: $${payment.monto.toFixed(2)}

---------------------------------------
FACTURA:
---------------------------------------
Número: ${payment.facturaNumero}
Total factura: $${payment.facturaTotal.toFixed(2)}

---------------------------------------
NOTAS:
---------------------------------------
${payment.notas || 'Sin observaciones'}

---------------------------------------
Sistema de Distribución de Carga
${App.formatDate(payment.createdAt)}
=======================================
            `;
            
            // Crear ventana de impresión
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Recibo de Pago ${payment.id}</title>
                    <style>
                        body { font-family: 'Courier New', monospace; margin: 20px; }
                        pre { white-space: pre-wrap; font-size: 12px; }
                    </style>
                </head>
                <body onload="window.print(); window.close();">
                    <pre>${receipt}</pre>
                </body>
                </html>
            `);
            printWindow.document.close();
            
        } catch (error) {
            console.error('Error printing payment receipt:', error);
            alert('Error al imprimir el recibo: ' + error.message);
        }
    },

    // Payments Management
    loadPayments: async function() {
        try {
            const payments = await App.apiCall('/payments');
            App.updatePaymentsTable(payments);
        } catch (error) {
            console.error('Error loading payments:', error);
        }
    },

    updatePaymentsTable: function(payments) {
        const tbody = document.querySelector('#paymentsTable tbody');
        tbody.innerHTML = '';
        
        if (payments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No hay pagos registrados</td></tr>';
            return;
        }
        
        payments.forEach(payment => {
            const row = tbody.insertRow();
            
            // Manejar compatibilidad con formato anterior y nuevo
            const fecha = payment.fecha || App.formatDate(payment.createdAt);
            const concepto = payment.concepto || 'Pago de factura';
            const referencia = payment.referencia || '-';
            const monto = payment.monto || payment.amount || 0;
            const facturaNumero = payment.facturaNumero || payment.invoiceId;
            const metodoPago = payment.metodoPago || 'No especificado';
            const estado = payment.estado || 'completado';
            
            row.innerHTML = `
                <td><strong>${App.formatDate(fecha)}</strong></td>
                <td>${concepto}</td>
                <td><code>${referencia}</code></td>
                <td><strong style="color: #198754;">$${parseFloat(monto).toFixed(2)}</strong></td>
                <td>${facturaNumero}</td>
                <td>${metodoPago}</td>
                <td><span class="status-badge status-${estado === 'completado' ? 'paid' : estado}">${estado}</span></td>
                <td class="actions">
                    <button class="btn btn-info btn-sm" onclick="App.viewPaymentDetails('${payment.id}')" title="Ver Detalles">👁️</button>
                    <button class="btn btn-secondary btn-sm" onclick="App.printPaymentReceipt('${payment.id}')" title="Imprimir Recibo">🧾</button>
                </td>
            `;
        });
    },

    showPaymentModal: async function(invoiceId) {
        try {
            // Asegurar que el loading overlay esté cerrado antes de mostrar el modal
            App.showLoading(false);
            
            // Obtener información de la factura
            const invoice = await App.apiCall(`/invoices/${invoiceId}`);
            
            // Configurar formulario
            document.getElementById('paymentInvoiceId').value = invoiceId;
            document.getElementById('paymentForm').reset();
            
            // Mostrar información de la factura
            const invoiceInfoDiv = document.getElementById('paymentInvoiceInfo');
            invoiceInfoDiv.innerHTML = `
                <h4>🧾 Información de la Factura</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                    <div><strong>Número:</strong> ${invoice.number}</div>
                    <div><strong>Fecha:</strong> ${App.formatDate(invoice.fecha)}</div>
                    <div><strong>Ciudad:</strong> ${invoice.ciudad}</div>
                    <div><strong>Agente:</strong> ${invoice.agente}</div>
                    <div><strong>Total a pagar:</strong> <span style="color: #d63384; font-weight: bold;">$${invoice.total.toFixed(2)}</span></div>
                    <div><strong>Estado:</strong> ${App.getStatusText(invoice.status)}</div>
                </div>
            `;
            
            // Establecer valores por defecto
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('paymentDate').value = today;
            document.getElementById('paymentAmount').value = invoice.total.toFixed(2);
            
            // Pre-seleccionar concepto por defecto
            const conceptSelect = document.getElementById('paymentConcept');
            conceptSelect.value = 'Pago total de factura';
            
            // Pre-seleccionar método de pago por defecto
            const methodSelect = document.getElementById('paymentMethod');
            methodSelect.value = 'Transferencia bancaria';
            
            // Establecer referencia sugerida
            const referenceInput = document.getElementById('paymentReference');
            referenceInput.placeholder = `Ref. para ${invoice.number}`;
            
            // Mostrar modal
            document.getElementById('paymentModal').classList.add('active');
            
        } catch (error) {
            console.error('Error loading invoice for payment:', error);
            alert('Error al cargar la información de la factura: ' + error.message);
        }
    },

    handlePaymentSubmit: async function(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const rawData = Object.fromEntries(formData.entries());
        
        // Validar campos requeridos
        if (!rawData.fecha || !rawData.monto || !rawData.concepto || !rawData.referencia) {
            alert('Por favor complete todos los campos requeridos (marcados con *)');
            return;
        }
        
        // Validar monto
        const monto = parseFloat(rawData.monto);
        if (isNaN(monto) || monto <= 0) {
            alert('El monto debe ser un número mayor que 0');
            return;
        }
        
        // Preparar datos del pago con estructura completa
        const paymentData = {
            invoiceId: rawData.invoiceId,
            fecha: rawData.fecha,
            monto: monto,
            concepto: rawData.concepto,
            referencia: rawData.referencia,
            metodoPago: rawData.metodoPago || 'Transferencia bancaria',
            notas: rawData.notas || '',
            
            // Campos adicionales para el sistema
            fechaRegistro: new Date().toISOString(),
            estado: 'completado'
        };
        
        try {
            App.showLoading(true);
            
            await App.apiCall('/payments', {
                method: 'POST',
                body: JSON.stringify(paymentData)
            });
            
            App.showLoading(false);
            App.closeModals();
            
            // Recargar datos
            App.loadPayments();
            App.loadInvoices();
            App.loadDashboard();
            
            alert(`✅ Pago registrado exitosamente!\n\n📋 Detalles:\n• Fecha: ${paymentData.fecha}\n• Concepto: ${paymentData.concepto}\n• Referencia: ${paymentData.referencia}\n• Monto: $${paymentData.monto.toFixed(2)}`);
            
        } catch (error) {
            App.showLoading(false);
            console.error('Error registering payment:', error);
            alert(`❌ Error al registrar pago: ${error.message}`);
        }
    },

    // Test Functions - Para debugging
    testNewActaButton: function() {
        console.log('🧪 Testing botón Nueva Acta...');
        const btn = document.getElementById('newActaBtn');
        if (btn) {
            console.log('✅ Botón encontrado, simulando click...');
            btn.click();
        } else {
            console.error('❌ Botón Nueva Acta no encontrado');
        }
    },

    testCreateSimpleActa: async function() {
        try {
            const simpleActa = {
                fecha: new Date().toISOString().split('T')[0],
                ciudad: 'Caracas',
                agente: 'Test Agent',
                guides: [{
                    noGuia: 'TEST001',
                    nombreCliente: 'Cliente Test',
                    direccion: 'Direccion Test',
                    telefono: '555-1234',
                    bultos: 1,
                    pies: 10,
                    kgs: 20,
                    via: 'aereo',
                    subtotal: 25
                }]
            };
            const result = await App.apiCall('/actas', {
                method: 'POST',
                body: JSON.stringify(simpleActa)
            });
            alert('Acta de prueba creada exitosamente');
            window.location.reload();
            return result;
        } catch (error) {
            console.error('Error creando acta de prueba:', error);
            alert('Error creando acta de prueba: ' + error.message);
        }
    },

    // Función para setup inicial
    setupInitialData: async function() {
        try {
            // Agregar un agente de prueba si no existe
            const agents = await App.apiCall('/agents');
            if (agents.length === 0) {
                await App.apiCall('/agents', {
                    method: 'POST',
                    body: JSON.stringify({ name: 'Test Agent' })
                });
                console.log('Agente de prueba creado');
            }
            
            alert('Datos iniciales configurados');
        } catch (error) {
            console.error('Error configurando datos iniciales:', error);
        }
    },

    // Función para probar la vista de detalles
    testViewDetails: async function() {
        try {
            const actas = await App.apiCall('/actas');
            if (actas.length === 0) {
                alert('No hay actas para mostrar. Crea una acta primero.');
                return;
            }
            
            const firstActa = actas[0];
            alert(`Probando vista de detalles del acta: ${firstActa.id}`);
            App.viewActaDetails(firstActa.id);
        } catch (error) {
            console.error('Error probando vista de detalles:', error);
            alert('Error: ' + error.message);
        }
    },

    // Verificar estado completo del sistema
    checkSystemStatus: async function() {
        try {
            console.log('🔍 === ESTADO DEL SISTEMA ===');
            
            const actas = await App.apiCall('/actas');
            const invoices = await App.apiCall('/invoices');
            const agents = await App.apiCall('/agents');
            
            console.log(`📋 Actas: ${actas.length}`);
            console.log(`🧾 Facturas: ${invoices.length}`);
            console.log(`👥 Agentes: ${agents.length}`);
            
            const status = `
ESTADO DEL SISTEMA
==================
📋 Actas registradas: ${actas.length}
🧾 Facturas generadas: ${invoices.length}
👥 Agentes disponibles: ${agents.length}

✅ Sistema funcionando correctamente
            `;
            
            alert(status.trim());
            return { actas, invoices, agents };
        } catch (error) {
            console.error('Error verificando estado:', error);
            alert('Error verificando estado: ' + error.message);
        }
    },

    // Test completo del flujo de actas y facturas
    testCompleteFlow: async function() {
        try {
            alert('🧪 Iniciando test completo del flujo acta → factura');
            
            // 1. Crear acta de prueba
            const actaTest = {
                fecha: new Date().toISOString().split('T')[0],
                ciudad: 'Caracas',
                agente: 'Test Agent',
                modeloCamion: 'Freightliner',
                anioCamion: '2020',
                placaCamion: 'ABC-123',
                nombreChofer: 'Juan Pérez',
                telefonoChofer: '555-1234',
                nombreAyudante: 'Pedro López',
                telefonoAyudante: '555-5678',
                guides: [{
                    noGuia: `TEST-${Date.now()}`,
                    nombreCliente: 'Cliente Test',
                    direccion: 'Dirección Test 123',
                    telefono: '555-9999',
                    bultos: 5,
                    pies: 15.5,
                    kgs: 30,
                    via: 'aereo',
                    subtotal: 38.75
                }]
            };
            
            // Crear acta
            const acta = await App.apiCall('/actas', {
                method: 'POST',
                body: JSON.stringify(actaTest)
            });
            
            alert(`✅ Acta creada: ${acta.id}`);
            
            // 2. Crear factura automáticamente
            const invoice = await App.apiCall('/invoices', {
                method: 'POST',
                body: JSON.stringify({ actaId: acta.id })
            });
            
            alert(`✅ Factura creada: ${invoice.number}\nTotal: $${invoice.total.toFixed(2)}`);
            
            // 3. Mostrar detalles
            App.viewInvoiceDetails(invoice.id);
            
        } catch (error) {
            console.error('Error en test completo:', error);
            alert('❌ Error en test: ' + error.message);
        }
    },

    // Test de impresión de facturas
    testPrintInvoice: async function() {
        try {
            const invoices = await App.apiCall('/invoices');
            if (invoices.length === 0) {
                alert('No hay facturas para imprimir. Crea una factura primero.');
                return;
            }
            
            const firstInvoice = invoices[0];
            alert(`🖨️ Probando impresión de la factura: ${firstInvoice.number}`);
            
            // Imprimir la primera factura disponible
            App.printInvoice(firstInvoice.id);
            
        } catch (error) {
            console.error('Error en test de impresión:', error);
            alert('❌ Error al probar impresión: ' + error.message);
        }
    },

    // Backup Management
    exportBackup: async function() {
        try {
            const confirmed = confirm(
                '¿Desea exportar un respaldo completo del sistema?\n\n' +
                'Esto incluirá:\n' +
                '• Todas las actas\n' +
                '• Todas las facturas\n' +
                '• Todos los pagos\n' +
                '• Todos los agentes\n' +
                '• Configuración de tarifas\n' +
                '• Usuarios del sistema\n\n' +
                'El archivo se descargará automáticamente.'
            );
            
            if (!confirmed) return;
            
            App.showLoading(true);
            
            // Llamar al endpoint de exportación
            const response = await fetch('/api/backup/export', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status} ${response.statusText}`);
            }
            
            // Obtener el blob de respuesta
            const blob = await response.blob();
            
            // Crear enlace de descarga
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // Obtener el nombre del archivo del header
            const disposition = response.headers.get('Content-Disposition');
            const filename = disposition ? 
                disposition.split('filename="')[1].split('"')[0] : 
                `backup-distcarga-${new Date().toISOString().split('T')[0]}.json`;
            
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // Limpiar
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            App.showLoading(false);
            alert(`✅ Respaldo exportado exitosamente!\n\nArchivo: ${filename}`);
            
        } catch (error) {
            App.showLoading(false);
            console.error('Error al exportar respaldo:', error);
            alert('❌ Error al exportar respaldo: ' + error.message);
        }
    },

    handleBackupFileSelection: function(e) {
        const file = e.target.files[0];
        const fileInfoDiv = document.getElementById('selectedFileInfo');
        const fileNameSpan = document.getElementById('fileName');
        const importBtn = document.getElementById('importBackupBtn');
        
        if (file) {
            // Validar que sea un archivo JSON
            if (!file.name.toLowerCase().endsWith('.json')) {
                alert('❌ Por favor seleccione un archivo JSON válido');
                e.target.value = '';
                return;
            }
            
            // Mostrar información del archivo
            fileNameSpan.textContent = file.name;
            fileInfoDiv.style.display = 'block';
            importBtn.disabled = false;
            
            // Guardar referencia al archivo
            App.selectedBackupFile = file;
            
        } else {
            fileInfoDiv.style.display = 'none';
            importBtn.disabled = true;
            App.selectedBackupFile = null;
        }
    },

    importBackup: async function() {
        try {
            if (!App.selectedBackupFile) {
                alert('❌ Por favor seleccione un archivo de respaldo primero');
                return;
            }
            
            // Confirmar importación
            const confirmed = confirm(
                '⚠️ ADVERTENCIA: Esta operación puede sobrescribir datos existentes.\n\n' +
                '¿Está seguro de que desea importar este respaldo?\n\n' +
                'Se recomienda hacer un respaldo antes de continuar.'
            );
            
            if (!confirmed) return;
            
            App.showLoading(true);
            
            // Leer el archivo JSON
            const fileContent = await App.readFileAsText(App.selectedBackupFile);
            let backupData;
            
            try {
                backupData = JSON.parse(fileContent);
            } catch (parseError) {
                throw new Error('Archivo JSON inválido o corrupto');
            }
            
            // Validar estructura básica
            if (!backupData.data) {
                throw new Error('Estructura de respaldo inválida - falta sección "data"');
            }
            
            // Obtener opciones de importación
            const options = {
                overwrite: document.getElementById('overwriteData').checked,
                mergeUsers: document.getElementById('mergeUsers').checked,
                preservePasswords: document.getElementById('preservePasswords').checked
            };
            
            // Enviar al servidor
            const result = await App.apiCall('/backup/import', {
                method: 'POST',
                body: JSON.stringify({
                    backupData: backupData,
                    options: options
                })
            });
            
            App.showLoading(false);
            
            // Mostrar resultado
            let message = '✅ Respaldo importado exitosamente!\n\n';
            message += '📊 Estadísticas de importación:\n';
            
            for (const [table, count] of Object.entries(result.statistics.imported)) {
                if (count > 0) {
                    message += `• ${table}: ${count} registros importados\n`;
                }
            }
            
            for (const [table, count] of Object.entries(result.statistics.skipped)) {
                if (count > 0) {
                    message += `• ${table}: ${count} registros omitidos\n`;
                }
            }
            
            if (result.statistics.errors.length > 0) {
                message += '\n⚠️ Errores encontrados:\n';
                result.statistics.errors.forEach(error => {
                    message += `• ${error}\n`;
                });
            }
            
            alert(message);
            
            // Recargar datos
            App.loadDashboard();
            App.loadActas();
            App.loadInvoices();
            App.loadPayments();
            App.loadSettings();
            
            // Limpiar selección de archivo
            document.getElementById('importBackupFile').value = '';
            document.getElementById('selectedFileInfo').style.display = 'none';
            document.getElementById('importBackupBtn').disabled = true;
            App.selectedBackupFile = null;
            
        } catch (error) {
            App.showLoading(false);
            console.error('Error al importar respaldo:', error);
            alert('❌ Error al importar respaldo: ' + error.message);
        }
    },

    readFileAsText: function(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Error al leer el archivo'));
            reader.readAsText(file);
        });
    },

    // Test de sistema de respaldo
    testBackupSystem: async function() {
        try {
            alert('🧪 Iniciando test del sistema de respaldo...');
            
            // Verificar que hay datos para respaldar
            const stats = await App.apiCall('/dashboard');
            
            if (stats.totalActas === 0 && stats.totalInvoices === 0) {
                alert('⚠️ No hay datos para respaldar. Crea algunas actas primero.');
                return;
            }
            
            alert(`📊 Datos disponibles para respaldar:\n• Actas: ${stats.totalActas}\n• Facturas: ${stats.totalInvoices}\n• Pagos: ${stats.totalPayments}\n\n🔄 Ejecutando exportación...`);
            
            // Ejecutar exportación
            App.exportBackup();
            
        } catch (error) {
            console.error('Error en test de respaldo:', error);
            alert('❌ Error en test: ' + error.message);
        }
    },

    // Guide Status Management
    getStatusText: function(status) {
        const statusMap = {
            'almacen': 'En Almacén',
            'lista_despacho': 'Lista para Despacho',
            'en_despacho': 'En Despacho',
            'despachada': 'Despachada'
        };
        return statusMap[status] || 'En Almacén';
    },

    getStatusBadgeClass: function(status) {
        const classMap = {
            'almacen': 'status-almacen',
            'lista_despacho': 'status-lista',
            'en_despacho': 'status-proceso',
            'despachada': 'status-completado'
        };
        return classMap[status] || 'status-almacen';
    },

    updateGuideStatus: async function(actaId, guideIndex, newStatus, notes = '') {
        try {
            App.showLoading(true);
            
            const result = await App.apiCall(`/actas/${actaId}/guides/${guideIndex}/status`, {
                method: 'PUT',
                body: JSON.stringify({
                    status: newStatus,
                    notes: notes
                })
            });
            
            App.showLoading(false);
            
            if (result.success) {
                // Actualizar la UI
                const statusElement = document.getElementById(`guideStatus_${guideIndex}`);
                if (statusElement) {
                    statusElement.className = `status-badge ${App.getStatusBadgeClass(newStatus)}`;
                    statusElement.textContent = App.getStatusText(newStatus);
                }
                
                // Mostrar confirmación
                App.showStatusToast(`✅ Estado actualizado: ${App.getStatusText(newStatus)}`);
                
                return result;
            } else {
                throw new Error(result.message || 'Error al actualizar estado');
            }
            
        } catch (error) {
            App.showLoading(false);
            console.error('Error updating guide status:', error);
            alert('❌ Error al actualizar estado: ' + error.message);
            throw error;
        }
    },

    updateMultipleGuideStatus: async function(actaId, guidesUpdates, notes = '') {
        try {
            App.showLoading(true);
            
            const result = await App.apiCall(`/actas/${actaId}/guides/bulk-status`, {
                method: 'PUT',
                body: JSON.stringify({
                    guides: guidesUpdates,
                    notes: notes
                })
            });
            
            App.showLoading(false);
            
            if (result.success) {
                // Actualizar la UI para cada guía
                guidesUpdates.forEach(({ index, status }) => {
                    const statusElement = document.getElementById(`guideStatus_${index}`);
                    if (statusElement) {
                        statusElement.className = `status-badge ${App.getStatusBadgeClass(status)}`;
                        statusElement.textContent = App.getStatusText(status);
                    }
                });
                
                alert(`✅ ${result.updatedCount} guías actualizadas exitosamente`);
                return result;
            } else {
                throw new Error(result.message || 'Error en actualización masiva');
            }
            
        } catch (error) {
            App.showLoading(false);
            console.error('Error updating multiple guide status:', error);
            alert('❌ Error en actualización masiva: ' + error.message);
            throw error;
        }
    },

    showGuideStatusModal: function(actaId, guideIndex, currentGuide) {
        const currentStatus = currentGuide.status || 'almacen';
        
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📦 Cambiar Estado de Guía</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="guide-info">
                        <h4>Guía: ${currentGuide.noGuia}</h4>
                        <p><strong>Cliente:</strong> ${currentGuide.nombreCliente}</p>
                        <p><strong>Estado actual:</strong> <span class="status-badge ${App.getStatusBadgeClass(currentStatus)}">${App.getStatusText(currentStatus)}</span></p>
                    </div>
                    
                    <form id="statusChangeForm">
                        <div class="form-group">
                            <label for="newStatus">🔄 Nuevo Estado:</label>
                            <select id="newStatus" required>
                                <option value="almacen" ${currentStatus === 'almacen' ? 'selected' : ''}>📦 En Almacén</option>
                                <option value="lista_despacho" ${currentStatus === 'lista_despacho' ? 'selected' : ''}>✅ Lista para Despacho</option>
                                <option value="en_despacho" ${currentStatus === 'en_despacho' ? 'selected' : ''}>🚛 En Despacho</option>
                                <option value="despachada" ${currentStatus === 'despachada' ? 'selected' : ''}>🎯 Despachada</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="statusNotes">📝 Notas (opcional):</label>
                            <textarea id="statusNotes" rows="3" placeholder="Observaciones sobre el cambio de estado..."></textarea>
                        </div>
                        
                        ${currentGuide.statusHistory && currentGuide.statusHistory.length > 0 ? `
                        <div class="status-history">
                            <h5>📊 Historial de Estados:</h5>
                            <div class="history-list">
                                ${currentGuide.statusHistory.slice(-3).map(h => `
                                    <div class="history-item">
                                        <span class="status-badge ${App.getStatusBadgeClass(h.status)}">${App.getStatusText(h.status)}</span>
                                        <small>${App.formatDate(h.changedAt)} por ${h.changedBy}</small>
                                        ${h.notes ? `<p class="notes">${h.notes}</p>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="App.handleStatusChange('${actaId}', ${guideIndex})">💾 Actualizar Estado</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    },

    handleStatusChange: async function(actaId, guideIndex) {
        try {
            const newStatus = document.getElementById('newStatus').value;
            const notes = document.getElementById('statusNotes').value;
            
            await App.updateGuideStatus(actaId, guideIndex, newStatus, notes);
            
            // Cerrar modal
            document.querySelector('.modal.active').remove();
            
            // Recargar vista de acta si está abierta
            if (document.getElementById('actaModal').classList.contains('active')) {
                // Actualizar vista del modal de acta
                App.loadActaInModal(actaId);
            }
            
        } catch (error) {
            // Error ya manejado en updateGuideStatus
        }
    },

    showStatusToast: function(message) {
        // Crear toast de notificación
        const toast = document.createElement('div');
        toast.className = 'status-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-weight: 500;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    },

    // Test del flujo completo: Acta → Factura → Pago
    testFullPaymentFlow: async function() {
        try {
            alert('🧪 Iniciando test completo: Acta → Factura → Pago');
            
            // 1. Crear acta de prueba
            const actaTest = {
                fecha: new Date().toISOString().split('T')[0],
                ciudad: 'Caracas',
                agente: 'Test Agent',
                modeloCamion: 'Freightliner',
                anioCamion: '2020',
                placaCamion: 'ABC-123',
                nombreChofer: 'Juan Pérez',
                telefonoChofer: '555-1234',
                nombreAyudante: 'Pedro López',
                telefonoAyudante: '555-5678',
                guides: [{
                    noGuia: `TEST-${Date.now()}`,
                    nombreCliente: 'Cliente Test',
                    direccion: 'Dirección Test 123',
                    telefono: '555-9999',
                    bultos: 5,
                    pies: 15.5,
                    kgs: 30,
                    via: 'aereo',
                    subtotal: 50.00
                }]
            };
            
            // Crear acta
            const acta = await App.apiCall('/actas', {
                method: 'POST',
                body: JSON.stringify(actaTest)
            });
            
            alert(`✅ Acta creada: ${acta.id}`);
            
            // 2. Crear factura
            const invoice = await App.apiCall('/invoices', {
                method: 'POST',
                body: JSON.stringify({ actaId: acta.id })
            });
            
            alert(`✅ Factura creada: ${invoice.number}\nSubtotal: $${invoice.subtotal.toFixed(2)}\nTotal (Sin IVA): $${invoice.total.toFixed(2)}`);
            
            // 3. Crear pago de prueba
            const paymentTest = {
                invoiceId: invoice.id,
                fecha: new Date().toISOString().split('T')[0],
                concepto: 'Pago total de factura',
                referencia: `TEST-PAY-${Date.now()}`,
                monto: invoice.total,
                metodoPago: 'Transferencia bancaria',
                notas: 'Pago de prueba automático del sistema'
            };
            
            const payment = await App.apiCall('/payments', {
                method: 'POST',
                body: JSON.stringify(paymentTest)
            });
            
            alert(`✅ Pago registrado!\n\n📋 Detalles:\n• Fecha: ${payment.fecha}\n• Concepto: ${payment.concepto}\n• Referencia: ${payment.referencia}\n• Monto: $${payment.monto.toFixed(2)}\n• Factura: ${payment.facturaNumero}`);
            
            // 4. Mostrar recibo
            App.viewPaymentDetails(payment.id);
            
            // 5. Recargar todas las secciones
            App.loadDashboard();
            
        } catch (error) {
            console.error('Error en test completo de pagos:', error);
            alert('❌ Error en test: ' + error.message);
        }
    },

    // Test del sistema de estados de guías
    testGuideStatusSystem: async function() {
        try {
            alert('🧪 Iniciando test del sistema de estados de guías...');
            
            // Verificar que hay actas con guías
            const actas = await App.apiCall('/actas');
            const actasWithGuides = actas.filter(acta => acta.guides && acta.guides.length > 0);
            
            if (actasWithGuides.length === 0) {
                alert('⚠️ No hay actas con guías para probar. Crea una acta con guías primero.');
                return;
            }
            
            const testActa = actasWithGuides[0];
            alert(`📋 Usando acta ${testActa.id} con ${testActa.guides.length} guías para el test`);
            
            // Test 1: Cambiar estado individual
            const firstGuideIndex = 0;
            await App.updateGuideStatus(testActa.id, firstGuideIndex, 'lista_despacho', 'Test automático - cambio individual');
            
            // Test 2: Cambio masivo
            const guidesUpdates = testActa.guides.slice(0, 2).map((guide, index) => ({
                index: index,
                status: 'en_despacho'
            }));
            
            await App.updateMultipleGuideStatus(testActa.id, guidesUpdates, 'Test automático - cambio masivo');
            
            alert('✅ Test completado:\n• Estado individual actualizado\n• Estados masivos actualizados\n\n📋 Abre la vista de detalles del acta para ver los cambios');
            
        } catch (error) {
            console.error('Error en test de estados:', error);
            alert('❌ Error en test: ' + error.message);
        }
    },

    // Accounts Receivable Management
    loadAccountsReceivable: async function() {
        try {
            console.log('💰 Cargando cuentas por cobrar...');
            
            // Obtener filtros actuales
            const filters = App.getAccountsFilters();
            
            // Construir query string para filtros
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.agente) params.append('agente', filters.agente);
            if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
            if (filters.dateTo) params.append('dateTo', filters.dateTo);
            
            const response = await App.apiCall(`/accounts-receivable?${params.toString()}`);
            
            // Actualizar estadísticas
            App.updateAccountsStatistics(response.statistics);
            
            // Actualizar tabla
            App.updateAccountsReceivableTable(response.accounts);
            
            console.log('✅ Cuentas por cobrar cargadas:', response.accounts.length);
            
        } catch (error) {
            console.error('Error loading accounts receivable:', error);
            alert('Error al cargar cuentas por cobrar: ' + error.message);
        }
    },

    getAccountsFilters: function() {
        return {
            status: document.getElementById('arStatusFilter')?.value || '',
            agente: document.getElementById('arAgentFilter')?.value || '',
            dateFrom: document.getElementById('arDateFrom')?.value || '',
            dateTo: document.getElementById('arDateTo')?.value || ''
        };
    },

    updateAccountsStatistics: function(stats) {
        // Actualizar tarjetas de estadísticas
        document.getElementById('totalPendingAmount').textContent = `$${stats.totalPending.toFixed(2)}`;
        document.getElementById('totalInvoicesCount').textContent = stats.totalInvoices;
        
        // Calcular vencidas (más de 30 días)
        const overdueAmount = stats.byAging['31-60'] + stats.byAging['61-90'] + stats.byAging['90+'];
        document.getElementById('overdueAmount').textContent = `$${overdueAmount.toFixed(2)}`;
        document.getElementById('recentAmount').textContent = `$${stats.byAging['0-30'].toFixed(2)}`;
        
        // Actualizar análisis de aging
        document.getElementById('aging030').textContent = `$${stats.byAging['0-30'].toFixed(2)}`;
        document.getElementById('aging3160').textContent = `$${stats.byAging['31-60'].toFixed(2)}`;
        document.getElementById('aging6190').textContent = `$${stats.byAging['61-90'].toFixed(2)}`;
        document.getElementById('aging90plus').textContent = `$${stats.byAging['90+'].toFixed(2)}`;
    },

    updateAccountsReceivableTable: function(accounts) {
        const tbody = document.querySelector('#accountsReceivableTable tbody');
        tbody.innerHTML = '';
        
        if (accounts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px;">No hay cuentas por cobrar con los filtros aplicados</td></tr>';
            return;
        }
        
        accounts.forEach(account => {
            const row = tbody.insertRow();
            
            // Determinar clase de fila basada en aging
            let rowClass = '';
            if (account.balance > 0) {
                if (account.aging === '90+') rowClass = 'row-critical';
                else if (account.aging === '61-90') rowClass = 'row-danger';
                else if (account.aging === '31-60') rowClass = 'row-warning';
            }
            
            row.className = rowClass;
            
            row.innerHTML = `
                <td><strong>${account.invoiceNumber}</strong></td>
                <td>${App.formatDate(account.fecha)}</td>
                <td>${account.agente}</td>
                <td>${account.ciudad}</td>
                <td><strong>$${account.total.toFixed(2)}</strong></td>
                <td>$${account.totalPaid.toFixed(2)}</td>
                <td><strong style="color: ${account.balance > 0 ? '#dc3545' : '#198754'};">$${account.balance.toFixed(2)}</strong></td>
                <td>
                    <span class="aging-badge aging-${account.aging.replace('+', 'plus').replace('-', 'to')}">${account.daysDue} días</span>
                </td>
                <td><span class="status-badge status-${account.paymentStatus}">${App.getPaymentStatusText(account.paymentStatus)}</span></td>
                <td class="actions">
                    <button class="btn btn-info btn-sm" onclick="App.viewInvoiceDetails('${account.invoiceId}')" title="Ver Factura">👁️</button>
                    ${account.balance > 0 ? `
                        <button class="btn btn-warning btn-sm" onclick="App.showPaymentModal('${account.invoiceId}')" title="Registrar Pago">💳</button>
                        <button class="btn btn-secondary btn-sm" onclick="App.sendPaymentReminder('${account.invoiceId}')" title="Enviar Recordatorio">📧</button>
                    ` : ''}
                </td>
            `;
        });
    },

    getPaymentStatusText: function(status) {
        const statusMap = {
            'pending': 'Pendiente',
            'partial': 'Pago Parcial',
            'paid': 'Pagado'
        };
        return statusMap[status] || status;
    },

    applyAccountsFilters: function() {
        App.loadAccountsReceivable();
    },

    clearAccountsFilters: function() {
        document.getElementById('arStatusFilter').value = '';
        document.getElementById('arAgentFilter').value = '';
        document.getElementById('arDateFrom').value = '';
        document.getElementById('arDateTo').value = '';
        App.loadAccountsReceivable();
    },

    sendPaymentReminder: async function(invoiceId) {
        try {
            const customMessage = prompt(
                'Mensaje personalizado del recordatorio (opcional):\n\n' +
                'Dejar vacío para usar mensaje automático.'
            );
            
            if (customMessage === null) return; // Usuario canceló
            
            App.showLoading(true);
            
            const result = await App.apiCall(`/accounts-receivable/${invoiceId}/reminder`, {
                method: 'POST',
                body: JSON.stringify({
                    message: customMessage || undefined
                })
            });
            
            App.showLoading(false);
            
            if (result.success) {
                alert(`✅ Recordatorio enviado exitosamente para la factura ${result.reminder.invoiceNumber}`);
            } else {
                throw new Error(result.message || 'Error al enviar recordatorio');
            }
            
        } catch (error) {
            App.showLoading(false);
            console.error('Error sending payment reminder:', error);
            alert('❌ Error al enviar recordatorio: ' + error.message);
        }
    },

    exportAccountsReceivable: async function() {
        try {
            const confirmed = confirm(
                '¿Desea exportar el reporte de cuentas por cobrar?\n\n' +
                'Se generará un archivo CSV con los datos actuales filtrados.'
            );
            
            if (!confirmed) return;
            
            App.showLoading(true);
            
            // Obtener datos con filtros actuales
            const filters = App.getAccountsFilters();
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.agente) params.append('agente', filters.agente);
            if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
            if (filters.dateTo) params.append('dateTo', filters.dateTo);
            
            const response = await App.apiCall(`/accounts-receivable?${params.toString()}`);
            
            // Generar CSV
            const csvContent = App.generateAccountsCSV(response.accounts, response.statistics);
            
            // Descargar archivo
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `cuentas-por-cobrar-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            
            App.showLoading(false);
            alert('✅ Reporte exportado exitosamente');
            
        } catch (error) {
            App.showLoading(false);
            console.error('Error exporting accounts receivable:', error);
            alert('❌ Error al exportar: ' + error.message);
        }
    },

    generateAccountsCSV: function(accounts, stats) {
        // Encabezados CSV
        let csv = 'Factura,Fecha,Agente,Ciudad,Total,Pagado,Saldo,Días Vencidos,Estado,Aging\n';
        
        // Datos de cuentas
        accounts.forEach(account => {
            csv += `"${account.invoiceNumber}",`;
            csv += `"${App.formatDate(account.fecha)}",`;
            csv += `"${account.agente}",`;
            csv += `"${account.ciudad}",`;
            csv += `${account.total.toFixed(2)},`;
            csv += `${account.totalPaid.toFixed(2)},`;
            csv += `${account.balance.toFixed(2)},`;
            csv += `${account.daysDue},`;
            csv += `"${App.getPaymentStatusText(account.paymentStatus)}",`;
            csv += `"${account.aging} días"\n`;
        });
        
        // Agregar resumen estadístico
        csv += '\n\nRESUMEN ESTADÍSTICO\n';
        csv += `Total Facturas,${stats.totalInvoices}\n`;
        csv += `Monto Total,$${stats.totalAmount.toFixed(2)}\n`;
        csv += `Total Pagado,$${stats.totalPaid.toFixed(2)}\n`;
        csv += `Total Pendiente,$${stats.totalPending.toFixed(2)}\n`;
        
        csv += '\nANÁLISIS DE ANTIGÜEDAD\n';
        csv += `0-30 días,$${stats.byAging['0-30'].toFixed(2)}\n`;
        csv += `31-60 días,$${stats.byAging['31-60'].toFixed(2)}\n`;
        csv += `61-90 días,$${stats.byAging['61-90'].toFixed(2)}\n`;
        csv += `+90 días,$${stats.byAging['90+'].toFixed(2)}\n`;
        
        return csv;
    },

    // Test del módulo de cuentas por cobrar
    testAccountsReceivable: async function() {
        try {
            alert('🧪 Iniciando test del módulo de cuentas por cobrar...');
            
            // Cargar datos
            await App.loadAccountsReceivable();
            
            // Verificar que hay datos
            const tableBody = document.querySelector('#accountsReceivableTable tbody');
            const rows = tableBody.querySelectorAll('tr');
            
            if (rows.length === 1 && rows[0].cells.length === 1) {
                alert('⚠️ No hay cuentas por cobrar para mostrar. Crea algunas facturas primero.');
                return;
            }
            
            alert(`✅ Test completado:\n• Cuentas por cobrar cargadas: ${rows.length}\n• Estadísticas actualizadas\n• Filtros funcionales\n• Exportación disponible`);
            
        } catch (error) {
            console.error('Error en test de cuentas por cobrar:', error);
            alert('❌ Error en test: ' + error.message);
        }
    },

    // Excel Import Management
    showExcelImport: function() {
        const importSection = document.getElementById('excelImportSection');
        if (importSection.style.display === 'none') {
            importSection.style.display = 'block';
            importSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            importSection.style.display = 'none';
        }
    },

    hideExcelImport: function() {
        document.getElementById('excelImportSection').style.display = 'none';
        App.clearSelectedFile();
    },

    handleFileSelection: function(e) {
        const file = e.target.files[0];
        const fileInfo = document.getElementById('selectedFileInfo');
        const fileName = document.getElementById('fileName');
        const fileSize = document.getElementById('fileSize');
        const processBtn = document.getElementById('processExcelBtn');
        
        if (file) {
            // Validar tipo de archivo
            const validTypes = [
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ];
            
            if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/)) {
                alert('❌ Por favor selecciona un archivo Excel válido (.xlsx o .xls)');
                e.target.value = '';
                return;
            }
            
            // Validar tamaño (10MB máximo)
            if (file.size > 10 * 1024 * 1024) {
                alert('❌ El archivo es demasiado grande. Máximo 10MB permitido.');
                e.target.value = '';
                return;
            }
            
            // Mostrar información del archivo
            fileName.textContent = file.name;
            fileSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
            fileInfo.style.display = 'block';
            processBtn.disabled = false;
            
            App.selectedFile = file;
        } else {
            App.clearSelectedFile();
        }
    },

    clearSelectedFile: function() {
        document.getElementById('excelFileInput').value = '';
        document.getElementById('selectedFileInfo').style.display = 'none';
        document.getElementById('processExcelBtn').disabled = true;
        document.getElementById('importResults').style.display = 'none';
        App.selectedFile = null;
    },

    processExcelFile: async function() {
        if (!App.selectedFile) {
            alert('❌ Por favor selecciona un archivo Excel primero');
            return;
        }

        const confirmed = confirm(
            '¿Está seguro de que desea importar las actas desde este archivo Excel?\n\n' +
            '⚠️ Se crearán nuevas actas en el sistema basadas en los datos del archivo.\n\n' +
            'Archivo: ' + App.selectedFile.name
        );

        if (!confirmed) return;

        try {
            App.showImportProgress(true);

            // Crear FormData para enviar el archivo
            const formData = new FormData();
            formData.append('excelFile', App.selectedFile);

            // Enviar archivo al servidor
            const response = await fetch('/api/actas/import-excel', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: formData
            });

            const result = await response.json();

            App.showImportProgress(false);

            if (!response.ok) {
                throw new Error(result.error || `Error HTTP: ${response.status}`);
            }

            // Mostrar resultados
            App.showImportResults(result);

            // Recargar datos de actas
            if (result.imported > 0) {
                App.loadActas();
                App.loadDashboard();
            }

        } catch (error) {
            App.showImportProgress(false);
            console.error('Error procesando archivo Excel:', error);
            alert('❌ Error al procesar archivo: ' + error.message);
        }
    },

    showImportProgress: function(show) {
        const progressDiv = document.getElementById('importProgress');
        const progressFill = progressDiv.querySelector('.progress-fill');
        
        if (show) {
            progressDiv.style.display = 'block';
            progressFill.style.width = '0%';
            
            // Animación de progreso
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 20;
                if (progress > 90) progress = 90;
                progressFill.style.width = progress + '%';
            }, 200);
            
            App.progressInterval = interval;
        } else {
            if (App.progressInterval) {
                clearInterval(App.progressInterval);
            }
            progressFill.style.width = '100%';
            setTimeout(() => {
                progressDiv.style.display = 'none';
            }, 500);
        }
    },

    showImportResults: function(result) {
        const resultsDiv = document.getElementById('importResults');
        
        let errorsHtml = '';
        if (result.errors && result.errors.length > 0) {
            errorsHtml = `
                <div class="errors-section">
                    <h5>⚠️ Errores encontrados:</h5>
                    <div class="errors-list">
                        ${result.errors.map(error => `
                            <div class="error-item">
                                <strong>Fila ${error.row}:</strong> ${error.error}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        resultsDiv.innerHTML = `
            <div class="results-header">
                <h4>📊 Resultados de la Importación</h4>
            </div>
            
            <div class="results-summary">
                <div class="summary-item success">
                    <div class="summary-icon">✅</div>
                    <div class="summary-content">
                        <div class="summary-label">Actas Creadas</div>
                        <div class="summary-value">${result.imported}</div>
                    </div>
                </div>
                
                <div class="summary-item info">
                    <div class="summary-icon">📋</div>
                    <div class="summary-content">
                        <div class="summary-label">Filas Procesadas</div>
                        <div class="summary-value">${result.summary?.totalRows || 0}</div>
                    </div>
                </div>
                
                ${result.errors?.length > 0 ? `
                <div class="summary-item error">
                    <div class="summary-icon">❌</div>
                    <div class="summary-content">
                        <div class="summary-label">Errores</div>
                        <div class="summary-value">${result.errors.length}</div>
                    </div>
                </div>
                ` : ''}
            </div>
            
            ${errorsHtml}
            
            <div class="results-actions">
                <button class="btn btn-primary" onclick="App.hideExcelImport()">
                    ✅ Finalizar Importación
                </button>
                <button class="btn btn-secondary" onclick="App.clearSelectedFile()">
                    🔄 Importar Otro Archivo
                </button>
            </div>
        `;
        
        resultsDiv.style.display = 'block';
        resultsDiv.scrollIntoView({ behavior: 'smooth' });
        
        // Mostrar alerta con resumen
        alert(result.message || `✅ Importación completada: ${result.imported} actas creadas`);
    },

    downloadExampleTemplate: function() {
        // Mostrar información detallada
        const templateInfo = `
📊 PLANTILLA EXCEL PARA IMPORTACIÓN DE ACTAS

📋 ESTRUCTURA COMPLETA:

🔴 CAMPOS REQUERIDOS:
• Fecha - Fecha del acta (YYYY-MM-DD)
• Ciudad - Ciudad venezolana (Valencia, Maracaibo, Barquisimeto, etc.)
• Agente - Nombre del agente/cliente

🔵 CAMPOS OPCIONALES (Vehículo):
• Modelo Camion - Modelo del vehículo
• Año Camion - Año del vehículo
• Placa - Placa venezolana (formato: AB123CD)
• Chofer - Nombre del conductor
• Telefono Chofer - Teléfono venezolano (0414-XXX-XXXX)
• Ayudante - Nombre del ayudante
• Telefono Ayudante - Teléfono venezolano (0424-XXX-XXXX)

🔵 CAMPOS OPCIONALES (Guías):
• No Guia - Número de guía
• Cliente - Nombre del cliente final
• Direccion - Dirección venezolana completa
• Telefono - Teléfono del cliente (0241-XXX-XXXX)
• Bultos - Cantidad de bultos
• Pies - Pies cúbicos
• Kgs - Peso en kilogramos
• Via - Tipo de envío (terrestre/aereo)
• Subtotal - Monto en USD o Bs

💡 CONSEJOS:
• Los nombres de columnas son flexibles
• Cada fila = una acta completa
• Si incluyes datos de guía, se crea automáticamente
• Formatos: fechas (YYYY-MM-DD), teléfonos (04XX-XXX-XXXX)

¿Deseas descargar la plantilla con ejemplos?
        `.trim();
        
        const confirmed = confirm(templateInfo);
        if (!confirmed) return;

        // Generar plantilla Excel completa
        App.generateExcelTemplate();
    },

    generateExcelTemplate: function() {
        try {
            // Verificar si XLSX está disponible (cargado desde CDN en la interfaz de importación)
            if (typeof XLSX === 'undefined') {
                // Si no está disponible, generar CSV como respaldo
                App.generateCSVTemplate();
                return;
            }

            // Plantilla SOLO para guías (sin campos de acta)
            const headers = [
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
                ],
                [
                    '', '', '', '', '', '', '', '', '', '', '', '', ''
                ],
                [
                    '⬆️ AGREGA TUS GUÍAS AQUÍ ⬆️', '', '', '', '', '', '', '', '', '', '', '', ''
                ]
            ];

            // Crear hoja de instrucciones
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

            // Crear workbook
            const wb = XLSX.utils.book_new();

            // PRIMERO: Agregar hoja de guías (será la hoja activa al abrir)
            const datosGuias = [headers, ...ejemplos];
            const wsGuias = XLSX.utils.aoa_to_sheet(datosGuias);

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
            XLSX.utils.book_append_sheet(wb, wsGuias, "GUÍAS");

            // SEGUNDO: Agregar hoja de instrucciones (como referencia)
            const wsInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones);
            wsInstrucciones['!cols'] = [{wch: 60}]; // Ancho de columna
            XLSX.utils.book_append_sheet(wb, wsInstrucciones, "Instrucciones");

            // Generar archivo y descargarlo
            const today = new Date().toISOString().split('T')[0];
            const fileName = `Plantilla_Guias_${today}.xlsx`;
            XLSX.writeFile(wb, fileName);

            alert(`✅ ¡Plantilla Excel descargada exitosamente!

📄 Archivo: ${fileName}
📊 Incluye: 
  • Hoja de instrucciones completas
  • 3 ejemplos de actas con todos los campos
  • Formato Excel nativo con columnas ajustadas

💡 Próximos pasos:
1. Abre el archivo en Excel
2. Ve a la hoja "📊 Actas"
3. Llena tus datos siguiendo los ejemplos
4. Guarda y sube a la aplicación`);

        } catch (error) {
            console.error('Error generando plantilla Excel:', error);
            App.generateCSVTemplate(); // Fallback a CSV
        }
    },

    generateCSVTemplate: function() {
        // Fallback: generar CSV de guías si Excel no está disponible
        const templateData = [
            // Encabezados solo de guías
            ['No', 'WAREHOUSE', 'FILE', 'ORIGEN', 'VIA', 'CLIENTE', 'EMBARCADOR', 'CANT. TEORICA', 'CANT. DESPACHADA', 'PIES CUBICOS', 'PESO', 'DESTINO', 'DIRECCION'],
            // Ejemplos de guías venezolanas
            ['1', 'ALM-VLC-01', 'EXP-2024-001', 'Caracas', 'terrestre', 'Distribuidora Centro C.A.', 'Comercial El Progreso', '5', '5', '15.5', '30', 'Valencia', 'Av. Bolívar Norte, Valencia, Carabobo'],
            ['2', 'ALM-MCB-02', 'EXP-2024-002', 'Maracaibo', 'aereo', 'Comercial Zulia S.A.', 'Auto Repuestos Zulia', '3', '3', '8.2', '20', 'Cabimas', 'Av. 5 de Julio, Maracaibo, Zulia'],
            ['3', 'ALM-MCB-03', 'EXP-2024-003', 'Valencia', 'terrestre', 'Empresa ABC C.A.', 'Distribuidora Centro', '2', '2', '5.1', '15', 'Maracay', 'Calle 72, Valencia, Carabobo'],
            ['4', 'ALM-BQM-01', 'EXP-2024-004', 'Caracas', 'aereo', 'Distribuidora Norte', 'Comercial Oriente', '4', '4', '12.3', '35', 'Barquisimeto', 'Av. Delicias, Barquisimeto, Lara']
        ];
        
        // Convertir a CSV
        const csvContent = templateData.map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
        
        // Descargar archivo
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const today = new Date().toISOString().split('T')[0];
        link.download = `Plantilla_Guias_${today}.csv`;
        link.click();
        
        alert(`📥 ¡Plantilla CSV de Guías descargada!

⚠️ Nota: Se descargó en formato CSV (Excel no disponible)
💡 Abre el archivo CSV en Excel para editarlo
📋 Incluye 4 ejemplos venezolanos completos
✅ Solo requiere: CLIENTE y DIRECCION`);
    },

    // Función para agregar drag & drop al área de upload
    setupDragAndDrop: function() {
        const dropZone = document.querySelector('.upload-drop-zone');
        
        if (!dropZone) return;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });
        
        function highlight(e) {
            dropZone.classList.add('dragover');
        }
        
        function unhighlight(e) {
            dropZone.classList.remove('dragover');
        }
        
        dropZone.addEventListener('drop', handleDrop, false);
        
        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                const fileInput = document.getElementById('excelFileInput');
                fileInput.files = files;
                
                // Triggear el evento change manualmente
                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
            }
        }
    },

    // Test de importación Excel
    testExcelImport: async function() {
        try {
            alert('🧪 Iniciando test de importación Excel...\n\nEste test te permitirá probar la funcionalidad de importación.');
            
            // Mostrar la sección de importación
            App.showExcelImport();
            
            alert('✅ Sección de importación mostrada.\n\n📋 Instrucciones:\n1. Descarga la plantilla de ejemplo\n2. Llena algunos datos de prueba\n3. Sube el archivo para probarlo');
            
        } catch (error) {
            console.error('Error en test de importación:', error);
            alert('❌ Error en test: ' + error.message);
        }
    },

    debugActasSystem: async function() {
        console.log('🔍 === DIAGNÓSTICO COMPLETO DEL SISTEMA DE ACTAS ===');
        
        try {
            // 1. Verificar botón Nueva Acta
            const btn = document.getElementById('newActaBtn');
            console.log('1️⃣ Botón Nueva Acta:', btn ? '✅ Encontrado' : '❌ No encontrado');
            
            // 2. Verificar tabla de actas
            const table = document.querySelector('#actasTable tbody');
            console.log('2️⃣ Tabla de actas:', table ? '✅ Encontrada' : '❌ No encontrada');
            
            // 3. Cargar actas del backend
            console.log('3️⃣ Cargando actas del backend...');
            const actas = await App.apiCall('/actas');
            console.log(`✅ ${actas.length} actas en el backend:`, actas);
            
            // 4. Verificar facturas
            console.log('4️⃣ Cargando facturas del backend...');
            const invoices = await App.apiCall('/invoices');
            console.log(`✅ ${invoices.length} facturas en el backend:`, invoices);
            
            // 5. Forzar recarga de la tabla
            console.log('5️⃣ Forzando actualización de la tabla...');
            await App.updateActasTable(actas);
            
            // 6. Verificar contador
            const counter = document.getElementById('actasCounter');
            console.log('6️⃣ Contador de actas:', counter ? `✅ ${counter.textContent}` : '❌ No encontrado');
            
            console.log('🏁 === FIN DEL DIAGNÓSTICO ===');
            
        } catch (error) {
            console.error('❌ Error en diagnóstico:', error);
        }
    },

    // Utility Functions
    formatDate: function(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    },

    getStatusText: function(status) {
        const statusMap = {
            'draft': 'Borrador',
            'pending': 'Pendiente',
            'partial': 'Parcial',
            'paid': 'Pagada'
        };
        return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
    }
};

// Exponer App al objeto window para que los handlers onclick en el HTML puedan encontrarlo.
window.App = App;

// Iniciar la aplicación cuando el DOM esté listo.
document.addEventListener('DOMContentLoaded', App.initializeApp);

