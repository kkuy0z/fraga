import api from './api.js';
import cart from './cart.js';
import { formatCurrency, showToast, showLoading, hideLoading, formatCEP, validateCEP, formatPhone, validatePhone, debounce } from './utils.js';

// Função para decodificar JWT e obter payload
function decodificarJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

// Estado do checkout
let currentStep = 1;
let paymentMethods = [];
let selectedPaymentMethod = null;
let taxaEntrega = 0;
let valorMinimoPedido = 0;
let enderecoValido = false;

// Elementos DOM
const steps = {
    1: document.getElementById('step1'),
    2: document.getElementById('step2'),
    3: document.getElementById('step3')
};

const progressSteps = document.querySelectorAll('.progress-step');

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        carregarConfigEntrega(),
        carregarFormasPagamento()
    ]);
    renderizarCarrinho();
    configurarEventListeners();
    atualizarContadorCarrinho();
    verificarAuth();
    verificarCarrinhoVazio();
});

async function verificarCarrinhoVazio() {
    if (cart.getItems().length === 0) {
        showToast('Seu carrinho está vazio', 'warning');
        setTimeout(() => window.location.href = 'cardapio.html', 2000);
    }
}

async function carregarConfigEntrega() {
    try {
        const config = await api.getConfigEntrega();
        taxaEntrega = config.taxa_entrega || 0;
        valorMinimoPedido = config.valor_minimo_pedido || 0;
    } catch (error) {
        console.error('Erro ao carregar config de entrega:', error);
    }
}

async function carregarFormasPagamento() {
    try {
        const response = await api.getFormasPagamento(true);
        paymentMethods = response;
        renderizarFormasPagamento();
    } catch (error) {
        console.error('Erro ao carregar formas de pagamento:', error);
        showToast('Erro ao carregar formas de pagamento', 'error');
    }
}

function configurarEventListeners() {
    // Atualizar quando carrinho mudar
    cart.subscribe(() => {
        renderizarCarrinho();
        atualizarContadorCarrinho();
        renderizarConfirmacao();
    });

    // Busca de CEP
    const cepInput = document.getElementById('cep');
    const btnBuscarCep = document.getElementById('btnBuscarCep');

    cepInput.addEventListener('input', debounce(async (e) => {
        const cep = e.target.value.replace(/\D/g, '');
        if (cep.length === 8) {
            await buscarCEP(cep);
        }
    }, 300));

    btnBuscarCep.addEventListener('click', async () => {
        const cep = cepInput.value.replace(/\D/g, '');
        if (cep.length === 8) {
            await buscarCEP(cep);
        } else {
            showToast('CEP inválido', 'warning');
        }
    });

    // Habilitar campos após busca de CEP
    ['rua', 'bairro', 'cidade', 'estado'].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('input', validarEndereco);
    });

    document.getElementById('numero').addEventListener('input', validarEndereco);

    // Navegação entre passos
    document.getElementById('btnProximo1').addEventListener('click', () => irParaPasso(2));
    document.getElementById('btnVoltar2').addEventListener('click', () => irParaPasso(1));
    document.getElementById('btnProximo2').addEventListener('click', () => irParaPasso(3));
    document.getElementById('btnVoltar3').addEventListener('click', () => irParaPasso(2));

    // Forma de pagamento
    document.getElementById('paymentMethods').addEventListener('change', (e) => {
        if (e.target.name === 'paymentMethod') {
            selecionarPagamento(e.target.value);
        }
    });

    // Mostrar/ocultar campo de troco
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const method = paymentMethods.find(m => m.id === parseInt(radio.value));
            const trocoGroup = document.getElementById('trocoGroup');
            if (method && method.tipo === 'dinheiro') {
                trocoGroup.style.display = 'block';
                document.getElementById('troco').required = true;
            } else {
                trocoGroup.style.display = 'none';
                document.getElementById('troco').required = false;
            }
        });
    });

    // Submit do formulário
    document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await finalizarPedido();
    });

    // Atualizar resumo lateral
    document.getElementById('btnIrParaPagamento').addEventListener('click', () => irParaPasso(2));
}

