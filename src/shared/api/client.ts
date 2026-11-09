/**
 * Cliente API tipado para comunicação com o backend
 * Substitui o api.js anterior com TypeScript e melhor tipagem
 */

import type {
  User,
  Cliente,
  Categoria,
  Produto,
  Pedido,
  EnderecoEntrega,
  FormaPagamento,
  HorarioFuncionamento,
  ConfigEntrega,
  NotificacaoPush,
  PaginatedResponse,
  AuthTokens,
  ClienteAuthTokens,
} from '@types';

const API_BASE = '/api';

class ApiClient {
  private baseUrl: string;
  private adminToken: string | null = null;
  private adminUser: User | null = null;
  private clienteToken: string | null = null;
  private clienteUser: Cliente | null = null;

  constructor(baseUrl = API_BASE) {
    this.baseUrl = baseUrl;
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    this.adminToken = localStorage.getItem('auth_token');
    const adminUser = localStorage.getItem('auth_user');
    this.adminUser = adminUser ? JSON.parse(adminUser) : null;

    this.clienteToken = localStorage.getItem('cliente_token');
    const clienteUser = localStorage.getItem('cliente_user');
    this.clienteUser = clienteUser ? JSON.parse(clienteUser) : null;
  }

  // ===== ADMIN AUTH =====
  setAdminAuth(token: string, user: User): void {
    this.adminToken = token;
    this.adminUser = user;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }

  clearAdminAuth(): void {
    this.adminToken = null;
    this.adminUser = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }

  isAdminAuthenticated(): boolean {
    return !!this.adminToken;
  }

  getAdminUser(): User | null {
    return this.adminUser;
  }

  // ===== CLIENTE AUTH =====
  setClienteAuth(token: string, user: Cliente): void {
    this.clienteToken = token;
    this.clienteUser = user;
    localStorage.setItem('cliente_token', token);
    localStorage.setItem('cliente_user', JSON.stringify(user));
  }

  clearClienteAuth(): void {
    this.clienteToken = null;
    this.clienteUser = null;
    localStorage.removeItem('cliente_token');
    localStorage.removeItem('cliente_user');
  }

  isClienteAuthenticated(): boolean {
    return !!this.clienteToken;
  }

  getClienteUser(): Cliente | null {
    return this.clienteUser;
  }

