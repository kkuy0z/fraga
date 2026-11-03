/**
 * Página de Gerenciamento de Usuários (Admin)
 */

import { useEffect, useState } from 'react';
import { Header, ToastContainer, LoadingOverlay, Modal, Button, Input, ConfirmDialog, Badge } from '@components';
import { useToast } from '@hooks';
import { api } from '@api/client';
import { formatarData } from '@shared/utils';
import { Usuario } from '@shared/types';
import styles from './AdminUsuariosPage.module.css';

export function AdminUsuariosPage() {
  const { showToast } = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    senha: '',
    papel: 'cliente' as 'cliente' | 'admin',
    ativo: true,
  });
  const [errors, setErrors] = useState<{ nome?: string; email?: string; cpf?: string; senha?: string }>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<Usuario[]>('/admin/usuarios');
      setUsuarios(data);
    } catch {
      showToast('Erro ao carregar usuários', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNew = () => {
    setEditingUsuario(null);
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      cpf: '',
      senha: '',
      papel: 'cliente',
      ativo: true,
    });
    setErrors({});
    setShowModal(true);
  };

  const handleEdit = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setFormData({
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone || '',
      cpf: usuario.cpf || '',
      senha: '', // Não preencher senha por segurança
      papel: usuario.papel,
      ativo: usuario.ativo,
    });
    setErrors({});
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await api.delete(`/admin/usuarios/${deletingId}`);
      showToast('Usuário excluído com sucesso', 'success');
      loadUsuarios();
    } catch {
      showToast('Erro ao excluir usuário', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { nome?: string; email?: string; cpf?: string; senha?: string } = {};
    if (!formData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (!formData.email.trim()) newErrors.email = 'E-mail é obrigatório';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'E-mail inválido';
    if (formData.cpf && !/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(formData.cpf.replace(/\D/g, ''))) newErrors.cpf = 'CPF inválido';
    if (!editingUsuario && !formData.senha) newErrors.senha = 'Senha é obrigatória';
    else if (formData.senha && formData.senha.length < 6) newErrors.senha = 'Mínimo 6 caracteres';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const submitData = { ...formData };
      if (!submitData.senha) delete submitData.senha;

      if (editingUsuario) {
        await api.put(`/admin/usuarios/${editingUsuario.id}`, submitData);
        showToast('Usuário atualizado com sucesso', 'success');
      } else {
        await api.post('/admin/usuarios', submitData);
        showToast('Usuário criado com sucesso', 'success');
      }
      setShowModal(false);
      loadUsuarios();
    } catch (error: any) {
      if (error.message?.includes('duplicado') || error.message?.includes('unique')) {
        setErrors({ email: 'Este e-mail já está cadastrado' });
      } else {
        showToast(error.message || 'Erro ao salvar usuário', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const filteredUsuarios = usuarios.filter(u =>
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <>
        <Header currentPage="admin" showAdminLink />
        <ToastContainer />
        <LoadingOverlay message="Carregando usuários..." />
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
            <h1 className={styles.title}>USUÁRIOS</h1>
            <p className={styles.subtitle}>Gerencie usuários e administradores</p>
          </div>
          <Button variant="primary" onClick={handleNew}>
            + Novo Usuário
          </Button>
        </header>

        <div className={styles.searchWrapper}>
          <Input
            type="search"
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {filteredUsuarios.length === 0 ? (
          <div className={styles.empty}>
            <p>Nenhum usuário encontrado.</p>
            {!searchTerm && <Button variant="primary" onClick={handleNew}>Criar primeiro usuário</Button>}
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table} role="table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Telefone</th>
                  <th scope="col">Papel</th>
                  <th scope="col">Status</th>
                  <th scope="col">Cadastro</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsuarios.map(usuario => (
                  <tr key={usuario.id}>
                    <td>
                      <span className={styles.usuarioNome}>{usuario.nome}</span>
                    </td>
                    <td>{usuario.email}</td>
                    <td>{usuario.telefone || '-'}</td>
                    <td>
                      <Badge variant={usuario.papel === 'admin' ? 'warning' : 'info'}>
                        {usuario.papel.toUpperCase()}
                      </Badge>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${usuario.ativo ? styles.ativo : styles.inativo}`}>
                        {usuario.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className={styles.dataCell}>{formatarData(usuario.created_at)}</td>
                    <td>
                      <div className={styles.actions}>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(usuario)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(usuario.id)} className={styles.deleteBtn}>
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUsuario ? 'Editar Usuário' : 'Novo Usuário'}
        size="md"
      >
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.fieldGroup}>
            <label htmlFor="nome" className={styles.label}>
              Nome <span className={styles.required}>*</span>
            </label>
            <Input
              id="nome"
              type="text"
              placeholder="Nome completo"
              value={formData.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              error={errors.nome}
              className={styles.input}
              autoFocus
            />
            {errors.nome && <span className={styles.error}>{errors.nome}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="email" className={styles.label}>
              E-mail <span className={styles.required}>*</span>
            </label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@email.com"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              error={errors.email}
              className={styles.input}
            />
            {errors.email && <span className={styles.error}>{errors.email}</span>}
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label htmlFor="telefone" className={styles.label}>Telefone</label>
              <Input
                id="telefone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={formData.telefone}
                onChange={(e) => handleChange('telefone', e.target.value)}
                className={styles.input}
              />
            </div>

            <div className={styles.fieldGroup}>
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
              {errors.cpf && <span className={styles.error}>{errors.cpf}</span>}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="senha" className={styles.label}>
              Senha {editingUsuario ? '(deixe em branco para não alterar)' : '<span className={styles.required}>*</span>'}
            </label>
            <Input
              id="senha"
              type="password"
              placeholder={editingUsuario ? 'Nova senha (opcional)' : 'Mínimo 6 caracteres'}
              value={formData.senha}
              onChange={(e) => handleChange('senha', e.target.value)}
              error={errors.senha}
              className={styles.input}
              autoComplete={editingUsuario ? 'new-password' : 'new-password'}
            />
            {errors.senha && <span className={styles.error}>{errors.senha}</span>}
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label htmlFor="papel" className={styles.label}>Papel</label>
              <select
                id="papel"
                value={formData.papel}
                onChange={(e) => handleChange('papel', e.target.value as 'cliente' | 'admin')}
                className={styles.select}
              >
                <option value="cliente">Cliente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className={styles.fieldGroup} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.ativo}
                  onChange={(e) => handleChange('ativo', e.target.checked)}
                />
                <span>Ativo</span>
              </label>
            </div>
          </div>

          <div className={styles.modalActions}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Salvando...' : (editingUsuario ? 'Atualizar' : 'Criar')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        title="Excluir Usuário"
        message="Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        variant="danger"
      />
    </>
  );
}

export default AdminUsuariosPage;