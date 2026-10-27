import api from './api.js';
import { showToast, showLoading, hideLoading, formatCurrency, escapeHtml } from './utils.js';

// Estado
let produtos = [];
let categorias = [];
let paginaAtual = 1;
const itensPorPagina = 10;
let produtoExcluindoId = null;
let produtoEditandoId = null;

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

const buscaProduto = document.getElementById('buscaProduto');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroAtivo = document.getElementById('filtroAtivo');
const filtroDestaque = document.getElementById('filtroDestaque');
const tbodyProdutos = document.getElementById('tbodyProdutos');
const emptyState = document.getElementById('emptyState');
const pagination = document.getElementById('pagination');
const btnNovoProduto = document.getElementById('btnNovoProduto');
const btnPrimeiroProduto = document.getElementById('btnPrimeiroProduto');

// Modal Produto
const produtoModal = document.getElementById('produtoModal');
const produtoModalClose = document.getElementById('produtoModalClose');
const btnCancelarProduto = document.getElementById('btnCancelarProduto');
const produtoForm = document.getElementById('produtoForm');
const produtoModalTitulo = document.getElementById('produtoModalTitulo');
const produtoId = document.getElementById('produtoId');
const produtoNome = document.getElementById('produtoNome');
const produtoCategoria = document.getElementById('produtoCategoria');
const produtoDescricao = document.getElementById('produtoDescricao');
const produtoPreco = document.getElementById('produtoPreco');
const produtoEstoque = document.getElementById('produtoEstoque');
const produtoTempoPreparo = document.getElementById('produtoTempoPreparo');
const produtoImagem = document.getElementById('produtoImagem');
const produtoAtivo = document.getElementById('produtoAtivo');
const produtoDestaque = document.getElementById('produtoDestaque');
const btnSalvarProduto = document.getElementById('btnSalvarProduto');
const btnGerenciarPersonalizacoes = document.getElementById('btnGerenciarPersonalizacoes');

// Modal Delete
const deleteProdutoModal = document.getElementById('deleteProdutoModal');
const deleteProdutoNome = document.getElementById('deleteProdutoNome');
const btnCancelarDeleteProduto = document.getElementById('btnCancelarDeleteProduto');
const btnConfirmarDeleteProduto = document.getElementById('btnConfirmarDeleteProduto');

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

    // Carregar categorias para o select
    await carregarCategorias();

    // Carregar produtos
    await carregarProdutos();
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
            if (!produtoModal.classList.contains('hidden')) fecharModalProduto();
            if (!deleteProdutoModal.classList.contains('hidden')) fecharModalDeleteProduto();
        }
    });

    // Busca e filtros
    let buscaTimeout;
    if (buscaProduto) {
        buscaProduto.addEventListener('input', () => {
            clearTimeout(buscaTimeout);
            buscaTimeout = setTimeout(() => {
                paginaAtual = 1;
                carregarProdutos();
            }, 300);
        });
    }

    [filtroCategoria, filtroAtivo, filtroDestaque].forEach(el => {
        if (el) el.addEventListener('change', () => {
            paginaAtual = 1;
            carregarProdutos();
        });
    });

    // Novo produto
    if (btnNovoProduto) btnNovoProduto.addEventListener('click', () => abrirModalProduto());
    if (btnPrimeiroProduto) btnPrimeiroProduto.addEventListener('click', () => abrirModalProduto());

    // Modal produto
    if (produtoModalClose) produtoModalClose.addEventListener('click', fecharModalProduto);
    if (btnCancelarProduto) btnCancelarProduto.addEventListener('click', fecharModalProduto);
    if (produtoModal) {
        produtoModal.addEventListener('click', (e) => {
            if (e.target === produtoModal) fecharModalProduto();
        });
    }
    if (produtoForm) produtoForm.addEventListener('submit', handleSalvarProduto);

    // Botão gerenciar personalizações
    if (btnGerenciarPersonalizacoes) {
        btnGerenciarPersonalizacoes.addEventListener('click', () => {
            if (produtoEditandoId) {
                window.location.href = `/inicio/admin-produtos-personalizacoes.html?id=${produtoEditandoId}`;
            }
        });
    }

    // Modal delete
    if (btnCancelarDeleteProduto) btnCancelarDeleteProduto.addEventListener('click', fecharModalDeleteProduto);
    if (deleteProdutoModal) {
        deleteProdutoModal.addEventListener('click', (e) => {
            if (e.target === deleteProdutoModal) fecharModalDeleteProduto();
        });
    }
    if (btnConfirmarDeleteProduto) btnConfirmarDeleteProduto.addEventListener('click', confirmarExcluirProduto);
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
    try {
        const response = await api.getCategoriasAdmin({ ativo: true, limite: 100 });
        categorias = response.categorias || response.data || response || [];

        // Preencher select de categoria
        if (produtoCategoria) {
            const currentValue = produtoCategoria.value;
            produtoCategoria.innerHTML = '<option value="">Selecione uma categoria</option>';
            categorias.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.nome;
                produtoCategoria.appendChild(option);
            });
            // Restaurar valor se estivermos editando
            if (currentValue) produtoCategoria.value = currentValue;
        }

        // Preencher filtro de categoria
        if (filtroCategoria) {
            const currentFilter = filtroCategoria.value;
            filtroCategoria.innerHTML = '<option value="">Todas as categorias</option>';
            categorias.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.nome;
                filtroCategoria.appendChild(option);
            });
            if (currentFilter) filtroCategoria.value = currentFilter;
        }
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

