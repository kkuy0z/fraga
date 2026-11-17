/**
 * Admin-Pedidos.js - Painel de Cozinha / Atendimento
 * Listagem de pedidos por status, atualização de status, alertas sonoros/visuais
 * Preparado para integração futura com WebSockets
 */

import api from './api.js';
import { formatCurrency, showToast, showLoading, hideLoading, formatDateTime, getStatusLabel, getStatusClass, escapeHtml, debounce } from './utils.js';
import { verificarAuth, handleLogout } from './shared-components.js';

// ============ CONFIGURAÇÃO DE STATUS ============
const STATUS_CONFIG = {
    pendente: { label: 'Novo Pedido', icon: '📝', color: 'var(--color-warning)', bg: 'rgba(255, 152, 0, 0.1)', border: 'var(--color-warning)', order: 1, next: 'confirmado' },
    confirmado: { label: 'Confirmado', icon: '✅', color: 'var(--color-info)', bg: 'rgba(33, 150, 243, 0.1)', border: 'var(--color-info)', order: 2, next: 'preparando' },
    preparando: { label: 'Em Preparo', icon: '👨‍🍳', color: 'var(--color-info)', bg: 'rgba(33, 150, 243, 0.1)', border: 'var(--color-info)', order: 3, next: 'saiu_entrega' },
    saiu_entrega: { label: 'Saiu para Entrega', icon: '🛵', color: 'var(--color-accent)', bg: 'rgba(255, 193, 7, 0.1)', border: 'var(--color-accent)', order: 4, next: 'entregue' },
    entregue: { label: 'Concluído', icon: '🎉', color: 'var(--color-success)', bg: 'rgba(95, 211, 138, 0.1)', border: 'var(--color-success)', order: 5, next: null },
    cancelado: { label: 'Cancelado', icon: '❌', color: 'var(--color-error)', bg: 'rgba(255, 107, 107, 0.1)', border: 'var(--color-error)', order: 6, next: null }
};

const STATUS_ORDER = ['pendente', 'confirmado', 'preparando', 'saiu_entrega', 'entregue', 'cancelado'];

// ============ ESTADO DA APLICAÇÃO ============
let todosPedidos = [];
let pedidosPorStatus = {};
let currentFilters = {};
let audioContext = null;
let notificationSound = null;
let pollingInterval = null;
let ultimoPedidoCount = 0;
let usuarioLogado = null;

// ============ ELEMENTOS DOM ============
const userButton = document.getElementById('userButton');
const userDropdown = document.getElementById('userDropdown');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const dropdownUserName = document.getElementById('dropdownUserName');
const dropdownUserRole = document.getElementById('dropdownUserRole');
const logoutBtn = document.getElementById('logoutBtn');
const adminNavToggle = document.getElementById('adminNavToggle');
const adminNav = document.getElementById('adminNav');

const buscaPedido = document.getElementById('buscaPedido');
const filtroStatus = document.getElementById('filtroStatus');
const filtroPagamento = document.getElementById('filtroPagamento');
const dataInicio = document.getElementById('dataInicio');
const dataFim = document.getElementById('dataFim');
const btnLimparFiltros = document.getElementById('btnLimparFiltros');

const tbodyPedidos = document.getElementById('tbodyPedidos');
const emptyState = document.getElementById('emptyState');
const pagination = document.getElementById('pagination');

const pedidoModal = document.getElementById('pedidoModal');
const pedidoModalBody = document.getElementById('pedidoModalBody');
const pedidoModalClose = document.getElementById('pedidoModalClose');
const pedidoModalFechar = document.getElementById('pedidoModalFechar');

const statusModal = document.getElementById('statusModal');
const statusForm = document.getElementById('statusForm');
const statusPedidoId = document.getElementById('statusPedidoId');
const novoStatus = document.getElementById('novoStatus');
const motivoCancelamentoGroup = document.getElementById('motivoCancelamentoGroup');
const motivoCancelamento = document.getElementById('motivoCancelamento');
const btnCancelarStatus = document.getElementById('btnCancelarStatus');
const btnConfirmarStatus = document.getElementById('btnConfirmarStatus');

// ============ INICIALIZAÇÃO ============
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarPagina();
    configurarEventListeners();
    iniciarPollingPedidos();
    inicializarAudio();
});

