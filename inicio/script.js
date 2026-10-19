const $ = (s, c = document) => c.querySelector(s);
const suave = matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth';

/* ---------- Menu mobile e cabeçalho ---------- */
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
const rolagem = () => header.classList.toggle('solido', scrollY > 30);
addEventListener('scroll', rolagem, { passive: true });
rolagem();

/* ---------- Carrossel genérico: setas, pontos, arrastar e teclado ---------- */
function carrossel(box, pontos) {
  const trilho = $('.trilho', box);
  const passo = () => { const [a, b] = trilho.children; return a ? (b ? b.offsetLeft - a.offsetLeft : a.offsetWidth) : 1; };
  const total = () => Math.max(1, trilho.children.length - Math.round(trilho.clientWidth / passo()) + 1);
  const atual = () => Math.round(trilho.scrollLeft / passo());
  const ir = i => trilho.scrollTo({ left: i * passo(), behavior: suave });
  const marcar = () => [...pontos.children].forEach((p, i) => p.classList.toggle('on', i === atual()));
  function montar() {
    pontos.replaceChildren(...Array.from({ length: total() }, (_, i) => {
      const p = document.createElement('button');
      p.type = 'button';
      p.setAttribute('aria-label', 'Ir para o item ' + (i + 1));
      p.onclick = () => ir(i);
      return p;
    }));
    marcar();
  }
  box.querySelectorAll('.seta').forEach(b => b.addEventListener('click', () => {
    const n = total(), i = atual() + Number(b.dataset.dir);
    ir(i < 0 ? n - 1 : i >= n ? 0 : i);
  }));
  trilho.addEventListener('scroll', marcar, { passive: true });
  addEventListener('resize', montar);
  montar();
  return montar;
}

/* ---------- Nosso espaço ----------
   Coloque as fotos em img/ com estes nomes. Remova da lista as que não for usar.
   Enquanto uma foto não existir, aparece um quadro "Foto em breve". */
const FOTOS = ['espaco1.jpg', 'espaco2.jpg', 'espaco3.jpg', 'espaco4.jpg', 'espaco5.jpg', 'espaco6.jpg'];
const VAZIA = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23141414'/%3E%3Ctext x='200' y='210' fill='%23ffc800' font-family='Arial' font-size='26' text-anchor='middle'%3EFoto em breve%3C/text%3E%3C/svg%3E";
FOTOS.forEach((arq, i) => {
  const fig = document.createElement('figure'), img = new Image();
  fig.className = 'slide';
  img.alt = 'Foto ' + (i + 1) + ' do espaço Fraga Lanches';
  img.loading = 'lazy';
  img.onerror = () => { img.onerror = null; img.src = VAZIA; };
  img.src = 'img/' + arq;
  fig.append(img);
  $('#lista-espaco').append(fig);
});
carrossel($('#c-espaco'), $('#pontos-espaco'));

/* ---------- Avaliações (salvas no navegador do visitante) ---------- */
const CHAVE = 'avaliacoes_fraga';
const BASE = [
  { nome: 'João Costa', nota: 5, comentario: 'Simplesmente o melhor hambúrguer da região! Entrega rápida e produto super quente.' },
  { nome: 'Samuel Wellington', nota: 5, comentario: 'Impressionado pela qualidade dos lanches. Muito recheado e bom atendimento.' },
  { nome: 'Maria Gabriela', nota: 5, comentario: 'Atendimento impecável! O lanche chegou rápido e o sabor é maravilhoso.' }
];
function ler() {
  try { const v = JSON.parse(localStorage.getItem(CHAVE)); if (Array.isArray(v) && v.length) return v; } catch { }
  return BASE;
}
function gravar(lista) { try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch { } }

let atualizarAval;
function desenhar() {
  $('#lista-avaliacoes').replaceChildren(...ler().map(a => {
    const nota = Math.min(5, Math.max(1, Number(a.nota) || 5));
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = '<div class="avatar" aria-hidden="true"></div><h3></h3><div class="estrelas" role="img"></div><p></p>';
    $('h3', card).textContent = a.nome;           /* textContent: nada digitado vira HTML */
    $('p', card).textContent = a.comentario;
    const est = $('.estrelas', card);
    est.textContent = '★'.repeat(nota) + '☆'.repeat(5 - nota);
    est.setAttribute('aria-label', nota + ' de 5 estrelas');
    return card;
  }));
  if (atualizarAval) atualizarAval();
}
desenhar();
atualizarAval = carrossel($('#c-aval'), $('#pontos-aval'));

$('#form-avaliacao').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, msg = $('#msg');
  const nome = f.elements.nome.value.trim(), comentario = f.elements.comentario.value.trim();
  if (!nome || !comentario) { msg.textContent = 'Preencha seu nome e o comentário.'; return; }
  gravar([{ nome, nota: Number(f.elements.nota.value), comentario }, ...ler()]);
  desenhar();
  $('#lista-avaliacoes').scrollTo({ left: 0, behavior: suave });
  f.reset();
  msg.textContent = 'Obrigado pela sua avaliação!';
});
