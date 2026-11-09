/* Tela de login: integração com backend via API */
import api from '../inicio/js/api.js';
import { showToast, showLoading, hideLoading } from '../inicio/js/utils.js';

const $ = (s, c = document) => c.querySelector(s);

/* ---------- Menu mobile (mesmo comportamento da página inicial) ---------- */
const header = $('.header'), botao = $('#menu-mobile'), nav = $('#nav');
function menu(aberto) {
  nav.classList.toggle('active', aberto);
  botao.setAttribute('aria-expanded', aberto);
  botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
}
botao.addEventListener('click', () => menu(!nav.classList.contains('active')));
nav.addEventListener('click', e => { if (e.target.closest('a')) menu(false); });
document.addEventListener('click', e => { if (!header.contains(e.target)) menu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') menu(false); });

/* ---------- Regras de validação ---------- */
const REGRAS = {
  email: v => !v.trim() ? 'Informe seu e-mail.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Digite um e-mail válido, como nome@exemplo.com.',
  senha: v => !v ? 'Informe sua senha.' : ''
};

const form = $('#form-login'), sucesso = $('#sucesso');
const campos = Object.keys(REGRAS).map(id => $('#' + id));

function validar(el) {
  const caixa = el.closest('.campo');
  const msg = REGRAS[el.id](el.value, form, el);
  caixa.classList.toggle('invalido', !!msg);
  caixa.classList.toggle('valido', !msg);
  el.setAttribute('aria-invalid', !!msg);
  $('.erro', caixa).textContent = msg;
  return !msg;
}

/* Valida ao sair do campo; depois de tocado, revalida enquanto digita. */
campos.forEach(el => {
  el.addEventListener('blur', () => { if (el.value || el.dataset.tocado) { el.dataset.tocado = 1; validar(el); } });
  el.addEventListener('input', () => {
    if (el.dataset.tocado) validar(el);
    sucesso.hidden = true;
  });
});

/* Links "Esqueci a senha" ainda não têm página: evita "pular" para o topo. */
document.querySelectorAll('a[data-pendente]').forEach(a => a.addEventListener('click', e => e.preventDefault()));

/* ---------- Mostrar / ocultar senha ---------- */
document.querySelectorAll('.ver-senha').forEach(b => b.addEventListener('click', () => {
  const input = $('#' + b.dataset.alvo), mostrar = input.type === 'password';
  input.type = mostrar ? 'text' : 'password';
  b.setAttribute('aria-pressed', mostrar);
  b.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
  $('use', b).setAttribute('href', mostrar ? '#i-eye-off' : '#i-eye');
}));

/* ---------- Verificar se já está logado ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('cliente_token');
  if (token) {
    // Verificar se token é válido
    api.clienteVerify()
      .then(() => {
        window.location.href = '/inicio/meus-pedidos.html';
      })
      .catch(() => {
        // Token inválido, limpar e ficar na página de login
        localStorage.removeItem('cliente_token');
        localStorage.removeItem('cliente_user');
      });
  }
});

/* ---------- Envio para Backend ---------- */
form.addEventListener('submit', async e => {
  e.preventDefault();
  campos.forEach(el => { el.dataset.tocado = 1; });
  const invalidos = campos.filter(el => !validar(el));
  if (invalidos.length) { sucesso.hidden = true; invalidos[0].focus(); return; }

  const btnSubmit = form.querySelector('.cad-enviar');
  const btnText = btnSubmit.innerHTML;

  // Desabilitar botão e mostrar loading
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<svg class="cad-ic" aria-hidden="true"><use href="#i-login" /></svg>Entrando...';
  showLoading('Verificando credenciais...');

  try {
    const dados = {
      email: form.elements.email.value.trim(),
      senha: form.elements.senha.value,
      lembrar: form.elements.lembrar.checked
    };

    // Chamar API do backend via módulo api
    const data = await api.clienteLogin(dados);

    // Sucesso! Salvar token e dados do cliente
    localStorage.setItem('cliente_token', data.token);
    localStorage.setItem('cliente_user', JSON.stringify(data.cliente));

    // Mostrar sucesso
    sucesso.hidden = false;
    sucesso.focus();
    showToast('Login realizado com sucesso! Bem-vindo de volta!', 'success');

    // Redirecionar após 1.5 segundos
    setTimeout(() => {
      window.location.href = '/inicio/meus-pedidos.html';
    }, 1500);

  } catch (error) {
    console.error('Erro no login:', error);
    // Tratar erros específicos do backend
    if (error.message.includes('E-mail não encontrado') || error.message.includes('Senha incorreta') || error.message.includes('Credenciais inválidas')) {
      const caixa = $('#email').closest('.campo');
      caixa.classList.add('invalido');
      caixa.classList.remove('valido');
      $('#email').setAttribute('aria-invalid', 'true');
      $('.erro', caixa).textContent = 'E-mail ou senha incorretos.';
      $('#email').focus();
    } else if (error.message.includes('Conta desativada')) {
      showToast('Esta conta foi desativada. Entre em contato com o suporte.', 'error');
    } else {
      showToast(error.message || 'Erro ao entrar. Tente novamente.', 'error');
    }
  } finally {
    hideLoading();
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = btnText;
  }
});