async function carregarProdutos() {
    if (!tbodyProdutos) return;

    tbodyProdutos.innerHTML = '<tr><td colspan="8" class="text-center py-4">Carregando...</td></tr>';

    try {
        const params = {
            pagina: paginaAtual,
            limite: itensPorPagina,
            ordem: 'nome',
            direcao: 'ASC'
        };

        if (buscaProduto && buscaProduto.value.trim()) {
            params.busca = buscaProduto.value.trim();
        }

        if (filtroCategoria && filtroCategoria.value) {
            params.categoria_id = filtroCategoria.value;
        }

        if (filtroAtivo && filtroAtivo.value !== '') {
            params.ativo = filtroAtivo.value === 'true';
        }

        if (filtroDestaque && filtroDestaque.value !== '') {
            params.destaque = filtroDestaque.value === 'true';
        }

        const response = await api.getProdutosAdmin(params);

        produtos = response.produtos || response.data || response || [];
        const total = response.total || produtos.length;
        const totalPaginas = Math.ceil(total / itensPorPagina);

        renderizarProdutos();
        renderizarPaginacao(totalPaginas);
        toggleEmptyState(produtos.length === 0);

    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        tbodyProdutos.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">Erro ao carregar produtos</td></tr>';
        showToast('Erro ao carregar produtos', 'error');
    }
}

function renderizarProdutos() {
    if (!tbodyProdutos) return;

    if (produtos.length === 0) {
        tbodyProdutos.innerHTML = '';
        return;
    }

    tbodyProdutos.innerHTML = produtos.map(prod => `
        <tr>
            <td>
                ${prod.imagem_url ?
                    `<img src="${escapeHtml(prod.imagem_url)}" alt="" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">` :
                    '<div style="width: 40px; height: 40px; background: var(--bg-secondary); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 18px;">📷</div>'
                }
            </td>
            <td><strong>${escapeHtml(prod.nome)}</strong></td>
            <td>${escapeHtml(prod.categoria_nome || '—')}</td>
            <td>${formatCurrency(prod.preco)}</td>
            <td>${prod.estoque > 0 ? prod.estoque : '<span style="color: var(--text-muted);">Ilimitado</span>'}</td>
            <td><span class="badge ${prod.ativo ? 'badge-success' : 'badge-neutral'}">${prod.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td><span class="badge ${prod.destaque ? 'badge-warning' : 'badge-neutral'}">${prod.destaque ? 'Sim' : 'Não'}</span></td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline btn-editar-produto" data-id="${prod.id}" aria-label="Editar ${escapeHtml(prod.nome)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-outline btn-personalizacoes-produto" data-id="${prod.id}" data-nome="${escapeHtml(prod.nome)}" aria-label="Personalizações de ${escapeHtml(prod.nome)}" title="Personalizações">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-outline btn-excluir-produto" data-id="${prod.id}" data-nome="${escapeHtml(prod.nome)}" style="color: var(--danger); border-color: var(--danger);" aria-label="Excluir ${escapeHtml(prod.nome)}">
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
    document.querySelectorAll('.btn-editar-produto').forEach(btn => {
        btn.addEventListener('click', () => abrirModalProduto(parseInt(btn.dataset.id)));
    });

    document.querySelectorAll('.btn-personalizacoes-produto').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = `/inicio/admin-produtos-personalizacoes.html?id=${btn.dataset.id}`;
        });
    });

    document.querySelectorAll('.btn-excluir-produto').forEach(btn => {
        btn.addEventListener('click', () => abrirModalDeleteProduto(parseInt(btn.dataset.id), btn.dataset.nome));
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
            carregarProdutos();
        });
    });
}

