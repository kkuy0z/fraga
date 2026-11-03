/**
 * Página de Configuração de Entrega (Admin)
 */

import { useEffect, useState } from 'react';
import { Header, ToastContainer, LoadingOverlay, Button, Input, Switch, Card, Tabs, TabList, Tab, TabPanel } from '@components';
import { useToast } from '@hooks';
import { api } from '@api/client';
import styles from './AdminEntregaPage.module.css';

type ConfigEntrega = {
  taxa_fixa: number;
  raio_entrega_km: number;
  tempo_medio_minutos: number;
  bairros_atendidos: string[];
  bairros_taxa_extra: Record<string, number>;
  gratuito_acima_de: number;
};

type BairroFormData = {
  nome: string;
  taxa_extra: number;
};

const initialConfig: ConfigEntrega = {
  taxa_fixa: 0,
  raio_entrega_km: 5,
  tempo_medio_minutos: 45,
  bairros_atendidos: [],
  bairros_taxa_extra: {},
  gratuito_acima_de: 0,
};

const initialBairroForm: BairroFormData = {
  nome: '',
  taxa_extra: 0,
};

export function AdminEntregaPage() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<ConfigEntrega>(initialConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'geral' | 'bairros'>('geral');
  const [bairrosList, setBairrosList] = useState<Array<{ nome: string; taxa_extra: number }>>([]);
  const [showBairroModal, setShowBairroModal] = useState(false);
  const [editingBairroIndex, setEditingBairroIndex] = useState<number | null>(null);
  const [bairroForm, setBairroForm] = useState<BairroFormData>(initialBairroForm);
  const [bairroErrors, setBairroErrors] = useState<{ nome?: string; taxa_extra?: string }>({});

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<ConfigEntrega>('/admin/entrega/config');
      setConfig(data);
      setBairrosList(
        Object.entries(data.bairros_taxa_extra).map(([nome, taxa_extra]) => ({ nome, taxa_extra }))
      );
    } catch {
      showToast('Erro ao carregar configurações de entrega', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigChange = (field: keyof ConfigEntrega, value: string | number | boolean) => {
    if (field === 'bairros_atendidos' || field === 'bairros_taxa_extra') return;
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const bairros_taxa_extra: Record<string, number> = {};
      bairrosList.forEach(b => { bairros_taxa_extra[b.nome] = b.taxa_extra; });

      await api.put('/admin/entrega/config', {
        ...config,
        bairros_taxa_extra,
      });
      showToast('Configurações salvas com sucesso', 'success');
    } catch {
      showToast('Erro ao salvar configurações', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBairro = () => {
    setEditingBairroIndex(null);
    setBairroForm(initialBairroForm);
    setBairroErrors({});
    setShowBairroModal(true);
  };

  const handleEditBairro = (index: number, bairro: BairroFormData) => {
    setEditingBairroIndex(index);
    setBairroForm({ ...bairro });
    setBairroErrors({});
    setShowBairroModal(true);
  };

  const handleDeleteBairro = (index: number) => {
    if (confirm('Tem certeza que deseja remover este bairro?')) {
      setBairrosList(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleBairroChange = (field: keyof BairroFormData, value: string | number) => {
    setBairroForm(prev => ({ ...prev, [field]: value }));
    if (bairroErrors[field]) {
      setBairroErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateBairro = (): boolean => {
    const newErrors: { nome?: string; taxa_extra?: string } = {};
    if (!bairroForm.nome.trim()) newErrors.nome = 'Nome do bairro é obrigatório';
    if (bairroForm.taxa_extra < 0) newErrors.taxa_extra = 'Taxa não pode ser negativa';
    setBairroErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveBairro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBairro()) return;

    setBairrosList(prev => {
      const newList = [...prev];
      if (editingBairroIndex !== null) {
        newList[editingBairroIndex] = { ...bairroForm };
      } else {
        newList.push({ ...bairroForm });
      }
      return newList;
    });
    setShowBairroModal(false);
  };

  const handleBairrosAtendidosChange = (value: string) => {
    const bairros = value.split(',').map(b => b.trim()).filter(Boolean);
    setConfig(prev => ({ ...prev, bairros_atendidos: bairros }));
  };

  if (isLoading) {
    return (
      <>
        <Header currentPage="admin" showAdminLink />
        <ToastContainer />
        <LoadingOverlay message="Carregando configurações..." />
      </>
    );
  }

  return (
    <>
      <Header currentPage="admin" showAdminLink />
      <ToastContainer />

      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>CONFIGURAÇÕES DE ENTREGA</h1>
            <p className={styles.subtitle}>Configure taxas, raio de atendimento e bairros</p>
          </div>
        </header>

        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'geral', label: 'Geral' },
            { id: 'bairros', label: 'Bairros e Taxas' },
          ]}
          className={styles.tabs}
        />

        {/* Aba Geral */}
        <TabPanel id="geral" active={activeTab === 'geral'} className={styles.tabPanel}>
          <section className={styles.section} aria-labelledby="geral-title">
            <h2 id="geral-title" className={styles.sectionTitle}>CONFIGURAÇÕES GERAIS</h2>

            <div className={styles.fieldGroup}>
              <label htmlFor="taxa_fixa" className={styles.label}>Taxa Fixa de Entrega (R$)</label>
              <Input
                id="taxa_fixa"
                type="number"
                step="0.01"
                min="0"
                value={config.taxa_fixa}
                onChange={(e) => handleConfigChange('taxa_fixa', parseFloat(e.target.value) || 0)}
                className={styles.input}
              />
              <span className={styles.hint}>Taxa base aplicada a todas as entregas. Deixe 0 para taxa apenas por bairro.</span>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="gratuito_acima_de" className={styles.label}>Entrega Grátis Acima de (R$)</label>
              <Input
                id="gratuito_acima_de"
                type="number"
                step="0.01"
                min="0"
                value={config.gratuito_acima_de}
                onChange={(e) => handleConfigChange('gratuito_acima_de', parseFloat(e.target.value) || 0)}
                className={styles.input}
              />
              <span className={styles.hint}>Pedidos acima deste valor têm entrega gratuita. Deixe 0 para desativar.</span>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label htmlFor="raio_entrega_km" className={styles.label}>Raio de Entrega (km)</label>
                <Input
                  id="raio_entrega_km"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="50"
                  value={config.raio_entrega_km}
                  onChange={(e) => handleConfigChange('raio_entrega_km', parseFloat(e.target.value) || 5)}
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="tempo_medio_minutos" className={styles.label}>Tempo Médio (min)</label>
                <Input
                  id="tempo_medio_minutos"
                  type="number"
                  min="10"
                  max="120"
                  value={config.tempo_medio_minutos}
                  onChange={(e) => handleConfigChange('tempo_medio_minutos', parseInt(e.target.value) || 45)}
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="bairros_atendidos" className={styles.label}>Bairros Atendidos (separados por vírgula)</label>
              <Input
                id="bairros_atendidos"
                type="text"
                placeholder="Centro, Jardins, Vila Mariana, Moema..."
                value={config.bairros_atendidos.join(', ')}
                onChange={(e) => handleBairrosAtendidosChange(e.target.value)}
                className={styles.input}
              />
              <span className={styles.hint}>Lista de bairros onde a entrega está disponível. Deixe vazio para atender todos.</span>
            </div>

            <div className={styles.saveActions}>
              <Button variant="primary" size="lg" onClick={handleSaveConfig} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </div>
          </section>
        </TabPanel>

        {/* Aba Bairros */}
        <TabPanel id="bairros" active={activeTab === 'bairros'} className={styles.tabPanel}>
          <section className={styles.section} aria-labelledby="bairros-title">
            <div className={styles.sectionHeader}>
              <h2 id="bairros-title" className={styles.sectionTitle}>BAIRROS COM TAXA EXTRA</h2>
              <Button variant="primary" onClick={handleAddBairro}>
                + Adicionar Bairro
              </Button>
            </div>

            {bairrosList.length === 0 ? (
              <div className={styles.empty}>
                <p>Nenhum bairro com taxa extra configurado.</p>
                <p className={styles.emptyHint}>A taxa fixa será aplicada a todos os bairros atendidos.</p>
              </div>
            ) : (
              <div className={styles.bairrosList}>
                {bairrosList.map((bairro, index) => (
                  <div key={index} className={styles.bairroCard}>
                    <div className={styles.bairroInfo}>
                      <span className={styles.bairroNome}>{bairro.nome}</span>
                      <span className={styles.bairroTaxa}>Taxa extra: R$ {bairro.taxa_extra.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className={styles.bairroActions}>
                      <Button variant="ghost" size="sm" onClick={() => handleEditBairro(index, bairro)}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteBairro(index)} className={styles.deleteBtn}>
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabPanel>
      </div>

      {/* Modal Bairro */}
      <Modal
        isOpen={showBairroModal}
        onClose={() => setShowBairroModal(false)}
        title={editingBairroIndex !== null ? 'Editar Bairro' : 'Novo Bairro com Taxa Extra'}
        size="md"
      >
        <form onSubmit={handleSaveBairro} className={styles.modalForm}>
          <div className={styles.fieldGroup}>
            <label htmlFor="nome" className={styles.label}>
              Nome do Bairro <span className={styles.required}>*</span>
            </label>
            <Input
              id="nome"
              type="text"
              placeholder="Ex: Vila Olímpia"
              value={bairroForm.nome}
              onChange={(e) => handleBairroChange('nome', e.target.value)}
              error={bairroErrors.nome}
              className={styles.input}
              autoFocus
            />
            {bairroErrors.nome && <span className={styles.error}>{bairroErrors.nome}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="taxa_extra" className={styles.label}>
              Taxa Extra (R$) <span className={styles.required}>*</span>
            </label>
            <Input
              id="taxa_extra"
              type="number"
              step="0.01"
              min="0"
              value={bairroForm.taxa_extra}
              onChange={(e) => handleBairroChange('taxa_extra', parseFloat(e.target.value) || 0)}
              error={bairroErrors.taxa_extra}
              className={styles.input}
            />
            {bairroErrors.taxa_extra && <span className={styles.error}>{bairroErrors.taxa_extra}</span>}
            <span className={styles.hint}>Valor adicional à taxa fixa de entrega para este bairro.</span>
          </div>

          <div className={styles.modalActions}>
            <Button type="button" variant="secondary" onClick={() => setShowBairroModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editingBairroIndex !== null ? 'Atualizar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default AdminEntregaPage;