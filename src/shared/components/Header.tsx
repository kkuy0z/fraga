/**
 * Componente Header compartilhado
 * Substitui o header duplicado em 18+ arquivos HTML
 */

import { useAuth } from '@hooks';
import { useCartCount } from '@hooks';
import { formatCurrency } from '@utils';
import styles from './Header.module.css';

interface HeaderProps {
  /** Página atual para destacar no menu */
  currentPage?: 'inicio' | 'cardapio' | 'carrinho' | 'checkout' | 'perfil' | 'meus-pedidos' | 'cadastro' | 'admin';
  /** Mostrar link para admin */
  showAdminLink?: boolean;
  /** Classe CSS adicional */
  className?: string;
}

export function Header({
  currentPage = 'inicio',
  showAdminLink = false,
  className = '',
}: HeaderProps) {
  const { currentUser, isAdminAuthenticated, isClienteAuthenticated, logout, userRole } = useAuth();
  const cartCount = useCartCount();

  const userName = currentUser?.nome ?? 'Minha Conta';
  const userInitial = userName.charAt(0).toUpperCase();

  const navItems = [
    { href: '/inicio/index.html', label: 'INÍCIO', page: 'inicio' as const },
    { href: '/inicio/cardapio.html', label: 'CARDÁPIO', page: 'cardapio' as const },
    { href: '/inicio/index.html#sobre', label: 'SOBRE', page: 'inicio' as const, hash: 'sobre' },
    { href: '/inicio/index.html#espaco', label: 'ESPAÇO', page: 'inicio' as const, hash: 'espaco' },
    { href: '/inicio/index.html#avaliacoes', label: 'AVALIAÇÕES', page: 'inicio' as const, hash: 'avaliacoes' },
    { href: '/inicio/index.html#contato', label: 'CONTATO', page: 'inicio' as const, hash: 'contato' },
  ];

  const isActive = (page: string, hash?: string) => {
    if (hash && currentPage === page) return true;
    return currentPage === page;
  };

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  return (
    <header className={`${styles.header} ${className}`} role="banner">
      <div className={styles.headerInner}>
        <div className={styles.logo}>
          <a href="/inicio/index.html" aria-label="Fraga Lanches - Início">
            <img
              src="/img/logo.png"
              alt="Fraga Lanches Delivery"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </a>
        </div>

        <nav className={styles.navMenu} role="navigation" aria-label="Menu principal">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive(item.page, item.hash) ? styles.active : ''}`}
              aria-current={isActive(item.page, item.hash) ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className={styles.headerActions}>
          <a
            href="/inicio/carrinho.html"
            className={styles.cartButton}
            aria-label={`Carrinho de compras${cartCount > 0 ? ` com ${cartCount} itens` : ''}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span>Carrinho</span>
            {cartCount > 0 && (
              <span className={styles.cartCount} aria-label={`Itens no carrinho: ${cartCount}`}>
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </a>

          {(isClienteAuthenticated || isAdminAuthenticated) && (
            <div className={styles.userMenu}>
              <button
                className={styles.userButton}
                aria-expanded="false"
                aria-haspopup="true"
                aria-label="Menu do usuário"
              >
                <div className={styles.userAvatar}>{userInitial}</div>
                <span id="userName">{userName}</span>
              </button>
              <div className={styles.userDropdown} role="menu">
                {(isClienteAuthenticated || userRole === 'cliente') && (
                  <>
                    <a href="/inicio/meus-pedidos.html" className={styles.userDropdownItem} role="menuitem">
                      Meus Pedidos
                    </a>
                    <a href="/inicio/perfil.html" className={styles.userDropdownItem} role="menuitem">
                      Meu Perfil
                    </a>
                  </>
                )}
                {isAdminAuthenticated && (
                  <>
                    <a href="/inicio/admin-dashboard.html" className={styles.userDropdownItem} role="menuitem">
                      Painel Admin
                    </a>
                    <div className={styles.userDropdownDivider} />
                  </>
                )}
                <button className={`${styles.userDropdownItem} ${styles.btnLogout}`} role="menuitem" onClick={handleLogout}>
                  Sair
                </button>
              </div>
            </div>
          )}

          {showAdminLink && isAdminAuthenticated && (
            <a href="/inicio/admin-dashboard.html" className={`${styles.btn} ${styles.btnOutline} ${styles.btnSm}`}>
              Painel Admin
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;