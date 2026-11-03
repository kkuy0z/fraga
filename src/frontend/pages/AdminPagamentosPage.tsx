/**
 * Página de Configuração de Pagamentos (Admin)
 */

import { useEffect, useState } from 'react';
import { Header, ToastContainer, LoadingOverlay, Button, Input, Switch, Card } from '@components';
import { useToast } from '@hooks';
import { api } from '@api/client';
import styles from './AdminPagamentosPage.module.css';

type ConfigPagamento = {
  // PIX
  pix_ativo: boolean;
  pix_chave: string;
  pix_nome_recebedor: string;
  pix_cidade: string;
  pix_tx_id: string;
  // Cartão
  cartao_credito_ativo: boolean;
  cartao_debito_ativo: boolean;
  maquininha_modelo: string;
  // Dinheiro
  dinheiro_ativo: boolean;
  troco_disponivel: boolean;
  // Geral
  aceitar_pagamento_entrega: boolean;
};

const initialConfig: ConfigPagamento = {
  pix_ativo: true,
  pix_chave: '',
  pix_nome_recebedor: '',
  pix_cidade: '',
  pix_tx_id: '',
  cartao_credito_ativo: true,
  cartao_debito_ativo: true,
  maquininha_modelo: '',
  dinheiro_ativo: true,
  troco_disponivel: true,
  aceitar_pagamento_entrega: true,
};

