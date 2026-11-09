/**
 * Shared Components - Header, Footer, Toast, Loading, Modal utilities
 * Single source of truth for all common UI components
 */

// ===== SVG ICON SPRITE =====
const ICON_SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
  <symbol id="i-add" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </symbol>
  <symbol id="i-save" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
    <polyline points="17 21 17 13 7 13 7 21"></polyline>
    <polyline points="7 3 7 8 15 8"></polyline>
  </symbol>
  <symbol id="i-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </symbol>
  <symbol id="i-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="23 4 23 10 17 10"></polyline>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
  </symbol>
  <symbol id="i-settings" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </symbol>
  <symbol id="i-map-pin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </symbol>
  <symbol id="i-chevron-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="15 18 9 12 15 6"></polyline>
  </symbol>
  <symbol id="i-chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="9 18 15 12 9 6"></polyline>
  </symbol>
  <symbol id="i-chevron-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="6 9 12 15 18 9"></polyline>
  </symbol>
  <symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </symbol>
  <symbol id="i-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </symbol>
  <symbol id="i-logout" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </symbol>
  <symbol id="i-login" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
    <polyline points="10 17 15 12 10 7"></polyline>
    <line x1="15" y1="12" x2="3" y2="12"></line>
  </symbol>
  <symbol id="i-zap" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
  </symbol>
  <symbol id="i-home" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </symbol>
  <symbol id="i-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </symbol>
  <symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </symbol>
  <symbol id="i-shopping-cart" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="9" cy="21" r="1"></circle>
    <circle cx="20" cy="21" r="1"></circle>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
  </symbol>
  <symbol id="i-external-link" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </symbol>
  <symbol id="i-check-circle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </symbol>
  <symbol id="i-phone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
  </symbol>
  <symbol id="i-mail" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </symbol>
  <symbol id="i-map-marker" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </symbol>
  <symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </symbol>
  <symbol id="i-whatsapp" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.454.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a21.453 21.453 0 01-1.777-.347L3.313 19.258l1.317-4.701a21.349 21.349 0 01-.35-1.805c0-5.358 4.356-9.713 9.713-9.713 2.756 0 5.301 1.124 7.15 2.918 1.84 1.795 2.92 4.309 2.998 7.077.023 1.178-.318 2.307-.93 3.297-1.262 2.046-4.023 3.795-7.178 4.075-.633.056-1.268.07-1.901.07-.378 0-.755-.013-1.128-.048-.214-.02-.407-.072-.574-.169-.19-.112-.35-.248-.49-.392l-1.55-.769-.546.93c-.21.4-.298.82-.35 1.253-.035.257-.067.52-.094.78-.027.267-.03.536-.01.806.02.27.057.538.095.806.036.26.074.507.132.746.175.714.546 1.307 1.197 1.688.796.464 1.948.694 3.367.694 3.036 0 5.781-2.058 6.198-5.51.1-.981-.124-1.883-.72-2.603-.599-.72-1.318-1.443-2.15-2.15-.87-.757-1.727-1.052-2.655-.83-.707.167-1.327.508-1.828 1.036-.555.583-.922 1.277-.996 1.507-.064.2-.11.407-.11.615 0 .23.03.43.073.622.046.195.117.37.204.532.107.194.24.354.396.48.28.228.71.372 1.29.372.587 0 1.108-.154 1.58-.465.474-.312.84-.732 1.113-1.247.274-.516.413-1.097.45-1.724.038-.61-.09-1.195-.39-1.675-.52-.813-1.248-1.43-2.25-1.762-.19-.063-.377-.095-.57-.11-.19-.014-.37-.022-.54-.02-.18 0-.36.004-.53.012-.46.02-1.087.164-1.595.428-.624.323-.99.723-1.118 1.102-.12.35-.126.72-.06 1.08.067.387.217.715.464.99.26.287.597.48 1.013.557.418.077.856.07 1.313.02.584-.065 1.134-.25 1.65-.61.636-.443 1.057-1.03 1.24-1.724.187-.693.075-1.41-.354-2.005-.426-.592-1.024-1.038-1.705-1.273-.577-.204-1.18-.323-1.82-.346-.67-.024-1.277.004-1.815.105-.418.077-.807.223-1.158.46-.351.237-.664.536-.937.895-.274.36-.488.765-.648 1.2-.16.436-.25.888-.257 1.338-.007.45.05.902.158 1.354.108.452.297.886.562 1.3.267.414.614.778 1.038 1.085.47.336.987.552 1.548.648.687.114 1.247.08 1.698-.187.446-.264.785-.644 1.002-1.136.217-.492.288-1.008.208-1.538-.08-.53-.312-1.03-.657-1.488-.38-.5-.862-.897-1.445-1.177-.54-.257-1.102-.448-1.68-.57-.82-.173-1.547-.246-2.16-.246-1.06 0-1.93.238-2.633.706-.706.468-1.188 1.106-1.458 1.884-.27.778-.34 1.62-.246 2.458.094.837.44 1.604 1.016 2.275.58.672 1.353 1.158 2.32 1.42.97.263 1.963.348 2.97.348 1.587 0 3.047-.355 4.338-1.064.633-.34 1.188-.782 1.65-1.328.465-.545.797-1.187.983-1.928.188-.741.155-1.505-.074-2.288-.23-.783-.643-1.49-1.21-2.11-.65-.725-1.46-1.24-2.427-1.52-.445-.128-.902-.213-1.37-.25-.59-.044-1.16-.046-1.71-.006-.57.042-1.124.157-1.647.362-.542.214-1.05.523-1.518.93-.472.41-.872.908-1.202 1.485-.33.578-.57 1.212-.72 1.887-.15.674-.188 1.367-.105 2.06.083.693.306 1.34.68 1.933.376.594.886 1.08 1.513 1.46.627.38 1.33.585 2.09.606.756.02 1.48-.14 2.116-.47.638-.33 1.17-.778 1.584-1.336.415-.557.703-1.207.85-1.944.147-.735.113-1.485-.118-2.238-.232-.75-.65-1.434-1.234-2.028-.585-.594-1.336-1.007-2.234-1.25-.897-.242-1.81-.322-2.723-.322-1.376 0-2.61.227-3.707.676-1.097.45-1.977 1.153-2.63 2.12-.653.967-1.075 2.114-1.252 3.41-.177 1.295-.134 2.61.122 3.91.256 1.3.69 2.55 1.303 3.722.614 1.17 1.424 2.226 2.43 3.148.99.91 2.08 1.61 3.27 2.04 1.19.43 2.36.58 3.47.47 1.11-.11 2.18-.48 3.2-1.08.8-.49 1.53-1.16 2.15-1.99.63-.84 1.09-1.82 1.36-2.89.27-1.07.35-2.16.23-3.25-.11-1.09-.46-2.14-1.03-3.11-.57-.97-1.33-1.8-2.25-2.49-.91-.69-1.95-1.2-3.08-1.5-.43-.11-.88-.16-1.33-.16z"/>
  </symbol>
