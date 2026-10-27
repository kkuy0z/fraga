import api from './api.js';
import { showToast, showLoading, hideLoading, escapeHtml } from './utils.js';

// Estado
let horarios = [];
let horarioExcluindoId = null;

// Elementos DOM
const userButton = document.getElementById('userButton');
const userDropdown = document.getElementById('userDropdown');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const dropdownUserName = document.getElementById('dropdownUserName');
const dropdownUserRole = document.getElementById('dropdownUserRole');
const logoutBtn = document.getElementById('logoutBtn');
const adminNavToggle = document.getElementById('adminNavToggle');
const adminNav = document.getElementById('adminNav');

const tbodyHorarios = document.getElementById('tbodyHorarios');
const emptyState = document.getElementById('emptyState');
const btnNovoHorario = document.getElementById('btnNovoHorario');
const btnPrimeiroHorario = document.getElementById('btnPrimeiroHorario');

// Status atual
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');

// Modal Horário
const horarioModal = document.getElementById('horarioModal');
const horarioModalClose = document.getElementById('horarioModalClose');
const btnCancelarHorario = document.getElementById('btnCancelarHorario');
const horarioForm = document.getElementById('horarioForm');
const horarioModalTitulo = document.getElementById('horarioModalTitulo');
const horarioId = document.getElementById('horarioId');
const horarioDiaSemana = document.getElementById('horarioDiaSemana');
const horarioAbre = document.getElementById('horarioAbre');
const horarioFecha = document.getElementById('horarioFecha');
const horarioFechado = document.getElementById('horarioFechado');
const btnSalvarHorario = document.getElementById('btnSalvarHorario');

// Modal Delete
const deleteHorarioModal = document.getElementById('deleteHorarioModal');
const deleteHorarioDia = document.getElementById('deleteHorarioDia');
const btnCancelarDeleteHorario = document.getElementById('btnCancelarDeleteHorario');
const btnConfirmarDeleteHorario = document.getElementById('btnConfirmarDeleteHorario');

// Dias da semana para exibição
const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarPagina();
    configurarEventListeners();
});

async function inicializarPagina() {
    // Verificar autenticação admin
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('auth_user') || 'null');

    if (!token || !user) {
        window.location.href = '/inicio/admin-login.html';
        return;
    }

    try {
        await api.adminVerify();
    } catch (error) {
        api.clearAuth();
        window.location.href = '/inicio/admin-login.html';
        return;
    }

    atualizarUserUI(user);
    await Promise.all([
        carregarHorarios(),
        verificarStatusFuncionamento()
    ]);
}

function configurarEventListeners() {
    // User dropdown
    if (userButton && userDropdown) {
        userButton.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
            userButton.setAttribute('aria-expanded', userDropdown.classList.contains('show'));
        });

        document.addEventListener('click', (e) => {
            if (!userButton.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('show');
                userButton.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Mobile nav toggle
    if (adminNavToggle && adminNav) {
        adminNavToggle.addEventListener('click', () => {
            const expanded = adminNavToggle.getAttribute('aria-expanded') === 'true';
            adminNavToggle.setAttribute('aria-expanded', !expanded);
            adminNav.classList.toggle('show');
        });
    }

    // Fechar modais/dropdowns com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (userDropdown) userDropdown.classList.remove('show');
            if (adminNav) adminNav.classList.remove('show');
            if (userButton) userButton.setAttribute('aria-expanded', 'false');
            if (adminNavToggle) adminNavToggle.setAttribute('aria-expanded', 'false');
            if (!horarioModal.classList.contains('hidden')) fecharModalHorario();
            if (!deleteHorarioModal.classList.contains('hidden')) fecharModalDeleteHorario();
        }
    });

    // Novo horário
    if (btnNovoHorario) btnNovoHorario.addEventListener('click', () => abrirModalHorario());
    if (btnPrimeiroHorario) btnPrimeiroHorario.addEventListener('click', () => abrirModalHorario());

    // Modal horário
    if (horarioModalClose) horarioModalClose.addEventListener('click', fecharModalHorario);
    if (btnCancelarHorario) btnCancelarHorario.addEventListener('click', fecharModalHorario);
    if (horarioModal) {
        horarioModal.addEventListener('click', (e) => {
            if (e.target === horarioModal) fecharModalHorario();
        });
    }
    if (horarioForm) horarioForm.addEventListener('submit', handleSalvarHorario);

    // Checkbox fechado - desabilitar inputs de hora
    if (horarioFechado) {
        horarioFechado.addEventListener('change', () => {
            const disabled = horarioFechado.checked;
            horarioAbre.disabled = disabled;
            horarioFecha.disabled = disabled;
            if (disabled) {
                horarioAbre.value = '';
                horarioFecha.value = '';
            }
        });
    }

    // Modal delete
    if (btnCancelarDeleteHorario) btnCancelarDeleteHorario.addEventListener('click', fecharModalDeleteHorario);
    if (deleteHorarioModal) {
        deleteHorarioModal.addEventListener('click', (e) => {
            if (e.target === deleteHorarioModal) fecharModalDeleteHorario();
        });
    }
    if (btnConfirmarDeleteHorario) btnConfirmarDeleteHorario.addEventListener('click', confirmarExcluirHorario);
}

