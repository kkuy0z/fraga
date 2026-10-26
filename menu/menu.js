// Fraga Lanches - Menu Page JavaScript
// Handles: categories, products, cart, product modal, search, checkout

const API_BASE = '/api';

// State
let state = {
    categories: [],
    products: [],
    filteredProducts: [],
    currentCategory: 'all',
    searchQuery: '',
    cart: [],
    deliveryFee: 5.00,
    minOrder: 0,
    isLoading: false
};

// DOM Elements
const elements = {
    categoriesList: document.getElementById('categories-list'),
    productsGrid: document.getElementById('products-grid'),
    loadingState: document.querySelector('.loading-state'),
    emptyState: document.getElementById('empty-state'),
    searchInput: document.getElementById('search-input'),
    searchClear: document.querySelector('.search-clear'),
    clearSearchBtn: document.getElementById('clear-search'),
    cartSidebar: document.getElementById('cart-sidebar'),
    cartItems: document.getElementById('cart-items'),
    cartEmpty: document.getElementById('cart-empty'),
    cartFooter: document.getElementById('cart-footer'),
    cartSubtotal: document.getElementById('cart-subtotal'),
    cartDelivery: document.getElementById('cart-delivery'),
    cartTotal: document.getElementById('cart-total'),
    cartCount: document.querySelector('.cart-count'),
    checkoutBtn: document.getElementById('checkout-btn'),
    cartToggle: document.querySelector('.nav-cart'),
    cartClose: document.querySelector('.cart-close'),
    cartBackdrop: document.querySelector('.cart-backdrop'),
    deliveryFeeEl: document.getElementById('delivery-fee'),
    minOrderInfo: document.getElementById('min-order-info'),
    productModal: document.getElementById('product-modal'),
    modalClose: document.querySelector('.modal-close'),
    modalBackdrop: document.querySelector('.modal-backdrop'),
    modalImage: document.getElementById('modal-image'),
    modalCategory: document.getElementById('modal-category'),
    modalTitle: document.getElementById('modal-title'),
    modalDescription: document.getElementById('modal-description'),
    modalPrice: document.getElementById('modal-price'),
    personalizationSection: document.getElementById('personalization-section'),
    personalizationGroups: document.getElementById('personalization-groups'),
    modalQuantity: document.getElementById('modal-quantity'),
    qtyDecrease: document.getElementById('qty-decrease'),
    qtyIncrease: document.getElementById('qty-increase'),
    modalCancel: document.getElementById('modal-cancel'),
    modalAdd: document.getElementById('modal-add'),
    modalAddPrice: document.getElementById('modal-add-price'),
    toastContainer: document.getElementById('toast-container'),
    categoriesToggle: document.querySelector('.categories-toggle'),
    mobileMenuBtn: document.querySelector('.menu-mobile'),
    mobileMenu: document.getElementById('mobile-menu')
};

let currentProduct = null;
let selectedPersonalizations = new Map();

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await init();
    setupEventListeners();
});

async function init() {
    showLoading(true);
    try {
        await Promise.all([
            loadCategories(),
            loadProducts(),
            loadDeliveryConfig()
        ]);
        renderCategories();
        renderProducts();
        loadCartFromStorage();
        updateCartUI();
    } catch (error) {
        console.error('Init error:', error);
        showToast('Erro ao carregar o cardápio', 'error');
    } finally {
        showLoading(false);
    }
}

function setupEventListeners() {
    // Search
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    elements.searchClear.addEventListener('click', clearSearch);
    elements.clearSearchBtn.addEventListener('click', clearSearch);

    // Cart
    elements.cartToggle.addEventListener('click', openCart);
    elements.cartClose.addEventListener('click', closeCart);
    elements.cartBackdrop.addEventListener('click', closeCart);
    elements.checkoutBtn.addEventListener('click', handleCheckout);

    // Modal
    elements.modalClose.addEventListener('click', closeModal);
    elements.modalBackdrop.addEventListener('click', closeModal);
    elements.modalCancel.addEventListener('click', closeModal);
    elements.modalAdd.addEventListener('click', addToCartFromModal);
    elements.qtyDecrease.addEventListener('click', () => changeQuantity(-1));
    elements.qtyIncrease.addEventListener('click', () => changeQuantity(1));
    elements.modalQuantity.addEventListener('change', validateQuantity);

    // Categories toggle (mobile)
    elements.categoriesToggle.addEventListener('click', toggleCategories);

    // Mobile menu
    elements.mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    elements.mobileMenu.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => closeMobileMenu());
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeCart();
            closeMobileMenu();
        }
    });

    // Close cart on checkout link click (if any)
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-close-cart]')) closeCart();
    });
}

