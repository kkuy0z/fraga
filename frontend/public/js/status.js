/**
 * Status.js - Acompanhamento de Pedidos em Tempo Real
 * Tela de "Meus Pedidos" / Rastreamento com fluxo visual de status
 * Simulação de atualização em tempo real (preparado para WebSockets)
 */

import api from './api.js';
import cart from './cart.js';
import { formatCurrency, showToast, showLoading, hideLoading, formatDateTime, getStatusLabel, getStatusClass, escapeHtml, generateId } from './utils.js';
import { verificarAuth, handleLogout } from './shared-components.js';

// ============ ESTADO DA APLICAÇÃO ============
let pedidos = [];
let currentPage = 1;
const pageSize = 10;
let totalPages = 1;
let currentFilters = {};
let statusUpdateInterval = null;
let pedidoAtualRastreando = null;
let websocketSimulation = null;

// ============ ELEMENTOS DOM ============
const tbodyPedidos = document.getElementById('tbodyPedidos');
const emptyState = document.getElementById('emptyState');
const pagination = document.getElementById('pagination');
const cartCount = document.getElementById('cartCount');
const filtroStatus = document.getElementById('filtroStatus');
const dataInicio = document.getElementById('dataInicio');
const dataFim = document.getElementById('dataFim');
const btnLimparFiltros = document.getElementById('btnLimparFiltros');
const pedidoModal = document.getElementById('pedidoModal');
const pedidoModalBody = document.getElementById('pedidoModalBody');
const pedidoModalClose = document.getElementById('pedidoModalClose');
const pedidoModalFechar = document.getElementById('pedidoModalFechar');
const pedidoModalRastrear = document.getElementById('pedidoModalRastrear');

// Elementos da página de rastreamento (se existir)
const rastreamentoContainer = document.getElementById('rastreamentoContainer');
const statusTimeline = document.getElementById('statusTimeline');
const statusAtualBadge = document.getElementById('statusAtualBadge');
const tempoEstimadoEl = document.getElementById('tempoEstimado');
const btnAtualizarStatus = document.getElementById('btnAtualizarStatus');

// ============ CONFIGURAÇÃO DE STATUS ============
const STATUS_FLOW = [
    { id: 'pendente', label: 'Novo Pedido', icon: '📝', color: 'var(--color-warning)', description: 'Pedido recebido, aguardando confirmação' },
    { id: 'confirmado', label: 'Confirmado', icon: '✅', color: 'var(--color-info)', description: 'Pedido confirmado pela cozinha' },
    { id: 'preparando', label: 'Em Preparo', icon: '👨‍🍳', color: 'var(--color-info)', description: 'Seu pedido está sendo preparado' },
    { id: 'saiu_entrega', label: 'Saiu para Entrega', icon: '🛵', color: 'var(--color-accent)', description: 'Pedido a caminho do seu endereço' },
    { id: 'entregue', label: 'Concluído', icon: '🎉', color: 'var(--color-success)', description: 'Pedido entregue com sucesso' },
    { id: 'cancelado', label: 'Cancelado', icon: '❌', color: 'var(--color-error)', description: 'Pedido foi cancelado' }
];

// ============ INICIALIZAÇÃO ============
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarPagina();
    configurarEventListeners();
    atualizarContadorCarrinho();
    iniciarSimulacaoTempoReal();
});

async function inicializarPagina() {
    // Verificar se cliente está autenticado
    if (!api.isClienteAuthenticated()) {
        showToast('Você precisa estar logado para ver seus pedidos', 'warning');
        sessionStorage.setItem('redirectAfterLogin', '/inicio/meus-pedidos.html');
        setTimeout(() => window.location.href = '/Cadastro/login.html', 2000);
        return;
    }

    // Verificar se há parâmetro de rastreamento direto
    const urlParams = new URLSearchParams(window.location.search);
    const rastrearId = urlParams.get('rastrear');
    const rastrearNumero = urlParams.get('numero');

    if (rastrearId || rastrearNumero) {
        await rastrearPedidoDireto(rastrearId, rastrearNumero);
    } else {
        await carregarPedidos();
    }
}

function configurarEventListeners() {
    // Atualizar contador do carrinho quando mudar
    cart.subscribe(atualizarContadorCarrinho);

    // Filtros
    filtroStatus.addEventListener('change', () => aplicarFiltros());
    dataInicio.addEventListener('change', () => aplicarFiltros());
    dataFim.addEventListener('change', () => aplicarFiltros());
    btnLimparFiltros.addEventListener('click', limparFiltros);

    // Fechar modal
    pedidoModalClose.addEventListener('click', fecharModalPedido);
    pedidoModalFechar.addEventListener('click', fecharModalPedido);
    pedidoModal.addEventListener('click', (e) => {
        if (e.target === pedidoModal) fecharModalPedido();
    });

    // Fechar modal com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !pedidoModal.classList.contains('hidden')) {
            fecharModalPedido();
        }
    });

    // Botão de rastreamento na página de detalhes
    if (btnAtualizarStatus) {
        btnAtualizarStatus.addEventListener('click', () => {
            if (pedidoAtualRastreando) {
                carregarRastreamento(pedidoAtualRastreando.id, pedidoAtualRastreando.numero);
            }
        });
    }

    // Dropdown user menu
    const userButton = document.getElementById('userButton');
    const userDropdown = document.getElementById('userDropdown');
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
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

