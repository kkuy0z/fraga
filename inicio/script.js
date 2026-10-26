document.addEventListener("DOMContentLoaded", function () {
  const avaliacoes = [
    {
      nome: "Júlio Costa",
      comentario: "Simplesmente o melhor hambúrguer da região! Carne suculenta, ponto perfeito e o pão é super macio. Sem contar que pedi entrega e chegou quentinho e super rápido. Nota 10!",
      estrelas: "★★★★★"
    },
    {
      nome: "Samuel Welington",
      comentario: "Surpreendido pela qualidade! Além do lanche artesanal maravilhoso, pedi uma marmita durante a semana e a comida é caseira, muito saborosa e bem servida. Parabéns à equipe!",
      estrelas: "★★★★★"
    },
    {
      nome: "Maria Gabriela",
      comentario: "Atendimento impecável e comida excelente. As porções são generosas e o preço é justo. Virou o meu delivery favorito de fim de semana!",
      estrelas: "★★★★★"
    },
    {
      nome: "Carlos Silva",
      comentario: "O melhor hambúrguer da região sem dúvida! Carne suculenta, ponto perfeito e entrega super rápida. Recomendo demais!",
      estrelas: "★★★★★"
    },
    {
      nome: "Mariana Souza",
      comentario: "Ambiente extremamente agradável, atendimento impecável e os lanches são verdadeiras obras de arte. Com certeza voltaremos mais vezes!",
      estrelas: "★★★★★"
    }
  ];

  let currentIndex = 0;
  const cardContainer = document.getElementById("avaliacoes-list");
  const dotsContainer = document.querySelector(".carrossel-dots-av");

  function renderizarCarrossel(index) {
    if (!cardContainer) return;

    // Calcula os índices anterior, central e seguinte de forma circular
    const prevIndex = (index - 1 + avaliacoes.length) % avaliacoes.length;
    const nextIndex = (index + 1) % avaliacoes.length;

    const avPrev = avaliacoes[prevIndex];
    const avCentral = avaliacoes[index];
    const avNext = avaliacoes[nextIndex];

    const svgIcon = `<svg class="avatar-svg" viewBox="0 0 24 24" fill="#ffd900"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`;

    cardContainer.innerHTML = `
      <!-- Cartão Esquerdo (Borrado) -->
      <div class="avaliacao-card lateral">
        <div class="avatar-box">${svgIcon}</div>
        <h4 class="cliente-nome">${avPrev.nome}</h4>
        <div class="estrelas">${avPrev.estrelas}</div>
        <p class="cliente-comentario">"${avPrev.comentario}"</p>
        <div class="aspas-rodape">“</div>
      </div>

      <!-- Cartão Central (Nítido e Destacado) -->
      <div class="avaliacao-card central">
        <div class="avatar-box">${svgIcon}</div>
        <h4 class="cliente-nome">${avCentral.nome}</h4>
        <div class="estrelas">${avCentral.estrelas}</div>
        <p class="cliente-comentario">"${avCentral.comentario}"</p>
        <div class="aspas-rodape">“</div>
      </div>

      <!-- Cartão Direito (Borrado) -->
      <div class="avaliacao-card lateral">
        <div class="avatar-box">${svgIcon}</div>
        <h4 class="cliente-nome">${avNext.nome}</h4>
        <div class="estrelas">${avNext.estrelas}</div>
        <p class="cliente-comentario">"${avNext.comentario}"</p>
        <div class="aspas-rodape">“</div>
      </div>
    `;

    atualizarDots(index);
  }

  function atualizarDots(index) {
    if (!dotsContainer) return;
    const dots = dotsContainer.querySelectorAll(".dot");
    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === index);
    });
  }

  // Eventos de clique nas setas
  const btnPrev = document.getElementById("prev-review");
  const btnNext = document.getElementById("next-review");

  if (btnPrev && btnNext) {
    btnPrev.addEventListener("click", () => {
      currentIndex = (currentIndex - 1 + avaliacoes.length) % avaliacoes.length;
      renderizarCarrossel(currentIndex);
    });

    btnNext.addEventListener("click", () => {
      currentIndex = (currentIndex + 1) % avaliacoes.length;
      renderizarCarrossel(currentIndex);
    });
  }

  // Eventos de clique nos pontos (dots)
  if (dotsContainer) {
    const dots = dotsContainer.querySelectorAll(".dot");
    dots.forEach((dot, i) => {
      dot.addEventListener("click", () => {
        currentIndex = i;
        renderizarCarrossel(currentIndex);
      });
    });
  }

  // Inicializa o carrossel
  renderizarCarrossel(currentIndex);

  // Rotação automática a cada 5 segundos
  setInterval(() => {
    currentIndex = (currentIndex + 1) % avaliacoes.length;
    renderizarCarrossel(currentIndex);
  }, 5000);
});