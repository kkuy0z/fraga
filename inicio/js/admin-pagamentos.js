import api from './api.js';
import { showToast, showLoading, hideLoading, escapeHtml } from './utils.js';

// Estado
let pagamentos = [];
let paginaAtual = 1;
const itensPorPagina = 10;
let pagamentoExcluindoId = null;

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

const buscaPagamento = document.getElementById('buscaPagamento');
const filtroAtivoPagamento = document.getElementById('filtroAtivoPagamento');
const tbodyPagamentos = document.getElementById('tbodyPagamentos');
const emptyState = document.getElementById('emptyState');
const pagination = document.getElementById('pagination');
const btnNovaFormaPagamento = document.getElementById('btnNovaFormaPagamento');
const btnPrimeiraFormaPagamento = document.getElementById('btnPrimeiraFormaPagamento');

// Modal Pagamento
const pagamentoModal = document.getElementById('pagamentoModal');
const pagamentoModalClose = document.getElementById('pagamentoModalClose');
const btnCancelarPagamento = document.getElementById('btnCancelarPagamento');
const pagamentoForm = document.getElementById('pagamentoForm');
const pagamentoModalTitulo = document.getElementById('pagamentoModalTitulo');
const pagamentoId = document.getElementById('pagamentoId');
const pagamentoNome = document.getElementById('pagamentoNome');
const pagamentoTipo = document.getElementById('pagamentoTipo');
const pagamentoTaxa = document.getElementById('pagamentoTaxa');
const pagamentoPrazo = document.getElementById('pagamentoPrazo');
const pagamentoOrdem = document.getElementById('pagamentoOrdem');
const pagamentoAtivo = document.getElementById('pagamentoAtivo');
const pagamentoOnline = document.getElementById('pagamentoOnline');
const btnSalvarPagamento = document.getElementById('btnSalvarPagamento');

// Modal Delete
const deletePagamentoModal = document.getElementById('deletePagamentoModal');
const deletePagamentoNome = document.getElementById('deletePagamentoNome');
const btnCancelarDeletePagamento = document.getElementById('btnCancelarDeletePagamento');
const btnConfirmarDeletePagamento = document.getElementById('btnConfirmarDeletePagamento');

// Labels dos tipos
const TIPO_LABELS = {
    'dinheiro': 'Dinheiro',
    'credito': 'Cartão de Crédito',
    'debito': 'Cartão de Débito',
    'pix': 'PIX',
    'boleto': 'Boleto',
    'outro': 'Outro'
};

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
    await carregarPagamentos();
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
            if (!pagamentoModal.classList.contains('hidden')) fecharModalPagamento();
            if (!deletePagamentoModal.classList.contains('hidden')) fecharModalDeletePagamento();
        }
    });

    // Busca e filtros
    let buscaTimeout;
    if (buscaPagamento) {
        buscaPagamento.addEventListener('input', () => {
            clearTimeout(buscaTimeout);
            buscaTimeout = setTimeout(() => {
                paginaAtual = 1;
                carregarPagamentos();
            }, 300);
        });
    }

    if (filtroAtivoPagamento) {
        filtroAtivoPagamento.addEventListener('change', () => {
            paginaAtual = 1;
            carregarPagamentos();
        });
    }

    // Nova forma de pagamento
    if (btnNovaFormaPagamento) btnNovaFormaPagamento.addEventListener('click', () => abrirModalPagamento());
    if (btnPrimeiraFormaPagamento) btnPrimeiraFormaPagamento.addEventListener('click', () => abrirModalPagamento());

    // Modal pagamento
    if (pagamentoModalClose) pagamentoModalClose.addEventListener('click', fecharModalPagamento);
    if (btnCancelarPagamento) btnCancelarPagamento.addEventListener('click', fecharModalPagamento);
    if (pagamentoModal) {
        pagamentoModal.addEventListener('click', (e) => {
            if (e.target === pagamentoModal) fecharModalPagamento();
        });
    }
    if (pagamentoForm) pagamentoForm.addEventListener('submit', handleSalvarPagamento);

    // Modal delete
    if (btnCancelarDeletePagamento) btnCancelarDeletePagamento.addEventListener('click', fecharModalDeletePagamento);
    if (deletePagamentoModal) {
        deletePagamentoModal.addEventListener('click', (e) => {
            if (e.target === deletePagamentoModal) fecharModalDeletePagamento();
        });
    }
    if (btnConfirmarDeletePagamento) btnConfirmarDeletePagamento.addEventListener('click', confirmarExcluirPagamento);
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

