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

    // Test del flujo completo: Acta → Factura → Pago
    testFullPaymentFlow: async function() {
        try {
            alert('🧪 Iniciando test completo: Acta → Factura → Pago');
            
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

