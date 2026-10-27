import api from './api.js';
import { showToast, showLoading, hideLoading, formatDateTime, escapeHtml } from './utils.js';

// Estado
let usuarios = [];
let paginaAtual = 1;
const itensPorPagina = 10;
let usuarioExcluindoId = null;
let currentUserId = null;

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

const buscaUsuario = document.getElementById('buscaUsuario');
const filtroPerfil = document.getElementById('filtroPerfil');
const filtroAtivoUsuario = document.getElementById('filtroAtivoUsuario');
const tbodyUsuarios = document.getElementById('tbodyUsuarios');
const emptyState = document.getElementById('emptyState');
const pagination = document.getElementById('pagination');
const btnNovoUsuario = document.getElementById('btnNovoUsuario');
const btnPrimeiroUsuario = document.getElementById('btnPrimeiroUsuario');

// Modal Usuário
const usuarioModal = document.getElementById('usuarioModal');
const usuarioModalClose = document.getElementById('usuarioModalClose');
const btnCancelarUsuario = document.getElementById('btnCancelarUsuario');
const usuarioForm = document.getElementById('usuarioForm');
const usuarioModalTitulo = document.getElementById('usuarioModalTitulo');
const usuarioId = document.getElementById('usuarioId');
const usuarioNome = document.getElementById('usuarioNome');
const usuarioEmail = document.getElementById('usuarioEmail');
const usuarioSenha = document.getElementById('usuarioSenha');
const usuarioConfirmarSenha = document.getElementById('usuarioConfirmarSenha');
const senhaGroup = document.getElementById('senhaGroup');
const confirmarSenhaGroup = document.getElementById('confirmarSenhaGroup');
const usuarioPerfil = document.getElementById('usuarioPerfil');
const usuarioAtivo = document.getElementById('usuarioAtivo');
const forcaTrocaSenhaGroup = document.getElementById('forcaTrocaSenhaGroup');
const usuarioForcaTrocaSenha = document.getElementById('usuarioForcaTrocaSenha');
const btnSalvarUsuario = document.getElementById('btnSalvarUsuario');

// Toggle senhas
const toggleUsuarioSenha = document.getElementById('toggleUsuarioSenha');
const toggleConfirmarSenha = document.getElementById('toggleConfirmarSenha');

// Modal Alterar Senha (próprio usuário)
const alterarSenhaModal = document.getElementById('alterarSenhaModal');
const alterarSenhaModalClose = document.getElementById('alterarSenhaModalClose');
const btnCancelarAlterarSenha = document.getElementById('btnCancelarAlterarSenha');
const alterarSenhaForm = document.getElementById('alterarSenhaForm');
const senhaAtual = document.getElementById('senhaAtual');
const novaSenha = document.getElementById('novaSenha');
const confirmarNovaSenha = document.getElementById('confirmarNovaSenha');
const btnConfirmarAlterarSenha = document.getElementById('btnConfirmarAlterarSenha');
const toggleSenhaAtual = document.getElementById('toggleSenhaAtual');
const toggleNovaSenha = document.getElementById('toggleNovaSenha');
const toggleConfirmarNovaSenha = document.getElementById('toggleConfirmarNovaSenha');

// Modal Delete
const deleteUsuarioModal = document.getElementById('deleteUsuarioModal');
const deleteUsuarioNome = document.getElementById('deleteUsuarioNome');
const btnCancelarDeleteUsuario = document.getElementById('btnCancelarDeleteUsuario');
const btnConfirmarDeleteUsuario = document.getElementById('btnConfirmarDeleteUsuario');

// Labels dos perfis
const PERFIL_LABELS = {
    'administrador': 'Administrador',
    'atendente': 'Atendente',
    'cozinha': 'Cozinha',
    'entregador': 'Entregador'
};

