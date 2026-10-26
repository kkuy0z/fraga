import api from './api.js';
import cart from './cart.js';
import { formatCurrency, showToast, showLoading, hideLoading, debounce } from './utils.js';

// Estado da página
let categorias = [];
let produtos = [];
let categoriaAtiva = 'todas';
let paginaAtual = 1;
const itensPorPagina = 12;
let totalPaginas = 1;
let searchTerm = '';

// Elementos DOM
const categoriasFiltro = document.getElementById('categoriasFiltro');
const cardapioGrid = document.getElementById('cardapioGrid');
const emptyState = document.getElementById('emptyState');
const pagination = document.getElementById('pagination');
const cartCount = document.getElementById('cartCount');
const produtoModal = document.getElementById('produtoModal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');
const searchInput = document.getElementById('searchInput');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarPagina();
    configurarEventListeners();
    atualizarContadorCarrinho();
    verificarAuth();
});

async function inicializarPagina() {
    showLoading('Carregando cardápio...');
    try {
        // Carregar categorias e produtos em paralelo
        const [categoriasRes, produtosRes] = await Promise.all([
            api.getCategorias(true),
            api.getProdutos({ disponivel: true, limit: itensPorPagina, page: 1 })
        ]);

        categorias = categoriasRes;
        produtos = produtosRes.data;
        totalPaginas = produtosRes.pagination.totalPages;

        renderizarCategorias();
        renderizarProdutos();
        renderizarPaginacao();
    } catch (error) {
        console.error('Erro ao carregar cardápio:', error);
        showToast('Erro ao carregar cardápio. Tente novamente.', 'error');
        emptyState.classList.remove('hidden');
    } finally {
        hideLoading();
    }
}

function configurarEventListeners() {
    // Fechar modal
    modalClose.addEventListener('click', fecharModal);
    produtoModal.addEventListener('click', (e) => {
        if (e.target === produtoModal) fecharModal();
    });

    // Busca com debounce
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            searchTerm = e.target.value.trim().toLowerCase();
            paginaAtual = 1;
            await carregarProdutos();
        }, 300));
    }

    // Fechar modal com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !produtoModal.classList.contains('hidden')) {
            fecharModal();
        }
    });

    // Atualizar contador do carrinho quando mudar
    cart.subscribe(atualizarContadorCarrinho);
}

async function verificarAuth() {
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('auth_user') || 'null');
    const clienteToken = localStorage.getItem('cliente_token');
    const clienteUser = JSON.parse(localStorage.getItem('cliente_user') || 'null');

    const userButton = document.getElementById('userButton');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminLink = document.getElementById('adminLink');

    if (clienteToken && clienteUser) {
        // Cliente logado
        userButton.style.display = 'flex';
        userName.textContent = clienteUser.nome;
        userAvatar.textContent = clienteUser.nome.charAt(0).toUpperCase();

        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('cliente_token');
            localStorage.removeItem('cliente_user');
            showToast('Logout realizado com sucesso', 'success');
            setTimeout(() => window.location.reload(), 1000);
        });
    } else if (token && user) {
        // Admin logado
        userButton.style.display = 'flex';
        userName.textContent = user.nome;
        userAvatar.textContent = user.nome.charAt(0).toUpperCase();
        adminLink.style.display = 'inline-flex';

        logoutBtn.addEventListener('click', () => {
            api.clearAuth();
            showToast('Logout realizado com sucesso', 'success');
            setTimeout(() => window.location.reload(), 1000);
        });
    } else {
        // Não logado
        userButton.style.display = 'none';
        adminLink.style.display = 'none';
    }
}

function atualizarContadorCarrinho() {
    const total = cart.getTotalItems();
    cartCount.textContent = total;
    cartCount.style.display = total > 0 ? 'flex' : 'none';
}

