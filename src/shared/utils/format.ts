/**
 * Utilitários de formatação compartilhados
 */

/**
 * Formata valor monetário para Real Brasileiro
 */
export function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

/**
 * Alias em português para formatCurrency
 */
export const formatarMoeda = formatCurrency;

/**
 * Formata data completa (dia/mês/ano hora:minuto)
 */
export function formatDateTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateString);
  }
}

/**
 * Formata apenas data (dia/mês/ano)
 */
export function formatDateOnly(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  } catch {
    return String(dateString);
  }
}

/**
 * Alias em português para formatDateOnly
 */
export const formatarData = formatDateOnly;

/**
 * Formata data relativa (ex: "há 5 minutos", "ontem", "3 dias atrás")
 */
export function formatRelativeTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'agora mesmo';
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays < 7) return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
    return formatDateOnly(date);
  } catch {
    return String(dateString);
  }
}

/**
 * Valida CEP brasileiro
 */
export function validateCEP(cep: string): boolean {
  const clean = cep.replace(/\D/g, '');
  return clean.length === 8;
}

/**
 * Formata CEP (XXXXX-XXX)
 */
export function formatCEP(cep: string): string {
  const clean = cep.replace(/\D/g, '');
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)}-${clean.slice(5, 8)}`;
}

/**
 * Valida telefone brasileiro
 */
export function validatePhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return clean.length >= 10 && clean.length <= 11;
}

/**
 * Formata telefone brasileiro
 */
export function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

/**
 * Alias em português para formatPhone
 */
export const formatarTelefone = formatPhone;

/**
 * Alias em português para formatCEP
 */
export const formatarCEP = formatCEP;

/**
 * Alias em português para validateCPF
 */
export const validarCPF = validateCPF;

/**
 * Gera ID único simples
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Escape HTML para prevenir XSS
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Obtém parâmetros da URL atual
 */
export function getUrlParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

/**
 * Label do status do pedido em português
 */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pendente: 'Pendente',
    confirmado: 'Confirmado',
    preparo: 'Em Preparo',
    preparando: 'Preparando',
    pronto: 'Pronto',
    entrega: 'Saiu para Entrega',
    saiu_entrega: 'Saiu para Entrega',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  };
  return labels[status] || status;
}

/**
 * CSS class para badge de status
 */
export function getStatusClass(status: string): string {
  const classes: Record<string, string> = {
    pendente: 'badge-warning',
    confirmado: 'badge-info',
    preparo: 'badge-info',
    preparando: 'badge-info',
    pronto: 'badge-info',
    entrega: 'badge-primary',
    saiu_entrega: 'badge-primary',
    entregue: 'badge-success',
    cancelado: 'badge-danger',
  };
  return classes[status] || 'badge-neutral';
}

/**
 * Trunca texto com reticências
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Capitaliza primeira letra
 */
export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Formata CPF (XXX.XXX.XXX-XX)
 */
export function formatCPF(cpf: string): string {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
}

/**
 * Valida CPF
 */
export function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i]) * (10 - i);
  }
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== parseInt(clean[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean[i]) * (11 - i);
  }
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === parseInt(clean[10]);
}