/**
 * Layout para painel administrativo
 */

import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Header } from '@components';
import { useAuth } from '@hooks';
import styles from './AdminLayout.module.css';

const adminNavItems = [
  { path: '/admin', label: 'DASHBOARD', icon: '📊' },
  { path: '/admin/categorias', label: 'CATEGORIAS', icon: '📁' },
  { path: '/admin/produtos', label: 'PRODUTOS', icon: '🍔' },
  { path: '/admin/pedidos', label: 'PEDIDOS', icon: '📋' },
  { path: '/admin/usuarios', label: 'USUÁRIOS', icon: '👥' },
  { path: '/admin/horarios', label: 'HORÁRIOS', icon: '🕐' },
  { path: '/admin/entrega', label: 'ENTREGA', icon: '🚚' },
  { path: '/admin/pagamentos', label: 'PAGAMENTOS', icon: '💳' },
];

export function AdminLayout() {
  const location = useLocation();
  const { adminUser, logoutAdmin } = useAuth();

  return (
    <div className={styles.adminLayout}>
      <Header currentPage="admin" showAdminLink />

      <div className={styles.adminContainer}>
        <aside className={styles.sidebar} role="navigation" aria-label="Menu administrativo">
          <div className={styles.sidebarHeader}>
            <h2 className={styles.sidebarTitle}>PAINEL ADMIN</h2>
            <div className={styles.adminInfo}>
              <span className={styles.adminRole}>Administrador</span>
              <span className={styles.adminName}>{adminUser?.nome}</span>
            </div>
          </div>

          <nav className={styles.sidebarNav}>
            <ul className={styles.navList}>
              {adminNavItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `${styles.navLink} ${isActive ? styles.active : ''}`
                    }
                    aria-current={location.pathname === item.path ? 'page' : undefined}
                  >
                    <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
                    <span className={styles.navLabel}>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.sidebarFooter}>
            <button className={styles.logoutBtn} onClick={() => { logoutAdmin(); window.location.reload(); }}>
              <span className={styles.logoutIcon} aria-hidden="true">🚪</span>
              <span>SAIR</span>
            </button>
          </div>
        </aside>

        <main className={styles.mainContent} role="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;