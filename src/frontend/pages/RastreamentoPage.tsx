/**
 * Página de Rastreamento de Pedido - RF-12
 * Cliente acompanha status do pedido em tempo real com mapa
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Header, ToastContainer, LoadingOverlay, Button, Badge } from '@components';
import { useToast } from '@hooks';
import { api } from '@api/client';
import { formatarData, formatarMoeda } from '@shared/utils';
import { Pedido } from '@shared/types';
import styles from './RastreamentoPage.module.css';

type RastreamentoData = {
  pedido: {
    id: number;
    numero: string;
    status: string;
    endereco_entrega: string;
    valor_total: number;
  };
  entrega: {
    status: string;
    entregador_nome: string | null;
    entregador_telefone: string | null;
    saida_em: string | null;
    entregue_em: string | null;
    latitude: number | null;
    longitude: number | null;
    observacoes: string | null;
  };
};

const statusOrder = [
  'pendente',
  'confirmado',
  'preparando',
  'pronto',
  'saiu_entrega',
  'entrega',
  'entregue',
  'cancelado',
] as const;

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pendente: 'Pedido Recebido',
    confirmado: 'Confirmado',
    preparando: 'Em Preparo',
    pronto: 'Pronto para Entrega',
    saiu_entrega: 'Saiu para Entrega',
    entrega: 'Em Entrega',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  };
  return labels[status] || status;
};

const getStatusColor = (status: string) => {
  const colors: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error' | 'primary'> = {
    pendente: 'warning',
    confirmado: 'info',
    preparando: 'default',
    pronto: 'success',
    saiu_entrega: 'primary',
    entrega: 'primary',
    entregue: 'success',
    cancelado: 'error',
  };
  return colors[status] || 'default';
};

const getStatusIcon = (status: string) => {
  const icons: Record<string, string> = {
    pendente: '📋',
    confirmado: '✅',
    preparando: '🍳',
    pronto: '📦',
    saiu_entrega: '🚚',
    entrega: '📍',
    entregue: '🎉',
    cancelado: '❌',
  };
  return icons[status] || '📋';
};

export function RastreamentoPage() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [data, setData] = useState<RastreamentoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [entregadorLocation, setEntregadorLocation] = useState<{ lat: number; lng: number } | null>(null);
  const mapLoaded = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<RastreamentoData>(`/entregas/minhas/pedido/${id}`);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar rastreamento');
      showToast('Erro ao carregar rastreamento', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [id, showToast]);

  // Conectar WebSocket para atualizações em tempo real
  useEffect(() => {
    const token = localStorage.getItem('cliente_token');
    if (!token || !id) return;

    const wsUrl = `${process.env.WS_URL || 'ws://localhost:3001'}?token=${token}`;
    const websocket = new WebSocket(wsUrl);
    setWs(websocket);

    websocket.onopen = () => {
      console.log('WebSocket conectado - Rastreamento');
      websocket.send(JSON.stringify({ type: 'subscribe', events: ['pedido_atualizado', 'entrega_localizacao'] }));
    };

    websocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pedido_atualizado' && msg.pedido_id === parseInt(id)) {
          loadData();
        } else if (msg.type === 'entrega_localizacao' && msg.pedido_id === parseInt(id)) {
          if (msg.latitude && msg.longitude) {
            setEntregadorLocation({ lat: msg.latitude, lng: msg.longitude });
          }
        }
      } catch (e) {
        console.error('Erro ao processar mensagem WS:', e);
      }
    };

    return () => {
      websocket.close();
    };
  }, [id, loadData]);

  // Polling fallback a cada 15 segundos
  useEffect(() => {
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentStatusIndex = data ? statusOrder.indexOf(data.pedido.status as any) : -1;
  const isFinal = data ? ['entregue', 'cancelado'].includes(data.pedido.status) : false;
  const isEntrega = data ? ['saiu_entrega', 'entrega'].includes(data.pedido.status) : false;

  if (isLoading) {
    return (
      <>
        <Header currentPage="rastreamento" />
        <ToastContainer />
        <LoadingOverlay message="Carregando rastreamento..." />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Header currentPage="rastreamento" />
        <ToastContainer />
        <div className={styles.errorContainer}>
          <div className={styles.errorCard}>
            <h1>❌</h1>
            <h2>Pedido não encontrado</h2>
            <p>{error || 'Não foi possível carregar as informações do pedido.'}</p>
            <Link to="/meus-pedidos">
              <Button variant="primary">Voltar aos Meus Pedidos</Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header currentPage="rastreamento" />
      <ToastContainer />

      <div className={styles.page}>
        {/* Header do Pedido */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div>
              <span className={styles.pedidoNumber}>Pedido #{data.pedido.numero}</span>
              <h1 className={styles.title}>RASTREAMENTO DO PEDIDO</h1>
            </div>
            <div className={styles.headerStatus}>
              <Badge variant={getStatusColor(data.pedido.status) as any} className={styles.statusBadge}>
                {getStatusIcon(data.pedido.status)} {getStatusLabel(data.pedido.status)}
              </Badge>
            </div>
          </div>
        </header>

        {/* Timeline de Status */}
        <section className={styles.timeline} aria-label="Progresso do pedido">
          {statusOrder.map((status, index) => {
            const isCurrent = index === currentStatusIndex;
            const isCompleted = index < currentStatusIndex;
            const isFuture = index > currentStatusIndex;
            const showStep = !isFuture || status === 'entregue' || status === 'cancelado';

            if (!showStep && status !== 'entregue' && status !== 'cancelado') return null;

            return (
              <div
                key={status}
                className={`${styles.timelineItem} ${isCurrent ? styles.current : ''} ${isCompleted ? styles.completed : ''} ${isFuture ? styles.future : ''}`}
              >
                <div className={styles.timelineMarker}>
                  <div className={styles.markerDot} />
                  {index < statusOrder.length - 1 && <div className={styles.markerLine} />}
                </div>
                <div className={styles.timelineContent}>
                  <span className={styles.timelineIcon}>{getStatusIcon(status)}</span>
                  <div className={styles.timelineText}>
                    <span className={styles.timelineLabel}>{getStatusLabel(status)}</span>
                    {isCurrent && <span className={styles.timelineNow}>AGORA</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Mapa e Entregador - apenas durante entrega */}
        {isEntrega && (
          <section className={styles.mapSection} aria-labelledby="mapa-title">
            <h2 id="mapa-title" className={styles.sectionTitle}>📍 ACOMPANHAR ENTREGADOR</h2>

            <div className={styles.mapWrapper}>
              <div className={styles.mapContainer} id="mapa" role="application" aria-label="Mapa de rastreamento da entrega">
                {entregadorLocation ? (
                  <iframe
                    src={`https://www.google.com/maps/embed/v1/directions?key=${process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyDemoKey'}&origin=${entregadorLocation.lat},${entregadorLocation.lng}&destination=${encodeURIComponent(data.pedido.endereco_entrega)}&mode=driving`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Rota do entregador até seu endereço"
                  />
                ) : (
                  <div className={styles.mapLoading}>
                    <div className={styles.mapSpinner} />
                    <p>Localizando entregador...</p>
                    <p className={styles.mapHint}>O entregador atualizará a posição em breve</p>
                  </div>
                )}
              </div>

              {data.entrega.entregador_nome && (
                <div className={styles.entregadorInfo}>
                  <div className={styles.entregadorAvatar}>
                    {data.entrega.entregador_nome.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.entregadorDetails}>
                    <span className={styles.entregadorNome}>{data.entrega.entregador_nome}</span>
                    {data.entrega.entregador_telefone && (
                      <a href={`tel:${data.entrega.entregador_telefone}`} className={styles.entregadorPhone}>
                        📞 {data.entrega.entregador_telefone}
                      </a>
                    )}
                  </div>
                  {entregadorLocation && (
                    <span className={styles.gpsBadge}>GPS Ativo</span>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Pedido Entregue - Sucesso */}
        {data.pedido.status === 'entregue' && (
          <section className={styles.successSection} aria-labelledby="sucesso-title">
            <div className={styles.successCard}>
              <div className={styles.successIcon}>🎉</div>
              <h2 id="sucesso-title" className={styles.successTitle}>PEDIDO ENTREGUE!</h2>
              <p className={styles.successText}>
                Seu pedido foi entregue com sucesso. Agradecemos a preferência!
              </p>
              {data.entrega.entregue_em && (
                <p className={styles.successTime}>
                  Entregue em {new Date(data.entrega.entregue_em).toLocaleString('pt-BR')}
                </p>
              )}
              <div className={styles.successActions}>
                <Link to={`/avaliar/${data.pedido.id}`} className={styles.reviewBtn}>
                  <Button variant="primary" size="lg">⭐ Avaliar Pedido</Button>
                </Link>
                <Link to="/meus-pedidos">
                  <Button variant="secondary" size="lg">Ver Meus Pedidos</Button>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Detalhes do Pedido */}
        <section className={styles.detailsSection} aria-labelledby="detalhes-title">
          <h2 id="detalhes-title" className={styles.sectionTitle}>📋 DETALHES DO PEDIDO</h2>

          <div className={styles.detailsGrid}>
            <div className={styles.detailCard}>
              <h3 className={styles.detailTitle}>Itens</h3>
              <div className={styles.itemsList}>
                  <p className={styles.emptyText}>Itens do pedido serão exibidos aqui</p>
                </div>
            </div>

            <div className={styles.detailCard}>
              <h3 className={styles.detailTitle}>Endereço de Entrega</h3>
              <p className={styles.addressText}>{data.pedido.endereco_entrega}</p>
            </div>

            <div className={styles.detailCard}>
              <h3 className={styles.detailTitle}>Pagamento</h3>
              <p className={styles.paymentText}>
                Total: {formatarMoeda(data.pedido.valor_total)}
              </p>
            </div>

            <div className={styles.detailCard}>
              <h3 className={styles.detailTitle}>Histórico</h3>
              <div className={styles.history}>
                <div className={styles.historyItem}>
                  <span className={styles.historyTime}>
                    {formatarData(data.pedido.numero)} {/* placeholder - would need created_at */}
                  </span>
                  <span className={styles.historyEvent}>Pedido realizado</span>
                </div>
                {data.entrega.saida_em && (
                  <div className={styles.historyItem}>
                    <span className={styles.historyTime}>
                      {new Date(data.entrega.saida_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={styles.historyEvent}>Saiu para entrega</span>
                  </div>
                )}
                {data.entrega.entregue_em && (
                  <div className={styles.historyItem}>
                    <span className={styles.historyTime}>
                      {new Date(data.entrega.entregue_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={styles.historyEvent}>Entregue</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Ações */}
        <div className={styles.actions}>
          <Link to="/meus-pedidos">
            <Button variant="secondary" size="lg" className={styles.fullWidth}>
              ← Voltar aos Meus Pedidos
            </Button>
          </Link>
          <Link to="/cardapio">
            <Button variant="primary" size="lg" className={styles.fullWidth}>
              Fazer Novo Pedido
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}

export default RastreamentoPage;