// ========== API CALLS ==========
async function apiGet(endpoint, params = {}) {
    const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') url.searchParams.append(k, v);
    });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function loadCategories() {
    const data = await apiGet('/categorias');
    state.categories = data;
}

async function loadProducts(categoryId = null, search = '') {
    const params = {};
    if (categoryId && categoryId !== 'all') params.categoria_id = categoryId;
    if (search) params.search = search;
    params.limit = 100;
    params.disponivel = 'true';

    const data = await apiGet('/produtos', params);
    state.products = data.data || data; // Handle both paginated and array responses
    state.filteredProducts = [...state.products];
}

async function loadDeliveryConfig() {
    try {
        const data = await apiGet('/entrega/config');
        state.deliveryFee = data.taxa_entrega || 5.00;
        state.minOrder = data.valor_minimo_pedido || 0;
        elements.deliveryFeeEl.textContent = formatCurrency(state.deliveryFee);
        if (state.minOrder > 0) {
            elements.minOrderInfo.hidden = false;
            elements.minOrderInfo.querySelector('strong').textContent = formatCurrency(state.minOrder);
        }
    } catch (error) {
        console.warn('Could not load delivery config, using defaults');
    }
}

async function loadProductDetails(productId) {
    const data = await apiGet(`/produtos/${productId}`);
    return data;
}

// ========== RENDER FUNCTIONS ==========
function renderCategories() {
    const container = elements.categoriesList;
    const activeBtn = container.querySelector('.category-btn.active');
    const activeCategory = activeBtn?.dataset.category || 'all';

    // Keep "Todos" button, add dynamic categories
    const dynamicCategories = state.categories.filter(c => c.ativo).map(cat => `
        <button class="category-btn" data-category="${cat.id}" aria-pressed="false">
            <span class="category-icon">${getCategoryIcon(cat.nome)}</span>
            <span class="category-name">${cat.nome.toUpperCase()}</span>
        </button>
    `).join('');

    // Insert after "Todos" button
    const todosBtn = container.querySelector('[data-category="all"]');
    todosBtn.insertAdjacentHTML('afterend', dynamicCategories);

    // Add click listeners
    container.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => selectCategory(btn.dataset.category));
    });

    // Restore active state
    const newActive = container.querySelector(`[data-category="${activeCategory}"]`);
    if (newActive) setActiveCategory(newActive);
}

function getCategoryIcon(nome) {
    const icons = {
        'hambúrgueres': '🍔', 'hamburgueres': '🍔',
        'marmitas': '🍱',
        'porções': '🍟', 'porcoes': '🍟',
        'bebidas': '🥤',
        'sobremesas': '🍰'
    };
    return icons[nome.toLowerCase()] || '🍽️';
}

function selectCategory(categoryId) {
    state.currentCategory = categoryId;
    setActiveCategory(elements.categoriesList.querySelector(`[data-category="${categoryId}"]`));
    filterProducts();
    closeMobileMenu();
}

function setActiveCategory(btn) {
    elements.categoriesList.querySelectorAll('.category-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
    });
    if (btn) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
    }
}

function renderProducts() {
    const container = elements.productsGrid;
    const products = state.filteredProducts;

    if (products.length === 0) {
        container.innerHTML = '';
        elements.emptyState.hidden = false;
        return;
    }

    elements.emptyState.hidden = true;

    container.innerHTML = products.map(product => `
        <article class="product-card" data-id="${product.id}" role="listitem">
            <div class="product-image-wrapper">
                <img src="${product.imagem_url || '/img/placeholder-product.jpg'}"
                     alt="${escapeHtml(product.nome)}"
                     class="product-image"
                     loading="lazy"
                     onerror="this.src='/img/placeholder-product.jpg'">
            </div>
            <div class="product-info">
                <span class="product-category">${escapeHtml(product.categoria_nome || 'Sem categoria')}</span>
                <h3 class="product-name">${escapeHtml(product.nome)}</h3>
                ${product.descricao ? `<p class="product-description">${escapeHtml(product.descricao)}</p>` : ''}
                <div class="product-footer">
                    <span class="product-price">${formatCurrency(product.preco_base)}</span>
                    <button class="btn btn-add" data-id="${product.id}" aria-label="Adicionar ${escapeHtml(product.nome)} ao carrinho">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                    </button>
                </div>
            </div>
        </article>
    `).join('');

    // Add click listeners for product cards and add buttons
    container.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-add')) {
                openProductModal(card.dataset.id);
            }
        });
    });

    container.querySelectorAll('.btn-add').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            quickAddToCart(btn.dataset.id);
        });
    });
}

