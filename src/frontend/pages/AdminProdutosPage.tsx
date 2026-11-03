/**
 * Página de Gerenciamento de Produtos (Admin)
 */

import { useEffect, useState, useCallback } from 'react';
import { Header, ToastContainer, LoadingOverlay, Modal, Button, Input, Select, Textarea, ConfirmDialog, ImageUpload } from '@components';
import { useToast } from '@hooks';
import { api } from '@api/client';
import { Produto, Categoria } from '@shared/types';
import styles from './AdminProdutosPage.module.css';

type ProdutoFormData = {
  nome: string;
  descricao: string;
  preco: number;
  categoria_id: string;
  imagem: string;
  disponivel: boolean;
  destaque: boolean;
  ordem: number;
};

const initialFormData: ProdutoFormData = {
  nome: '',
  descricao: '',
  preco: 0,
  categoria_id: '',
  imagem: '',
  disponivel: true,
  destaque: false,
  ordem: 0,
};

export function AdminProdutosPage() {
  const { showToast } = useToast();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [formData, setFormData] = useState<ProdutoFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<ProdutoFormData>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [produtosData, categoriasData] = await Promise.all([
        api.get<Produto[]>('/admin/produtos'),
        api.get<Categoria[]>('/admin/categorias'),
      ]);
      setProdutos(produtosData);
      setCategorias(categoriasData);
    } catch {
      showToast('Erro ao carregar dados', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNew = () => {
    setEditingProduto(null);
    setFormData({ ...initialFormData, categoria_id: categorias[0]?.id || '' });
    setErrors({});
    setShowModal(true);
  };

  const handleEdit = (produto: Produto) => {
    setEditingProduto(produto);
    setFormData({
      nome: produto.nome,
      descricao: produto.descricao || '',
      preco: produto.preco,
      categoria_id: produto.categoria_id,
      imagem: produto.imagem || '',
      disponivel: produto.disponivel,
      destaque: produto.destaque,
      ordem: produto.ordem || 0,
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
      await api.delete(`/admin/produtos/${deletingId}`);
      showToast('Produto excluído com sucesso', 'success');
      loadData();
    } catch {
      showToast('Erro ao excluir produto', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleChange = (field: keyof ProdutoFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('imagem', file);
      const result = await api.post<{ url: string }>('/admin/upload/imagem', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      handleChange('imagem', result.url);
      showToast('Imagem enviada com sucesso', 'success');
    } catch {
      showToast('Erro ao enviar imagem', 'error');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<ProdutoFormData> = {};
    if (!formData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (!formData.descricao.trim()) newErrors.descricao = 'Descrição é obrigatória';
    if (!formData.preco || formData.preco <= 0) newErrors.preco = 'Preço deve ser maior que zero';
    if (!formData.categoria_id) newErrors.categoria_id = 'Categoria é obrigatória';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (editingProduto) {
        await api.put(`/admin/produtos/${editingProduto.id}`, formData);
        showToast('Produto atualizado com sucesso', 'success');
      } else {
        await api.post('/admin/produtos', formData);
        showToast('Produto criado com sucesso', 'success');
      }
      setShowModal(false);
      loadData();
    } catch (error: any) {
      showToast(error.message || 'Erro ao salvar produto', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredProdutos = produtos.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = !categoriaFilter || p.categoria_id === categoriaFilter;
    return matchesSearch && matchesCategoria;
  });

  if (isLoading) {
    return (
      <>
        <Header currentPage="admin" showAdminLink />
        <ToastContainer />
        <LoadingOverlay message="Carregando produtos..." />
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
            <h1 className={styles.title}>PRODUTOS</h1>
            <p className={styles.subtitle}>Gerencie os itens do cardápio</p>
          </div>
          <Button variant="primary" onClick={handleNew}>
            + Novo Produto
          </Button>
        </header>

        <div className={styles.filters}>
          <Input
            type="search"
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <Select
            value={categoriaFilter}
            onChange={(e) => setCategoriaFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">Todas as categorias</option>
            {categorias.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nome}</option>
            ))}
          </Select>
        </div>

        {filteredProdutos.length === 0 ? (
          <div className={styles.empty}>
            <p>{searchTerm || categoriaFilter ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado.'}</p>
            {!searchTerm && !categoriaFilter && <Button variant="primary" onClick={handleNew}>Criar primeiro produto</Button>}
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table} role="table">
              <thead>
                <tr>
                  <th scope="col">Imagem</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Preço</th>
                  <th scope="col">Status</th>
                  <th scope="col">Destaque</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProdutos.map(produto => (
                  <tr key={produto.id}>
                    <td>
                      {produto.imagem && (
                        <img src={produto.imagem} alt={produto.nome} className={styles.thumb} />
                      )}
                    </td>
                    <td>
                      <span className={styles.produtoNome}>{produto.nome}</span>
                    </td>
                    <td>{produto.categoria_nome || '-'}</td>
                    <td className={styles.precoCell}>
                      R$ {produto.preco.toFixed(2).replace('.', ',')}
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${produto.disponivel ? styles.disponivel : styles.indisponivel}`}>
                        {produto.disponivel ? 'Disponível' : 'Indisponível'}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.destaqueBadge} ${produto.destaque ? styles.sim : styles.nao}`}>
                        {produto.destaque ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(produto)}>
                          Editar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(produto.id)} className={styles.deleteBtn}>
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
        title={editingProduto ? 'Editar Produto' : 'Novo Produto'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.fieldGroup}>
            <label htmlFor="nome" className={styles.label}>
              Nome <span className={styles.required}>*</span>
            </label>
            <Input
              id="nome"
              type="text"
              placeholder="Nome do produto"
              value={formData.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              error={errors.nome}
              className={styles.input}
              autoFocus
            />
            {errors.nome && <span className={styles.error}>{errors.nome}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="descricao" className={styles.label}>
              Descrição <span className={styles.required}>*</span>
            </label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              error={errors.descricao}
              className={styles.textarea}
              rows={3}
              placeholder="Descrição do produto"
            />
            {errors.descricao && <span className={styles.error}>{errors.descricao}</span>}
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label htmlFor="preco" className={styles.label}>
                Preço (R$) <span className={styles.required}>*</span>
              </label>
              <Input
                id="preco"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.preco}
                onChange={(e) => handleChange('preco', parseFloat(e.target.value) || 0)}
                error={errors.preco}
                className={styles.input}
              />
              {errors.preco && <span className={styles.error}>{errors.preco}</span>}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="categoria_id" className={styles.label}>
                Categoria <span className={styles.required}>*</span>
              </label>
              <Select
                id="categoria_id"
                value={formData.categoria_id}
                onChange={(e) => handleChange('categoria_id', e.target.value)}
                error={errors.categoria_id}
                className={styles.select}
              >
                <option value="">Selecione</option>
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nome}</option>
                ))}
              </Select>
              {errors.categoria_id && <span className={styles.error}>{errors.categoria_id}</span>}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Imagem</label>
            <ImageUpload
              value={formData.imagem}
              onChange={handleImageUpload}
              className={styles.imageUpload}
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

            <div className={styles.fieldGroup} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.disponivel}
                  onChange={(e) => handleChange('disponivel', e.target.checked)}
                />
                <span>Disponível para venda</span>
              </label>
            </div>

            <div className={styles.fieldGroup} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.destaque}
                  onChange={(e) => handleChange('destaque', e.target.checked)}
                />
                <span>Destacar no cardápio</span>
              </label>
            </div>
          </div>

          <div className={styles.modalActions}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Salvando...' : (editingProduto ? 'Atualizar' : 'Criar')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        title="Excluir Produto"
        message="Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita."
        confirmText="Excluir"
        variant="danger"
      />
    </>
  );
}

export default AdminProdutosPage;