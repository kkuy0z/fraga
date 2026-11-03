import api from './api.js';
import { showToast, showLoading, hideLoading } from './utils.js';

// Elementos do Modal Alterar Senha
const alterarSenhaModal = document.getElementById('alterarSenhaModal');
const alterarSenhaModalClose = document.getElementById('alterarSenhaModalClose');
const alterarSenhaForm = document.getElementById('alterarSenhaForm');
const senhaAtual = document.getElementById('senhaAtual');
const novaSenha = document.getElementById('novaSenha');
const confirmarNovaSenha = document.getElementById('confirmarNovaSenha');
const btnConfirmarAlterarSenha = document.getElementById('btnConfirmarAlterarSenha');
const toggleSenhaAtual = document.getElementById('toggleSenhaAtual');
const toggleNovaSenha = document.getElementById('toggleNovaSenha');
const toggleConfirmarNovaSenha = document.getElementById('toggleConfirmarNovaSenha');

// Verificar se já está logado como admin
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('auth_token');
    const forcePassword = new URLSearchParams(window.location.search).get('forcePassword') === '1';

    if (token && !forcePassword) {
        // Verificar se token é válido
        api.adminVerify()
            .then(() => {
                window.location.href = '/admin-dashboard.html';
            })
            .catch(() => {
                // Token inválido, limpar e ficar na página de login
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_user');
            });
    } else if (forcePassword) {
        // Força troca de senha - abrir modal
        abrirModalAlterarSenha();
    }

    configurarEventListeners();
});

function configurarEventListeners() {
    // Toggle senha login
    const toggleSenha = document.getElementById('toggleSenha');
    const senhaInput = document.getElementById('senha');

    if (toggleSenha && senhaInput) {
        toggleSenha.addEventListener('click', () => togglePasswordVisibility(senhaInput, toggleSenha));
    }

    // Form submit login
    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
        formLogin.addEventListener('submit', handleLogin);
    }

    // Link esqueci senha
    document.querySelectorAll('a[data-pendente]').forEach(a => a.addEventListener('click', e => e.preventDefault()));

    // Modal alterar senha
    if (alterarSenhaModalClose) alterarSenhaModalClose.addEventListener('click', fecharModalAlterarSenha);
    if (alterarSenhaModal) {
        alterarSenhaModal.addEventListener('click', (e) => {
            if (e.target === alterarSenhaModal) fecharModalAlterarSenha();
        });
    }
    if (alterarSenhaForm) alterarSenhaForm.addEventListener('submit', handleAlterarSenha);

    // Toggle senhas modal
    if (toggleSenhaAtual) toggleSenhaAtual.addEventListener('click', () => togglePasswordVisibility(senhaAtual, toggleSenhaAtual));
    if (toggleNovaSenha) toggleNovaSenha.addEventListener('click', () => togglePasswordVisibility(novaSenha, toggleNovaSenha));
    if (toggleConfirmarNovaSenha) toggleConfirmarNovaSenha.addEventListener('click', () => togglePasswordVisibility(confirmarNovaSenha, toggleConfirmarNovaSenha));

    // Fechar modal com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !alterarSenhaModal?.classList.contains('hidden')) {
            fecharModalAlterarSenha();
        }
    });
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

        // Verificar se força troca de senha
        if (data.forca_troca_senha || (data.usuario && data.usuario.forca_troca_senha)) {
            // Salvar token mas redirecionar para alterar senha
            api.setAuth(data.token, data.usuario);
            showToast('Primeiro acesso: altere sua senha', 'warning');
            setTimeout(() => {
                window.location.href = '/admin-login.html?forcePassword=1';
            }, 1000);
            return;
        }

        // Salvar token e dados do usuário
        api.setAuth(data.token, data.usuario);

        showToast('Login realizado com sucesso!', 'success');

        // Redirecionar para dashboard
        setTimeout(() => {
            window.location.href = '/admin-dashboard.html';
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

function abrirModalAlterarSenha() {
    if (alterarSenhaModal) {
        alterarSenhaForm.reset();
        alterarSenhaModal.classList.remove('hidden');
        alterarSenhaModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        senhaAtual.focus();
    }
}

function fecharModalAlterarSenha() {
    if (alterarSenhaModal) {
        alterarSenhaModal.classList.add('hidden');
        alterarSenhaModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
}

async function handleAlterarSenha(e) {
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

        // Redirecionar para dashboard após sucesso
        setTimeout(() => {
            window.location.href = '/admin-dashboard.html';
        }, 1000);

    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        showToast(error.message || 'Erro ao alterar senha', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
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