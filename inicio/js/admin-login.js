import api from './api.js';
import { showToast, showLoading, hideLoading } from './utils.js';

// Verificar se já está logado como admin
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        // Verificar se token é válido
        api.adminVerify()
            .then(() => {
                window.location.href = '/inicio/admin-dashboard.html';
            })
            .catch(() => {
                // Token inválido, limpar e ficar na página de login
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
            });
    }

    configurarEventListeners();
});

function configurarEventListeners() {
    // Toggle senha
    const toggleSenha = document.getElementById('toggleSenha');
    const senhaInput = document.getElementById('senha');

    if (toggleSenha && senhaInput) {
        toggleSenha.addEventListener('click', () => {
            const mostrar = senhaInput.type === 'password';
            senhaInput.type = mostrar ? 'text' : 'password';
            toggleSenha.setAttribute('aria-pressed', mostrar);
            toggleSenha.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
            const svg = toggleSenha.querySelector('svg');
            if (mostrar) {
                svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
            } else {
                svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
            }
        });
    }

    // Form submit
    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
        formLogin.addEventListener('submit', handleLogin);
    }

    // Link esqueci senha
    document.querySelectorAll('a[data-pendente]').forEach(a => a.addEventListener('click', e => e.preventDefault()));
}

async function handleLogin(e) {
    e.preventDefault();

    const form = e.target;
    const email = form.elements.email.value.trim();
    const senha = form.elements.senha.value;
    const lembrar = form.elements.lembrar.checked;

    if (!email || !senha) {
        showToast('Preencha todos os campos', 'warning');
        return;
    }

    const btnLogin = document.getElementById('btnLogin');
    const originalText = btnLogin.innerHTML;
    btnLogin.disabled = true;
    btnLogin.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg> Entrando...';
    showLoading('Verificando credenciais...');

    try {
        const data = await api.adminLogin(email, senha);

        // Salvar token e dados do usuário
        api.setAuth(data.token, data.usuario);

        // Se não marcar "lembrar", o token expira ao fechar o navegador (sessionStorage)
        // Mas por simplicidade, usamos localStorage sempre
        // O backend já define expiração do JWT (24h)

        showToast('Login realizado com sucesso!', 'success');

        // Redirecionar para dashboard
        setTimeout(() => {
            window.location.href = '/inicio/admin-dashboard.html';
        }, 1000);

    } catch (error) {
        console.error('Erro no login:', error);
        showToast(error.message || 'E-mail ou senha inválidos', 'error');
    } finally {
        hideLoading();
        btnLogin.disabled = false;
        btnLogin.innerHTML = originalText;
    }
}