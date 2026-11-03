/**
 * Zustand store para estado de UI (toasts, modais, loading)
 */

import { create } from 'zustand';
import type { Toast } from '@types';

interface UIState {
  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  // Modals
  modals: Record<string, boolean>;
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
  toggleModal: (id: string) => void;
  isModalOpen: (id: string) => boolean;

  // Loading
  loadingStates: Record<string, { isLoading: boolean; message?: string }>;
  setLoading: (key: string, isLoading: boolean, message?: string) => void;
  isLoading: (key: string) => boolean;
}

export const useUIStore = create<UIState>((set, get) => ({
  // Toasts
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    // Auto remove
    setTimeout(() => {
      get().removeToast(id);
    }, toast.duration ?? 4000);

    return id;
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  clearToasts: () => {
    set({ toasts: [] });
  },

  // Modals
  modals: {},
  openModal: (id) => {
    set((state) => ({ modals: { ...state.modals, [id]: true } }));
    document.body.style.overflow = 'hidden';
  },
  closeModal: (id) => {
    set((state) => {
      const newModals = { ...state.modals };
      delete newModals[id];
      return { modals: newModals };
    });
    if (Object.keys(get().modals).length <= 1) {
      document.body.style.overflow = '';
    }
  },
  toggleModal: (id) => {
    if (get().modals[id]) {
      get().closeModal(id);
    } else {
      get().openModal(id);
    }
  },
  isModalOpen: (id) => !!get().modals[id],

  // Loading
  loadingStates: {},
  setLoading: (key, isLoading, message) => {
    set((state) => ({
      loadingStates: {
        ...state.loadingStates,
        [key]: { isLoading, message },
      },
    }));
  },
  isLoading: (key) => !!get().loadingStates[key]?.isLoading,
}));

// Selectors
export const useToasts = () => useUIStore((state) => state.toasts);
export const useIsModalOpen = (id: string) => useUIStore((state) => state.modals[id] ?? false);
export const useIsLoading = (key: string) => useUIStore((state) => state.loadingStates[key]?.isLoading ?? false);
export const useLoadingMessage = (key: string) => useUIStore((state) => state.loadingStates[key]?.message);