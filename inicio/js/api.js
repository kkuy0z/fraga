/**
 * Cliente API para comunicação com o backend
 */
class ApiClient {
    constructor() {
        this.baseUrl = '/api';
        this.token = localStorage.getItem('auth_token') || null;
        this.user = JSON.parse(localStorage.getItem('auth_user') || 'null');
    }

    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
    }

    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    }

    isAuthenticated() {
        return !!this.token;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const config = {
            ...options,
            headers
        };

        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Erro ${response.status}`);
            }

            return data;
        } catch (error) {
            if (error.message.includes('401') || error.message.includes('Token')) {
                this.clearAuth();
                window.location.href = '/admin-login.html';
            }
            throw error;
        }
    }

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    post(endpoint, data) {
        return this.request(endpoint, { method: 'POST', body: data });
    }

    put(endpoint, data) {
        return this.request(endpoint, { method: 'PUT', body: data });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // ===== CATEGORIAS =====
    async getCategorias(ativo = true) {
        return this.get(`/categorias?ativo=${ativo}`);
    }

    async getCategoria(id) {
        return this.get(`/categorias/${id}`);
    }

    async createCategoria(data) {
        return this.post('/categorias', data);
    }

    async updateCategoria(id, data) {
        return this.put(`/categorias/${id}`, data);
    }

    async deleteCategoria(id) {
        return this.delete(`/categorias/${id}`);
    }

    // ===== PRODUTOS =====
    async getProdutos(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/produtos?${query}`);
    }

    async getProduto(id) {
        return this.get(`/produtos/${id}`);
    }

    async createProduto(data) {
        return this.post('/produtos', data);
    }

    async updateProduto(id, data) {
        return this.put(`/produtos/${id}`, data);
    }

    async deleteProduto(id) {
        return this.delete(`/produtos/${id}`);
    }

    // ===== PERSONALIZAÇÕES =====
    async getPersonalizacoes(produtoId) {
        return this.get(`/produtos/${produtoId}/personalizacoes`);
    }

    async createGrupoPersonalizacao(produtoId, data) {
        return this.post(`/produtos/${produtoId}/personalizacoes/grupos`, data);
    }

    async updateGrupoPersonalizacao(id, data) {
        return this.put(`/personalizacoes/grupos/${id}`, data);
    }

    async deleteGrupoPersonalizacao(id) {
        return this.delete(`/personalizacoes/grupos/${id}`);
    }

    async createOpcaoPersonalizacao(grupoId, data) {
        return this.post(`/personalizacoes/grupos/${grupoId}/opcoes`, data);
    }

    async updateOpcaoPersonalizacao(id, data) {
        return this.put(`/personalizacoes/opcoes/${id}`, data);
    }

    async deleteOpcaoPersonalizacao(id) {
        return this.delete(`/personalizacoes/opcoes/${id}`);
    }

    // ===== HORÁRIOS =====
    async getHorarios() {
        return this.get('/horarios');
    }

    async getStatusFuncionamento() {
        return this.get('/horarios/status');
    }

    async createHorario(data) {
        return this.post('/horarios', data);
    }

    async updateHorario(id, data) {
        return this.put(`/horarios/${id}`, data);
    }

    async deleteHorario(id) {
        return this.delete(`/horarios/${id}`);
    }

    // ===== ENTREGA =====
    async getConfigEntrega() {
        return this.get('/entrega/config');
    }

    async updateConfigEntrega(data) {
        return this.put('/entrega/config', data);
    }

    // ===== PAGAMENTOS =====
    async getFormasPagamento(ativo = true) {
        return this.get(`/pagamentos?ativo=${ativo}`);
    }

    async createFormaPagamento(data) {
        return this.post('/pagamentos', data);
    }

    async updateFormaPagamento(id, data) {
        return this.put(`/pagamentos/${id}`, data);
    }

    async deleteFormaPagamento(id) {
        return this.delete(`/pagamentos/${id}`);
    }

    // ===== PEDIDOS =====
    async createPedido(data) {
        return this.post('/pedidos', data);
    }

    async getPedidos(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/pedidos?${query}`);
    }

    async getPedido(id) {
        return this.get(`/pedidos/${id}`);
    }

    async getPedidoByNumero(numero) {
        return this.get(`/pedidos/numero/${numero}`);
    }

    async updatePedidoStatus(id, status) {
        return this.put(`/pedidos/${id}/status`, { status });
    }

    // ===== AUTENTICAÇÃO ADMIN =====
    async adminLogin(email, senha) {
        return this.post('/auth/login', { email, senha });
    }

    async adminVerify() {
        return this.get('/auth/verify');
    }

    async adminRegister(data) {
        return this.post('/auth/register', data);
    }

    async adminChangePassword(data) {
        return this.put('/auth/password', data);
    }

    // ===== CLIENTES =====
    async clienteRegister(data) {
        return this.post('/clientes/register', data);
    }

    async clienteLogin(email, senha) {
        return this.post('/clientes/login', { email, senha });
    }

    async getClientePerfil() {
        return this.get('/clientes/perfil');
    }

    async updateClientePerfil(data) {
        return this.put('/clientes/perfil', data);
    }

    async changeClientePassword(data) {
        return this.put('/clientes/senha', data);
    }

    async getEnderecos() {
        return this.get('/clientes/enderecos');
    }

    async createEndereco(data) {
        return this.post('/clientes/enderecos', data);
    }

    async updateEndereco(id, data) {
        return this.put(`/clientes/enderecos/${id}`, data);
    }

    async deleteEndereco(id) {
        return this.delete(`/clientes/enderecos/${id}`);
    }
}

const api = new ApiClient();
export default api;