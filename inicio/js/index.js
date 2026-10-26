import cart from './cart.js';
import api from './api.js';
import { showToast } from './utils.js';

// Elementos DOM
const cartCount = document.getElementById('cartCount');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    atualizarContadorCarrinho();
    verificarAuth();
    configurarEventListeners();
});

function configurarEventListeners() {
    // Atualizar contador do carrinho quando mudar
    cart.subscribe(atualizarContadorCarrinho);

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
        if (userButton) userButton.style.display = 'flex';
        if (userName) userName.textContent = clienteUser.nome;
        if (userAvatar) userAvatar.textContent = clienteUser.nome.charAt(0).toUpperCase();
        if (adminLink) adminLink.style.display = 'none';
    } else if (token && user) {
        // Admin logado
        if (userButton) userButton.style.display = 'flex';
        if (userName) userName.textContent = user.nome;
        if (userAvatar) userAvatar.textContent = user.nome.charAt(0).toUpperCase();
        if (adminLink) adminLink.style.display = 'inline-flex';
    } else {
        // Não logado
        if (userButton) userButton.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
    }
}

function handleLogout() {
    const clienteToken = localStorage.getItem('cliente_token');
    const token = localStorage.getItem('auth_token');

    if (clienteToken) {
        localStorage.removeItem('cliente_token');
        localStorage.removeItem('cliente_user');
    } else if (token) {
        api.clearAuth();
    }

    showToast('Logout realizado com sucesso', 'success');
    setTimeout(() => window.location.reload(), 1000);
}