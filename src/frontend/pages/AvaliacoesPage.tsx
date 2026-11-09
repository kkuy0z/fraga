/**
 * Página de Avaliações - RF-17, RF-18
 * Cliente avalia pedidos (1-5 estrelas + comentário)
 * Admin visualiza e responde avaliações
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Header, ToastContainer, LoadingOverlay, Button, Modal, Textarea } from '@components';
import { useToast } from '@hooks';
import { useAuth } from '@hooks';
import { api } from '@api/client';
import { formatarData, formatarMoeda } from '@shared/utils';
import { Pedido } from '@shared/types';
import styles from './AvaliacoesPage.module.css';

type Avaliacao = {
  id: number;
  pedido_id: number;
  cliente_id: number;
  estrelas: number;
  comentario: string | null;
  respondido: boolean;
  resposta_admin: string | null;
  respondido_por: number | null;
  respondido_em: string | null;
  respondido_por_nome: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  cliente_nome?: string;
  valor_total?: number;
  data_pedido?: string;
};

type AvaliacaoFormData = {
  estrelas: number;
  comentario: string;
};

type RespostaFormData = {
  resposta_admin: string;
};

const initialFormData: AvaliacaoFormData = {
  estrelas: 0,
  comentario: '',
};

const initialRespostaData: RespostaFormData = {
  resposta_admin: '',
};

export function AvaliacoesPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<AvaliacaoFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Partial<AvaliacaoFormData>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showRespostaModal, setShowRespostaModal] = useState(false);
  const [respostaData, setRespostaData] = useState<RespostaFormData>(initialRespostaData);
  const [respostaErrors, setRespostaErrors] = useState<Partial<RespostaFormData>>({});
  const [respostaSubmitting, setRespostaSubmitting] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      // Buscar pedido
      const pedidoData = await api.get<Pedido>(`/pedidos/${id}`);
      setPedido(pedidoData);

      // Buscar avaliação existente
      try {
        const avaliacaoData = await api.get<Avaliacao>(`/avaliacoes/pedido/${id}`);
        setAvaliacao(avaliacaoData);
        setShowForm(false);
      } catch {
        // Sem avaliação ainda
        setAvaliacao(null);
        // Verificar se pedido é elegível (entregue e não avaliado)
        const elegivel = pedidoData.status === 'entregue';
        setShowForm(elegivel && !isAdmin);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
      showToast('Erro ao carregar avaliação', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleStarClick = (estrelas: number) => {
    setFormData(prev => ({ ...prev, estrelas }));
    if (formErrors.estrelas) {
      setFormErrors(prev => ({ ...prev, estrelas: undefined }));
    }
  };

  const handleComentarioChange = (value: string) => {
    setFormData(prev => ({ ...prev, comentario: value }));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<AvaliacaoFormData> = {};
    if (formData.estrelas === 0) newErrors.estrelas = 'Selecione uma nota';
    if (!formData.comentario.trim()) newErrors.comentario = 'Comentário é obrigatório';
    else if (formData.comentario.length < 10) newErrors.comentario = 'Mínimo 10 caracteres';
    else if (formData.comentario.length > 500) newErrors.comentario = 'Máximo 500 caracteres';
    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!id) return;

    setSubmitting(true);
    try {
      await api.post('/avaliacoes', {
        estrelas: formData.estrelas,
        comentario: formData.comentario.trim(),
      });
      showToast('Avaliação enviada com sucesso!', 'success');
      setShowForm(false);
      loadData();
    } catch (err: any) {
      if (err.message?.includes('já foi avaliado')) {
        showToast('Este pedido já foi avaliado', 'warning');
        loadData();
      } else {
        showToast(err.message || 'Erro ao enviar avaliação', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespostaChange = (value: string) => {
    setRespostaData(prev => ({ ...prev, resposta_admin: value }));
    if (respostaErrors.resposta_admin) {
      setRespostaErrors(prev => ({ ...prev, resposta_admin: undefined }));
    }
  };

  const validateResposta = (): boolean => {
    if (!respostaData.resposta_admin.trim()) {
      setRespostaErrors({ resposta_admin: 'Resposta é obrigatória' });
      return false;
    }
    if (respostaData.resposta_admin.length > 500) {
      setRespostaErrors({ resposta_admin: 'Máximo 500 caracteres' });
      return false;
    }
    setRespostaErrors({});
    return true;
  };

  const handleSubmitResposta = async () => {
    if (!validateResposta() || !avaliacao) return;

    setRespostaSubmitting(true);
    try {
      await api.put(`/avaliacoes/admin/${avaliacao.id}`, {
        respondido: true,
        resposta_admin: respostaData.resposta_admin.trim(),
      });
      showToast('Resposta enviada com sucesso!', 'success');
      setShowRespostaModal(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao responder avaliação', 'error');
    } finally {
      setRespostaSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <>
        <Header currentPage="avaliacoes" />
        <ToastContainer />
        <LoadingOverlay message="Carregando..." />
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Header currentPage="avaliacoes" />
        <ToastContainer />
        <LoadingOverlay message="Carregando avaliação..." />
      </>
    );
  }

  if (error || !pedido) {
    return (
      <>
        <Header currentPage="avaliacoes" />
        <ToastContainer />
        <div className={styles.errorContainer}>
          <div className={styles.errorCard}>
            <h1>❌</h1>
            <h2>Pedido não encontrado</h2>
            <p>{error || 'Não foi possível carregar o pedido.'}</p>
            <Link to="/meus-pedidos">
              <Button variant="primary">Voltar aos Meus Pedidos</Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  const isElegivel = pedido.status === 'entregue' && !avaliacao && !isAdmin;
  const jaAvaliado = !!avaliacao;

  return (
    <>
      <Header currentPage="avaliacoes" />
      <ToastContainer />

      <div className={styles.page}>
        {/* Header do Pedido */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div>
              <span className={styles.pedidoNumber}>Pedido #{pedido.numero}</span>
              <h1 className={styles.title}>
                {jaAvaliado ? 'AVALIAÇÃO DO PEDIDO' : isElegivel ? 'AVALIAR PEDIDO' : 'PEDIDO NÃO ELEGÍVEL'}
              </h1>
            </div>
            {jaAvaliado && (
              <Badge variant={getStatusVariant(avaliacao!.estrelas)} className={styles.avaliacaoBadge}>
                {renderStars(avaliacao!.estrelas)}
              </Badge>
            )}
          </div>
          <div className={styles.headerMeta}>
            <span>📅 {formatarData(pedido.created_at)}</span>
            <span>💰 {formatarMoeda(pedido.total)}</span>
            {pedido.tipo_entrega === 'entrega' && <span>🚚 Entrega</span>}
            {pedido.tipo_entrega === 'retirada' && <span>🏪 Retirada</span>}
          </div>
        </header>

        {/* Se já avaliado - mostrar avaliação */}
        {jaAvaliado && (
          <section className={styles.avaliacaoCard} aria-labelledby="avaliacao-title">
            <h2 id="avaliacao-title" className={styles.sectionTitle}>SUA AVALIAÇÃO</h2>

            <div className={styles.avaliacaoContent}>
              <div className={styles.avaliacaoStars}>
                {renderStars(avaliacao!.estrelas, true)}
              </div>

              {avaliacao!.comentario && (
                <p className={styles.avaliacaoComentario}>{avaliacao!.comentario}</p>
              )}

              <div className={styles.avaliacaoMeta}>
                <span>Avaliado em {formatarData(avaliacao!.created_at)}</span>
              </div>

              {/* Resposta do admin */}
              {avaliacao!.respondido && avaliacao!.resposta_admin && (
                <div className={styles.respostaAdmin}>
                  <div className={styles.respostaHeader}>
                    <span className={styles.respostaLabel}>Resposta da Fraga Lanches</span>
                    <span className={styles.respostaDate}>
                      {avaliacao!.respondido_em ? formatarData(avaliacao!.respondido_em) : ''}
                    </span>
                  </div>
                  <p className={styles.respostaTexto}>{avaliacao!.resposta_admin}</p>
                  {avaliacao!.respondido_por_nome && (
                    <span className={styles.respostaAutor}>— {avaliacao!.respondido_por_nome}</span>
                  )}
                </div>
              )}

              {/* Botão responder (admin) */}
              {isAdmin && !avaliacao!.respondido && (
                <Button
                  variant="primary"
                  className={styles.responderBtn}
                  onClick={() => {
                    setRespostaData({ resposta_admin: '' });
                    setRespostaErrors({});
                    setShowRespostaModal(true);
                  }}
                >
                  Responder Avaliação
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Formulário de avaliação (cliente) */}
        {isElegivel && !jaAvaliado && (
          <section className={styles.formSection} aria-labelledby="form-title">
            <h2 id="form-title" className={styles.sectionTitle}>COMO FOI SUA EXPERIÊNCIA?</h2>
            <p className={styles.formSubtitle}>Sua opinião nos ajuda a melhorar</p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.starsContainer}>
                <label className={styles.starsLabel}>Nota <span className={styles.required}>*</span></label>
                <div className={styles.stars} role="radiogroup" aria-label="Avaliação de 1 a 5 estrelas">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`${styles.star} ${formData.estrelas >= star ? styles.filled : ''}`}
                      onClick={() => handleStarClick(star)}
                      aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
                      aria-pressed={formData.estrelas >= star}
                    >
                      ★
                    </button>
                  ))}
                </div>
                {formErrors.estrelas && <span className={styles.error}>{formErrors.estrelas}</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="comentario" className={styles.label}>
                  Comentário <span className={styles.required}>*</span>
                </label>
                <Textarea
                  id="comentario"
                  value={formData.comentario}
                  onChange={(e) => handleComentarioChange(e.target.value)}
                  error={formErrors.comentario}
                  placeholder="Conte-nos sobre sua experiência... (mín. 10, máx. 500 caracteres)"
                  rows={4}
                  className={styles.textarea}
                  maxLength={500}
                />
                {formErrors.comentario && <span className={styles.error}>{formErrors.comentario}</span>}
                <span className={styles.charCount}>{formData.comentario.length}/500</span>
              </div>

              <div className={styles.formActions}>
                <Button type="button" variant="secondary" onClick={() => window.history.back()}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" size="lg" disabled={submitting}>
                  {submitting ? 'Enviando...' : 'Enviar Avaliação'}
                </Button>
              </div>
            </form>
          </section>
        )}

        {/* Não elegível */}
        {!isElegivel && !jaAvaliado && (
          <section className={styles.notEligible} aria-labelledby="not-eligible-title">
            <div className={styles.notEligibleCard}>
              <div className={styles.notEligibleIcon}>
                {pedido.status === 'cancelado' ? '❌' : '⏳'}
              </div>
              <h2 id="not-eligible-title" className={styles.notEligibleTitle}>
                {pedido.status === 'cancelado' ? 'Pedido Cancelado' : 'Avaliação Indisponível'}
              </h2>
              <p className={styles.notEligibleText}>
                {pedido.status === 'cancelado'
                  ? 'Pedidos cancelados não podem ser avaliados.'
                  : 'Apenas pedidos entregues podem ser avaliados. Aguarde a entrega para compartilhar sua experiência.'}
              </p>
              <Link to="/meus-pedidos">
                <Button variant="primary">Ver Meus Pedidos</Button>
              </Link>
            </div>
          </section>
        )}

        {/* Detalhes do pedido para contexto */}
        <section className={styles.detailsSection} aria-labelledby="detalhes-title">
          <h2 id="detalhes-title" className={styles.sectionTitle}>DETALHES DO PEDIDO</h2>

          <div className={styles.itemsList}>
            {pedido.itens.map((item) => (
              <div key={item.produto_id} className={styles.item}>
                <div className={styles.itemInfo}>
                  <span className={styles.itemName}>{item.produto_nome}</span>
                  {item.personalizacoes.length > 0 && (
                    <span className={styles.itemCustom}>
                      {item.personalizacoes.map(p => p.opcao_nome).join(', ')}
                    </span>
                  )}
                  {item.observacoes && (
                    <span className={styles.itemNotes}>Obs: {item.observacoes}</span>
                  )}
                </div>
                <div className={styles.itemPrice}>
                  <span>{item.quantidade}x {formatarMoeda(item.preco_unitario)}</span>
                  <span>{formatarMoeda(item.preco_unitario * item.quantidade)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.orderTotal}>
            <span>Total</span>
            <strong>{formatarMoeda(pedido.total)}</strong>
          </div>
        </section>

        <div className={styles.actions}>
          <Link to="/meus-pedidos">
            <Button variant="secondary" size="lg" className={styles.fullWidth}>
              ← Voltar aos Meus Pedidos
            </Button>
          </Link>
        </div>
      </div>

      {/* Modal Resposta Admin */}
      <Modal
        isOpen={showRespostaModal}
        onClose={() => setShowRespostaModal(false)}
        title="Responder Avaliação"
        size="md"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSubmitResposta(); }} className={styles.modalForm}>
          <div className={styles.fieldGroup}>
            <label htmlFor="resposta_admin" className={styles.label}>
              Sua Resposta <span className={styles.required}>*</span>
            </label>
            <Textarea
              id="resposta_admin"
              value={respostaData.resposta_admin}
              onChange={(e) => handleRespostaChange(e.target.value)}
              error={respostaErrors.resposta_admin}
              placeholder="Escreva sua resposta pública para o cliente... (máx. 500 caracteres)"
              rows={4}
              className={styles.textarea}
              maxLength={500}
              autoFocus
            />
            {respostaErrors.resposta_admin && <span className={styles.error}>{respostaErrors.resposta_admin}</span>}
            <span className={styles.charCount}>{respostaData.resposta_admin.length}/500</span>
          </div>

          <div className={styles.modalActions}>
            <Button type="button" variant="secondary" onClick={() => setShowRespostaModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={respostaSubmitting}>
              {respostaSubmitting ? 'Enviando...' : 'Enviar Resposta'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function renderStars(estrelas: number, large = false) {
  return (
    <span className={large ? styles.starsDisplayLarge : styles.starsDisplay} aria-label={`${estrelas} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= estrelas ? styles.starFilled : styles.starEmpty}>
          ★
        </span>
      ))}
    </span>
  );
}

function getStatusVariant(estrelas: number) {
  if (estrelas >= 4) return 'success';
  if (estrelas >= 3) return 'warning';
  return 'error';
}

export default AvaliacoesPage;