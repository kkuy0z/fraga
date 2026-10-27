import api from './api.js';
import { showToast, showLoading, hideLoading, formatCurrency, escapeHtml } from './utils.js';

// Estado
let bairros = [];
let bairroExcluindoId = null;

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

// Form config entrega
const formConfigEntrega = document.getElementById('formConfigEntrega');
const taxaEntrega = document.getElementById('taxaEntrega');
const valorMinimoEntrega = document.getElementById('valorMinimoEntrega');
const tempoMedioEntrega = document.getElementById('tempoMedioEntrega');
const btnSalvarConfigEntrega = document.getElementById('btnSalvarConfigEntrega');

// Bairros
const tbodyBairros = document.getElementById('tbodyBairros');
const emptyStateBairros = document.getElementById('emptyStateBairros');
const btnNovoBairro = document.getElementById('btnNovoBairro');

// Modal Bairro
const bairroModal = document.getElementById('bairroModal');
const bairroModalClose = document.getElementById('bairroModalClose');
const btnCancelarBairro = document.getElementById('btnCancelarBairro');
const bairroForm = document.getElementById('bairroForm');
const bairroModalTitulo = document.getElementById('bairroModalTitulo');
const bairroId = document.getElementById('bairroId');
const bairroNome = document.getElementById('bairroNome');
const bairroTaxaExtra = document.getElementById('bairroTaxaExtra');
const bairroAtivo = document.getElementById('bairroAtivo');
const btnSalvarBairro = document.getElementById('btnSalvarBairro');

// Modal Delete
const deleteBairroModal = document.getElementById('deleteBairroModal');
const deleteBairroNome = document.getElementById('deleteBairroNome');
const btnCancelarDeleteBairro = document.getElementById('btnCancelarDeleteBairro');
const btnConfirmarDeleteBairro = document.getElementById('btnConfirmarDeleteBairro');

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
    await Promise.all([
        carregarConfigEntrega(),
        carregarBairros()
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

    // Fechar modais/dropdowns com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (userDropdown) userDropdown.classList.remove('show');
            if (adminNav) adminNav.classList.remove('show');
            if (userButton) userButton.setAttribute('aria-expanded', 'false');
            if (adminNavToggle) adminNavToggle.setAttribute('aria-expanded', 'false');
            if (!bairroModal.classList.contains('hidden')) fecharModalBairro();
            if (!deleteBairroModal.classList.contains('hidden')) fecharModalDeleteBairro();
        }
    });

    // Form config entrega
    if (formConfigEntrega) formConfigEntrega.addEventListener('submit', handleSalvarConfigEntrega);

    // Novo bairro
    if (btnNovoBairro) btnNovoBairro.addEventListener('click', () => abrirModalBairro());

    // Modal bairro
    if (bairroModalClose) bairroModalClose.addEventListener('click', fecharModalBairro);
    if (btnCancelarBairro) btnCancelarBairro.addEventListener('click', fecharModalBairro);
    if (bairroModal) {
        bairroModal.addEventListener('click', (e) => {
            if (e.target === bairroModal) fecharModalBairro();
        });
    }
    if (bairroForm) bairroForm.addEventListener('submit', handleSalvarBairro);

    // Modal delete
    if (btnCancelarDeleteBairro) btnCancelarDeleteBairro.addEventListener('click', fecharModalDeleteBairro);
    if (deleteBairroModal) {
        deleteBairroModal.addEventListener('click', (e) => {
            if (e.target === deleteBairroModal) fecharModalDeleteBairro();
        });
    }
    if (btnConfirmarDeleteBairro) btnConfirmarDeleteBairro.addEventListener('click', confirmarExcluirBairro);
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

async function carregarConfigEntrega() {
    try {
        const response = await api.getConfigEntrega();
        const config = response.config || response;

        if (taxaEntrega) taxaEntrega.value = config.taxa_entrega || 0;
        if (valorMinimoEntrega) valorMinimoEntrega.value = config.valor_minimo_entrega || 0;
        if (tempoMedioEntrega) tempoMedioEntrega.value = config.tempo_medio_entrega || 30;

    } catch (error) {
        console.error('Erro ao carregar configuração de entrega:', error);
        showToast('Erro ao carregar configurações', 'error');
    }
}

