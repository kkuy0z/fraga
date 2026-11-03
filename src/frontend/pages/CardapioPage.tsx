/**
 * Página do Cardápio
 */

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header, ProductCard, ToastContainer, LoadingOverlay, Modal } from '@components';
import { useCart, useToast } from '@hooks';
import { api } from '@api/client';
import { Produto, Categoria } from '@shared/types';
import styles from './CardapioPage.module.css';

export function CardapioPage() {
  const { addItem, cartItemCount } = useCart();
  const { showToast } = useToast();
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string>('todas');
  const [produtoModal, setProdutoModal] = useState<Produto | null>(null);

  // Buscar categorias
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api.get<Categoria[]>('/categorias'),
    staleTime: 1000 * 60 * 10, // 10 min
  });

  // Buscar produtos
  const { data: produtos = [], isLoading, error, refetch } = useQuery({
    queryKey: ['produtos', categoriaSelecionada],
    queryFn: () => api.get<Produto[]>('/produtos', { categoria: categoriaSelecionada }),
    staleTime: 1000 * 60 * 5, // 5 min
  });

  // Buscar horário de funcionamento
  const { data: horario } = useQuery({
    queryKey: ['horario-funcionamento'],
    queryFn: () => api.get<{ aberto: boolean }>('/horario-funcionamento'),
    staleTime: 1000 * 60 * 2, // 2 min
  });

  const handleAddToCart = useCallback((produto: Produto) => {
    if (!produto.disponivel) {
      showToast('Produto indisponível no momento', 'warning');
      return;
    }
    addItem(produto, 1);
    showToast(`${produto.nome} adicionado ao carrinho!`, 'success');
  }, [addItem, showToast]);

  const handleVerDetalhes = useCallback((produto: Produto) => {
    setProdutoModal(produto);
  }, []);

  const categoriasFiltradas = ['todas', ...categorias.map(c => c.nome)];

  return (
    <>
      <Header currentPage="cardapio" cartItemCount={cartItemCount} />
      <ToastContainer />
      {isLoading && <LoadingOverlay message="Carregando cardápio..." />}

      <section className={styles.cardapio} aria-label="Cardápio">
        <div className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.title}>CARDÁPIO</h1>
            <p className={styles.subtitle}>Nossos lanches artesanais feitos com ingredientes frescos</p>
          </header>

          {/* Status de funcionamento */}
          <div className={styles.statusBar}>
            <span className={`${styles.statusBadge} ${horario?.aberto ? styles.aberto : styles.fechado}`}>
              <span className={styles.statusDot} aria-hidden="true" />
              {horario?.aberto ? 'ABERTO - FAÇA SEU PEDIDO' : 'FECHADO - PEDIDOS SOMENTE PARA RETIRADA'}
            </span>
          </div>

          {/* Filtro de categorias */}
          <nav className={styles.categoriesNav} aria-label="Categorias do cardápio">
            <ul className={styles.categoriesList} role="tablist">
              {categoriasFiltradas.map((cat) => (
                <li key={cat} role="presentation">
                  <button
                    role="tab"
                    aria-selected={categoriaSelecionada === cat}
                    aria-controls={`panel-${cat}`}
                    id={`tab-${cat}`}
                    className={`${styles.categoryBtn} ${categoriaSelecionada === cat ? styles.active : ''}`}
                    onClick={() => setCategoriaSelecionada(cat)}
                  >
                    {cat === 'todas' ? 'TODOS' : cat.toUpperCase()}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Grid de produtos */}
          <div className={styles.productsGrid} role="tabpanel" id={`panel-${categoriaSelecionada}`} aria-label={categoriaSelecionada === 'todas' ? 'Todos os produtos' : `Categoria ${categoriaSelecionada}`}>
            {error ? (
              <div className={styles.error}>
                <p>Erro ao carregar produtos. Tente novamente.</p>
                <button className={styles.retryBtn} onClick={() => refetch()}>
                  Tentar novamente
                </button>
              </div>
            ) : produtos.length === 0 ? (
              <div className={styles.empty}>
                <p>Nenhum produto encontrado nesta categoria.</p>
              </div>
            ) : (
              produtos.map((produto) => (
                <ProductCard
                  key={produto.id}
                  produto={produto}
                  onAddToCart={handleAddToCart}
                  onVerDetalhes={handleVerDetalhes}
                />
              ))
            )}
          </div>
        </div>
      </section>

      {/* Modal de detalhes do produto */}
      <Modal
        isOpen={!!produtoModal}
        onClose={() => setProdutoModal(null)}
        title={produtoModal?.nome}
        size="md"
      >
        {produtoModal && (
          <div className={styles.modalContent}>
            <img
              src={produtoModal.imagem || '/placeholder-product.jpg'}
              alt={produtoModal.nome}
              className={styles.modalImage}
            />
            <p className={styles.modalDescription}>{produtoModal.descricao}</p>
            <div className={styles.modalPrice}>
              <span className={styles.priceLabel}>Preço:</span>
              <span className={styles.priceValue}>
                R$ {produtoModal.preco.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setProdutoModal(null)}
              >
                Fechar
              </button>
              <button
                className={styles.modalAddBtn}
                onClick={() => {
                  handleAddToCart(produtoModal);
                  setProdutoModal(null);
                }}
                disabled={!produtoModal.disponivel}
              >
                {produtoModal.disponivel ? 'Adicionar ao Carrinho' : 'Indisponível'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default CardapioPage;