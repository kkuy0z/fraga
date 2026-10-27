import api from './api.js';
import cart from './cart.js';
import { formatCurrency, showToast, showLoading, hideLoading, formatDateTime, getStatusLabel, getStatusClass, escapeHtml } from './utils.js';

// Estado da página
let pedidos = [];
let currentPage = 1;
const pageSize = 10;
let totalPages = 1;
let currentFilters = {};

// Elementos DOM
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

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarPagina();
    configurarEventListeners();
    atualizarContadorCarrinho();
    verificarAuth();
});

async function inicializarPagina() {
    // Verificar se cliente está autenticado
    if (!api.isClienteAuthenticated()) {
        showToast('Você precisa estar logado para ver seus pedidos', 'warning');
        setTimeout(() => window.location.href = '/inicio/index.html', 2000);
        return;
    }

    await carregarPedidos();
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

async function verificarAuth() {
    const clienteUser = api.getClienteUser();
    const userButton = document.getElementById('userButton');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const adminLink = document.getElementById('adminLink');

    if (clienteUser) {
        if (userButton) userButton.style.display = 'flex';
        if (userName) userName.textContent = clienteUser.nome;
        if (userAvatar) userAvatar.textContent = clienteUser.nome.charAt(0).toUpperCase();
        if (adminLink) adminLink.style.display = 'none';
    }
}

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
        <tr>
            <td><strong>#${escapeHtml(pedido.numero_pedido || pedido.numero)}</strong></td>
            <td>${formatDateTime(pedido.data_pedido || pedido.criado_em)}</td>
                <td>
                    <span class="badge ${getStatusClass(pedido.status)}" style="font-size: 12px; text-transform: capitalize;">
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
                                <circle cx="12" cy="12" r="3"></path>
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

    // Eventos dos botões
    document.querySelectorAll('.btn-ver').forEach(btn => {
        btn.addEventListener('click', () => abrirModalPedido(parseInt(btn.dataset.id), btn.dataset.numero));
    });

    document.querySelectorAll('.btn-rastrear').forEach(btn => {
        btn.addEventListener('click', () => rastrearPedido(parseInt(btn.dataset.id), btn.dataset.numero));
    });

    document.querySelectorAll('.btn-recomprar').forEach(btn => {
        btn.addEventListener('click', () => recomprarPedido(parseInt(btn.dataset.id)));
    });
}

