import api from './api.js';
import cart from './cart.js';
import { formatCurrency, showToast, showLoading, hideLoading } from './utils.js';

// Função para decodificar JWT e obter payload
function decodificarJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

// Elementos DOM
const carrinhoLista = document.getElementById('carrinhoLista');
const carrinhoVazio = document.getElementById('carrinhoVazio');
const carrinhoAcoes = document.getElementById('carrinhoAcoes');
const cartCount = document.getElementById('cartCount');
const resumoSubtotal = document.getElementById('resumoSubtotal');
const resumoTaxaEntrega = document.getElementById('resumoTaxaEntrega');
const resumoDesconto = document.getElementById('resumoDesconto');
const resumoTotal = document.getElementById('resumoTotal');
const btnFinalizar = document.getElementById('btnFinalizar');
const btnLimparCarrinho = document.getElementById('btnLimparCarrinho');

let taxaEntrega = 0;
let valorMinimoPedido = 0;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await carregarConfigEntrega();
    renderizarCarrinho();
    configurarEventListeners();
    atualizarContadorCarrinho();
    verificarAuth();
});

async function carregarConfigEntrega() {
    try {
        const config = await api.getConfigEntrega();
        taxaEntrega = config.taxa_entrega || 0;
        valorMinimoPedido = config.valor_minimo_pedido || 0;
    } catch (error) {
        console.error('Erro ao carregar config de entrega:', error);
    }
}

function configurarEventListeners() {
    // Atualizar quando carrinho mudar
    cart.subscribe(() => {
        renderizarCarrinho();
        atualizarContadorCarrinho();
    });

    // Limpar carrinho
    btnLimparCarrinho.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja limpar o carrinho?')) {
            cart.clear();
            showToast('Carrinho limpo', 'info');
        }
    });

    // Botão finalizar - redireciona para checkout
    btnFinalizar.addEventListener('click', () => {
        window.location.href = 'checkout.html';
    });
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
        userButton.style.display = 'flex';
        userName.textContent = clienteUser.nome;
        userAvatar.textContent = clienteUser.nome.charAt(0).toUpperCase();
        adminLink.style.display = 'none';

        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('cliente_token');
            localStorage.removeItem('cliente_user');
            showToast('Logout realizado com sucesso', 'success');
            setTimeout(() => window.location.reload(), 1000);
        });
    } else if (token && user) {
        // Admin logado - verificar role
        const payload = decodificarJWT(token);
        const isAdmin = payload && payload.role === 'administrador';

        userButton.style.display = 'flex';
        userName.textContent = user.nome;
        userAvatar.textContent = user.nome.charAt(0).toUpperCase();
        adminLink.style.display = isAdmin ? 'inline-flex' : 'none';

        logoutBtn.addEventListener('click', () => {
            api.clearAuth();
            showToast('Logout realizado com sucesso', 'success');
            setTimeout(() => window.location.reload(), 1000);
        });
    } else {
        userButton.style.display = 'none';
        adminLink.style.display = 'none';
    }
}

function atualizarContadorCarrinho() {
    const total = cart.getTotalItems();
    cartCount.textContent = total;
    cartCount.style.display = total > 0 ? 'flex' : 'none';
}

function renderizarCarrinho() {
    const itens = cart.getItems();

    if (itens.length === 0) {
        carrinhoLista.innerHTML = '';
        carrinhoVazio.classList.remove('hidden');
        carrinhoAcoes.classList.add('hidden');
        btnFinalizar.disabled = true;
        atualizarResumo(0);
        return;
    }

    carrinhoVazio.classList.add('hidden');
    carrinhoAcoes.classList.remove('hidden');
    btnFinalizar.disabled = false;

    carrinhoLista.innerHTML = '';

    itens.forEach(item => {
        const elemento = criarItemCarrinho(item);
        carrinhoLista.appendChild(elemento);
    });

    const subtotal = cart.getSubtotal();
    atualizarResumo(subtotal);
}

