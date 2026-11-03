/**
 * Página de Perfil do Cliente
 */

import { useState, useEffect } from 'react';
import { Header, ToastContainer, Button, Input, Tabs, TabList, Tab, TabPanel } from '@components';
import { useAuth, useToast } from '@hooks';
import { api } from '@api/client';
import { formatarData, formatarMoeda, formatarTelefone, formatarCEP, validarCPF } from '@shared/utils';
import { Usuario, Pedido } from '@shared/types';
import styles from './PerfilPage.module.css';

type ProfileFormData = {
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
};

type PasswordFormData = {
  senhaAtual: string;
  novaSenha: string;
  confirmarNovaSenha: string;
};

type AddressFormData = {
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  principal: boolean;
};

const initialProfileData: ProfileFormData = {
  nome: '',
  email: '',
  telefone: '',
  cpf: '',
};

const initialPasswordData: PasswordFormData = {
  senhaAtual: '',
  novaSenha: '',
  confirmarNovaSenha: '',
};

const initialAddressData: AddressFormData = {
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  principal: false,
};

const estados = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export function PerfilPage() {
  const { user, updateProfile, changePassword, logout, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'perfil' | 'pedidos' | 'enderecos' | 'seguranca'>('perfil');
  const [profileData, setProfileData] = useState<ProfileFormData>(initialProfileData);
  const [passwordData, setPasswordData] = useState<PasswordFormData>(initialPasswordData);
  const [addresses, setAddresses] = useState<Array<AddressFormData & { id: string }>>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressFormData, setAddressFormData] = useState<AddressFormData>(initialAddressData);
  const [profileErrors, setProfileErrors] = useState<Partial<ProfileFormData>>({});
  const [passwordErrors, setPasswordErrors] = useState<Partial<PasswordFormData>>({});
  const [addressErrors, setAddressErrors] = useState<Partial<AddressFormData>>({});
  const [saving, setSaving] = useState(false);

  // Carregar dados do usuário
  useEffect(() => {
    if (user) {
      setProfileData({
        nome: user.nome || '',
        email: user.email || '',
        telefone: user.telefone ? formatarTelefone(user.telefone) : '',
        cpf: user.cpf || '',
      });
    }
  }, [user]);

  // Carregar pedidos e endereços
  useEffect(() => {
    if (user) {
      loadPedidos();
      loadEnderecos();
    }
  }, [user]);

  const loadPedidos = async () => {
    try {
      const data = await api.get<Pedido[]>('/cliente/pedidos');
      setPedidos(data);
    } catch {
      // Silencioso
    }
  };

  const loadEnderecos = async () => {
    try {
      const data = await api.get<Array<AddressFormData & { id: string }>>('/cliente/enderecos');
      setAddresses(data);
    } catch {
      // Silencioso
    }
  };

  const handleProfileChange = (field: keyof ProfileFormData, value: string) => {
    let formattedValue = value;
    if (field === 'telefone') {
      formattedValue = formatarTelefone(value);
    } else if (field === 'cpf') {
      formattedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2');
    }
    setProfileData(prev => ({ ...prev, [field]: formattedValue }));
    if (profileErrors[field]) {
      setProfileErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handlePasswordChange = (field: keyof PasswordFormData, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
    if (passwordErrors[field]) {
      setPasswordErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleAddressChange = (field: keyof AddressFormData, value: string | boolean) => {
    let formattedValue = value;
    if (field === 'cep' && typeof value === 'string') {
      formattedValue = formatarCEP(value);
    }
    setAddressFormData(prev => ({ ...prev, [field]: formattedValue }));
    if (addressErrors[field]) {
      setAddressErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateProfile = (): boolean => {
    const newErrors: Partial<ProfileFormData> = {};
    if (!profileData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (!profileData.email.trim()) newErrors.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileData.email)) newErrors.email = 'E-mail inválido';
    if (!profileData.telefone.trim()) newErrors.telefone = 'Telefone é obrigatório';
    if (!profileData.cpf.trim()) newErrors.cpf = 'CPF é obrigatório';
    else if (!validarCPF(profileData.cpf)) newErrors.cpf = 'CPF inválido';
    setProfileErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = (): boolean => {
    const newErrors: Partial<PasswordFormData> = {};
    if (!passwordData.senhaAtual) newErrors.senhaAtual = 'Senha atual é obrigatória';
    if (!passwordData.novaSenha) newErrors.novaSenha = 'Nova senha é obrigatória';
    else if (passwordData.novaSenha.length < 6) newErrors.novaSenha = 'Mínimo 6 caracteres';
    if (!passwordData.confirmarNovaSenha) newErrors.confirmarNovaSenha = 'Confirme a nova senha';
    else if (passwordData.novaSenha !== passwordData.confirmarNovaSenha) newErrors.confirmarNovaSenha = 'Senhas não conferem';
    setPasswordErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateAddress = (): boolean => {
    const newErrors: Partial<AddressFormData> = {};
    if (!addressFormData.cep.trim()) newErrors.cep = 'CEP é obrigatório';
    else if (addressFormData.cep.replace(/\D/g, '').length !== 8) newErrors.cep = 'CEP inválido';
    if (!addressFormData.endereco.trim()) newErrors.endereco = 'Endereço é obrigatório';
    if (!addressFormData.numero.trim()) newErrors.numero = 'Número é obrigatório';
    if (!addressFormData.bairro.trim()) newErrors.bairro = 'Bairro é obrigatório';
    if (!addressFormData.cidade.trim()) newErrors.cidade = 'Cidade é obrigatória';
    if (!addressFormData.estado.trim()) newErrors.estado = 'Estado é obrigatório';
    setAddressErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) return;
    setSaving(true);
    try {
      await updateProfile({
        nome: profileData.nome.trim(),
        telefone: profileData.telefone.replace(/\D/g, ''),
        cpf: profileData.cpf.replace(/\D/g, ''),
      });
      showToast('Perfil atualizado com sucesso!', 'success');
      setIsEditing(false);
    } catch (error: any) {
      showToast(error.message || 'Erro ao atualizar perfil', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) return;
    setSaving(true);
    try {
      await changePassword(passwordData.senhaAtual, passwordData.novaSenha);
      showToast('Senha alterada com sucesso!', 'success');
      setPasswordData(initialPasswordData);
    } catch (error: any) {
      if (error.message?.includes('atual')) {
        setPasswordErrors({ senhaAtual: 'Senha atual incorreta' });
      } else {
        showToast(error.message || 'Erro ao alterar senha', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!validateAddress()) return;
    setSaving(true);
    try {
      if (editingAddressId) {
        await api.put(`/cliente/enderecos/${editingAddressId}`, addressFormData);
        showToast('Endereço atualizado!', 'success');
      } else {
        await api.post('/cliente/enderecos', addressFormData);
        showToast('Endereço adicionado!', 'success');
      }
      setIsAddingAddress(false);
      setEditingAddressId(null);
      setAddressFormData(initialAddressData);
      loadEnderecos();
    } catch (error: any) {
      showToast(error.message || 'Erro ao salvar endereço', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditAddress = (address: AddressFormData & { id: string }) => {
    setEditingAddressId(address.id);
    setAddressFormData({
      cep: address.cep,
      endereco: address.endereco,
      numero: address.numero,
      complemento: address.complemento,
      bairro: address.bairro,
      cidade: address.cidade,
      estado: address.estado,
      principal: address.principal,
    });
    setIsAddingAddress(true);
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este endereço?')) return;
    try {
      await api.delete(`/cliente/enderecos/${id}`);
      showToast('Endereço removido', 'success');
      loadEnderecos();
    } catch {
      showToast('Erro ao remover endereço', 'error');
    }
  };

  const handleNewAddress = () => {
    setEditingAddressId(null);
    setAddressFormData(initialAddressData);
    setIsAddingAddress(true);
  };

  const handleCancelAddress = () => {
    setIsAddingAddress(false);
    setEditingAddressId(null);
    setAddressFormData(initialAddressData);
    setAddressErrors({});
  };

  const handleLogout = () => {
    if (confirm('Tem certeza que deseja sair?')) {
      logout();
      showToast('Você saiu da sua conta', 'info');
    }
  };

  if (authLoading || !user) {
    return (
      <>
        <Header currentPage="perfil" />
        <ToastContainer />
        <div className={styles.loading}>Carregando...</div>
      </>
    );
  }

  return (
    <>
      <Header currentPage="perfil" />
      <ToastContainer />

      <section className={styles.perfil} aria-label="Meu Perfil">
        <div className={styles.container}>
          <header className={styles.header}>
            <div className={styles.userInfo}>
              <div className={styles.avatar}>
                {user.nome?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <h1 className={styles.title}>{user.nome}</h1>
                <p className={styles.email}>{user.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className={styles.logoutBtn}>
              Sair
            </Button>
          </header>

          <Tabs
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'perfil', label: 'Perfil' },
              { id: 'pedidos', label: 'Meus Pedidos' },
              { id: 'enderecos', label: 'Endereços' },
              { id: 'seguranca', label: 'Segurança' },
            ]}
            className={styles.tabs}
          />

          {/* Aba Perfil */}
          <TabPanel id="perfil" active={activeTab === 'perfil'} className={styles.tabPanel}>
            {isEditing ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} className={styles.form}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="nome" className={styles.label}>Nome Completo <span className={styles.required}>*</span></label>
                  <Input
                    id="nome"
                    type="text"
                    value={profileData.nome}
                    onChange={(e) => handleProfileChange('nome', e.target.value)}
                    error={profileErrors.nome}
                    className={styles.input}
                  />
                  {profileErrors.nome && <span className={styles.error}>{profileErrors.nome}</span>}
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="email" className={styles.label}>E-mail <span className={styles.required}>*</span></label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => handleProfileChange('email', e.target.value)}
                    error={profileErrors.email}
                    className={styles.input}
                    disabled
                  />
                  <span className={styles.hint}>O e-mail não pode ser alterado</span>
                  {profileErrors.email && <span className={styles.error}>{profileErrors.email}</span>}
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="telefone" className={styles.label}>Telefone <span className={styles.required}>*</span></label>
                  <Input
                    id="telefone"
                    type="tel"
                    value={profileData.telefone}
                    onChange={(e) => handleProfileChange('telefone', e.target.value)}
                    error={profileErrors.telefone}
                    className={styles.input}
                  />
                  {profileErrors.telefone && <span className={styles.error}>{profileErrors.telefone}</span>}
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="cpf" className={styles.label}>CPF <span className={styles.required}>*</span></label>
                  <Input
                    id="cpf"
                    type="text"
                    value={profileData.cpf}
                    onChange={(e) => handleProfileChange('cpf', e.target.value)}
                    error={profileErrors.cpf}
                    className={styles.input}
                  />
                  {profileErrors.cpf && <span className={styles.error}>{profileErrors.cpf}</span>}
                </div>

                <div className={styles.formActions}>
                  <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className={styles.profileView}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Nome</span>
                  <span className={styles.infoValue}>{profileData.nome || 'Não informado'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>E-mail</span>
                  <span className={styles.infoValue}>{profileData.email}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Telefone</span>
                  <span className={styles.infoValue}>{profileData.telefone || 'Não informado'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>CPF</span>
                  <span className={styles.infoValue}>{profileData.cpf || 'Não informado'}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Cliente desde</span>
                  <span className={styles.infoValue}>{user.created_at ? formatarData(user.created_at) : 'Não informado'}</span>
                </div>
                <Button variant="secondary" onClick={() => setIsEditing(true)} className={styles.editBtn}>
                  Editar Perfil
                </Button>
              </div>
            )}
          </TabPanel>

          {/* Aba Pedidos */}
          <TabPanel id="pedidos" active={activeTab === 'pedidos'} className={styles.tabPanel}>
            {pedidos.length === 0 ? (
              <div className={styles.empty}>
                <p>Você ainda não fez nenhum pedido.</p>
                <Button variant="primary" onClick={() => window.location.href = '/cardapio'}>Ver Cardápio</Button>
              </div>
            ) : (
              <div className={styles.ordersList}>
                {pedidos.map(pedido => (
                  <article key={pedido.id} className={styles.orderCard}>
                    <header className={styles.orderHeader}>
                      <div>
                        <span className={styles.orderNumber}>Pedido #{pedido.numero}</span>
                        <span className={`${styles.orderStatus} ${styles[pedido.status as keyof typeof styles]}`}>
                          {pedido.status}
                        </span>
                      </div>
                      <span className={styles.orderDate}>{formatarData(pedido.created_at)}</span>
                    </header>
                    <div className={styles.orderItems}>
                      {pedido.itens.slice(0, 3).map(item => (
                        <div key={item.produto_id} className={styles.orderItem}>
                          <span>{item.produto_nome} x{item.quantidade}</span>
                          <span>{formatarMoeda(item.preco * item.quantidade)}</span>
                        </div>
                      ))}
                      {pedido.itens.length > 3 && (
                        <span className={styles.moreItems}>+{pedido.itens.length - 3} itens</span>
                      )}
                    </div>
                    <footer className={styles.orderFooter}>
                      <span className={styles.orderTotal}>Total: {formatarMoeda(pedido.total)}</span>
                      <Button variant="ghost" size="sm">Ver Detalhes</Button>
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </TabPanel>

          {/* Aba Endereços */}
          <TabPanel id="enderecos" active={activeTab === 'enderecos'} className={styles.tabPanel}>
            {isAddingAddress ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSaveAddress(); }} className={styles.addressForm}>
                <h3 className={styles.formTitle}>
                  {editingAddressId ? 'Editar Endereço' : 'Novo Endereço'}
                </h3>
                <div className={styles.fieldGroup}>
                  <label htmlFor="cep" className={styles.label}>CEP <span className={styles.required}>*</span></label>
                  <Input
                    id="cep"
                    type="text"
                    placeholder="00000-000"
                    value={addressFormData.cep}
                    onChange={(e) => handleAddressChange('cep', e.target.value)}
                    error={addressErrors.cep}
                    className={styles.input}
                  />
                  {addressErrors.cep && <span className={styles.error}>{addressErrors.cep}</span>}
                </div>
                <div className={styles.fieldGroup}>
                  <label htmlFor="endereco" className={styles.label}>Endereço <span className={styles.required}>*</span></label>
                  <Input
                    id="endereco"
                    type="text"
                    placeholder="Rua, Avenida"
                    value={addressFormData.endereco}
                    onChange={(e) => handleAddressChange('endereco', e.target.value)}
                    error={addressErrors.endereco}
                    className={styles.input}
                  />
                  {addressErrors.endereco && <span className={styles.error}>{addressErrors.endereco}</span>}
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="numero" className={styles.label}>Número <span className={styles.required}>*</span></label>
                    <Input
                      id="numero"
                      type="text"
                      value={addressFormData.numero}
                      onChange={(e) => handleAddressChange('numero', e.target.value)}
                      error={addressErrors.numero}
                      className={styles.input}
                    />
                    {addressErrors.numero && <span className={styles.error}>{addressErrors.numero}</span>}
                  </div>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="complemento" className={styles.label}>Complemento</label>
                    <Input
                      id="complemento"
                      type="text"
                      placeholder="Apto, Bloco"
                      value={addressFormData.complemento}
                      onChange={(e) => handleAddressChange('complemento', e.target.value)}
                      className={styles.input}
                    />
                  </div>
                </div>
                <div className={styles.fieldRow}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="bairro" className={styles.label}>Bairro <span className={styles.required}>*</span></label>
                    <Input
                      id="bairro"
                      type="text"
                      value={addressFormData.bairro}
                      onChange={(e) => handleAddressChange('bairro', e.target.value)}
                      error={addressErrors.bairro}
                      className={styles.input}
                    />
                    {addressErrors.bairro && <span className={styles.error}>{addressErrors.bairro}</span>}
                  </div>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="cidade" className={styles.label}>Cidade <span className={styles.required}>*</span></label>
                    <Input
                      id="cidade"
                      type="text"
                      value={addressFormData.cidade}
                      onChange={(e) => handleAddressChange('cidade', e.target.value)}
                      error={addressErrors.cidade}
                      className={styles.input}
                    />
                    {addressErrors.cidade && <span className={styles.error}>{addressErrors.cidade}</span>}
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label htmlFor="estado" className={styles.label}>Estado <span className={styles.required}>*</span></label>
                  <select
                    id="estado"
                    value={addressFormData.estado}
                    onChange={(e) => handleAddressChange('estado', e.target.value)}
                    className={styles.input}
                  >
                    <option value="">Selecione</option>
                    {estados.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                  {addressErrors.estado && <span className={styles.error}>{addressErrors.estado}</span>}
                </div>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={addressFormData.principal}
                    onChange={(e) => handleAddressChange('principal', e.target.checked)}
                  />
                  <span>Endereço principal</span>
                </label>
                <div className={styles.formActions}>
                  <Button type="button" variant="secondary" onClick={handleCancelAddress}>Cancelar</Button>
                  <Button type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar Endereço'}
                  </Button>
                </div>
              </form>
            ) : (
              <div>
                <div className={styles.addressesHeader}>
                  <h3 className={styles.sectionTitle}>Meus Endereços</h3>
                  <Button variant="primary" size="sm" onClick={handleNewAddress}>
                    + Novo Endereço
                  </Button>
                </div>
                {addresses.length === 0 ? (
                  <div className={styles.empty}>
                    <p>Nenhum endereço cadastrado.</p>
                    <Button variant="primary" onClick={handleNewAddress}>Adicionar Endereço</Button>
                  </div>
                ) : (
                  <div className={styles.addressesList}>
                    {addresses.map(address => (
                      <article key={address.id} className={styles.addressCard}>
                        {address.principal && <span className={styles.badgePrincipal}>Principal</span>}
                        <div className={styles.addressInfo}>
                          <p className={styles.addressStreet}>{address.endereco}, {address.numero}</p>
                          {address.complemento && <p className={styles.addressComplement}>{address.complemento}</p>}
                          <p className={styles.addressDetails}>
                            {address.bairro} - {address.cidade}/{address.estado} - CEP: {address.cep}
                          </p>
                        </div>
                        <div className={styles.addressActions}>
                          <Button variant="ghost" size="sm" onClick={() => handleEditAddress(address)}>Editar</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteAddress(address.id)} className={styles.deleteBtn}>
                            Excluir
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabPanel>

          {/* Aba Segurança */}
          <TabPanel id="seguranca" active={activeTab === 'seguranca'} className={styles.tabPanel}>
            <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }} className={styles.form}>
              <h3 className={styles.formTitle}>Alterar Senha</h3>
              <div className={styles.fieldGroup}>
                <label htmlFor="senhaAtual" className={styles.label}>Senha Atual <span className={styles.required}>*</span></label>
                <Input
                  id="senhaAtual"
                  type="password"
                  value={passwordData.senhaAtual}
                  onChange={(e) => handlePasswordChange('senhaAtual', e.target.value)}
                  error={passwordErrors.senhaAtual}
                  className={styles.input}
                  autoComplete="current-password"
                />
                {passwordErrors.senhaAtual && <span className={styles.error}>{passwordErrors.senhaAtual}</span>}
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="novaSenha" className={styles.label}>Nova Senha <span className={styles.required}>*</span></label>
                <Input
                  id="novaSenha"
                  type="password"
                  value={passwordData.novaSenha}
                  onChange={(e) => handlePasswordChange('novaSenha', e.target.value)}
                  error={passwordErrors.novaSenha}
                  className={styles.input}
                  autoComplete="new-password"
                />
                {passwordErrors.novaSenha && <span className={styles.error}>{passwordErrors.novaSenha}</span>}
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="confirmarNovaSenha" className={styles.label}>Confirmar Nova Senha <span className={styles.required}>*</span></label>
                <Input
                  id="confirmarNovaSenha"
                  type="password"
                  value={passwordData.confirmarNovaSenha}
                  onChange={(e) => handlePasswordChange('confirmarNovaSenha', e.target.value)}
                  error={passwordErrors.confirmarNovaSenha}
                  className={styles.input}
                  autoComplete="new-password"
                />
                {passwordErrors.confirmarNovaSenha && <span className={styles.error}>{passwordErrors.confirmarNovaSenha}</span>}
              </div>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </form>
          </TabPanel>
        </div>
      </section>
    </>
  );
}

export default PerfilPage;