function filterProducts() {
    let filtered = [...state.products];

    // Category filter
    if (state.currentCategory !== 'all') {
        filtered = filtered.filter(p => String(p.categoria_id) === String(state.currentCategory));
    }

    // Search filter
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        filtered = filtered.filter(p =>
            p.nome.toLowerCase().includes(query) ||
            (p.descricao && p.descricao.toLowerCase().includes(query)) ||
            (p.categoria_nome && p.categoria_nome.toLowerCase().includes(query))
        );
    }

    state.filteredProducts = filtered;
    renderProducts();
}

// ========== SEARCH ==========
function handleSearch(e) {
    state.searchQuery = e.target.value.trim();
    elements.searchClear.hidden = !state.searchQuery;
    filterProducts();
}

function clearSearch() {
    elements.searchInput.value = '';
    elements.searchClear.hidden = true;
    state.searchQuery = '';
    filterProducts();
    elements.searchInput.focus();
}

// ========== PRODUCT MODAL ==========
async function openProductModal(productId) {
    try {
        showLoading(true);
        const product = await loadProductDetails(productId);
        currentProduct = product;
        selectedPersonalizations.clear();

        // Fill modal
        elements.modalImage.src = product.imagem_url || '/img/placeholder-product.jpg';
        elements.modalImage.alt = product.nome;
        elements.modalCategory.textContent = product.categoria_nome || '';
        elements.modalTitle.textContent = product.nome;
        elements.modalDescription.textContent = product.descricao || '';
        elements.modalPrice.textContent = formatCurrency(product.preco_base);

        // Personalizations
        if (product.personalizacoes && product.personalizacoes.length > 0) {
            elements.personalizationSection.hidden = false;
            renderPersonalizations(product.personalizacoes);
        } else {
            elements.personalizationSection.hidden = true;
            elements.personalizationGroups.innerHTML = '';
        }

        // Reset quantity
        elements.modalQuantity.value = 1;
        updateModalAddPrice();

        // Show modal
        elements.productModal.showModal();
        document.body.style.overflow = 'hidden';
    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Erro ao carregar produto', 'error');
    } finally {
        showLoading(false);
    }
}

function renderPersonalizations(grupos) {
    elements.personalizationGroups.innerHTML = grupos.map(grupo => {
        const isMulti = ['escolha_multipla', 'adicional'].includes(grupo.tipo);
        const opcoesHtml = (grupo.opcoes || []).filter(o => o.ativo).map(opcao => `
            <label class="personalization-option ${isMulti ? 'checkbox' : 'radio'}" data-grupo="${grupo.id}" data-opcao="${opcao.id}">
                <input type="${isMulti ? 'checkbox' : 'radio'}" name="grupo_${grupo.id}" value="${opcao.id}"
                       ${grupo.obrigatorio && !isMulti ? 'required' : ''} aria-label="${escapeHtml(opcao.nome)}">
                <span class="option-content">
                    <span class="option-name">${escapeHtml(opcao.nome)}</span>
                    ${opcao.preco_adicional > 0 ? `<span class="option-price">${formatCurrency(opcao.preco_adicional)}</span>` : ''}
                </span>
                <span class="option-check" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </span>
            </label>
        `).join('');

        return `
            <fieldset class="personalization-group" data-grupo-id="${grupo.id}">
                <legend class="group-label">
                    ${escapeHtml(grupo.nome)}
                    ${grupo.obrigatorio ? '<span class="required" aria-hidden="true">*</span>' : ''}
                    ${grupo.tipo === 'escolha_multipla' ? `<span class="group-hint">Selecione até ${grupo.max_selecoes}</span>` : ''}
                    ${grupo.tipo === 'adicional' ? `<span class="group-hint">Adicione quantos quiser</span>` : ''}
                </legend>
                <div class="options-grid">${opcoesHtml}</div>
            </fieldset>
        `;
    }).join('');

    // Add listeners
    elements.personalizationGroups.querySelectorAll('.personalization-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            if (e.target.type === 'checkbox' || e.target.type === 'radio') return; // Let native handle
            const input = opt.querySelector('input');
            if (input) {
                input.click();
            }
        });
    });

    elements.personalizationGroups.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', handlePersonalizationChange);
    });
}