async function buscarCEP(cep) {
    const btnBuscarCep = document.getElementById('btnBuscarCep');
    const originalText = btnBuscarCep.textContent;
    btnBuscarCep.textContent = 'Buscando...';
    btnBuscarCep.disabled = true;

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (data.erro) {
            throw new Error('CEP não encontrado');
        }

        document.getElementById('rua').value = data.logradouro || '';
        document.getElementById('rua').readonly = false;
        document.getElementById('bairro').value = data.bairro || '';
        document.getElementById('bairro').readonly = false;
        document.getElementById('cidade').value = data.localidade || '';
        document.getElementById('cidade').readonly = false;
        document.getElementById('estado').value = data.uf || '';
        document.getElementById('estado').disabled = false;

        document.getElementById('numero').focus();
        showToast('Endereço encontrado! Complete o número.', 'success');
        validarEndereco();
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        showToast('Erro ao buscar CEP. Preencha manualmente.', 'error');
        ['rua', 'bairro', 'cidade', 'estado'].forEach(id => {
            const el = document.getElementById(id);
            el.readonly = false;
            if (id === 'estado') el.disabled = false;
        });
    } finally {
        btnBuscarCep.textContent = originalText;
        btnBuscarCep.disabled = false;
    }
}

function validarEndereco() {
    const required = ['cep', 'rua', 'numero', 'bairro', 'cidade', 'estado'];
    enderecoValido = required.every(id => {
        const el = document.getElementById(id);
        return el.value.trim() !== '';
    });

    document.getElementById('btnProximo1').disabled = !enderecoValido;
}

function renderizarFormasPagamento() {
    const container = document.getElementById('paymentMethods');
    container.innerHTML = '';

    paymentMethods.forEach(method => {
        const label = document.createElement('label');
        label.className = 'payment-method';
        label.style.cssText = `
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px;
            background: var(--bg-elevated);
            border: 2px solid var(--border-subtle);
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all 0.3s ease;
            margin-bottom: 12px;
        `;

        const icons = {
            'dinheiro': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>',
            'cartao_credito': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
            'cartao_debito': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
            'pix': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M7 10l5 5 10-10"/></svg>'
        };

        label.innerHTML = `
            <input type="radio" name="paymentMethod" value="${method.id}" style="width: 20px; height: 20px; accent-color: var(--accent);">
            <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <div style="color: var(--accent);">${icons[method.tipo] || icons.dinheiro}</div>
                <div>
                    <strong style="color: var(--text-primary); font-family: var(--font-body);">${method.nome}</strong>
                    ${method.descricao ? `<br><small style="color: var(--text-muted);">${method.descricao}</small>` : ''}
                </div>
            </div>
        `;

        label.addEventListener('mouseenter', () => {
            if (!label.querySelector('input').checked) {
                label.style.borderColor = 'var(--border-accent)';
            }
        });

        label.addEventListener('mouseleave', () => {
            if (!label.querySelector('input').checked) {
                label.style.borderColor = 'var(--border-subtle)';
            }
        });

        container.appendChild(label);
    });
}

function selecionarPagamento(methodId) {
    selectedPaymentMethod = paymentMethods.find(m => m.id === parseInt(methodId));
    document.getElementById('btnProximo2').disabled = !selectedPaymentMethod;

    // Atualizar visual dos métodos
    document.querySelectorAll('.payment-method').forEach(label => {
        const radio = label.querySelector('input');
        if (radio.checked) {
            label.style.borderColor = 'var(--accent)';
            label.style.background = 'rgba(255, 193, 7, 0.1)';
        } else {
            label.style.borderColor = 'var(--border-subtle)';
            label.style.background = 'var(--bg-elevated)';
        }
    });
}

