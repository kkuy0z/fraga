import api from './api.js';
import cart from './cart.js';
import { formatCurrency, showToast, showLoading, hideLoading, debounce } from './utils.js';
import { verificarAuth, handleLogout } from './shared-components.js';

// Elementos DOM
const carrinhoLista = document.getElementById('carrinhoLista');
const carrinhoVazio = document.getElementById('carrinhoVazio');
const carrinhoAcoes = document.getElementById('carrinhoAcoes');
const cartCount = document.getElementById('cartCount');
const resumoSubtotal = document.getElementById('resumoSubtotal');
const resumoTaxaEntrega = document.getElementById('resumoTaxaEntrega');
const resumoDesconto = document.getElementById('resumoDesconto');
const resumoTotal = document.getElementById('resumoTotal');
const btnFinalizar = document.getElementById('btnFinalizar');
const btnLimparCarrinho = document.getElementById('btnLimparCarrinho');

// Configurações de entrega
let taxaEntrega = 0;
let valorMinimoPedido = 0;
let bairrosTaxa = {}; // Taxas por bairro
let cepValido = false;
let enderecoSelecionado = null;

// Modal de personalização
let itemPersonalizando = null;

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await carregarConfigEntrega();
    renderizarCarrinho();
    configurarEventListeners();
    atualizarContadorCarrinho();
    verificarAuth();
});

async function carregarConfigEntrega() {
    try {
        const config = await api.getConfigEntrega();
        taxaEntrega = config.taxa_entrega || 0;
        valorMinimoPedido = config.valor_minimo_pedido || 0;
        bairrosTaxa = config.bairros_taxa || {};
    } catch (error) {
        console.error('Erro ao carregar config de entrega:', error);
    }
}

