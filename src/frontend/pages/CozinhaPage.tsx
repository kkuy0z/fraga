/**
 * Painel da Cozinha - RF-11
 * Interface para equipe de cozinha gerenciar pedidos em preparo
 * Status: pendente → confirmado → preparando → pronto
 */

import { useEffect, useState, useCallback } from 'react';
import { Header, ToastContainer, LoadingOverlay, Button, Badge, Modal } from '@components';
import { useToast } from '@hooks';
import { api } from '@api/client';
import { formatarData, formatarMoeda } from '@shared/utils';
import { Pedido } from '@shared/types';
import styles from './CozinhaPage.module.css';

type PedidoCozinha = Pedido & {
  tempo_decorrido?: number; // em minutos
};

export function CozinhaPage() {
  const { showToast } = useToast();
  const [pedidos, setPedidos] = useState<PedidoCozinha[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedPedido, setSelectedPedido] = useState<PedidoCozinha | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Status válidos para a cozinha
  const statusCozinha = ['pendente', 'confirmado', 'preparando', 'pronto'] as const;
  type StatusCozinha = typeof statusCozinha[number];

  const getNextStatus = (current: string): StatusCozinha | null => {
    const idx = statusCozinha.indexOf(current as StatusCozinha);
    if (idx >= 0 && idx < statusCozinha.length - 1) {
      return statusCozinha[idx + 1];
    }
    return null;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pendente: 'Pendente',
      confirmado: 'Confirmado',
      preparando: 'Em Preparo',
      pronto: 'Pronto',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, 'default' | 'warning' | 'info' | 'success'> = {
      pendente: 'warning',
      confirmado: 'info',
      preparando: 'default',
      pronto: 'success',
    };
    return colors[status] || 'default';
  };

  const loadPedidos = useCallback(async () => {
    try {
      // Buscar pedidos que estão na cozinha (pendente a pronto)
      const data = await api.get<Pedido[]>('/pedidos/admin', {
        status: 'pendente,confirmado,preparando,pronto',
        order: 'asc',
      });
      // Calcular tempo decorrido
      const agora = new Date();
      const pedidosComTempo = data.map(p => ({
        ...p,
        tempo_decorrido: Math.floor((agora.getTime() - new Date(p.created_at).getTime()) / 60000),
      }));
      setPedidos(pedidosComTempo);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
      showToast('Erro ao carregar pedidos', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Conectar WebSocket para atualizações em tempo real
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const wsUrl = `${process.env.WS_URL || 'ws://localhost:3001'}?token=${token}`;
    const websocket = new WebSocket(wsUrl);
    setWs(websocket);

    websocket.onopen = () => {
      console.log('WebSocket conectado - Cozinha');
      websocket.send(JSON.stringify({ type: 'subscribe', events: ['pedido_novo', 'pedido_atualizado'] }));
    };

    websocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pedido_novo' || msg.type === 'pedido_atualizado') {
          loadPedidos();
        }
      } catch (e) {
        console.error('Erro ao processar mensagem WS:', e);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      websocket.close();
    };
  }, [loadPedidos]);

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadPedidos, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadPedidos]);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  const handleUpdateStatus = async (pedido: PedidoCozinha, novoStatus: StatusCozinha) => {
    setUpdatingId(pedido.id.toString());
    try {
      await api.put(`/pedidos/${pedido.id}/status`, { status: novoStatus });
      showToast(`Pedido #${pedido.numero} - ${getStatusLabel(novoStatus)}`, 'success');
      loadPedidos();
    } catch (error: any) {
      showToast(error.message || 'Erro ao atualizar status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleVerDetalhes = (pedido: PedidoCozinha) => {
    setSelectedPedido(pedido);
  };

  const handleFecharModal = () => {
    setSelectedPedido(null);
  };

  if (isLoading) {
    return (
      <>
        <Header currentPage="cozinha" showAdminLink />
        <ToastContainer />
        <LoadingOverlay message="Carregando pedidos da cozinha..." />
      </>
    );
  }

  // Agrupar por status
  const pedidosPorStatus = statusCozinha.reduce((acc, status) => {
    acc[status] = pedidos.filter(p => p.status === status);
    return acc;
  }, {} as Record<StatusCozinha, PedidoCozinha[]>);

  const totalPedidos = pedidos.length;

  return (
    <>
      <Header currentPage="cozinha" showAdminLink />
      <ToastContainer />

      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>PAINEL DA COZINHA</h1>
              <p className={styles.subtitle}>Gerencie os pedidos em preparo</p>
            </div>
            <div className={styles.headerActions}>
              <label className={styles.autoRefreshLabel}>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                <span>Atualização automática (30s)</span>
              </label>
              <Button variant="secondary" onClick={loadPedidos} disabled={isLoading}>
                Atualizar Agora
              </Button>
            </div>
          </div>
          <div className={styles.stats}>
            <span className={styles.stat}>Total: <strong>{totalPedidos}</strong></span>
            {statusCozinha.map(status => (
              <span key={status} className={`${styles.stat} ${styles[status]}`}>
                {getStatusLabel(status)}: <strong>{pedidosPorStatus[status]?.length || 0}</strong>
              </span>
            ))}
          </div>
        </header>

        <div className={styles.grid} role="list" aria-label="Pedidos por status">
          {statusCozinha.map((status) => {
            const lista = pedidosPorStatus[status];
            const nextStatus = getNextStatus(status);

            return (
              <section key={status} className={`${styles.column} ${styles[status]}`} aria-labelledby={`col-${status}`}>
                <header className={styles.columnHeader}>
                  <h2 id={`col-${status}`} className={styles.columnTitle}>
                    {getStatusLabel(status)}
                    <span className={styles.columnCount}>{lista.length}</span>
                  </h2>
                </header>
                <div className={styles.columnContent} role="list">
                  {lista.length === 0 ? (
                    <div className={styles.empty}>
                      <p>Nenhum pedido</p>
                    </div>
                  ) : (
                    lista.map((pedido) => (
                      <article key={pedido.id} className={styles.card} role="listitem">
                        <div className={styles.cardHeader}>
                          <span className={styles.pedidoNumber}>#{pedido.numero}</span>
                          <span className={styles.pedidoTime}>
                            {pedido.tempo_decorrido !== undefined && (
                              <>
                                {pedido.tempo_decorrido}min
                                {pedido.tempo_decorrido > 30 && <span className={styles.alert}>⚠</span>}
                              </>
                            )}
                          </span>
                        </div>

                        <div className={styles.cardClient}>
                          <span className={styles.clientName}>{pedido.cliente_nome || 'Cliente não identificado'}</span>
                          {pedido.cliente_telefone && (
                            <span className={styles.clientPhone}>{pedido.cliente_telefone}</span>
                          )}
                        </div>

                        <div className={styles.cardItems}>
                          {pedido.itens.slice(0, 4).map((item) => (
                            <div key={item.produto_id} className={styles.item}>
                              <span className={styles.itemQty}>{item.quantidade}x</span>
                              <span className={styles.itemName}>{item.produto_nome}</span>
                              {item.personalizacoes.length > 0 && (
                                <span className={styles.itemCustom}>
                                  {item.personalizacoes.map(p => p.opcao_nome).join(', ')}
                                </span>
                              )}
                            </div>
                          ))}
                          {pedido.itens.length > 4 && (
                            <div className={styles.moreItems}>
                              +{pedido.itens.length - 4} itens
                            </div>
                          )}
                        </div>

                        {pedido.observacoes && (
                          <div className={styles.observacoes}>
                            📝 {pedido.observacoes}
                          </div>
                        )}

                        <div className={styles.cardFooter}>
                          <div className={styles.footerLeft}>
                            <span className={styles.deliveryType}>
                              {pedido.tipo_entrega === 'entrega' ? '🚚 Entrega' : '🏪 Retirada'}
                            </span>
                            <span className={styles.total}>{formatarMoeda(pedido.total)}</span>
                          </div>
                          <div className={styles.footerActions}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVerDetalhes(pedido)}
                            >
                              Ver
                            </Button>
                            {nextStatus && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleUpdateStatus(pedido, nextStatus)}
                                disabled={updatingId === pedido.id.toString()}
                                className={styles.actionBtn}
                              >
                                {updatingId === pedido.id.toString() ? '...' : nextStatus === 'pronto' ? '✓ Pronto' : `→ ${getStatusLabel(nextStatus)}`}
                              </Button>
                            )}
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Modal Detalhes */}
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
                <Badge variant={getStatusColor(selectedPedido.status) as any}>
                  {getStatusLabel(selectedPedido.status)}
                </Badge>
                <span className={styles.modalDate}>
                  {formatarData(selectedPedido.created_at)}
                </span>
              </div>
              <div className={styles.modalTotal}>
                Total: {formatarMoeda(selectedPedido.total)}
              </div>
            </div>

            <div className={styles.modalItems}>
              <h4 className={styles.modalSectionTitle}>Itens do Pedido</h4>
              {selectedPedido.itens.map((item) => (
                <div key={item.produto_id} className={styles.modalItem}>
                  <div className={styles.modalItemInfo}>
                    <span className={styles.modalItemName}>
                      {item.quantidade}x {item.produto_nome}
                    </span>
                    {item.personalizacoes.length > 0 && (
                      <span className={styles.modalItemCustom}>
                        {item.personalizacoes.map(p => `${p.grupo_nome}: ${p.opcao_nome}`).join('; ')}
                      </span>
                    )}
                    {item.observacoes && (
                      <span className={styles.modalItemNotes}>Obs: {item.observacoes}</span>
                    )}
                  </div>
                  <div className={styles.modalItemPrice}>
                    {formatarMoeda(item.preco_unitario * item.quantidade)}
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
                {selectedPedido.forma_pagamento.replace('_', ' ').toUpperCase()}
                {selectedPedido.troco_para && (
                  <>
                    <br />
                    Troco para: {formatarMoeda(selectedPedido.troco_para)}
                  </>
                )}
              </p>
            </div>

            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={handleFecharModal}>Fechar</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default CozinhaPage;