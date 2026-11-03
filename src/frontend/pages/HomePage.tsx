/**
 * Página Inicial - Fraga Lanches
 * Hero, Sobre, Espaço, Avaliações, Localização, Contato
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@components';
import { useStatusFuncionamento } from '@api/queries';
import { formatDateOnly } from '@utils';
import styles from './HomePage.module.css';

export function HomePage() {
  const { data: status, isLoading } = useStatusFuncionamento();
  const [currentYear] = useState(new Date().getFullYear());

  return (
    <>
      <Header currentPage="inicio" />

      {/* Hero Section */}
      <section className={styles.hero} id="inicio" aria-labelledby="hero-title">
        <img
          src="/img/img_fundo.png"
          alt="Hambúrguer Artesanal"
          className={styles.heroBg}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className={styles.heroOverlay} />

        <div className={styles.heroContent}>
          {/* Status Badge */}
          <div
            id="statusBadge"
            className={`${styles.statusBadge} ${status?.aberto ? styles.aberto : styles.fechado} ${isLoading ? styles.verificando : ''}`}
            aria-live="polite"
          >
            <span className={styles.statusIndicator} />
            <span className={styles.statusText}>
              {isLoading ? 'Verificando...' : status?.aberto ? 'ABERTO AGORA' : `FECHADO${status?.horario_atual ? ` (${status.horario_atual})` : ''}`}
            </span>
          </div>

          <h1 id="hero-title" className={styles.heroTitle}>
            A MELHOR<br />
            <span className={styles.destaque}>HAMBURGUERIA</span><br />
            DA REGIÃO!
          </h1>
          <Link to="/cardapio" className={styles.botaoPedido}>
            Faça um Pedido <span className={styles.seta}>{' > '}</span>
          </Link>
        </div>
      </section>

      {/* Sobre Nós */}
      <section className={styles.sobre} id="sobre" aria-labelledby="sobre-title">
        <div className={styles.sobreContainer}>
          <div className={styles.sobreTextoBox}>
            <h2 id="sobre-title" className={styles.tituloSobre}>
              <span className={styles.tracoHorizontal} /> SOBRE <span className={styles.destaqueSobre}>NÓS</span>
            </h2>
            <h3 className={styles.subtituloSobre}>
              Feito a mão.<br />
              <span className={styles.destaqueSubtitulo}>Pensado para você.</span>
            </h3>
            <div className={styles.linhaAmarela} />
            <p className={styles.sobreTexto}>
              O Fraga Lanches vai se tornar o seu novo destino favorito para matar a fome com muito sabor e
              qualidade! Especializados em hambúrgueres artesanais suculentos, oferecemos também as melhores e
              mais generosas porções do bairro, além de pratos completos e deliciosos. Seja para curtir no
              aconchego da sua casa ou para aproveitar o nosso atendimento, garantimos praticidade e ingredientes
              caprichados em cada pedido.
            </p>
          </div>

          <div className={styles.logoPrincipalContainer}>
            <img
              src="/img/logo.png"
              alt="Fraga Lanches Logo Principal"
              className={styles.logoPrincipalImg}
              onError={(e) => {
                e.currentTarget.src = 'https://via.placeholder.com/320/111111/ffd900?text=FRAGA+LANCHES';
              }}
            />
          </div>
        </div>
      </section>

      {/* Nosso Espaço */}
      <section className={styles.espaco} id="espaco" aria-labelledby="espaco-title">
        <div className={styles.espacoContainer}>
          <div className={styles.espacoHeader}>
            <h2 id="espaco-title" className={styles.tituloEspaco}>NOSSO <span className={styles.destaqueEspaco}>ESPAÇO</span></h2>
            <p className={styles.subtituloEspaco}>
              Mais do que um espaço para comer, um espaço feito para reunir, celebrar e saborear refeições saborosas!
            </p>
            <div className={styles.linhaAmarelaEspaco} />
          </div>

          <div className={styles.carrosselEspacoWrapper}>
            <button className={styles.setaEspaco} id="anteriorEspaco" aria-label="Anterior">&#10094;</button>

            <div className={styles.carrosselEspacoContainer}>
              <div className={styles.espacoCard}>
                <img src="/img/espaco1.svg" alt="Espaço 1 - Salão Principal" />
              </div>
              <div className={styles.espacoCard}>
                <img src="/img/espaco2.svg" alt="Espaço 2 - Área Externa" />
              </div>
              <div className={styles.espacoCard}>
                <img src="/img/espaco3.svg" alt="Espaço 3 - Mesas Privativas" />
              </div>
              <div className={styles.espacoCard}>
                <img src="/img/espaco4.svg" alt="Espaço 4 - Balcão" />
              </div>
            </div>

            <button className={styles.setaEspaco} id="proximoEspaco" aria-label="Próximo">&#10095;</button>
          </div>

          <div className={styles.carrosselDots}>
            <span className={`${styles.dot} ${styles.active}`} />
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        </div>
      </section>

      {/* Localização */}
      <section className={styles.localizacao} id="localizacao" aria-labelledby="localizacao-title">
        <div className={styles.localizacaoContainer}>
          <div className={styles.localizacaoHeader}>
            <h2 id="localizacao-title" className={styles.tituloLocalizacao}>LOCALIZAÇÃO</h2>
            <div className={styles.linhaAmarelaLoc} />
          </div>

          <div className={styles.localizacaoGrid}>
            <div className={styles.localizacaoInfo}>
              <div className={styles.infoItem}>
                <span className={styles.iconeLoc}>📍</span>
                <p>R. SIMONÉSIA, 5 - MARIMBÁ<br />BETIM, MG</p>
              </div>

              <div className={styles.horarioBox}>
                <h3 className={styles.horarioTitulo}>HORÁRIO DE FUNCIONAMENTO</h3>
                <div className={styles.horarioConteudo}>
                  <span className={styles.iconeRelogio}>⏰</span>
                  <div className={styles.horarioTexto}>
                    <span>Segunda à Sábado</span>
                    <strong className={styles.destaqueHoras}>18HRS - 23H30</strong>
                  </div>
                </div>
              </div>

              <a
                href="https://maps.google.com/maps?q=Rua+Simon%C3%A9sia,+5,+Marimb%C3%A1,+Betim+-+MG"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.botaoComoChegar}
              >
                COMO CHEGAR <span className={styles.setaBtn}>&rarr;</span>
              </a>
            </div>

            <div className={styles.mapaContainer}>
              <iframe
                src="https://maps.google.com/maps?q=Rua+Simon%C3%A9sia,+5,+Marimb%C3%A1,+Betim+-+MG&t=&z=16&ie=UTF8&iwloc=&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localização Fraga Lanches no Google Maps"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Avaliações */}
      <section className={styles.avaliacoes} id="avaliacoes" aria-labelledby="avaliacoes-title">
        <div className={styles.avaliacoesContainerGeral}>
          <div className={styles.avaliacoesHeader}>
            <h2 id="avaliacoes-title" className={styles.tituloAvaliacoes}>VEJA AS <span className={styles.destaqueAv}>AVALIAÇÕES</span></h2>
            <p className={styles.subtituloAvaliacoes}>Confira o que os nossos clientes têm a dizer sobre nosso serviço.</p>
            <div className={styles.linhaAmarelaAv} />
          </div>

          <div className={styles.avaliacoesCarrosselWrapper}>
            <button className={styles.setaAv} id="prevReview" aria-label="Anterior">&#9664;</button>

            <div className={styles.avaliacoesContainer} id="avaliacoesList">
              <article className={styles.avaliacaoCard}>
                <div className={styles.avatarBox}>
                  <svg className={styles.avatarSvg} viewBox="0 0 24 24" fill="#ffd900">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                  </svg>
                </div>
                <h4 className={styles.clienteNome}>Júlio Costa</h4>
                <div className={styles.estrelas}>★★★★★</div>
                <p className={styles.clienteComentario}>
                  "Simplesmente o melhor hambúrguer da região! Carne suculenta, ponto perfeito e o pão é super macio. Sem contar que pedi entrega e chegou quentinho e super rápido. Nota 10!"
                </p>
                <div className={styles.aspasRodape}>“</div>
              </article>

              <article className={styles.avaliacaoCard}>
                <div className={styles.avatarBox}>
                  <svg className={styles.avatarSvg} viewBox="0 0 24 24" fill="#ffd900">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                  </svg>
                </div>
                <h4 className={styles.clienteNome}>Samuel Welington</h4>
                <div className={styles.estrelas}>★★★★★</div>
                <p className={styles.clienteComentario}>
                  "Surpreendido pela qualidade! Além do lanche artesanal maravilhoso, pedi uma marmita durante a semana e a comida é caseira, muito saborosa e bem servida. Parabéns à equipe!"
                </p>
                <div className={styles.aspasRodape}>“</div>
              </article>

              <article className={styles.avaliacaoCard}>
                <div className={styles.avatarBox}>
                  <svg className={styles.avatarSvg} viewBox="0 0 24 24" fill="#ffd900">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                  </svg>
                </div>
                <h4 className={styles.clienteNome}>Maria Gabriela</h4>
                <div className={styles.estrelas}>★★★★★</div>
                <p className={styles.clienteComentario}>
                  "Atendimento impecável e comida excelente. As porções são generosas e o preço é justo. Virou o meu delivery favorito de fim de semana!"
                </p>
                <div className={styles.aspasRodape}>“</div>
              </article>
            </div>

            <button className={styles.setaAv} id="nextReview" aria-label="Próximo">&#9658;</button>
          </div>

          <div className={styles.carrosselDotsAv}>
            <span className={`${styles.dot} ${styles.active}`} />
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        </div>
      </section>

      {/* Contato */}
      <section className={styles.contato} id="contato" aria-labelledby="contato-title">
        <div className={styles.contatoContainerGeral}>
          <div className={styles.contatoGrid}>
            <div className={styles.contatoInfoTexto}>
              <h2 id="contato-title" className={styles.tituloContato}>
                ENTRE EM CONTATO<br />
                E <span className={styles.destaqueContato}>FAÇA SEU PEDIDO!</span>
              </h2>
              <p className={styles.subtituloContato}>
                Estamos prontos para preparar suas refeições com todo o cuidado que você merece. Fale com a gente ou faça seu pedido agora!
              </p>
              <div className={styles.linhaAmarelaContato} />
            </div>

            <div className={styles.contatoBotoesColuna}>
              <a href="https://wa.me/5531997577197" target="_blank" rel="noopener noreferrer" className={styles.blocoContatoItem}>
                <div className={styles.iconeCirculo}>
                  <svg className={styles.svgIcone} viewBox="0 0 24 24" fill="#ffd900">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                  </svg>
                </div>
                <div className={styles.textoBloco}>
                  <span className={styles.labelTopo}>TELEFONE</span>
                  <strong className={styles.valorInfo}>(31) 99757-7197</strong>
                </div>
              </a>

              <a href="https://instagram.com/fraga_lanches" target="_blank" rel="noopener noreferrer" className={styles.blocoContatoItem}>
                <div className={styles.iconeCirculo}>
                  <svg className={styles.svgIcone} viewBox="0 0 24 24" fill="#ffd900">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </div>
                <div className={styles.textoBloco}>
                  <span className={styles.labelTopo}>INSTAGRAM</span>
                  <strong className={styles.valorInfo}>fraga_lanches</strong>
                </div>
              </a>

              <div className={styles.blocoContatoItem}>
                <div className={styles.iconeCirculo}>
                  <svg className={styles.svgIcone} viewBox="0 0 24 24" fill="#ffd900">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <div className={styles.textoBloco}>
                  <span className={styles.labelTopo}>ENDEREÇO</span>
                  <strong className={styles.valorInfo}>R. Simonésia, 5 - Marimbá</strong>
                </div>
              </div>

              <a href="https://wa.me/5531997577197" target="_blank" rel="noopener noreferrer" className={styles.botaoPedirWhatsApp}>
                PEDIR PELO WHATSAPP <span className={styles.setaContato}>&rarr;</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          © {currentYear} Fraga Lanches - Todos os direitos reservados.
        </div>
      </footer>
    </>
  );
}

export default HomePage;