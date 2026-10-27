import api from './api.js';
import cart from './cart.js';
import { formatCurrency, showToast, showLoading, hideLoading, formatDateTime, formatPhone, formatCEP, escapeHtml } from './utils.js';

// Estado da página
let enderecos = [];
let enderecoEditandoId = null;
let enderecoExcluindoId = null;

// Elementos DOM
const cartCount = document.getElementById('cartCount');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

// Forms
const formDadosPessoais = document.getElementById('formDadosPessoais');
const perfilNome = document.getElementById('perfilNome');
const perfilEmail = document.getElementById('perfilEmail');
const perfilTelefone = document.getElementById('perfilTelefone');

// Endereços
const enderecosList = document.getElementById('enderecosList');
const enderecosEmptyState = document.getElementById('enderecosEmptyState');
const btnNovoEndereco = document.getElementById('btnNovoEndereco');
const enderecoModal = document.getElementById('enderecoModal');
const enderecoModalClose = document.getElementById('enderecoModalClose');
const btnCancelarEnderecoModal = document.getElementById('btnCancelarEnderecoModal');
const enderecoForm = document.getElementById('enderecoForm');
const enderecoId = document.getElementById('enderecoId');
const enderecoCep = document.getElementById('enderecoCep');
const enderecoLogradouro = document.getElementById('enderecoLogradouro');
const enderecoNumero = document.getElementById('enderecoNumero');
const enderecoBairro = document.getElementById('enderecoBairro');
const enderecoComplemento = document.getElementById('enderecoComplemento');
const enderecoPrincipal = document.getElementById('enderecoPrincipal');
const btnBuscarCep = document.getElementById('btnBuscarCep');

// Delete Endereço Modal
const deleteEnderecoModal = document.getElementById('deleteEnderecoModal');
const btnCancelarDeleteEndereco = document.getElementById('btnCancelarDeleteEndereco');
const btnConfirmarDeleteEndereco = document.getElementById('btnConfirmarDeleteEndereco');

// Segurança
const formAlterarSenha = document.getElementById('formAlterarSenha');
const senhaAtual = document.getElementById('senhaAtual');
const senhaNova = document.getElementById('senhaNova');
const senhaConfirmar = document.getElementById('senhaConfirmar');
const toggleSenhaAtual = document.getElementById('toggleSenhaAtual');
const toggleSenhaNova = document.getElementById('toggleSenhaNova');
const toggleSenhaConfirmar = document.getElementById('toggleSenhaConfirmar');

// Logout
const logoutBtn = document.getElementById('logoutBtn');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await inicializarPagina();
    configurarEventListeners();
    atualizarContadorCarrinho();
    verificarAuth();
});

async function inicializarPagina() {
    // Verificar se cliente está autenticado
    if (!api.isClienteAuthenticated()) {
        showToast('Você precisa estar logado para acessar seu perfil', 'warning');
        setTimeout(() => window.location.href = '/inicio/index.html', 2000);
        return;
    }

    await Promise.all([
        carregarPerfil(),
        carregarEnderecos()
    ]);
}

function configurarEventListeners() {
    // Atualizar contador do carrinho
    cart.subscribe(atualizarContadorCarrinho);

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => alternarTab(btn.dataset.tab));
    });

    // Form Dados Pessoais
    formDadosPessoais.addEventListener('submit', handleSalvarDadosPessoais);

    // Endereços
    btnNovoEndereco.addEventListener('click', () => abrirModalEndereco());
    enderecoModalClose.addEventListener('click', fecharModalEndereco);
    btnCancelarEnderecoModal.addEventListener('click', fecharModalEndereco);
    enderecoModal.addEventListener('click', (e) => {
        if (e.target === enderecoModal) fecharModalEndereco();
    });
    enderecoForm.addEventListener('submit', handleSalvarEndereco);
    btnBuscarCep.addEventListener('click', buscarCep);

    // Delete Endereço
    btnCancelarDeleteEndereco.addEventListener('click', fecharModalDeleteEndereco);
    btnConfirmarDeleteEndereco.addEventListener('click', confirmarExcluirEndereco);
    deleteEnderecoModal.addEventListener('click', (e) => {
        if (e.target === deleteEnderecoModal) fecharModalDeleteEndereco();
    });

    // Form Alterar Senha
    formAlterarSenha.addEventListener('submit', handleAlterarSenha);
    toggleSenhaAtual.addEventListener('click', () => togglePasswordVisibility(senhaAtual, toggleSenhaAtual));
    toggleSenhaNova.addEventListener('click', () => togglePasswordVisibility(senhaNova, toggleSenhaNova));
    toggleSenhaConfirmar.addEventListener('click', () => togglePasswordVisibility(senhaConfirmar, toggleSenhaConfirmar));

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Dropdown user menu
    const userButton = document.getElementById('userButton');
    const userDropdown = document.getElementById('userDropdown');
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

    // Fechar modais com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!enderecoModal.classList.contains('hidden')) fecharModalEndereco();
            if (!deleteEnderecoModal.classList.contains('hidden')) fecharModalDeleteEndereco();
        }
    });
}