const PERFIL_BADGE_CLASSES = {
    'administrador': 'badge-info',
    'atendente': 'badge-primary',
    'cozinha': 'badge-warning',
    'entregador': 'badge-success'
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
        currentUserId = user.id;
    } catch (error) {
        api.clearAuth();
        window.location.href = '/inicio/admin-login.html';
        return;
    }

    atualizarUserUI(user);
    await carregarUsuarios();
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
            if (!usuarioModal.classList.contains('hidden')) fecharModalUsuario();
            if (!alterarSenhaModal.classList.contains('hidden')) fecharModalAlterarSenha();
            if (!deleteUsuarioModal.classList.contains('hidden')) fecharModalDeleteUsuario();
        }
    });

    // Busca e filtros
    let buscaTimeout;
    if (buscaUsuario) {
        buscaUsuario.addEventListener('input', () => {
            clearTimeout(buscaTimeout);
            buscaTimeout = setTimeout(() => {
                paginaAtual = 1;
                carregarUsuarios();
            }, 300);
        });
    }

    [filtroPerfil, filtroAtivoUsuario].forEach(el => {
        if (el) el.addEventListener('change', () => {
            paginaAtual = 1;
            carregarUsuarios();
        });
    });

    // Novo usuário
    if (btnNovoUsuario) btnNovoUsuario.addEventListener('click', () => abrirModalUsuario());
    if (btnPrimeiroUsuario) btnPrimeiroUsuario.addEventListener('click', () => abrirModalUsuario());

    // Modal usuário
    if (usuarioModalClose) usuarioModalClose.addEventListener('click', fecharModalUsuario);
    if (btnCancelarUsuario) btnCancelarUsuario.addEventListener('click', fecharModalUsuario);
    if (usuarioModal) {
        usuarioModal.addEventListener('click', (e) => {
            if (e.target === usuarioModal) fecharModalUsuario();
        });
    }
    if (usuarioForm) usuarioForm.addEventListener('submit', handleSalvarUsuario);

    // Toggle senha
    if (toggleUsuarioSenha) {
        toggleUsuarioSenha.addEventListener('click', () => togglePasswordVisibility(usuarioSenha, toggleUsuarioSenha));
    }
    if (toggleConfirmarSenha) {
        toggleConfirmarSenha.addEventListener('click', () => togglePasswordVisibility(usuarioConfirmarSenha, toggleConfirmarSenha));
    }

    // Modal alterar senha
    if (alterarSenhaModalClose) alterarSenhaModalClose.addEventListener('click', fecharModalAlterarSenha);
    if (btnCancelarAlterarSenha) btnCancelarAlterarSenha.addEventListener('click', fecharModalAlterarSenha);
    if (alterarSenhaModal) {
        alterarSenhaModal.addEventListener('click', (e) => {
            if (e.target === alterarSenhaModal) fecharModalAlterarSenha();
        });
    }
    if (alterarSenhaForm) alterarSenhaForm.addEventListener('submit', handleAlterarMinhaSenha);
    if (toggleSenhaAtual) toggleSenhaAtual.addEventListener('click', () => togglePasswordVisibility(senhaAtual, toggleSenhaAtual));
    if (toggleNovaSenha) toggleNovaSenha.addEventListener('click', () => togglePasswordVisibility(novaSenha, toggleNovaSenha));
    if (toggleConfirmarNovaSenha) toggleConfirmarNovaSenha.addEventListener('click', () => togglePasswordVisibility(confirmarNovaSenha, toggleConfirmarNovaSenha));

    // Modal delete
    if (btnCancelarDeleteUsuario) btnCancelarDeleteUsuario.addEventListener('click', fecharModalDeleteUsuario);
    if (deleteUsuarioModal) {
        deleteUsuarioModal.addEventListener('click', (e) => {
            if (e.target === deleteUsuarioModal) fecharModalDeleteUsuario();
        });
    }
    if (btnConfirmarDeleteUsuario) btnConfirmarDeleteUsuario.addEventListener('click', confirmarExcluirUsuario);
}

function atualizarUserUI(user) {
    if (userName) userName.textContent = user.nome;
    if (dropdownUserName) dropdownUserName.textContent = user.nome;
    if (userAvatar) userAvatar.textContent = user.nome.charAt(0).toUpperCase();
    if (dropdownUserRole) {
        dropdownUserRole.textContent = PERFIL_LABELS[user.perfil] || user.perfil || 'administrador';
        dropdownUserRole.className = `badge ${PERFIL_BADGE_CLASSES[user.perfil] || 'badge-info'}`;
    }
}

async function carregarUsuarios() {
    if (!tbodyUsuarios) return;

    tbodyUsuarios.innerHTML = '<tr><td colspan="6" class="text-center py-4">Carregando...</td></tr>';

    try {
        const params = {
            pagina: paginaAtual,
            limite: itensPorPagina,
            ordem: 'nome',
            direcao: 'ASC'
        };

        if (buscaUsuario && buscaUsuario.value.trim()) {
            params.busca = buscaUsuario.value.trim();
        }

        if (filtroPerfil && filtroPerfil.value) {
            params.perfil = filtroPerfil.value;
        }

        if (filtroAtivoUsuario && filtroAtivoUsuario.value !== '') {
            params.ativo = filtroAtivoUsuario.value === 'true';
        }

        const response = await api.getUsuariosAdmin(params);
        usuarios = response.usuarios || response.data || response || [];
        const total = response.total || usuarios.length;
        const totalPaginas = Math.ceil(total / itensPorPagina);

        renderizarUsuarios();
        renderizarPaginacao(totalPaginas);
        toggleEmptyState(usuarios.length === 0);

    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        tbodyUsuarios.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Erro ao carregar usuários</td></tr>';
        showToast('Erro ao carregar usuários', 'error');
    }
}

