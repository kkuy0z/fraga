/* =========================================
   1. CARROSSEL DE IMAGENS DO ESPAÇO
========================================= */
const imagensEspaco = [
    "images/espaco1.jpg",
    "images/espaco2.jpg",
    "images/espaco3.jpg"
];

let indiceEspaco = 0;
const imgEspacoEl = document.getElementById("imagemEspaco");
const btnPrevEspaco = document.getElementById("anterior-espaco");
const btnNextEspaco = document.getElementById("proximo-espaco");

function atualizarImagemEspaco() {
    if (imgEspacoEl) {
        imgEspacoEl.src = imagensEspaco[indiceEspaco];
    }
}

if (btnNextEspaco && btnPrevEspaco) {
    btnNextEspaco.addEventListener("click", () => {
        indiceEspaco = (indiceEspaco + 1) % imagensEspaco.length;
        atualizarImagemEspaco();
    });

    btnPrevEspaco.addEventListener("click", () => {
        indiceEspaco = (indiceEspaco - 1 + imagensEspaco.length) % imagensEspaco.length;
        atualizarImagemEspaco();
    });
}

/* =========================================
   2. SISTEMA DINÂMICO DE AVALIAÇÕES (LOCALSTORAGE)
========================================= */

const avaliacoesIniciais = [
    {
        nome: "João Costa",
        nota: 5,
        comentario: "Simplesmente o melhor hambúrguer da região! Entrega rápida e produto super quente."
    },
    {
        nome: "Samuel Wellington",
        nota: 5,
        comentario: "Impressionado pela qualidade dos lanches. Muito recheado e bom atendimento."
    },
    {
        nome: "Maria Gabriela",
        nota: 5,
        comentario: "Atendimento impecável! O lanche chegou rápido e o sabor é maravilhoso."
    }
];

function obterAvaliacoes() {
    const salvas = localStorage.getItem("avaliacoes_fraga");
    if (!salvas) {
        localStorage.setItem("avaliacoes_fraga", JSON.stringify(avaliacoesIniciais));
        return avaliacoesIniciais;
    }
    return JSON.parse(salvas);
}

function renderizarAvaliacoes() {
    const lista = document.getElementById("avaliacoes-list");
    if (!lista) return;

    const avaliacoes = obterAvaliacoes();
    lista.innerHTML = "";

    avaliacoes.forEach(item => {
        const estrelasStr = "★".repeat(item.nota) + "☆".repeat(5 - item.nota);
        const inicial = item.nome ? item.nome.charAt(0).toUpperCase() : "A";

        const card = document.createElement("div");
        card.className = "card-avaliacao";
        card.innerHTML = `
            <div class="header-cliente">
                <div class="avatar-cliente">${inicial}</div>
                <div>
                    <div class="nome-cliente">${item.nome}</div>
                    <div class="estrelas">${estrelasStr}</div>
                </div>
            </div>
            <p class="comentario">"${item.comentario}"</p>
        `;
        lista.appendChild(card);
    });
}

const formAvaliacao = document.getElementById("form-avaliacao");

if (formAvaliacao) {
    formAvaliacao.addEventListener("submit", (e) => {
        e.preventDefault();

        const nome = document.getElementById("nome-cliente").value;
        const nota = parseInt(document.getElementById("nota-cliente").value);
        const comentario = document.getElementById("comentario-cliente").value;

        const novasAvaliacoes = obterAvaliacoes();
        novasAvaliacoes.unshift({ nome, nota, comentario });

        localStorage.setItem("avaliacoes_fraga", JSON.stringify(novasAvaliacoes));
        renderizarAvaliacoes();

        formAvaliacao.reset();
        alert("Obrigado pela sua avaliação!");
    });
}

const avaliacoesListEl = document.getElementById("avaliacoes-list");
const btnNextReview = document.getElementById("next-review");
const btnPrevReview = document.getElementById("prev-review");

if (btnNextReview && avaliacoesListEl) {
    btnNextReview.addEventListener("click", () => {
        avaliacoesListEl.scrollBy({ left: 260, behavior: 'smooth' });
    });
}

if (btnPrevReview && avaliacoesListEl) {
    btnPrevReview.addEventListener("click", () => {
        avaliacoesListEl.scrollBy({ left: -260, behavior: 'smooth' });
    });
}

// Inicializar na carga da página
renderizarAvaliacoes();