async function inicializarPagina() {
    // Verificar autenticação admin
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('auth_user') || 'null');

    if (!token || !user) {
        window.location.href = '/admin-login.html';
        return;
    }

    // Verificar token válido
    try {
        await api.adminVerify();
    } catch (error) {
        api.clearAuth();
        window.location.href = '/admin-login.html';
        return;
    }

    // Atualizar UI do usuário
    usuarioLogado = user;
    atualizarUserUI(user);

    // Carregar formas de pagamento para filtro
    await carregarFormasPagamento();

    // Carregar dados iniciais
    await carregarPedidos();
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
            if (!statusModal.classList.contains('hidden')) fecharModalStatus();
            if (!pedidoModal.classList.contains('hidden')) fecharModalPedido();
        }
    });

    // Filtros com debounce
    const debouncedFiltrar = debounce(() => aplicarFiltros(), 300);
    buscaPedido.addEventListener('input', debouncedFiltrar);
    filtroStatus.addEventListener('change', () => aplicarFiltros());
    filtroPagamento.addEventListener('change', () => aplicarFiltros());
    dataInicio.addEventListener('change', () => aplicarFiltros());
    dataFim.addEventListener('change', () => aplicarFiltros());
    btnLimparFiltros.addEventListener('click', limparFiltros);

    // Modal de pedido
    pedidoModalClose.addEventListener('click', fecharModalPedido);
    pedidoModalFechar.addEventListener('click', fecharModalPedido);
    pedidoModal.addEventListener('click', (e) => {
        if (e.target === pedidoModal) fecharModalPedido();
    });

    // Modal de status
    btnCancelarStatus.addEventListener('click', fecharModalStatus);
    statusModal.addEventListener('click', (e) => {
        if (e.target === statusModal) fecharModalStatus();
    });

    // Form de status
    novoStatus.addEventListener('change', () => {
        const showMotivo = novoStatus.value === 'cancelado';
        motivoCancelamentoGroup.style.display = showMotivo ? 'block' : 'none';
        motivoCancelamento.required = showMotivo;
    });

    statusForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await confirmarAlteracaoStatus();
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

// ============ SISTEMA DE ÁUDIO PARA ALERTAS ============
function inicializarAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Criar som de notificação simples (beep)
        criarSomNotificacao();
    } catch (e) {
        console.warn('Web Audio API não suportada:', e);
    }
}

function criarSomNotificacao() {
    // Som sintetizado: dois tons ascendentes
    const sampleRate = audioContext.sampleRate;
    const duration = 0.3;
    const buffer = audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        // Primeiro tom: 880Hz (Lá5)
        // Segundo tom: 1320Hz (Mi6) - começa na metade
        const freq = t < duration / 2 ? 880 : 1320;
        const envelope = Math.sin(Math.PI * t / duration); // Fade in/out
        data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.3;
    }

    notificationSound = buffer;
}

function tocarAlertaNovoPedido() {
    if (!audioContext || !notificationSound) return;

    // Resumir contexto se suspenso (política de autoplay)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = notificationSound;
    source.connect(audioContext.destination);
    source.start(0);

    // Tocar duas vezes com intervalo
    setTimeout(() => {
        const source2 = audioContext.createBufferSource();
        source2.buffer = notificationSound;
        source2.connect(audioContext.destination);
        source2.start(0);
    }, 400);
}

