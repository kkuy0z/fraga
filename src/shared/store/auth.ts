/**
 * Zustand store para autenticação
 * Substitui a lógica espalhada em múltiplos arquivos JS
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Cliente } from '@types';

interface AuthState {
  // Admin auth
  adminToken: string | null;
  adminUser: User | null;
  // Cliente auth
  clienteToken: string | null;
  clienteUser: Cliente | null;

  // Actions
  setAdminAuth: (token: string, user: User) => void;
  clearAdminAuth: () => void;
  setClienteAuth: (token: string, user: Cliente) => void;
  clearClienteAuth: () => void;

  // Computed
  isAdminAuthenticated: () => boolean;
  isClienteAuthenticated: () => boolean;
  getCurrentUser: () => User | Cliente | null;
  getCurrentToken: () => string | null;
  isAdmin: () => boolean;
  isCozinha: () => boolean;
  isEntregador: () => boolean;
  isAtendente: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // State
      adminToken: null,
      adminUser: null,
      clienteToken: null,
      clienteUser: null,

      // Actions
      setAdminAuth: (token: string, user: User) => {
        set({ adminToken: token, adminUser: user });
      },

      clearAdminAuth: () => {
        set({ adminToken: null, adminUser: null });
      },

      setClienteAuth: (token: string, user: Cliente) => {
        set({ clienteToken: token, clienteUser: user });
      },

      clearClienteAuth: () => {
        set({ clienteToken: null, clienteUser: null });
      },

      // Computed
      isAdminAuthenticated: () => !!get().adminToken,
      isClienteAuthenticated: () => !!get().clienteToken,

      getCurrentUser: () => get().clienteUser ?? get().adminUser,

      getCurrentToken: () => get().clienteToken ?? get().adminToken,

      isAdmin: () => {
        const user = get().adminUser;
        return user?.role === 'administrador';
      },

      isCozinha: () => {
        const user = get().adminUser;
        return user?.role === 'cozinha';
      },

      isEntregador: () => {
        const user = get().adminUser;
        return user?.role === 'entregador';
      },

      isAtendente: () => {
        const user = get().adminUser;
        return user?.role === 'atendente';
      },
    }),
    {
      name: 'fraga-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        adminToken: state.adminToken,
        adminUser: state.adminUser,
        clienteToken: state.clienteToken,
        clienteUser: state.clienteUser,
      }),
    }
  )
);

// Selectors for performance
export const useAdminToken = () => useAuthStore((state) => state.adminToken);
export const useAdminUser = () => useAuthStore((state) => state.adminUser);
export const useClienteToken = () => useAuthStore((state) => state.clienteToken);
export const useClienteUser = () => useAuthStore((state) => state.clienteUser);
export const useIsAdminAuthenticated = () => useAuthStore((state) => state.isAdminAuthenticated());
export const useIsClienteAuthenticated = () => useAuthStore((state) => state.isClienteAuthenticated());
export const useCurrentUser = () => useAuthStore((state) => state.getCurrentUser());
export const useCurrentToken = () => useAuthStore((state) => state.getCurrentToken());
export const useIsAdmin = () => useAuthStore((state) => state.isAdmin());
export const useIsCozinha = () => useAuthStore((state) => state.isCozinha());
export const useIsEntregador = () => useAuthStore((state) => state.isEntregador());
export const useIsAtendente = () => useAuthStore((state) => state.isAtendente());