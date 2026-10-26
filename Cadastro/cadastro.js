/* Tela de cadastro: SOMENTE frontend. Nada é enviado, salvo ou guardado (sem localStorage/cookies/API). */
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

/* ---------- Regras de validação (um lugar só, fácil de ajustar ou espelhar no backend) ---------- */
const REGRAS = {
  nome: v => /^\S+(\s+\S+)+$/.test(v.trim()) && v.trim().length >= 5 ? '' : (v.trim() ? 'Informe seu nome completo (nome e sobrenome).' : 'Informe seu nome completo.'),
  email: v => !v.trim() ? 'Informe seu e-mail.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Digite um e-mail válido, como nome@exemplo.com.',
  telefone: v => { const n = v.replace(/\D/g, ''); return !n ? 'Informe seu telefone.' : (n.length === 10 || n.length === 11) ? '' : 'Digite o DDD e o número, como (31) 98767-7197.'; },
  senha: v => !v ? 'Crie uma senha.' : v.length >= 8 ? '' : 'A senha precisa ter pelo menos 8 caracteres.',
  confirmar: (v, f) => !v ? 'Confirme sua senha.' : v === f.elements.senha.value ? '' : 'As senhas não coincidem.',
  termos: (v, f, el) => el.checked ? '' : 'Aceite os Termos de Uso e a Política de Privacidade para continuar.'
};

const form = $('#form-cadastro'), sucesso = $('#sucesso');
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
  el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
    if (el.dataset.tocado || el.type === 'checkbox') validar(el);
    if (el.id === 'senha' && $('#confirmar').dataset.tocado) validar($('#confirmar'));
    sucesso.hidden = true;
  });
});

/* ---------- Máscara de telefone: (31) 98767-7197 ---------- */
$('#telefone').addEventListener('input', e => {
  const n = e.target.value.replace(/\D/g, '').slice(0, 11);
  e.target.value = n.length > 6 ? `(${n.slice(0, 2)}) ${n.slice(2, n.length - 4)}-${n.slice(-4)}`
    : n.length > 2 ? `(${n.slice(0, 2)}) ${n.slice(2)}` : n ? `(${n}` : '';
});

/* ---------- Mostrar / ocultar senha ---------- */
document.querySelectorAll('.ver-senha').forEach(b => b.addEventListener('click', () => {
  const input = $('#' + b.dataset.alvo), mostrar = input.type === 'password';
  input.type = mostrar ? 'text' : 'password';
  b.setAttribute('aria-pressed', mostrar);
  b.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
  $('use', b).setAttribute('href', mostrar ? '#i-eye-off' : '#i-eye');
}));

/* Links de Termos/Política ainda não têm página: evita "pular" para o topo. */
document.querySelectorAll('a[data-pendente]').forEach(a => a.addEventListener('click', e => e.preventDefault()));

/* ---------- Envio ---------- */
form.addEventListener('submit', e => {
  e.preventDefault();
  campos.forEach(el => { el.dataset.tocado = 1; });
  const invalidos = campos.filter(el => !validar(el));
  if (invalidos.length) { sucesso.hidden = true; invalidos[0].focus(); return; }

  /* [BACKEND] Os dados válidos estão aqui. Para integrar, envie `dados` para a API (fetch/POST)
     e trate sucesso/erro do servidor (ex.: e-mail já cadastrado -> mostrar erro em #erro-email).
     Hoje NADA é enviado ou guardado. */
  const dados = {
    nome: form.elements.nome.value.trim(),
    email: form.elements.email.value.trim(),
    telefone: form.elements.telefone.value.replace(/\D/g, ''),
    senha: form.elements.senha.value,
    termosAceitos: form.elements.termos.checked
  };
  void dados;

  sucesso.hidden = false;
  sucesso.focus();
  form.reset();   /* limpa os campos (inclusive senhas) após a demonstração */
  campos.forEach(el => { delete el.dataset.tocado; el.removeAttribute('aria-invalid'); el.closest('.campo').classList.remove('valido', 'invalido'); });
});