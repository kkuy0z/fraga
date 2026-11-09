/**
 * Cadastro de Cliente - Fraga Lanches
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
    nome: v => {
        const val = v.trim();
        if (!val) return 'Informe seu nome completo.';
        if (!/^[A-Za-zÀ-ÿ\s]+$/.test(val)) return 'O nome deve conter apenas letras e espaços.';
        if (!/^\S+(\s+\S+)+$/.test(val)) return 'Informe seu nome completo (nome e sobrenome).';
        if (val.length < 5) return 'Nome muito curto.';
        if (val.length > 80) return 'Nome muito longo (máx. 80 caracteres).';
        return '';
    },
    email: v => {
        const val = v.trim().toLowerCase();
        if (!val) return 'Informe seu e-mail.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) return 'Digite um e-mail válido (ex: nome@exemplo.com).';
        if (val.length > 120) return 'E-mail muito longo (máx. 120 caracteres).';
        return '';
    },
    telefone: v => {
        const nums = v.replace(/\D/g, '');
        if (!nums) return 'Informe seu telefone.';
        if (nums.length !== 10 && nums.length !== 11) return 'Digite DDD + número (ex: (31) 98767-7197).';
        // Validar DDD (11-99)
        const ddd = parseInt(nums.substring(0, 2), 10);
        if (ddd < 11 || ddd > 99) return 'DDD inválido.';
        // Se 11 dígitos, deve começar com 9 (celular)
        if (nums.length === 11 && nums[2] !== '9') return 'Número de celular deve começar com 9.';
        return '';
    },
    senha: v => {
        if (!v) return 'Crie uma senha.';
        if (v.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
        if (v.length > 64) return 'Senha muito longa (máx. 64 caracteres).';
        return '';
    },
    confirmar: (v, form) => {
        if (!v) return 'Confirme sua senha.';
        if (v !== form.elements.senha.value) return 'As senhas não coincidem.';
        return '';
    },
    termos: (v, form, el) => el.checked ? '' : 'Aceite os Termos de Uso e a Política de Privacidade para continuar.'
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

/* ---------- Máscara de Telefone ---------- */
function initTelefoneMask() {
    const tel = $('#telefone');
    if (!tel) return;

    tel.addEventListener('input', e => {
        const nums = e.target.value.replace(/\D/g, '').slice(0, 11);
        e.target.value = nums.length > 6
            ? `(${nums.slice(0, 2)}) ${nums.slice(2, -4)}-${nums.slice(-4)}`
            : nums.length > 2
                ? `(${nums.slice(0, 2)}) ${nums.slice(2)}`
                : nums ? `(${nums}` : '';
    });
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

/* ---------- Links Pendentes (Termos/Política) ---------- */
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
    btnSubmit.innerHTML = '<svg class="cad-ic" aria-hidden="true"><use href="#i-user" /></svg>Criando conta...';
    showLoading('Criando sua conta...');

    try {
        const dados = {
            nome: form.elements.nome.value.trim(),
            email: form.elements.email.value.trim(),
            telefone: form.elements.telefone.value.replace(/\D/g, ''),
            senha: form.elements.senha.value,
            termosAceitos: form.elements.termos.checked
        };

        const data = await api.clienteRegister(dados);

        // Sucesso - salvar token e redirecionar
        localStorage.setItem('cliente_token', data.token);
        localStorage.setItem('cliente_user', JSON.stringify(data.cliente));

        showToast('Conta criada com sucesso! Bem-vindo ao Fraga Lanches!', 'success');

        // Limpar formulário
        form.reset();
        $$('.campo', form).forEach(c => {
            c.classList.remove('valido', 'invalido');
            delete c.querySelector('input')?.dataset.tocado;
            c.querySelector('input')?.removeAttribute('aria-invalid');
        });

        setTimeout(() => window.location.href = '/inicio/meus-pedidos.html', 1500);

    } catch (error) {
        console.error('Erro no cadastro:', error);

        if (error.message.includes('E-mail já cadastrado')) {
            marcarErro('email', 'Este e-mail já está cadastrado.');
        } else if (error.message.includes('Telefone já cadastrado')) {
            marcarErro('telefone', 'Este telefone já está cadastrado.');
        } else {
            showToast(error.message || 'Erro ao criar conta. Tente novamente.', 'error');
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
                // Se senha mudou, revalidar confirmação
                if (el.id === 'senha' && $('#confirmar').dataset.tocado) {
                    validarCampo($('#confirmar'), form);
                }
            }
            $('#sucesso').hidden = true;
        });
    });
}

/* ---------- Inicialização ---------- */
document.addEventListener('DOMContentLoaded', () => {
    const form = $('#form-cadastro');

    initMobileMenu();
    initTelefoneMask();
    initPasswordToggle();
    initPendingLinks();
    initLiveValidation(form);
    verificarAuth();

    form.addEventListener('submit', handleSubmit);
});