function renderizarCategorias() {
    // Botão "Todas"
    const todasBtn = document.createElement('button');
    todasBtn.className = `categoria-btn ${categoriaAtiva === 'todas' ? 'active' : ''}`;
    todasBtn.setAttribute('role', 'tab');
    todasBtn.setAttribute('aria-selected', categoriaAtiva === 'todas');
    todasBtn.textContent = 'Todas';
    todasBtn.addEventListener('click', () => selecionarCategoria('todas'));
    categoriasFiltro.appendChild(todasBtn);

    // Categorias do banco
    categorias.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `categoria-btn ${categoriaAtiva === cat.id ? 'active' : ''}`;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', categoriaAtiva === cat.id);
        btn.textContent = cat.nome;
        btn.dataset.categoriaId = cat.id;
        btn.addEventListener('click', () => selecionarCategoria(cat.id));
        categoriasFiltro.appendChild(btn);
    });
}

async function selecionarCategoria(categoriaId) {
    categoriaAtiva = categoriaId;
    paginaAtual = 1;

    // Atualizar UI dos botões
    document.querySelectorAll('.categoria-btn').forEach(btn => {
        const isActive = (categoriaId === 'todas' && !btn.dataset.categoriaId) ||
                        (btn.dataset.categoriaId && btn.dataset.categoriaId === categoriaId);
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive);
    });

    await carregarProdutos();
}

async function carregarProdutos() {
    showLoading('Carregando produtos...');
    try {
        const params = {
            disponivel: true,
            limit: itensPorPagina,
            page: paginaAtual
        };

        if (categoriaAtiva !== 'todas') {
            params.categoria_id = categoriaAtiva;
        }

        if (searchTerm) {
            params.search = searchTerm;
        }

        const response = await api.getProdutos(params);
        produtos = response.data;
        totalPaginas = response.pagination.totalPages;

        renderizarProdutos();
        renderizarPaginacao();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        showToast('Erro ao carregar produtos', 'error');
        produtos = [];
        renderizarProdutos();
    } finally {
        hideLoading();
    }
}

function renderizarProdutos() {
    cardapioGrid.innerHTML = '';

    if (produtos.length === 0) {
        emptyState.classList.remove('hidden');
        pagination.style.display = 'none';
        return;
    }

    emptyState.classList.add('hidden');
    pagination.style.display = 'flex';

    produtos.forEach(produto => {
        const card = criarCardProduto(produto);
        cardapioGrid.appendChild(card);
    });
}

function criarCardProduto(produto) {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('role', 'listitem');

    const temImagem = produto.imagem_url && produto.imagem_url.trim() !== '';

    card.innerHTML = `
        ${temImagem ? `
            <img src="${produto.imagem_url}" alt="${produto.nome}" class="card-image" loading="lazy"
                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="card-image-placeholder" style="display:none; width:100%; aspect-ratio:16/10; background:var(--bg-elevated); display:flex; align-items:center; justify-content:center; color:var(--text-muted);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <path d="M21 15l-5-5L5 21"></path>
                </svg>
            </div>
        ` : `
            <div class="card-image-placeholder" style="width:100%; aspect-ratio:16/10; background:var(--bg-elevated); display:flex; align-items:center; justify-content:center; color:var(--text-muted);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <path d="M21 15l-5-5L5 21"></path>
                </svg>
            </div>
        `}
        <div class="card-content">
            <h3 class="card-title">${produto.nome}</h3>
            ${produto.descricao ? `<p class="card-description">${produto.descricao}</p>` : ''}
            <div class="d-flex justify-between align-center">
                <span class="card-price">${formatCurrency(produto.preco_base)}</span>
                <button class="btn btn-primary btn-sm" data-produto-id="${produto.id}" aria-label="Adicionar ${produto.nome} ao carrinho">
                    Adicionar
                </button>
            </div>
        </div>
    `;

    // Evento de clique no card (abrir modal)
    card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
            abrirModalProduto(produto);
        }
    });

    // Evento do botão adicionar
    const btnAdicionar = card.querySelector('button[data-produto-id]');
    btnAdicionar.addEventListener('click', (e) => {
        e.stopPropagation();
        if (produto.personalizacoes && produto.personalizacoes.length > 0) {
            abrirModalProduto(produto);
        } else {
            adicionarAoCarrinho(produto, []);
        }
    });

    return card;
}