</svg>
`;

// ===== HEADER COMPONENT =====
function createHeader(isAdmin = false, currentPage = '') {
  const isLoggedIn = !!localStorage.getItem('cliente_token') || !!localStorage.getItem('auth_token');
  const userName = localStorage.getItem('cliente_user')
    ? JSON.parse(localStorage.getItem('cliente_user')).nome
    : localStorage.getItem('auth_user')
      ? JSON.parse(localStorage.getItem('auth_user')).nome
      : 'Minha Conta';

  const basePath = isAdmin ? '/inicio' : '/inicio';

  const navItems = isAdmin ? [
    { href: '/inicio/admin-dashboard.html', label: 'Dashboard', icon: 'dashboard', page: 'dashboard' },
    { href: '/inicio/admin-categorias.html', label: 'Categorias', icon: 'categorias', page: 'categorias' },
    { href: '/inicio/admin-produtos.html', label: 'Produtos', icon: 'produtos', page: 'produtos' },
    { href: '/inicio/admin-pedidos.html', label: 'Pedidos', icon: 'pedidos', page: 'pedidos' },
    { href: '/inicio/admin-horarios.html', label: 'Horários', icon: 'horarios', page: 'horarios' },
    { href: '/inicio/admin-entrega.html', label: 'Entrega', icon: 'entrega', page: 'entrega' },
    { href: '/inicio/admin-pagamentos.html', label: 'Pagamentos', icon: 'pagamentos', page: 'pagamentos' },
    { href: '/inicio/admin-usuarios.html', label: 'Usuários', icon: 'usuarios', page: 'usuarios' }
  ] : [
    { href: '/inicio/index.html', label: 'INÍCIO', page: 'inicio' },
    { href: '/inicio/cardapio.html', label: 'CARDÁPIO', page: 'cardapio' },
    { href: '/inicio/index.html#sobre', label: 'SOBRE', page: 'sobre' },
    { href: '/inicio/index.html#espaco', label: 'ESPAÇO', page: 'espaco' },
    { href: '/inicio/index.html#avaliacoes', label: 'AVALIAÇÕES', page: 'avaliacoes' },
    { href: '/inicio/index.html#contato', label: 'CONTATO', page: 'contato' }
  ];

  const navHTML = isAdmin ? `
    <nav class="admin-nav" id="adminNav" role="navigation" aria-label="Navegação administrativa">
      ${navItems.map(item => `
        <a href="${item.href}" data-page="${item.page}" ${item.page === currentPage ? 'class="active"' : ''}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            ${getAdminNavIcon(item.icon)}
          </svg>
          ${item.label}
        </a>
      `).join('')}
    </nav>
    <button class="admin-nav-toggle" id="adminNavToggle" aria-label="Alternar menu" aria-expanded="false">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </button>
  ` : `
    <nav class="nav-menu" id="navMenu" role="navigation" aria-label="Menu principal">
      ${navItems.map(item => `
        <a href="${item.href}" ${item.page === currentPage ? 'class="active"' : ''}>${item.label}</a>
      `).join('')}
    </nav>
    <button class="nav-toggle" id="navToggle" aria-label="Alternar menu" aria-expanded="false">
      <span></span>
      <span></span>
      <span></span>
    </button>
  `;

  const userMenuHTML = isLoggedIn ? `
    <div class="user-menu" id="userMenu">
      <button class="user-button" id="userButton" aria-expanded="false" aria-haspopup="true" aria-label="Menu do usuário">
        <div class="user-avatar" id="userAvatar">${userName.charAt(0).toUpperCase()}</div>
        <span id="userName">${userName}</span>
      </button>
      <div class="user-dropdown" id="userDropdown" role="menu">
        <div class="user-dropdown-header">
          <span id="dropdownUserName">${userName}</span>
          <span id="dropdownUserRole" class="badge badge-info">${isAdmin ? 'administrador' : 'cliente'}</span>
        </div>
        <div class="user-dropdown-divider"></div>
        ${isAdmin ? `
          <a href="/inicio/index.html" class="user-dropdown-item" role="menuitem" target="_blank">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><use href="#i-external-link" /></svg>
            Ver Site
          </a>
          <div class="user-dropdown-divider"></div>
        ` : `
          <a href="/inicio/meus-pedidos.html" class="user-dropdown-item" role="menuitem">Meus Pedidos</a>
          <a href="/inicio/perfil.html" class="user-dropdown-item" role="menuitem">Meu Perfil</a>
          <div class="user-dropdown-divider"></div>
        `}
        <button class="user-dropdown-item btn-logout" id="logoutBtn" role="menuitem">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><use href="#i-logout" /></svg>
          Sair
        </button>
      </div>
    </div>
  ` : `
    <a href="/Cadastro/login.html" class="btn btn-outline btn-sm" id="loginLink">Entrar</a>
    ${!isAdmin ? `<a href="/admin-login.html" class="btn btn-outline btn-sm" id="adminLink">Painel Admin</a>` : ''}
  `;

  const cartHTML = !isAdmin ? `
    <a href="/inicio/carrinho.html" class="cart-button" id="cartButton" aria-label="Carrinho de compras">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><use href="#i-shopping-cart" /></svg>
      <span>Carrinho</span>
      <span class="cart-count" id="cartCount" aria-label="Itens no carrinho">0</span>
    </a>
  ` : '';

  return `
    <header class="header-fixed ${isAdmin ? 'admin-header' : ''}" role="banner">
      ${ICON_SPRITE}
      <div class="header-inner">
        <div class="logo">
          <a href="${isAdmin ? '/inicio/admin-dashboard.html' : '/inicio/index.html'}">
            <img src="/img/logo.png" alt="${isAdmin ? 'Fraga Lanches Admin' : 'Fraga Lanches Delivery'}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
            <span style="display: none; font-size: clamp(1rem, 2vw, 1.25rem); font-weight: 700; color: var(--color-accent); font-family: var(--font-title);">${isAdmin ? 'Fraga Admin' : 'Fraga Lanches'}</span>
          </a>
        </div>
        ${navHTML}
        <div class="header-actions">
          ${cartHTML}
          ${userMenuHTML}
        </div>
      </div>
    </header>
  `;
}

function getAdminNavIcon(icon) {
  const icons = {
    dashboard: `<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect>`,
    categorias: `<line x1="4" y1="7" x2="4" y2="21"></line><line x1="4" y1="7" x2="20" y2="7"></line><line x1="8" y1="7" x2="8" y2="21"></line><line x1="12" y1="7" x2="12" y2="21"></line><line x1="16" y1="7" x2="16" y2="21"></line><line x1="20" y1="7" x2="20" y2="21"></line>`,
    produtos: `<path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>`,
    pedidos: `<path d="M16 11V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"></path><path d="M8 7v9"></path><path d="M12 7v9"></path><path d="M16 7v9"></path>`,
    horarios: `<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>`,
    entrega: `<path d="M5 12h14"></path><path d="M12 5v14"></path><circle cx="12" cy="12" r="3"></circle>`,
    pagamentos: `<rect x="1" y="4" width="22" height="16" rx="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>`,
    usuarios: `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>`
  };
  return icons[icon] || icons.dashboard;
}

