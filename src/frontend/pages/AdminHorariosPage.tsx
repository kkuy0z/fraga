/**
 * Página de Configuração de Horários (Admin)
 */

import { useEffect, useState } from 'react';
import { Header, ToastContainer, LoadingOverlay, Button, Input, Switch, Card } from '@components';
import { useToast } from '@hooks';
import { api } from '@api/client';
import styles from './AdminHorariosPage.module.css';

type HorarioDia = {
  dia_semana: number; // 0-6 (Dom-Sab)
  dia_nome: string;
  abre: string;
  fecha: string;
  fechado: boolean;
};

type HorarioEspecial = {
  id: string;
  data: string;
  abre: string;
  fecha: string;
  fechado: boolean;
  descricao: string;
};

const diasSemana = [
  { num: 0, nome: 'Domingo', curto: 'DOM' },
  { num: 1, nome: 'Segunda-feira', curto: 'SEG' },
  { num: 2, nome: 'Terça-feira', curto: 'TER' },
  { num: 3, nome: 'Quarta-feira', curto: 'QUA' },
  { num: 4, nome: 'Quinta-feira', curto: 'QUI' },
  { num: 5, nome: 'Sexta-feira', curto: 'SEX' },
  { num: 6, nome: 'Sábado', curto: 'SÁB' },
];