function irParaPasso(step) {
    if (step === 2 && !enderecoValido) {
        showToast('Preencha o endereço completo', 'warning');
        return;
    }

    if (step === 3 && !selectedPaymentMethod) {
        showToast('Selecione uma forma de pagamento', 'warning');
        return;
    }

    // Validar valor mínimo para entrega
    const subtotal = cart.getSubtotal();
    if (valorMinimoPedido > 0 && subtotal < valorMinimoPedido && step > 1) {
        showToast(`Valor mínimo para entrega: ${formatCurrency(valorMinimoPedido)}`, 'warning');
        return;
    }

    // Esconder passo atual
    steps[currentStep].classList.add('hidden');
    progressSteps[currentStep - 1].classList.remove('active');

    // Mostrar novo passo
    currentStep = step;
    steps[currentStep].classList.remove('hidden');
    progressSteps[currentStep - 1].classList.add('active');

    // Marcar passos anteriores como completados
    progressSteps.forEach((ps, index) => {
        if (index + 1 < currentStep) {
            ps.classList.add('completed');
        } else {
            ps.classList.remove('completed');
        }
    });

    // Atualizar passo 3 se indo para confirmação
    if (step === 3) {
        renderizarConfirmacao();
    }

    // Scroll para topo do formulário
    document.querySelector('.checkout-form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderizarCarrinho() {
    const itens = cart.getItems();
    const container = document.getElementById('checkoutItens');
    const containerConfirmacao = document.getElementById('confirmacaoItens');

    if (itens.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px;">Carrinho vazio</p>';
        containerConfirmacao.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Nenhum item</p>';
        atualizarTotais(0);
        return;
    }

    const renderItem = (item) => {
        const personalizacoesTotal = (item.personalizacoes || []).reduce(
            (sum, p) => sum + (p.preco_adicional || 0) * item.quantidade, 0
        );
        const itemTotal = (item.preco_base * item.quantidade) + personalizacoesTotal;

        return `
            <div style="display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border-subtle);">
                <div style="width: 50px; height: 50px; border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-elevated); flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                    ${item.imagem_url ? `<img src="${item.imagem_url}" alt="${item.nome}" style="width: 100%; height: 100%; object-fit: cover;">` : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>'}
                </div>
                <div style="flex: 1; min-width: 0;">
                    <p style="font-family: var(--font-title); font-size: 13px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.nome}</p>
                    <p style="font-size: 11px; color: var(--text-muted);">${formatCurrency(item.preco_base)} x ${item.quantidade}</p>
                    ${item.personalizacoes && item.personalizacoes.length > 0 ? `<p style="font-size: 10px; color: var(--text-secondary);">${item.personalizacoes.map(p => p.opcao_nome).join(', ')}</p>` : ''}
                </div>
                <span style="font-family: var(--font-display); font-size: 14px; color: var(--accent); white-space: nowrap;">${formatCurrency(itemTotal)}</span>
            </div>
        `;
    };

    container.innerHTML = itens.map(renderItem).join('');
    containerConfirmacao.innerHTML = itens.map(renderItem).join('');

    const subtotal = cart.getSubtotal();
    atualizarTotais(subtotal);
}

function atualizarTotais(subtotal) {
    const total = subtotal + taxaEntrega;

    // Sidebar
    document.getElementById('checkoutSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('checkoutTaxaEntrega').textContent = taxaEntrega > 0 ? formatCurrency(taxaEntrega) : 'Grátis';
    document.getElementById('checkoutDesconto').textContent = formatCurrency(0);
    document.getElementById('checkoutTotal').textContent = formatCurrency(total);

    // Confirmação
    document.getElementById('confSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('confTaxaEntrega').textContent = taxaEntrega > 0 ? formatCurrency(taxaEntrega) : 'Grátis';
    document.getElementById('confDesconto').textContent = formatCurrency(0);
    document.getElementById('confTotal').textContent = formatCurrency(total);

    // Botão ir para pagamento
    const btnIrPagamento = document.getElementById('btnIrParaPagamento');
    if (valorMinimoPedido > 0 && subtotal < valorMinimoPedido) {
        btnIrPagamento.disabled = true;
        btnIrPagamento.textContent = `Mínimo ${formatCurrency(valorMinimoPedido)} para entrega`;
        btnIrPagamento.classList.add('btn-secondary');
        btnIrPagamento.classList.remove('btn-primary');
    } else {
        btnIrPagamento.disabled = false;
        btnIrPagamento.textContent = 'Ir para Pagamento';
        btnIrPagamento.classList.add('btn-primary');
        btnIrPagamento.classList.remove('btn-secondary');
    }
    btnIrPagamento.style.display = 'block';
}

function renderizarConfirmacao() {
    const itens = cart.getItems();
    const subtotal = cart.getSubtotal();
    const total = subtotal + taxaEntrega;

    // Endereço
    const endereco = {
        rua: document.getElementById('rua').value,
        numero: document.getElementById('numero').value,
        complemento: document.getElementById('complemento').value,
        bairro: document.getElementById('bairro').value,
        cidade: document.getElementById('cidade').value,
        estado: document.getElementById('estado').value,
        referencia: document.getElementById('referencia').value
    };

    const enderecoTexto = `${endereco.rua}, ${endereco.numero}${endereco.complemento ? ', ' + endereco.complemento : ''} - ${endereco.bairro}, ${endereco.cidade} - ${endereco.estado}${endereco.referencia ? '. Ref: ' + endereco.referencia : ''}`;
    document.getElementById('confEnderecoTexto').textContent = enderecoTexto || 'Endereço não preenchido';

    // Pagamento
    if (selectedPaymentMethod) {
        let pagamentoTexto = selectedPaymentMethod.nome;
        if (selectedPaymentMethod.tipo === 'dinheiro') {
            const troco = document.getElementById('troco').value;
            if (troco) pagamentoTexto += ` - Troco para ${formatCurrency(parseFloat(troco.replace(',', '.')))}`;
        }
        document.getElementById('confPagamentoTexto').textContent = pagamentoTexto;
    } else {
        document.getElementById('confPagamentoTexto').textContent = 'Não selecionado';
    }
}

async function finalizarPedido() {
    const btnFinalizar = document.getElementById('btnFinalizarPedido');
    const originalText = btnFinalizar.innerHTML;

    btnFinalizar.disabled = true;
    btnFinalizar.innerHTML = '<div class="loading-spinner" style="width: 20px; height: 20px; border-width: 3px;"></div> Processando...';

    try {
        const itens = cart.getItems();
        if (itens.length === 0) {
            throw new Error('Carrinho vazio');
        }

        // Verificar autenticação do cliente
        const clienteToken = localStorage.getItem('cliente_token');
        const clienteUser = JSON.parse(localStorage.getItem('cliente_user') || 'null');

        if (!clienteToken || !clienteUser) {
            showToast('Você precisa estar logado para finalizar o pedido', 'warning');
            setTimeout(() => window.location.href = 'cadastro.html', 2000);
            return;
        }

        // Preparar dados do pedido
        const endereco = {
            rua: document.getElementById('rua').value,
            numero: document.getElementById('numero').value,
            complemento: document.getElementById('complemento').value,
            bairro: document.getElementById('bairro').value,
            cidade: document.getElementById('cidade').value,
            estado: document.getElementById('estado').value,
            referencia: document.getElementById('referencia').value,
            tipo: document.getElementById('tipoEndereco').value
        };

        const observacao = document.getElementById('observacao').value;
        let troco = null;
        if (selectedPaymentMethod && selectedPaymentMethod.tipo === 'dinheiro') {
            troco = parseFloat(document.getElementById('troco').value.replace(',', '.')) || null;
        }

        const pedidoData = {
            itens: cart.getPedidoItems(),
            endereco_entrega: endereco,
            forma_pagamento_id: selectedPaymentMethod.id,
            observacao: observacao,
            troco: troco
        };

        showLoading('Finalizando pedido...');
        const response = await api.createPedido(pedidoData);
        hideLoading();

        // Sucesso!
        cart.clear();

        // Mostrar modal de sucesso
        document.getElementById('pedidoNumero').textContent = response.numero || `#${response.id}`;
        const sucessoModal = document.getElementById('sucessoModal');
        sucessoModal.classList.remove('hidden');
        sucessoModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        showToast('Pedido realizado com sucesso!', 'success');

    } catch (error) {
        hideLoading();
        console.error('Erro ao finalizar pedido:', error);
        showToast(error.message || 'Erro ao finalizar pedido. Tente novamente.', 'error');
    } finally {
        btnFinalizar.disabled = false;
        btnFinalizar.innerHTML = originalText;
    }
}

function atualizarContadorCarrinho() {
    const cartCount = document.getElementById('cartCount');
    const total = cart.getTotalItems();
    cartCount.textContent = total;
    cartCount.style.display = total > 0 ? 'flex' : 'none';
}

async function verificarAuth() {
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('auth_user') || 'null');
    const clienteToken = localStorage.getItem('cliente_token');
    const clienteUser = JSON.parse(localStorage.getItem('cliente_user') || 'null');

    const userButton = document.getElementById('userButton');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminLink = document.getElementById('adminLink');

    if (clienteToken && clienteUser) {
        userButton.style.display = 'flex';
        userName.textContent = clienteUser.nome;
        userAvatar.textContent = clienteUser.nome.charAt(0).toUpperCase();
        adminLink.style.display = 'none';

        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('cliente_token');
            localStorage.removeItem('cliente_user');
            showToast('Logout realizado com sucesso', 'success');
            setTimeout(() => window.location.reload(), 1000);
        });
    } else if (token && user) {
        // Admin logado - verificar role
        const payload = decodificarJWT(token);
        const isAdmin = payload && payload.role === 'administrador';

        userButton.style.display = 'flex';
        userName.textContent = user.nome;
        userAvatar.textContent = user.nome.charAt(0).toUpperCase();
        adminLink.style.display = isAdmin ? 'inline-flex' : 'none';

        logoutBtn.addEventListener('click', () => {
            api.clearAuth();
            showToast('Logout realizado com sucesso', 'success');
            setTimeout(() => window.location.reload(), 1000);
        });
    } else {
        userButton.style.display = 'none';
        adminLink.style.display = 'none';
    }
}