function atualizarContadorCarrinho() {
    const total = cart.getTotalItems();
    if (cartCount) {
        cartCount.textContent = total;
        cartCount.style.display = total > 0 ? 'flex' : 'none';
    }
}

async function verificarAuth() {
    const clienteUser = api.getClienteUser();
    const userButton = document.getElementById('userButton');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const adminLink = document.getElementById('adminLink');

    if (clienteUser) {
        if (userButton) userButton.style.display = 'flex';
        if (userName) userName.textContent = clienteUser.nome;
        if (userAvatar) userAvatar.textContent = clienteUser.nome.charAt(0).toUpperCase();
        if (adminLink) adminLink.style.display = 'none';
    }
}

function alternarTab(tabId) {
    // Atualizar botões
    tabBtns.forEach(btn => {
        const isActive = btn.dataset.tab === tabId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive);
    });

    // Atualizar painéis
    tabPanels.forEach(panel => {
        const isActive = panel.id === `tab-${tabId}`;
        panel.classList.toggle('active', isActive);
        panel.classList.toggle('hidden', !isActive);
    });
}

async function carregarPerfil() {
    try {
        const response = await api.getClientePerfil();
        const cliente = response.cliente || response;

        if (perfilNome) perfilNome.value = cliente.nome || '';
        if (perfilEmail) perfilEmail.value = cliente.email || '';
        if (perfilTelefone) perfilTelefone.value = formatPhone(cliente.telefone || '');

        // Preencher campos ocultos do formulário
        formDadosPessoais.dataset.clienteId = cliente.id;
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        showToast('Erro ao carregar perfil', 'error');
    }
}