async function abrirModalPedido(pedidoId, numeroPedido) {
    showLoading('Carregando detalhes...');

    try {
        const pedido = await api.getPedidoById(pedidoId);

        // Calcular troco se pagamento em dinheiro
        let trocoHtml = '';
        if (pedido.forma_pagamento_tipo === 'dinheiro' && pedido.valor_troco > 0) {
            const troco = (pedido.valor_troco - pedido.valor_total).toFixed(2);
            trocoHtml = `
                <div class="pedido-troco">
                    <strong>Troco para: </strong> ${formatCurrency(pedido.valor_troco)} <br>
                    <strong>Troco: </strong> ${formatCurrency(troco)}
                </div>
            `;
        }

        // Itens
        let itensHtml = '';
        if (pedido.itens && pedido.itens.length > 0) {
            itensHtml = pedido.itens.map(item => `
                <div class="pedido-item-detalhe">
                    <div class="pedido-item-info">
                        <strong>${escapeHtml(item.produto_nome || item.nome)}</strong>
                        ${item.personalizacoes && item.personalizacoes.length > 0 ? `
                            <div class="pedido-item-personalizacoes">
                                ${item.personalizacoes.map(p => `
                                    <span class="badge badge-neutral" style="font-size: 11px;">
                                        ${escapeHtml(p.grupo_nome || p.grupo)}: ${escapeHtml(p.opcao_nome || p.opcao)} ${p.preco_adicional > 0 ? `(+ ${formatCurrency(p.preco_adicional)})` : ''}
                                    </span>
                                `).join(' ')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="pedido-item-quantidade">
                        ${item.quantidade}x ${formatCurrency(item.preco_base || item.preco)}
                        ${item.subtotal ? ` = ${formatCurrency(item.subtotal)}` : ''}
                    </div>
                </div>
            `).join('');
        }

        pedidoModalBody.innerHTML = `
            <div class="pedido-detalhe">
                <div class="pedido-header-detalhe">
                    <div>
                        <strong>Pedido #${escapeHtml(pedido.numero_pedido || pedido.numero || pedidoId)}</strong>
                        <span class="badge ${getStatusClass(pedido.status)} ml-2" style="font-size: 12px; text-transform: capitalize;">
                            ${getStatusLabel(pedido.status)}
                        </span>
                    </div>
                    <div class="pedido-data">
                        ${formatDateTime(pedido.data_pedido || pedido.criado_em)}
                    </div>
                </div>

                <div class="pedido-section">
                    <h4>Entrega</h4>
                    <p><strong>${escapeHtml(pedido.cliente_nome || pedido.nome)}</strong></p>
                    <p>${escapeHtml(pedido.cliente_telefone || pedido.telefone)}</p>
                    <p>${escapeHtml(pedido.logradouro || '')}, ${escapeHtml(pedido.numero_endereco || pedido.numero)}</p>
                    ${pedido.complemento ? `<p>Complemento: ${escapeHtml(pedido.complemento)}</p>` : ''}
                    ${pedido.bairro ? `<p>Bairro: ${escapeHtml(pedido.bairro)}</p>` : ''}
                    ${pedido.cep ? `<p>CEP: ${escapeHtml(pedido.cep)}</p>` : ''}
                    ${pedido.referencia ? `<p>Referência: ${escapeHtml(pedido.referencia)}</p>` : ''}
                </div>

                <div class="pedido-section">
                    <h4>Pagamento</h4>
                    <p><strong>Forma: </strong> ${escapeHtml(pedido.forma_pagamento_nome || pedido.forma_pagamento || 'Não informado')}</p>
                    ${trocoHtml}
                    ${pedido.observacoes_pagamento ? `<p><strong>Obs: </strong> ${escapeHtml(pedido.observacoes_pagamento)}</p>` : ''}
                </div>

                <div class="pedido-section">
                    <h4>Itens do Pedido</h4>
                    ${itensHtml}
                </div>

                <div class="pedido-totais">
                    <div class="d-flex justify-between">
                        <span>Subtotal</span>
                        <span>${formatCurrency(pedido.subtotal_produtos || pedido.subtotal)}</span>
                    </div>
                    ${pedido.taxa_entrega > 0 ? `
                        <div class="d-flex justify-between">
                            <span>Taxa de Entrega</span>
                            <span>${formatCurrency(pedido.taxa_entrega)}</span>
                        </div>
                    ` : ''}
                    ${pedido.taxa_bairro > 0 ? `
                        <div class="d-flex justify-between">
                            <span>Taxa Extra (Bairro)</span>
                            <span>${formatCurrency(pedido.taxa_bairro)}</span>
                        </div>
                    ` : ''}
                    ${pedido.desconto > 0 ? `
                        <div class="d-flex justify-between text-success">
                            <span>Desconto</span>
                            <span>- ${formatCurrency(pedido.desconto)}</span>
                        </div>
                    ` : ''}
                    <div class="d-flex justify-between pedido-total">
                        <strong>Total</strong>
                        <strong>${formatCurrency(pedido.valor_total || pedido.total)}</strong>
                    </div>
                </div>
            </div>
        `;

        // Mostrar/ocultar botão rastrear baseado no status
        if (['pendente', 'confirmado', 'preparando', 'saiu_entrega'].includes(pedido.status)) {
            pedidoModalRastrear.style.display = 'inline-flex';
            pedidoModalRastrear.onclick = () => rastrearPedido(pedidoId, pedido.numero_pedido || pedido.numero);
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

async function rastrearPedido(pedidoId, numeroPedido) {
    fecharModalPedido();
    showLoading('Carregando rastreamento...');

    try {
        const pedido = await api.getPedidoByNumero(numeroPedido);

        // Criar timeline de status
        const statusOrder = ['pendente', 'confirmado', 'preparando', 'saiu_entrega', 'entregue'];
        const currentIndex = statusOrder.indexOf(pedido.status);

        let timelineHtml = statusOrder.map((status, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isFuture = index > currentIndex;

            let className = 'timeline-step';
            if (isCompleted) className += ' completed';
            else if (isCurrent) className += ' current';
            else className += ' pending';

            return `
                <div class="${className}">
                    <div class="timeline-marker" aria-hidden="true"></div>
                    <div class="timeline-content">
                        <strong>${getStatusLabel(status)}</strong>
                        ${isCurrent ? '<span class="badge badge-primary" style="font-size: 10px; margin-left: 8px;">Atual</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');

        pedidoModalBody.innerHTML = `
            <div class="pedido-rastreamento">
                <div class="rastreamento-header">
                    <h4>Pedido #${escapeHtml(numeroPedido)}</h4>
                    <span class="badge ${getStatusClass(pedido.status)}" style="font-size: 12px; text-transform: capitalize;">
                        ${getStatusLabel(pedido.status)}
                    </span>
                </div>

                <div class="rastreamento-timeline">
                    ${timelineHtml}
                </div>

                <div class="rastreamento-info">
                    <h4>Informações da Entrega</h4>
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

    } catch (error) {
        console.error('Erro ao rastrear pedido:', error);
        showToast('Erro ao carregar rastreamento', 'error');
    } finally {
        hideLoading();
    }
}

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

function handleLogout() {
    api.clearClienteAuth();
    showToast('Logout realizado com sucesso', 'success');
    setTimeout(() => window.location.href = '/inicio/index.html', 1000);
}