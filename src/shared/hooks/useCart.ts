/**
 * Hook personalizado para carrinho de compras
 * Fornece interface reativa ao store do carrinho
 */

import { useCallback } from 'react';
import { useCartStore, useCartItems, useCartTotalItems, useCartSubtotal, useCartTotal, useCartCanCheckout, useDeliveryFee, useMinOrder } from '@store';
import type { CartItem, CartItemPersonalizacao } from '@types';

export function useCart() {
  const items = useCartItems();
  const totalItems = useCartTotalItems();
  const subtotal = useCartSubtotal();
  const total = useCartTotal();
  const canCheckout = useCartCanCheckout();
  const deliveryFee = useDeliveryFee();
  const minOrder = useMinOrder();

  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const clearCart = useCartStore((state) => state.clearCart);
  const setDeliveryConfig = useCartStore((state) => state.setDeliveryConfig);

  // Adiciona produto ao carrinho com personalizações
  const addProduct = useCallback(
    (
      product: CartItem['product'],
      quantity: number = 1,
      personalizacoes: CartItemPersonalizacao[] = []
    ) => {
      addItem({ product, quantity, personalizacoes });
    },
    [addItem]
  );

  // Adiciona item simples (sem personalizações)
  const addSimpleItem = useCallback(
    (product: CartItem['product'], quantity: number = 1) => {
      addItem({ product, quantity, personalizacoes: [] });
    },
    [addItem]
  );

  // Verifica se produto está no carrinho
  const isInCart = useCallback(
    (productId: number, personalizacoes: CartItemPersonalizacao[] = []) => {
      return items.some((item) => {
        const sameProduct = item.product.id === productId;
        const samePersonalizations =
          JSON.stringify(item.personalizacoes.sort((a, b) => a.opcao_id - b.opcao_id)) ===
          JSON.stringify(personalizacoes.sort((a, b) => a.opcao_id - b.opcao_id));
        return sameProduct && samePersonalizations;
      });
    },
    [items]
  );

  // Obtém quantidade de um produto no carrinho
  const getProductQuantity = useCallback(
    (productId: number, personalizacoes: CartItemPersonalizacao[] = []) => {
      const item = items.find((item) => {
        const sameProduct = item.product.id === productId;
        const samePersonalizations =
          JSON.stringify(item.personalizacoes.sort((a, b) => a.opcao_id - b.opcao_id)) ===
          JSON.stringify(personalizacoes.sort((a, b) => a.opcao_id - b.opcao_id));
        return sameProduct && samePersonalizations;
      });
      return item?.quantity ?? 0;
    },
    [items]
  );

  // Incrementa quantidade
  const incrementQuantity = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        updateQuantity(index, item.quantity + 1);
      }
    },
    [items, updateQuantity]
  );

  // Decrementa quantidade
  const decrementQuantity = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        updateQuantity(index, item.quantity - 1);
      }
    },
    [items, updateQuantity]
  );

  // Limpa carrinho e configura entrega
  const checkout = useCallback(async () => {
    if (!canCheckout) return false;

    // Aqui você faria a chamada para criar o pedido
    // const pedido = await api.createPedido({ ... });
    // clearCart();
    // return pedido;

    return true;
  }, [canCheckout]);

  return {
    // State
    items,
    totalItems,
    subtotal,
    total,
    deliveryFee,
    minOrder,
    canCheckout,
    isEmpty: items.length === 0,

    // Actions
    addItem: addProduct,
    addSimpleItem,
    removeItem,
    updateQuantity,
    incrementQuantity,
    decrementQuantity,
    clearCart,
    setDeliveryConfig,
    checkout,

    // Helpers
    isInCart,
    getProductQuantity,
  };
}

// Hook para usar apenas o contador do carrinho (performance)
export function useCartCount() {
  return useCartTotalItems();
}

// Hook para usar apenas o subtotal
export function useCartSubtotalValue() {
  return useCartSubtotal();
}

// Hook para usar apenas o total
export function useCartTotalValue() {
  return useCartTotal();
}