function handlePersonalizationChange(e) {
    const input = e.target;
    const grupoId = input.name.replace('grupo_', '');
    const opcaoId = parseInt(input.value);
    const grupoEl = elements.personalizationGroups.querySelector(`[data-grupo-id="${grupoId}"]`);
    const grupo = currentProduct.personalizacoes.find(g => String(g.id) === String(grupoId));
    const opcao = grupo.opcoes.find(o => o.id === opcaoId);

    if (input.type === 'checkbox') {
        if (!selectedPersonalizations.has(grupoId)) {
            selectedPersonalizations.set(grupoId, new Set());
        }
        const set = selectedPersonalizations.get(grupoId);
        if (input.checked) {
            if (set.size < grupo.max_selecoes) {
                set.add(opcaoId);
            } else {
                input.checked = false;
                showToast(`Máximo de ${grupo.max_selecoes} seleções para ${grupo.nome}`, 'warning');
            }
        } else {
            set.delete(opcaoId);
        }
    } else if (input.type === 'radio') {
        selectedPersonalizations.set(grupoId, new Set([opcaoId]));
    }

    updateModalAddPrice();
    validatePersonalizations();
}

function validatePersonalizations() {
    let allValid = true;
    currentProduct.personalizacoes.forEach(grupo => {
        const selected = selectedPersonalizations.get(String(grupo.id)) || new Set();
        const grupoEl = elements.personalizationGroups.querySelector(`[data-grupo-id="${grupo.id}"]`);
        const isValid = !grupo.obrigatorio || selected.size >= grupo.min_selecoes;
        if (grupoEl) grupoEl.classList.toggle('invalid', !isValid);
        if (!isValid) allValid = false;
    });
    elements.modalAdd.disabled = !allValid;
    return allValid;
}

function updateModalAddPrice() {
    const qty = parseInt(elements.modalQuantity.value) || 1;
    let additional = 0;
    selectedPersonalizations.forEach(set => {
        set.forEach(opcaoId => {
            currentProduct.personalizacoes.forEach(grupo => {
                const opcao = grupo.opcoes.find(o => o.id === opcaoId);
                if (opcao) additional += opcao.preco_adicional;
            });
        });
    });
    const basePrice = currentProduct.preco_base;
    const total = (basePrice + additional) * qty;
    elements.modalAddPrice.textContent = formatCurrency(total);
}

function changeQuantity(delta) {
    const input = elements.modalQuantity;
    let val = parseInt(input.value) || 1;
    val = Math.max(1, Math.min(99, val + delta));
    input.value = val;
    updateModalAddPrice();
}

function validateQuantity() {
    const input = elements.modalQuantity;
    let val = parseInt(input.value) || 1;
    val = Math.max(1, Math.min(99, val));
    input.value = val;
    updateModalAddPrice();
}

function closeModal() {
    elements.productModal.close();
    document.body.style.overflow = '';
    currentProduct = null;
    selectedPersonalizations.clear();
}

async function addToCartFromModal() {
    if (!currentProduct || !validatePersonalizations()) return;

    const qty = parseInt(elements.modalQuantity.value) || 1;
    const personalizacoes = [];

    selectedPersonalizations.forEach((set, grupoId) => {
        const grupo = currentProduct.personalizacoes.find(g => String(g.id) === String(grupoId));
        set.forEach(opcaoId => {
            const opcao = grupo.opcoes.find(o => o.id === opcaoId);
            if (opcao) {
                personalizacoes.push({
                    grupo_id: parseInt(grupoId),
                    grupo_nome: grupo.nome,
                    opcao_id: opcaoId,
                    opcao_nome: opcao.nome,
                    preco_adicional: opcao.preco_adicional
                });
            }
        });
    });

    addToCart(currentProduct, qty, personalizacoes);
    closeModal();
    showToast(`${currentProduct.nome} adicionado ao carrinho`, 'success');
    openCart();
}

