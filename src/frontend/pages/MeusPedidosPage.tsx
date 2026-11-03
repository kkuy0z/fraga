/**
 * Página de Meus Pedidos (detalhada)
 */

import { useEffect, useState } from 'react';
import { Header, ToastContainer, LoadingOverlay, Modal, Button } from '@components';
import { useAuth, useToast } from '@hooks';
import { api } from '@api/client';
import { formatarData, formatarMoeda } from '@shared/utils';
import { Pedido } from '@shared/types';
import styles from './MeusPedidosPage.module.css';

export function MeusPedidosPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);

  useEffect(() => {
    if (user) {
      loadPedidos();
    }
  }, [user]);

  const loadPedidos = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<Pedido[]>('/cliente/pedidos');
      setPedidos(data);
    } catch {
      showToast('Erro ao carregar pedidos', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerDetalhes = (pedido: Pedido) => {
    setSelectedPedido(pedido);
  };

  const handleFecharModal = () => {
    setSelectedPedido(null);
  };

  const handleRecomprar = async (pedido: Pedido) => {
    try {
      await api.post('/cliente/pedidos/recomprar', { pedido_id: pedido.id });
      showToast('Itens adicionados ao carrinho!', 'success');
      handleFecharModal();
      window.location.href = '/carrinho';
    } catch {
      showToast('Erro ao adicionar itens ao carrinho', 'error');
    }
  };

  if (authLoading || !user) {
    return (
      <>
        <Header currentPage="pedidos" />
        <ToastContainer />
        <LoadingOverlay message="Carregando..." />
      </>
    );
  }

  return (
    <>
      <Header currentPage="pedidos" />
      <ToastContainer />
      {isLoading && <LoadingOverlay message="Carregando pedidos..." />}

      <section className={styles.pedidos} aria-label="Meus Pedidos">
        <div className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.title}>MEUS PEDIDOS</h1>
            <p className={styles.subtitle}>Acompanhe o histórico dos seus pedidos</p>
          </header>

          {pedidos.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon} aria-hidden="true">📦</div>
              <h2 className={styles.emptyTitle}>Nenhum pedido encontrado</h2>
              <p className={styles.emptyText}>
                Faça seu primeiro pedido e acompanhe aqui
              </p>
              <Button variant="primary" size="lg" onClick={() => window.location.href = '/cardapio'}>
                Ver Cardápio
              </Button>
            </div>
          ) : (
            <div className={styles.list} role="list" aria-label="Lista de pedidos">
              {pedidos.map(pedido => (
                <article key={pedido.id} className={styles.card} role="listitem">
                  <header className={styles.cardHeader}>
                    <div className={styles.cardInfo}>
                      <span className={styles.cardNumber}>Pedido #{pedido.numero}</span>
                      <span className={`${styles.cardStatus} ${styles[pedido.status as keyof typeof styles]}`}>
                        {pedido.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className={styles.cardMeta}>
                      <span className={styles.cardDate}>{formatarData(pedido.created_at)}</span>
                      <span className={styles.cardTotal}>{formatarMoeda(pedido.total)}</span>
                    </div>
                  </header>

                  <div className={styles.cardItems}>
                    {pedido.itens.slice(0, 3).map(item => (
                      <div key={item.produto_id} className={styles.item}>
                        <span className={styles.itemName}>{item.produto_nome}</span>
                        <span className={styles.itemQty}>x{item.quantidade}</span>
                        <span className={styles.itemPrice}>{formatarMoeda(item.preco * item.quantidade)}</span>
                      </div>
                    ))}
                    {pedido.itens.length > 3 && (
                      <div className={styles.moreItems}>
                        +{pedido.itens.length - 3} {pedido.itens.length - 3 === 1 ? 'item' : 'itens'}
                      </div>
                    )}
                  </div>

                  <footer className={styles.cardFooter}>
                    <div className={styles.footerInfo}>
                      {pedido.endereco_entrega && (
                        <span className={styles.deliveryInfo}>
                          📍 {pedido.endereco_entrega.logradouro}, {pedido.endereco_entrega.numero}
                          {pedido.endereco_entrega.complemento && ` - ${pedido.endereco_entrega.complemento}`}
                          {pedido.endereco_entrega.bairro && ` - ${pedido.endereco_entrega.bairro}`}
                        </span>
                      )}
                      <span className={styles.paymentInfo}>
                        💳 {pedido.forma_pagamento.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className={styles.footerActions}>
                      <Button variant="ghost" size="sm" onClick={() => handleVerDetalhes(pedido)}>
                        Ver Detalhes
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleRecomprar(pedido)}>
                        Comprar Novamente
                      </Button>
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Modal de Detalhes */}
      <Modal
        isOpen={!!selectedPedido}
        onClose={handleFecharModal}
        title={`Pedido #${selectedPedido?.numero}`}
        size="lg"
      >
        {selectedPedido && (
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalStatus}>
                <span className={`${styles.statusBadge} ${styles[selectedPedido.status as keyof typeof styles]}`}>
                  {selectedPedido.status.replace('_', ' ').toUpperCase()}
                </span>
                <span className={styles.modalDate}>{formatarData(selectedPedido.created_at)}</span>
              </div>
              <div className={styles.modalTotal}>
                Total: {formatarMoeda(selectedPedido.total)}
              </div>
            </div>

            <div className={styles.modalItems}>
              <h4 className={styles.modalSectionTitle}>Itens do Pedido</h4>
              {selectedPedido.itens.map(item => (
                <div key={item.produto_id} className={styles.modalItem}>
                  <div className={styles.modalItemInfo}>
                    <span className={styles.modalItemName}>{item.produto_nome}</span>
                    {item.observacoes && (
                      <span className={styles.modalItemNotes}>{item.observacoes}</span>
                    )}
                  </div>
                  <div className={styles.modalItemPrice}>
                    <span>{item.quantidade}x {formatarMoeda(item.preco)}</span>
                    <span>{formatarMoeda(item.preco * item.quantidade)}</span>
                  </div>
                </div>
              ))}
            </div>

            {selectedPedido.endereco_entrega && (
              <div className={styles.modalSection}>
                <h4 className={styles.modalSectionTitle}>Endereço de Entrega</h4>
                <p className={styles.addressText}>
                  {selectedPedido.endereco_entrega.logradouro}, {selectedPedido.endereco_entrega.numero}
                  {selectedPedido.endereco_entrega.complemento && ` - ${selectedPedido.endereco_entrega.complemento}`}
                  <br />
                  {selectedPedido.endereco_entrega.bairro} - {selectedPedido.endereco_entrega.cidade}/{selectedPedido.endereco_entrega.estado}
                  <br />
                  CEP: {selectedPedido.endereco_entrega.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}
                  {selectedPedido.endereco_entrega.referencia && (
                    <>
                      <br />
                      <span>Ref: {selectedPedido.endereco_entrega.referencia}</span>
                    </>
                  )}
                </p>
              </div>
            )}

            <div className={styles.modalSection}>
              <h4 className={styles.modalSectionTitle}>Pagamento</h4>
              <p className={styles.paymentText}>
                Forma: {selectedPedido.forma_pagamento.replace('_', ' ').toUpperCase()}
                {selectedPedido.troco_para && (
                  <>
                    <br />
                    Troco para: {formatarMoeda(selectedPedido.troco_para)}
                  </>
                )}
              </p>
            </div>

            {selectedPedido.observacoes && (
              <div className={styles.modalSection}>
                <h4 className={styles.modalSectionTitle}>Observações</h4>
                <p className={styles.notesText}>{selectedPedido.observacoes}</p>
              </div>
            )}

            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={handleFecharModal}>Fechar</Button>
              <Button variant="primary" onClick={() => handleRecomprar(selectedPedido)}>
                Comprar Novamente
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default MeusPedidosPage;