import type { CartLine } from './cart';
import { fmtRp } from '../../lib/format';

// Daftar isi keranjang + total, dipakai ulang di halaman keranjang dan
// di ringkasan halaman checkout. Form nama/WA dan tombol pesan tinggal
// di halaman checkout, bukan di sini.
export interface CartLinesProps {
  items: CartLine[];
  onChangeQty?: (productId: string, delta: number) => void;
  readOnly?: boolean;
}

export function CartLines({ items, onChangeQty, readOnly = false }: CartLinesProps) {
  const total = items.reduce((sum, line) => sum + line.product.price * line.qty, 0);

  return (
    <div className="cart-lines">
      {items.length === 0 ? (
        <p className="cart-empty">Keranjang masih kosong. Pilih barang dari katalog.</p>
      ) : (
        <ul className="cart-list">
          {items.map((line) => (
            <li key={line.product.id} className="cart-row">
              <div className="cart-item">
                <p className="cart-name">{line.product.name}</p>
                <p className="cart-price">{fmtRp(line.product.price)}</p>
              </div>
              {readOnly ? (
                <span className="qty-value">x{line.qty}</span>
              ) : (
                <div className="cart-qty">
                  <button
                    type="button"
                    className="qty-btn"
                    aria-label={`Kurangi ${line.product.name}`}
                    onClick={() => onChangeQty?.(line.product.id, -1)}
                  >
                    -
                  </button>
                  <span className="qty-value">{line.qty}</span>
                  <button
                    type="button"
                    className="qty-btn"
                    aria-label={`Tambah ${line.product.name}`}
                    onClick={() => onChangeQty?.(line.product.id, 1)}
                  >
                    +
                  </button>
                </div>
              )}
              <span className="cart-line-total">{fmtRp(line.product.price * line.qty)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="cart-total-row">
        <span>Total</span>
        <span className="cart-total">{fmtRp(total)}</span>
      </div>
    </div>
  );
}

export default CartLines;
