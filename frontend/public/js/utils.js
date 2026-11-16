/**
 * Funções utilitárias compartilhadas
 */

// Formatar moeda brasileira
export function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

// Formatar data brasileira
export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Formatar apenas data
export function formatDateOnly(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(date);
}

// Mostrar toast notification
export function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Fechar">×</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => toast.remove());

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('show'));

    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);

    return toast;
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// Loading overlay
export function showLoading(message = 'Carregando...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <p class="loading-message">${message}</p>
        `;
        document.body.appendChild(overlay);
    }
    overlay.querySelector('.loading-message').textContent = message;
    overlay.classList.add('show');
    return overlay;
}

export function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

// Validar CEP
export function validateCEP(cep) {
    const clean = cep.replace(/\D/g, '');
    return clean.length === 8;
}

// Formatar CEP
export function formatCEP(cep) {
    const clean = cep.replace(/\D/g, '');
    if (clean.length <= 5) return clean;
    return `${clean.slice(0, 5)}-${clean.slice(5, 8)}`;
}

// Validar telefone
export function validatePhone(phone) {
    const clean = phone.replace(/\D/g, '');
    return clean.length >= 10 && clean.length <= 11;
}

// Formatar telefone
export function formatPhone(phone) {
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11) {
        return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    }
    if (clean.length === 10) {
        return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    }
    return phone;
}

// Debounce
export function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

// Escape HTML para prevenir XSS
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Formatar data/hora brasileira
export function formatDateTime(dateString) {
    if (!dateString) return '—';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateString;
    }
}

// Gerar ID único simples
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Obter parâmetros da URL
export function getUrlParams() {
    return new URLSearchParams(window.location.search);
}

// Status do pedido em português
export function getStatusLabel(status) {
    const labels = {
        'pendente': 'Pendente',
        'confirmado': 'Confirmado',
        'preparo': 'Em Preparo',
        'preparando': 'Preparando',
        'pronto': 'Pronto',
        'entrega': 'Saiu para Entrega',
        'saiu_entrega': 'Saiu para Entrega',
        'entregue': 'Entregue',
        'cancelado': 'Cancelado'
    };
    return labels[status] || status;
}

// CSS class para status (usa classes de badge do design system)
export function getStatusClass(status) {
    const classes = {
        'pendente': 'badge-warning',
        'confirmado': 'badge-info',
        'preparo': 'badge-info',
        'preparando': 'badge-info',
        'pronto': 'badge-info',
        'entrega': 'badge-primary',
        'saiu_entrega': 'badge-primary',
        'entregue': 'badge-success',
        'cancelado': 'badge-danger'
    };
    return classes[status] || 'badge-neutral';
}