function atualizarContadorCarrinho() {
    const total = cart.getTotalItems();
    if (cartCount) {
        cartCount.textContent = total;
        cartCount.style.display = total > 0 ? 'flex' : 'none';
    }
}

// ============ CARREGAMENTO DE PEDIDOS ============
async function carregarPedidos() {
    showLoading('Carregando pedidos...');

    try {
        const params = {
            page: currentPage,
            limit: pageSize,
            ...currentFilters
        };

        const response = await api.getMeusPedidos(params);
        pedidos = response.data || response.pedidos || [];
        totalPages = response.totalPages || response.total_pages || 1;

        renderizarPedidos();
        renderizarPaginacao();
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        showToast('Erro ao carregar pedidos. Tente novamente.', 'error');
        if (tbodyPedidos) {
            tbodyPedidos.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-danger">Erro ao carregar pedidos</td>
                </tr>
            `;
        }
    } finally {
        hideLoading();
    }
}

function aplicarFiltros() {
    currentFilters = {};

    if (filtroStatus.value) {
        currentFilters.status = filtroStatus.value;
    }

    if (dataInicio.value) {
        currentFilters.data_inicio = dataInicio.value;
    }

    if (dataFim.value) {
        currentFilters.data_fim = dataFim.value;
    }

    currentPage = 1;
    carregarPedidos();
}

function limparFiltros() {
    filtroStatus.value = '';
    dataInicio.value = '';
    dataFim.value = '';
    currentFilters = {};
    currentPage = 1;
    carregarPedidos();
}

// ============ RENDERIZAÇÃO DA LISTA ============
function renderizarPedidos() {
    if (!tbodyPedidos) return;

    if (pedidos.length === 0) {
        tbodyPedidos.innerHTML = '';
        emptyState.classList.remove('hidden');
        pagination.style.display = 'none';
        return;
    }

    emptyState.classList.add('hidden');
    pagination.style.display = 'flex';

    tbodyPedidos.innerHTML = pedidos.map(pedido => `
        <tr data-pedido-id="${pedido.id}" style="cursor: pointer;">
            <td><strong>#${escapeHtml(pedido.numero_pedido || pedido.numero)}</strong></td>
            <td>${formatDateTime(pedido.data_pedido || pedido.criado_em)}</td>
            <td>
                <span class="badge ${getStatusClass(pedido.status)} status-badge-item" style="font-size: 12px; text-transform: capitalize; display: inline-flex; align-items: center; gap: 6px;">
                    <span class="status-pulse" style="width: 8px; height: 8px; border-radius: 50%; background: currentColor; ${['preparando', 'saiu_entrega'].includes(pedido.status) ? 'animation: pulse 1.5s infinite;' : ''}"></span>
                    ${getStatusLabel(pedido.status)}
                </span>
            </td>
            <td>${pedido.itens ? pedido.itens.length : (pedido.total_itens || 0)} item(s)</td>
            <td><strong>${formatCurrency(pedido.valor_total || pedido.total)}</strong></td>
            <td>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline btn-ver" data-id="${pedido.id}" data-numero="${escapeHtml(pedido.numero_pedido || pedido.numero)}" aria-label="Ver detalhes do pedido #${escapeHtml(pedido.numero_pedido || pedido.numero)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        Ver
                    </button>
                    ${['pendente', 'confirmado', 'preparando', 'saiu_entrega'].includes(pedido.status) ? `
                        <button class="btn btn-sm btn-primary btn-rastrear" data-id="${pedido.id}" data-numero="${escapeHtml(pedido.numero_pedido || pedido.numero)}" aria-label="Rastrear pedido #${escapeHtml(pedido.numero_pedido || pedido.numero)}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M12 2v20M2 12h20"></path>
                            </svg>
                            Rastrear
                        </button>
                    ` : ''}
                    ${pedido.status === 'entregue' ? `
                        <button class="btn btn-sm btn-outline btn-recomprar" data-id="${pedido.id}" aria-label="Comprar novamente pedido #${escapeHtml(pedido.numero_pedido || pedido.numero)}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <path d="M21 12V7H5"></path>
                                <path d="M16 7l-4-4-4 4"></path>
                                <path d="M3.5 4.5A2.5 2.5 0 0 0 1 7v10c0 1.3.8 2.5 2 2.9"></path>
                                <path d="M21 12v5c0 1.3-.8 2.5-2 2.9"></path>
                                <path d="M18.5 4.5A2.5 2.5 0 0 1 21 7v10"></path>
                            </svg>
                            Recomprar
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');

    // Adicionar estilos de animação
    adicionarEstilosAnimacao();

    // Eventos dos botões
    document.querySelectorAll('.btn-ver').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            abrirModalPedido(parseInt(btn.dataset.id), btn.dataset.numero);
        });
    });

    document.querySelectorAll('.btn-rastrear').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            rastrearPedido(parseInt(btn.dataset.id), btn.dataset.numero);
        });
    });

    document.querySelectorAll('.btn-recomprar').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            recomprarPedido(parseInt(btn.dataset.id));
        });
    });

    // Clique na linha para ver detalhes
    document.querySelectorAll('#tbodyPedidos tr[data-pedido-id]').forEach(tr => {
        tr.addEventListener('click', () => {
            const id = parseInt(tr.dataset.pedidoId);
            const numero = tr.querySelector('strong').textContent.replace('#', '');
            abrirModalPedido(id, numero);
        });
    });
}

function adicionarEstilosAnimacao() {
    if (!document.getElementById('status-animations')) {
        const style = document.createElement('style');
        style.id = 'status-animations';
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(1.2); }
            }
            @keyframes slideInRight {
                from { opacity: 0; transform: translateX(20px); }
                to { opacity: 1; transform: translateX(0); }
            }
            .status-badge-item { animation: slideInRight 0.3s ease; }
            .timeline-step { animation: slideInRight 0.4s ease backwards; }
            .timeline-step:nth-child(1) { animation-delay: 0.1s; }
            .timeline-step:nth-child(2) { animation-delay: 0.2s; }
            .timeline-step:nth-child(3) { animation-delay: 0.3s; }
            .timeline-step:nth-child(4) { animation-delay: 0.4s; }
            .timeline-step:nth-child(5) { animation-delay: 0.5s; }
            .timeline-step:nth-child(6) { animation-delay: 0.6s; }
        `;
        document.head.appendChild(style);
    }
}

// ============ MODAL DE DETALHES ============
async function abrirModalPedido(pedidoId, numeroPedido) {
    showLoading('Carregando detalhes...');

    try {
        const pedido = await api.getPedidoById(pedidoId);

        // Calcular troco se pagamento em dinheiro
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

        // Timeline de status
        const timelineHtml = gerarTimelineStatus(pedido.status);

        pedidoModalBody.innerHTML = `
            <div class="pedido-detalhe">
                <div class="pedido-header-detalhe" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-6); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border-subtle);">
                    <div>
                        <strong style="font-size: var(--fs-lg);">Pedido #${escapeHtml(pedido.numero_pedido || pedido.numero || pedidoId)}</strong>
                        <span class="badge ${getStatusClass(pedido.status)} ml-2" style="font-size: 12px; text-transform: capitalize; margin-left: var(--space-3);">
                            ${getStatusLabel(pedido.status)}
                        </span>
                    </div>
                    <div class="pedido-data" style="color: var(--text-muted); font-size: var(--fs-sm);">
                        ${formatDateTime(pedido.data_pedido || pedido.criado_em)}
                    </div>
                </div>

                <!-- Timeline de Status -->
                <div class="pedido-section" style="margin-bottom: var(--space-6);">
                    <h4 style="font-family: var(--font-title); font-size: var(--fs-base); color: var(--accent); margin-bottom: var(--space-4); display: flex; align-items: center; gap: var(--space-2);">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2v20M12 12l-4 4 6 6"></path></svg>
                        Acompanhamento do Pedido
                    </h4>
                    <div class="status-timeline" style="position: relative;">
                        ${timelineHtml}
                    </div>
                </div>

                <div class="pedido-section" style="margin-bottom: var(--space-6);">
                    <h4 style="font-family: var(--font-title); font-size: var(--fs-base); color: var(--accent); margin-bottom: var(--space-4);">Entrega</h4>
                    <p><strong>${escapeHtml(pedido.cliente_nome || pedido.nome)}</strong></p>
                    <p>${escapeHtml(pedido.cliente_telefone || pedido.telefone)}</p>
                    <p>${escapeHtml(pedido.logradouro || '')}, ${escapeHtml(pedido.numero_endereco || pedido.numero)}</p>
                    ${pedido.complemento ? `<p>Complemento: ${escapeHtml(pedido.complemento)}</p>` : ''}
                    ${pedido.bairro ? `<p>Bairro: ${escapeHtml(pedido.bairro)}</p>` : ''}
                    ${pedido.cep ? `<p>CEP: ${escapeHtml(pedido.cep)}</p>` : ''}
                    ${pedido.referencia ? `<p>Referência: ${escapeHtml(pedido.referencia)}</p>` : ''}
                </div>

                <div class="pedido-section" style="margin-bottom: var(--space-6);">
                    <h4 style="font-family: var(--font-title); font-size: var(--fs-base); color: var(--accent); margin-bottom: var(--space-4);">Pagamento</h4>
                    <p><strong>Forma: </strong> ${escapeHtml(pedido.forma_pagamento_nome || pedido.forma_pagamento || 'Não informado')}</p>
                    ${trocoHtml}
                    ${pedido.observacoes_pagamento ? `<p><strong>Obs: </strong> ${escapeHtml(pedido.observacoes_pagamento)}</p>` : ''}
                </div>

                <div class="pedido-section" style="margin-bottom: var(--space-6);">
                    <h4 style="font-family: var(--font-title); font-size: var(--fs-base); color: var(--accent); margin-bottom: var(--space-4);">Itens do Pedido</h4>
                    ${itensHtml}
                </div>

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

        // Mostrar/ocultar botão rastrear baseado no status
        if (['pendente', 'confirmado', 'preparando', 'saiu_entrega'].includes(pedido.status)) {
            pedidoModalRastrear.style.display = 'inline-flex';
            pedidoModalRastrear.onclick = () => {
                fecharModalPedido();
                rastrearPedido(pedidoId, pedido.numero_pedido || pedido.numero);
            };
        } else {
            pedidoModalRastrear.style.display = 'none';
        }

        pedidoModal.classList.remove('hidden');
        pedidoModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        pedidoModalClose.focus();

    } catch (error) {
        console.error('Erro ao carregar detalhes do pedido:', error);
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

function gerarTimelineStatus(statusAtual) {
    const currentIndex = STATUS_FLOW.findIndex(s => s.id === statusAtual);

    return STATUS_FLOW.map((status, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = index > currentIndex;
        const isLast = index === STATUS_FLOW.length - 1;

        let stepClass = 'timeline-step';
        let markerClass = 'timeline-marker';
        let contentClass = 'timeline-content';

        if (isCompleted) {
            stepClass += ' completed';
            markerClass += ' completed';
        } else if (isCurrent) {
            stepClass += ' current';
            markerClass += ' current';
        } else {
            stepClass += ' pending';
            markerClass += ' pending';
        }

        return `
            <div class="${stepClass}" style="
                display: flex;
                gap: var(--space-4);
                padding: var(--space-3) 0;
                position: relative;
                ${!isLast ? `
                    &::before {
                        content: '';
                        position: absolute;
                        left: 11px;
                        top: 36px;
                        bottom: 0;
                        width: 2px;
                        background: ${isCompleted ? 'var(--success)' : 'var(--border-subtle)'};
                        z-index: -1;
                    }
                ` : ''}
            ">
                <div class="${markerClass}" style="
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    flex-shrink: 0;
                    z-index: 1;
                    transition: all var(--transition-base);
                    ${isCompleted ? 'background: var(--success); color: white; border: 2px solid var(--success);' : ''}
                    ${isCurrent ? 'background: var(--accent); color: var(--bg-primary); border: 2px solid var(--accent); box-shadow: 0 0 12px var(--accent); animation: pulse 1.5s infinite;' : ''}
                    ${isFuture ? 'background: var(--bg-elevated); color: var(--text-dim); border: 2px solid var(--border-subtle);' : ''}
                " aria-hidden="true">
                    ${isCompleted ? '✓' : status.icon}
                </div>
                <div class="${contentClass}" style="flex: 1; min-width: 0;">
                    <strong style="color: ${isFuture ? 'var(--text-dim)' : 'var(--text-primary)'}; font-size: var(--fs-sm);">
                        ${status.label}
                        ${isCurrent ? '<span class="badge badge-primary" style="font-size: 10px; margin-left: var(--space-2);">Atual</span>' : ''}
                    </strong>
                    <p style="font-size: var(--fs-xs); color: var(--text-muted); margin-top: 2px;">${status.description}</p>
                </div>
            </div>
        `;
    }).join('');
}

// ============ RASTREAMENTO DE PEDIDO (PÁGINA DEDICADA) ============
async function rastrearPedido(pedidoId, numeroPedido) {
    // Se estamos na página meus-pedidos.html, abrir modal de rastreamento
    // Se estamos em pedido.html (página dedicada), mostrar tela cheia
    if (rastreamentoContainer) {
        await carregarRastreamento(pedidoId, numeroPedido);
    } else {
        // Redirecionar para página de rastreamento ou abrir modal expandido
        window.location.href = `/inicio/pedido.html?rastrear=${pedidoId}&numero=${encodeURIComponent(numeroPedido)}`;
    }
}

async function rastrearPedidoDireto(pedidoId, numeroPedido) {
    showLoading('Carregando rastreamento...');

    try {
        const numero = numeroPedido || pedidoId;
        const pedido = pedidoId ? await api.getPedidoById(pedidoId) : await api.getPedidoByNumero(numero);

        if (rastreamentoContainer) {
            // Página dedicada de rastreamento
            renderizarPaginaRastreamento(pedido);
        } else {
            // Modal de rastreamento
            renderizarModalRastreamento(pedido);
        }

        pedidoAtualRastreando = pedido;
        iniciarAtualizacaoAutomatica(pedido.id || pedidoId, pedido.numero_pedido || pedido.numero);

    } catch (error) {
        console.error('Erro ao rastrear pedido:', error);
        showToast('Erro ao carregar rastreamento', 'error');
    } finally {
        hideLoading();
    }
}

async function carregarRastreamento(pedidoId, numeroPedido) {
    showLoading('Atualizando rastreamento...');

    try {
        const pedido = await api.getPedidoByNumero(numeroPedido);

        if (rastreamentoContainer) {
            renderizarPaginaRastreamento(pedido);
        } else {
            renderizarModalRastreamento(pedido);
        }

        pedidoAtualRastreando = pedido;
        showToast('Status atualizado', 'success');

    } catch (error) {
        console.error('Erro ao atualizar rastreamento:', error);
        showToast('Erro ao atualizar status', 'error');
    } finally {
        hideLoading();
    }
}

function renderizarPaginaRastreamento(pedido) {
    // Hide loading, show content
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('errorState').classList.add('hidden');
    document.getElementById('orderContent').classList.remove('hidden');

    const currentIndex = STATUS_FLOW.findIndex(s => s.id === pedido.status);
    const statusAtual = STATUS_FLOW[currentIndex] || STATUS_FLOW[0];

    // Update header
    document.getElementById('orderNumber').textContent = `#${escapeHtml(pedido.numero_pedido || pedido.numero)}`;
    document.getElementById('orderDate').textContent = formatDateTime(pedido.data_pedido || pedido.criado_em);
    document.getElementById('statusIcon').textContent = statusAtual.icon;
    document.getElementById('statusLabel').textContent = getStatusLabel(pedido.status);

    // Update status badge styling
    const statusBadge = document.getElementById('statusBadge');
    statusBadge.className = `badge ${getStatusClass(pedido.status)}`;
    statusBadge.style.fontSize = 'var(--fs-sm)';
    statusBadge.style.padding = 'var(--space-2) var(--space-4)';
    statusBadge.style.whiteSpace = 'nowrap';
    statusBadge.style.minWidth = '140px';
    statusBadge.style.textAlign = 'center';
    statusBadge.style.borderRadius = 'var(--radius-full)';

    // Timeline
    document.getElementById('statusTimeline').innerHTML = gerarTimelineStatus(pedido.status);

    // Countdown
    const tempoEstimado = calcularTempoEstimado(pedido.status, pedido.data_pedido || pedido.criado_em);
    if (tempoEstimado && ['pendente', 'confirmado', 'preparando', 'saiu_entrega'].includes(pedido.status)) {
        document.getElementById('countdownSection').classList.remove('hidden');
        iniciarContagemRegressivaCompleta(tempoEstimado);
    } else {
        document.getElementById('countdownSection').classList.add('hidden');
    }

    // Delivery Info
    renderizarInfoEntrega(pedido);

    // Items
    renderizarItensPedido(pedido);

    // Payment
    renderizarInfoPagamento(pedido);

    // Totals
    renderizarTotaisPedido(pedido);

    // Reorder button
    const btnRecomprar = document.getElementById('btnRecomprar');
    if (btnRecomprar) {
        btnRecomprar.onclick = () => recomprarPedido(pedido.id);
    }

    // Start auto-refresh for active orders
    if (['pendente', 'confirmado', 'preparando', 'saiu_entrega'].includes(pedido.status)) {
        iniciarAtualizacaoAutomatica(pedido.id, pedido.numero_pedido || pedido.numero);
    } else {
        pararAtualizacaoAutomatica();
    }
}

function renderizarInfoEntrega(pedido) {
    const container = document.getElementById('deliveryInfo');
    if (pedido.tipo === 'retirada') {
        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-4); background: var(--info-weak); border: 1px solid var(--info-border); border-radius: var(--radius-md);">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--info)" stroke-width="1.5" style="margin-bottom: var(--space-2);" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <strong style="color: var(--text-primary); display: block; margin-bottom: var(--space-1);">Retirada no Local</strong>
                <p style="color: var(--text-secondary);">Seu pedido estará pronto para retirada na loja.</p>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div>
                <strong style="color: var(--text-secondary); display: block; font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1);">Endereço</strong>
                <p style="color: var(--text-primary);">${escapeHtml(pedido.logradouro || '')}, ${escapeHtml(pedido.numero_endereco || pedido.numero)}</p>
                ${pedido.complemento ? `<p style="color: var(--text-muted); font-size: var(--fs-sm);">Complemento: ${escapeHtml(pedido.complemento)}</p>` : ''}
                ${pedido.bairro ? `<p style="color: var(--text-muted); font-size: var(--fs-sm);">Bairro: ${escapeHtml(pedido.bairro)}</p>` : ''}
                ${pedido.referencia ? `<p style="color: var(--text-muted); font-size: var(--fs-sm);">Referência: ${escapeHtml(pedido.referencia)}</p>` : ''}
            </div>
            <div>
                <strong style="color: var(--text-secondary); display: block; font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1);">Contato</strong>
                <p style="color: var(--text-primary);">${escapeHtml(pedido.cliente_telefone || pedido.telefone)}</p>
                <p style="color: var(--text-muted); font-size: var(--fs-sm);">${escapeHtml(pedido.cliente_nome || pedido.nome)}</p>
            </div>
        `;
    }
}

function renderizarItensPedido(pedido) {
    const container = document.getElementById('orderItems');
    if (!pedido.itens || pedido.itens.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: var(--space-4);">Nenhum item encontrado</p>';
        return;
    }

    container.innerHTML = pedido.itens.map(item => {
        const personalizacoesHtml = (item.personalizacoes || []).length > 0 ? `
            <div style="margin-top: var(--space-2); display: flex; flex-wrap: wrap; gap: var(--space-2);">
                ${item.personalizacoes.map(p => `
                    <span class="badge badge-neutral" style="font-size: var(--fs-xs);">${escapeHtml(p.grupo_nome || p.grupo)}: ${escapeHtml(p.opcao_nome || p.opcao)}${p.preco_adicional > 0 ? ` (+${formatCurrency(p.preco_adicional)})` : ''}</span>
                `).join('')}
            </div>
        ` : '';

        const subtotal = (item.preco_base + (item.personalizacoes || []).reduce((s, p) => s + (p.preco_adicional || 0), 0)) * item.quantidade;

        return `
            <div style="display: flex; gap: var(--space-3); padding: var(--space-3); background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
                <div style="flex: 1; min-width: 0;">
                    <strong style="color: var(--text-primary);">${escapeHtml(item.produto_nome || item.nome)}</strong>
                    ${personalizacoesHtml}
                    <div style="margin-top: var(--space-1); color: var(--text-secondary); font-size: var(--fs-sm);">
                        ${item.quantidade}x ${formatCurrency(item.preco_base)} = ${formatCurrency(subtotal)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderizarInfoPagamento(pedido) {
    const container = document.getElementById('paymentInfo');
    container.innerHTML = `
        <div>
            <strong style="color: var(--text-secondary); display: block; font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1);">Forma de Pagamento</strong>
            <p style="color: var(--text-primary);">${escapeHtml(pedido.forma_pagamento_nome || 'Não informado')}</p>
        </div>
        ${pedido.forma_pagamento_tipo === 'dinheiro' && pedido.valor_troco > 0 ? `
            <div>
                <strong style="color: var(--text-secondary); display: block; font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1);">Troco</strong>
                <p style="color: var(--text-primary);">Recebido: ${formatCurrency(pedido.valor_troco)}</p>
                <p style="color: var(--success); font-weight: 600;">Troco: ${formatCurrency(pedido.valor_troco - (pedido.valor_total || pedido.total))}</p>
            </div>
        ` : ''}
    `;
}

function renderizarTotaisPedido(pedido) {
    const container = document.getElementById('orderTotals');
    const subtotal = pedido.subtotal_produtos || pedido.subtotal || 0;
    const taxaEntrega = pedido.taxa_entrega || 0;
    const taxaBairro = pedido.taxa_bairro || 0;
    const desconto = pedido.desconto || 0;
    const total = pedido.valor_total || pedido.total || 0;

    container.innerHTML = `
        <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
            <span>Subtotal</span>
            <span>${formatCurrency(subtotal)}</span>
        </div>
        ${taxaEntrega > 0 ? `
            <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
                <span>Taxa de Entrega</span>
                <span>${formatCurrency(taxaEntrega)}</span>
            </div>
        ` : ''}
        ${taxaBairro > 0 ? `
            <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
                <span>Taxa Extra (Bairro)</span>
                <span>${formatCurrency(taxaBairro)}</span>
            </div>
        ` : ''}
        ${desconto > 0 ? `
            <div style="display: flex; justify-content: space-between; color: var(--success);">
                <span>Desconto</span>
                <span>- ${formatCurrency(desconto)}</span>
            </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; padding-top: var(--space-2); border-top: 2px solid var(--accent); font-size: var(--fs-lg);">
            <strong style="color: var(--text-primary);">Total</strong>
            <strong style="color: var(--accent);">${formatCurrency(total)}</strong>
        </div>
    `;
}

function iniciarContagemRegressivaCompleta(tempoInicial) {
    const display = document.getElementById('countdownDisplay');
    const label = document.getElementById('countdownLabel');
    if (!display) return;

    // Parse inicial
    let minutosTotal = 0;
    if (tempoInicial.includes('h')) {
        const partes = tempoInicial.split('h');
        minutosTotal = parseInt(partes[0]) * 60 + parseInt(partes[1].replace('min', '').trim());
    } else {
        minutosTotal = parseInt(tempoInicial.replace('min', '').trim());
    }

    const atualizarDisplay = () => {
        const horas = Math.floor(minutosTotal / 60);
        const mins = minutosTotal % 60;

        if (horas > 0) {
            display.textContent = `${horas.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        } else {
            display.textContent = `${mins.toString().padStart(2, '0')} min`;
        }

        if (minutosTotal <= 5) {
            display.style.color = 'var(--error)';
            label.textContent = 'Chegando em breve...';
        } else if (minutosTotal <= 15) {
            display.style.color = 'var(--warning)';
            label.textContent = 'Pedido a caminho';
        } else {
            label.textContent = 'Tempo estimado';
        }
    };

    atualizarDisplay();

    const interval = setInterval(() => {
        minutosTotal = Math.max(0, minutosTotal - 1);
        atualizarDisplay();

        if (minutosTotal <= 0) {
            clearInterval(interval);
            display.textContent = '✓';
            display.style.color = 'var(--success)';
            label.textContent = 'Entregue!';
        }
    }, 60000);

    window._countdownInterval = interval;
}

function renderizarModalRastreamento(pedido) {
    const timelineHtml = gerarTimelineStatus(pedido.status);

    pedidoModalBody.innerHTML = `
        <div class="pedido-rastreamento">
            <div class="rastreamento-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border-subtle);">
                <h4 style="font-family: var(--font-title); font-size: var(--fs-xl);">Pedido #${escapeHtml(pedido.numero_pedido || pedido.numero)}</h4>
                <span class="badge ${getStatusClass(pedido.status)}" style="font-size: 12px; text-transform: capitalize;">
                    ${getStatusLabel(pedido.status)}
                </span>
            </div>

            <div class="rastreamento-timeline" style="margin-bottom: var(--space-6);">
                ${timelineHtml}
            </div>

            <div class="rastreamento-info">
                <h4 style="font-family: var(--font-title); font-size: var(--fs-base); color: var(--accent); margin-bottom: var(--space-3);">Informações da Entrega</h4>
                <p><strong>Endereço: </strong> ${escapeHtml(pedido.logradouro || '')}, ${escapeHtml(pedido.numero_endereco || pedido.numero)}</p>
                ${pedido.complemento ? `<p><strong>Complemento: </strong> ${escapeHtml(pedido.complemento)}</p>` : ''}
                ${pedido.bairro ? `<p><strong>Bairro: </strong> ${escapeHtml(pedido.bairro)}</p>` : ''}
                ${pedido.referencia ? `<p><strong>Referência: </strong> ${escapeHtml(pedido.referencia)}</p>` : ''}
                <p><strong>Telefone: </strong> ${escapeHtml(pedido.cliente_telefone || pedido.telefone)}</p>
                <p><strong>Pagamento: </strong> ${escapeHtml(pedido.forma_pagamento_nome || 'Não informado')}</p>
            </div>
        </div>
    `;

    pedidoModalRastrear.style.display = 'none';
    pedidoModal.classList.remove('hidden');
    pedidoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    pedidoModalClose.focus();
}

function calcularTempoEstimado(status, dataPedido) {
    const agora = new Date();
    const pedidoTime = new Date(dataPedido);
    const diffMinutos = Math.floor((agora - pedidoTime) / 60000);

    // Tempos base por status (em minutos)
    const tempos = {
        'pendente': 15,
        'confirmado': 20,
        'preparando': 30,
        'saiu_entrega': 15,
        'entregue': 0,
        'cancelado': 0
    };

    const tempoTotal = tempos[status] || 0;
    const tempoRestante = Math.max(0, tempoTotal - diffMinutos);

    if (tempoRestante <= 0) return null;

    if (tempoRestante < 60) {
        return `${tempoRestante} min`;
    } else {
        const horas = Math.floor(tempoRestante / 60);
        const mins = tempoRestante % 60;
        return `${horas}h ${mins}min`;
    }
}

function iniciarContagemRegressiva(tempoInicial) {
    const el = document.getElementById('tempoEstimado');
    if (!el) return;

    // Parse inicial
    let minutosTotal = 0;
    if (tempoInicial.includes('h')) {
        const partes = tempoInicial.split('h');
        minutosTotal = parseInt(partes[0]) * 60 + parseInt(partes[1].replace('min', '').trim());
    } else {
        minutosTotal = parseInt(tempoInicial.replace('min', '').trim());
    }

    const interval = setInterval(() => {
        minutosTotal = Math.max(0, minutosTotal - 1);
        const horas = Math.floor(minutosTotal / 60);
        const mins = minutosTotal % 60;

        if (horas > 0) {
            el.textContent = `⏱️ ${horas}h ${mins}min`;
        } else {
            el.textContent = `⏱️ ${mins} min`;
        }

        if (minutosTotal <= 0) {
            clearInterval(interval);
            el.textContent = '⏱️ Chegando...';
            el.style.color = 'var(--success)';
        }
    }, 60000);

    // Guardar para limpar depois
    window._countdownInterval = interval;
}

// ============ SIMULAÇÃO DE TEMPO REAL (WEBSOCKETS) ============
function iniciarSimulacaoTempoReal() {
    // Simular atualizações periódicas para pedidos em andamento
    // Em produção, isso seria substituído por WebSocket real

    websocketSimulation = setInterval(async () => {
        if (!api.isClienteAuthenticated()) return;

        // Verificar apenas pedidos que não estão finalizados
        const pedidosAtivos = pedidos.filter(p =>
            ['pendente', 'confirmado', 'preparando', 'saiu_entrega'].includes(p.status)
        );

        if (pedidosAtivos.length === 0) return;

        // Simular chance de atualização (10% a cada 30 segundos)
        if (Math.random() > 0.9) {
            const pedidoAleatorio = pedidosAtivos[Math.floor(Math.random() * pedidosAtivos.length)];

            try {
                const resposta = await api.getPedidoById(pedidoAleatorio.id);
                if (resposta.status !== pedidoAleatorio.status) {
                    // Status mudou!
                    const index = pedidos.findIndex(p => p.id === pedidoAleatorio.id);
                    if (index >= 0) {
                        pedidos[index] = resposta;
                        renderizarPedidos();

                        // Notificar usuário
                        showToast(`Pedido #${resposta.numero_pedido || resposta.numero}: ${getStatusLabel(resposta.status)}`, 'info', 6000);

                        // Se modal de rastreamento estiver aberto, atualizar
                        if (pedidoAtualRastreando && pedidoAtualRastreando.id === pedidoAleatorio.id) {
                            if (rastreamentoContainer) {
                                renderizarPaginaRastreamento(resposta);
                            } else {
                                renderizarModalRastreamento(resposta);
                            }
                            pedidoAtualRastreando = resposta;
                        }
                    }
                }
            } catch (error) {
                console.debug('Erro na simulação de tempo real:', error);
            }
        }
    }, 30000); // Verificar a cada 30 segundos
}

function iniciarAtualizacaoAutomatica(pedidoId, numeroPedido) {
    // Parar interval anterior se existir
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
    }

    // Atualizar a cada 15 segundos enquanto rastreando
    statusUpdateInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
            carregarRastreamento(pedidoId, numeroPedido);
        }
    }, 15000);
}

