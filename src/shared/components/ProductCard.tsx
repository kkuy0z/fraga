/**
 * Componente Card de Produto reutilizável
 */

import { formatCurrency, escapeHtml } from '@utils';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: {
    id: number;
    nome: string;
    descricao?: string;
    preco_base: number;
    imagem_url?: string;
    categoria_nome?: string;
    personalizacoes?: Array<{
      id: number;
      nome: string;
      tipo: string;
      obrigatorio: boolean;
      opcoes: Array<{ id: number; nome: string; preco_adicional: number; ativo: boolean }>;
    }>;
  };
  onClick?: (product: ProductCardProps['product']) => void;
  onAddToCart?: (product: ProductCardProps['product']) => void;
  disabled?: boolean;
  showAddButton?: boolean;
  addButtonText?: string;
}

export function ProductCard({
  product,
  onClick,
  onAddToCart,
  disabled = false,
  showAddButton = true,
  addButtonText = 'Adicionar',
}: ProductCardProps) {
  const hasImage = product.imagem_url && product.imagem_url.trim() !== '';
  const hasPersonalizacoes = product.personalizacoes && product.personalizacoes.length > 0;
  const needsModal = hasPersonalizacoes && showAddButton;

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    if (e.target instanceof HTMLButtonElement) return;
    onClick?.(product);
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (needsModal) {
      onClick?.(product);
    } else {
      onAddToCart?.(product);
    }
  };

  return (
    <article
      className={`${styles.card} ${disabled ? styles.disabled : ''}`}
      onClick={handleClick}
      role="listitem"
      style={{ cursor: disabled ? 'not-allowed' : onClick ? 'pointer' : 'default' }}
    >
      {hasImage ? (
        <>
          <img
            src={product.imagem_url}
            alt={product.nome}
            className={styles.cardImage}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling!.style.display = 'flex';
            }}
          />
          <div className={`${styles.cardImagePlaceholder} ${styles.hidden}`}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        </>
      ) : (
        <div className={styles.cardImagePlaceholder}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
      )}

      <div className={styles.cardContent}>
        {product.categoria_nome && (
          <span className={styles.cardCategory}>{escapeHtml(product.categoria_nome)}</span>
        )}
        <h3 className={styles.cardTitle}>{escapeHtml(product.nome)}</h3>
        {product.descricao && <p className={styles.cardDescription}>{escapeHtml(product.descricao)}</p>}

        <div className={styles.cardFooter}>
          <span className={styles.cardPrice}>{formatCurrency(product.preco_base)}</span>
          {showAddButton && (
            <button
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm} ${disabled ? styles.disabled : ''}`}
              onClick={handleAddClick}
              disabled={disabled}
              aria-label={disabled ? 'Estabelecimento fechado' : `Adicionar ${escapeHtml(product.nome)} ao carrinho`}
            >
              {disabled ? 'Fechado' : addButtonText}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default ProductCard;