function renderizarUsuarios() {
    if (!tbodyUsuarios) return;

    if (usuarios.length === 0) {
        tbodyUsuarios.innerHTML = '';
        return;
    }

    tbodyUsuarios.innerHTML = usuarios.map(u => `
        <tr>
            <td><strong>${escapeHtml(u.nome)}</strong></td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="badge ${PERFIL_BADGE_CLASSES[u.perfil] || 'badge-neutral'}">${PERFIL_LABELS[u.perfil] || u.perfil}</span></td>
            <td>${u.ultimo_login ? formatDateTime(u.ultimo_login) : '<span style="color: var(--text-muted);">Nunca</span>'}</td>
            <td><span class="badge ${u.ativo ? 'badge-success' : 'badge-neutral'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline btn-editar-usuario" data-id="${u.id}" ${u.id === currentUserId ? 'disabled' : ''} aria-label="Editar ${escapeHtml(u.nome)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-outline btn-alterar-senha-usuario" data-id="${u.id}" data-nome="${escapeHtml(u.nome)}" aria-label="Alterar senha de ${escapeHtml(u.nome)}" title="Alterar senha">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-outline btn-excluir-usuario" data-id="${u.id}" data-nome="${escapeHtml(u.nome)}" ${u.id === currentUserId ? 'disabled style="opacity: 0.5;"' : ''} style="color: var(--danger); border-color: var(--danger);" aria-label="Excluir ${escapeHtml(u.nome)}">
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
    document.querySelectorAll('.btn-editar-usuario:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => abrirModalUsuario(parseInt(btn.dataset.id)));
    });

    document.querySelectorAll('.btn-alterar-senha-usuario').forEach(btn => {
        btn.addEventListener('click', () => abrirModalAlterarSenha(parseInt(btn.dataset.id), btn.dataset.nome));
    });

    document.querySelectorAll('.btn-excluir-usuario:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => abrirModalDeleteUsuario(parseInt(btn.dataset.id), btn.dataset.nome));
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
            carregarUsuarios();
        });
    });
}

function toggleEmptyState(empty) {
    if (emptyState) {
        emptyState.classList.toggle('hidden', !empty);
    }
    if (tbodyUsuarios) {
        tbodyUsuarios.closest('.table-container').style.display = empty ? 'none' : 'block';
    }
    if (pagination) {
        pagination.style.display = empty ? 'none' : 'flex';
    }
}

function abrirModalUsuario(usuarioId_ = null) {
    // Reset form
    usuarioForm.reset();
    usuarioId.value = '';
    senhaGroup.style.display = 'block';
    confirmarSenhaGroup.style.display = 'block';
    forcaTrocaSenhaGroup.style.display = 'none';
    usuarioAtivo.checked = true;
    usuarioForcaTrocaSenha.checked = false;

    if (usuarioId_) {
        const usuario = usuarios.find(u => u.id === usuarioId_);
        if (usuario) {
            usuarioModalTitulo.textContent = 'Editar Usuário';
            usuarioId.value = usuario.id;
            usuarioNome.value = usuario.nome || '';
            usuarioEmail.value = usuario.email || '';
            usuarioPerfil.value = usuario.perfil || '';
            usuarioAtivo.checked = usuario.ativo || false;

            // Edição: senha é opcional
            senhaGroup.style.display = 'block';
            confirmarSenhaGroup.style.display = 'block';
            usuarioSenha.removeAttribute('required');
            usuarioSenha.placeholder = 'Deixe em branco para não alterar';
            usuarioConfirmarSenha.removeAttribute('required');
            usuarioConfirmarSenha.placeholder = 'Confirme a nova senha';
            senhaHelp.textContent = 'Deixe em branco para manter a senha atual';

            // Mostrar forca_troca_senha apenas na edição
            forcaTrocaSenhaGroup.style.display = 'block';
            usuarioForcaTrocaSenha.checked = usuario.forca_troca_senha || false;

            // Não pode editar próprio perfil como administrador se for o único
            // Mas isso é validado no backend
        }
    } else {
        usuarioModalTitulo.textContent = 'Novo Usuário';
        usuarioSenha.setAttribute('required', 'required');
        usuarioConfirmarSenha.setAttribute('required', 'required');
        usuarioSenha.placeholder = 'Mínimo 8 caracteres';
        usuarioConfirmarSenha.placeholder = 'Confirme a senha';
        senhaHelp.textContent = 'Mínimo 8 caracteres';
    }

    usuarioModal.classList.remove('hidden');
    usuarioModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    usuarioNome.focus();
}

function fecharModalUsuario() {
    usuarioModal.classList.add('hidden');
    usuarioModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

async function handleSalvarUsuario(e) {
    e.preventDefault();

    const isEditing = !!usuarioId.value;

    // Validar senha se preenchida
    if (usuarioSenha.value && usuarioSenha.value.length < 8) {
        showToast('A senha deve ter no mínimo 8 caracteres', 'warning');
        usuarioSenha.focus();
        return;
    }

    if (usuarioSenha.value !== usuarioConfirmarSenha.value) {
        showToast('As senhas não coincidem', 'warning');
        usuarioConfirmarSenha.focus();
        return;
    }

    const btnSubmit = btnSalvarUsuario;
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg> Salvando...';

    try {
        const data = {
            nome: usuarioNome.value.trim(),
            email: usuarioEmail.value.trim(),
            perfil: usuarioPerfil.value,
            ativo: usuarioAtivo.checked,
            forca_troca_senha: usuarioForcaTrocaSenha.checked || false
        };

        // Só incluir senha se preenchida (edição) ou obrigatória (novo)
        if (usuarioSenha.value) {
            data.senha = usuarioSenha.value;
        } else if (!isEditing) {
            showToast('Senha é obrigatória para novo usuário', 'warning');
            usuarioSenha.focus();
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalText;
            return;
        }

        if (isEditing) {
            await api.updateUsuarioAdmin(usuarioId.value, data);
            showToast('Usuário atualizado com sucesso!', 'success');
        } else {
            await api.createUsuarioAdmin(data);
            showToast('Usuário criado com sucesso!', 'success');
        }

        fecharModalUsuario();
        await carregarUsuarios();

    } catch (error) {
        console.error('Erro ao salvar usuário:', error);
        showToast(error.message || 'Erro ao salvar usuário', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

function abrirModalAlterarSenha(usuarioId_, usuarioNome_) {
    // Se for o próprio usuário, usar o modal de alterar própria senha
    if (usuarioId_ === currentUserId) {
        alterarSenhaForm.reset();
        alterarSenhaModal.classList.remove('hidden');
        alterarSenhaModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        senhaAtual.focus();
    } else {
        // Para outros usuários, admin define nova senha
        abrirModalUsuario(usuarioId_);
        // Preencher apenas senha
        setTimeout(() => {
            usuarioSenha.focus();
        }, 100);
    }
}

function fecharModalAlterarSenha() {
    alterarSenhaModal.classList.add('hidden');
    alterarSenhaModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

async function handleAlterarMinhaSenha(e) {
    e.preventDefault();

    if (novaSenha.value !== confirmarNovaSenha.value) {
        showToast('As senhas não coincidem', 'warning');
        confirmarNovaSenha.focus();
        return;
    }

    if (novaSenha.value.length < 8) {
        showToast('A nova senha deve ter no mínimo 8 caracteres', 'warning');
        novaSenha.focus();
        return;
    }

    const btnSubmit = btnConfirmarAlterarSenha;
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg> Alterando...';

    try {
        await api.adminChangePassword({
            senha_atual: senhaAtual.value,
            nova_senha: novaSenha.value
        });

        showToast('Senha alterada com sucesso!', 'success');
        fecharModalAlterarSenha();

    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        showToast(error.message || 'Erro ao alterar senha', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

function abrirModalDeleteUsuario(id, nome) {
    usuarioExcluindoId = id;
    deleteUsuarioNome.textContent = nome;
    deleteUsuarioModal.classList.remove('hidden');
    deleteUsuarioModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    btnCancelarDeleteUsuario.focus();
}

function fecharModalDeleteUsuario() {
    deleteUsuarioModal.classList.add('hidden');
    deleteUsuarioModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    usuarioExcluindoId = null;
}

async function confirmarExcluirUsuario() {
    if (!usuarioExcluindoId) return;

    // Não permitir excluir a si mesmo
    if (usuarioExcluindoId === currentUserId) {
        showToast('Você não pode excluir seu próprio usuário', 'warning');
        return;
    }

    try {
        await api.deleteUsuarioAdmin(usuarioExcluindoId);
        showToast('Usuário excluído com sucesso!', 'success');
        fecharModalDeleteUsuario();
        await carregarUsuarios();
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        showToast(error.message || 'Erro ao excluir usuário', 'error');
    }
}

function togglePasswordVisibility(input, button) {
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;

    const svg = button.querySelector('svg');
    if (type === 'text') {
        svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
}

function handleLogout() {
    api.clearAuth();
    showToast('Logout realizado com sucesso', 'success');
    setTimeout(() => window.location.href = '/inicio/admin-login.html', 1000);
}