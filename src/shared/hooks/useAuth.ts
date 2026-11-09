/**
 * Hook personalizado para autenticação
 * Centraliza toda a lógica de verificação de auth, logout, etc.
 * Substitui a função verificarAuth() duplicada em 7+ arquivos
 */

import { useEffect, useCallback } from 'react';
import { api } from '@api';
import {
  useAuthStore,
  useAdminToken,
  useAdminUser,
  useClienteToken,
  useClienteUser,
  useIsAdminAuthenticated,
  useIsClienteAuthenticated,
  useCurrentUser,
  useCurrentToken,
  useIsAdmin,
  useIsCozinha,
  useIsEntregador,
  useIsAtendente,
} from '@store';
import { decodificarJWT, isTokenExpired } from '@utils';

export function useAuth() {
  const adminToken = useAdminToken();
  const adminUser = useAdminUser();
  const clienteToken = useClienteToken();
  const clienteUser = useClienteUser();
  const isAdminAuth = useIsAdminAuthenticated();
  const isClienteAuth = useIsClienteAuthenticated();
  const currentUser = useCurrentUser();
  const currentToken = useCurrentToken();
  const isAdmin = useIsAdmin();
  const isCozinha = useIsCozinha();
  const isEntregador = useIsEntregador();
  const isAtendente = useIsAtendente();

  const setAdminAuth = useAuthStore((state) => state.setAdminAuth);
  const clearAdminAuth = useAuthStore((state) => state.clearAdminAuth);
  const setClienteAuth = useAuthStore((state) => state.setClienteAuth);
  const clearClienteAuth = useAuthStore((state) => state.clearClienteAuth);

  // Verifica se o token admin é válido (não expirado)
  const isAdminTokenValid = useCallback(() => {
    if (!adminToken) return false;
    return !isTokenExpired(adminToken);
  }, [adminToken]);

  // Verifica se o token cliente é válido
  const isClienteTokenValid = useCallback(() => {
    if (!clienteToken) return false;
    return !isTokenExpired(clienteToken);
  }, [clienteToken]);

  // Login admin
  const loginAdmin = useCallback(async (email: string, senha: string) => {
    const { token, user } = await api.adminLogin(email, senha);
    setAdminAuth(token, user);
    return { token, user };
  }, [setAdminAuth]);

  // Login cliente
  const loginCliente = useCallback(async (email: string, senha: string) => {
    const { token, user } = await api.clienteLogin(email, senha);
    setClienteAuth(token, user);
    return { token, user };
  }, [setClienteAuth]);

  // Logout admin
  const logoutAdmin = useCallback(() => {
    clearAdminAuth();
  }, [clearAdminAuth]);

  // Logout cliente
  const logoutCliente = useCallback(() => {
    clearClienteAuth();
  }, [clearClienteAuth]);

  // Logout universal
  const logout = useCallback(() => {
    if (isClienteAuth) {
      logoutCliente();
    } else if (isAdminAuth) {
      logoutAdmin();
    }
  }, [isClienteAuth, isAdminAuth, logoutCliente, logoutAdmin]);

  // Verificar auth admin no servidor
  const verifyAdminAuth = useCallback(async () => {
    if (!isAdminAuth) return false;
    try {
      const user = await api.adminVerify();
      // Atualiza usuário com dados frescos do servidor
      setAdminAuth(adminToken!, user);
      return true;
    } catch {
      logoutAdmin();
      return false;
    }
  }, [isAdminAuth, adminToken, setAdminAuth, logoutAdmin]);

  // Verificar auth cliente no servidor
  const verifyClienteAuth = useCallback(async () => {
    if (!isClienteAuth) return false;
    try {
      const user = await api.getClientePerfil();
      setClienteAuth(clienteToken!, user);
      return true;
    } catch {
      logoutCliente();
      return false;
    }
  }, [isClienteAuth, clienteToken, setClienteAuth, logoutCliente]);

  // Obter role do usuário atual
  const getUserRole = useCallback((): 'administrador' | 'atendente' | 'cliente' | null => {
    if (isAdminAuth && adminUser) return adminUser.role;
    if (isClienteAuth) return 'cliente';
    return null;
  }, [isAdminAuth, adminUser, isClienteAuth]);

  // Verificar se é admin
  const checkIsAdmin = useCallback((): boolean => {
    if (!isAdminAuth || !adminToken) return false;
    const payload = decodificarJWT(adminToken);
    return payload?.role === 'administrador';
  }, [isAdminAuth, adminToken]);

  return {
    // State
    adminToken,
    adminUser,
    clienteToken,
    clienteUser,
    isAdminAuthenticated: isAdminAuth && isAdminTokenValid(),
    isClienteAuthenticated: isClienteAuth && isClienteTokenValid(),
    currentUser,
    currentToken,
    isAdmin: checkIsAdmin(),
    isCozinha,
    isEntregador,
    isAtendente,
    userRole: getUserRole(),

    // Actions
    loginAdmin,
    loginCliente,
    logoutAdmin,
    logoutCliente,
    logout,
    verifyAdminAuth,
    verifyClienteAuth,
    checkIsAdmin,
    getUserRole,
  };
}

// Hook para proteger rotas que requerem autenticação admin
export function useRequireAdminAuth(redirectTo = '/admin-login.html') {
  const { isAdminAuthenticated, verifyAdminAuth } = useAuth();

  useEffect(() => {
    if (!isAdminAuthenticated) {
      window.location.href = redirectTo;
    } else {
      verifyAdminAuth();
    }
  }, [isAdminAuthenticated, verifyAdminAuth, redirectTo]);

  return { isAdminAuthenticated };
}

// Hook para proteger rotas que requerem autenticação cliente
export function useRequireClienteAuth(redirectTo = '/cadastro.html') {
  const { isClienteAuthenticated, verifyClienteAuth } = useAuth();

  useEffect(() => {
    if (!isClienteAuthenticated) {
      window.location.href = redirectTo;
    } else {
      verifyClienteAuth();
    }
  }, [isClienteAuthenticated, verifyClienteAuth, redirectTo]);

  return { isClienteAuthenticated };
}

// Hook para verificar auth sem redirecionar (para uso em componentes que se adaptam)
export function useCheckAuth() {
  const { isAdminAuthenticated, isClienteAuthenticated, isCozinha, isEntregador, isAtendente, verifyAdminAuth, verifyClienteAuth } = useAuth();

  useEffect(() => {
    if (isAdminAuthenticated) {
      verifyAdminAuth();
    } else if (isClienteAuthenticated) {
      verifyClienteAuth();
    }
  }, [isAdminAuthenticated, isClienteAuthenticated, verifyAdminAuth, verifyClienteAuth]);

  return { isAdminAuthenticated, isClienteAuthenticated, isCozinha, isEntregador, isAtendente };
}