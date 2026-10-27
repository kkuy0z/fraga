import api from './api.js';
import { showToast, showLoading, hideLoading, formatCurrency, formatDateTime, getStatusLabel, getStatusClass, escapeHtml } from './utils.js';

// Elementos DOM
const userButton = document.getElementById('userButton');
const userDropdown = document.getElementById('userDropdown');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const dropdownUserName = document.getElementById('dropdownUserName');
const dropdownUserRole = document.getElementById('dropdownUserRole');
const logoutBtn = document.getElementById('logoutBtn');
const adminNavToggle = document.getElementById('adminNavToggle');
const adminNav = document.getElementById('adminNav');

// Stats elements
const statPedidosHoje = document.getElementById('statPedidosHoje');
const statPedidosEntregues = document.getElementById('statPedidosEntregues');
const statPedidosPendentes = document.getElementById('statPedidosPendentes');
const statProdutosAtivos = document.getElementById('statProdutosAtivos');
const statCategorias = document.getElementById('statCategorias');
const statClientes = document.getElementById('statClientes');

// Tabela pedidos recentes
const tbodyPedidosRecentes = document.getElementById('tbodyPedidosRecentes');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarPagina();
    configurarEventListeners();
});

async function inicializarPagina() {
    // Verificar autenticação admin
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('auth_user') || 'null');

    if (!token || !user) {
        window.location.href = '/inicio/admin-login.html';
        return;
    }

    // Verificar token válido
    try {
        await api.adminVerify();
    } catch (error) {
        api.clearAuth();
        window.location.href = '/inicio/admin-login.html';
        return;
    }

    // Atualizar UI do usuário
    atualizarUserUI(user);

    // Carregar dados do dashboard
    await Promise.all([
        carregarEstatisticas(),
        carregarPedidosRecentes()
    ]);
}

function configurarEventListeners() {
    // User dropdown
    if (userButton && userDropdown) {
        userButton.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
            userButton.setAttribute('aria-expanded', userDropdown.classList.contains('show'));
        });

        document.addEventListener('click', (e) => {
            if (!userButton.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('show');
                userButton.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Mobile nav toggle
    if (adminNavToggle && adminNav) {
        adminNavToggle.addEventListener('click', () => {
            const expanded = adminNavToggle.getAttribute('aria-expanded') === 'true';
            adminNavToggle.setAttribute('aria-expanded', !expanded);
            adminNav.classList.toggle('show');
        });
    }

    // Fechar dropdown com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (userDropdown) userDropdown.classList.remove('show');
            if (adminNav) adminNav.classList.remove('show');
            if (userButton) userButton.setAttribute('aria-expanded', 'false');
            if (adminNavToggle) adminNavToggle.setAttribute('aria-expanded', 'false');
        }
    });
}

function atualizarUserUI(user) {
    if (userName) userName.textContent = user.nome;
    if (dropdownUserName) dropdownUserName.textContent = user.nome;
    if (userAvatar) userAvatar.textContent = user.nome.charAt(0).toUpperCase();
    if (dropdownUserRole) {
        dropdownUserRole.textContent = user.perfil || user.role || 'administrador';
        dropdownUserRole.className = 'badge badge-info';
    }
}

async function carregarEstatisticas() {
    try {
        // Buscar pedidos de hoje
        const hoje = new Date().toISOString().split('T')[0];
        const pedidosResponse = await api.getPedidosAdmin({
            data_inicio: hoje,
            data_fim: hoje,
            limite: 100
        });

        const pedidos = pedidosResponse.pedidos || pedidosResponse.data || pedidosResponse || [];

        const pedidosHoje = pedidos.length;
        const pedidosEntregues = pedidos.filter(p => p.status === 'entregue').length;
        const pedidosPendentes = pedidos.filter(p => p.status === 'pendente').length;

        // Buscar produtos ativos
        const produtosResponse = await api.getProdutosAdmin({ ativo: true, limite: 1 });
        const totalProdutos = produtosResponse.total || (produtosResponse.produtos || []).length;

        // Buscar categorias ativas
        const categoriasResponse = await api.getCategoriasAdmin({ ativo: true, limite: 1 });
        const totalCategorias = categoriasResponse.total || (categoriasResponse.categorias || []).length;

        // Buscar clientes (via pedidos únicos ou endpoint específico se existir)
        // Por enquanto, estimar pelos pedidos
        const clientesUnicos = new Set(pedidos.map(p => p.cliente_id).filter(Boolean)).size;

        // Atualizar UI
        if (statPedidosHoje) statPedidosHoje.textContent = pedidosHoje;
        if (statPedidosEntregues) statPedidosEntregues.textContent = pedidosEntregues;
        if (statPedidosPendentes) statPedidosPendentes.textContent = pedidosPendentes;
        if (statProdutosAtivos) statProdutosAtivos.textContent = totalProdutos;
        if (statCategorias) statCategorias.textContent = totalCategorias;
        if (statClientes) statClientes.textContent = clientesUnicos || '—';

    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        showToast('Erro ao carregar estatísticas', 'error');
    }
}

async function carregarPedidosRecentes() {
    if (!tbodyPedidosRecentes) return;

    try {
        const response = await api.getPedidosAdmin({
            limite: 10,
            pagina: 1,
            ordem: 'data_criacao',
            direcao: 'DESC'
        });

        const pedidos = response.pedidos || response.data || response || [];

        if (pedidos.length === 0) {
            tbodyPedidosRecentes.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <div class="empty-state" style="padding: 24px;">
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                            <p style="margin-top: 8px; color: var(--text-muted);">Nenhum pedido recente</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbodyPedidosRecentes.innerHTML = pedidos.map(pedido => `
            <tr>
                <td><strong>#${escapeHtml(pedido.numero_pedido)}</strong></td>
                <td>${escapeHtml(pedido.cliente_nome || '—')}</td>
                <td>${formatDateTime(pedido.data_criacao)}</td>
                <td><span class="badge ${getStatusClass(pedido.status)}">${getStatusLabel(pedido.status)}</span></td>
                <td>${formatCurrency(pedido.total)}</td>
                <td>
                    <a href="/inicio/admin-pedidos.html?id=${pedido.id}" class="btn btn-sm btn-outline" style="padding: 4px 8px; font-size: 12px;">
                        Ver
                    </a>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Erro ao carregar pedidos recentes:', error);
        tbodyPedidosRecentes.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-danger">Erro ao carregar pedidos</td>
            </tr>
        `;
    }
}

function handleLogout() {
    api.clearAuth();
    showToast('Logout realizado com sucesso', 'success');
    setTimeout(() => window.location.href = '/inicio/admin-login.html', 1000);
}