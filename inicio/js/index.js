import cart from './cart.js';
import api from './api.js';
import { showToast } from './utils.js';

// Elementos DOM
const cartCount = document.getElementById('cartCount');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.querySelector('.status-text');
const statusIndicator = document.querySelector('.status-indicator');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    atualizarContadorCarrinho();
    verificarAuth();
    configurarEventListeners();
    verificarStatusEstabelecimento();
    // Verificar status a cada 30 segundos
    setInterval(verificarStatusEstabelecimento, 30000);
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

async function verificarStatusEstabelecimento() {
    if (!statusBadge) return;

    try {
        const response = await api.getStatusFuncionamento();

        statusBadge.classList.remove('hidden', 'verificando');
        statusBadge.classList.remove('aberto', 'fechado');

        if (response.aberto) {
            statusBadge.classList.add('aberto');
            statusText.textContent = 'ABERTO AGORA';
            statusIndicator.style.backgroundColor = '#4caf50';
        } else {
            statusBadge.classList.add('fechado');
            const horarioAtual = response.horario_atual ? ` (${response.horario_atual})` : '';
            statusText.textContent = `FECHADO${horarioAtual}`;
            statusIndicator.style.backgroundColor = '#ff6b6b';
        }
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        statusBadge.classList.remove('hidden');
        statusBadge.classList.add('verificando');
        statusText.textContent = 'Verificando status...';
    }
}

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
        // Admin logado - verificar role
        const payload = decodificarJWT(token);
        const isAdmin = payload && payload.role === 'administrador';

        if (userButton) userButton.style.display = 'flex';
        if (userName) userName.textContent = user.nome;
        if (userAvatar) userAvatar.textContent = user.nome.charAt(0).toUpperCase();
        if (adminLink) adminLink.style.display = isAdmin ? 'inline-flex' : 'none';
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