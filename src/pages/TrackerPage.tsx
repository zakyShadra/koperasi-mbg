import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import { OrderTracker } from '../features/pelanggan/OrderTracker';
import { orderTrackerSteps } from '../lib/dummy';
import { fmtRp } from '../lib/format';
import { useCart } from '../features/pelanggan/cart-context';
import type { PlacedOrder } from '../features/pelanggan/cart';
import './Pelanggan.css';

export default function TrackerPage() {
  const { orderNumber } = useParams<{ orderNumber?: string }>();
  const { lastOrder } = useCart();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [notFound, setNotFound] = useState(false);

  let order: PlacedOrder | null = null;
  if (orderNumber && lastOrder && lastOrder.number === orderNumber) {
    order = lastOrder;
  } else if (!orderNumber && lastOrder) {
    order = lastOrder;
  }

  const handleLookup = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (lastOrder && query.trim() === lastOrder.number) {
      navigate(`/pelanggan/lacak/${lastOrder.number}`);
    } else {
      setNotFound(true);
    }
  };

  return (
    <View>
      <div className="pelanggan-page view-enter">
        <GlassCard className="tracker-card">
          <div className="cart-solid">
            <h2 className="cart-title">Lacak pesanan</h2>
            {order ? (
              <>
                <p className="order-confirm-text">
                  Terima kasih, {order.name}. Nomor pesanan kamu{' '}
                  <strong>{order.number}</strong> ({order.itemCount} item,{' '}
                  {fmtRp(order.total)}). Konfirmasi pesanan dikirim ke WA {order.wa}.
                </p>
                <OrderTracker steps={orderTrackerSteps} current={0} />
                <ul className="tracker-items">
                  {order.items.map((item) => (
                    <li key={item.name} className="tracker-item">
                      <span>
                        {item.name} x{item.qty}
                      </span>
                      <span>{fmtRp(item.price * item.qty)}</span>
                    </li>
                  ))}
                </ul>
                <p className="tracker-meta">
                  Metode bayar: {order.methodLabel}. Status: Diterima, barista
                  segera menyiapkan pesanan kamu.
                </p>
                <Link to="/pelanggan" className="btn-primary cart-submit">
                  Buat pesanan baru
                </Link>
              </>
            ) : (
              <>
                <p className="cart-empty">
                  Masukkan nomor pesanan dari struk checkout untuk melihat
                  statusnya.
                </p>
                <form className="cart-form" onSubmit={handleLookup}>
                  <label className="cart-field">
                    <span>Nomor pesanan</span>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setNotFound(false);
                      }}
                      placeholder="MBG-20261108-1234"
                    />
                  </label>
                  {notFound && (
                    <p className="cart-error">
                      Nomor pesanan tidak ditemukan. Demo ini hanya menyimpan
                      pesanan terakhir di perangkat ini.
                    </p>
                  )}
                  <button type="submit" className="btn-primary cart-submit">
                    Lacak
                  </button>
                </form>
                <Link to="/pelanggan" className="back-link">
                  Kembali ke katalog
                </Link>
              </>
            )}
          </div>
        </GlassCard>
      </div>
    </View>
  );
}