async function carregarPagamentos() {
    if (!tbodyPagamentos) return;

    tbodyPagamentos.innerHTML = '<tr><td colspan="7" class="text-center py-4">Carregando...</td></tr>';

    try {
        const params = {
            pagina: paginaAtual,
            limite: itensPorPagina,
            ordem: 'ordem_exibicao',
            direcao: 'ASC'
        };

        if (buscaPagamento && buscaPagamento.value.trim()) {
            params.busca = buscaPagamento.value.trim();
        }

        if (filtroAtivoPagamento && filtroAtivoPagamento.value !== '') {
            params.ativo = filtroAtivoPagamento.value === 'true';
        }

        const response = await api.getFormasPagamento(false); // false = todas, não só ativas
        pagamentos = response.formas_pagamento || response.data || response || [];

        // Filtrar localmente se necessário (a API pode não suportar todos os filtros)
        let filtered = pagamentos;
        if (params.busca) {
            filtered = filtered.filter(p => p.nome.toLowerCase().includes(params.busca.toLowerCase()));
        }
        if (params.ativo !== undefined) {
            filtered = filtered.filter(p => p.ativo === params.ativo);
        }

        // Ordenar
        filtered.sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0));

        // Paginar
        const total = filtered.length;
        const totalPaginas = Math.ceil(total / itensPorPagina);
        const inicio = (paginaAtual - 1) * itensPorPagina;
        const fim = inicio + itensPorPagina;
        const paginaItens = filtered.slice(inicio, fim);

        renderizarPagamentos(paginaItens);
        renderizarPaginacao(totalPaginas);
        toggleEmptyState(paginaItens.length === 0);

    } catch (error) {
        console.error('Erro ao carregar formas de pagamento:', error);
        tbodyPagamentos.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Erro ao carregar formas de pagamento</td></tr>';
        showToast('Erro ao carregar formas de pagamento', 'error');
    }
}

