import { useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import type { Product } from '../../lib/dummy';
import { fmtRp } from '../../lib/format';

export interface CartLine {
  product: Product;
  qty: number;
}

export interface CartPanelProps {
  items: CartLine[];
  onChangeQty: (productId: string, delta: number) => void;
  onCheckout: (name: string, wa: string) => void;
  onShopeeFood: () => void;
  submitting: boolean;
}

export function CartPanel({ items, onChangeQty, onCheckout, onShopeeFood, submitting }: CartPanelProps) {
  const [name, setName] = useState('');
  const [wa, setWa] = useState('');
  const [error, setError] = useState('');

  const total = items.reduce((sum, line) => sum + line.product.price * line.qty, 0);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (items.length === 0) {
      setError('Keranjang masih kosong.');
      return;
    }
    if (!name.trim() || !wa.trim()) {
      setError('Nama dan nomor WA wajib diisi.');
      return;
    }
    setError('');
    onCheckout(name.trim(), wa.trim());
  };

  const handleShopeeFood = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onShopeeFood();
  };

  return (
    <section className="glass-card cart-panel" aria-label="Keranjang">
      <div className="cart-solid">
        <h2 className="cart-title">Keranjang</h2>
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
                <div className="cart-qty">
                  <button
                    type="button"
                    className="qty-btn"
                    aria-label={`Kurangi ${line.product.name}`}
                    onClick={() => onChangeQty(line.product.id, -1)}
                  >
                    -
                  </button>
                  <span className="qty-value">{line.qty}</span>
                  <button
                    type="button"
                    className="qty-btn"
                    aria-label={`Tambah ${line.product.name}`}
                    onClick={() => onChangeQty(line.product.id, 1)}
                  >
                    +
                  </button>
                </div>
                <span className="cart-line-total">{fmtRp(line.product.price * line.qty)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="cart-total-row">
          <span>Total</span>
          <span className="cart-total">{fmtRp(total)}</span>
        </div>
        <form className="cart-form" onSubmit={handleSubmit}>
          <label className="cart-field">
            <span>Nama</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama kamu"
              autoComplete="name"
            />
          </label>
          <label className="cart-field">
            <span>Nomor WA</span>
            <input
              type="tel"
              value={wa}
              onChange={(e) => setWa(e.target.value)}
              placeholder="08xxxxxxxxxx"
              autoComplete="tel"
            />
          </label>
          {error && <p className="cart-error">{error}</p>}
          <button type="submit" className="btn-primary cart-submit" disabled={submitting}>
            {submitting ? 'Mengirim...' : 'Pesan'}
          </button>
        </form>
        <a href="#" className="btn-secondary shopeefood-btn" onClick={handleShopeeFood}>
          Pesan lewat ShopeeFood
        </a>
        <p className="shopeefood-note">Deep link toko ShopeeFood menyusul.</p>
      </div>
    </section>
  );
}