// ===== FOOTER COMPONENT =====
function createFooter() {
  return `
    <footer class="footer" role="contentinfo">
      <div class="footer-content">
        <p class="footer-text">© ${new Date().getFullYear()} Fraga Lanches - Todos os direitos reservados.</p>
      </div>
    </footer>
  `;
}

// ===== TOAST SYSTEM =====
class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    if (!document.getElementById('toastContainer')) {
      this.container = document.createElement('div');
      this.container.id = 'toastContainer';
      this.container.className = 'toast-container';
      this.container.setAttribute('aria-live', 'polite');
      this.container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('toastContainer');
    }
  }

  show(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Fechar notificação">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.remove(toast));

    this.container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('show'));

    if (duration > 0) {
      setTimeout(() => this.remove(toast), duration);
    }

    return toast;
  }

  success(message, duration) { return this.show(message, 'success', duration); }
  error(message, duration) { return this.show(message, 'error', duration); }
  warning(message, duration) { return this.show(message, 'warning', duration); }
  info(message, duration) { return this.show(message, 'info', duration); }

  remove(toast) {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }
}

// ===== LOADING OVERLAY =====
class LoadingManager {
  constructor() {
    this.overlay = null;
    this.init();
  }

  init() {
    if (!document.getElementById('loadingOverlay')) {
      this.overlay = document.createElement('div');
      this.overlay.id = 'loadingOverlay';
      this.overlay.className = 'loading-overlay';
      this.overlay.setAttribute('aria-hidden', 'true');
      this.overlay.innerHTML = `
        <div class="loading-spinner"></div>
        <p class="loading-message">Carregando...</p>
      `;
      document.body.appendChild(this.overlay);
    } else {
      this.overlay = document.getElementById('loadingOverlay');
    }
  }