function quickAddToCart(productId) {
    const product = state.products.find(p => String(p.id) === String(productId));
    if (!product) return;

    // Check if product has required personalizations
    const hasRequiredPersonalizations = product.personalizacoes &&
        product.personalizacoes.some(g => g.obrigatorio && g.min_selecoes > 0);

    if (hasRequiredPersonalizations) {
        openProductModal(productId);
    } else {
        addToCart(product, 1, []);
        showToast(`${product.nome} adicionado ao carrinho`, 'success');
        openCart();
    }
}

// ========== CART ==========
function addToCart(product, quantity, personalizacoes = []) {
    const existingIndex = state.cart.findIndex(item =>
        item.product.id === product.id &&
        JSON.stringify(item.personalizacoes.sort((a, b) => a.opcao_id - b.opcao_id)) ===
        JSON.stringify(personalizacoes.sort((a, b) => a.opcao_id - b.opcao_id))
    );

    if (existingIndex >= 0) {
        state.cart[existingIndex].quantity += quantity;
    } else {
        state.cart.push({
            product: {
                id: product.id,
                nome: product.nome,
                preco_base: product.preco_base,
                imagem_url: product.imagem_url,
                categoria_nome: product.categoria_nome
            },
            quantity,
            personalizacoes
        });
    }

    saveCartToStorage();
    updateCartUI();
}

function removeFromCart(index) {
    state.cart.splice(index, 1);
    saveCartToStorage();
    updateCartUI();
}

function updateQuantity(index, quantity) {
    if (quantity < 1) {
        removeFromCart(index);
        return;
    }
    state.cart[index].quantity = quantity;
    saveCartToStorage();
    updateCartUI();
}

function getCartSubtotal() {
    return state.cart.reduce((sum, item) => {
        const personalizacaoTotal = item.personalizacoes.reduce((s, p) => s + p.preco_adicional, 0);
        return sum + (item.product.preco_base + personalizacaoTotal) * item.quantity;
    }, 0);
}

function getCartTotal() {
    return getCartSubtotal() + state.deliveryFee;
}

function canCheckout() {
    return state.cart.length > 0 && getCartSubtotal() >= state.minOrder;
}

function updateCartUI() {
    // Cart count
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    elements.cartCount.textContent = totalItems;
    elements.cartCount.style.display = totalItems > 0 ? 'flex' : 'none';

    // Cart items
    if (state.cart.length === 0) {
        elements.cartItems.innerHTML = '';
        elements.cartEmpty.hidden = false;
        elements.cartFooter.hidden = true;
        return;
    }

    elements.cartEmpty.hidden = true;
    elements.cartFooter.hidden = false;

    elements.cartItems.innerHTML = state.cart.map((item, index) => {
        const personalizacaoTotal = item.personalizacoes.reduce((s, p) => s + p.preco_adicional, 0);
        const itemPrice = item.product.preco_base + personalizacaoTotal;
        const itemTotal = itemPrice * item.quantity;

        const personalizacoesHtml = item.personalizacoes.length > 0
            ? `<ul class="cart-item-personalizacoes">${item.personalizacoes.map(p =>
                `<li>${escapeHtml(p.grupo_nome)}: ${escapeHtml(p.opcao_nome)}${p.preco_adicional > 0 ? ` (+${formatCurrency(p.preco_adicional)})` : ''}</li>`
            ).join('')}</ul>`
            : '';

        return `
            <li class="cart-item" data-index="${index}">
                <div class="cart-item-image">
                    <img src="${item.product.imagem_url || '/img/placeholder-product.jpg'}" alt="${escapeHtml(item.product.nome)}" loading="lazy">
                </div>
                <div class="cart-item-info">
                    <h4 class="cart-item-name">${escapeHtml(item.product.nome)}</h4>
                    <span class="cart-item-price">${formatCurrency(itemPrice)}</span>
                    ${personalizacoesHtml}
                    <div class="cart-item-controls">
                        <div class="quantity-control">
                            <button class="qty-btn" data-action="decrease" data-index="${index}" aria-label="Diminuir">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                            <span class="qty-value">${item.quantity}</span>
                            <button class="qty-btn" data-action="increase" data-index="${index}" aria-label="Aumentar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                        </div>
                        <button class="btn-remove" data-index="${index}" aria-label="Remover ${escapeHtml(item.product.nome)}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                </div>
            </li>
        `;
    }).join('');

    // Add listeners for cart item controls
    elements.cartItems.querySelectorAll('[data-action="increase"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            updateQuantity(index, state.cart[index].quantity + 1);
        });
    });

    elements.cartItems.querySelectorAll('[data-action="decrease"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            updateQuantity(index, state.cart[index].quantity - 1);
        });
    });

    elements.cartItems.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            removeFromCart(index);
        });
    });

    // Summary
    const subtotal = getCartSubtotal();
    const total = getCartTotal();

    elements.cartSubtotal.textContent = formatCurrency(subtotal);
    elements.cartDelivery.textContent = formatCurrency(state.deliveryFee);
    elements.cartTotal.textContent = formatCurrency(total);

    elements.checkoutBtn.disabled = !canCheckout();
    if (state.minOrder > 0 && subtotal < state.minOrder) {
        elements.checkoutBtn.title = `Pedido mínimo: ${formatCurrency(state.minOrder)}`;
    } else {
        elements.checkoutBtn.title = '';
    }
}

