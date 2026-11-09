/**
 * Página de Fidelidade/Pontos - RF-19
 * Cliente visualiza pontos acumulados, histórico e resgata recompensas
 */

import { useEffect, useState } from 'react';
import { Header, ToastContainer, LoadingOverlay, Button, Badge, Modal } from '@components';
import { useToast } from '@hooks';
import { useAuth } from '@hooks';
import { api } from '@api/client';
import { formatarData } from '@shared/utils';
import styles from './FidelidadePage.module.css';

type PontosResumo = {
  pontos_atuais: number;
  total_acumulado: number;
  total_resgatado: number;
  nivel: string;
  proximo_nivel?: {
    nome: string;
    pontos_necessarios: number;
  };
};

type HistoricoPonto = {
  id: number;
  tipo: 'ganho' | 'resgatado' | 'expirado' | 'ajuste';
  pontos: number;
  descricao: string;
  pedido_id?: number;
  pedido_numero?: string;
  recompensa_id?: number;
  recompensa_nome?: string;
  created_at: string;
};

type Recompensa = {
  id: number;
  nome: string;
  descricao: string;
  pontos_custo: number;
  tipo: 'desconto' | 'produto' | 'frete_gratis' | 'outro';
  valor_desconto?: number;
  produto_id?: number;
  produto_nome?: string;
  ativo: boolean;
  estoque?: number;
  imagem_url?: string;
};

type ResgateFormData = {
  recompensa_id: number;
  quantidade: number;
};

const initialResgateData: ResgateFormData = {
  recompensa_id: 0,
  quantidade: 1,
};

