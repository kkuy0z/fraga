/**
 * Página de Checkout
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header, ToastContainer, LoadingOverlay, Button, Input, Select, Textarea } from '@components';
import { useCart, useAuth, useToast } from '@hooks';
import { api } from '@api/client';
import { formatarMoeda, formatarTelefone, formatarCEP, validarCPF } from '@shared/utils';
import { Endereco, PedidoRequest } from '@shared/types';
import styles from './CheckoutPage.module.css';

type FormData = {
  // Entrega
  tipoEntrega: 'delivery' | 'retirada';
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  referencia: string;
  // Pagamento
  formaPagamento: 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito';
  trocoPara: string;
  // Dados do cliente
  nome: string;
  telefone: string;
  cpf: string;
  email: string;
  observacoes: string;
};

const initialFormData: FormData = {
  tipoEntrega: 'delivery',
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  referencia: '',
  formaPagamento: 'dinheiro',
  trocoPara: '',
  nome: '',
  telefone: '',
  cpf: '',
  email: '',
  observacoes: '',
};

const estados = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export function CheckoutPage() {
  const navigate = useNavigate();
  const { cartItems, cartTotal, cartItemCount, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [taxaEntrega, setTaxaEntrega] = useState(0);

  // Preencher dados do usuário logado
  useEffect(() => {
    if (user && isAuthenticated) {
      setFormData(prev => ({
        ...prev,
        nome: user.nome || '',
        telefone: user.telefone || '',
        email: user.email || '',
        cpf: user.cpf || '',
      }));
    }
  }, [user, isAuthenticated]);

  // Buscar CEP
  const handleCEPBlur = useCallback(async () => {
    const cepLimpo = formData.cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setBuscandoCEP(true);
    try {
      const endereco = await api.get<Endereco>(`/cep/${cepLimpo}`);
      setFormData(prev => ({
        ...prev,
        endereco: endereco.logradouro || '',
        bairro: endereco.bairro || '',
        cidade: endereco.localidade || '',
        estado: endereco.uf || '',
      }));
    } catch {
      showToast('CEP não encontrado. Preencha manualmente.', 'warning');
    } finally {
      setBuscandoCEP(false);
    }
  }, [formData.cep, showToast]);

  // Calcular taxa de entrega
  useEffect(() => {
    if (formData.tipoEntrega === 'delivery' && formData.cep.replace(/\D/g, '').length === 8) {
      // Simulação - em produção viria da API
      setTaxaEntrega(5.00);
    } else {
      setTaxaEntrega(0);
    }
  }, [formData.tipoEntrega, formData.cep]);

  const handleChange = (field: keyof FormData, value: string) => {
    let formattedValue = value;

    // Formatação automática
    switch (field) {
      case 'telefone':
        formattedValue = formatarTelefone(value);
        break;
      case 'cep':
        formattedValue = formatarCEP(value);
        break;
      case 'cpf':
        formattedValue = value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        break;
    }

    setFormData(prev => ({ ...prev, [field]: formattedValue }));
    // Limpar erro ao digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (!formData.telefone.trim()) newErrors.telefone = 'Telefone é obrigatório';
    if (!formData.email.trim()) newErrors.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'E-mail inválido';

    if (formData.tipoEntrega === 'delivery') {
      if (!formData.cep.trim()) newErrors.cep = 'CEP é obrigatório';
      else if (formData.cep.replace(/\D/g, '').length !== 8) newErrors.cep = 'CEP inválido';
      if (!formData.endereco.trim()) newErrors.endereco = 'Endereço é obrigatório';
      if (!formData.numero.trim()) newErrors.numero = 'Número é obrigatório';
      if (!formData.bairro.trim()) newErrors.bairro = 'Bairro é obrigatório';
      if (!formData.cidade.trim()) newErrors.cidade = 'Cidade é obrigatória';
      if (!formData.estado.trim()) newErrors.estado = 'Estado é obrigatório';
    }

    if (formData.formaPagamento === 'dinheiro' && formData.trocoPara) {
      const troco = parseFloat(formData.trocoPara.replace(',', '.'));
      const total = cartTotal + taxaEntrega;
      if (troco < total) newErrors.trocoPara = 'Valor do troco deve ser maior ou igual ao total';
    }

    if (formData.cpf && !validarCPF(formData.cpf)) {
      newErrors.cpf = 'CPF inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Por favor, corrija os erros no formulário', 'error');
      return;
    }

    if (cartItems.length === 0) {
      showToast('Carrinho vazio', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const pedidoData: PedidoRequest = {
        itens: cartItems.map(item => ({
          produto_id: item.id,
          quantidade: item.quantidade,
          observacoes: item.observacoes,
        })),
        endereco_entrega: formData.tipoEntrega === 'delivery' ? {
          cep: formData.cep.replace(/\D/g, ''),
          logradouro: formData.endereco,
          numero: formData.numero,
          complemento: formData.complemento,
          bairro: formData.bairro,
          cidade: formData.cidade,
          estado: formData.estado,
          referencia: formData.referencia,
        } : undefined,
        forma_pagamento: formData.formaPagamento,
        troco_para: formData.formaPagamento === 'dinheiro' && formData.trocoPara
          ? parseFloat(formData.trocoPara.replace(',', '.'))
          : undefined,
        observacoes: formData.observacoes,
      };

      const pedido = await api.post<{ id: string; numero: string }>('/pedidos', pedidoData);

      clearCart();
      showToast(`Pedido #${pedido.numero} realizado com sucesso!`, 'success');
      navigate(`/pedido-confirmado/${pedido.id}`);
    } catch (error: any) {
      showToast(error.message || 'Erro ao finalizar pedido. Tente novamente.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoltar = () => {
    navigate('/carrinho');
  };

  const totalGeral = cartTotal + taxaEntrega;

  if (!isAuthenticated) {
    navigate('/login', { state: { redirect: '/checkout' } });
    return null;
  }

  return (
    <>
      <Header currentPage="checkout" cartItemCount={cartItemCount} />
      <ToastContainer />
      {isSubmitting && <LoadingOverlay message="Processando pedido..." />}

      <section className={styles.checkout} aria-label="Finalizar pedido">
        <div className={styles.container}>
          <header className={styles.header}>
            <Button variant="ghost" size="sm" onClick={handleVoltar} className={styles.backBtn} aria-label="Voltar">
              <span aria-hidden="true">←</span> Voltar
            </Button>
            <div>
              <h1 className={styles.title}>CHECKOUT</h1>
              <p className={styles.subtitle}>Revise seu pedido e finalize a compra</p>
            </div>
          </header>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {/* Progress indicator */}
            <div className={styles.progress} role="progressbar" aria-valuenow="1" aria-valuemin="1" aria-valuemax="3" aria-label="Progresso do checkout">
              <div className={`${styles.progressStep} ${styles.active}`}>
                <span className={styles.stepNumber}>1</span>
                <span className={styles.stepLabel}>Entrega</span>
              </div>
              <div className={`${styles.progressStep} ${styles.active}`}>
                <span className={styles.stepNumber}>2</span>
                <span className={styles.stepLabel}>Pagamento</span>
              </div>
              <div className={`${styles.progressStep} ${styles.active}`}>
                <span className={styles.stepNumber}>3</span>
                <span className={styles.stepLabel}>Confirmação</span>
              </div>
            </div>

            {/* Tipo de Entrega */}
            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>TIPO DE ENTREGA</legend>
              <div className={styles.radioGroup} role="radiogroup" aria-label="Tipo de entrega">
                <label className={`${styles.radioOption} ${formData.tipoEntrega === 'delivery' ? styles.selected : ''}`}>
                  <input
                    type="radio"
                    name="tipoEntrega"
                    value="delivery"
                    checked={formData.tipoEntrega === 'delivery'}
                    onChange={() => handleChange('tipoEntrega', 'delivery')}
                    className={styles.radioInput}
                  />
                  <span className={styles.radioLabel}>
                    <strong>🚚 Delivery</strong>
                    <small>Entrega no endereço</small>
                  </span>
                </label>
                <label className={`${styles.radioOption} ${formData.tipoEntrega === 'retirada' ? styles.selected : ''}`}>
                  <input
                    type="radio"
                    name="tipoEntrega"
                    value="retirada"
                    checked={formData.tipoEntrega === 'retirada'}
                    onChange={() => handleChange('tipoEntrega', 'retirada')}
                    className={styles.radioInput}
                  />
                  <span className={styles.radioLabel}>
                    <strong>🏪 Retirada</strong>
                    <small>Buscar no local</small>
                  </span>
                </label>
              </div>
            </fieldset>

            {/* Endereço (apenas delivery) */}
            {formData.tipoEntrega === 'delivery' && (
              <fieldset className={styles.section}>
                <legend className={styles.sectionTitle}>ENDEREÇO DE ENTREGA</legend>
                <div className={styles.addressGrid}>
                  <div className={styles.field}>
                    <label htmlFor="cep" className={styles.label}>CEP <span className={styles.required}>*</span></label>
                    <Input
                      id="cep"
                      type="text"
                      placeholder="00000-000"
                      value={formData.cep}
                      onChange={(e) => handleChange('cep', e.target.value)}
                      onBlur={handleCEPBlur}
                      disabled={buscandoCEP}
                      error={errors.cep}
                      className={styles.input}
                    />
                    {buscandoCEP && <span className={styles.loading} aria-live="polite">Buscando...</span>}
                  </div>

                  <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="endereco" className={styles.label}>Endereço <span className={styles.required}>*</span></label>
                    <Input
                      id="endereco"
                      type="text"
                      placeholder="Rua, Avenida, etc."
                      value={formData.endereco}
                      onChange={(e) => handleChange('endereco', e.target.value)}
                      error={errors.endereco}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="numero" className={styles.label}>Número <span className={styles.required}>*</span></label>
                    <Input
                      id="numero"
                      type="text"
                      placeholder="123"
                      value={formData.numero}
                      onChange={(e) => handleChange('numero', e.target.value)}
                      error={errors.numero}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="complemento" className={styles.label}>Complemento</label>
                    <Input
                      id="complemento"
                      type="text"
                      placeholder="Apto, Bloco, Casa"
                      value={formData.complemento}
                      onChange={(e) => handleChange('complemento', e.target.value)}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="bairro" className={styles.label}>Bairro <span className={styles.required}>*</span></label>
                    <Input
                      id="bairro"
                      type="text"
                      placeholder="Centro"
                      value={formData.bairro}
                      onChange={(e) => handleChange('bairro', e.target.value)}
                      error={errors.bairro}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="cidade" className={styles.label}>Cidade <span className={styles.required}>*</span></label>
                    <Input
                      id="cidade"
                      type="text"
                      placeholder="São Paulo"
                      value={formData.cidade}
                      onChange={(e) => handleChange('cidade', e.target.value)}
                      error={errors.cidade}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="estado" className={styles.label}>Estado <span className={styles.required}>*</span></label>
                    <Select
                      id="estado"
                      value={formData.estado}
                      onChange={(e) => handleChange('estado', e.target.value)}
                      error={errors.estado}
                      className={styles.select}
                    >
                      <option value="">Selecione</option>
                      {estados.map(uf => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </Select>
                  </div>

                  <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="referencia" className={styles.label}>Ponto de Referência</label>
                    <Input
                      id="referencia"
                      type="text"
                      placeholder="Próximo à praça, mercado, etc."
                      value={formData.referencia}
                      onChange={(e) => handleChange('referencia', e.target.value)}
                      className={styles.input}
                    />
                  </div>
                </div>
              </fieldset>
            )}

            {/* Forma de Pagamento */}
            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>FORMA DE PAGAMENTO</legend>
              <div className={styles.paymentOptions} role="radiogroup" aria-label="Forma de pagamento">
                {[
                  { value: 'dinheiro', label: '💵 Dinheiro', desc: 'Pagamento na entrega' },
                  { value: 'pix', label: '📱 PIX', desc: 'QR Code na entrega' },
                  { value: 'cartao_credito', label: '💳 Cartão de Crédito', desc: 'Máquina na entrega' },
                  { value: 'cartao_debito', label: '💳 Cartão de Débito', desc: 'Máquina na entrega' },
                ].map(opt => (
                  <label key={opt.value} className={`${styles.paymentOption} ${formData.formaPagamento === opt.value ? styles.selected : ''}`}>
                    <input
                      type="radio"
                      name="formaPagamento"
                      value={opt.value}
                      checked={formData.formaPagamento === opt.value}
                      onChange={() => handleChange('formaPagamento', opt.value)}
                      className={styles.radioInput}
                    />
                    <span className={styles.paymentLabel}>
                      <strong>{opt.label}</strong>
                      <small>{opt.desc}</small>
                    </span>
                  </label>
                ))}
              </div>

              {/* Troco para dinheiro */}
              {formData.formaPagamento === 'dinheiro' && (
                <div className={styles.field}>
                  <label htmlFor="trocoPara" className={styles.label}>Troco para (opcional)</label>
                  <Input
                    id="trocoPara"
                    type="text"
                    placeholder="Ex: 50,00"
                    value={formData.trocoPara}
                    onChange={(e) => handleChange('trocoPara', e.target.value)}
                    error={errors.trocoPara}
                    className={styles.input}
                  />
                </div>
              )}
            </fieldset>

            {/* Dados do Cliente */}
            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>DADOS DO CLIENTE</legend>
              <div className={styles.clientGrid}>
                <div className={styles.field}>
                  <label htmlFor="nome" className={styles.label}>Nome Completo <span className={styles.required}>*</span></label>
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Seu nome completo"
                    value={formData.nome}
                    onChange={(e) => handleChange('nome', e.target.value)}
                    error={errors.nome}
                    className={styles.input}
                    autoComplete="name"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="telefone" className={styles.label}>Telefone <span className={styles.required}>*</span></label>
                  <Input
                    id="telefone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={formData.telefone}
                    onChange={(e) => handleChange('telefone', e.target.value)}
                    error={errors.telefone}
                    className={styles.input}
                    autoComplete="tel"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="email" className={styles.label}>E-mail <span className={styles.required}>*</span></label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    error={errors.email}
                    className={styles.input}
                    autoComplete="email"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="cpf" className={styles.label}>CPF</label>
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={(e) => handleChange('cpf', e.target.value)}
                    error={errors.cpf}
                    className={styles.input}
                  />
                </div>
              </div>
            </fieldset>

            {/* Observações */}
            <fieldset className={styles.section}>
              <legend className={styles.sectionTitle}>OBSERVAÇÕES</legend>
              <Textarea
                id="observacoes"
                placeholder="Observações sobre o pedido (alergias, preferências, etc.)"
                value={formData.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                rows={3}
                className={styles.textarea}
              />
            </fieldset>

            {/* Resumo do Pedido */}
            <div className={styles.orderSummary}>
              <h2 className={styles.summaryTitle}>Resumo do Pedido</h2>
              <div className={styles.summaryItems}>
                {cartItems.map(item => (
                  <div key={item.id} className={styles.summaryItem}>
                    <div className={styles.summaryItemInfo}>
                      <span className={styles.summaryItemName}>{item.nome}</span>
                      <span className={styles.summaryItemQty}>x{item.quantidade}</span>
                    </div>
                    <span className={styles.summaryItemPrice}>
                      {formatarMoeda(item.preco * item.quantidade)}
                    </span>
                  </div>
                ))}
              </div>
              <div className={styles.summaryTotals}>
                <div className={styles.totalLine}>
                  <span>Subtotal</span>
                  <span>{formatarMoeda(cartTotal)}</span>
                </div>
                {formData.tipoEntrega === 'delivery' && taxaEntrega > 0 && (
                  <div className={styles.totalLine}>
                    <span>Taxa de Entrega</span>
                    <span>{formatarMoeda(taxaEntrega)}</span>
                  </div>
                )}
                <div className={styles.totalLine} style={{ fontWeight: 'bold', fontSize: 'var(--font-size-lg)' }}>
                  <span>Total</span>
                  <span>{formatarMoeda(totalGeral)}</span>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isSubmitting || cartItems.length === 0}
              className={styles.submitBtn}
            >
              {isSubmitting ? 'Processando...' : `Finalizar Pedido - ${formatarMoeda(totalGeral)}`}
            </Button>

            <p className={styles.secureNote}>
              <span aria-hidden="true">🔒</span>
              Seus dados estão protegidos. Pagamento apenas na entrega.
            </p>
          </form>
        </div>
      </section>
    </>
  );
}

export default CheckoutPage;