async function abrirModalProduto(produto) {
    // Se não tem personalizações carregadas, buscar
    if (!produto.personalizacoes || produto.personalizacoes.length === 0) {
        try {
            const personalizacoes = await api.getPersonalizacoes(produto.id);
            produto.personalizacoes = personalizacoes;
        } catch (error) {
            console.error('Erro ao carregar personalizações:', error);
            produto.personalizacoes = [];
        }
    }

    modalBody.innerHTML = criarConteudoModal(produto);
    produtoModal.classList.remove('hidden');
    produtoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Focar no botão de fechar para acessibilidade
    modalClose.focus();

    // Configurar eventos do modal
    configurarEventosModal(produto);
}

function criarConteudoModal(produto) {
    const temImagem = produto.imagem_url && produto.imagem_url.trim() !== '';

    let personalizacoesHtml = '';
    if (produto.personalizacoes && produto.personalizacoes.length > 0) {
        personalizacoesHtml = produto.personalizacoes.map(grupo => {
            const opcoesHtml = (grupo.opcoes || []).filter(o => o.ativo).map(opcao => `
                <label class="opcao-item">
                    <input type="${grupo.tipo === 'escolha_unica' ? 'radio' : 'checkbox'}"
                           name="pers_${grupo.id}"
                           value="${opcao.id}"
                           data-grupo-id="${grupo.id}"
                           data-grupo-nome="${grupo.nome}"
                           data-opcao-nome="${opcao.nome}"
                           data-preco="${opcao.preco_adicional || 0}"
                           ${grupo.obrigatorio && grupo.tipo === 'escolha_unica' ? 'required' : ''}>
                    <span class="opcao-info">
                        <span class="opcao-nome">${opcao.nome}</span>
                        ${opcao.preco_adicional > 0 ? `<span class="opcao-preco">+ ${formatCurrency(opcao.preco_adicional)}</span>` : ''}
                    </span>
                </label>
            `).join('');

            return `
                <fieldset class="personalizacao-grupo">
                    <legend class="personalizacao-legenda">
                        ${grupo.nome}
                        ${grupo.obrigatorio ? '<span class="required" aria-hidden="true">*</span>' : ''}
                        ${grupo.tipo === 'escolha_multipla' ? `<span class="personalizacao-hint">Máx. ${grupo.max_selecoes} opções</span>` : ''}
                    </legend>
                    <div class="opcoes-list">${opcoesHtml}</div>
                </fieldset>
            `;
        }).join('');
    }

    return `
        <div class="produto-modal">
            <div class="produto-modal-header">
                ${temImagem ? `
                    <img src="${produto.imagem_url}" alt="${produto.nome}" class="produto-modal-image" onerror="this.style.display='none'">
                ` : ''}
                <div class="produto-modal-info">
                    <h3>${produto.nome}</h3>
                    ${produto.descricao ? `<p class="produto-modal-desc">${produto.descricao}</p>` : ''}
                    <p class="produto-modal-preco">${formatCurrency(produto.preco_base)}</p>
                </div>
            </div>

            ${personalizacoesHtml ? `
                <div class="produto-modal-personalizacoes">
                    <h4 class="personalizacao-titulo">Personalize seu pedido</h4>
                    <form id="personalizacaoForm">
                        ${personalizacoesHtml}
                    </form>
                </div>
            ` : ''}

            <div class="produto-modal-actions">
                <button type="button" class="btn btn-secondary btn-block" id="modalCancelar">Cancelar</button>
                <button type="button" class="btn btn-primary btn-block btn-lg" id="modalAdicionar">
                    Adicionar ao Carrinho
                </button>
            </div>
        </div>
    `;
}

function configurarEventosModal(produto) {
    const form = document.getElementById('personalizacaoForm');
    const btnCancelar = document.getElementById('modalCancelar');
    const btnAdicionar = document.getElementById('modalAdicionar');

    btnCancelar.addEventListener('click', fecharModal);
    btnAdicionar.addEventListener('click', () => {
        const personalizacoes = coletarPersonalizacoesSelecionadas(produto);
        if (validarPersonalizacoes(produto, personalizacoes)) {
            adicionarAoCarrinho(produto, personalizacoes);
            fecharModal();
        }
    });

    // Validação em tempo real para grupos obrigatórios
    if (form) {
        form.addEventListener('change', () => {
            const personalizacoes = coletarPersonalizacoesSelecionadas(produto);
            const valido = validarPersonalizacoes(produto, personalizacoes, true);
            btnAdicionar.disabled = !valido;
        });
    }
}

