import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import { CartLines } from '../features/pelanggan/CartPanel';
import { PelangganLoader } from '../features/pelanggan/PelangganLoader';
import { WarkopClosedBanner } from '../features/pelanggan/WarkopClosed';
import { PAYMENT_METHODS } from '../features/pelanggan/cart';
import type { PaymentMethodId, PlacedOrder } from '../features/pelanggan/cart';
import { useCart } from '../features/pelanggan/cart-context';
import { createOrder, friendlyError } from '../lib/api';
import { useWarkopStatus } from '../lib/warkop';
import './Pelanggan.css';

export default function CheckoutPage() {
  const { lines, recordOrder } = useCart();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [wa, setWa] = useState('');
  const [method, setMethod] = useState<PaymentMethodId>('tunai');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { status: warkopStatus, refresh: refreshWarkop } = useWarkopStatus();
  const closed = warkopStatus === 'tutup';

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (lines.length === 0) {
      setError('Keranjang masih kosong.');
      return;
    }
    if (!name.trim() || !wa.trim()) {
      setError('Nama dan nomor WA wajib diisi.');
      return;
    }
    const missing = lines.some((line) => !line.product.apiId);
    if (missing) {
      setError('Katalog belum termuat dari server, muat ulang halaman.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await createOrder({
        nama: name.trim(),
        no_wa: wa.trim(),
        items: lines.map((line) => ({
          product_id: line.product.apiId as number,
          qty: line.qty,
        })),
        metode_bayar: method,
      });
      const methodLabel = PAYMENT_METHODS.find((m) => m.id === method)?.label ?? 'Tunai di tempat';
      const order: PlacedOrder = {
        number: res.order.nomor_pesanan,
        orderId: res.order.id,
        name: name.trim(),
        wa: wa.trim(),
        methodLabel,
        methodId: method,
        total: res.order.total,
        itemCount: lines.reduce((sum, line) => sum + line.qty, 0),
        items: lines.map((line) => ({
          name: line.product.name,
          qty: line.qty,
          price: line.product.price,
        })),
        createdAt: res.order.dibuat_pada,
        qrisPayload: res.qris_payload,
        qrisDummy: res.qris_dummy,
        status: res.order.status,
      };
      recordOrder(order);
      navigate(`/pelanggan/lacak/${order.number}`, { replace: true });
    } catch (err) {
      setError(friendlyError(err));
      setSubmitting(false);
    }
  };

  return (
    <View>
      <div className="pelanggan-page view-enter">
        <PelangganLoader active={submitting} text="Mengirim pesanan..." />
        <WarkopClosedBanner status={warkopStatus} onRefresh={() => void refreshWarkop()} />
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
                <form className="cart-form" onSubmit={(e) => void handleSubmit(e)}>
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
                  <button
                    type="submit"
                    className="btn btn-primary cart-submit"
                    disabled={submitting || closed}
                  >
                    {closed
                      ? 'Warkop tutup, pesanan dijeda'
                      : submitting
                        ? 'Mengirim...'
                        : 'Pesan sekarang'}
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
