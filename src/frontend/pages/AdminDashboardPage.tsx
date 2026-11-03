/**
 * Página de Dashboard Admin
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header, ToastContainer, LoadingOverlay, Card, StatCard } from '@components';
import { useAuth } from '@hooks';
import { api } from '@api/client';
import { formatarMoeda, formatarData } from '@shared/utils';
import styles from './AdminDashboardPage.module.css';

type DashboardStats = {
  pedidos_hoje: number;
  faturamento_hoje: number;
  pedidos_pendentes: number;
  produtos_ativos: number;
  categorias_ativas: number;
  usuarios_ativos: number;
};

type PedidoRecente = {
  id: string;
  numero: string;
  cliente_nome: string;
  total: number;
  status: string;
  created_at: string;
};

export function AdminDashboardPage() {
  const { adminUser, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pedidosRecentes, setPedidosRecentes] = useState<PedidoRecente[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (adminUser) {
      loadDashboard();
    }
  }, [adminUser]);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const [statsData, pedidosData] = await Promise.all([
        api.get<DashboardStats>('/admin/dashboard/stats'),
        api.get<PedidoRecente[]>('/admin/pedidos', { limit: 5, order: 'desc' }),
      ]);
      setStats(statsData);
      setPedidosRecentes(pedidosData);
    } catch {
      // Silencioso
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !adminUser) {
    return (
      <>
        <Header currentPage="admin" showAdminLink />
        <ToastContainer />
        <LoadingOverlay message="Carregando dashboard..." />
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Header currentPage="admin" showAdminLink />
        <ToastContainer />
        <LoadingOverlay message="Carregando dados..." />
      </>
    );
  }

  const statCards = [
    {
      label: 'Pedidos Hoje',
      value: stats?.pedidos_hoje || 0,
      icon: '📋',
      color: 'primary',
      link: '/admin/pedidos',
    },
    {
      label: 'Faturamento Hoje',
      value: formatarMoeda(stats?.faturamento_hoje || 0),
      icon: '💰',
      color: 'success',
      link: '/admin/pedidos',
    },
    {
      label: 'Pedidos Pendentes',
      value: stats?.pedidos_pendentes || 0,
      icon: '⏳',
      color: 'warning',
      link: '/admin/pedidos?status=pendente',
    },
    {
      label: 'Produtos Ativos',
      value: stats?.produtos_ativos || 0,
      icon: '🍔',
      color: 'info',
      link: '/admin/produtos',
    },
  ];

  return (
    <>
      <Header currentPage="admin" showAdminLink />
      <ToastContainer />

      <div className={styles.dashboard}>
        <header className={styles.header}>
          <h1 className={styles.title}>DASHBOARD</h1>
          <p className={styles.subtitle}>Visão geral do restaurante</p>
        </header>

        <div className={styles.statsGrid} role="list" aria-label="Estatísticas">
          {statCards.map((stat, index) => (
            <StatCard
              key={index}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              color={stat.color as 'primary' | 'success' | 'warning' | 'error' | 'info'}
              link={stat.link}
              className={styles.statCard}
            />
          ))}
        </div>

        <section className={styles.section} aria-labelledby="pedidos-recentes-title">
          <header className={styles.sectionHeader}>
            <h2 id="pedidos-recentes-title" className={styles.sectionTitle}>PEDIDOS RECENTES</h2>
            <Link to="/admin/pedidos" className={styles.viewAll}>
              Ver todos →
            </Link>
          </header>

          {pedidosRecentes.length === 0 ? (
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
                    <th scope="col">Total</th>
                    <th scope="col">Status</th>
                    <th scope="col">Data</th>
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosRecentes.map(pedido => (
                    <tr key={pedido.id}>
                      <td>
                        <span className={styles.pedidoNumber}>#{pedido.numero}</span>
                      </td>
                      <td>{pedido.cliente_nome}</td>
                      <td className={styles.totalCell}>{formatarMoeda(pedido.total)}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles[pedido.status as keyof typeof styles]}`}>
                          {pedido.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td>{formatarData(pedido.created_at)}</td>
                      <td>
                        <Link to={`/admin/pedidos/${pedido.id}`} className={styles.actionLink}>
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={styles.section} aria-labelledby="acoes-rapidas-title">
          <h2 id="acoes-rapidas-title" className={styles.sectionTitle}>AÇÕES RÁPIDAS</h2>
          <div className={styles.quickActions}>
            <Link to="/admin/produtos/novo" className={styles.quickAction}>
              <span className={styles.quickActionIcon} aria-hidden="true">➕</span>
              <span>Novo Produto</span>
            </Link>
            <Link to="/admin/categorias/novo" className={styles.quickAction}>
              <span className={styles.quickActionIcon} aria-hidden="true">📁</span>
              <span>Nova Categoria</span>
            </Link>
            <Link to="/admin/horarios" className={styles.quickAction}>
              <span className={styles.quickActionIcon} aria-hidden="true">🕐</span>
              <span>Horários</span>
            </Link>
            <Link to="/admin/entrega" className={styles.quickAction}>
              <span className={styles.quickActionIcon} aria-hidden="true">🚚</span>
              <span>Config. Entrega</span>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

export default AdminDashboardPage;