function toggleEmptyState(empty) {
    if (emptyState) {
        emptyState.classList.toggle('hidden', !empty);
    }
    if (tbodyProdutos) {
        tbodyProdutos.closest('.table-container').style.display = empty ? 'none' : 'block';
    }
    if (pagination) {
        pagination.style.display = empty ? 'none' : 'flex';
    }
}

function abrirModalProduto(produtoId_ = null) {
    // Reset form
    produtoForm.reset();
    produtoId.value = '';
    produtoEstoque.value = '0';
    produtoTempoPreparo.value = '15';
    produtoAtivo.checked = true;
    produtoDestaque.checked = false;
    btnGerenciarPersonalizacoes.style.display = 'none';
    produtoEditandoId = null;

    if (produtoId_) {
        const produto = produtos.find(p => p.id === produtoId_);
        if (produto) {
            produtoModalTitulo.textContent = 'Editar Produto';
            produtoId.value = produto.id;
            produtoNome.value = produto.nome || '';
            produtoCategoria.value = produto.categoria_id || '';
            produtoDescricao.value = produto.descricao || '';
            produtoPreco.value = produto.preco || '';
            produtoEstoque.value = produto.estoque || 0;
            produtoTempoPreparo.value = produto.tempo_preparo || 15;
            produtoImagem.value = produto.imagem_url || '';
            produtoAtivo.checked = produto.ativo || false;
            produtoDestaque.checked = produto.destaque || false;
            produtoEditandoId = produto.id;
            btnGerenciarPersonalizacoes.style.display = 'inline-flex';
        }
    } else {
        produtoModalTitulo.textContent = 'Novo Produto';
    }

    produtoModal.classList.remove('hidden');
    produtoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    produtoNome.focus();
}

function fecharModalProduto() {
    produtoModal.classList.add('hidden');
    produtoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    produtoEditandoId = null;
}

async function handleSalvarProduto(e) {
    e.preventDefault();

    const btnSubmit = btnSalvarProduto;
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg> Salvando...';

    try {
        const data = {
            nome: produtoNome.value.trim(),
            categoria_id: parseInt(produtoCategoria.value),
            descricao: produtoDescricao.value.trim() || null,
            preco: parseFloat(produtoPreco.value),
            estoque: parseInt(produtoEstoque.value) || 0,
            tempo_preparo: parseInt(produtoTempoPreparo.value) || 15,
            imagem_url: produtoImagem.value.trim() || null,
            ativo: produtoAtivo.checked,
            destaque: produtoDestaque.checked
        };

        if (produtoId.value) {
            await api.updateProduto(produtoId.value, data);
            showToast('Produto atualizado com sucesso!', 'success');
        } else {
            const novoProduto = await api.createProduto(data);
            showToast('Produto criado com sucesso!', 'success');
            produtoId.value = novoProduto.produto?.id || novoProduto.id;
            produtoEditandoId = produtoId.value;
            btnGerenciarPersonalizacoes.style.display = 'inline-flex';
        }

        await carregarProdutos();

    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        showToast(error.message || 'Erro ao salvar produto', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

function abrirModalDeleteProduto(id, nome) {
    produtoExcluindoId = id;
    deleteProdutoNome.textContent = nome;
    deleteProdutoModal.classList.remove('hidden');
    deleteProdutoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    btnCancelarDeleteProduto.focus();
}

function fecharModalDeleteProduto() {
    deleteProdutoModal.classList.add('hidden');
    deleteProdutoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    produtoExcluindoId = null;
}

async function confirmarExcluirProduto() {
    if (!produtoExcluindoId) return;

    try {
        await api.deleteProduto(produtoExcluindoId);
        showToast('Produto excluído com sucesso!', 'success');
        fecharModalDeleteProduto();
        await carregarProdutos();
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        showToast(error.message || 'Erro ao excluir produto', 'error');
    }
}

function handleLogout() {
    api.clearAuth();
    showToast('Logout realizado com sucesso', 'success');
    setTimeout(() => window.location.href = '/inicio/admin-login.html', 1000);
}