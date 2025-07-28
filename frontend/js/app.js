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

        // Actas - Con debugging adicional
        const newActaBtn = document.getElementById('newActaBtn');
        if (newActaBtn) {
            console.log('✅ Botón Nueva Acta encontrado, configurando event listener...');
            newActaBtn.addEventListener('click', function(e) {
                console.log('🖱️ Botón Nueva Acta clickeado!');
                e.preventDefault();
                App.showNewActaModal();
            });
            console.log('✅ Event listener del botón Nueva Acta configurado');
        } else {
            console.error('❌ Botón Nueva Acta (newActaBtn) NO encontrado en el DOM');
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

    showMainScreen: async function() { // Make async
        loginScreen.classList.remove('active');
        mainScreen.classList.add('active');
        
        document.body.classList.toggle('admin', currentUser.role === 'admin');
        
        document.getElementById('userInfo').textContent = 
            `${currentUser.name} (${currentUser.role === 'admin' ? 'Administrador' : 'Courier'})`;
        
        // Configurar event listeners de la pantalla principal
        App.setupMainScreenListeners();
        
        // Cargar datos esenciales al iniciar la pantalla principal
        await App.loadCityRates(); // Cargar tarifas de ciudades
        
        App.showSection('dashboard'); // Mostrar el dashboard después de cargar los datos
    },

    showSection: function(sectionName) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionName);
        });
        
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.toggle('active', section.id === `${sectionName}Section`);
        });
        
        switch(sectionName) {
            case 'dashboard': App.loadDashboard(); break;
            case 'actas': App.loadActas(); break;
            case 'invoices': App.loadInvoices(); break;
            case 'payments': App.loadPayments(); break;
            case 'settings': App.loadSettings(); break;
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
            const stats = await App.apiCall('/dashboard');
            document.getElementById('totalActas').textContent = stats.totalActas;
            document.getElementById('totalInvoices').textContent = stats.totalInvoices;
            document.getElementById('totalBilled').textContent = `$${stats.totalBilled.toFixed(2)}`;
            document.getElementById('totalCollected').textContent = `$${stats.totalCollected.toFixed(2)}`;
            document.getElementById('pendingBalance').textContent = `$${stats.pendingBalance.toFixed(2)}`;
        } catch (error) {
            console.error('Error loading dashboard:', error);
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

    // Actas Management
    loadActas: async function() {
        try {
            const allActas = await App.apiCall('/actas');
            
            // Populate filter dropdowns
            App.populateFilterDropdowns(allActas);

            // Apply current filters
            const filterFechaDesde = document.getElementById('filterFechaDesde').value;
            const filterFechaHasta = document.getElementById('filterFechaHasta').value;
            const filterCiudad = document.getElementById('filterCiudad').value;
            const filterAgente = document.getElementById('filterAgente').value;

            let filteredActas = allActas;
            
            // Filtro por fecha desde
            if (filterFechaDesde) {
                filteredActas = filteredActas.filter(acta => {
                    const actaDate = new Date(acta.fecha);
                    const fromDate = new Date(filterFechaDesde);
                    return actaDate >= fromDate;
                });
            }
            
            // Filtro por fecha hasta
            if (filterFechaHasta) {
                filteredActas = filteredActas.filter(acta => {
                    const actaDate = new Date(acta.fecha);
                    const toDate = new Date(filterFechaHasta);
                    return actaDate <= toDate;
                });
            }
            
            // Filtro por ciudad
            if (filterCiudad) {
                filteredActas = filteredActas.filter(acta => acta.ciudad === filterCiudad);
            }
            
            // Filtro por agente
            if (filterAgente) {
                filteredActas = filteredActas.filter(acta => acta.agente === filterAgente);
            }

            // Ordenar por fecha (más recientes primero)
            filteredActas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

            await App.updateActasTable(filteredActas);
            
            // Mostrar contador de resultados
            document.getElementById('actasCounter').textContent = 
                `${filteredActas.length} de ${allActas.length} actas`;
        } catch (error) {
            console.error('Error loading actas:', error);
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
        const tbody = document.querySelector('#actasTable tbody');
        tbody.innerHTML = '';

        // Cargar facturas para mostrar información relacionada
        let invoices = [];
        try {
            invoices = await App.apiCall('/invoices');
        } catch (error) {
            console.warn('No se pudieron cargar las facturas para mostrar en actas');
        }

        actas.forEach(acta => {
            // Buscar la factura relacionada con esta acta
            const invoice = invoices.find(inv => inv.actaId === acta.id);
            
            // Calcular número de guías y total
            const numGuias = acta.guides ? acta.guides.length : 0;
            const total = acta.guides ? acta.guides.reduce((sum, guide) => sum + (parseFloat(guide.subtotal) || 0), 0) : 0;
            
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
    },

    showNewActaModal: async function() {
        console.log('🚀 Abriendo modal de Nueva Acta...');
        
        // Verificar que el modal existe
        const modal = document.getElementById('actaModal');
        if (!modal) {
            console.error('❌ Modal actaModal no encontrado en el DOM');
            alert('Error: No se pudo abrir el modal. Revisa la consola para más detalles.');
            return;
        }

        // Asegurar que el loading overlay esté cerrado antes de mostrar el modal
        App.showLoading(false);

        // Forzar la actualización de selectores justo antes de mostrar el modal
        App.updateCitySelects();
        
        // Cargar y actualizar la lista de agentes más reciente
        try {
            console.log('📥 Cargando agentes...');
            const agents = await App.apiCall('/agents');
            App.updateAgentSelects(agents);
            console.log('✅ Agentes cargados:', agents.length);
        } catch (error) {
            console.error('❌ Error loading agents for modal:', error);
        }

        currentActa = null;
        document.getElementById('actaModalTitle').textContent = 'Nueva Acta de Despacho';
        document.getElementById('actaForm').reset();
        
        const guidesTableBody = document.querySelector('#guidesTable tbody');
        if (guidesTableBody) {
            guidesTableBody.innerHTML = '';
        }
        
        App.updateTotal();
        modal.classList.add('active');
        console.log('✅ Modal abierto correctamente');
    },

    viewActaDetails: async function(actaId) {
        try {
            const acta = await App.apiCall(`/actas/${actaId}`);
            
            // Buscar la factura relacionada
            let invoice = null;
            try {
                const invoices = await App.apiCall('/invoices');
                invoice = invoices.find(inv => inv.actaId === actaId);
            } catch (error) {
                console.warn('No se pudo cargar información de factura');
            }
            
            // Crear el contenido del modal de detalles
            const total = acta.guides ? acta.guides.reduce((sum, guide) => sum + (parseFloat(guide.subtotal) || 0), 0) : 0;
            const guidesHTML = acta.guides ? acta.guides.map(guide => `
                <tr>
                    <td>${guide.noGuia}</td>
                    <td>${guide.nombreCliente}</td>
                    <td>${guide.direccion}</td>
                    <td>${guide.telefono}</td>
                    <td>${guide.bultos}</td>
                    <td>${guide.pies}</td>
                    <td>${guide.kgs}</td>
                    <td>${guide.via}</td>
                    <td>$${(guide.subtotal || 0).toFixed(2)}</td>
                </tr>
            `).join('') : '<tr><td colspan="9">No hay guías registradas</td></tr>';
            
            const detailsHTML = `
                <div class="acta-details">
                    <div class="details-header">
                        <h3>Acta de Despacho - ${App.formatDate(acta.fecha)}</h3>
                        <p><strong>ID:</strong> ${acta.id}</p>
                        ${invoice ? `<p><strong>Factura:</strong> #${invoice.number || invoice.id} - ${App.getStatusText(invoice.status)}</p>` : '<p><strong>Factura:</strong> <span class="text-warning">Pendiente de generación</span></p>'}
                    </div>
                    
                    <div class="details-info">
                        <div class="info-row">
                            <div class="info-col">
                                <strong>Ciudad:</strong> ${acta.ciudad || 'No especificada'}
                            </div>
                            <div class="info-col">
                                <strong>Agente:</strong> ${acta.agente || 'No especificado'}
                            </div>
                        </div>
                        
                        <div class="info-row">
                            <div class="info-col">
                                <strong>Camión:</strong> ${acta.modeloCamion || 'No especificado'} ${acta.anioCamion || ''} - ${acta.placaCamion || 'Sin placa'}
                            </div>
                        </div>
                        
                        <div class="info-row">
                            <div class="info-col">
                                <strong>Chofer:</strong> ${acta.nombreChofer || 'No especificado'} - ${acta.telefonoChofer || 'Sin teléfono'}
                            </div>
                            <div class="info-col">
                                <strong>Ayudante:</strong> ${acta.nombreAyudante || 'No especificado'} - ${acta.telefonoAyudante || 'Sin teléfono'}
                            </div>
                        </div>
                    </div>
                    
                    <div class="details-guides">
                        <h4>Guías de Envío</h4>
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>N° Guía</th>
                                    <th>Cliente</th>
                                    <th>Dirección</th>
                                    <th>Teléfono</th>
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
                            <tfoot>
                                <tr class="total-row">
                                    <th colspan="8">TOTAL GENERAL:</th>
                                    <th>$${total.toFixed(2)}</th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            `;
            
            // Mostrar en un modal o alert (por ahora usamos alert, luego podemos crear un modal dedicado)
            const newWindow = window.open('', '_blank', 'width=800,height=600');
            newWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Detalles del Acta - ${acta.id}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .acta-details { max-width: 800px; margin: 0 auto; }
                        .details-header { border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
                        .info-row { display: flex; margin-bottom: 10px; }
                        .info-col { flex: 1; margin-right: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f8f9fa; }
                        .total-row th { background-color: #007bff; color: white; }
                        .text-warning { color: #ffc107; }
                        @media print {
                            body { margin: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    ${detailsHTML}
                    <div class="no-print" style="margin-top: 20px; text-align: center;">
                        <button onclick="window.print()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Imprimir</button>
                        <button onclick="window.close()" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">Cerrar</button>
                    </div>
                </body>
                </html>
            `);
            
        } catch (error) {
            console.error('Error loading acta details:', error);
            alert('Error al cargar los detalles del acta');
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
        console.log('📝 Formulario de acta enviado');
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const actaData = Object.fromEntries(formData.entries());
        
        console.log('📋 Datos del formulario:', actaData);
        
        // Validación básica
        if (!actaData.fecha || !actaData.ciudad || !actaData.agente) {
            alert('Por favor, completa todos los campos obligatorios: Fecha, Ciudad y Agente.');
            console.error('❌ Campos obligatorios faltantes:', { 
                fecha: actaData.fecha, 
                ciudad: actaData.ciudad, 
                agente: actaData.agente 
            });
            return;
        }
        
        actaData.guides = [];
        const rows = document.querySelectorAll('#guidesTable tbody tr');
        console.log(`📦 Procesando ${rows.length} filas de guías`);
        
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
        
        console.log(`✅ ${actaData.guides.length} guías válidas procesadas`);
        console.log('🚀 Enviando acta al servidor:', actaData);
        
        try {
            App.showLoading(true);
            const method = currentActa ? 'PUT' : 'POST';
            const endpoint = currentActa ? `/actas/${currentActa.id}` : '/actas';
            console.log(`📡 ${method} ${endpoint}`);
            
            const result = await App.apiCall(endpoint, { method, body: JSON.stringify(actaData) });
            console.log('✅ Acta guardada exitosamente:', result);
            
            // Generar factura automáticamente para actas nuevas
            if (!currentActa && result.id) {
                console.log('🧾 Generando factura automáticamente...');
                try {
                    await App.apiCall('/invoices', {
                        method: 'POST',
                        body: JSON.stringify({ actaId: result.id })
                    });
                    console.log('✅ Factura generada automáticamente');
                } catch (invoiceError) {
                    console.error('❌ Error generando factura automática:', invoiceError);
                    // No fallar si la factura no se puede generar
                }
            }
            
            App.closeModals();
            App.loadActas();
            App.loadInvoices(); // Recargar facturas también
            App.loadDashboard();
            
            const message = currentActa ? 'Acta actualizada exitosamente' : 'Acta creada y factura generada exitosamente';
            alert(message);
        } catch (error) {
            console.error('❌ Error saving acta:', error);
            alert(`Error al guardar acta: ${error.message}`);
        } finally {
            App.showLoading(false);
        }
    },

    // Guides Management
    addGuideRow: function(guide = {}) {
        const tbody = document.querySelector('#guidesTable tbody');
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><input type="text" name="noGuia" required value="${guide.noGuia || ''}"></td>
            <td><input type="text" name="nombreCliente" required value="${guide.nombreCliente || ''}"></td>
            <td><input type="text" name="direccion" required value="${guide.direccion || ''}"></td>
            <td><input type="tel" name="telefono" required value="${guide.telefono || ''}"></td>
            <td><input type="number" name="bultos" required min="1" value="${guide.bultos || '1'}"></td>
            <td><input type="number" name="pies" required min="0.01" step="0.01" onchange="App.updateRowSubtotal(this)" value="${guide.pies || ''}"></td>
            <td><input type="number" name="kgs" required min="0.01" step="0.01" value="${guide.kgs || ''}"></td>
            <td>
                <select name="via" required>
                    <option value="">Seleccionar</option>
                    <option value="aereo" ${guide.via === 'aereo' ? 'selected' : ''}>Aéreo</option>
                    <option value="maritimo" ${guide.via === 'maritimo' ? 'selected' : ''}>Marítimo</option>
                </select>
            </td>
            <td class="subtotal">${(guide.subtotal || 0).toFixed(2)}</td>
            <td class="actions">
                <button type="button" class="btn btn-danger" onclick="App.removeGuideRow(this)"><i class="fas fa-trash"></i></button>
            </td>
        `;
        App.updateTotal();
    },

    removeGuideRow: function(button) {
        button.closest('tr').remove();
        App.updateTotal();
    },

    updateRowSubtotal: function(input) {
        const row = input.closest('tr');
        const pies = parseFloat(input.value) || 0;
        const ciudad = document.querySelector('#actaForm [name="ciudad"]').value;
        const subtotal = App.calculateSubtotal(pies, ciudad);
        
        row.querySelector('.subtotal').textContent = subtotal.toFixed(2);
        App.updateTotal();
    },

    calculateSubtotal: function(pies, ciudad) {
        const rate = cityRates[ciudad] || 0;
        return (parseFloat(pies) || 0) * rate;
    },

    updateTotal: function() {
        const subtotals = document.querySelectorAll('#guidesTable .subtotal');
        let total = 0;
        subtotals.forEach(cell => {
            total += parseFloat(cell.textContent) || 0;
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
        invoices.forEach(invoice => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${invoice.number}</td>
                <td>${App.formatDate(invoice.createdAt)}</td>
                <td>$${invoice.total.toFixed(2)}</td>
                <td><span class="status-badge status-${invoice.status}">${App.getStatusText(invoice.status)}</span></td>
                <td class="actions">
                    <button class="btn btn-primary" onclick="App.showPaymentModal('${invoice.id}')" ${invoice.status === 'paid' ? 'disabled' : ''}><i class="fas fa-credit-card"></i> Pagar</button>
                    <button class="btn btn-secondary" onclick="App.printInvoice('${invoice.id}')"><i class="fas fa-print"></i> Imprimir</button>
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

    printInvoice: function(invoiceId) {
        alert(`Imprimir factura (ID: ${invoiceId}) - funcionalidad no implementada.`);
        console.log('printInvoice called for invoice ID:', invoiceId);
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
        payments.forEach(payment => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${App.formatDate(payment.createdAt)}</td>
                <td>${payment.invoiceId}</td>
                <td>$${payment.amount.toFixed(2)}</td>
                <td>${payment.description || '-'}</td>
            `;
        });
    },

    showPaymentModal: function(invoiceId) {
        // Asegurar que el loading overlay esté cerrado antes de mostrar el modal
        App.showLoading(false);
        document.getElementById('paymentInvoiceId').value = invoiceId;
        document.getElementById('paymentForm').reset();
        document.getElementById('paymentModal').classList.add('active');
    },

    handlePaymentSubmit: async function(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const paymentData = Object.fromEntries(formData.entries());
        
        try {
            await App.apiCall('/payments', {
                method: 'POST',
                body: JSON.stringify(paymentData)
            });
            
            App.closeModals();
            App.loadPayments();
            App.loadInvoices();
            App.loadDashboard();
            alert('Pago registrado exitosamente');
        } catch (error) {
            console.error('Error registering payment:', error);
            alert(`Error al registrar pago: ${error.message}`);
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
        console.log('🧪 Testing creación de acta simple...');
        try {
            const simpleActa = {
                fecha: new Date().toISOString().split('T')[0],
                ciudad: 'Miami',
                agente: 'Test Agent',
                guides: []
            };
            const result = await App.apiCall('/actas', {
                method: 'POST',
                body: JSON.stringify(simpleActa)
            });
            console.log('✅ Acta de prueba creada:', result);
            return result;
        } catch (error) {
            console.error('❌ Error creando acta de prueba:', error);
            throw error;
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