export function AdminHorariosPage() {
  const { showToast } = useToast();
  const [horarios, setHorarios] = useState<HorarioDia[]>([]);
  const [horariosEspeciais, setHorariosEspeciais] = useState<HorarioEspecial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEspecialModal, setShowEspecialModal] = useState(false);
  const [editingEspecial, setEditingEspecial] = useState<HorarioEspecial | null>(null);
  const [especialForm, setEspecialForm] = useState({
    data: '',
    abre: '',
    fecha: '',
    fechado: false,
    descricao: '',
  });
  const [especialErrors, setEspecialErrors] = useState<{ data?: string; descricao?: string }>({});

  useEffect(() => {
    loadHorarios();
  }, []);

  const loadHorarios = async () => {
    setIsLoading(true);
    try {
      const [regulares, especiais] = await Promise.all([
        api.get<HorarioDia[]>('/admin/horarios'),
        api.get<HorarioEspecial[]>('/admin/horarios/especiais'),
      ]);
      setHorarios(regulares);
      setHorariosEspeciais(especiais);
    } catch {
      showToast('Erro ao carregar horários', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHorarioChange = (dia: number, field: 'abre' | 'fecha' | 'fechado', value: string | boolean) => {
    setHorarios(prev => prev.map(h =>
      h.dia_semana === dia ? { ...h, [field]: value } : h
    ));
  };

  const handleSaveHorarios = async () => {
    setSaving(true);
    try {
      await api.put('/admin/horarios', { horarios });
      showToast('Horários salvos com sucesso', 'success');
    } catch {
      showToast('Erro ao salvar horários', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleNewEspecial = () => {
    setEditingEspecial(null);
    const hoje = new Date().toISOString().split('T')[0];
    setEspecialForm({
      data: hoje,
      abre: '18:00',
      fecha: '23:00',
      fechado: false,
      descricao: '',
    });
    setEspecialErrors({});
    setShowEspecialModal(true);
  };

  const handleEditEspecial = (especial: HorarioEspecial) => {
    setEditingEspecial(especial);
    setEspecialForm({
      data: especial.data,
      abre: especial.abre,
      fecha: especial.fecha,
      fechado: especial.fechado,
      descricao: especial.descricao,
    });
    setEspecialErrors({});
    setShowEspecialModal(true);
  };

  const handleDeleteEspecial = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este horário especial?')) return;
    try {
      await api.delete(`/admin/horarios/especiais/${id}`);
      showToast('Horário especial excluído', 'success');
      loadHorarios();
    } catch {
      showToast('Erro ao excluir horário especial', 'error');
    }
  };

  const handleEspecialChange = (field: string, value: string | boolean) => {
    setEspecialForm(prev => ({ ...prev, [field]: value }));
    if (especialErrors[field as keyof typeof especialErrors]) {
      setEspecialErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateEspecial = (): boolean => {
    const newErrors: { data?: string; descricao?: string } = {};
    if (!especialForm.data) newErrors.data = 'Data é obrigatória';
    if (!especialForm.fechado && !especialForm.descricao.trim()) {
      newErrors.descricao = 'Descrição é obrigatória para horários de funcionamento';
    }
    setEspecialErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveEspecial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEspecial()) return;

    try {
      const data = {
        data: especialForm.data,
        abre: especialForm.fechado ? null : especialForm.abre,
        fecha: especialForm.fechado ? null : especialForm.fecha,
        fechado: especialForm.fechado,
        descricao: especialForm.descricao,
      };

      if (editingEspecial) {
        await api.put(`/admin/horarios/especiais/${editingEspecial.id}`, data);
        showToast('Horário especial atualizado', 'success');
      } else {
        await api.post('/admin/horarios/especiais', data);
        showToast('Horário especial criado', 'success');
      }
      setShowEspecialModal(false);
      loadHorarios();
    } catch {
      showToast('Erro ao salvar horário especial', 'error');
    }
  };

  const formatTime = (time: string) => {
    if (!time) return '--:--';
    return time.substring(0, 5);
  };

  if (isLoading) {
    return (
      <>
        <Header currentPage="admin" showAdminLink />
        <ToastContainer />
        <LoadingOverlay message="Carregando horários..." />
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
            <h1 className={styles.title}>HORÁRIOS DE FUNCIONAMENTO</h1>
            <p className={styles.subtitle}>Configure os horários de abertura e fechamento</p>
          </div>
        </header>

        {/* Horários Regulares */}
        <section className={styles.section} aria-labelledby="regulares-title">
          <h2 id="regulares-title" className={styles.sectionTitle}>HORÁRIOS SEMANAIS</h2>
          <div className={styles.horariosGrid}>
            {diasSemana.map(dia => {
              const horario = horarios.find(h => h.dia_semana === dia.num);
              return (
                <Card key={dia.num} className={styles.diaCard} variant={horario?.fechado ? 'secondary' : 'default'}>
                  <div className={styles.diaHeader}>
                    <span className={styles.diaSigla}>{dia.curto}</span>
                    <span className={styles.diaNome}>{dia.nome}</span>
                  </div>
                  <div className={styles.diaControls}>
                    <Switch
                      checked={horario?.fechado || false}
                      onChange={(checked) => handleHorarioChange(dia.num, 'fechado', checked)}
                      label="Fechado"
                      className={styles.fechadoSwitch}
                    />
                  </div>
                  {!horario?.fechado && (
                    <div className={styles.horarioInputs}>
                      <div className={styles.timeInput}>
                        <label htmlFor={`abre-${dia.num}`} className={styles.timeLabel}>Abre</label>
                        <Input
                          id={`abre-${dia.num}`}
                          type="time"
                          value={horario?.abre || '18:00'}
                          onChange={(e) => handleHorarioChange(dia.num, 'abre', e.target.value)}
                          className={styles.timeInputField}
                        />
                      </div>
                      <div className={styles.timeInput}>
                        <label htmlFor={`fecha-${dia.num}`} className={styles.timeLabel}>Fecha</label>
                        <Input
                          id={`fecha-${dia.num}`}
                          type="time"
                          value={horario?.fecha || '23:00'}
                          onChange={(e) => handleHorarioChange(dia.num, 'fecha', e.target.value)}
                          className={styles.timeInputField}
                        />
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
          <div className={styles.saveActions}>
            <Button variant="primary" size="lg" onClick={handleSaveHorarios} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Horários'}
            </Button>
          </div>
        </section>

        {/* Horários Especiais */}
        <section className={styles.section} aria-labelledby="especiais-title">
          <div className={styles.sectionHeader}>
            <h2 id="especiais-title" className={styles.sectionTitle}>HORÁRIOS ESPECIAIS</h2>
            <Button variant="primary" onClick={handleNewEspecial}>
              + Novo Horário Especial
            </Button>
          </div>

          {horariosEspeciais.length === 0 ? (
            <div className={styles.empty}>
              <p>Nenhum horário especial cadastrado.</p>
              <p className={styles.emptyHint}>Adicione feriados, eventos ou dias com horário diferenciado.</p>
            </div>
          ) : (
            <div className={styles.especiaisList}>
              {horariosEspeciais.map(especial => (
                <div key={especial.id} className={styles.especialCard}>
                  <div className={styles.especialInfo}>
                    <div className={styles.especialDate}>
                      {new Date(especial.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    <div className={styles.especialDetails}>
                      {especial.fechado ? (
                        <span className={styles.fechadoBadge}>Fechado</span>
                      ) : (
                        <>
                          <span>Abre: {formatTime(especial.abre)}</span>
                          <span>Fecha: {formatTime(especial.fecha)}</span>
                        </>
                      )}
                      {especial.descricao && <span className={styles.especialDesc}>{especial.descricao}</span>}
                    </div>
                  </div>
                  <div className={styles.especialActions}>
                    <Button variant="ghost" size="sm" onClick={() => handleEditEspecial(especial)}>
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteEspecial(especial.id)} className={styles.deleteBtn}>
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal Horário Especial */}
      <Modal
        isOpen={showEspecialModal}
        onClose={() => setShowEspecialModal(false)}
        title={editingEspecial ? 'Editar Horário Especial' : 'Novo Horário Especial'}
        size="md"
      >
        <form onSubmit={handleSaveEspecial} className={styles.modalForm}>
          <div className={styles.fieldGroup}>
            <label htmlFor="data" className={styles.label}>
              Data <span className={styles.required}>*</span>
            </label>
            <Input
              id="data"
              type="date"
              value={especialForm.data}
              onChange={(e) => handleEspecialChange('data', e.target.value)}
              error={especialErrors.data}
              className={styles.input}
            />
            {especialErrors.data && <span className={styles.error}>{especialErrors.data}</span>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={especialForm.fechado}
                onChange={(e) => handleEspecialChange('fechado', e.target.checked)}
              />
              <span>Dia fechado (não abre)</span>
            </label>
          </div>

          {!especialForm.fechado && (
            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label htmlFor="abre" className={styles.label}>Horário de Abertura</label>
                <Input
                  id="abre"
                  type="time"
                  value={especialForm.abre}
                  onChange={(e) => handleEspecialChange('abre', e.target.value)}
                  className={styles.input}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="fecha" className={styles.label}>Horário de Fechamento</label>
                <Input
                  id="fecha"
                  type="time"
                  value={especialForm.fecha}
                  onChange={(e) => handleEspecialChange('fecha', e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>
          )}

          <div className={styles.fieldGroup}>
            <label htmlFor="descricao" className={styles.label}>
              Descrição {especialForm.fechado ? '' : '<span className={styles.required}>*</span>'}
            </label>
            <Input
              id="descricao"
              type="text"
              placeholder="Ex: Feriado, Evento especial, Manutenção..."
              value={especialForm.descricao}
              onChange={(e) => handleEspecialChange('descricao', e.target.value)}
              error={especialErrors.descricao}
              className={styles.input}
            />
            {especialErrors.descricao && <span className={styles.error}>{especialErrors.descricao}</span>}
          </div>

          <div className={styles.modalActions}>
            <Button type="button" variant="secondary" onClick={() => setShowEspecialModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary">
              {editingEspecial ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default AdminHorariosPage;