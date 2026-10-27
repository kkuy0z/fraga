import api from './api.js';
import { showToast, showLoading, hideLoading, formatCurrency, formatDateTime, getStatusLabel, getStatusClass, escapeHtml } from './utils.js';

// Estado
let pedidos = [];
let formasPagamento = [];
let paginaAtual = 1;
const itensPorPagina = 15;
let pedidoVisualizandoId = null;
let pedidoAlterandoStatusId = null;

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

const buscaPedido = document.getElementById('buscaPedido');
const filtroStatus = document.getElementById('filtroStatus');
const filtroPagamento = document.getElementById('filtroPagamento');
const dataInicio = document.getElementById('dataInicio');
const dataFim = document.getElementById('dataFim');
const btnLimparFiltros = document.getElementById('btnLimparFiltros');
const tbodyPedidos = document.getElementById('tbodyPedidos');
const emptyState = document.getElementById('emptyState');
const pagination = document.getElementById('pagination');

// Modal Detalhes
const pedidoModal = document.getElementById('pedidoModal');
const pedidoModalClose = document.getElementById('pedidoModalClose');
const pedidoModalFechar = document.getElementById('pedidoModalFechar');
const pedidoModalTitulo = document.getElementById('pedidoModalTitulo');
const pedidoModalBody = document.getElementById('pedidoModalBody');

// Modal Status
const statusModal = document.getElementById('statusModal');
const statusModalTitulo = document.getElementById('statusModalTitulo');
const statusForm = document.getElementById('statusForm');
const statusPedidoId = document.getElementById('statusPedidoId');
const novoStatus = document.getElementById('novoStatus');
const motivoCancelamentoGroup = document.getElementById('motivoCancelamentoGroup');
const motivoCancelamento = document.getElementById('motivoCancelamento');
const btnCancelarStatus = document.getElementById('btnCancelarStatus');
const btnConfirmarStatus = document.getElementById('btnConfirmarStatus');

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

    try {
        await api.adminVerify();
    } catch (error) {
        api.clearAuth();
        window.location.href = '/inicio/admin-login.html';
        return;
    }

    atualizarUserUI(user);

    // Carregar formas de pagamento para o filtro
    await carregarFormasPagamento();

    // Carregar pedidos
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

    // Fechar modais/dropdowns com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (userDropdown) userDropdown.classList.remove('show');
            if (adminNav) adminNav.classList.remove('show');
            if (userButton) userButton.setAttribute('aria-expanded', 'false');
            if (adminNavToggle) adminNavToggle.setAttribute('aria-expanded', 'false');
            if (!pedidoModal.classList.contains('hidden')) fecharModalPedido();
            if (!statusModal.classList.contains('hidden')) fecharModalStatus();
        }
    });

    // Busca e filtros
    let buscaTimeout;
    if (buscaPedido) {
        buscaPedido.addEventListener('input', () => {
            clearTimeout(buscaTimeout);
            buscaTimeout = setTimeout(() => {
                paginaAtual = 1;
                carregarPedidos();
            }, 300);
        });
    }

    [filtroStatus, filtroPagamento, dataInicio, dataFim].forEach(el => {
        if (el) el.addEventListener('change', () => {
            paginaAtual = 1;
            carregarPedidos();
        });
    });

    if (btnLimparFiltros) {
        btnLimparFiltros.addEventListener('click', () => {
            if (buscaPedido) buscaPedido.value = '';
            if (filtroStatus) filtroStatus.value = '';
            if (filtroPagamento) filtroPagamento.value = '';
            if (dataInicio) dataInicio.value = '';
            if (dataFim) dataFim.value = '';
            paginaAtual = 1;
            carregarPedidos();
        });
    }

    // Modal detalhes
    if (pedidoModalClose) pedidoModalClose.addEventListener('click', fecharModalPedido);
    if (pedidoModalFechar) pedidoModalFechar.addEventListener('click', fecharModalPedido);
    if (pedidoModal) {
        pedidoModal.addEventListener('click', (e) => {
            if (e.target === pedidoModal) fecharModalPedido();
        });
    }

    // Modal status
    if (btnCancelarStatus) btnCancelarStatus.addEventListener('click', fecharModalStatus);
    if (statusModal) {
        statusModal.addEventListener('click', (e) => {
            if (e.target === statusModal) fecharModalStatus();
        });
    }
    if (statusForm) statusForm.addEventListener('submit', handleAlterarStatus);
    if (novoStatus) {
        novoStatus.addEventListener('change', () => {
            motivoCancelamentoGroup.style.display = novoStatus.value === 'cancelado' ? 'block' : 'none';
            motivoCancelamento.required = novoStatus.value === 'cancelado';
        });
    }
    if (btnConfirmarStatus) btnConfirmarStatus.addEventListener('click', () => statusForm.dispatchEvent(new Event('submit')));
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