async function handleSalvarConfigEntrega(e) {
    e.preventDefault();

    const btnSubmit = btnSalvarConfigEntrega;
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg> Salvando...';

    try {
        const data = {
            taxa_entrega: parseFloat(taxaEntrega.value) || 0,
            valor_minimo_entrega: parseFloat(valorMinimoEntrega.value) || 0,
            tempo_medio_entrega: parseInt(tempoMedioEntrega.value) || 30
        };

        await api.updateConfigEntrega(data);
        showToast('Configurações salvas com sucesso!', 'success');

    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        showToast(error.message || 'Erro ao salvar configurações', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

async function carregarBairros() {
    if (!tbodyBairros) return;

    tbodyBairros.innerHTML = '<tr><td colspan="4" class="text-center py-4">Carregando...</td></tr>';

    try {
        const response = await api.getConfigEntrega();
        const config = response.config || response;
        bairros = config.bairros_taxa_extra || [];

        renderizarBairros();
        toggleEmptyState(bairros.length === 0);

    } catch (error) {
        console.error('Erro ao carregar bairros:', error);
        tbodyBairros.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Erro ao carregar bairros</td></tr>';
        showToast('Erro ao carregar bairros', 'error');
    }
}

function renderizarBairros() {
    if (!tbodyBairros) return;

    if (bairros.length === 0) {
        tbodyBairros.innerHTML = '';
        return;
    }

    // Ordenar por nome
    bairros.sort((a, b) => a.bairro.localeCompare(b.bairro));

    tbodyBairros.innerHTML = bairros.map(b => `
        <tr>
            <td><strong>${escapeHtml(b.bairro)}</strong></td>
            <td>${formatCurrency(b.taxa_extra || 0)}</td>
            <td><span class="badge ${b.ativo ? 'badge-success' : 'badge-neutral'}">${b.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline btn-editar-bairro" data-id="${b.id}" aria-label="Editar bairro ${escapeHtml(b.bairro)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-outline btn-excluir-bairro" data-id="${b.id}" data-nome="${escapeHtml(b.bairro)}" style="color: var(--danger); border-color: var(--danger);" aria-label="Excluir bairro ${escapeHtml(b.bairro)}">
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
    document.querySelectorAll('.btn-editar-bairro').forEach(btn => {
        btn.addEventListener('click', () => abrirModalBairro(parseInt(btn.dataset.id)));
    });

    document.querySelectorAll('.btn-excluir-bairro').forEach(btn => {
        btn.addEventListener('click', () => abrirModalDeleteBairro(parseInt(btn.dataset.id), btn.dataset.nome));
    });
}

function toggleEmptyState(empty) {
    if (emptyStateBairros) {
        emptyStateBairros.classList.toggle('hidden', !empty);
    }
    if (tbodyBairros) {
        tbodyBairros.closest('.table-container').style.display = empty ? 'none' : 'block';
    }
}

function abrirModalBairro(bairroId_ = null) {
    // Reset form
    bairroForm.reset();
    bairroId.value = '';
    bairroTaxaExtra.value = '0';
    bairroAtivo.checked = true;

    if (bairroId_) {
        const bairro = bairros.find(b => b.id === bairroId_);
        if (bairro) {
            bairroModalTitulo.textContent = 'Editar Bairro';
            bairroId.value = bairro.id;
            bairroNome.value = bairro.bairro || '';
            bairroTaxaExtra.value = bairro.taxa_extra || 0;
            bairroAtivo.checked = bairro.ativo || false;
        }
    } else {
        bairroModalTitulo.textContent = 'Novo Bairro';
    }

    bairroModal.classList.remove('hidden');
    bairroModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    bairroNome.focus();
}

function fecharModalBairro() {
    bairroModal.classList.add('hidden');
    bairroModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

async function handleSalvarBairro(e) {
    e.preventDefault();

    const btnSubmit = btnSalvarBairro;
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg> Salvando...';

    try {
        const data = {
            bairro: bairroNome.value.trim(),
            taxa_extra: parseFloat(bairroTaxaExtra.value) || 0,
            ativo: bairroAtivo.checked
        };

        // Como a API não tem endpoints específicos para bairros,
        // vamos usar a configuração de entrega
        // Precisamos enviar a lista completa atualizada
        const bairroIndex = bairros.findIndex(b => b.id === parseInt(bairroId.value));

        if (bairroIndex >= 0) {
            bairros[bairroIndex] = { ...bairros[bairroIndex], ...data };
        } else {
            // Novo bairro - gerar ID temporário
            data.id = Date.now();
            bairros.push(data);
        }

        // Atualizar configuração completa
        await api.updateConfigEntrega({
            bairros_taxa_extra: bairros
        });

        showToast(bairroId.value ? 'Bairro atualizado com sucesso!' : 'Bairro adicionado com sucesso!', 'success');
        fecharModalBairro();
        await carregarBairros();

    } catch (error) {
        console.error('Erro ao salvar bairro:', error);
        showToast(error.message || 'Erro ao salvar bairro', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

function abrirModalDeleteBairro(id, nome) {
    bairroExcluindoId = id;
    deleteBairroNome.textContent = nome;
    deleteBairroModal.classList.remove('hidden');
    deleteBairroModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    btnCancelarDeleteBairro.focus();
}

function fecharModalDeleteBairro() {
    deleteBairroModal.classList.add('hidden');
    deleteBairroModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    bairroExcluindoId = null;
}

async function confirmarExcluirBairro() {
    if (!bairroExcluindoId) return;

    try {
        bairros = bairros.filter(b => b.id !== bairroExcluindoId);

        await api.updateConfigEntrega({
            bairros_taxa_extra: bairros
        });

        showToast('Bairro excluído com sucesso!', 'success');
        fecharModalDeleteBairro();
        await carregarBairros();
    } catch (error) {
        console.error('Erro ao excluir bairro:', error);
        showToast(error.message || 'Erro ao excluir bairro', 'error');
    }
}

function handleLogout() {
    api.clearAuth();
    showToast('Logout realizado com sucesso', 'success');
    setTimeout(() => window.location.href = '/inicio/admin-login.html', 1000);
}