function configurarEventListeners() {
    // Atualizar quando carrinho mudar
    cart.subscribe(() => {
        renderizarCarrinho();
        atualizarContadorCarrinho();
    });

    // Limpar carrinho
    btnLimparCarrinho.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja limpar o carrinho?')) {
            cart.clear();
            showToast('Carrinho limpo', 'info');
        }
    });

    // Botão finalizar - redireciona para checkout
    btnFinalizar.addEventListener('click', () => {
        window.location.href = 'checkout.html';
    });

    // Fechar modal de personalização ao clicar fora
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('personalizacaoModal');
        if (modal && !modal.classList.contains('hidden') && e.target === modal) {
            fecharModalPersonalizacao();
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

function renderizarCarrinho() {
    const itens = cart.getItems();

    if (itens.length === 0) {
        carrinhoLista.innerHTML = '';
        carrinhoVazio.classList.remove('hidden');
        carrinhoAcoes.classList.add('hidden');
        btnFinalizar.disabled = true;
        atualizarResumo(0);
        return;
    }

    carrinhoVazio.classList.add('hidden');
    carrinhoAcoes.classList.remove('hidden');
    btnFinalizar.disabled = false;

    carrinhoLista.innerHTML = '';

    itens.forEach(item => {
        const elemento = criarItemCarrinho(item);
        carrinhoLista.appendChild(elemento);
    });

    const subtotal = cart.getSubtotal();
    atualizarResumo(subtotal);
}

function criarItemCarrinho(item) {
    const div = document.createElement('div');
    div.className = 'card carrinho-item';
    div.style.cssText = 'padding: 0; display: grid; grid-template-columns: 100px 1fr auto; gap: 16px; align-items: start; margin-bottom: 12px;';
    div.setAttribute('role', 'listitem');
    div.dataset.key = item.key;

    const temImagem = item.imagem_url && item.imagem_url.trim() !== '';

    // Calcular total do item
    const personalizacoesTotal = (item.personalizacoes || []).reduce(
        (sum, p) => sum + (p.preco_adicional || 0) * item.quantidade, 0
    );
    const itemTotal = (item.preco_base * item.quantidade) + personalizacoesTotal;

    div.innerHTML = `
        <div class="carrinho-item-imagem" style="width: 100px; height: 80px; border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            ${temImagem ? `
                <img src="${item.imagem_url}" alt="${item.nome}" style="width: 100%; height: 100%; object-fit: cover;" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div style="display:none; color: var(--text-muted);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg></div>
            ` : `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="M21 15l-5-5L5 21"></path></svg>
            `}
        </div>

        <div class="carrinho-item-info" style="min-width: 0;">
            <h4 class="carrinho-item-nome" style="font-family: var(--font-title); font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">${escapeHtml(item.nome)}</h4>
            <div class="carrinho-item-detalhes" style="font-size: 13px; color: var(--text-muted); line-height: 1.8;">
                <span>${formatCurrency(item.preco_base)} x ${item.quantidade}</span>
                ${item.personalizacoes && item.personalizacoes.length > 0 ? `
                    <span>${item.personalizacoes.map(p => `${escapeHtml(p.opcao_nome)}${p.preco_adicional > 0 ? ` (+${formatCurrency(p.preco_adicional)})` : ''}`).join(', ')}</span>
                ` : ''}
            </div>
            <div class="carrinho-item-acoes" style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn-personalizar btn btn-sm btn-outline" data-key="${item.key}" style="font-size: 11px; padding: 4px 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    Personalizar
                </button>
                <button class="btn-duplicar btn btn-sm btn-ghost" data-key="${item.key}" style="font-size: 11px; padding: 4px 8px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Duplicar
                </button>
            </div>
        </div>

        <div class="carrinho-item-controles" style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
            <div class="quantity-control" style="display: flex; align-items: center; gap: 8px; background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 4px 8px;">
                <button class="qty-btn" data-action="decrement" data-key="${item.key}" aria-label="Diminuir quantidade" style="background: none; border: none; color: var(--text-primary); font-size: 18px; cursor: pointer; padding: 4px; line-height: 1; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">−</button>
                <span class="qty-value" style="font-family: var(--font-display); font-size: 16px; min-width: 24px; text-align: center;">${item.quantidade}</span>
                <button class="qty-btn" data-action="increment" data-key="${item.key}" aria-label="Aumentar quantidade" style="background: none; border: none; color: var(--text-primary); font-size: 18px; cursor: pointer; padding: 4px; line-height: 1; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">+</button>
            </div>
            <span class="carrinho-item-total" style="font-family: var(--font-display); font-size: 18px; color: var(--accent);">${formatCurrency(itemTotal)}</span>
            <button class="btn-remover" data-key="${item.key}" aria-label="Remover ${escapeHtml(item.nome)}" style="background: none; border: none; color: var(--text-muted); font-size: 13px; cursor: pointer; padding: 4px; transition: color 0.2s;">Remover</button>
        </div>
    `;

    // Eventos dos botões de quantidade
    div.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const key = btn.dataset.key;
            if (action === 'increment') cart.increment(key);
            else if (action === 'decrement') cart.decrement(key);
        });
    });

    // Evento remover
    div.querySelector('.btn-remover').addEventListener('click', () => {
        cart.removeItem(item.key);
        showToast(`${item.nome} removido do carrinho`, 'info');
    });

    // Evento personalizar
    div.querySelector('.btn-personalizar').addEventListener('click', () => {
        abrirModalPersonalizacao(item);
    });

    // Evento duplicar
    div.querySelector('.btn-duplicar').addEventListener('click', () => {
        duplicarItem(item);
    });

    return div;
}

async function abrirModalPersonalizacao(item) {
    itemPersonalizando = item;

    try {
        showLoading('Carregando opções...');
        const produto = await api.getProdutoById(item.produto_id);
        hideLoading();

        if (!produto.personalizacoes || produto.personalizacoes.length === 0) {
            showToast('Este produto não possui opções de personalização', 'info');
            return;
        }

        const modal = criarModalPersonalizacao(produto, item);
        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.remove('hidden'));
        document.body.style.overflow = 'hidden';

    } catch (error) {
        hideLoading();
        console.error('Erro ao carregar personalizações:', error);
        showToast('Erro ao carregar opções de personalização', 'error');
    }
}