function criarItemCarrinho(item) {
    const div = document.createElement('div');
    div.className = 'card';
    div.style.padding = '0';
    div.style.display = 'grid';
    div.style.gridTemplateColumns = '100px 1fr auto';
    div.style.gap = '16px';
    div.style.alignItems = 'center';
    div.setAttribute('role', 'listitem');

    const temImagem = item.imagem_url && item.imagem_url.trim() !== '';

    // Calcular total do item
    const personalizacoesTotal = (item.personalizacoes || []).reduce(
        (sum, p) => sum + (p.preco_adicional || 0) * item.quantidade, 0
    );
    const itemTotal = (item.preco_base * item.quantidade) + personalizacoesTotal;

    div.innerHTML = `
        <div class="carrinho-item-imagem" style="width: 100px; height: 80px; border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-elevated); display: flex; align-items: center; justify-content: center;">
            ${temImagem ? `
                <img src="${item.imagem_url}" alt="${item.nome}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div style="display:none; color: var(--text-muted);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg></div>
            ` : `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg>
            `}
        </div>

        <div class="carrinho-item-info">
            <h4 class="carrinho-item-nome" style="font-family: var(--font-title); font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">${item.nome}</h4>
            <div class="carrinho-item-detalhes" style="font-size: 13px; color: var(--text-muted); line-height: 1.8;">
                <span>${formatCurrency(item.preco_base)} x ${item.quantidade}</span>
                ${item.personalizacoes && item.personalizacoes.length > 0 ? `
                    <span>${item.personalizacoes.map(p => `${p.opcao_nome}${p.preco_adicional > 0 ? ` (+${formatCurrency(p.preco_adicional)})` : ''}`).join(', ')}</span>
                ` : ''}
            </div>
        </div>

        <div class="carrinho-item-controles" style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
            <div class="quantity-control" style="display: flex; align-items: center; gap: 8px; background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 4px 8px;">
                <button class="qty-btn" data-action="decrement" data-key="${item.key}" aria-label="Diminuir quantidade" style="background: none; border: none; color: var(--text-primary); font-size: 18px; cursor: pointer; padding: 4px; line-height: 1; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">−</button>
                <span class="qty-value" style="font-family: var(--font-display); font-size: 16px; min-width: 24px; text-align: center;">${item.quantidade}</span>
                <button class="qty-btn" data-action="increment" data-key="${item.key}" aria-label="Aumentar quantidade" style="background: none; border: none; color: var(--text-primary); font-size: 18px; cursor: pointer; padding: 4px; line-height: 1; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">+</button>
            </div>
            <span class="carrinho-item-total" style="font-family: var(--font-display); font-size: 18px; color: var(--accent);">${formatCurrency(itemTotal)}</span>
            <button class="btn-remover" data-key="${item.key}" aria-label="Remover ${item.nome}" style="background: none; border: none; color: var(--text-muted); font-size: 13px; cursor: pointer; padding: 4px; transition: color 0.2s;">Remover</button>
        </div>
    `;

    // Eventos dos botões de quantidade
    div.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const key = btn.dataset.key;
            if (action === 'increment') cart.increment(key);
            else if (action === 'decrement') cart.decrement(key);
        });
    });

    // Evento remover
    div.querySelector('.btn-remover').addEventListener('click', () => {
        cart.removeItem(div.dataset.key || item.key);
        showToast(`${item.nome} removido do carrinho`, 'info');
    });

    // Guardar key no elemento para remoção
    div.dataset.key = item.key;

    return div;
}

function atualizarResumo(subtotal) {
    const total = subtotal + taxaEntrega;

    resumoSubtotal.textContent = formatCurrency(subtotal);
    resumoTaxaEntrega.textContent = taxaEntrega > 0 ? formatCurrency(taxaEntrega) : 'Grátis';
    resumoDesconto.textContent = formatCurrency(0);
    resumoTotal.textContent = formatCurrency(total);

    // Verificar valor mínimo
    if (valorMinimoPedido > 0 && subtotal < valorMinimoPedido) {
        btnFinalizar.disabled = true;
        btnFinalizar.textContent = `Mínimo ${formatCurrency(valorMinimoPedido)} para entrega`;
        btnFinalizar.classList.add('btn-secondary');
        btnFinalizar.classList.remove('btn-primary');
    } else {
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = 'Finalizar Pedido';
        btnFinalizar.classList.add('btn-primary');
        btnFinalizar.classList.remove('btn-secondary');
    }
}