function renderizarPagamentos(lista) {
    if (!tbodyPagamentos) return;

    if (lista.length === 0) {
        tbodyPagamentos.innerHTML = '';
        return;
    }

    tbodyPagamentos.innerHTML = lista.map(p => `
        <tr>
            <td><strong>${escapeHtml(p.nome)}</strong></td>
            <td><span class="badge badge-info">${TIPO_LABELS[p.tipo] || p.tipo}</span></td>
            <td>${(p.taxa_percentual || 0).toFixed(2)}%</td>
            <td>${p.prazo_recebimento || 0} dia(s)</td>
            <td>${p.ordem_exibicao || 0}</td>
            <td><span class="badge ${p.ativo ? 'badge-success' : 'badge-neutral'}">${p.ativo ? 'Ativa' : 'Inativa'}</span></td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline btn-editar-pagamento" data-id="${p.id}" aria-label="Editar ${escapeHtml(p.nome)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-outline btn-excluir-pagamento" data-id="${p.id}" data-nome="${escapeHtml(p.nome)}" style="color: var(--danger); border-color: var(--danger);" aria-label="Excluir ${escapeHtml(p.nome)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Eventos dos botões
    document.querySelectorAll('.btn-editar-pagamento').forEach(btn => {
        btn.addEventListener('click', () => abrirModalPagamento(parseInt(btn.dataset.id)));
    });

    document.querySelectorAll('.btn-excluir-pagamento').forEach(btn => {
        btn.addEventListener('click', () => abrirModalDeletePagamento(parseInt(btn.dataset.id), btn.dataset.nome));
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
            carregarPagamentos();
        });
    });
}

function toggleEmptyState(empty) {
    if (emptyState) {
        emptyState.classList.toggle('hidden', !empty);
    }
    if (tbodyPagamentos) {
        tbodyPagamentos.closest('.table-container').style.display = empty ? 'none' : 'block';
    }
    if (pagination) {
        pagination.style.display = empty ? 'none' : 'flex';
    }
}

function abrirModalPagamento(pagamentoId_ = null) {
    // Reset form
    pagamentoForm.reset();
    pagamentoId.value = '';
    pagamentoTaxa.value = '0';
    pagamentoPrazo.value = '0';
    pagamentoOrdem.value = '0';
    pagamentoAtivo.checked = true;
    pagamentoOnline.checked = false;

    if (pagamentoId_) {
        const pagamento = pagamentos.find(p => p.id === pagamentoId_);
        if (pagamento) {
            pagamentoModalTitulo.textContent = 'Editar Forma de Pagamento';
            pagamentoId.value = pagamento.id;
            pagamentoNome.value = pagamento.nome || '';
            pagamentoTipo.value = pagamento.tipo || '';
            pagamentoTaxa.value = pagamento.taxa_percentual || 0;
            pagamentoPrazo.value = pagamento.prazo_recebimento || 0;
            pagamentoOrdem.value = pagamento.ordem_exibicao || 0;
            pagamentoAtivo.checked = pagamento.ativo || false;
            pagamentoOnline.checked = pagamento.online || false;
        }
    } else {
        pagamentoModalTitulo.textContent = 'Nova Forma de Pagamento';
    }

    pagamentoModal.classList.remove('hidden');
    pagamentoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    pagamentoNome.focus();
}

function fecharModalPagamento() {
    pagamentoModal.classList.add('hidden');
    pagamentoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

async function handleSalvarPagamento(e) {
    e.preventDefault();

    const btnSubmit = btnSalvarPagamento;
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg> Salvando...';

    try {
        const data = {
            nome: pagamentoNome.value.trim(),
            tipo: pagamentoTipo.value,
            taxa_percentual: parseFloat(pagamentoTaxa.value) || 0,
            prazo_recebimento: parseInt(pagamentoPrazo.value) || 0,
            ordem_exibicao: parseInt(pagamentoOrdem.value) || 0,
            ativo: pagamentoAtivo.checked,
            online: pagamentoOnline.checked
        };

        if (pagamentoId.value) {
            await api.updateFormaPagamento(pagamentoId.value, data);
            showToast('Forma de pagamento atualizada com sucesso!', 'success');
        } else {
            await api.createFormaPagamento(data);
            showToast('Forma de pagamento criada com sucesso!', 'success');
        }

        fecharModalPagamento();
        await carregarPagamentos();

    } catch (error) {
        console.error('Erro ao salvar forma de pagamento:', error);
        showToast(error.message || 'Erro ao salvar forma de pagamento', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

function abrirModalDeletePagamento(id, nome) {
    pagamentoExcluindoId = id;
    deletePagamentoNome.textContent = nome;
    deletePagamentoModal.classList.remove('hidden');
    deletePagamentoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    btnCancelarDeletePagamento.focus();
}

function fecharModalDeletePagamento() {
    deletePagamentoModal.classList.add('hidden');
    deletePagamentoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    pagamentoExcluindoId = null;
}

async function confirmarExcluirPagamento() {
    if (!pagamentoExcluindoId) return;

    try {
        await api.deleteFormaPagamento(pagamentoExcluindoId);
        showToast('Forma de pagamento excluída com sucesso!', 'success');
        fecharModalDeletePagamento();
        await carregarPagamentos();
    } catch (error) {
        console.error('Erro ao excluir forma de pagamento:', error);
        showToast(error.message || 'Erro ao excluir forma de pagamento', 'error');
    }
}

function handleLogout() {
    api.clearAuth();
    showToast('Logout realizado com sucesso', 'success');
    setTimeout(() => window.location.href = '/inicio/admin-login.html', 1000);
}