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
        loginForm.addEventListener('submit', App.handleLogin);
        document.getElementById('logoutBtn').addEventListener('click', App.handleLogout);
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.dataset.section;
                App.showSection(section);
            });
        });
        document.getElementById('filterCiudad').addEventListener('change', App.applyActasFilters);
        document.getElementById('filterAgente').addEventListener('change', App.applyActasFilters);
        document.getElementById('clearFiltersBtn').addEventListener('click', App.clearActasFilters);
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', App.closeModals);
        });
        document.getElementById('actaForm').addEventListener('submit', App.handleActaSubmit);
        document.getElementById('cancelActaBtn').addEventListener('click', App.closeModals);
        document.getElementById('addGuideBtn').addEventListener('click', () => App.addGuideRow());
        document.getElementById('paymentForm').addEventListener('submit', App.handlePaymentSubmit);
        document.getElementById('saveCityRatesBtn').addEventListener('click', App.saveCityRates);
        document.getElementById('addCityForm').addEventListener('submit', App.handleAddCity);
        document.getElementById('addAgentForm').addEventListener('submit', App.handleAddAgent);
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    App.closeModals();
                }
            });
        });
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
        
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(error.message || `API Error: ${response.statusText}`);
        }
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        } else {
            return response.text();
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
            App.loadAgents(); // Recargar la lista de agentes
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
                App.loadAgents(); // Recargar la lista de agentes
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
            const filterCiudad = document.getElementById('filterCiudad').value;
            const filterAgente = document.getElementById('filterAgente').value;

            let filteredActas = allActas;
            if (filterCiudad) {
                filteredActas = filteredActas.filter(acta => acta.ciudad === filterCiudad);
            }
            if (filterAgente) {
                filteredActas = filteredActas.filter(acta => acta.agente === filterAgente);
            }

            App.updateActasTable(filteredActas);
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
        document.getElementById('filterCiudad').value = '';
        document.getElementById('filterAgente').value = '';
        App.loadActas(); // Reload actas to show all
    },

    updateActasTable: function(actas) {
        const tbody = document.querySelector('#actasTable tbody');
        tbody.innerHTML = '';

        actas.forEach(acta => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${App.formatDate(acta.fecha)}</td>
                <td>${acta.ciudad || '-'}</td>
                <td>${acta.agente || '-'}</td>
                <td><span class="status-badge status-${acta.status}">${App.getStatusText(acta.status)}</span></td>
                <td class="actions">
                    <button class="btn btn-secondary" onclick="App.editActa('${acta.id}')"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn btn-success" onclick="App.generateInvoice('${acta.id}')"><i class="fas fa-receipt"></i> Facturar</button>
                </td>
            `;
        });
    },

    showNewActaModal: function() {
        // Asegurar que el loading overlay esté cerrado antes de mostrar el modal
        App.showLoading(false);

        // Forzar la actualización del selector de ciudades justo antes de mostrar el modal
        App.updateCitySelects();

        currentActa = null;
        document.getElementById('actaModalTitle').textContent = 'Nueva Acta de Despacho';
        document.getElementById('actaForm').reset();
        document.querySelector('#guidesTable tbody').innerHTML = '';
        App.updateTotal();
        document.getElementById('actaModal').classList.add('active');
    },

    editActa: async function(actaId) {
        try {
            const acta = await App.apiCall(`/actas/${actaId}`);
            currentActa = acta;
            
            if (currentActa) {
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
        
        const formData = new FormData(e.target);
        const actaData = Object.fromEntries(formData.entries());
        
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
            const method = currentActa ? 'PUT' : 'POST';
            const endpoint = currentActa ? `/actas/${currentActa.id}` : '/actas';
            await App.apiCall(endpoint, { method, body: JSON.stringify(actaData) });
            
            App.closeModals();
            App.loadActas();
            App.loadDashboard();
            alert('Acta guardada exitosamente');
        } catch (error) {
            console.error('Error saving acta:', error);
            alert('Error al guardar acta');
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