function criarModalPersonalizacao(produto, itemAtual) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay hidden';
    modal.id = 'personalizacaoModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'personalizacaoTitulo');

    // Agrupar personalizações atuais por grupo_id
    const personalizacoesAtuais = {};
    (itemAtual.personalizacoes || []).forEach(p => {
        personalizacoesAtuais[p.grupo_id] = p.opcao_id;
    });

    modal.innerHTML = `
        <div class="modal modal-lg" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h2 class="modal-title" id="personalizacaoTitulo">Personalizar: ${escapeHtml(produto.nome)}</h2>
                <button class="modal-close" id="fecharPersonalizacao" aria-label="Fechar personalização">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><use href="#i-x" /></svg>
                </button>
            </div>
            <div class="modal-body" style="padding: var(--space-6);">
                <form id="formPersonalizacao">
                    ${produto.personalizacoes.map(grupo => `
                        <fieldset class="personalizacao-grupo" style="margin-bottom: var(--space-6); padding-bottom: var(--space-6); border-bottom: 1px solid var(--border-subtle);">
                            <legend class="form-label" style="margin-bottom: var(--space-4); display: flex; align-items: center; gap: var(--space-2);">
                                ${escapeHtml(grupo.nome)}
                                ${grupo.obrigatorio ? '<span class="required" style="color: var(--error);">*</span>' : '<span style="color: var(--text-dim); font-size: var(--fs-xs);">(opcional)</span>'}
                            </legend>
                            <p class="form-help" style="margin-bottom: var(--space-3);">${escapeHtml(grupo.descricao || '')}</p>
                            <div class="opcoes-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--space-3);">
                                ${grupo.opcoes.map(opcao => {
                                    const isSelected = personalizacoesAtuais[grupo.id] === opcao.id;
                                    const precoExtra = opcao.preco_adicional > 0 ? ` +${formatCurrency(opcao.preco_adicional)}` : '';
                                    return `
                                        <label class="opcao-card" style="
                                            display: flex;
                                            flex-direction: column;
                                            align-items: center;
                                            padding: var(--space-4);
                                            background: var(--bg-elevated);
                                            border: 2px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'};
                                            border-radius: var(--radius-md);
                                            cursor: pointer;
                                            transition: all var(--transition-base);
                                            ${isSelected ? 'background: var(--accent-weak);' : ''}
                                        ">
                                            <input type="${grupo.tipo === 'unica' ? 'radio' : 'checkbox'}" name="grupo_${grupo.id}" value="${opcao.id}" ${isSelected ? 'checked' : ''} style="display: none;" ${grupo.obrigatorio && grupo.tipo === 'unica' ? 'required' : ''}>
                                            ${opcao.imagem ? `<img src="${opcao.imagem}" alt="${escapeHtml(opcao.nome)}" style="width: 60px; height: 60px; object-fit: cover; border-radius: var(--radius-sm); margin-bottom: var(--space-2);">` : ''}
                                            <span style="font-family: var(--font-body); font-size: var(--fs-sm); font-weight: 600; color: var(--text-primary); text-align: center;">${escapeHtml(opcao.nome)}</span>
                                            ${precoExtra ? `<span style="font-family: var(--font-heading); font-size: var(--fs-xs); color: var(--accent); margin-top: 2px;">${precoExtra}</span>` : ''}
                                        </label>
                                    `;
                                }).join('')}
                            </div>
                        </fieldset>
                    `).join('')}
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" id="btnCancelarPersonalizacao">Cancelar</button>
                <button type="button" class="btn btn-primary" id="btnSalvarPersonalizacao">
                    <svg class="btn-icon" aria-hidden="true"><use href="#i-save" /></svg>
                    Salvar Alterações
                </button>
            </div>
        </div>
    `;

    // Eventos
    modal.querySelector('#fecharPersonalizacao').addEventListener('click', fecharModalPersonalizacao);
    modal.querySelector('#btnCancelarPersonalizacao').addEventListener('click', fecharModalPersonalizacao);
    modal.querySelector('#btnSalvarPersonalizacao').addEventListener('click', () => salvarPersonalizacao(produto));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) fecharModalPersonalizacao();
    });

    // Visual feedback nas opções
    modal.querySelectorAll('.opcao-card').forEach(card => {
        const input = card.querySelector('input');
        card.addEventListener('click', () => {
            input.checked = !input.checked;
            if (input.type === 'radio') {
                // Desmarcar outros do mesmo grupo
                modal.querySelectorAll(`input[name="${input.name}"]`).forEach(other => {
                    if (other !== input) other.checked = false;
                });
            }
            atualizarVisualOpcoes(modal, input.name);
        });
    });

    return modal;
}

