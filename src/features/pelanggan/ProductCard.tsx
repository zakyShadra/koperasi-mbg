import type { Product } from '../../lib/dummy';
import { fmtRp } from '../../lib/format';

const THUMB_GRADIENTS: Array<[string, string]> = [
  ['#2DD4BF', '#0E7490'],
  ['#FBBF24', '#FB923C'],
  ['#FB923C', '#F87171'],
  ['#34D399', '#2DD4BF'],
];

export interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
  delay?: number;
}

export function ProductCard({ product, onAdd, delay = 0 }: ProductCardProps) {
  const out = product.stock <= 0;
  const seed = product.initial ? product.initial.charCodeAt(0) : 0;
  const [c1, c2] = THUMB_GRADIENTS[seed % THUMB_GRADIENTS.length];

  return (
    <article className={`product-card${out ? ' is-out' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      <div
        className="product-thumb"
        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        aria-hidden="true"
      >
        <span>{product.initial}</span>
        {out && <span className="pill product-habis">Habis</span>}
      </div>
      <h3 className="product-name">{product.name}</h3>
      <p className="product-price">{fmtRp(product.price)}</p>
      <p className="product-stock">{out ? 'Stok habis' : `Stok: ${product.stock}`}</p>
      <button
        type="button"
        className="btn-primary btn-sm product-add"
        disabled={out}
        onClick={() => onAdd(product)}
      >
        Tambah
      </button>
    </article>
  );
}