function pararAtualizacaoAutomatica() {
    if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
        statusUpdateInterval = null;
    }
}

// ============ RECOMPRAR ============
async function recomprarPedido(pedidoId) {
    showLoading('Adicionando itens ao carrinho...');

    try {
        const pedido = await api.getPedidoById(pedidoId);

        if (!pedido.itens || pedido.itens.length === 0) {
            showToast('Não foi possível recuperar os itens do pedido', 'error');
            return;
        }

        let itensAdicionados = 0;
        for (const item of pedido.itens) {
            // Buscar produto atual para verificar disponibilidade
            const produto = await api.getProdutoById(item.produto_id);
            if (produto && produto.disponivel) {
                cart.addItem(produto, item.personalizacoes || []);
                itensAdicionados++;
            }
        }

        if (itensAdicionados > 0) {
            showToast(`${itensAdicionados} item(s) adicionado(s) ao carrinho!`, 'success');
            atualizarContadorCarrinho();
            fecharModalPedido();
        } else {
            showToast('Nenhum item disponível para recompra', 'warning');
        }
    } catch (error) {
        console.error('Erro ao recomprar:', error);
        showToast('Erro ao adicionar itens ao carrinho', 'error');
    } finally {
        hideLoading();
    }
}

// ============ PAGINAÇÃO ============
function renderizarPaginacao() {
    if (!pagination) return;

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    pagination.innerHTML = '';

    // Botão anterior
    const btnAnterior = document.createElement('button');
    btnAnterior.className = 'pagination-btn';
    btnAnterior.innerHTML = '&#9664;';
    btnAnterior.setAttribute('aria-label', 'Página anterior');
    btnAnterior.disabled = currentPage === 1;
    btnAnterior.addEventListener('click', () => mudarPagina(currentPage - 1));
    pagination.appendChild(btnAnterior);

    // Páginas
    const inicio = Math.max(1, currentPage - 2);
    const fim = Math.min(totalPages, currentPage + 2);

    if (inicio > 1) {
        const btn = document.createElement('button');
        btn.className = 'pagination-btn';
        btn.textContent = '1';
        btn.setAttribute('aria-label', 'Página 1');
        btn.addEventListener('click', () => mudarPagina(1));
        pagination.appendChild(btn);

        if (inicio > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }
    }

    for (let i = inicio; i <= fim; i++) {
        const btn = document.createElement('button');
        btn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.setAttribute('aria-label', `Página ${i}`);
        btn.setAttribute('aria-current', i === currentPage ? 'page' : 'false');
        btn.addEventListener('click', () => mudarPagina(i));
        pagination.appendChild(btn);
    }

    if (fim < totalPages) {
        if (fim < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.className = 'pagination-ellipsis';
            ellipsis.textContent = '...';
            pagination.appendChild(ellipsis);
        }

        const btn = document.createElement('button');
        btn.className = 'pagination-btn';
        btn.textContent = totalPages;
        btn.setAttribute('aria-label', `Página ${totalPages}`);
        btn.addEventListener('click', () => mudarPagina(totalPages));
        pagination.appendChild(btn);
    }

    // Botão próximo
    const btnProximo = document.createElement('button');
    btnProximo.className = 'pagination-btn';
    btnProximo.innerHTML = '&#9654;';
    btnProximo.setAttribute('aria-label', 'Próxima página');
    btnProximo.disabled = currentPage === totalPages;
    btnProximo.addEventListener('click', () => mudarPagina(currentPage + 1));
    pagination.appendChild(btnProximo);

    // Info
    const info = document.createElement('span');
    info.className = 'pagination-info';
    info.textContent = `Página ${currentPage} de ${totalPages}`;
    pagination.insertBefore(info, btnProximo);
}