export function AdminPagamentosPage() {
  const { showToast } = useToast();
  const [config, setConfig] = useState<ConfigPagamento>(initialConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<ConfigPagamento>('/admin/pagamentos/config');
      setConfig(data);
    } catch {
      showToast('Erro ao carregar configurações de pagamento', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof ConfigPagamento, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/pagamentos/config', config);
      showToast('Configurações salvas com sucesso', 'success');
    } catch {
      showToast('Erro ao salvar configurações', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPix = async () => {
    try {
      await navigator.clipboard.writeText(config.pix_chave);
      setCopiado(true);
      showToast('Chave PIX copiada!', 'success');
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      showToast('Erro ao copiar', 'error');
    }
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
            <h1 className={styles.title}>FORMAS DE PAGAMENTO</h1>
            <p className={styles.subtitle}>Configure as opções de pagamento disponíveis</p>
          </div>
        </header>

        {/* PIX */}
        <section className={styles.section} aria-labelledby="pix-title">
          <div className={styles.sectionHeader}>
            <h2 id="pix-title" className={styles.sectionTitle}>
              <span className={styles.sectionIcon} aria-hidden="true">📱</span>
              PIX
            </h2>
            <Switch
              checked={config.pix_ativo}
              onChange={(checked) => handleChange('pix_ativo', checked)}
              label="Ativo"
              className={styles.ativoSwitch}
            />
          </div>

          {config.pix_ativo && (
            <div className={styles.pixFields}>
              <div className={styles.fieldGroup}>
                <label htmlFor="pix_chave" className={styles.label}>
                  Chave PIX <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWithButton}>
                  <Input
                    id="pix_chave"
                    type="text"
                    placeholder="Ex: 12345678900 (CPF) ou email@dominio.com"
                    value={config.pix_chave}
                    onChange={(e) => handleChange('pix_chave', e.target.value)}
                    className={styles.input}
                  />
                  <Button variant="secondary" size="sm" onClick={handleCopyPix} className={styles.copyBtn}>
                    {copiado ? '✓ Copiado' : '📋 Copiar'}
                  </Button>
                </div>
                <span className={styles.hint}>Chave PIX para recebimento (CPF, CNPJ, E-mail, Telefone ou Aleatória)</span>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="pix_nome_recebedor" className={styles.label}>Nome do Recebedor</label>
                  <Input
                    id="pix_nome_recebedor"
                    type="text"
                    placeholder="Fraga Lanches"
                    value={config.pix_nome_recebedor}
                    onChange={(e) => handleChange('pix_nome_recebedor', e.target.value)}
                    className={styles.input}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="pix_cidade" className={styles.label}>Cidade</label>
                  <Input
                    id="pix_cidade"
                    type="text"
                    placeholder="São Paulo"
                    value={config.pix_cidade}
                    onChange={(e) => handleChange('pix_cidade', e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="pix_tx_id" className={styles.label}>TX ID (opcional)</label>
                <Input
                  id="pix_tx_id"
                  type="text"
                  placeholder="Identificador da transação"
                  value={config.pix_tx_id}
                  onChange={(e) => handleChange('pix_tx_id', e.target.value)}
                  className={styles.input}
                />
                <span className={styles.hint}>Usado para conciliação. Deixe vazio para gerar automaticamente.</span>
              </div>

              <div className={styles.qrCodePreview}>
                <h4 className={styles.previewTitle}>Prévia do QR Code</h4>
                <div className={styles.qrPlaceholder}>
                  <span aria-hidden="true">📱</span>
                  <p>QR Code será gerado automaticamente no app do cliente</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Cartão */}
        <section className={styles.section} aria-labelledby="cartao-title">
          <div className={styles.sectionHeader}>
            <h2 id="cartao-title" className={styles.sectionTitle}>
              <span className={styles.sectionIcon} aria-hidden="true">💳</span>
              CARTÃO
            </h2>
          </div>

          <div className={styles.cardOptions}>
            <Card className={styles.optionCard} variant={config.cartao_credito_ativo ? 'default' : 'secondary'}>
              <div className={styles.optionHeader}>
                <span className={styles.optionIcon} aria-hidden="true">💳</span>
                <div>
                  <span className={styles.optionLabel}>Crédito</span>
                  <span className={styles.optionDesc}>Parcelado em até 12x</span>
                </div>
              </div>
              <Switch
                checked={config.cartao_credito_ativo}
                onChange={(checked) => handleChange('cartao_credito_ativo', checked)}
                label="Ativo"
                className={styles.optionSwitch}
              />
            </Card>

            <Card className={styles.optionCard} variant={config.cartao_debito_ativo ? 'default' : 'secondary'}>
              <div className={styles.optionHeader}>
                <span className={styles.optionIcon} aria-hidden="true">💳</span>
                <div>
                  <span className={styles.optionLabel}>Débito</span>
                  <span className={styles.optionDesc}>Pagamento à vista</span>
                </div>
              </div>
              <Switch
                checked={config.cartao_debito_ativo}
                onChange={(checked) => handleChange('cartao_debito_ativo', checked)}
                label="Ativo"
                className={styles.optionSwitch}
              />
            </Card>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="maquininha_modelo" className={styles.label}>Modelo da Maquininha</label>
            <Input
              id="maquininha_modelo"
              type="text"
              placeholder="Ex: Cielo Lio, Stone, Mercado Pago Point..."
              value={config.maquininha_modelo}
              onChange={(e) => handleChange('maquininha_modelo', e.target.value)}
              className={styles.input}
            />
            <span className={styles.hint}>Informativo para a equipe saber qual equipamento usar.</span>
          </div>
        </section>

        {/* Dinheiro */}
        <section className={styles.section} aria-labelledby="dinheiro-title">
          <div className={styles.sectionHeader}>
            <h2 id="dinheiro-title" className={styles.sectionTitle}>
              <span className={styles.sectionIcon} aria-hidden="true">💵</span>
              DINHEIRO
            </h2>
            <Switch
              checked={config.dinheiro_ativo}
              onChange={(checked) => handleChange('dinheiro_ativo', checked)}
              label="Ativo"
              className={styles.ativoSwitch}
            />
          </div>

          {config.dinheiro_ativo && (
            <div className={styles.dinheiroOptions}>
              <Switch
                checked={config.troco_disponivel}
                onChange={(checked) => handleChange('troco_disponivel', checked)}
                label="Disponibilizar troco"
                className={styles.optionSwitch}
              />
              <span className={styles.hint}>Permite que o cliente informe o valor para troco no checkout.</span>
            </div>
          )}
        </section>

        {/* Geral */}
        <section className={styles.section} aria-labelledby="geral-title">
          <h2 id="geral-title" className={styles.sectionTitle}>
            <span className={styles.sectionIcon} aria-hidden="true">⚙️</span>
            CONFIGURAÇÕES GERAIS
          </h2>

          <Switch
            checked={config.aceitar_pagamento_entrega}
            onChange={(checked) => handleChange('aceitar_pagamento_entrega', checked)}
            label="Aceitar pagamento na entrega"
            className={styles.geralSwitch}
          />
          <span className={styles.hint}>Permite que o cliente pague no momento da entrega/retirada.</span>
        </section>

        <div className={styles.saveActions}>
          <Button variant="primary" size="lg" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Todas as Configurações'}
          </Button>
        </div>
      </div>
    </>
  );
}

export default AdminPagamentosPage;