  show(message = 'Carregando...') {
    this.overlay.querySelector('.loading-message').textContent = message;
    this.overlay.classList.add('show');
  }

  hide() {
    this.overlay.classList.remove('show');
  }
}

// ===== MODAL MANAGER =====
class ModalManager {
  constructor() {
    this.modals = new Map();
  }

  create(id, options = {}) {
    const {
      title = '',
      size = 'md',
      closeable = true,
      body = '',
      footer = ''
    } = options;

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay hidden';
    modalOverlay.id = id;
    modalOverlay.setAttribute('role', 'dialog');
    modalOverlay.setAttribute('aria-modal', 'true');
    modalOverlay.setAttribute('aria-labelledby', `${id}Titulo`);

    const sizeClass = size === 'sm' ? 'modal-sm' : size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : 'modal-md';

    modalOverlay.innerHTML = `
      <div class="modal ${sizeClass}">
        <div class="modal-header">
          <h2 class="modal-title" id="${id}Titulo">${title}</h2>
          ${closeable ? `
            <button class="modal-close" id="${id}Close" aria-label="Fechar modal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><use href="#i-x" /></svg>
            </button>
          ` : ''}
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;

    // Close on overlay click
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) this.hide(id);
    });

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') this.hide(id);
    };
    modalOverlay._handleEscape = handleEscape;

    document.body.appendChild(modalOverlay);
    this.modals.set(id, modalOverlay);

    return modalOverlay;
  }

  show(id) {
    const modal = this.modals.get(id) || document.getElementById(id);
    if (modal) {
      modal.classList.remove('hidden');
      requestAnimationFrame(() => modal.classList.add('show'));
      document.addEventListener('keydown', modal._handleEscape);
      document.body.style.overflow = 'hidden';
    }
  }

  hide(id) {
    const modal = this.modals.get(id) || document.getElementById(id);
    if (modal) {
      modal.classList.remove('show');
      modal.addEventListener('transitionend', () => {
        modal.classList.add('hidden');
      }, { once: true });
      document.removeEventListener('keydown', modal._handleEscape);
      document.body.style.overflow = '';
    }
  }

  destroy(id) {
    const modal = this.modals.get(id);
    if (modal) {
      modal.remove();
      this.modals.delete(id);
    }
  }
}

// ===== SERVICE WORKER REGISTRATION =====
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/inicio/service-worker.js')
        .catch(error => console.error('[SW] Erro no registro:', error));
    });
  }
}

// ===== HEADER INITIALIZATION =====
function initHeader(isAdmin = false, currentPage = '') {
  // Check if header already exists
  if (document.querySelector('.header-fixed')) return;

  // Insert header at the beginning of body
  const headerHTML = createHeader(isAdmin, currentPage);
  document.body.insertAdjacentHTML('afterbegin', headerHTML);

  // Initialize mobile nav toggle
  const navToggle = document.getElementById('navToggle') || document.getElementById('adminNavToggle');
  const navMenu = document.getElementById('navMenu') || document.getElementById('adminNav');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', !isExpanded);
      navMenu.classList.toggle('open');
    });

    // Close menu on link click (mobile)
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
        navMenu.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Initialize user dropdown
  const userMenu = document.getElementById('userMenu');
  const userButton = document.getElementById('userButton');
  const logoutBtn = document.getElementById('logoutBtn');

  if (userButton && userMenu) {
    // Handle logout
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try {
          const api = window.api || (await import('./api.js')).default;
          api.clearClienteAuth();
          api.clearAuth();
          window.location.href = '/inicio/index.html';
        } catch (e) {
          localStorage.clear();
          window.location.href = '/inicio/index.html';
        }
      });
    }

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!userMenu.contains(e.target)) {
        userButton.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Update cart count
  updateCartCount();

  // Handle admin nav toggle
  const adminNavToggle = document.getElementById('adminNavToggle');
  const adminNav = document.getElementById('adminNav');
  if (adminNavToggle && adminNav) {
    adminNavToggle.addEventListener('click', () => {
      const isActive = adminNav.classList.toggle('active');
      adminNavToggle.setAttribute('aria-expanded', isActive);
    });
  }
}

function updateCartCount() {
  const cartCount = document.getElementById('cartCount');
  if (cartCount) {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const count = cart.reduce((sum, item) => sum + (item.quantidade || 1), 0);
      cartCount.textContent = count;
      cartCount.style.display = count > 0 ? 'flex' : 'none';
    } catch (e) {
      cartCount.textContent = '0';
      cartCount.style.display = 'none';
    }
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();

  // Export globals
  window.toast = new ToastManager();
  window.loading = new LoadingManager();
  window.modal = new ModalManager();
  window.updateCartCount = updateCartCount;
  window.initHeader = initHeader;
});

// Auto-init header if not admin page (admin pages will call initHeader explicitly)
if (!window.location.pathname.includes('/admin-') && !window.location.pathname.includes('admin-login')) {
  document.addEventListener('DOMContentLoaded', () => {
    const currentPage = getCurrentPage();
    initHeader(false, currentPage);
  });
}

function getCurrentPage() {
  const path = window.location.pathname;
  if (path.endsWith('index.html') || path === '/inicio/' || path === '/') return 'inicio';
  if (path.includes('cardapio')) return 'cardapio';
  if (path.includes('carrinho')) return 'carrinho';
  if (path.includes('checkout')) return 'checkout';
  if (path.includes('meus-pedidos')) return 'meus-pedidos';
  if (path.includes('perfil')) return 'perfil';
  if (path.includes('cadastro')) return 'cadastro';
  if (path.includes('login')) return 'login';
  return '';
}

// Export for module usage
export { ToastManager, LoadingManager, ModalManager, initHeader, createHeader, createFooter, registerServiceWorker, updateCartCount };