async function carregarFormasPagamento() {
    try {
        const response = await api.getFormasPagamento(false); // todas, não só ativas
        formasPagamento = response.formas_pagamento || response.data || response || [];

        if (filtroPagamento) {
            const currentValue = filtroPagamento.value;
            filtroPagamento.innerHTML = '<option value="">Todas as formas</option>';
            formasPagamento.forEach(fp => {
                const option = document.createElement('option');
                option.value = fp.id;
                option.textContent = fp.nome;
                filtroPagamento.appendChild(option);
            });
            if (currentValue) filtroPagamento.value = currentValue;
        }
    } catch (error) {
        console.error('Erro ao carregar formas de pagamento:', error);
    }
}

async function carregarPedidos() {
    if (!tbodyPedidos) return;

    tbodyPedidos.innerHTML = '<tr><td colspan="8" class="text-center py-4">Carregando...</td></tr>';

    try {
        const params = {
            pagina: paginaAtual,
            limite: itensPorPagina,
            ordem: 'data_criacao',
            direcao: 'DESC'
        };

        if (buscaPedido && buscaPedido.value.trim()) {
            params.busca = buscaPedido.value.trim();
        }

        if (filtroStatus && filtroStatus.value) {
            params.status = filtroStatus.value;
        }

        if (filtroPagamento && filtroPagamento.value) {
            params.forma_pagamento_id = filtroPagamento.value;
        }

        if (dataInicio && dataInicio.value) {
            params.data_inicio = dataInicio.value;
        }

        if (dataFim && dataFim.value) {
            params.data_fim = dataFim.value;
        }

        const response = await api.getPedidosAdmin(params);

        pedidos = response.pedidos || response.data || response || [];
        const total = response.total || pedidos.length;
        const totalPaginas = Math.ceil(total / itensPorPagina);

        renderizarPedidos();
        renderizarPaginacao(totalPaginas);
        toggleEmptyState(pedidos.length === 0);

    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        tbodyPedidos.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">Erro ao carregar pedidos</td></tr>';
        showToast('Erro ao carregar pedidos', 'error');
    }
}

function renderizarPedidos() {
    if (!tbodyPedidos) return;

    if (pedidos.length === 0) {
        tbodyPedidos.innerHTML = '';
        return;
    }

    tbodyPedidos.innerHTML = pedidos.map(pedido => `
        <tr>
            <td><strong>#${escapeHtml(pedido.numero_pedido)}</strong></td>
            <td>
                ${escapeHtml(pedido.cliente_nome || '—')}
                ${pedido.cliente_telefone ? `<br><small style="color: var(--text-muted);">${escapeHtml(pedido.cliente_telefone)}</small>` : ''}
            </td>
            <td>${formatDateTime(pedido.data_criacao)}</td>
            <td><span class="badge ${pedido.tipo_entrega === 'entrega' ? 'badge-info' : 'badge-neutral'}">${pedido.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'}</span></td>
            <td><span class="badge ${getStatusClass(pedido.status)}">${getStatusLabel(pedido.status)}</span></td>
            <td>${escapeHtml(pedido.forma_pagamento_nome || '—')}</td>
            <td><strong>${formatCurrency(pedido.total)}</strong></td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline btn-ver-pedido" data-id="${pedido.id}" aria-label="Ver detalhes do pedido #${escapeHtml(pedido.numero_pedido)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-outline btn-alterar-status" data-id="${pedido.id}" data-status="${pedido.status}" data-numero="${escapeHtml(pedido.numero_pedido)}" aria-label="Alterar status do pedido #${escapeHtml(pedido.numero_pedido)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Eventos dos botões
    document.querySelectorAll('.btn-ver-pedido').forEach(btn => {
        btn.addEventListener('click', () => abrirModalPedido(parseInt(btn.dataset.id)));
    });

    document.querySelectorAll('.btn-alterar-status').forEach(btn => {
        btn.addEventListener('click', () => abrirModalStatus(parseInt(btn.dataset.id), btn.dataset.status, btn.dataset.numero));
    });
}

function renderizarPaginacao(totalPaginas) {
    if (!pagination) return;

    if (totalPaginas <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';

    let html = '';

    if (paginaAtual > 1) {
        html += `<button class="pagination-btn" data-page="1" aria-label="Primeira página"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline><polyline points="15 18 9 12 15 6"></polyline></svg></button>`;
        html += `<button class="pagination-btn" data-page="${paginaAtual - 1}" aria-label="Página anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg></button>`;
    }

    let inicio = Math.max(1, paginaAtual - 2);
    let fim = Math.min(totalPaginas, paginaAtual + 2);

    if (inicio > 1) {
        html += `<span class="pagination-ellipsis">…</span>`;
    }

    for (let i = inicio; i <= fim; i++) {
        html += `<button class="pagination-btn ${i === paginaAtual ? 'active' : ''}" data-page="${i}" ${i === paginaAtual ? 'aria-current="page"' : ''}>${i}</button>`;
    }

    if (fim < totalPaginas) {
        html += `<span class="pagination-ellipsis">…</span>`;
    }

    if (paginaAtual < totalPaginas) {
        html += `<button class="pagination-btn" data-page="${paginaAtual + 1}" aria-label="Próxima página"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></button>`;
        html += `<button class="pagination-btn" data-page="${totalPaginas}" aria-label="Última página"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline><polyline points="9 18 15 12 9 6"></polyline></svg></button>`;
    }

    html += `<span class="pagination-info">Página ${paginaAtual} de ${totalPaginas}</span>`;

    pagination.innerHTML = html;

    pagination.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            paginaAtual = parseInt(btn.dataset.page);
            carregarPedidos();
        });
    });
}

