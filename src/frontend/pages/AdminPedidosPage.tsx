/**
 * Página de Gerenciamento de Pedidos (Admin)
 */

import { useEffect, useState, useCallback } from 'react';
import { Header, ToastContainer, LoadingOverlay, Modal, Button, Select, Badge } from '@components';
import { useToast } from '@hooks';
import { api } from '@api/client';
import { formatarData, formatarMoeda } from '@shared/utils';
import { Pedido, PedidoItem } from '@shared/types';
import styles from './AdminPedidosPage.module.css';

type StatusPedido = 'pendente' | 'confirmado' | 'preparando' | 'saiu_entrega' | 'entregue' | 'cancelado';

const statusOptions: { value: StatusPedido; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'preparando', label: 'Preparando' },
  { value: 'saiu_entrega', label: 'Saiu para Entrega' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelado', label: 'Cancelado' },
];

export function AdminPedidosPage() {
  const { showToast } = useToast();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const loadPedidos = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      const data = await api.get<Pedido[]>('/admin/pedidos', params);
      setPedidos(data);
    } catch {
      showToast('Erro ao carregar pedidos', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchTerm, showToast]);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  const handleVerDetalhes = (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setShowModal(true);
  };

  const handleStatusChange = async (pedidoId: string, novoStatus: StatusPedido) => {
    setUpdatingStatus(pedidoId);
    try {
      await api.patch(`/admin/pedidos/${pedidoId}/status`, { status: novoStatus });
      showToast('Status atualizado com sucesso', 'success');
      loadPedidos();
    } catch {
      showToast('Erro ao atualizar status', 'error');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusBadge = (status: string) => (
    <Badge variant={status as any}>{status.replace('_', ' ').toUpperCase()}</Badge>
  );

  if (isLoading) {
    return (
      <>
        <Header currentPage="admin" showAdminLink />
        <ToastContainer />
        <LoadingOverlay message="Carregando pedidos..." />
      </>
    );
  }

  return (
    <>
      <Header currentPage="admin" showAdminLink />
      <ToastContainer />

      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>PEDIDOS</h1>
            <p className={styles.subtitle}>Gerencie e acompanhe os pedidos</p>
          </div>
        </header>

        <div className={styles.filters}>
          <Input
            type="search"
            placeholder="Buscar por nº pedido, cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">Todos os status</option>
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </div>

        {pedidos.length === 0 ? (
          <div className={styles.empty}>
            <p>Nenhum pedido encontrado.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table} role="table">
              <thead>
                <tr>
                  <th scope="col">Pedido</th>
                  <th scope="col">Cliente</th>
                  <th scope="col">Itens</th>
                  <th scope="col">Total</th>
                  <th scope="col">Status</th>
                  <th scope="col">Pagamento</th>
                  <th scope="col">Data</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map(pedido => (
                  <tr key={pedido.id}>
                    <td>
                      <span className={styles.pedidoNumber}>#{pedido.numero}</span>
                    </td>
                    <td>
                      <div>
                        <span className={styles.clienteNome}>{pedido.cliente_nome}</span>
                        <br />
                        <small className={styles.clienteTelefone}>{pedido.cliente_telefone}</small>
                      </div>
                    </td>
                    <td>
                      <span className={styles.itensCount}>{pedido.itens.length} item{pedido.itens.length !== 1 ? 's' : ''}</span>
                    </td>
                    <td className={styles.totalCell}>{formatarMoeda(pedido.total)}</td>
                    <td>
                      <Select
                        value={pedido.status}
                        onChange={(e) => handleStatusChange(pedido.id, e.target.value as StatusPedido)}
                        disabled={updatingStatus === pedido.id}
                        className={styles.statusSelect}
                      >
                        {statusOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </Select>
                    </td>
                    <td>
                      <span className={styles.pagamento}>
                        {pedido.forma_pagamento.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className={styles.dataCell}>{formatarData(pedido.created_at)}</td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => handleVerDetalhes(pedido)}>
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detalhes */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setSelectedPedido(null); }}
        title={selectedPedido ? `Pedido #${selectedPedido.numero}` : 'Detalhes do Pedido'}
        size="xl"
      >
        {selectedPedido && (
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.modalInfo}>
                <div className={styles.modalInfoRow}>
                  <span className={styles.modalLabel}>Cliente:</span>
                  <span>{selectedPedido.cliente_nome}</span>
                </div>
                <div className={styles.modalInfoRow}>
                  <span className={styles.modalLabel}>Telefone:</span>
                  <span>{selectedPedido.cliente_telefone}</span>
                </div>
                <div className={styles.modalInfoRow}>
                  <span className={styles.modalLabel}>E-mail:</span>
                  <span>{selectedPedido.cliente_email || '-'}</span>
                </div>
                <div className={styles.modalInfoRow}>
                  <span className={styles.modalLabel}>Status:</span>
                  <Badge variant={selectedPedido.status as any}>
                    {selectedPedido.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className={styles.modalInfoRow}>
                  <span className={styles.modalLabel}>Pagamento:</span>
                  <span>{selectedPedido.forma_pagamento.replace('_', ' ').toUpperCase()}</span>
                </div>
                {selectedPedido.troco_para && (
                  <div className={styles.modalInfoRow}>
                    <span className={styles.modalLabel}>Troco para:</span>
                    <span>{formatarMoeda(selectedPedido.troco_para)}</span>
                  </div>
                )}
                <div className={styles.modalInfoRow}>
                  <span className={styles.modalLabel}>Data:</span>
                  <span>{formatarData(selectedPedido.created_at)}</span>
                </div>
              </div>

              <div className={styles.modalTotal}>
                Total: {formatarMoeda(selectedPedido.total)}
              </div>
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
              <h4 className={styles.modalSectionTitle}>Itens do Pedido</h4>
              <div className={styles.modalItems}>
                {selectedPedido.itens.map((item: PedidoItem) => (
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
            </div>

            {selectedPedido.observacoes && (
              <div className={styles.modalSection}>
                <h4 className={styles.modalSectionTitle}>Observações do Cliente</h4>
                <p className={styles.notesText}>{selectedPedido.observacoes}</p>
              </div>
            )}

            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={() => { setShowModal(false); setSelectedPedido(null); }}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

// Need to import Input component
import { Input } from '@components';

export default AdminPedidosPage;