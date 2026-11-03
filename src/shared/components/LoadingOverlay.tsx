/**
 * Componente overlay de loading
 */

import { useIsLoading, useLoadingMessage } from '@hooks';
import styles from './LoadingOverlay.module.css';

export function LoadingOverlay(loadingKey = 'global') {
  const isLoading = useIsLoading(loadingKey);
  const message = useLoadingMessage(loadingKey);

  if (!isLoading) return null;

  return (
    <div className={styles.loadingOverlay} role="status" aria-live="polite" aria-label={message || 'Carregando'}>
      <div className={styles.loadingSpinner} aria-hidden="true" />
      <p className={styles.loadingMessage}>{message || 'Carregando...'}</p>
    </div>
  );
}

export default LoadingOverlay;