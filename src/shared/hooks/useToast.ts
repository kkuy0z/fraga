/**
 * Hook personalizado para toasts/notificações
 */

import { useCallback } from 'react';
import { useUIStore, useToasts } from '@store';
import type { Toast } from '@types';

export function useToast() {
  const toasts = useToasts();
  const addToast = useUIStore((state) => state.addToast);
  const removeToast = useUIStore((state) => state.removeToast);
  const clearToasts = useUIStore((state) => state.clearToasts);

  const showToast = useCallback(
    (message: string, type: Toast['type'] = 'info', duration?: number) => {
      return addToast({ message, type, duration });
    },
    [addToast]
  );

  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      return addToast({ message, type: 'success', duration });
    },
    [addToast]
  );

  const showError = useCallback(
    (message: string, duration?: number) => {
      return addToast({ message, type: 'error', duration });
    },
    [addToast]
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => {
      return addToast({ message, type: 'warning', duration });
    },
    [addToast]
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => {
      return addToast({ message, type: 'info', duration });
    },
    [addToast]
  );

  const dismiss = useCallback(
    (id: string) => {
      removeToast(id);
    },
    [removeToast]
  );

  const dismissAll = useCallback(() => {
    clearToasts();
  }, [clearToasts]);

  return {
    toasts,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismiss,
    dismissAll,
  };
}