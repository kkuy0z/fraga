/**
 * Página do Carrinho
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header, ToastContainer, LoadingOverlay, Modal, Button } from '@components';
import { useCart, useAuth, useToast } from '@hooks';
import { formatarMoeda } from '@shared/utils';
import styles from './CarrinhoPage.module.css';

export function CarrinhoPage() {
  const navigate = useNavigate();
  const { cartItems, updateQuantity, removeItem, clearCart, cartTotal, cartItemCount, isLoading: cartLoading } = useCart();
  const { isAuthenticated, isLoading: authLoading, verifyAuth } = useAuth();
  const { showToast } = useToast();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState('');

  // Verificar autenticação ao montar
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      verifyAuth();
    }
  }, [authLoading, isAuthenticated, verifyAuth]);

  const handleFinalizarPedido = () => {
    if (!isAuthenticated) {
      setRedirectAfterLogin('/checkout');
      setShowLoginModal(true);
      return;
    }
    navigate('/checkout');
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    if (redirectAfterLogin) {
      navigate(redirectAfterLogin);
    }
  };

  const handleContinuarComprando = () => {
    navigate('/cardapio');
  };

  if (cartLoading || authLoading) {
    return (
      <>
        <Header currentPage="carrinho" cartItemCount={cartItemCount} />
        <ToastContainer />
        <LoadingOverlay message="Carregando carrinho..." />
      </>
    );
  }

  const isEmpty = cartItems.length === 0;

  return (
    <>
      <Header currentPage="carrinho" cartItemCount={cartItemCount} />
      <ToastContainer />

      <section className={styles.carrinho} aria-label="Carrinho de compras">
        <div className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.title}>CARRINHO</h1>
            <p className={styles.subtitle}>
              {cartItemCount} {cartItemCount === 1 ? 'item' : 'itens'} no carrinho
            </p>
          </header>

          {isEmpty ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon} aria-hidden="true">🛒</div>
              <h2 className={styles.emptyTitle}>Carrinho Vazio</h2>
              <p className={styles.emptyText}>
                Adicione lanches deliciosos ao seu carrinho
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={handleContinuarComprando}
                className={styles.continueBtn}
              >
                Continuar Comprando
              </Button>
            </div>
          ) : (
            <div className={styles.content}>
              <div className={styles.itemsList} role="list" aria-label="Itens do carrinho">
                {cartItems.map((item) => (
                  <article key={item.id} className={styles.item} role="listitem">
                    <img
                      src={item.imagem || '/placeholder-product.jpg'}
                      alt={item.nome}
                      className={styles.itemImage}
                      loading="lazy"
                    />
                    <div className={styles.itemDetails}>
                      <h3 className={styles.itemName}>{item.nome}</h3>
                      <p className={styles.itemPrice}>
                        {formatarMoeda(item.preco)} cada
                      </p>
                      {item.observacoes && (
                        <p className={styles.itemNotes}>{item.observacoes}</p>
                      )}
                    </div>
                    <div className={styles.itemQuantity}>
                      <label htmlFor={`qty-${item.id}`} className={styles.visuallyHidden}>
                        Quantidade de {item.nome}
                      </label>
                      <select
                        id={`qty-${item.id}`}
                        value={item.quantidade}
                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                        className={styles.quantitySelect}
                        aria-label={`Quantidade de ${item.nome}`}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <option key={num} value={num}>
                            {num}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.itemTotal}>
                      {formatarMoeda(item.preco * item.quantidade)}
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className={styles.removeBtn}
                      aria-label={`Remover ${item.nome} do carrinho`}
                    >
                      <span aria-hidden="true">🗑️</span>
                    </button>
                  </article>
                ))}
              </div>

              <aside className={styles.summary} aria-label="Resumo do pedido">
                <h2 className={styles.summaryTitle}>Resumo do Pedido</h2>
                <div className={styles.summaryLines}>
                  <div className={styles.summaryLine}>
                    <span>Subtotal ({cartItemCount} itens)</span>
                    <span>{formatarMoeda(cartTotal)}</span>
                  </div>
                  <div className={styles.summaryLine}>
                    <span>Taxa de Entrega</span>
                    <span className={styles.free}>Grátis</span>
                  </div>
                  <div className={styles.summaryLine} style={{ borderTop: 'none' }}>
                    <span>Total</span>
                    <span className={styles.totalValue}>{formatarMoeda(cartTotal)}</span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleFinalizarPedido}
                  className={styles.checkoutBtn}
                >
                  Finalizar Pedido
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={handleContinuarComprando}
                  className={styles.continueBtn}
                >
                  Continuar Comprando
                </Button>
                <p className={styles.secureNote}>
                  <span aria-hidden="true">🔒</span>
                  Pagamento seguro na entrega
                </p>
              </aside>
            </div>
          )}
        </div>
      </section>

      {/* Modal de Login */}
      <Modal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Entrar para Continuar"
        size="sm"
      >
        <div className={styles.loginModal}>
          <p className={styles.loginMessage}>
            Faça login ou cadastre-se para finalizar seu pedido
          </p>
          <div className={styles.loginActions}>
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                setShowLoginModal(false);
                navigate('/login', { state: { redirect: redirectAfterLogin } });
              }}
            >
              Entrar
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setShowLoginModal(false);
                navigate('/cadastro', { state: { redirect: redirectAfterLogin } });
              }}
            >
              Criar Conta
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onClick={() => setShowLoginModal(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default CarrinhoPage;