function atualizarUserUI(user) {
    if (userName) userName.textContent = user.nome;
    if (dropdownUserName) dropdownUserName.textContent = user.nome;
    if (userAvatar) userAvatar.textContent = user.nome.charAt(0).toUpperCase();
    if (dropdownUserRole) {
        dropdownUserRole.textContent = user.perfil || user.role || 'administrador';
        dropdownUserRole.className = 'badge badge-info';
    }
}

async function carregarHorarios() {
    if (!tbodyHorarios) return;

    tbodyHorarios.innerHTML = '<tr><td colspan="5" class="text-center py-4">Carregando...</td></tr>';

    try {
        const response = await api.getHorarios();
        horarios = response.horarios || response.data || response || [];

        renderizarHorarios();
        toggleEmptyState(horarios.length === 0);

    } catch (error) {
        console.error('Erro ao carregar horários:', error);
        tbodyHorarios.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">Erro ao carregar horários</td></tr>';
        showToast('Erro ao carregar horários', 'error');
    }
}

function renderizarHorarios() {
    if (!tbodyHorarios) return;

    if (horarios.length === 0) {
        tbodyHorarios.innerHTML = '';
        return;
    }

    // Ordenar por dia da semana
    horarios.sort((a, b) => a.dia_semana - b.dia_semana);

    tbodyHorarios.innerHTML = horarios.map(h => `
        <tr>
            <td><strong>${DIAS_SEMANA[h.dia_semana] || 'Desconhecido'}</strong></td>
            <td>${h.fechado ? '<span style="color: var(--text-muted);">Fechado</span>' : escapeHtml(h.hora_abre || '—')}</td>
            <td>${h.fechado ? '<span style="color: var(--text-muted);">—</span>' : escapeHtml(h.hora_fecha || '—')}</td>
            <td>
                ${h.fechado ?
                    '<span class="badge badge-neutral">Fechado</span>' :
                    '<span class="badge badge-success">Aberto</span>'
                }
            </td>
            <td>
                <div class="d-flex gap-1">
                    <button class="btn btn-sm btn-outline btn-editar-horario" data-id="${h.id}" aria-label="Editar horário de ${DIAS_SEMANA[h.dia_semana]}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-outline btn-excluir-horario" data-id="${h.id}" data-dia="${DIAS_SEMANA[h.dia_semana]}" style="color: var(--danger); border-color: var(--danger);" aria-label="Excluir horário de ${DIAS_SEMANA[h.dia_semana]}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Eventos dos botões
    document.querySelectorAll('.btn-editar-horario').forEach(btn => {
        btn.addEventListener('click', () => abrirModalHorario(parseInt(btn.dataset.id)));
    });

    document.querySelectorAll('.btn-excluir-horario').forEach(btn => {
        btn.addEventListener('click', () => abrirModalDeleteHorario(parseInt(btn.dataset.id), btn.dataset.dia));
    });
}

function toggleEmptyState(empty) {
    if (emptyState) {
        emptyState.classList.toggle('hidden', !empty);
    }
    if (tbodyHorarios) {
        tbodyHorarios.closest('.table-container').style.display = empty ? 'none' : 'block';
    }
}

async function verificarStatusFuncionamento() {
    if (!statusIndicator || !statusText) return;

    try {
        const response = await api.getStatusFuncionamento();

        statusIndicator.className = 'status-indicator';
        statusIndicator.style.width = '12px';
        statusIndicator.style.height = '12px';
        statusIndicator.style.borderRadius = '50%';

        if (response.aberto) {
            statusIndicator.style.backgroundColor = '#4caf50';
            statusText.textContent = 'ABERTO AGORA';
            statusText.style.color = '#4caf50';
        } else {
            statusIndicator.style.backgroundColor = '#ff6b6b';
            const horarioAtual = response.horario_atual ? ` (${response.horario_atual})` : '';
            statusText.textContent = `FECHADO${horarioAtual}`;
            statusText.style.color = '#ff6b6b';
        }
    } catch (error) {
        console.error('Erro ao verificar status:', error);
        statusIndicator.style.backgroundColor = 'var(--text-muted)';
        statusText.textContent = 'Erro ao verificar';
        statusText.style.color = 'var(--text-muted)';
    }
}

function abrirModalHorario(horarioId_ = null) {
    // Reset form
    horarioForm.reset();
    horarioId.value = '';
    horarioAbre.disabled = false;
    horarioFecha.disabled = false;

    if (horarioId_) {
        const horario = horarios.find(h => h.id === horarioId_);
        if (horario) {
            horarioModalTitulo.textContent = 'Editar Horário';
            horarioId.value = horario.id;
            horarioDiaSemana.value = horario.dia_semana;
            horarioAbre.value = horario.hora_abre || '';
            horarioFecha.value = horario.hora_fecha || '';
            horarioFechado.checked = horario.fechado || false;
            horarioAbre.disabled = horario.fechado;
            horarioFecha.disabled = horario.fechado;
        }
    } else {
        horarioModalTitulo.textContent = 'Novo Horário';
    }

    horarioModal.classList.remove('hidden');
    horarioModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    horarioDiaSemana.focus();
}

function fecharModalHorario() {
    horarioModal.classList.add('hidden');
    horarioModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

async function handleSalvarHorario(e) {
    e.preventDefault();

    const btnSubmit = btnSalvarHorario;
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg> Salvando...';

    try {
        const data = {
            dia_semana: parseInt(horarioDiaSemana.value),
            hora_abre: horarioFechado.checked ? null : horarioAbre.value,
            hora_fecha: horarioFechado.checked ? null : horarioFecha.value,
            fechado: horarioFechado.checked
        };

        if (horarioId.value) {
            await api.updateHorario(horarioId.value, data);
            showToast('Horário atualizado com sucesso!', 'success');
        } else {
            await api.createHorario(data);
            showToast('Horário criado com sucesso!', 'success');
        }

        fecharModalHorario();
        await carregarHorarios();
        await verificarStatusFuncionamento();

    } catch (error) {
        console.error('Erro ao salvar horário:', error);
        showToast(error.message || 'Erro ao salvar horário', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

function abrirModalDeleteHorario(id, dia) {
    horarioExcluindoId = id;
    deleteHorarioDia.textContent = dia;
    deleteHorarioModal.classList.remove('hidden');
    deleteHorarioModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    btnCancelarDeleteHorario.focus();
}

function fecharModalDeleteHorario() {
    deleteHorarioModal.classList.add('hidden');
    deleteHorarioModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    horarioExcluindoId = null;
}

async function confirmarExcluirHorario() {
    if (!horarioExcluindoId) return;

    try {
        await api.deleteHorario(horarioExcluindoId);
        showToast('Horário excluído com sucesso!', 'success');
        fecharModalDeleteHorario();
        await carregarHorarios();
        await verificarStatusFuncionamento();
    } catch (error) {
        console.error('Erro ao excluir horário:', error);
        showToast(error.message || 'Erro ao excluir horário', 'error');
    }
}

function handleLogout() {
    api.clearAuth();
    showToast('Logout realizado com sucesso', 'success');
    setTimeout(() => window.location.href = '/inicio/admin-login.html', 1000);
}