async function mudarPagina(novaPagina) {
    if (novaPagina < 1 || novaPagina > totalPages) return;
    currentPage = novaPagina;
    await carregarPedidos();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ LIMPEZA AO SAIR ============
window.addEventListener('beforeunload', () => {
    if (statusUpdateInterval) clearInterval(statusUpdateInterval);
    if (websocketSimulation) clearInterval(websocketSimulation);
    if (window._countdownInterval) clearInterval(window._countdownInterval);
});

// ============ EXPORTS ============
export async function initTrackingPage() {
    // Check if client is authenticated
    if (!api.isClienteAuthenticated()) {
        showToast('Você precisa estar logado para ver seus pedidos', 'warning');
        sessionStorage.setItem('redirectAfterLogin', '/inicio/meus-pedidos.html');
        setTimeout(() => window.location.href = '/Cadastro/login.html', 2000);
        return;
    }

    // Get order ID or number from URL
    const urlParams = new URLSearchParams(window.location.search);
    const rastrearId = urlParams.get('rastrear');
    const rastrearNumero = urlParams.get('numero');

    if (rastrearId || rastrearNumero) {
        await rastrearPedidoDireto(rastrearId, rastrearNumero);
    } else {
        // No order specified - show error
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('errorState').classList.remove('hidden');
        document.getElementById('errorMessage').textContent = 'Nenhum pedido especificado para rastreamento.';
    }
}

export async function initTrackingModal() {
    // For backwards compatibility - initializes tracking in modal mode
    await inicializarPagina();
    configurarEventListeners();
    atualizarContadorCarrinho();
    iniciarSimulacaoTempoReal();
}

// ============ EXPORTAR PARA USO GLOBAL ============
window.statusTracker = {
    STATUS_FLOW,
    getStatusLabel,
    getStatusClass,
    gerarTimelineStatus,
    calcularTempoEstimado,
    iniciarAtualizacaoAutomatica,
    pararAtualizacaoAutomatica,
    initTrackingPage,
    initTrackingModal
};