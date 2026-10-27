import api from './api.js';
import { showToast, showLoading, hideLoading, escapeHtml } from './utils.js';

// Estado
let categorias = [];
let paginaAtual = 1;
const itensPorPagina = 10;
let categoriaExcluindoId = null;

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

const buscaCategoria = document.getElementById('buscaCategoria');
const filtroAtivo = document.getElementById('filtroAtivo');
const tbodyCategorias = document.getElementById('tbodyCategorias');
const emptyState = document.getElementById('emptyState');
const pagination = document.getElementById('pagination');
const btnNovaCategoria = document.getElementById('btnNovaCategoria');
const btnPrimeiraCategoria = document.getElementById('btnPrimeiraCategoria');

// Modal Categoria
const categoriaModal = document.getElementById('categoriaModal');
const categoriaModalClose = document.getElementById('categoriaModalClose');
const btnCancelarCategoria = document.getElementById('btnCancelarCategoria');
const categoriaForm = document.getElementById('categoriaForm');
const categoriaModalTitulo = document.getElementById('categoriaModalTitulo');
const categoriaId = document.getElementById('categoriaId');
const categoriaNome = document.getElementById('categoriaNome');
const categoriaDescricao = document.getElementById('categoriaDescricao');
const categoriaOrdem = document.getElementById('categoriaOrdem');
const categoriaAtivo = document.getElementById('categoriaAtivo');
const btnSalvarCategoria = document.getElementById('btnSalvarCategoria');

// Modal Delete
const deleteCategoriaModal = document.getElementById('deleteCategoriaModal');
const deleteCategoriaNome = document.getElementById('deleteCategoriaNome');
const btnCancelarDeleteCategoria = document.getElementById('btnCancelarDeleteCategoria');
const btnConfirmarDeleteCategoria = document.getElementById('btnConfirmarDeleteCategoria');

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
    await carregarCategorias();
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
            if (!categoriaModal.classList.contains('hidden')) fecharModalCategoria();
            if (!deleteCategoriaModal.classList.contains('hidden')) fecharModalDeleteCategoria();
        }
    });

    // Busca e filtros
    let buscaTimeout;
    if (buscaCategoria) {
        buscaCategoria.addEventListener('input', () => {
            clearTimeout(buscaTimeout);
            buscaTimeout = setTimeout(() => {
                paginaAtual = 1;
                carregarCategorias();
            }, 300);
        });
    }

    if (filtroAtivo) {
        filtroAtivo.addEventListener('change', () => {
            paginaAtual = 1;
            carregarCategorias();
        });
    }

    // Nova categoria
    if (btnNovaCategoria) btnNovaCategoria.addEventListener('click', () => abrirModalCategoria());
    if (btnPrimeiraCategoria) btnPrimeiraCategoria.addEventListener('click', () => abrirModalCategoria());

    // Modal categoria
    if (categoriaModalClose) categoriaModalClose.addEventListener('click', fecharModalCategoria);
    if (btnCancelarCategoria) btnCancelarCategoria.addEventListener('click', fecharModalCategoria);
    if (categoriaModal) {
        categoriaModal.addEventListener('click', (e) => {
            if (e.target === categoriaModal) fecharModalCategoria();
        });
    }
    if (categoriaForm) categoriaForm.addEventListener('submit', handleSalvarCategoria);

    // Modal delete
    if (btnCancelarDeleteCategoria) btnCancelarDeleteCategoria.addEventListener('click', fecharModalDeleteCategoria);
    if (deleteCategoriaModal) {
        deleteCategoriaModal.addEventListener('click', (e) => {
            if (e.target === deleteCategoriaModal) fecharModalDeleteCategoria();
        });
    }
    if (btnConfirmarDeleteCategoria) btnConfirmarDeleteCategoria.addEventListener('click', confirmarExcluirCategoria);
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

async function carregarCategorias() {
    if (!tbodyCategorias) return;

    tbodyCategorias.innerHTML = '<tr><td colspan="6" class="text-center py-4">Carregando...</td></tr>';

    try {
        const params = {
            pagina: paginaAtual,
            limite: itensPorPagina,
            ordem: 'ordem_exibicao',
            direcao: 'ASC'
        };

        if (buscaCategoria && buscaCategoria.value.trim()) {
            params.busca = buscaCategoria.value.trim();
        }

        if (filtroAtivo && filtroAtivo.value !== '') {
            params.ativo = filtroAtivo.value === 'true';
        }

        const response = await api.getCategoriasAdmin(params);

        categorias = response.categorias || response.data || response || [];
        const total = response.total || categorias.length;
        const totalPaginas = Math.ceil(total / itensPorPagina);

        renderizarCategorias();
        renderizarPaginacao(totalPaginas);
        toggleEmptyState(categorias.length === 0);

    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        tbodyCategorias.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-danger">Erro ao carregar categorias</td></tr>';
        showToast('Erro ao carregar categorias', 'error');
    }
}