function toggleEmptyState(empty) {
    if (emptyState) {
        emptyState.classList.toggle('hidden', !empty);
    }
    if (tbodyPedidos) {
        tbodyPedidos.closest('.table-container').style.display = empty ? 'none' : 'block';
    }
    if (pagination) {
        pagination.style.display = empty ? 'none' : 'flex';
    }
}

async function abrirModalPedido(pedidoId) {
    pedidoVisualizandoId = pedidoId;
    pedidoModalTitulo.textContent = 'Carregando pedido...';
    pedidoModalBody.innerHTML = '<div class="text-center py-4"><div class="loading-spinner" style="margin: 0 auto;"></div></div>';

    pedidoModal.classList.remove('hidden');
    pedidoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    try {
        const response = await api.getPedidoById(pedidoId);
        const pedido = response.pedido || response;
        renderizarDetalhesPedido(pedido);
    } catch (error) {
        console.error('Erro ao carregar detalhes do pedido:', error);
        pedidoModalBody.innerHTML = '<div class="text-center py-4 text-danger">Erro ao carregar detalhes do pedido</div>';
        showToast('Erro ao carregar detalhes do pedido', 'error');
    }
}

function renderizarDetalhesPedido(pedido) {
    pedidoModalTitulo.textContent = `Pedido #${escapeHtml(pedido.numero_pedido)}`;

    const statusAtual = pedido.status;
    const podeAlterarStatus = ['pendente', 'confirmado', 'preparando', 'saiu_entrega'].includes(statusAtual);

    let html = `
        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px;">
            <div class="card">
                <h4 class="card-title" style="margin-bottom: 12px; font-size: 14px;">Informações do Pedido</h4>
                <dl style="display: grid; gap: 8px; font-size: 14px;">
                    <div class="d-flex justify-between"><dt>Número</dt><dd><strong>#${escapeHtml(pedido.numero_pedido)}</strong></dd></div>
                    <div class="d-flex justify-between"><dt>Data/Hora</dt><dd>${formatDateTime(pedido.data_criacao)}</dd></div>
                    <div class="d-flex justify-between"><dt>Tipo</dt><dd><span class="badge ${pedido.tipo_entrega === 'entrega' ? 'badge-info' : 'badge-neutral'}">${pedido.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'}</span></dd></div>
                    <div class="d-flex justify-between"><dt>Status</dt><dd><span class="badge ${getStatusClass(statusAtual)}">${getStatusLabel(statusAtual)}</span></dd></div>
                    <div class="d-flex justify-between"><dt>Pagamento</dt><dd>${escapeHtml(pedido.forma_pagamento_nome || '—')}</dd></div>
                    <div class="d-flex justify-between"><dt>Total</dt><dd><strong>${formatCurrency(pedido.total)}</strong></dd></div>
                </dl>
            </div>

            <div class="card">
                <h4 class="card-title" style="margin-bottom: 12px; font-size: 14px;">Cliente</h4>
                <dl style="display: grid; gap: 8px; font-size: 14px;">
                    <div class="d-flex justify-between"><dt>Nome</dt><dd>${escapeHtml(pedido.cliente_nome || '—')}</dd></div>
                    ${pedido.cliente_telefone ? `<div class="d-flex justify-between"><dt>Telefone</dt><dd>${escapeHtml(pedido.cliente_telefone)}</dd></div>` : ''}
                    ${pedido.cliente_email ? `<div class="d-flex justify-between"><dt>E-mail</dt><dd>${escapeHtml(pedido.cliente_email)}</dd></div>` : ''}
                </dl>
            </div>

            ${pedido.tipo_entrega === 'entrega' && pedido.endereco_entrega ? `
            <div class="card">
                <h4 class="card-title" style="margin-bottom: 12px; font-size: 14px;">Endereço de Entrega</h4>
                <p style="font-size: 14px; color: var(--text-muted);">${escapeHtml(pedido.endereco_entrega.logradouro || '')}, ${escapeHtml(pedido.endereco_entrega.numero || '')}${pedido.endereco_entrega.complemento ? ' - ' + escapeHtml(pedido.endereco_entrega.complemento) : ''}<br>${escapeHtml(pedido.endereco_entrega.bairro || '')}<br>CEP: ${escapeHtml(pedido.endereco_entrega.cep || '')}</p>
            </div>
            ` : ''}

            <div class="card">
                <h4 class="card-title" style="margin-bottom: 12px; font-size: 14px;">Totais</h4>
                <dl style="display: grid; gap: 8px; font-size: 14px;">
                    <div class="d-flex justify-between"><dt>Subtotal</dt><dd>${formatCurrency(pedido.subtotal || 0)}</dd></div>
                    ${pedido.taxa_entrega > 0 ? `<div class="d-flex justify-between"><dt>Taxa de Entrega</dt><dd>${formatCurrency(pedido.taxa_entrega)}</dd></div>` : ''}
                    ${pedido.taxa_bairro > 0 ? `<div class="d-flex justify-between"><dt>Taxa do Bairro</dt><dd>${formatCurrency(pedido.taxa_bairro)}</dd></div>` : ''}
                    ${pedido.desconto > 0 ? `<div class="d-flex justify-between" style="color: var(--success);"><dt>Desconto</dt><dd>-${formatCurrency(pedido.desconto)}</dd></div>` : ''}
                    <div class="d-flex justify-between" style="border-top: 1px solid var(--border); padding-top: 8px; font-weight: 600;"><dt>Total</dt><dd>${formatCurrency(pedido.total)}</dd></div>
                </dl>
            </div>
        </div>
    `;

    // Itens do pedido
    if (pedido.itens && pedido.itens.length > 0) {
        html += `
            <div class="card">
                <h4 class="card-title" style="margin-bottom: 16px;">Itens do Pedido</h4>
                <div class="table-container" style="overflow-x: auto;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Produto</th>
                                <th>Qtd</th>
                                <th>Preço Unit.</th>
                                <th>Personalizações</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pedido.itens.map(item => `
                                <tr>
                                    <td><strong>${escapeHtml(item.produto_nome)}</strong></td>
                                    <td>${item.quantidade}</td>
                                    <td>${formatCurrency(item.preco_unitario)}</td>
                                    <td>
                                        ${item.personalizacoes && item.personalizacoes.length > 0 ?
                                            item.personalizacoes.map(p => `<span class="badge badge-neutral" style="font-size: 11px; margin-right: 4px;">${escapeHtml(p.grupo_nome)}: ${escapeHtml(p.opcao_nome)}${p.preco_adicional > 0 ? ` (+${formatCurrency(p.preco_adicional)})` : ''}</span>`).join('') :
                                            '<span style="color: var(--text-muted);">—</span>'
                                        }
                                    </td>
                                    <td>${formatCurrency(item.subtotal)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // Observações
    if (pedido.observacoes) {
        html += `
            <div class="card">
                <h4 class="card-title" style="margin-bottom: 12px; font-size: 14px;">Observações</h4>
                <p style="color: var(--text-muted); white-space: pre-wrap;">${escapeHtml(pedido.observacoes)}</p>
            </div>
        `;
    }

    // Histórico de status (se houver)
    if (pedido.historico_status && pedido.historico_status.length > 0) {
        html += `
            <div class="card">
                <h4 class="card-title" style="margin-bottom: 16px;">Histórico de Status</h4>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    ${pedido.historico_status.map(h => `
                        <div class="d-flex justify-between align-center" style="padding: 8px 12px; background: var(--bg-secondary); border-radius: 8px; font-size: 14px;">
                            <span>${formatDateTime(h.data_alteracao)}</span>
                            <span class="d-flex align-center gap-2">
                                <span class="badge ${getStatusClass(h.status_anterior)}">${getStatusLabel(h.status_anterior)}</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="color: var(--text-muted);"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                <span class="badge ${getStatusClass(h.status_novo)}">${getStatusLabel(h.status_novo)}</span>
                                ${h.usuario_nome ? `<span style="color: var(--text-muted);">por ${escapeHtml(h.usuario_nome)}</span>` : ''}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    pedidoModalBody.innerHTML = html;
}

function fecharModalPedido() {
    pedidoModal.classList.add('hidden');
    pedidoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    pedidoVisualizandoId = null;
}

function abrirModalStatus(pedidoId, statusAtual, numeroPedido) {
    pedidoAlterandoStatusId = pedidoId;
    statusPedidoId.value = pedidoId;
    statusModalTitulo.textContent = `Alterar Status - Pedido #${numeroPedido}`;

    // Definir status atual como selecionado
    novoStatus.value = statusAtual;

    // Mostrar/ocultar motivo de cancelamento
    motivoCancelamentoGroup.style.display = statusAtual === 'cancelado' ? 'block' : 'none';
    motivoCancelamento.required = statusAtual === 'cancelado';

    // Desabilitar opções que não são transições válidas
    const transicoesValidas = {
        'pendente': ['confirmado', 'cancelado'],
        'confirmado': ['preparando', 'cancelado'],
        'preparando': ['saiu_entrega', 'cancelado'],
        'saiu_entrega': ['entregue', 'cancelado'],
        'entregue': [],
        'cancelado': []
    };

    const validos = transicoesValidas[statusAtual] || [];

    Array.from(novoStatus.options).forEach(option => {
        if (option.value && !validos.includes(option.value) && option.value !== statusAtual) {
            option.disabled = true;
            option.textContent += ' (inválido)';
        } else {
            option.disabled = false;
        }
    });

    novoStatus.value = '';

    statusModal.classList.remove('hidden');
    statusModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    novoStatus.focus();
}

function fecharModalStatus() {
    statusModal.classList.add('hidden');
    statusModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    pedidoAlterandoStatusId = null;
    statusForm.reset();
}

async function handleAlterarStatus(e) {
    e.preventDefault();

    if (!pedidoAlterandoStatusId) return;

    const status = novoStatus.value;
    const motivo = motivoCancelamento.value.trim();

    if (!status) {
        showToast('Selecione um status', 'warning');
        return;
    }

    if (status === 'cancelado' && !motivo) {
        showToast('Informe o motivo do cancelamento', 'warning');
        motivoCancelamento.focus();
        return;
    }

    const btnSubmit = btnConfirmarStatus;
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg> Alterando...';

    try {
        const data = { status };
        if (status === 'cancelado') {
            data.motivo_cancelamento = motivo;
        }

        await api.updatePedidoStatus(pedidoAlterandoStatusId, status, motivo);
        showToast('Status alterado com sucesso!', 'success');

        fecharModalStatus();
        await carregarPedidos();

        // Se modal de detalhes estiver aberto, atualizar
        if (pedidoVisualizandoId === pedidoAlterandoStatusId) {
            const response = await api.getPedidoById(pedidoVisualizandoId);
            const pedido = response.pedido || response;
            renderizarDetalhesPedido(pedido);
        }

    } catch (error) {
        console.error('Erro ao alterar status:', error);
        showToast(error.message || 'Erro ao alterar status', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

function handleLogout() {
    api.clearAuth();
    showToast('Logout realizado com sucesso', 'success');
    setTimeout(() => window.location.href = '/inicio/admin-login.html', 1000);
}