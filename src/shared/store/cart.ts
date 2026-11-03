/**
 * Zustand store para carrinho de compras
 * Substitui o cart.js anterior com melhor tipagem e persistência
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem, CartState } from '@types';

interface CartStore extends CartState {
  // Actions
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (index: number) => void;
  updateQuantity: (index: number, quantity: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
  getTotalItems: () => number;
  canCheckout: () => boolean;

  // Delivery config
  setDeliveryConfig: (fee: number, minOrder: number) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // State
      items: [],
      deliveryFee: 5.0,
      minOrder: 0,

      // Actions
      addItem: (newItem) => {
        const { items } = get();
        const quantity = newItem.quantity ?? 1;

        // Check if item already exists (same product + same personalizations)
        const existingIndex = items.findIndex((item) => {
          const sameProduct = item.product.id === newItem.product.id;
          const samePersonalizations =
            JSON.stringify(item.personalizacoes.sort((a, b) => a.opcao_id - b.opcao_id)) ===
            JSON.stringify(newItem.personalizacoes.sort((a, b) => a.opcao_id - b.opcao_id));
          return sameProduct && samePersonalizations;
        });

        if (existingIndex >= 0) {
          const updatedItems = [...items];
          updatedItems[existingIndex].quantity += quantity;
          set({ items: updatedItems });
        } else {
          set({ items: [...items, { ...newItem, quantity }] });
        }
      },

      removeItem: (index: number) => {
        const { items } = get();
        const updatedItems = items.filter((_, i) => i !== index);
        set({ items: updatedItems });
      },

      updateQuantity: (index: number, quantity: number) => {
        if (quantity < 1) {
          get().removeItem(index);
          return;
        }
        const { items } = get();
        const updatedItems = [...items];
        updatedItems[index].quantity = quantity;
        set({ items: updatedItems });
      },

      clearCart: () => {
        set({ items: [] });
      },

      getSubtotal: () => {
        const { items } = get();
        return items.reduce((sum, item) => {
          const personalizacaoTotal = item.personalizacoes.reduce((s, p) => s + p.preco_adicional, 0);
          return sum + (item.product.preco_base + personalizacaoTotal) * item.quantity;
        }, 0);
      },

      getTotal: () => {
        return get().getSubtotal() + get().deliveryFee;
      },

      getTotalItems: () => {
        const { items } = get();
        return items.reduce((sum, item) => sum + item.quantity, 0);
      },

      canCheckout: () => {
        const { items } = get();
        return items.length > 0 && get().getSubtotal() >= get().minOrder;
      },

      setDeliveryConfig: (fee: number, minOrder: number) => {
        set({ deliveryFee: fee, minOrder });
      },
    }),
    {
      name: 'fraga-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
      }),
    }
  )
);

// Selectors
export const useCartItems = () => useCartStore((state) => state.items);
export const useCartTotalItems = () => useCartStore((state) => state.getTotalItems());
export const useCartSubtotal = () => useCartStore((state) => state.getSubtotal());
export const useCartTotal = () => useCartStore((state) => state.getTotal());
export const useCartCanCheckout = () => useCartStore((state) => state.canCheckout());
export const useDeliveryFee = () => useCartStore((state) => state.deliveryFee);
export const useMinOrder = () => useCartStore((state) => state.minOrder);