function renderizarCategorias() {
    if (!tbodyCategorias) return;

    if (categorias.length === 0) {
        tbodyCategorias.innerHTML = '';
        return;
    }

    tbodyCategorias.innerHTML = categorias.map(cat => `
        <tr>
            <td><strong>${escapeHtml(cat.nome)}</strong></td>
            <td>${escapeHtml(cat.descricao || '—')}</td>
            <td>${cat.ordem_exibicao || 0}</td>
            <td><span class="badge ${cat.ativo ? 'badge-success' : 'badge-neutral'}">${cat.ativo ? 'Ativa' : 'Inativa'}</span></td>
            <td>${cat.total_produtos || 0}</td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline btn-editar-categoria" data-id="${cat.id}" aria-label="Editar ${escapeHtml(cat.nome)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-outline btn-excluir-categoria" data-id="${cat.id}" data-nome="${escapeHtml(cat.nome)}" style="color: var(--danger); border-color: var(--danger);" aria-label="Excluir ${escapeHtml(cat.nome)}">
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
    document.querySelectorAll('.btn-editar-categoria').forEach(btn => {
        btn.addEventListener('click', () => abrirModalCategoria(parseInt(btn.dataset.id)));
    });

    document.querySelectorAll('.btn-excluir-categoria').forEach(btn => {
        btn.addEventListener('click', () => abrirModalDeleteCategoria(parseInt(btn.dataset.id), btn.dataset.nome));
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

    // Primeira página
    if (paginaAtual > 1) {
        html += `<button class="pagination-btn" data-page="1" aria-label="Primeira página"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline><polyline points="15 18 9 12 15 6"></polyline></svg></button>`;
        html += `<button class="pagination-btn" data-page="${paginaAtual - 1}" aria-label="Página anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg></button>`;
    }

    // Páginas numeradas
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

    // Última página
    if (paginaAtual < totalPaginas) {
        html += `<button class="pagination-btn" data-page="${paginaAtual + 1}" aria-label="Próxima página"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></button>`;
        html += `<button class="pagination-btn" data-page="${totalPaginas}" aria-label="Última página"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline><polyline points="9 18 15 12 9 6"></polyline></svg></button>`;
    }

    html += `<span class="pagination-info">Página ${paginaAtual} de ${totalPaginas}</span>`;

    pagination.innerHTML = html;

    // Eventos
    pagination.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            paginaAtual = parseInt(btn.dataset.page);
            carregarCategorias();
        });
    });
}

function toggleEmptyState(empty) {
    if (emptyState) {
        emptyState.classList.toggle('hidden', !empty);
    }
    if (tbodyCategorias) {
        tbodyCategorias.closest('.table-container').style.display = empty ? 'none' : 'block';
    }
    if (pagination) {
        pagination.style.display = empty ? 'none' : 'flex';
    }
}

function abrirModalCategoria(categoriaId_ = null) {
    // Reset form
    categoriaForm.reset();
    categoriaId.value = '';
    categoriaOrdem.value = '0';
    categoriaAtivo.checked = true;

    if (categoriaId_) {
        const categoria = categorias.find(c => c.id === categoriaId_);
        if (categoria) {
            categoriaModalTitulo.textContent = 'Editar Categoria';
            categoriaId.value = categoria.id;
            categoriaNome.value = categoria.nome || '';
            categoriaDescricao.value = categoria.descricao || '';
            categoriaOrdem.value = categoria.ordem_exibicao || 0;
            categoriaAtivo.checked = categoria.ativo || false;
        }
    } else {
        categoriaModalTitulo.textContent = 'Nova Categoria';
    }

    categoriaModal.classList.remove('hidden');
    categoriaModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    categoriaNome.focus();
}

function fecharModalCategoria() {
    categoriaModal.classList.add('hidden');
    categoriaModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

async function handleSalvarCategoria(e) {
    e.preventDefault();

    const btnSubmit = btnSalvarCategoria;
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg> Salvando...';

    try {
        const data = {
            nome: categoriaNome.value.trim(),
            descricao: categoriaDescricao.value.trim() || null,
            ordem_exibicao: parseInt(categoriaOrdem.value) || 0,
            ativo: categoriaAtivo.checked
        };

        if (categoriaId.value) {
            await api.updateCategoria(categoriaId.value, data);
            showToast('Categoria atualizada com sucesso!', 'success');
        } else {
            await api.createCategoria(data);
            showToast('Categoria criada com sucesso!', 'success');
        }

        fecharModalCategoria();
        await carregarCategorias();

    } catch (error) {
        console.error('Erro ao salvar categoria:', error);
        showToast(error.message || 'Erro ao salvar categoria', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

function abrirModalDeleteCategoria(id, nome) {
    categoriaExcluindoId = id;
    deleteCategoriaNome.textContent = nome;
    deleteCategoriaModal.classList.remove('hidden');
    deleteCategoriaModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    btnCancelarDeleteCategoria.focus();
}

function fecharModalDeleteCategoria() {
    deleteCategoriaModal.classList.add('hidden');
    deleteCategoriaModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    categoriaExcluindoId = null;
}

async function confirmarExcluirCategoria() {
    if (!categoriaExcluindoId) return;

    try {
        await api.deleteCategoria(categoriaExcluindoId);
        showToast('Categoria excluída com sucesso!', 'success');
        fecharModalDeleteCategoria();
        await carregarCategorias();
    } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        showToast(error.message || 'Erro ao excluir categoria', 'error');
    }
}

function handleLogout() {
    api.clearAuth();
    showToast('Logout realizado com sucesso', 'success');
    setTimeout(() => window.location.href = '/inicio/admin-login.html', 1000);
}