async function handleSalvarDadosPessoais(e) {
    e.preventDefault();

    const btnSubmit = formDadosPessoais.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg> Salvando...';

    try {
        const data = {
            nome: perfilNome.value.trim(),
            telefone: perfilTelefone.value.replace(/\D/g, '')
        };

        await api.atualizarClientePerfil(data);
        showToast('Dados pessoais atualizados com sucesso!', 'success');

        // Atualizar nome no header
        const userName = document.getElementById('userName');
        if (userName) userName.textContent = data.nome;
    } catch (error) {
        console.error('Erro ao salvar dados pessoais:', error);
        showToast(error.message || 'Erro ao salvar dados pessoais', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

async function carregarEnderecos() {
    try {
        const response = await api.getClienteEnderecos();
        enderecos = response.enderecos || response.data || response || [];
        renderizarEnderecos();
    } catch (error) {
        console.error('Erro ao carregar endereços:', error);
        showToast('Erro ao carregar endereços', 'error');
    }
}

function renderizarEnderecos() {
    if (!enderecosList) return;

    if (enderecos.length === 0) {
        enderecosList.innerHTML = '';
        enderecosEmptyState.classList.remove('hidden');
        return;
    }

    enderecosEmptyState.classList.add('hidden');

    enderecosList.innerHTML = enderecos.map(endereco => `
        <article class="card endereco-card" style="position: relative;">
            ${endereco.principal ? '<span class="badge badge-primary" style="position: absolute; top: 16px; right: 16px; font-size: 11px;">Principal</span>' : ''}
            <div class="card-content">
                <div class="d-flex justify-between align-start" style="margin-bottom: 12px;">
                    <h4 class="card-title" style="margin: 0;">${escapeHtml(endereco.logradouro)}, ${escapeHtml(endereco.numero)}</h4>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline btn-editar-endereco" data-id="${endereco.id}" aria-label="Editar endereço">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn btn-sm btn-outline btn-excluir-endereco" data-id="${endereco.id}" style="color: var(--danger); border-color: var(--danger);" aria-label="Excluir endereço">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <p style="margin: 4px 0; color: var(--text-muted);">${escapeHtml(endereco.bairro)}</p>
                ${endereco.complemento ? `<p style="margin: 4px 0; color: var(--text-muted);">Complemento: ${escapeHtml(endereco.complemento)}</p>` : ''}
                <p style="margin: 4px 0; color: var(--text-muted);">${formatCEP(endereco.cep)}</p>
            </div>
        </article>
    `).join('');

    // Eventos dos botões
    document.querySelectorAll('.btn-editar-endereco').forEach(btn => {
        btn.addEventListener('click', () => abrirModalEndereco(parseInt(btn.dataset.id)));
    });

    document.querySelectorAll('.btn-excluir-endereco').forEach(btn => {
        btn.addEventListener('click', () => abrirModalDeleteEndereco(parseInt(btn.dataset.id)));
    });
}

function abrirModalEndereco(enderecoId = null) {
    enderecoEditandoId = enderecoId;

    // Reset form
    enderecoForm.reset();
    document.getElementById('enderecoModalTitulo').textContent = enderecoId ? 'Editar Endereço' : 'Novo Endereço';

    if (enderecoId) {
        const endereco = enderecos.find(e => e.id === enderecoId);
        if (endereco) {
            document.getElementById('enderecoId').value = endereco.id;
            enderecoCep.value = formatCEP(endereco.cep);
            enderecoLogradouro.value = endereco.logradouro || '';
            enderecoNumero.value = endereco.numero || '';
            enderecoBairro.value = endereco.bairro || '';
            enderecoComplemento.value = endereco.complemento || '';
            enderecoPrincipal.checked = endereco.principal || false;
        }
    } else {
        document.getElementById('enderecoId').value = '';
        enderecoPrincipal.checked = enderecos.length === 0; // Primeiro endereço é principal por padrão
    }

    enderecoModal.classList.remove('hidden');
    enderecoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    enderecoCep.focus();
}

function fecharModalEndereco() {
    enderecoModal.classList.add('hidden');
    enderecoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    enderecoEditandoId = null;
}

async function buscarCep() {
    const cep = enderecoCep.value.replace(/\D/g, '');
    if (cep.length !== 8) {
        showToast('CEP inválido', 'warning');
        return;
    }

    const originalHtml = btnBuscarCep.innerHTML;
    btnBuscarCep.disabled = true;
    btnBuscarCep.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg>';

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (data.erro) {
            showToast('CEP não encontrado', 'warning');
            return;
        }

        enderecoLogradouro.value = data.logradouro || '';
        enderecoBairro.value = data.bairro || '';
        enderecoNumero.focus();

        showToast('Endereço preenchido automaticamente', 'success');
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        showToast('Erro ao buscar CEP. Preencha manualmente.', 'error');
    } finally {
        btnBuscarCep.disabled = false;
        btnBuscarCep.innerHTML = originalHtml;
    }
}

async function handleSalvarEndereco(e) {
    e.preventDefault();

    const btnSubmit = document.getElementById('btnSalvarEndereco');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg> Salvando...';

    try {
        const data = {
            cep: enderecoCep.value.replace(/\D/g, ''),
            logradouro: enderecoLogradouro.value.trim(),
            numero: enderecoNumero.value.trim(),
            bairro: enderecoBairro.value.trim(),
            complemento: enderecoComplemento.value.trim() || null,
            principal: enderecoPrincipal.checked
        };

        if (enderecoEditandoId) {
            await api.atualizarClienteEndereco(enderecoEditandoId, data);
            showToast('Endereço atualizado com sucesso!', 'success');
        } else {
            await api.criarClienteEndereco(data);
            showToast('Endereço adicionado com sucesso!', 'success');
        }

        fecharModalEndereco();
        await carregarEnderecos();
    } catch (error) {
        console.error('Erro ao salvar endereço:', error);
        showToast(error.message || 'Erro ao salvar endereço', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

function abrirModalDeleteEndereco(enderecoId) {
    enderecoExcluindoId = enderecoId;
    deleteEnderecoModal.classList.remove('hidden');
    deleteEnderecoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    btnCancelarDeleteEndereco.focus();
}

function fecharModalDeleteEndereco() {
    deleteEnderecoModal.classList.add('hidden');
    deleteEnderecoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    enderecoExcluindoId = null;
}

async function confirmarExcluirEndereco() {
    if (!enderecoExcluindoId) return;

    try {
        await api.excluirClienteEndereco(enderecoExcluindoId);
        showToast('Endereço excluído com sucesso!', 'success');
        fecharModalDeleteEndereco();
        await carregarEnderecos();
    } catch (error) {
        console.error('Erro ao excluir endereço:', error);
        showToast(error.message || 'Erro ao excluir endereço', 'error');
    }
}

async function handleAlterarSenha(e) {
    e.preventDefault();

    if (senhaNova.value !== senhaConfirmar.value) {
        showToast('As senhas não coincidem', 'warning');
        senhaConfirmar.focus();
        return;
    }

    if (senhaNova.value.length < 8) {
        showToast('A nova senha deve ter no mínimo 8 caracteres', 'warning');
        senhaNova.focus();
        return;
    }

    const btnSubmit = formAlterarSenha.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<svg class="btn-icon spin" aria-hidden="true"><use href="#i-loader" /></svg> Alterando...';

    try {
        await api.alterarClienteSenha({
            senha_atual: senhaAtual.value,
            nova_senha: senhaNova.value
        });

        showToast('Senha alterada com sucesso!', 'success');
        formAlterarSenha.reset();
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        showToast(error.message || 'Erro ao alterar senha', 'error');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalText;
    }
}

function togglePasswordVisibility(input, button) {
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;

    const svg = button.querySelector('svg');
    if (type === 'text') {
        svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
}

function handleLogout() {
    api.clearClienteAuth();
    showToast('Logout realizado com sucesso', 'success');
    setTimeout(() => window.location.href = '/inicio/index.html', 1000);
}