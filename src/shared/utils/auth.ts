/**
 * Utilitários de autenticação compartilhados
 * Elimina duplicação de decodificarJWT em múltiplos arquivos
 */

/**
 * Decodifica um token JWT e retorna o payload
 * @param token - Token JWT string
 * @returns Payload decodificado ou null se inválido
 */
export function decodificarJWT(token: string): JWTPayload | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.warn('Erro ao decodificar JWT:', e);
    return null;
  }
}

export interface JWTPayload {
  sub: string | number;
  email: string;
  nome: string;
  role: 'administrador' | 'atendente' | 'cliente';
  iat: number;
  exp: number;
  [key: string]: unknown;
}

/**
 * Verifica se o token JWT está expirado
 * @param token - Token JWT string
 * @returns true se expirado, false caso contrário
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodificarJWT(token);
  if (!payload) return true;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

/**
 * Extrai o role do usuário do token JWT
 * @param token - Token JWT string
 * @returns Role do usuário ou null
 */
export function getRoleFromToken(token: string): JWTPayload['role'] | null {
  const payload = decodificarJWT(token);
  return payload?.role ?? null;
}

/**
 * Verifica se o usuário é administrador baseado no token
 * @param token - Token JWT string
 * @returns true se for administrador
 */
export function isAdminFromToken(token: string): boolean {
  return getRoleFromToken(token) === 'administrador';
}

/**
 * Obtém o tempo restante de validade do token em segundos
 * @param token - Token JWT string
 * @returns Segundos restantes ou 0 se inválido/expirado
 */
export function getTokenTimeRemaining(token: string): number {
  const payload = decodificarJWT(token);
  if (!payload) return 0;

  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - now);
}