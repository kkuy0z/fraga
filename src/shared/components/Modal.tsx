/**
 * Componente Modal acessível
 */

import { useModal } from '@hooks';
import { createElement, trapFocus } from '@utils';
import { useEffect, useRef } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export function Modal({
  id,
  title,
  children,
  onClose,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const { isOpen, open, close } = useModal(id);
  const modalRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Trap focus
      cleanupRef.current = trapFocus(modalRef.current!);

      // Handle escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && closeOnEscape) {
          close();
          onClose?.();
        }
      };

      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleEscape);
        cleanupRef.current?.();
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, close, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      close();
      onClose?.();
    }
  };

  const handleCloseClick = () => {
    close();
    onClose?.();
  };

  const sizeClasses = {
    sm: styles.modalSm,
    md: styles.modalMd,
    lg: styles.modalLg,
    xl: styles.modalXl,
    full: styles.modalFull,
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <div
        ref={modalRef}
        className={`${styles.modal} ${styles.modalContent} ${sizeClasses[size]}`}
        role="document"
      >
        <div className={styles.modalHeader}>
          <h2 id={`${id}-title`} className={styles.modalTitle}>
            {title}
          </h2>
          {showCloseButton && (
            <button
              className={styles.modalClose}
              onClick={handleCloseClick}
              aria-label="Fechar modal"
            >
              ×
            </button>
          )}
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

export default Modal;