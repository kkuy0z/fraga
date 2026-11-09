/**
 * Login de Cliente - Fraga Lanches
 * Integração com backend via API
 */
import api from '../inicio/js/api.js';
import { showToast, showLoading, hideLoading } from '../inicio/js/utils.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);

/* ---------- Menu Mobile ---------- */
function initMobileMenu() {
    const header = $('.header-fixed');
    const btn = $('#menu-mobile');
    const nav = $('#navMenu');

    if (!btn || !nav) return;

    const toggle = (open) => {
        nav.classList.toggle('active', open);
        btn.setAttribute('aria-expanded', open);
        btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    };

    btn.addEventListener('click', () => toggle(!nav.classList.contains('active')));
    nav.addEventListener('click', e => e.target.closest('a') && toggle(false));
    document.addEventListener('click', e => !header?.contains(e.target) && toggle(false));
    document.addEventListener('keydown', e => e.key === 'Escape' && toggle(false));
}

/* ---------- Regras de Validação ---------- */
const REGRAS = {
    email: v => {
        const val = v.trim();
        if (!val) return 'Informe seu e-mail.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) return 'Digite um e-mail válido (ex: nome@exemplo.com).';
        return '';
    },
    senha: v => {
        if (!v) return 'Digite sua senha.';
        return '';
    }
};

/* ---------- Validação de Campo ---------- */
function validarCampo(el, form) {
    const caixa = el.closest('.campo');
    const msg = REGRAS[el.id](el.value, form, el);
    const invalido = !!msg;

    caixa.classList.toggle('invalido', invalido);
    caixa.classList.toggle('valido', !invalido);
    el.setAttribute('aria-invalid', invalido);
    $('.erro', caixa).textContent = msg;

    // Ocultar ajuda quando inválido
    if (invalido) {
        const ajuda = $('.ajuda', caixa);
        if (ajuda) ajuda.style.display = 'none';
    }

    return !invalido;
}

/* ---------- Mostrar/Ocultar Senha ---------- */
function initPasswordToggle() {
    $$('.ver-senha').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = $('#' + btn.dataset.alvo);
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.setAttribute('aria-pressed', show);
            btn.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
            $('use', btn).setAttribute('href', show ? '#i-eye-off' : '#i-eye');
        });
    });
}

/* ---------- Links Pendentes (Esqueci a senha) ---------- */
function initPendingLinks() {
    $$('a[data-pendente]').forEach(a => a.addEventListener('click', e => e.preventDefault()));
}

/* ---------- Verificar Autenticação (Header) ---------- */
async function verificarAuth() {
    const clienteToken = localStorage.getItem('cliente_token');
    const clienteUser = JSON.parse(localStorage.getItem('cliente_user') || 'null');
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('auth_user') || 'null');

    const userButton = $('#userButton');
    const userName = $('#userName');
    const userAvatar = $('#userAvatar');
    const adminLink = $('#adminLink');
    const loginLink = $('#loginLink');

    if (clienteToken && clienteUser) {
        if (userButton) userButton.style.display = 'flex';
        if (userName) userName.textContent = clienteUser.nome;
        if (userAvatar) userAvatar.textContent = clienteUser.nome.charAt(0).toUpperCase();
        if (adminLink) adminLink.style.display = 'none';
        if (loginLink) loginLink.style.display = 'none';
    } else if (token && user) {
        const payload = decodificarJWT(token);
        const isAdmin = payload && payload.role === 'administrador';
        if (userButton) userButton.style.display = 'flex';
        if (userName) userName.textContent = user.nome;
        if (userAvatar) userAvatar.textContent = user.nome.charAt(0).toUpperCase();
        if (adminLink) adminLink.style.display = isAdmin ? 'inline-flex' : 'none';
        if (loginLink) loginLink.style.display = 'none';
    } else {
        if (userButton) userButton.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
        if (loginLink) loginLink.style.display = 'inline-flex';
    }
}

function decodificarJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

/* ---------- Submit do Formulário ---------- */
async function handleSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const btnSubmit = form.querySelector('.cad-enviar');
    const originalHTML = btnSubmit.innerHTML;

    // Marcar todos como tocados e validar
    $$('.campo input, .campo select', form).forEach(el => el.dataset.tocado = '1');
    const campos = Object.keys(REGRAS).map(id => $('#' + id));
    const invalidos = campos.filter(el => !validarCampo(el, form));

    if (invalidos.length) {
        invalidos[0].focus();
        return;
    }

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg class="cad-ic" aria-hidden="true"><use href="#i-lock" /></svg>Entrando...';
    showLoading('Entrando na sua conta...');

    try {
        const email = form.elements.email.value.trim();
        const senha = form.elements.senha.value;
        const lembrar = form.elements.lembrar?.checked || false;

        const data = await api.clienteLogin(email, senha);

        // Sucesso - salvar token e redirecionar
        localStorage.setItem('cliente_token', data.token);
        localStorage.setItem('cliente_user', JSON.stringify(data.cliente));

        // Se não marcar "lembrar-me", token expira ao fechar o navegador (sessionStorage)
        if (!lembrar) {
            sessionStorage.setItem('cliente_token', data.token);
            sessionStorage.setItem('cliente_user', JSON.stringify(data.cliente));
            localStorage.removeItem('cliente_token');
            localStorage.removeItem('cliente_user');
        }

        showToast(`Bem-vindo de volta, ${data.cliente.nome}!`, 'success');

        // Redirecionar para página anterior ou meus-pedidos
        const redirect = sessionStorage.getItem('redirectAfterLogin') || '/inicio/meus-pedidos.html';
        sessionStorage.removeItem('redirectAfterLogin');
        setTimeout(() => window.location.href = redirect, 1000);

    } catch (error) {
        console.error('Erro no login:', error);

        if (error.message.includes('E-mail ou senha inválidos') || error.message.includes('Credenciais inválidas')) {
            marcarErro('senha', 'E-mail ou senha incorretos. Tente novamente.');
        } else if (error.message.includes('conta não confirmada') || error.message.includes('não verificada')) {
            showToast('Sua conta precisa ser verificada. Verifique seu e-mail.', 'warning');
        } else {
            showToast(error.message || 'Erro ao entrar. Tente novamente.', 'error');
        }
    } finally {
        hideLoading();
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalHTML;
    }
}

function marcarErro(campoId, msg) {
    const caixa = $('#' + campoId).closest('.campo');
    caixa.classList.add('invalido');
    caixa.classList.remove('valido');
    $('#' + campoId).setAttribute('aria-invalid', 'true');
    $('.erro', caixa).textContent = msg;
    $('#' + campoId).focus();
}

/* ---------- Validação em Tempo Real ---------- */
function initLiveValidation(form) {
    const campos = Object.keys(REGRAS).map(id => $('#' + id));

    campos.forEach(el => {
        // Validar ao sair do campo (blur)
        el.addEventListener('blur', () => {
            if (el.value || el.dataset.tocado) {
                el.dataset.tocado = '1';
                validarCampo(el, form);
            }
        });

        // Revalidar enquanto digita (após tocar)
        el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
            if (el.dataset.tocado || el.type === 'checkbox') {
                validarCampo(el, form);
            }
        });
    });
}

/* ---------- Inicialização ---------- */
document.addEventListener('DOMContentLoaded', () => {
    const form = $('#form-login');

    initMobileMenu();
    initPasswordToggle();
    initPendingLinks();
    initLiveValidation(form);
    verificarAuth();

    form.addEventListener('submit', handleSubmit);
});