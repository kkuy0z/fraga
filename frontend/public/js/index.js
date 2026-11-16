import cart from './cart.js';
import api from './api.js';
import { showToast } from './utils.js';
import { verificarAuth, handleLogout } from './shared-components.js';

// Elementos DOM
const cartCount = document.getElementById('cartCount');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.querySelector('.status-text');
const statusIndicator = document.querySelector('.status-indicator');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    atualizarContadorCarrinho();
    configurarEventListeners();
    verificarStatusEstabelecimento();
    // Verificar status a cada 30 segundos
    setInterval(verificarStatusEstabelecimento, 30000);
});

function configurarEventListeners() {
    // Atualizar contador do carrinho quando mudar
    cart.subscribe(atualizarContadorCarrinho);
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

    // Mostrar estado inicial de verificação apenas na primeira vez
    const isFirstCheck = statusBadge.classList.contains('hidden') || statusBadge.classList.contains('verificando');
    if (isFirstCheck) {
        statusBadge.classList.remove('hidden');
        statusBadge.classList.add('verificando');
        statusText.textContent = 'Verificando horário de funcionamento...';
    }

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
            const horarioAtual = response.horario_atual ? ` - Abre ${response.horario_atual}` : '';
            statusText.textContent = `FECHADO${horarioAtual}`;
            statusIndicator.style.backgroundColor = '#ff6b6b';
        }
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        statusBadge.classList.remove('hidden');
        statusBadge.classList.add('verificando');
        statusText.textContent = 'Não foi possível verificar o status. Tente recarregar a página.';
    }
}

// verificarAuth is now centralized in shared-components.js
// and called automatically by initHeader

// handleLogout is imported from shared-components.js