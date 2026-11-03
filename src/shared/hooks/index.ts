// Hooks barrel export
export { useAuth, useRequireAdminAuth, useRequireClienteAuth, useCheckAuth } from './useAuth';
export { useCart, useCartCount, useCartSubtotalValue, useCartTotalValue } from './useCart';
export { useToast } from './useToast';
export { useModal, useModals } from './useModal';
export { useLoading, useGlobalLoading, useFormLoading, useDataLoading } from './useLoading';

// Re-export store selectors for convenience
export { useToasts, useIsModalOpen, useIsLoading, useLoadingMessage } from '@store/ui';