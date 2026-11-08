import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import { CartLines } from '../features/pelanggan/CartPanel';
import { PelangganLoader } from '../features/pelanggan/PelangganLoader';
import { PAYMENT_METHODS } from '../features/pelanggan/cart';
import type { PaymentMethodId } from '../features/pelanggan/cart';
import { useCart } from '../features/pelanggan/cart-context';
import './Pelanggan.css';

export default function CheckoutPage() {
  const { lines, placeOrder } = useCart();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [wa, setWa] = useState('');
  const [method, setMethod] = useState<PaymentMethodId>('tunai');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (lines.length === 0) {
      setError('Keranjang masih kosong.');
      return;
    }
    if (!name.trim() || !wa.trim()) {
      setError('Nama dan nomor WA wajib diisi.');
      return;
    }
    setError('');
    setSubmitting(true);
    const methodLabel = PAYMENT_METHODS.find((m) => m.id === method)?.label ?? 'Tunai di tempat';
    window.setTimeout(() => {
      const order = placeOrder(name.trim(), wa.trim(), methodLabel);
      navigate(`/pelanggan/lacak/${order.number}`, { replace: true });
    }, 1500);
  };

  return (
    <View>
      <div className="pelanggan-page view-enter">
        <PelangganLoader active={submitting} text="Mengirim pesanan..." />
        <GlassCard className="checkout-card">
          <div className="cart-solid">
            <h2 className="cart-title">Checkout</h2>
            {lines.length === 0 ? (
              <>
                <p className="cart-empty">
                  Keranjang masih kosong. Pilih barang dari katalog dulu.
                </p>
                <Link to="/pelanggan" className="btn btn-primary cart-submit">
                  Ke katalog
                </Link>
              </>
            ) : (
              <>
                <CartLines items={lines} readOnly />
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
                  <fieldset className="pay-field">
                    <legend>Metode bayar</legend>
                    {PAYMENT_METHODS.map((m) => (
                      <label key={m.id} className="pay-option">
                        <input
                          type="radio"
                          name="payment"
                          value={m.id}
                          checked={method === m.id}
                          onChange={() => setMethod(m.id)}
                        />
                        <span>
                          <strong>{m.label}</strong>
                          <small>{m.hint}</small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  {error && <p className="cart-error">{error}</p>}
                  <button type="submit" className="btn btn-primary cart-submit" disabled={submitting}>
                    {submitting ? 'Mengirim...' : 'Pesan sekarang'}
                  </button>
                </form>
              </>
            )}
            <Link to="/pelanggan/keranjang" className="back-link">
              Kembali ke keranjang
            </Link>
          </div>
        </GlassCard>
      </div>
    </View>
  );
}