function atualizarVisualOpcoes(modal, groupName) {
    modal.querySelectorAll(`input[name="${groupName}"]`).forEach(input => {
        const card = input.closest('.opcao-card');
        if (input.checked) {
            card.style.borderColor = 'var(--accent)';
            card.style.background = 'var(--accent-weak)';
        } else {
            card.style.borderColor = 'var(--border-subtle)';
            card.style.background = 'var(--bg-elevated)';
        }
    });
}

function fecharModalPersonalizacao() {
    const modal = document.getElementById('personalizacaoModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.addEventListener('transitionend', () => modal.remove(), { once: true });
        document.body.style.overflow = '';
    }
    itemPersonalizando = null;
}

function salvarPersonalizacao(produto) {
    const form = document.getElementById('formPersonalizacao');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const novasPersonalizacoes = [];

    // Processar cada grupo
    produto.personalizacoes.forEach(grupo => {
        const valores = formData.getAll(`grupo_${grupo.id}`);
        valores.forEach(opcaoId => {
            const opcao = grupo.opcoes.find(o => o.id == opcaoId);
            if (opcao) {
                novasPersonalizacoes.push({
                    grupo_id: grupo.id,
                    grupo_nome: grupo.nome,
                    opcao_id: opcao.id,
                    opcao_nome: opcao.nome,
                    preco_adicional: opcao.preco_adicional || 0
                });
            }
        });
    });

    // Remover item antigo e adicionar com novas personalizações
    cart.removeItem(itemPersonalizando.key);
    cart.addItem({
        id: produto.id,
        nome: produto.nome,
        preco_base: produto.preco_base,
        imagem_url: produto.imagem_url
    }, novasPersonalizacoes);

    showToast('Personalização atualizada!', 'success');
    fecharModalPersonalizacao();
}

function duplicarItem(item) {
    cart.addItem({
        id: item.produto_id,
        nome: item.nome,
        preco_base: item.preco_base,
        imagem_url: item.imagem_url
    }, item.personalizacoes || []);
    showToast(`${item.nome} duplicado!`, 'success');
}

function atualizarResumo(subtotal) {
    // Calcular taxa de entrega baseada no endereço se disponível
    let taxa = taxaEntrega;
    if (enderecoSelecionado && enderecoSelecionado.bairro && bairrosTaxa[enderecoSelecionado.bairro]) {
        taxa = bairrosTaxa[enderecoSelecionado.bairro];
    }

    const total = subtotal + taxa;

    resumoSubtotal.textContent = formatCurrency(subtotal);
    resumoTaxaEntrega.textContent = taxa > 0 ? formatCurrency(taxa) : 'Grátis';
    resumoDesconto.textContent = formatCurrency(0);
    resumoTotal.textContent = formatCurrency(total);

    // Verificar valor mínimo
    if (valorMinimoPedido > 0 && subtotal < valorMinimoPedido) {
        btnFinalizar.disabled = true;
        btnFinalizar.textContent = `Mínimo ${formatCurrency(valorMinimoPedido)} para entrega`;
        btnFinalizar.classList.add('btn-secondary');
        btnFinalizar.classList.remove('btn-primary');
    } else {
        btnFinalizar.disabled = false;
        btnFinalizar.textContent = 'Finalizar Pedido';
        btnFinalizar.classList.add('btn-primary');
        btnFinalizar.classList.remove('btn-secondary');
    }
}

// Função auxiliar para escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Exportar funções para uso global se necessário
window.carrinho = {
    atualizarResumo,
    taxaEntrega: () => taxaEntrega,
    setEndereco: (endereco) => { enderecoSelecionado = endereco; atualizarResumo(cart.getSubtotal()); }
};