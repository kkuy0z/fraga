/**
 * Gerenciamento do Carrinho de Compras
 */
class Cart {
    constructor() {
        this.items = this.load();
        this.listeners = [];
    }

    load() {
        try {
            const stored = localStorage.getItem('cart_items');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    save() {
        localStorage.setItem('cart_items', JSON.stringify(this.items));
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(l => l(this.items));
    }

    getItems() {
        return this.items;
    }

    getTotalItems() {
        return this.items.reduce((sum, item) => sum + item.quantidade, 0);
    }

    getSubtotal() {
        return this.items.reduce((sum, item) => {
            const itemTotal = item.preco_base * item.quantidade;
            const personalizacoesTotal = (item.personalizacoes || []).reduce(
                (pSum, p) => pSum + (p.preco_adicional || 0) * item.quantidade, 0
            );
            return sum + itemTotal + personalizacoesTotal;
        }, 0);
    }

    addItem(produto, personalizacoes = []) {
        // Criar chave única baseada no produto + personalizações
        const persKey = personalizacoes.map(p => `${p.grupo_id}:${p.opcao_id}`).sort().join('|');
        const key = `${produto.id}|${persKey}`;

        const existingIndex = this.items.findIndex(item => item.key === key);

        if (existingIndex >= 0) {
            this.items[existingIndex].quantidade += 1;
        } else {
            this.items.push({
                key,
                produto_id: produto.id,
                nome: produto.nome,
                preco_base: produto.preco_base,
                imagem_url: produto.imagem_url,
                quantidade: 1,
                personalizacoes: personalizacoes.map(p => ({
                    grupo_id: p.grupo_id,
                    grupo_nome: p.grupo_nome,
                    opcao_id: p.opcao_id,
                    opcao_nome: p.opcao_nome,
                    preco_adicional: p.preco_adicional || 0
                }))
            });
        }

        this.save();
    }

    removeItem(key) {
        this.items = this.items.filter(item => item.key !== key);
        this.save();
    }

    updateQuantity(key, quantidade) {
        const item = this.items.find(i => i.key === key);
        if (item) {
            if (quantidade <= 0) {
                this.removeItem(key);
            } else {
                item.quantidade = quantidade;
                this.save();
            }
        }
    }

    increment(key) {
        const item = this.items.find(i => i.key === key);
        if (item) {
            item.quantidade += 1;
            this.save();
        }
    }

    decrement(key) {
        const item = this.items.find(i => i.key === key);
        if (item) {
            if (item.quantidade <= 1) {
                this.removeItem(key);
            } else {
                item.quantidade -= 1;
                this.save();
            }
        }
    }

    clear() {
        this.items = [];
        this.save();
    }

    // Preparar itens para envio ao backend
    getPedidoItems() {
        return this.items.map(item => ({
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            personalizacoes: item.personalizacoes.map(p => ({
                grupo_id: p.grupo_id,
                opcao_id: p.opcao_id
            }))
        }));
    }
}

const cart = new Cart();
export default cart;