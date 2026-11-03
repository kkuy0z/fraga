/**
 * React Query / TanStack Query hooks para API
 * Fornece cache, deduplicação, retry automático, etc.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type {
  Categoria,
  Produto,
  Pedido,
  EnderecoEntrega,
  FormaPagamento,
  HorarioFuncionamento,
  ConfigEntrega,
  User,
  Cliente,
} from '@types';

// Query keys factory
export const queryKeys = {
  categorias: (ativo?: boolean) => ['categorias', { ativo }] as const,
  categoriasAdmin: (params?: Record<string, unknown>) => ['categorias', 'admin', params] as const,
  categoria: (id: number) => ['categorias', id] as const,
  produtos: (params?: Record<string, unknown>) => ['produtos', params] as const,
  produtosAdmin: (params?: Record<string, unknown>) => ['produtos', 'admin', params] as const,
  produto: (id: number) => ['produtos', id] as const,
  personalizacoes: (produtoId: number) => ['produtos', produtoId, 'personalizacoes'] as const,
  horarios: () => ['horarios'] as const,
  statusFuncionamento: () => ['horarios', 'status'] as const,
  configEntrega: () => ['entrega', 'config'] as const,
  formasPagamento: (ativo?: boolean) => ['pagamentos', { ativo }] as const,
  pedidos: (params?: Record<string, unknown>) => ['pedidos', params] as const,
  meusPedidos: (params?: Record<string, unknown>) => ['pedidos', 'minhas', params] as const,
  pedidosAdmin: (params?: Record<string, unknown>) => ['pedidos', 'admin', params] as const,
  pedido: (id: number) => ['pedidos', id] as const,
  pedidoByNumero: (numero: string) => ['pedidos', 'numero', numero] as const,
  usuariosAdmin: (params?: Record<string, unknown>) => ['usuarios', 'admin', params] as const,
  usuario: (id: number) => ['usuarios', id] as const,
  clientePerfil: () => ['cliente', 'perfil'] as const,
  clienteEnderecos: () => ['cliente', 'enderecos'] as const,
  vapidPublicKey: () => ['notificacoes', 'vapid'] as const,
  pushSubscriptions: () => ['notificacoes', 'subscriptions'] as const,
};

// ===== CATEGORIAS =====
export function useCategorias(ativo = true) {
  return useQuery({
    queryKey: queryKeys.categorias(ativo),
    queryFn: () => api.getCategorias(ativo),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCategoriasAdmin(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.categoriasAdmin(params),
    queryFn: () => api.getCategoriasAdmin(params),
  });
}

export function useCategoria(id: number) {
  return useQuery({
    queryKey: queryKeys.categoria(id),
    queryFn: () => api.getCategoria(id),
    enabled: !!id,
  });
}

export function useCreateCategoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Categoria>) => api.createCategoria(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
    },
  });
}

export function useUpdateCategoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Categoria> }) => api.updateCategoria(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.categoria(id) });
    },
  });
}

export function useDeleteCategoria() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteCategoria(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
    },
  });
}

// ===== PRODUTOS =====
export function useProdutos(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.produtos(params),
    queryFn: () => api.getProdutos(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useProdutosAdmin(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.produtosAdmin(params),
    queryFn: () => api.getProdutosAdmin(params),
  });
}

export function useProduto(id: number) {
  return useQuery({
    queryKey: queryKeys.produto(id),
    queryFn: () => api.getProduto(id),
    enabled: !!id,
  });
}

export function useCreateProduto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Produto>) => api.createProduto(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
    },
  });
}

export function useUpdateProduto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Produto> }) => api.updateProduto(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.produto(id) });
    },
  });
}

export function useDeleteProduto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteProduto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
    },
  });
}

// ===== PERSONALIZAÇÕES =====
export function usePersonalizacoes(produtoId: number) {
  return useQuery({
    queryKey: queryKeys.personalizacoes(produtoId),
    queryFn: () => api.getPersonalizacoes(produtoId),
    enabled: !!produtoId,
  });
}

// ===== HORÁRIOS =====
export function useHorarios() {
  return useQuery({
    queryKey: queryKeys.horarios(),
    queryFn: () => api.getHorarios(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useStatusFuncionamento() {
  return useQuery({
    queryKey: queryKeys.statusFuncionamento(),
    queryFn: () => api.getStatusFuncionamento(),
    refetchInterval: 30 * 1000, // 30 seconds
    staleTime: 0,
  });
}

export function useCreateHorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<HorarioFuncionamento>) => api.createHorario(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horarios'] });
    },
  });
}

export function useUpdateHorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<HorarioFuncionamento> }) => api.updateHorario(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horarios'] });
    },
  });
}

export function useDeleteHorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteHorario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horarios'] });
    },
  });
}

// ===== ENTREGA =====
export function useConfigEntrega() {
  return useQuery({
    queryKey: queryKeys.configEntrega(),
    queryFn: () => api.getConfigEntrega(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateConfigEntrega() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ConfigEntrega>) => api.updateConfigEntrega(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configEntrega() });
    },
  });
}

// ===== PAGAMENTOS =====
export function useFormasPagamento(ativo = true) {
  return useQuery({
    queryKey: queryKeys.formasPagamento(ativo),
    queryFn: () => api.getFormasPagamento(ativo),
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateFormaPagamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<FormaPagamento>) => api.createFormaPagamento(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagamentos'] });
    },
  });
}

export function useUpdateFormaPagamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FormaPagamento> }) => api.updateFormaPagamento(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagamentos'] });
    },
  });
}

export function useDeleteFormaPagamento() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteFormaPagamento(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pagamentos'] });
    },
  });
}

// ===== PEDIDOS =====
export function usePedidos(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.pedidos(params),
    queryFn: () => api.getPedidos(params),
  });
}

export function useMeusPedidos(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.meusPedidos(params),
    queryFn: () => api.getMeusPedidos(params),
  });
}

export function usePedidosAdmin(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.pedidosAdmin(params),
    queryFn: () => api.getPedidosAdmin(params),
  });
}

export function usePedido(id: number) {
  return useQuery({
    queryKey: queryKeys.pedido(id),
    queryFn: () => api.getPedidoById(id),
    enabled: !!id,
  });
}

export function usePedidoByNumero(numero: string) {
  return useQuery({
    queryKey: queryKeys.pedidoByNumero(numero),
    queryFn: () => api.getPedidoByNumero(numero),
    enabled: !!numero,
  });
}

export function useCreatePedido() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => api.createPedido(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    },
  });
}

export function useUpdatePedidoStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: Pedido['status'] }) => api.updatePedidoStatus(id, status),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.pedido(id) });
    },
  });
}

// ===== AUTENTICAÇÃO ADMIN =====
export function useAdminLogin() {
  return useMutation({
    mutationFn: ({ email, senha }: { email: string; senha: string }) => api.adminLogin(email, senha),
  });
}

export function useAdminVerify() {
  return useQuery({
    queryKey: ['auth', 'verify'],
    queryFn: () => api.adminVerify(),
    retry: false,
  });
}

export function useAdminRegister() {
  return useMutation({
    mutationFn: (data: Partial<User>) => api.adminRegister(data),
  });
}

export function useAdminChangePassword() {
  return useMutation({
    mutationFn: (data: { senhaAtual: string; novaSenha: string }) => api.adminChangePassword(data),
  });
}

export function useUsuariosAdmin(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.usuariosAdmin(params),
    queryFn: () => api.getUsuariosAdmin(params),
  });
}

export function useUpdateUsuarioAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) => api.updateUsuarioAdmin(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['usuarios', 'admin'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.usuario(id) });
    },
  });
}

export function useCreateUsuarioAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<User>) => api.createUsuarioAdmin(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios', 'admin'] });
    },
  });
}

export function useDeleteUsuarioAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteUsuarioAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios', 'admin'] });
    },
  });
}

// ===== CLIENTES =====
export function useClienteRegister() {
  return useMutation({
    mutationFn: (data: Partial<Cliente>) => api.clienteRegister(data),
  });
}

export function useClienteLogin() {
  return useMutation({
    mutationFn: ({ email, senha }: { email: string; senha: string }) => api.clienteLogin(email, senha),
  });
}

export function useClientePerfil() {
  return useQuery({
    queryKey: queryKeys.clientePerfil(),
    queryFn: () => api.getClientePerfil(),
  });
}

export function useUpdateClientePerfil() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Cliente>) => api.updateClientePerfil(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clientePerfil() });
    },
  });
}

export function useAlterarClienteSenha() {
  return useMutation({
    mutationFn: (data: { senhaAtual: string; novaSenha: string }) => api.alterarClienteSenha(data),
  });
}

export function useClienteEnderecos() {
  return useQuery({
    queryKey: queryKeys.clienteEnderecos(),
    queryFn: () => api.getClienteEnderecos(),
  });
}

export function useCreateClienteEndereco() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<EnderecoEntrega>) => api.criarClienteEndereco(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clienteEnderecos() });
    },
  });
}

export function useUpdateClienteEndereco() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EnderecoEntrega> }) => api.atualizarClienteEndereco(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clienteEnderecos() });
    },
  });
}

export function useDeleteClienteEndereco() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.excluirClienteEndereco(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clienteEnderecos() });
    },
  });
}

// ===== NOTIFICAÇÕES PUSH =====
export function useVapidPublicKey() {
  return useQuery({
    queryKey: queryKeys.vapidPublicKey(),
    queryFn: () => api.getVapidPublicKey(),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

export function useSubscribeToPush() {
  return useMutation({
    mutationFn: (subscription: PushSubscription) => api.subscribeToPush(subscription),
  });
}

export function useUnsubscribeFromPush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (endpoint: string) => api.unsubscribeFromPush(endpoint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pushSubscriptions() });
    },
  });
}

export function usePushSubscriptions() {
  return useQuery({
    queryKey: queryKeys.pushSubscriptions(),
    queryFn: () => api.getPushSubscriptions(),
  });
}