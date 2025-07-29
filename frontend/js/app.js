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
            // Buscar el acta en la lista actual (más simple que hacer API call)
            const allActas = await App.apiCall('/actas');
            const acta = allActas.find(a => a.id === actaId);
            
            if (!acta) {
                alert('No se encontró el acta');
                return;
            }
            
            // Calcular información básica
            const numGuias = acta.guides ? acta.guides.length : 0;
            const total = acta.guides ? acta.guides.reduce((sum, guide) => sum + (parseFloat(guide.subtotal) || 0), 0) : 0;
            
            // Crear información de guías
            let guidesInfo = '';
            if (acta.guides && acta.guides.length > 0) {
                guidesInfo = acta.guides.map((guide, index) => 
                    `${index + 1}. ${guide.noGuia} - ${guide.nombreCliente} - ${guide.direccion} - ${guide.bultos} bultos - ${guide.pies} pies³ - $${(guide.subtotal || 0).toFixed(2)}`
                ).join('\n');
            } else {
                guidesInfo = 'No hay guías registradas';
            }
            
            // Mostrar información completa en alert (simple y funcional)
            const details = `
DETALLES DEL ACTA
================

📋 INFORMACIÓN GENERAL:
• ID: ${acta.id}
• Fecha: ${App.formatDate(acta.fecha)}
• Ciudad: ${acta.ciudad || 'No especificada'}
• Agente: ${acta.agente || 'No especificado'}

🚛 INFORMACIÓN DEL VEHÍCULO:
• Camión: ${acta.modeloCamion || 'No especificado'} ${acta.anioCamion || ''}
• Placa: ${acta.placaCamion || 'Sin placa'}
• Chofer: ${acta.nombreChofer || 'No especificado'} - ${acta.telefonoChofer || 'Sin teléfono'}
• Ayudante: ${acta.nombreAyudante || 'No especificado'} - ${acta.telefonoAyudante || 'Sin teléfono'}

📦 RESUMEN DE ENVÍOS:
• Total de guías: ${numGuias}
• Total general: $${total.toFixed(2)}

📋 DETALLE DE GUÍAS:
${guidesInfo}
            `;
            
            // Mostrar en alert
            alert(details.trim());
            
            // Opción adicional: copiar al portapapeles
            if (navigator.clipboard) {
                try {
                    await navigator.clipboard.writeText(details.trim());
                    console.log('Detalles copiados al portapapeles');
                } catch (err) {
                    console.log('No se pudo copiar al portapapeles');
                }
            }
            
        } catch (error) {
            console.error('Error loading acta details:', error);
            alert('Error al cargar los detalles del acta: ' + error.message);
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
• IVA (${(invoice.taxRate * 100).toFixed(0)}%): $${invoice.tax.toFixed(2)}
• TOTAL: $${invoice.total.toFixed(2)}

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
        try {
            const simpleActa = {
                fecha: new Date().toISOString().split('T')[0],
                ciudad: 'Miami',
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
                ciudad: 'Miami',
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