  // Get current auth header based on context
  private getAuthHeader(): string | null {
    if (this.clienteToken) return `Bearer ${this.clienteToken}`;
    if (this.adminToken) return `Bearer ${this.adminToken}`;
    return null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const authHeader = this.getAuthHeader();
    if (authHeader) {
      (headers as Record<string, string>)['Authorization'] = authHeader;
    }

    const config: RequestInit = {
      ...options,
      headers,
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
            window.location.href = '/cadastro.html';
          } else if (this.adminToken && !endpoint.startsWith('/clientes')) {
            this.clearAdminAuth();
            window.location.href = '/admin-login.html';
          }
        }
        throw new Error(data.error || `Erro ${response.status}`);
      }

      return data;
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Erro desconhecido na requisição');
    }
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'POST', body: data });
  }

  put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, { method: 'PUT', body: data });
  }

  delete<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // ===== CATEGORIAS =====
  async getCategorias(ativo = true): Promise<Categoria[]> {
    return this.get<Categoria[]>(`/categorias?ativo=${ativo}`);
  }

  async getCategoriasAdmin(params: Record<string, string> = {}): Promise<PaginatedResponse<Categoria>> {
    const query = new URLSearchParams(params).toString();
    return this.get<PaginatedResponse<Categoria>>(`/categorias?${query}`);
  }

  async getCategoria(id: number): Promise<Categoria> {
    return this.get<Categoria>(`/categorias/${id}`);
  }

  async createCategoria(data: Partial<Categoria>): Promise<Categoria> {
    return this.post<Categoria>('/categorias', data);
  }

  async updateCategoria(id: number, data: Partial<Categoria>): Promise<Categoria> {
    return this.put<Categoria>(`/categorias/${id}`, data);
  }

  async deleteCategoria(id: number): Promise<void> {
    return this.delete<void>(`/categorias/${id}`);
  }

  // ===== PRODUTOS =====
  async getProdutos(params: Record<string, string | number | boolean> = {}): Promise<PaginatedResponse<Produto>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => query.append(k, String(v)));
    return this.get<PaginatedResponse<Produto>>(`/produtos?${query}`);
  }

  async getProdutosAdmin(params: Record<string, string | number | boolean> = {}): Promise<PaginatedResponse<Produto>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => query.append(k, String(v)));
    return this.get<PaginatedResponse<Produto>>(`/produtos/admin?${query}`);
  }

  async getProduto(id: number): Promise<Produto> {
    return this.get<Produto>(`/produtos/${id}`);
  }

  async createProduto(data: Partial<Produto>): Promise<Produto> {
    return this.post<Produto>('/produtos', data);
  }

  async updateProduto(id: number, data: Partial<Produto>): Promise<Produto> {
    return this.put<Produto>(`/produtos/${id}`, data);
  }

  async deleteProduto(id: number): Promise<void> {
    return this.delete<void>(`/produtos/${id}`);
  }

  // ===== PERSONALIZAÇÕES =====
  async getPersonalizacoes(produtoId: number): Promise<Produto['personalizacoes']> {
    return this.get(`/produtos/${produtoId}/personalizacoes`);
  }

  async getGruposPersonalizacao(produtoId: number): Promise<Produto['personalizacoes']> {
    return this.get(`/produtos/${produtoId}/personalizacoes/grupos`);
  }

  async createGrupoPersonalizacao(produtoId: number, data: unknown): Promise<unknown> {
    return this.post(`/produtos/${produtoId}/personalizacoes/grupos`, data);
  }

  async updateGrupoPersonalizacao(id: number, data: unknown): Promise<unknown> {
    return this.put(`/personalizacoes/grupos/${id}`, data);
  }

  async deleteGrupoPersonalizacao(id: number): Promise<void> {
    return this.delete(`/personalizacoes/grupos/${id}`);
  }

  async getOpcoesPersonalizacao(grupoId: number): Promise<unknown> {
    return this.get(`/personalizacoes/grupos/${grupoId}/opcoes`);
  }

  async createOpcaoPersonalizacao(grupoId: number, data: unknown): Promise<unknown> {
    return this.post(`/personalizacoes/grupos/${grupoId}/opcoes`, data);
  }

  async updateOpcaoPersonalizacao(id: number, data: unknown): Promise<unknown> {
    return this.put(`/personalizacoes/opcoes/${id}`, data);
  }

  async deleteOpcaoPersonalizacao(id: number): Promise<void> {
    return this.delete(`/personalizacoes/opcoes/${id}`);
  }

  // ===== HORÁRIOS =====
  async getHorarios(): Promise<HorarioFuncionamento[]> {
    return this.get<HorarioFuncionamento[]>('/horarios');
  }

  async getStatusFuncionamento(): Promise<{ aberto: boolean; horario_atual?: string; dia_semana?: string }> {
    return this.get('/horarios/status');
  }

  async createHorario(data: Partial<HorarioFuncionamento>): Promise<HorarioFuncionamento> {
    return this.post<HorarioFuncionamento>('/horarios', data);
  }

  async updateHorario(id: number, data: Partial<HorarioFuncionamento>): Promise<HorarioFuncionamento> {
    return this.put<HorarioFuncionamento>(`/horarios/${id}`, data);
  }

  async deleteHorario(id: number): Promise<void> {
    return this.delete<void>(`/horarios/${id}`);
  }

  // ===== ENTREGA =====
  async getConfigEntrega(): Promise<ConfigEntrega> {
    return this.get<ConfigEntrega>('/entrega/config');
  }

  async updateConfigEntrega(data: Partial<ConfigEntrega>): Promise<ConfigEntrega> {
    return this.put<ConfigEntrega>('/entrega/config', data);
  }

  // ===== PAGAMENTOS =====
  async getFormasPagamento(ativo = true): Promise<FormaPagamento[]> {
    return this.get<FormaPagamento[]>(`/pagamentos?ativo=${ativo}`);
  }

  async createFormaPagamento(data: Partial<FormaPagamento>): Promise<FormaPagamento> {
    return this.post<FormaPagamento>('/pagamentos', data);
  }

  async updateFormaPagamento(id: number, data: Partial<FormaPagamento>): Promise<FormaPagamento> {
    return this.put<FormaPagamento>(`/pagamentos/${id}`, data);
  }

  async deleteFormaPagamento(id: number): Promise<void> {
    return this.delete<void>(`/pagamentos/${id}`);
  }

  // ===== PEDIDOS =====
  async createPedido(data: unknown): Promise<Pedido> {
    return this.post<Pedido>('/pedidos', data);
  }

  async getPedidos(params: Record<string, string | number | boolean> = {}): Promise<PaginatedResponse<Pedido>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => query.append(k, String(v)));
    return this.get<PaginatedResponse<Pedido>>(`/pedidos?${query}`);
  }

  async getMeusPedidos(params: Record<string, string | number | boolean> = {}): Promise<PaginatedResponse<Pedido>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => query.append(k, String(v)));
    return this.get<PaginatedResponse<Pedido>>(`/pedidos/minhas?${query}`);
  }

  async getPedidosAdmin(params: Record<string, string | number | boolean> = {}): Promise<PaginatedResponse<Pedido>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => query.append(k, String(v)));
    return this.get<PaginatedResponse<Pedido>>(`/pedidos/admin?${query}`);
  }

  async getPedidoById(id: number): Promise<Pedido> {
    return this.get<Pedido>(`/pedidos/${id}`);
  }

  async getPedidoByNumero(numero: string): Promise<Pedido> {
    return this.get<Pedido>(`/pedidos/numero/${numero}`);
  }

  async updatePedidoStatus(id: number, status: Pedido['status']): Promise<Pedido> {
    return this.put<Pedido>(`/pedidos/${id}/status`, { status });
  }

  // ===== AUTENTICAÇÃO ADMIN =====
  async adminLogin(email: string, senha: string): Promise<AuthTokens> {
    return this.post<AuthTokens>('/auth/login', { email, senha });
  }

  async adminVerify(): Promise<User> {
    return this.get<User>('/auth/verify');
  }

  async adminRegister(data: Partial<User>): Promise<User> {
    return this.post<User>('/auth/register', data);
  }

  async adminChangePassword(data: { senhaAtual: string; novaSenha: string }): Promise<void> {
    return this.put<void>('/auth/password', data);
  }

  async getUsuariosAdmin(params: Record<string, string | number | boolean> = {}): Promise<PaginatedResponse<User>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => query.append(k, String(v)));
    return this.get<PaginatedResponse<User>>(`/auth/usuarios?${query}`);
  }

  async updateUsuarioAdmin(id: number, data: Partial<User>): Promise<User> {
    return this.put<User>(`/auth/usuarios/${id}`, data);
  }

  async createUsuarioAdmin(data: Partial<User>): Promise<User> {
    return this.post<User>('/auth/register', data);
  }

  async deleteUsuarioAdmin(id: number): Promise<void> {
    return this.delete<void>(`/auth/usuarios/${id}`);
  }

  // ===== CLIENTES =====
  async clienteRegister(data: Partial<Cliente>): Promise<ClienteAuthTokens> {
    return this.post<ClienteAuthTokens>('/clientes/register', data);
  }

  async clienteLogin(email: string, senha: string): Promise<ClienteAuthTokens> {
    return this.post<ClienteAuthTokens>('/clientes/login', { email, senha });
  }

  async getClientePerfil(): Promise<Cliente> {
    return this.get<Cliente>('/clientes/perfil');
  }

  async updateClientePerfil(data: Partial<Cliente>): Promise<Cliente> {
    return this.put<Cliente>('/clientes/perfil', data);
  }

  async alterarClienteSenha(data: { senhaAtual: string; novaSenha: string }): Promise<void> {
    return this.put<void>('/clientes/senha', data);
  }

  async getClienteEnderecos(): Promise<EnderecoEntrega[]> {
    return this.get<EnderecoEntrega[]>('/clientes/enderecos');
  }

  async criarClienteEndereco(data: Partial<EnderecoEntrega>): Promise<EnderecoEntrega> {
    return this.post<EnderecoEntrega>('/clientes/enderecos', data);
  }

  async atualizarClienteEndereco(id: number, data: Partial<EnderecoEntrega>): Promise<EnderecoEntrega> {
    return this.put<EnderecoEntrega>(`/clientes/enderecos/${id}`, data);
  }

  async excluirClienteEndereco(id: number): Promise<void> {
    return this.delete<void>(`/clientes/enderecos/${id}`);
  }

  // ===== NOTIFICAÇÕES PUSH =====
  async getVapidPublicKey(): Promise<{ publicKey: string }> {
    return this.get<{ publicKey: string }>('/notificacoes/vapid-public-key');
  }

  async subscribeToPush(subscription: PushSubscription): Promise<void> {
    return this.post<void>('/notificacoes/subscribe', subscription);
  }

  async unsubscribeFromPush(endpoint: string): Promise<void> {
    return this.delete<void>('/notificacoes/subscribe', { endpoint });
  }

  async getPushSubscriptions(): Promise<NotificacaoPush[]> {
    return this.get<NotificacaoPush[]>('/notificacoes/subscriptions');
  }

  // ===== FIDELIDADE =====
  async getFidelidadeResumo(): Promise<{ pontos_atuais: number; total_acumulado: number; total_resgatado: number; nivel: string; proximo_nivel?: { nome: string; pontos_necessarios: number } }> {
    return this.get('/fidelidade/resumo');
  }

  async getFidelidadeHistorico(): Promise<Array<{ id: number; tipo: string; pontos: number; descricao: string; pedido_id?: number; pedido_numero?: string; recompensa_id?: number; recompensa_nome?: string; created_at: string }>> {
    return this.get('/fidelidade/historico');
  }

  async getFidelidadeRecompensas(): Promise<Array<{ id: number; nome: string; descricao: string; pontos_custo: number; tipo: string; valor_desconto?: number; produto_id?: number; produto_nome?: string; ativo: boolean; estoque?: number; imagem_url?: string }>> {
    return this.get('/fidelidade/recompensas');
  }

  async resgatarRecompensa(data: { recompensa_id: number; quantidade: number }): Promise<void> {
    return this.post<void>('/fidelidade/resgatar', data);
  }
}

// Export singleton instance
export const api = new ApiClient();
export default api;