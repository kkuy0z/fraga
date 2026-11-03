/**
 * Página de Gerenciamento de Categorias (Admin)
 */

import { useEffect, useState } from 'react';
import { Header, ToastContainer, LoadingOverlay, Modal, Button, Input, ConfirmDialog } from '@components';
import { useToast } from '@hooks';
import { api } from '@api/client';
import { Categoria } from '@shared/types';
import styles from './AdminCategoriasPage.module.css';

export function AdminCategoriasPage() {
  const { showToast } = useToast();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [formData, setFormData] = useState({ nome: '', descricao: '', ordem: 0, ativo: true });
  const [errors, setErrors] = useState<{ nome?: string }>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadCategorias();
  }, []);

  const loadCategorias = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<Categoria[]>('/admin/categorias');
      setCategorias(data);
    } catch {
      showToast('Erro ao carregar categorias', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNew = () => {
    setEditingCategoria(null);
    setFormData({ nome: '', descricao: '', ordem: 0, ativo: true });
    setErrors({});
    setShowModal(true);
  };

  const handleEdit = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    setFormData({
      nome: categoria.nome,
      descricao: categoria.descricao || '',
      ordem: categoria.ordem || 0,
      ativo: categoria.ativo,
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
      await api.delete(`/admin/categorias/${deletingId}`);
      showToast('Categoria excluída com sucesso', 'success');
      loadCategorias();
    } catch {
      showToast('Erro ao excluir categoria', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { nome?: string } = {};
    if (!formData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (editingCategoria) {
        await api.put(`/admin/categorias/${editingCategoria.id}`, formData);
        showToast('Categoria atualizada com sucesso', 'success');
      } else {
        await api.post('/admin/categorias', formData);
        showToast('Categoria criada com sucesso', 'success');
      }
      setShowModal(false);
      loadCategorias();
    } catch (error: any) {
      if (error.message?.includes('duplicado') || error.message?.includes('unique')) {
        setErrors({ nome: 'Já existe uma categoria com este nome' });
      } else {
        showToast(error.message || 'Erro ao salvar categoria', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <Header currentPage="admin" showAdminLink />
        <ToastContainer />
        <LoadingOverlay message="Carregando categorias..." />
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
            <h1 className={styles.title}>CATEGORIAS</h1>
            <p className={styles.subtitle}>Gerencie as categorias do cardápio</p>
          </div>
          <Button variant="primary" onClick={handleNew}>
            + Nova Categoria
          </Button>
        </header>

        {categorias.length === 0 ? (
          <div className={styles.empty}>
            <p>Nenhuma categoria cadastrada.</p>
            <Button variant="primary" onClick={handleNew}>Criar primeira categoria</Button>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table} role="table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">Ordem</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map(categoria => (
                  <tr key={categoria.id}>
                    <td>
                      <span className={styles.categoriaNome}>{categoria.nome}</span>
                    </td>
                    <td>{categoria.descricao || '-'}</td>
                    <td>{categoria.ordem}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${categoria.ativo ? styles.ativo : styles.inativo}`}>
                        {categoria.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(categoria)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(categoria.id)} className={styles.deleteBtn}>
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
        title={editingCategoria ? 'Editar Categoria' : 'Nova Categoria'}
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
              placeholder="Ex: Lanches, Bebidas, Sobremesas"
              value={formData.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              error={errors.nome}
              className={styles.input}
              autoFocus
            />
            {errors.nome && <span className={styles.error}>{errors.nome}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="descricao" className={styles.label}>Descrição</label>
            <textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              className={styles.textarea}
              rows={3}
              placeholder="Descrição opcional da categoria"
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label htmlFor="ordem" className={styles.label}>Ordem</label>
              <Input
                id="ordem"
                type="number"
                value={formData.ordem}
                onChange={(e) => handleChange('ordem', parseInt(e.target.value) || 0)}
                className={styles.input}
                min="0"
              />
            </div>

            <div className={styles.fieldGroup}>
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
              {saving ? 'Salvando...' : (editingCategoria ? 'Atualizar' : 'Criar')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        title="Excluir Categoria"
        message="Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        variant="danger"
      />
    </>
  );
}

export default AdminCategoriasPage;