export function FidelidadePage() {
  const { isClienteAuthenticated, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [resumo, setResumo] = useState<PontosResumo | null>(null);
  const [historico, setHistorico] = useState<HistoricoPonto[]>([]);
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResgateModal, setShowResgateModal] = useState(false);
  const [selectedRecompensa, setSelectedRecompensa] = useState<Recompensa | null>(null);
  const [resgateData, setResgateData] = useState<ResgateFormData>(initialResgateData);
  const [resgateSubmitting, setResgateSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [resumoData, historicoData, recompensasData] = await Promise.all([
        api.getFidelidadeResumo(),
        api.getFidelidadeHistorico(),
        api.getFidelidadeRecompensas(),
      ]);
      setResumo(resumoData);
      setHistorico(historicoData);
      setRecompensas(recompensasData.filter(r => r.ativo));
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar fidelidade');
      showToast('Erro ao carregar fidelidade', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResgatar = (recompensa: Recompensa) => {
    setSelectedRecompensa(recompensa);
    setResgateData({ recompensa_id: recompensa.id, quantidade: 1 });
    setShowResgateModal(true);
  };

  const handleResgateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecompensa) return;

    setResgateSubmitting(true);
    try {
      await api.resgatarRecompensa({
        recompensa_id: resgateData.recompensa_id,
        quantidade: resgateData.quantidade,
      });
      showToast('Resgate realizado com sucesso!', 'success');
      setShowResgateModal(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Erro ao resgatar recompensa', 'error');
    } finally {
      setResgateSubmitting(false);
    }
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      ganho: 'Ganho',
      resgatado: 'Resgatado',
      expirado: 'Expirado',
      ajuste: 'Ajuste',
    };
    return labels[tipo] || tipo;
  };

  const getTipoColor = (tipo: string) => {
    const colors: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
      ganho: 'success',
      resgatado: 'warning',
      expirado: 'error',
      ajuste: 'info',
    };
    return colors[tipo] || 'info';
  };

  const getNivelProgress = () => {
    if (!resumo?.proximo_nivel) return 100;
    const total = resumo.proximo_nivel.pontos_necessarios;
    const atual = resumo.pontos_atuais;
    return Math.min(100, Math.round((atual / total) * 100));
  };

  if (authLoading) {
    return (
      <>
        <Header currentPage="fidelidade" />
        <ToastContainer />
        <LoadingOverlay message="Carregando..." />
      </>
    );
  }

  if (!isClienteAuthenticated) {
    return (
      <>
        <Header currentPage="fidelidade" />
        <ToastContainer />
        <div className={styles.errorContainer}>
          <div className={styles.errorCard}>
            <h1>🔒</h1>
            <h2>Área Restrita</h2>
            <p>Faça login para visualizar seus pontos e recompensas.</p>
            <Button variant="primary" onClick={() => window.location.href = '/cadastro'}>
              Entrar / Cadastrar
            </Button>
          </div>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Header currentPage="fidelidade" />
        <ToastContainer />
        <LoadingOverlay message="Carregando fidelidade..." />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header currentPage="fidelidade" />
        <ToastContainer />
        <div className={styles.errorContainer}>
          <div className={styles.errorCard}>
            <h1>❌</h1>
            <h2>Erro ao carregar</h2>
            <p>{error}</p>
            <Button variant="primary" onClick={loadData}>Tentar Novamente</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header currentPage="fidelidade" />
      <ToastContainer />

      <div className={styles.page}>
        {/* Resumo de Pontos */}
        <section className={styles.resumo} aria-labelledby="resumo-title">
          <h2 id="resumo-title" className={styles.sectionTitle}>SEUS PONTOS</h2>

          <div className={styles.resumoCards}>
            <div className={styles.card principal}>
              <div className={styles.cardHeader}>
                <span className={styles.cardLabel}>Pontos Atuais</span>
                <span className={styles.nivelBadge}>{resumo?.nivel}</span>
              </div>
              <div className={styles.pontosValor}>{resumo?.pontos_atuais ?? 0}</div>
              <div className={styles.pontosLabel}>pontos disponíveis</div>

              {resumo?.proximo_nivel && (
                <div className={styles.progressContainer}>
                  <div className={styles.progressInfo}>
                    <span>Próximo nível: {resumo.proximo_nivel.nome}</span>
                    <span>{resumo.pontos_atuais}/{resumo.proximo_nivel.pontos_necessarios} pts</span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${getNivelProgress()}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={styles.card secundario}>
              <div className={styles.cardHeader}>
                <span className={styles.cardLabel}>Total Acumulado</span>
              </div>
              <div className={styles.valorGrande}>{resumo?.total_acumulado ?? 0}</div>
              <div className={styles.cardLabel}>pontos ganhos</div>
            </div>

            <div className={styles.card secundario}>
              <div className={styles.cardHeader}>
                <span className={styles.cardLabel}>Total Resgatado</span>
              </div>
              <div className={styles.valorGrande}>{resumo?.total_resgatado ?? 0}</div>
              <div className={styles.cardLabel}>pontos usados</div>
            </div>
          </div>
        </section>

        {/* Recompensas Disponíveis */}
        <section className={styles.recompensas} aria-labelledby="recompensas-title">
          <h2 id="recompensas-title" className={styles.sectionTitle}>RECOMPENSAS DISPONÍVEIS</h2>

          {recompensas.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🎁</div>
              <p>Nenhuma recompensa disponível no momento</p>
              <p className={styles.emptyHint}>Novas recompensas aparecerão aqui em breve</p>
            </div>
          ) : (
            <div className={styles.recompensasGrid} role="list">
              {recompensas.map((recompensa) => (
                <article key={recompensa.id} className={styles.recompensaCard} role="listitem">
                  {recompensa.imagem_url && (
                    <div className={styles.recompensaImage}>
                      <img src={recompensa.imagem_url} alt={recompensa.nome} />
                    </div>
                  )}
                  <div className={styles.recompensaContent}>
                    <div className={styles.recompensaHeader}>
                      <h3 className={styles.recompensaNome}>{recompensa.nome}</h3>
                      <Badge variant="info" className={styles.recompensaTipo}>
                        {recompensa.tipo.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <p className={styles.recompensaDesc}>{recompensa.descricao}</p>

                    <div className={styles.recompensaFooter}>
                      <div className={styles.recompensaCusto}>
                        <span className={styles.custoValor}>{recompensa.pontos_custo}</span>
                        <span className={styles.custoLabel}>pontos</span>
                      </div>
                      {recompensa.estoque !== undefined && recompensa.estoque > 0 && (
                        <span className={styles.recompensaEstoque}>Estoque: {recompensa.estoque}</span>
                      )}
                      <Button
                        variant={resumo && resumo.pontos_atuais >= recompensa.pontos_custo ? 'primary' : 'secondary'}
                        size="sm"
                        className={styles.resgatarBtn}
                        onClick={() => handleResgatar(recompensa)}
                        disabled={!resumo || resumo.pontos_atuais < recompensa.pontos_custo}
                      >
                        {resumo && resumo.pontos_atuais >= recompensa.pontos_custo ? 'Resgatar' : 'Pontos insuficientes'}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Histórico de Pontos */}
        <section className={styles.historico} aria-labelledby="historico-title">
          <h2 id="historico-title" className={styles.sectionTitle}>HISTÓRICO DE PONTOS</h2>

          {historico.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📋</div>
              <p>Nenhum movimento de pontos ainda</p>
              <p className={styles.emptyHint">Seus pontos aparecerão aqui após fazer pedidos</p>
            </div>
          ) : (
            <div className={styles.historicoList} role="list">
              {historico.map((item) => (
                <div key={item.id} className={styles.historicoItem} role="listitem">
                  <div className={styles.historicoIcon}>
                    {item.tipo === 'ganho' ? '⬆️' : item.tipo === 'resgatado' ? '⬇️' : item.tipo === 'expirado' ? '⏰' : '🔧'}
                  </div>
                  <div className={styles.historicoContent}>
                    <div className={styles.historicoTop}>
                      <span className={styles.historicoDesc}>{item.descricao}</span>
                      <Badge variant={getTipoColor(item.tipo)} className={styles.historicoTipo}>
                        {getTipoLabel(item.tipo)}
                      </Badge>
                    </div>
                    <div className={styles.historicoBottom}>
                      {item.pedido_numero && (
                        <span className={styles.historicoPedido}>Pedido #{item.pedido_numero}</span>
                      )}
                      {item.recompensa_nome && (
                        <span className={styles.historicoRecompensa}>Recompensa: {item.recompensa_nome}</span>
                      )}
                      <span className={styles.historicoData}>{formatarData(item.created_at)}</span>
                    </div>
                  </div>
                  <div className={`${styles.historicoPontos} ${item.tipo === 'ganho' ? styles.ganho : styles.gasto}`}>
                    {item.tipo === 'ganho' ? '+' : ''}{item.pontos} pts
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal de Resgate */}
      <Modal
        isOpen={showResgateModal}
        onClose={() => setShowResgateModal(false)}
        title="Confirmar Resgate"
        size="md"
      >
        {selectedRecompensa && (
          <form onSubmit={handleResgateSubmit} className={styles.modalForm}>
            <div className={styles.modalResumo}>
              <h4>{selectedRecompensa.nome}</h4>
              <p>{selectedRecompensa.descricao}</p>
              <div className={styles.modalCusto}>
                <span>Custo: {selectedRecompensa.pontos_custo} pontos</span>
                {resumo && <span>Seus pontos: {resumo.pontos_atuais}</span>}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="quantidade" className={styles.label}>
                Quantidade
              </label>
              <input
                id="quantidade"
                type="number"
                min="1"
                max={selectedRecompensa.estoque || 99}
                value={resgateData.quantidade}
                onChange={(e) => setResgateData(prev => ({ ...prev, quantidade: parseInt(e.target.value) || 1 }))}
                className={styles.input}
              />
              {selectedRecompensa.estoque && (
                <span className={styles.helpText}>Máximo: {selectedRecompensa.estoque}</span>
              )}
            </div>

            <div className={styles.modalTotal}>
              Total: <strong>{selectedRecompensa.pontos_custo * resgateData.quantidade} pontos</strong>
            </div>

            <div className={styles.modalActions}>
              <Button type="button" variant="secondary" onClick={() => setShowResgateModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={resgateSubmitting}>
                {resgateSubmitting ? 'Resgatando...' : 'Confirmar Resgate'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default FidelidadePage;