function tocarAlertaStatusAlterado() {
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    // Som mais suave para mudança de status
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // Dó5
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // Mi5
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // Sol5

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// ============ CARREGAMENTO DE PEDIDOS ============
async function carregarPedidos() {
    showLoading('Carregando pedidos...');

    try {
        const params = {
            limite: 100, // Carregar mais pedidos para separar por status
            ...currentFilters
        };

        const response = await api.getPedidosAdmin(params);
        todosPedidos = response.pedidos || response.data || response || [];

        // Separar por status
        separarPedidosPorStatus();

        // Verificar novos pedidos
        verificarNovosPedidos();

        // Renderizar
        renderizarPedidos();
        renderizarContadoresStatus();
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        showToast('Erro ao carregar pedidos', 'error');
    } finally {
        hideLoading();
    }
}

function separarPedidosPorStatus() {
    pedidosPorStatus = {};

    STATUS_ORDER.forEach(status => {
        pedidosPorStatus[status] = todosPedidos.filter(p => p.status === status);
    });
}

function verificarNovosPedidos() {
    const pedidosPendentes = pedidosPorStatus.pendente || [];
    const countAtual = pedidosPendentes.length;

    if (countAtual > ultimoPedidoCount && ultimoPedidoCount > 0) {
        const novos = countAtual - ultimoPedidoCount;
        tocarAlertaNovoPedido();
        mostrarNotificacaoVisual(novos);
    }

    ultimoPedidoCount = countAtual;
}

function mostrarNotificacaoVisual(quantidade) {
    // Criar notificação visual persistente
    const notificacao = document.createElement('div');
    notificacao.className = 'admin-alerta-novo-pedido';
    notificacao.style.cssText = `
        position: fixed;
        top: calc(var(--header-height) + 20px);
        right: 20px;
        z-index: 10000;
        background: var(--color-warning);
        color: var(--color-bg-primary);
        padding: 16px 24px;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-card);
        font-family: var(--font-title);
        font-weight: 700;
        font-size: var(--fs-base);
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.4s ease, pulse 2s infinite 1s;
        max-width: 350px;
    `;
    notificacao.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span>${quantidade} novo${quantidade > 1 ? 's' : ''} pedido${quantidade > 1 ? 's' : ''} recebido${quantidade > 1 ? 's' : ''}!</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; font-size: 1.5em; cursor: pointer; line-height: 1; padding: 0; margin-left: 8px;">×</button>
    `;

    document.body.appendChild(notificacao);

    // Auto remover após 10 segundos
    setTimeout(() => {
        if (notificacao.parentElement) {
            notificacao.style.animation = 'slideInRight 0.4s ease reverse';
            setTimeout(() => notificacao.remove(), 400);
        }
    }, 10000);

    // Adicionar estilos de animação se não existirem
    if (!document.getElementById('admin-alert-styles')) {
        const style = document.createElement('style');
        style.id = 'admin-alert-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { opacity: 0; transform: translateX(100px); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes pulse {
                0%, 100% { box-shadow: var(--shadow-card); }
                50% { box-shadow: var(--shadow-card), 0 0 30px rgba(255, 152, 0, 0.5); }
            }
        `;
        document.head.appendChild(style);
    }
}

