/**
 * Painel do Entregador - RF-11 (Entregador)
 * Interface para entregadores gerenciarem suas entregas
 * Status: aceita → retirada → em_rota → entregue/falha
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Header, ToastContainer, LoadingOverlay, Button, Badge, Modal } from '@components';
import { useToast } from '@hooks';
import { api } from '@api/client';
import { formatarData, formatarMoeda } from '@shared/utils';
import styles from './EntregadorPage.module.css';

type Entrega = {
  id: number;
  pedido_id: number;
  status: 'pendente' | 'aceita' | 'retirada' | 'em_rota' | 'entregue' | 'falha';
  entregador_id: number | null;
  saida_em: string | null;
  entregue_em: string | null;
  latitude: number | null;
  longitude: number | null;
  observacoes: string | null;
  cliente_nome: string;
  cliente_telefone: string;
  cep: string;
  logradouro: string;
  numero_endereco: string;
  bairro: string;
  complemento: string | null;
  referencia: string | null;
  valor_total: number;
  forma_pagamento: string;
  observacoes_pagamento: string | null;
  itens: Array<{
    nome: string;
    quantidade: number;
    preco_unitario: number;
    observacoes: string | null;
  }>;
};

const statusOrder = ['retirada', 'aceita', 'em_rota'] as const;
type StatusAtivo = typeof statusOrder[number];

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pendente: 'Pendente',
    aceita: 'Aceita',
    retirada: 'Retirada',
    em_rota: 'Em Rota',
    entregue: 'Entregue',
    falha: 'Falha',
  };
  return labels[status] || status;
};

const getStatusColor = (status: string) => {
  const colors: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
    pendente: 'warning',
    aceita: 'info',
    retirada: 'default',
    em_rota: 'primary',
    entregue: 'success',
    falha: 'error',
  };
  return colors[status] || 'default';
};

const getNextStatus = (current: string): StatusAtivo | 'entregue' | 'falha' | null => {
  const transitions: Record<string, StatusAtivo | 'entregue' | 'falha'> = {
    aceita: 'retirada',
    retirada: 'em_rota',
    em_rota: 'entregue',
  };
  return transitions[current] || null;
};

export function EntregadorPage() {
  const { showToast } = useToast();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const locationIntervalRef = useRef<number | null>(null);

  const loadEntregas = useCallback(async () => {
    try {
      const data = await api.get<Entrega[]>('/entregas/entregador/minhas/ativas');
      setEntregas(data);
    } catch (error) {
      console.error('Erro ao carregar entregas:', error);
      showToast('Erro ao carregar entregas', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Conectar WebSocket
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const wsUrl = `${process.env.WS_URL || 'ws://localhost:3001'}?token=${token}`;
    const websocket = new WebSocket(wsUrl);
    setWs(websocket);

    websocket.onopen = () => {
      console.log('WebSocket conectado - Entregador');
      websocket.send(JSON.stringify({ type: 'subscribe', events: ['entrega_atribuida', 'entrega_atualizada'] }));
    };

    websocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'entrega_atribuida' || msg.type === 'entrega_atualizada') {
          loadEntregas();
        }
      } catch (e) {
        console.error('Erro ao processar mensagem WS:', e);
      }
    };

    return () => {
      websocket.close();
    };
  }, [loadEntregas]);

  // Iniciar rastreamento de localização GPS
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('Geolocalização não suportada', 'warning');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
      },
      (error) => {
        console.error('Erro GPS:', error);
        if (error.code === error.PERMISSION_DENIED) {
          showToast('Permissão de localização negada', 'warning');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    );

    setLocationWatchId(watchId);

    // Enviar localização a cada 10 segundos para entregas ativas
    const interval = setInterval(async () => {
      if (!currentLocation) return;

      const entregasAtivas = entregas.filter(e =>
        ['aceita', 'retirada', 'em_rota'].includes(e.status)
      );

      for (const entrega of entregasAtivas) {
        try {
          await api.put(`/entregas/${entrega.id}/localizacao`, {
            latitude: currentLocation.lat,
            longitude: currentLocation.lng,
          });
        } catch (e) {
          console.error('Erro ao enviar localização:', e);
        }
      }
    }, 10000);

    locationIntervalRef.current = interval;
  }, [entregas, currentLocation, showToast]);

  const stopLocationTracking = useCallback(() => {
    if (locationWatchId !== null) {
      navigator.geolocation.clearWatch(locationWatchId);
      setLocationWatchId(null);
    }
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, [locationWatchId]);

  useEffect(() => {
    loadEntregas();
    startLocationTracking();
    return () => stopLocationTracking();
  }, [loadEntregas, startLocationTracking, stopLocationTracking]);

  const handleUpdateStatus = async (entrega: Entrega, novoStatus: string) => {
    setUpdatingId(entrega.id.toString());
    try {
      await api.put(`/entregas/${entrega.id}`, { status: novoStatus });
      showToast(`Entrega #${entrega.pedido_id} - ${getStatusLabel(novoStatus)}`, 'success');
      loadEntregas();
    } catch (error: any) {
      showToast(error.message || 'Erro ao atualizar status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleVerDetalhes = (entrega: Entrega) => {
    setSelectedEntrega(entrega);
  };

  const handleFecharModal = () => {
    setSelectedEntrega(null);
  };

  const formatEndereco = (entrega: Entrega) => {
    return `${entrega.logradouro}, ${entrega.numero_endereco}${entrega.complemento ? ', ' + entrega.complemento : ''} - ${entrega.bairro}${entrega.referencia ? ' (' + entrega.referencia + ')' : ''}`;
  };

  const getMapsLink = (entrega: Entrega) => {
    const endereco = encodeURIComponent(`${entrega.logradouro}, ${entrega.numero_endereco}, ${entrega.bairro}, ${entrega.cep}`);
    return `https://www.google.com/maps/dir/?api=1&destination=${endereco}`;
  };

  if (isLoading) {
    return (
      <>
        <Header currentPage="entregador" />
        <ToastContainer />
        <LoadingOverlay message="Carregando suas entregas..." />
      </>
    );
  }

  // Separar entregas ativas e finalizadas hoje
  const ativas = entregas.filter(e => statusOrder.includes(e.status as StatusAtivo));
  const finalizadas = entregas.filter(e => ['entregue', 'falha'].includes(e.status));

  return (
    <>
      <Header currentPage="entregador" />
      <ToastContainer />

      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.title}>PAINEL DO ENTREGADOR</h1>
              <p className={styles.subtitle}>Gerencie suas entregas ativas</p>
            </div>
            <div className={styles.headerActions}>
              <Button variant="secondary" onClick={loadEntregas} disabled={isLoading}>
                Atualizar
              </Button>
            </div>
          </div>
          <div className={styles.stats}>
            <span className={styles.stat}>
              Ativas: <strong>{ativas.length}</strong>
            </span>
            <span className={styles.stat}>
              Entregues hoje: <strong>{finalizadas.filter(e => e.status === 'entregue').length}</strong>
            </span>
            {currentLocation && (
              <span className={styles.stat} style={{ color: 'var(--color-success)' }}>
                GPS: Ativo
              </span>
            )}
          </div>
        </header>

        {/* Entregas Ativas */}
        <section className={styles.section} aria-labelledby="ativas-title">
          <h2 id="ativas-title" className={styles.sectionTitle}>ENTREGAS ATIVAS</h2>

          {ativas.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📦</div>
              <p>Nenhuma entrega ativa no momento</p>
              <p className={styles.emptyHint}>Novas entregas aparecerão aqui automaticamente</p>
            </div>
          ) : (
            <div className={styles.list} role="list" aria-label="Entregas ativas">
              {ativas
                .sort((a, b) => {
                  const orderA = statusOrder.indexOf(a.status as StatusAtivo);
                  const orderB = statusOrder.indexOf(b.status as StatusAtivo);
                  return orderA - orderB;
                })
                .map((entrega) => (
                  <article key={entrega.id} className={styles.card} role="listitem">
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTop}>
                        <span className={styles.pedidoNumber}>Pedido #{entrega.pedido_id}</span>
                        <Badge variant={getStatusColor(entrega.status) as any} className={styles.statusBadge}>
                          {getStatusLabel(entrega.status)}
                        </Badge>
                      </div>
                      <span className={styles.cardTime}>
                        {entrega.saida_em ? `Iniciada: ${new Date(entrega.saida_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Aguardando retirada'}
                      </span>
                    </div>

                    <div className={styles.cardClient}>
                      <div className={styles.clientInfo}>
                        <span className={styles.clientName}>{entrega.cliente_nome}</span>
                        <a href={`tel:${entrega.cliente_telefone}`} className={styles.clientPhone}>
                          📞 {entrega.cliente_telefone}
                        </a>
                      </div>
                      <div className={styles.address}>
                        📍 {formatEndereco(entrega)}
                      </div>
                    </div>

                    <div className={styles.cardItems}>
                      {entrega.itens.slice(0, 3).map((item, idx) => (
                        <div key={idx} className={styles.item}>
                          <span className={styles.itemQty}>{item.quantidade}x</span>
                          <span className={styles.itemName}>{item.nome}</span>
                        </div>
                      ))}
                      {entrega.itens.length > 3 && (
                        <div className={styles.moreItems}>
                          +{entrega.itens.length - 3} itens
                        </div>
                      )}
                    </div>

                    {entrega.observacoes_pagamento && (
                      <div className={styles.paymentNote}>
                        💰 {entrega.forma_pagamento.replace('_', ' ').toUpperCase()}
                        {entrega.observacoes_pagamento && ` - ${entrega.observacoes_pagamento}`}
                      </div>
                    )}

                    <div className={styles.cardFooter}>
                      <div className={styles.footerLeft}>
                        <span className={styles.total}>Total: {formatarMoeda(entrega.valor_total)}</span>
                      </div>
                      <div className={styles.footerActions}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerDetalhes(entrega)}
                        >
                          Ver Detalhes
                        </Button>
                        <a
                          href={getMapsLink(entrega)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.navBtn}
                        >
                          🗺️ Navegar
                        </a>
                        {(() => {
                          const nextStatus = getNextStatus(entrega.status);
                          if (nextStatus) {
                            return (
                              <Button
                                variant={nextStatus === 'entregue' ? 'success' : 'primary'}
                                size="sm"
                                onClick={() => handleUpdateStatus(entrega, nextStatus)}
                                disabled={updatingId === entrega.id.toString()}
                                className={styles.actionBtn}
                              >
                                {updatingId === entrega.id.toString() ? '...' : nextStatus === 'entregue' ? '✓ Entregar' : `→ ${getStatusLabel(nextStatus)}`}
                              </Button>
                            );
                          }
                          return null;
                        })()}
                        {(entrega.status === 'em_rota' || entrega.status === 'retirada') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatus(entrega, 'falha')}
                            className={styles.failBtn}
                          >
                            ⚠ Falha
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
            </div>
          )}
        </section>

        {/* Entregas Finalizadas Hoje */}
        {finalizadas.length > 0 && (
          <section className={styles.section} aria-labelledby="finalizadas-title">
            <h2 id="finalizadas-title" className={styles.sectionTitle}>FINALIZADAS HOJE</h2>
            <div className={styles.finalizadasList}>
              {finalizadas
                .sort((a, b) => new Date(b.entregue_em || '').getTime() - new Date(a.entregue_em || '').getTime())
                .slice(0, 10)
                .map((entrega) => (
                  <div key={entrega.id} className={styles.finalizadaCard}>
                    <div className={styles.finalizadaInfo}>
                      <span className={styles.finalizadaNumber}>#{entrega.pedido_id}</span>
                      <Badge variant={getStatusColor(entrega.status) as any}>
                        {getStatusLabel(entrega.status)}
                      </Badge>
                    </div>
                    <div className={styles.finalizadaMeta}>
                      <span>{entrega.cliente_nome}</span>
                      <span>{formatarMoeda(entrega.valor_total)}</span>
                      <span>{entrega.entregue_em ? new Date(entrega.entregue_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

      </div>

      {/* Modal Detalhes */}
      <Modal
        isOpen={!!selectedEntrega}
        onClose={handleFecharModal}
        title={`Entrega #${selectedEntrega?.pedido_id}`}
        size="lg"
      >
        {selectedEntrega && (
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalStatus}>
                <Badge variant={getStatusColor(selectedEntrega.status) as any}>
                  {getStatusLabel(selectedEntrega.status)}
                </Badge>
                <span className={styles.modalDate}>
                  {formatarData(selectedEntrega.saida_em || selectedEntrega.entregue_em || '')}
                </span>
              </div>
              <div className={styles.modalTotal}>
                Total: {formatarMoeda(selectedEntrega.valor_total)}
              </div>
            </div>

            <div className={styles.modalSection}>
              <h4 className={styles.modalSectionTitle}>Cliente</h4>
              <p className={styles.modalText}>{selectedEntrega.cliente_nome}</p>
              <a href={`tel:${selectedEntrega.cliente_telefone}`} className={styles.modalLink}>
                📞 {selectedEntrega.cliente_telefone}
              </a>
            </div>

            <div className={styles.modalSection}>
              <h4 className={styles.modalSectionTitle}>Endereço de Entrega</h4>
              <p className={styles.addressText}>
                {formatEndereco(selectedEntrega)}
                <br />
                CEP: {selectedEntrega.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}
              </p>
              <a
                href={getMapsLink(selectedEntrega)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.navBtn}
                style={{ marginTop: 'var(--spacing-sm)', display: 'inline-flex' }}
              >
                🗺️ Abrir no Google Maps
              </a>
            </div>

            <div className={styles.modalSection}>
              <h4 className={styles.modalSectionTitle}>Itens do Pedido</h4>
              {selectedEntrega.itens.map((item, idx) => (
                <div key={idx} className={styles.modalItem}>
                  <div className={styles.modalItemInfo}>
                    <span className={styles.modalItemName}>
                      {item.quantidade}x {item.nome}
                    </span>
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

            <div className={styles.modalSection}>
              <h4 className={styles.modalSectionTitle}>Pagamento</h4>
              <p className={styles.paymentText}>
                {selectedEntrega.forma_pagamento.replace('_', ' ').toUpperCase()}
                {selectedEntrega.observacoes_pagamento && (
                  <> - {selectedEntrega.observacoes_pagamento}</>
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

export default EntregadorPage;