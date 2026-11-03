/**
 * Hook personalizado para modais
 */

import { useCallback } from 'react';
import { useUIStore } from '@store';

export function useModal(modalId: string) {
  const isOpen = useUIStore((state) => state.modals[modalId] ?? false);
  const openModal = useUIStore((state) => state.openModal);
  const closeModal = useUIStore((state) => state.closeModal);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const open = useCallback(() => openModal(modalId), [openModal, modalId]);
  const close = useCallback(() => closeModal(modalId), [closeModal, modalId]);
  const toggle = useCallback(() => toggleModal(modalId), [toggleModal, modalId]);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
}

// Hook para gerenciar múltiplos modais
export function useModals() {
  const modals = useUIStore((state) => state.modals);
  const openModal = useUIStore((state) => state.openModal);
  const closeModal = useUIStore((state) => state.closeModal);
  const closeAllModals = useCallback(() => {
    Object.keys(modals).forEach((id) => closeModal(id));
  }, [modals, closeModal]);

  return {
    modals,
    openModal,
    closeModal,
    closeAllModals,
  };
}