// ============ RENDERIZAÇÃO ============
function renderizarPedidos() {
    if (!tbodyPedidos) return;

    // Aplicar filtros
    let pedidosFiltrados = filtrarPedidos(todosPedidos);

    if (pedidosFiltrados.length === 0) {
        tbodyPedidos.innerHTML = '';
        emptyState.classList.remove('hidden');
        pagination.style.display = 'none';
        return;
    }

    emptyState.classList.add('hidden');
    pagination.style.display = 'flex';

    // Ordenar: primeiros os status ativos, depois por data (mais recente primeiro)
    pedidosFiltrados.sort((a, b) => {
        const orderA = STATUS_CONFIG[a.status]?.order || 99;
        const orderB = STATUS_CONFIG[b.status]?.order || 99;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.data_criacao) - new Date(a.data_criacao);
    });

    tbodyPedidos.innerHTML = pedidosFiltrados.map(pedido => {
        const config = STATUS_CONFIG[pedido.status] || {};
        const podeAvancar = config.next && ['pendente', 'confirmado', 'preparando', 'saiu_entrega'].includes(pedido.status);

        return `
            <tr data-pedido-id="${pedido.id}" data-status="${pedido.status}" style="border-left: 4px solid ${config.border || 'transparent'};">
                <td>
                    <strong style="font-family: var(--font-heading);">#${escapeHtml(pedido.numero_pedido)}</strong>
                    ${podeAvancar ? `
                        <button class="btn-quick-status btn btn-ghost btn-sm" data-id="${pedido.id}" data-next="${config.next}" title="Avançar para ${STATUS_CONFIG[config.next].label}" style="margin-left: 8px; padding: 2px 8px; font-size: 11px;">
                            ${config.icon} ${STATUS_CONFIG[config.next].label}
                        </button>
                    ` : ''}
                </td>
                <td>${escapeHtml(pedido.cliente_nome || '—')}</td>
                <td>${formatDateTime(pedido.data_criacao)}</td>
                <td>
                    <span class="badge ${pedido.tipo === 'retirada' ? 'badge-info' : 'badge-primary'}" style="font-size: 11px; text-transform: capitalize;">
                        ${pedido.tipo === 'retirada' ? '🏪 Retirada' : '🚚 Entrega'}
                    </span>
                </td>
                <td>
                    <span class="badge" style="
                        background: ${config.bg || 'var(--bg-elevated)'};
                        color: ${config.color || 'var(--text-primary)'};
                        border: 1px solid ${config.border || 'var(--border-subtle)'};
                        font-size: 12px;
                        text-transform: capitalize;
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        padding: 6px 12px;
                    ">
                        ${config.icon} ${getStatusLabel(pedido.status)}
                    </span>
                </td>
                <td>${escapeHtml(pedido.forma_pagamento_nome || '—')}</td>
                <td><strong>${formatCurrency(pedido.total)}</strong></td>
                <td>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline btn-ver" data-id="${pedido.id}" aria-label="Ver detalhes do pedido #${escapeHtml(pedido.numero_pedido)}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            Ver
                        </button>
                        ${podeAvancar ? `
                            <button class="btn btn-sm btn-primary btn-avancar" data-id="${pedido.id}" data-next="${config.next}" aria-label="Avançar status para ${STATUS_CONFIG[config.next].label}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
                                Avançar
                            </button>
                        ` : ''}
                        ${pedido.status !== 'cancelado' && pedido.status !== 'entregue' ? `
                            <button class="btn btn-sm btn-danger btn-cancelar" data-id="${pedido.id}" aria-label="Cancelar pedido #${escapeHtml(pedido.numero_pedido)}">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                Cancelar
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Eventos dos botões
    document.querySelectorAll('.btn-ver').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            abrirModalPedido(parseInt(btn.dataset.id));
        });
    });

    document.querySelectorAll('.btn-avancar').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            abrirModalStatus(parseInt(btn.dataset.id), btn.dataset.next);
        });
    });

    document.querySelectorAll('.btn-quick-status').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            avancarStatusRapido(parseInt(btn.dataset.id), btn.dataset.next);
        });
    });

    document.querySelectorAll('.btn-cancelar').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            abrirModalStatus(parseInt(btn.dataset.id), 'cancelado');
        });
    });

    // Clique na linha para ver detalhes
    document.querySelectorAll('#tbodyPedidos tr[data-pedido-id]').forEach(tr => {
        tr.addEventListener('click', () => {
            const id = parseInt(tr.dataset.pedidoId);
            abrirModalPedido(id);
        });
    });

    renderizarPaginacao(pedidosFiltrados);
}

function filtrarPedidos(pedidos) {
    return pedidos.filter(pedido => {
        // Busca por texto
        if (buscaPedido.value) {
            const termo = buscaPedido.value.toLowerCase();
            const buscaTexto = [
                pedido.numero_pedido,
                pedido.cliente_nome,
                pedido.cliente_telefone,
                pedido.forma_pagamento_nome
            ].join(' ').toLowerCase();
            if (!buscaTexto.includes(termo)) return false;
        }

        // Filtro status
        if (filtroStatus.value && pedido.status !== filtroStatus.value) return false;

        // Filtro pagamento
        if (filtroPagamento.value && pedido.forma_pagamento_id != filtroPagamento.value) return false;

        // Filtro data
        if (dataInicio.value) {
            const pedidoDate = new Date(pedido.data_criacao).toISOString().split('T')[0];
            if (pedidoDate < dataInicio.value) return false;
        }
        if (dataFim.value) {
            const pedidoDate = new Date(pedido.data_criacao).toISOString().split('T')[0];
            if (pedidoDate > dataFim.value) return false;
        }

        return true;
    });
}

function renderizarContadoresStatus() {
    // Atualizar badges nos filtros se existirem
    const statusSelect = document.getElementById('filtroStatus');
    if (statusSelect) {
        Array.from(statusSelect.options).forEach(option => {
            if (option.value) {
                const count = (pedidosPorStatus[option.value] || []).length;
                option.textContent = `${option.textContent.split(' (')[0]} (${count})`;
            }
        });
    }
}

