/**
 * Página de Pedido Confirmado
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Header, ToastContainer, LoadingOverlay, Button } from '@components';
import { useToast } from '@hooks';
import { api } from '@api/client';
import { formatarData, formatarMoeda } from '@shared/utils';
import { Pedido } from '@shared/types';
import styles from './PedidoConfirmadoPage.module.css';

export function PedidoConfirmadoPage() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadPedido();
    }
  }, [id]);

  const loadPedido = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<Pedido>(`/pedidos/${id}`);
      setPedido(data);
    } catch {
      showToast('Pedido não encontrado', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Header currentPage="confirmado" />
        <ToastContainer />
        <LoadingOverlay message="Carregando pedido..." />
      </>
    );
  }

  if (!pedido) {
    return (
      <>
        <Header currentPage="confirmado" />
        <ToastContainer />
        <div className={styles.notFound}>
          <h1>Pedido não encontrado</h1>
          <p>O pedido solicitado não existe ou foi removido.</p>
          <Link to="/cardapio">
            <Button variant="primary">Ver Cardápio</Button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Header currentPage="confirmado" />
      <ToastContainer />

      <section className={styles.confirmado} aria-label="Pedido confirmado">
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.successIcon} aria-hidden="true">✅</div>
            <h1 className={styles.title}>PEDIDO CONFIRMADO!</h1>
            <p className={styles.subtitle}>Seu pedido foi recebido e está sendo processado</p>
          </header>

          <div className={styles.pedidoCard}>
            <div className={styles.pedidoHeader}>
              <div>
                <span className={styles.pedidoNumber}>Pedido #{pedido.numero}</span>
                <Badge variant={pedido.status as any} className={styles.statusBadge}>
                  {pedido.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <span className={styles.pedidoDate}>{formatarData(pedido.created_at)}</span>
            </div>

            <div className={styles.pedidoItems}>
              {pedido.itens.map(item => (
                <div key={item.produto_id} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{item.produto_nome}</span>
                    {item.observacoes && (
                      <span className={styles.itemNotes}>{item.observacoes}</span>
                    )}
                  </div>
                  <div className={styles.itemPrice}>
                    <span>{item.quantidade}x {formatarMoeda(item.preco)}</span>
                    <span>{formatarMoeda(item.preco * item.quantidade)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.pedidoTotals}>
              <div className={styles.totalLine}>
                <span>Subtotal</span>
                <span>{formatarMoeda(pedido.total - (pedido.taxa_entrega || 0))}</span>
              </div>
              {pedido.taxa_entrega && pedido.taxa_entrega > 0 && (
                <div className={styles.totalLine}>
                  <span>Taxa de Entrega</span>
                  <span>{formatarMoeda(pedido.taxa_entrega)}</span>
                </div>
              )}
              <div className={styles.totalLine} style={{ fontWeight: 'bold', fontSize: 'var(--font-size-lg)' }}>
                <span>Total</span>
                <span>{formatarMoeda(pedido.total)}</span>
              </div>
            </div>

            {pedido.endereco_entrega && (
              <div className={styles.entregaInfo}>
                <h4 className={styles.entregaTitle}>📍 Endereço de Entrega</h4>
                <p className={styles.addressText}>
                  {pedido.endereco_entrega.logradouro}, {pedido.endereco_entrega.numero}
                  {pedido.endereco_entrega.complemento && ` - ${pedido.endereco_entrega.complemento}`}
                  <br />
                  {pedido.endereco_entrega.bairro} - {pedido.endereco_entrega.cidade}/{pedido.endereco_entrega.estado}
                  <br />
                  CEP: {pedido.endereco_entrega.cep.replace(/(\d{5})(\d{3})/, '$1-$2')}
                  {pedido.endereco_entrega.referencia && (
                    <>
                      <br />
                      <span>Ref: {pedido.endereco_entrega.referencia}</span>
                    </>
                  )}
                </p>
              </div>
            )}

            <div className={styles.pagamentoInfo}>
              <h4 className={styles.pagamentoTitle}>💳 Pagamento</h4>
              <p>
                {pedido.forma_pagamento.replace('_', ' ').toUpperCase()}
                {pedido.troco_para && (
                  <> - Troco para: {formatarMoeda(pedido.troco_para)}</>
                )}
              </p>
            </div>

            {pedido.observacoes && (
              <div className={styles.observacoesInfo}>
                <h4 className={styles.obsTitle}>📝 Observações</h4>
                <p>{pedido.observacoes}</p>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <Link to="/meus-pedidos">
              <Button variant="secondary" size="lg">Ver Meus Pedidos</Button>
            </Link>
            <Link to="/cardapio">
              <Button variant="primary" size="lg">Fazer Novo Pedido</Button>
            </Link>
          </div>

          <div className={styles.info}>
            <p>Você receberá atualizações do status do pedido por WhatsApp/E-mail.</p>
            <p>Tempo estimado de preparo: <strong>30-45 minutos</strong></p>
          </div>
        </div>
      </section>
    </>
  );
}

export default PedidoConfirmadoPage;