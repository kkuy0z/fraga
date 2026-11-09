// Shared TypeScript types for Fraga Lanches

export interface User {
  id: number;
  nome: string;
  email: string;
  role: 'administrador' | 'atendente' | 'cozinha' | 'entregador' | 'cliente';
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cliente {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  cpf?: string;
  data_nascimento?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Categoria {
  id: number;
  nome: string;
  descricao?: string;
  imagem_url?: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Produto {
  id: number;
  categoria_id: number;
  categoria_nome?: string;
  nome: string;
  descricao?: string;
  preco_base: number;
  imagem_url?: string;
  disponivel: boolean;
  destaque: boolean;
  ordem: number;
  personalizacoes?: PersonalizacaoGrupo[];
  created_at: string;
  updated_at: string;
}

export interface PersonalizacaoGrupo {
  id: number;
  produto_id: number;
  nome: string;
  tipo: 'escolha_unica' | 'escolha_multipla' | 'adicional';
  obrigatorio: boolean;
  min_selecoes: number;
  max_selecoes: number;
  ordem: number;
  opcoes: PersonalizacaoOpcao[];
}

export interface PersonalizacaoOpcao {
  id: number;
  grupo_id: number;
  nome: string;
  preco_adicional: number;
  ativo: boolean;
  ordem: number;
}

export interface Pedido {
  id: number;
  numero: string;
  cliente_id?: number;
  cliente_nome?: string;
  cliente_telefone?: string;
  cliente_email?: string;
  status: PedidoStatus;
  tipo_entrega: 'entrega' | 'retirada';
  endereco_entrega?: EnderecoEntrega;
  subtotal: number;
  taxa_entrega: number;
  total: number;
  observacoes?: string;
  itens: PedidoItem[];
  created_at: string;
  updated_at: string;
  data_entrega_estimada?: string;
}

export type PedidoStatus =
  | 'pendente'
  | 'confirmado'
  | 'preparo'
  | 'preparando'
  | 'pronto'
  | 'entrega'
  | 'saiu_entrega'
  | 'entregue'
  | 'cancelado';

export interface PedidoItem {
  id: number;
  pedido_id: number;
  produto_id: number;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  personalizacoes: PedidoItemPersonalizacao[];
}

export interface PedidoItemPersonalizacao {
  grupo_id: number;
  grupo_nome: string;
  opcao_id: number;
  opcao_nome: string;
  preco_adicional: number;
}

export interface EnderecoEntrega {
  id?: number;
  cliente_id?: number;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  referencia?: string;
  principal: boolean;
}

export interface FormaPagamento {
  id: number;
  nome: string;
  tipo: 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'outro';
  ativo: boolean;
  aceita_parcelamento: boolean;
  max_parcelas: number;
  taxa_parcelamento: number;
  ordem: number;
}

export interface HorarioFuncionamento {
  id: number;
  dia_semana: number; // 0 = domingo, 6 = sábado
  abertura: string; // HH:MM
  fechamento: string; // HH:MM
  ativo: boolean;
}

export interface ConfigEntrega {
  id: number;
  taxa_entrega: number;
  valor_minimo_pedido: number;
  tempo_medio_entrega: number;
  raio_entrega_km: number;
  bairros_atendidos: string[];
}

export interface NotificacaoPush {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthTokens {
  token: string;
  user: User;
}

export interface ClienteAuthTokens {
  token: string;
  user: Cliente;
}

// Cart types
export interface CartItem {
  product: {
    id: number;
    nome: string;
    preco_base: number;
    imagem_url?: string;
    categoria_nome?: string;
  };
  quantity: number;
  personalizacoes: CartItemPersonalizacao[];
}

export interface CartItemPersonalizacao {
  grupo_id: number;
  grupo_nome: string;
  opcao_id: number;
  opcao_nome: string;
  preco_adicional: number;
}

export interface CartState {
  items: CartItem[];
  deliveryFee: number;
  minOrder: number;
}

// UI State types
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface ModalState {
  isOpen: boolean;
  productId?: number;
  product?: Produto;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

// Form types
export interface LoginForm {
  email: string;
  senha: string;
}

export interface RegisterForm {
  nome: string;
  email: string;
  senha: string;
  confirmarSenha: string;
  telefone?: string;
}

export interface CheckoutForm {
  tipoEntrega: 'entrega' | 'retirada';
  enderecoId?: number;
  novoEndereco?: EnderecoEntrega;
  formaPagamentoId: number;
  observacoes?: string;
  trocoPara?: number;
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};