function renderizarPaginacao(pedidosFiltrados) {
    if (!pagination) return;

    const totalItems = pedidosFiltrados.length;
    const pageSize = 20;
    const totalPages = Math.ceil(totalItems / pageSize);

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    pagination.innerHTML = '';

    // Simplificado para admin - mostrar todos ou paginar
    const btnVerTodos = document.createElement('button');
    btnVerTodos.className = 'btn btn-outline btn-sm';
    btnVerTodos.textContent = `Mostrar todos (${totalItems})`;
    btnVerTodos.addEventListener('click', () => {
        // Recarregar sem paginação ou aumentar limite
        carregarPedidos();
    });
    pagination.appendChild(btnVerTodos);
}

// ============ MODAL DE DETALHES DO PEDIDO ============
async function abrirModalPedido(pedidoId) {
    showLoading('Carregando detalhes...');

    try {
        const pedido = await api.getPedidoById(pedidoId);

        // Calcular troco
        let trocoHtml = '';
        if (pedido.forma_pagamento_tipo === 'dinheiro' && pedido.valor_troco > 0) {
            const troco = (pedido.valor_troco - pedido.valor_total).toFixed(2);
            trocoHtml = `
                <div class="pedido-troco" style="background: var(--success-bg); border: 1px solid var(--success-border); border-radius: var(--radius-md); padding: var(--space-4); margin-top: var(--space-4);">
                    <strong style="color: var(--success);">Troco para: </strong> ${formatCurrency(pedido.valor_troco)} <br>
                    <strong style="color: var(--success);">Troco: </strong> ${formatCurrency(troco)}
                </div>
            `;
        }

        // Itens
        let itensHtml = '';
        if (pedido.itens && pedido.itens.length > 0) {
            itensHtml = pedido.itens.map(item => `
                <div class="pedido-item-detalhe" style="display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-3) 0; border-bottom: 1px solid var(--border-subtle); gap: var(--space-4);">
                    <div class="pedido-item-info" style="flex: 1; min-width: 0;">
                        <strong style="color: var(--text-primary);">${escapeHtml(item.produto_nome || item.nome)}</strong>
                        ${item.personalizacoes && item.personalizacoes.length > 0 ? `
                            <div class="pedido-item-personalizacoes" style="margin-top: var(--space-2); display: flex; flex-wrap: wrap; gap: var(--space-2);">
                                ${item.personalizacoes.map(p => `
                                    <span class="badge badge-neutral" style="font-size: 11px;">
                                        ${escapeHtml(p.grupo_nome || p.grupo)}: ${escapeHtml(p.opcao_nome || p.opcao)} ${p.preco_adicional > 0 ? `(+ ${formatCurrency(p.preco_adicional)})` : ''}
                                    </span>
                                `).join(' ')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="pedido-item-quantidade" style="text-align: right; white-space: nowrap; color: var(--text-secondary);">
                        ${item.quantidade}x ${formatCurrency(item.preco_base || item.preco)}
                        ${item.subtotal ? ` = <strong style="color: var(--text-primary);">${formatCurrency(item.subtotal)}</strong>` : ''}
                    </div>
                </div>
            `).join('');
        }

        // Timeline
        const timelineHtml = gerarTimelineAdmin(pedido.status);

        pedidoModalBody.innerHTML = `
            <div class="pedido-detalhe-admin">
                <div class="pedido-header-detalhe" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-6); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border-subtle);">
                    <div>
                        <strong style="font-size: var(--fs-xl); font-family: var(--font-heading);">#${escapeHtml(pedido.numero_pedido)}</strong>
                        <span class="badge" style="
                            background: ${STATUS_CONFIG[pedido.status]?.bg || 'var(--bg-elevated)'};
                            color: ${STATUS_CONFIG[pedido.status]?.color || 'var(--text-primary)'};
                            border: 1px solid ${STATUS_CONFIG[pedido.status]?.border || 'var(--border-subtle)'};
                            font-size: 12px;
                            text-transform: capitalize;
                            margin-left: var(--space-3);
                            display: inline-flex;
                            align-items: center;
                            gap: 6px;
                        ">
                            ${STATUS_CONFIG[pedido.status]?.icon} ${getStatusLabel(pedido.status)}
                        </span>
                    </div>
                    <div style="text-align: right; color: var(--text-muted);">
                        <div>${formatDateTime(pedido.data_criacao)}</div>
                        <div style="font-size: var(--fs-sm);">${pedido.tipo === 'retirada' ? '🏪 Retirada no local' : '🚚 Entrega'}</div>
                    </div>
                </div>

                <!-- Timeline -->
                <div class="pedido-section" style="margin-bottom: var(--space-6);">
                    <h4 style="font-family: var(--font-title); font-size: var(--fs-base); color: var(--accent); margin-bottom: var(--space-4);">Fluxo do Pedido</h4>
                    <div class="status-timeline-admin" style="position: relative; max-width: 400px;">
                        ${timelineHtml}
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-6); margin-bottom: var(--space-6);">
                    <!-- Cliente e Entrega -->
                    <div class="pedido-section">
                        <h4 style="font-family: var(--font-title); font-size: var(--fs-base); color: var(--accent); margin-bottom: var(--space-4);">👤 Cliente & Entrega</h4>
                        <p><strong>${escapeHtml(pedido.cliente_nome || '—')}</strong></p>
                        <p>${escapeHtml(pedido.cliente_telefone || '—')}</p>
                        ${pedido.tipo === 'entrega' ? `
                            <p style="margin-top: var(--space-3);">${escapeHtml(pedido.logradouro || '')}, ${escapeHtml(pedido.numero_endereco || '')}</p>
                            ${pedido.complemento ? `<p>Complemento: ${escapeHtml(pedido.complemento)}</p>` : ''}
                            ${pedido.bairro ? `<p>Bairro: ${escapeHtml(pedido.bairro)}</p>` : ''}
                            ${pedido.referencia ? `<p>Referência: ${escapeHtml(pedido.referencia)}</p>` : ''}
                        ` : '<p style="margin-top: var(--space-3); color: var(--text-muted);">Retirada no balcão</p>'}
                    </div>

                    <!-- Pagamento -->
                    <div class="pedido-section">
                        <h4 style="font-family: var(--font-title); font-size: var(--fs-base); color: var(--accent); margin-bottom: var(--space-4);">💳 Pagamento</h4>
                        <p><strong>Forma: </strong> ${escapeHtml(pedido.forma_pagamento_nome || '—')}</p>
                        ${trocoHtml}
                        ${pedido.observacoes_pagamento ? `<p><strong>Obs: </strong> ${escapeHtml(pedido.observacoes_pagamento)}</p>` : ''}
                    </div>
                </div>

                <!-- Itens -->
                <div class="pedido-section" style="margin-bottom: var(--space-6);">
                    <h4 style="font-family: var(--font-title); font-size: var(--fs-base); color: var(--accent); margin-bottom: var(--space-4);">🍔 Itens do Pedido</h4>
                    ${itensHtml}
                </div>

                <!-- Totais -->
                <div class="pedido-totais" style="background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: var(--space-5);">
                    <div class="d-flex justify-between" style="margin-bottom: var(--space-2);">
                        <span style="color: var(--text-secondary);">Subtotal</span>
                        <span style="color: var(--text-primary);">${formatCurrency(pedido.subtotal_produtos || pedido.subtotal)}</span>
                    </div>
                    ${pedido.taxa_entrega > 0 ? `
                        <div class="d-flex justify-between" style="margin-bottom: var(--space-2);">
                            <span style="color: var(--text-secondary);">Taxa de Entrega</span>
                            <span style="color: var(--text-primary);">${formatCurrency(pedido.taxa_entrega)}</span>
                        </div>
                    ` : ''}
                    ${pedido.taxa_bairro > 0 ? `
                        <div class="d-flex justify-between" style="margin-bottom: var(--space-2);">
                            <span style="color: var(--text-secondary);">Taxa Extra (Bairro)</span>
                            <span style="color: var(--text-primary);">${formatCurrency(pedido.taxa_bairro)}</span>
                        </div>
                    ` : ''}
                    ${pedido.desconto > 0 ? `
                        <div class="d-flex justify-between" style="margin-bottom: var(--space-2); color: var(--success);">
                            <span>Desconto</span>
                            <span>- ${formatCurrency(pedido.desconto)}</span>
                        </div>
                    ` : ''}
                    <div class="d-flex justify-between pedido-total" style="padding-top: var(--space-3); border-top: 2px solid var(--accent); font-size: var(--fs-lg);">
                        <strong style="color: var(--text-primary);">Total</strong>
                        <strong style="color: var(--accent);">${formatCurrency(pedido.valor_total || pedido.total)}</strong>
                    </div>
                </div>
            </div>
        `;

        pedidoModal.classList.remove('hidden');
        pedidoModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        pedidoModalClose.focus();

    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        showToast('Erro ao carregar detalhes do pedido', 'error');
    } finally {
        hideLoading();
    }
}

function fecharModalPedido() {
    pedidoModal.classList.add('hidden');
    pedidoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function gerarTimelineAdmin(statusAtual) {
    const currentIndex = STATUS_ORDER.indexOf(statusAtual);

    return STATUS_ORDER.map((status, index) => {
        if (status === 'cancelado') return ''; // Não mostrar na timeline normal
        const config = STATUS_CONFIG[status];
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = index > currentIndex;
        const isLast = index === STATUS_ORDER.length - 2; // -2 para pular cancelado

        return `
            <div class="timeline-step-admin" style="
                display: flex;
                gap: var(--space-3);
                padding: var(--space-3) 0;
                position: relative;
                ${!isLast ? `
                    &::before {
                        content: '';
                        position: absolute;
                        left: 10px;
                        top: 32px;
                        bottom: 0;
                        width: 2px;
                        background: ${isCompleted ? 'var(--success)' : 'var(--border-subtle)'};
                        z-index: -1;
                    }
                ` : ''}
            ">
                <div style="
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    flex-shrink: 0;
                    z-index: 1;
                    ${isCompleted ? 'background: var(--success); color: white; border: 2px solid var(--success);' : ''}
                    ${isCurrent ? `background: ${config.color}; color: ${config.color === 'var(--color-accent)' ? 'var(--bg-primary)' : 'white'}; border: 2px solid ${config.color}; box-shadow: 0 0 12px ${config.color}; animation: pulse 1.5s infinite;` : ''}
                    ${isFuture ? 'background: var(--bg-elevated); color: var(--text-dim); border: 2px solid var(--border-subtle);' : ''}
                " aria-hidden="true">
                    ${isCompleted ? '✓' : config.icon}
                </div>
                <div style="flex: 1; min-width: 0;">
                    <strong style="color: ${isFuture ? 'var(--text-dim)' : 'var(--text-primary)'}; font-size: var(--fs-sm);">
                        ${config.label}
                        ${isCurrent ? '<span class="badge badge-primary" style="font-size: 10px; margin-left: var(--space-2);">ATUAL</span>' : ''}
                    </strong>
                </div>
            </div>
        `;
    }).join('');
}

// ============ MODAL DE ALTERAÇÃO DE STATUS ============
function abrirModalStatus(pedidoId, statusSugerido) {
    statusPedidoId.value = pedidoId;
    novoStatus.value = statusSugerido;

    // Mostrar/ocultar motivo de cancelamento
    const showMotivo = statusSugerido === 'cancelado';
    motivoCancelamentoGroup.style.display = showMotivo ? 'block' : 'none';
    motivoCancelamento.required = showMotivo;
    motivoCancelamento.value = '';

    statusModal.classList.remove('hidden');
    statusModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    novoStatus.focus();
}

function fecharModalStatus() {
    statusModal.classList.add('hidden');
    statusModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

async function confirmarAlteracaoStatus() {
    const pedidoId = parseInt(statusPedidoId.value);
    const status = novoStatus.value;
    const motivo = motivoCancelamento.value;

    if (!status) {
        showToast('Selecione um status', 'warning');
        return;
    }

    if (status === 'cancelado' && !motivo.trim()) {
        showToast('Informe o motivo do cancelamento', 'warning');
        return;
    }

    const btn = btnConfirmarStatus;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></div> Salvando...';

    try {
        const response = await api.atualizarStatusPedido(pedidoId, { status, motivo_cancelamento: motivo });

        tocarAlertaStatusAlterado();
        showToast(`Status atualizado para ${getStatusLabel(status)}`, 'success');

        fecharModalStatus();

        // Atualizar lista local
        const index = todosPedidos.findIndex(p => p.id === pedidoId);
        if (index >= 0) {
            todosPedidos[index] = { ...todosPedidos[index], ...response };
            separarPedidosPorStatus();
            renderizarPedidos();
            renderizarContadoresStatus();
        }

        // Se modal de detalhes estiver aberto, fechar para forçar recarregar
        if (!pedidoModal.classList.contains('hidden')) {
            fecharModalPedido();
        }

    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        showToast(error.message || 'Erro ao atualizar status', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function avancarStatusRapido(pedidoId, novoStatus) {
    // Confirmação rápida para avançar status
    const config = STATUS_CONFIG[novoStatus];
    if (!confirm(`Avançar pedido para "${config.label}"?`)) return;

    try {
        const response = await api.atualizarStatusPedido(pedidoId, { status: novoStatus });

        tocarAlertaStatusAlterado();
        showToast(`Status avançado para ${config.label}`, 'success');

        // Atualizar lista local
        const index = todosPedidos.findIndex(p => p.id === pedidoId);
        if (index >= 0) {
            todosPedidos[index] = { ...todosPedidos[index], ...response };
            separarPedidosPorStatus();
            renderizarPedidos();
            renderizarContadoresStatus();
        }

    } catch (error) {
        console.error('Erro ao avançar status:', error);
        showToast(error.message || 'Erro ao avançar status', 'error');
    }
}

// ============ FILTROS ============
function aplicarFiltros() {
    currentFilters = {};

    if (buscaPedido.value) {
        currentFilters.busca = buscaPedido.value;
    }
    if (filtroStatus.value) {
        currentFilters.status = filtroStatus.value;
    }
    if (filtroPagamento.value) {
        currentFilters.forma_pagamento_id = filtroPagamento.value;
    }
    if (dataInicio.value) {
        currentFilters.data_inicio = dataInicio.value;
    }
    if (dataFim.value) {
        currentFilters.data_fim = dataFim.value;
    }

    renderizarPedidos();
}

function limparFiltros() {
    buscaPedido.value = '';
    filtroStatus.value = '';
    filtroPagamento.value = '';
    dataInicio.value = '';
    dataFim.value = '';
    currentFilters = {};
    renderizarPedidos();
}

// ============ FORMAS DE PAGAMENTO ============
async function carregarFormasPagamento() {
    try {
        const response = await api.getFormasPagamento(true);
        const metodos = response || [];

        if (filtroPagamento) {
            // Manter primeira opção
            const primeiraOpcao = filtroPagamento.querySelector('option');
            filtroPagamento.innerHTML = '';
            filtroPagamento.appendChild(primeiraOpcao);

            metodos.forEach(metodo => {
                const option = document.createElement('option');
                option.value = metodo.id;
                option.textContent = metodo.nome;
                filtroPagamento.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar formas de pagamento:', error);
    }
}

// ============ POLLING PARA ATUALIZAÇÕES EM TEMPO REAL ============
function iniciarPollingPedidos() {
    // Polling a cada 15 segundos para novos pedidos
    pollingInterval = setInterval(async () => {
        if (document.visibilityState === 'hidden') return;

        try {
            const response = await api.getPedidosAdmin({
                limite: 50,
                status: 'pendente,confirmado,preparando,saiu_entrega'
            });

            const pedidosAtivos = response.pedidos || response.data || response || [];
            const countPendentes = pedidosAtivos.filter(p => p.status === 'pendente').length;

            if (countPendentes > ultimoPedidoCount && ultimoPedidoCount > 0) {
                const novos = countPendentes - ultimoPedidoCount;
                tocarAlertaNovoPedido();
                mostrarNotificacaoVisual(novos);
            }

            // Atualizar lista completa se houver mudanças
            if (pedidosAtivos.length !== todosPedidos.filter(p => !['entregue', 'cancelado'].includes(p.status)).length) {
                await carregarPedidos();
            }

        } catch (error) {
            console.debug('Polling error:', error);
        }
    }, 15000);
}

function pararPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// ============ LIMPEZA AO SAIR ============
window.addEventListener('beforeunload', () => {
    pararPolling();
    if (audioContext) {
        audioContext.close();
    }
});

// ============ EXPORTAR PARA USO GLOBAL ============
window.adminPedidos = {
    STATUS_CONFIG,
    STATUS_ORDER,
    getStatusLabel,
    getStatusClass,
    tocarAlertaNovoPedido,
    tocarAlertaStatusAlterado,
    avancarStatusRapido,
    carregarPedidos
};