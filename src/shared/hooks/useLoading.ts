/**
 * Hook personalizado para estados de loading
 */

import { useCallback } from 'react';
import { useUIStore, useIsLoading, useLoadingMessage } from '@store';

export function useLoading(loadingKey: string) {
  const isLoading = useIsLoading(loadingKey);
  const message = useLoadingMessage(loadingKey);
  const setLoading = useUIStore((state) => state.setLoading);

  const start = useCallback(
    (message?: string) => {
      setLoading(loadingKey, true, message);
    },
    [setLoading, loadingKey]
  );

  const stop = useCallback(() => {
    setLoading(loadingKey, false);
  }, [setLoading, loadingKey]);

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>, loadingMessage?: string): Promise<T> => {
      start(loadingMessage);
      try {
        const result = await fn();
        return result;
      } finally {
        stop();
      }
    },
    [start, stop]
  );

  return {
    isLoading,
    message,
    start,
    stop,
    withLoading,
  };
}

// Hook para loading global (página inteira)
export function useGlobalLoading() {
  return useLoading('global');
}

// Hook para loading de formulários
export function useFormLoading(formKey: string) {
  return useLoading(`form-${formKey}`);
}

// Hook para loading de listas/dados
export function useDataLoading(dataKey: string) {
  return useLoading(`data-${dataKey}`);
}