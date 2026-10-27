/**
 * Cliente API para comunicação com o backend
 */
class ApiClient {
    constructor() {
        this.baseUrl = '/api';
        this.token = localStorage.getItem('auth_token') || null;
        this.user = JSON.parse(localStorage.getItem('auth_user') || 'null');
        this.clienteToken = localStorage.getItem('cliente_token') || null;
        this.clienteUser = JSON.parse(localStorage.getItem('cliente_user') || 'null');
    }

    // ===== ADMIN AUTH =====
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

    // ===== CLIENTE AUTH =====
    setClienteAuth(token, user) {
        this.clienteToken = token;
        this.clienteUser = user;
        localStorage.setItem('cliente_token', token);
        localStorage.setItem('cliente_user', JSON.stringify(user));
    }

    clearClienteAuth() {
        this.clienteToken = null;
        this.clienteUser = null;
        localStorage.removeItem('cliente_token');
        localStorage.removeItem('cliente_user');
    }

    isClienteAuthenticated() {
        return !!this.clienteToken;
    }

    getClienteUser() {
        return this.clienteUser;
    }

    // Get current auth header based on context
    getAuthHeader() {
        if (this.clienteToken) {
            return `Bearer ${this.clienteToken}`;
        }
        if (this.token) {
            return `Bearer ${this.token}`;
        }
        return null;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        const authHeader = this.getAuthHeader();
        if (authHeader) {
            headers['Authorization'] = authHeader;
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
                // Handle 401 for both admin and cliente
                if (response.status === 401) {
                    if (this.clienteToken && endpoint.startsWith('/clientes')) {
                        this.clearClienteAuth();
                        window.location.href = '/inicio/index.html';
                    } else if (this.token && !endpoint.startsWith('/clientes')) {
                        this.clearAuth();
                        window.location.href = '/inicio/admin-login.html';
                    }
                }
                throw new Error(data.error || `Erro ${response.status}`);
            }

            return data;
        } catch (error) {
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

    async getCategoriasAdmin(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/categorias?${query}`);
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

    async getProdutosAdmin(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/produtos/admin?${query}`);
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

    async getGruposPersonalizacao(produtoId) {
        return this.get(`/produtos/${produtoId}/personalizacoes/grupos`);
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

    async getOpcoesPersonalizacao(grupoId) {
        return this.get(`/personalizacoes/grupos/${grupoId}/opcoes`);
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

    async getMeusPedidos(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/pedidos/minhas?${query}`);
    }

    async getPedidosAdmin(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/pedidos/admin?${query}`);
    }

    async getPedidoById(id) {
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

    async getUsuariosAdmin(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/auth/usuarios?${query}`);
    }

    async updateUsuarioAdmin(id, data) {
        return this.put(`/auth/usuarios/${id}`, data);
    }

    async createUsuarioAdmin(data) {
        return this.post('/auth/register', data);
    }

    async deleteUsuarioAdmin(id) {
        return this.delete(`/auth/usuarios/${id}`);
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

    async alterarClienteSenha(data) {
        return this.put('/clientes/senha', data);
    }

    async changeClientePassword(data) {
        return this.put('/clientes/senha', data);
    }

    async getClienteEnderecos() {
        return this.get('/clientes/enderecos');
    }

    async getEnderecos() {
        return this.get('/clientes/enderecos');
    }

    async criarClienteEndereco(data) {
        return this.post('/clientes/enderecos', data);
    }

    async createEndereco(data) {
        return this.post('/clientes/enderecos', data);
    }

    async atualizarClienteEndereco(id, data) {
        return this.put(`/clientes/enderecos/${id}`, data);
    }

    async updateEndereco(id, data) {
        return this.put(`/clientes/enderecos/${id}`, data);
    }

    async excluirClienteEndereco(id) {
        return this.delete(`/clientes/enderecos/${id}`);
    }

    async deleteEndereco(id) {
        return this.delete(`/clientes/enderecos/${id}`);
    }

    async getProdutoById(id) {
        return this.get(`/produtos/${id}`);
    }
}

const api = new ApiClient();
export default api;