function coletarPersonalizacoesSelecionadas(produto) {
    const form = document.getElementById('personalizacaoForm');
    if (!form) return [];

    const selecionadas = [];
    const inputs = form.querySelectorAll('input:checked');

    inputs.forEach(input => {
        selecionadas.push({
            grupo_id: parseInt(input.dataset.grupoId),
            grupo_nome: input.dataset.grupoNome,
            opcao_id: parseInt(input.value),
            opcao_nome: input.dataset.opcaoNome,
            preco_adicional: parseFloat(input.dataset.preco) || 0
        });
    });

    return selecionadas;
}

function validarPersonalizacoes(produto, selecionadas, silent = false) {
    if (!produto.personalizacoes || produto.personalizacoes.length === 0) return true;

    for (const grupo of produto.personalizacoes) {
        const opcoesGrupo = selecionadas.filter(p => p.grupo_id === grupo.id);

        if (grupo.obrigatorio && opcoesGrupo.length === 0) {
            if (!silent) showToast(`Selecione uma opção para "${grupo.nome}"`, 'warning');
            return false;
        }

        if (grupo.tipo === 'escolha_unica' && opcoesGrupo.length > 1) {
            if (!silent) showToast(`Selecione apenas uma opção para "${grupo.nome}"`, 'warning');
            return false;
        }

        if (grupo.tipo === 'escolha_multipla') {
            if (opcoesGrupo.length < grupo.min_selecoes) {
                if (!silent) showToast(`Selecione pelo menos ${grupo.min_selecoes} opções para "${grupo.nome}"`, 'warning');
                return false;
            }
            if (opcoesGrupo.length > grupo.max_selecoes) {
                if (!silent) showToast(`Selecione no máximo ${grupo.max_selecoes} opções para "${grupo.nome}"`, 'warning');
                return false;
            }
        }
    }

    return true;
}

function adicionarAoCarrinho(produto, personalizacoes) {
    cart.addItem(produto, personalizacoes);
    showToast(`${produto.nome} adicionado ao carrinho!`, 'success');
}

function fecharModal() {
    produtoModal.classList.add('hidden');
    produtoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

function renderizarPaginacao() {
    pagination.innerHTML = '';

    if (totalPaginas <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';

    // Botão anterior
    const btnAnterior = document.createElement('button');
    btnAnterior.className = 'pagination-btn';
    btnAnterior.innerHTML = '&#9664;';
    btnAnterior.setAttribute('aria-label', 'Página anterior');
    btnAnterior.disabled = paginaAtual === 1;
    btnAnterior.addEventListener('click', () => mudarPagina(paginaAtual - 1));
    pagination.appendChild(btnAnterior);

    // Páginas
    const inicio = Math.max(1, paginaAtual - 2);
    const fim = Math.min(totalPaginas, paginaAtual + 2);

    for (let i = inicio; i <= fim; i++) {
        const btn = document.createElement('button');
        btn.className = `pagination-btn ${i === paginaAtual ? 'active' : ''}`;
        btn.textContent = i;
        btn.setAttribute('aria-label', `Página ${i}`);
        btn.setAttribute('aria-current', i === paginaAtual ? 'page' : 'false');
        btn.addEventListener('click', () => mudarPagina(i));
        pagination.appendChild(btn);
    }

    // Botão próximo
    const btnProximo = document.createElement('button');
    btnProximo.className = 'pagination-btn';
    btnProximo.innerHTML = '&#9654;';
    btnProximo.setAttribute('aria-label', 'Próxima página');
    btnProximo.disabled = paginaAtual === totalPaginas;
    btnProximo.addEventListener('click', () => mudarPagina(paginaAtual + 1));
    pagination.appendChild(btnProximo);

    // Info
    const info = document.createElement('span');
    info.className = 'pagination-info';
    info.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
    pagination.insertBefore(info, btnProximo);
}

async function mudarPagina(novaPagina) {
    if (novaPagina < 1 || novaPagina > totalPaginas) return;
    paginaAtual = novaPagina;
    await carregarProdutos();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}