function openCart() {
    elements.cartSidebar.hidden = false;
    elements.cartSidebar.setAttribute('aria-modal', 'true');
    document.body.style.overflow = 'hidden';
    // Focus trap
    setTimeout(() => elements.cartClose?.focus(), 100);
}

function closeCart() {
    elements.cartSidebar.hidden = true;
    elements.cartSidebar.removeAttribute('aria-modal');
    document.body.style.overflow = '';
}

function saveCartToStorage() {
    try {
        localStorage.setItem('fraga_cart', JSON.stringify(state.cart));
    } catch (e) {
        console.warn('Could not save cart to localStorage');
    }
}

function loadCartFromStorage() {
    try {
        const saved = localStorage.getItem('fraga_cart');
        if (saved) state.cart = JSON.parse(saved);
    } catch (e) {
        console.warn('Could not load cart from localStorage');
        state.cart = [];
    }
}

// ========== CHECKOUT ==========
async function handleCheckout() {
    if (!canCheckout()) {
        if (state.cart.length === 0) {
            showToast('Seu carrinho está vazio', 'warning');
        } else if (getCartSubtotal() < state.minOrder) {
            showToast(`Pedido mínimo: ${formatCurrency(state.minOrder)}`, 'warning');
        }
        return;
    }

    // Redirect to checkout page or open checkout modal
    // For now, we'll redirect to a checkout page (to be created)
    const params = new URLSearchParams();
    params.set('subtotal', getCartSubtotal().toFixed(2));
    params.set('delivery', state.deliveryFee.toFixed(2));
    params.set('total', getCartTotal().toFixed(2));

    // Store cart data for checkout page
    sessionStorage.setItem('fraga_checkout_cart', JSON.stringify({
        items: state.cart,
        subtotal: getCartSubtotal(),
        deliveryFee: state.deliveryFee,
        total: getCartTotal(),
        minOrder: state.minOrder
    }));

    window.location.href = `/checkout.html?${params.toString()}`;
}

// ========== MOBILE MENU ==========
function toggleCategories() {
    const list = document.getElementById('categories-list');
    const isExpanded = elements.categoriesToggle.getAttribute('aria-expanded') === 'true';
    elements.categoriesToggle.setAttribute('aria-expanded', !isExpanded);
    list.hidden = isExpanded;
}

function toggleMobileMenu() {
    const isOpen = elements.mobileMenu.classList.toggle('active');
    elements.mobileMenuBtn.setAttribute('aria-expanded', isOpen);
    elements.mobileMenuBtn.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
}

function closeMobileMenu() {
    elements.mobileMenu.classList.remove('active');
    elements.mobileMenuBtn.setAttribute('aria-expanded', 'false');
    elements.mobileMenuBtn.setAttribute('aria-label', 'Abrir menu');
}

// ========== UTILITIES ==========
function showLoading(show) {
    state.isLoading = show;
    elements.loadingState.hidden = !show;
    elements.productsGrid.style.opacity = show ? '0.5' : '1';
    elements.productsGrid.style.pointerEvents = show ? 'none' : 'auto';
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" aria-label="Fechar">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
    elements.toastContainer.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('show'));

    // Auto remove
    setTimeout(() => removeToast(toast), 4000);
}

function removeToast(toast) {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}