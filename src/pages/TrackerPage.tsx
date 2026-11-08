import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import { OrderTracker } from '../features/pelanggan/OrderTracker';
import { PelangganLoader } from '../features/pelanggan/PelangganLoader';
import { orderTrackerSteps } from '../lib/dummy';
import { fmtRp } from '../lib/format';
import {
  friendlyError,
  getOrder,
  getOrderQris,
  payDummy,
} from '../lib/api';
import type { ApiOrder, ApiOrderItem } from '../lib/api';
import './Pelanggan.css';

const STATUS_INDEX: Record<string, number> = {
  baru: 0,
  disiapkan: 1,
  siap: 2,
  selesai: 3,
};

const METHOD_LABEL: Record<string, string> = {
  tunai: 'Tunai di tempat',
  transfer: 'Transfer bank',
  qris: 'QRIS',
};

export default function TrackerPage() {
  const { orderNumber } = useParams<{ orderNumber?: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [items, setItems] = useState<ApiOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [qris, setQris] = useState<{
    qris_payload: string;
    qris_dummy: boolean;
    note?: string;
  } | null>(null);
  const [paying, setPaying] = useState(false);

  const loadOrder = useCallback(async (number: string) => {
    setLoading(true);
    setNotFound(false);
    setError('');
    setQris(null);
    try {
      const res = await getOrder(number);
      setOrder(res.order);
      setItems(res.items);
      if (res.order.metode_bayar === 'qris' && res.order.status_bayar === 'belum') {
        try {
          const q = await getOrderQris(number);
          setQris({ qris_payload: q.qris_payload, qris_dummy: q.qris_dummy, note: q.note });
        } catch {
          // QRIS gagal dimuat, status pesanan tetap tampil.
        }
      }
    } catch (e) {
      const message = friendlyError(e);
      setOrder(null);
      if (message === 'Pesanan tidak ditemukan.') {
        setNotFound(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orderNumber) {
      void loadOrder(orderNumber);
    }
  }, [orderNumber, loadOrder]);

  const handleLookup = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const number = query.trim();
    if (!number) return;
    navigate(`/pelanggan/lacak/${number}`);
  };

  const handlePayDummy = async () => {
    if (!order) return;
    setPaying(true);
    try {
      await payDummy(order.nomor_pesanan);
      await loadOrder(order.nomor_pesanan);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPaying(false);
    }
  };

  const statusIndex = order ? STATUS_INDEX[order.status] ?? 0 : 0;
  const cancelled = order?.status === 'dibatalkan';

  return (
    <View>
      <div className="pelanggan-page view-enter">
        <PelangganLoader active={loading} text="Memuat pesanan..." />
        <GlassCard className="tracker-card">
          <div className="cart-solid">
            <h2 className="cart-title">Lacak pesanan</h2>
            {order ? (
              <>
                <p className="order-confirm-text">
                  Terima kasih, {order.nama_pelanggan}. Nomor pesanan kamu{' '}
                  <strong>{order.nomor_pesanan}</strong> ({items.reduce((s, i) => s + i.qty, 0)}{' '}
                  item, {fmtRp(order.total)}). Simpan nomor ini untuk melacak statusnya.
                </p>
                {cancelled ? (
                  <p className="cart-error">Pesanan ini dibatalkan.</p>
                ) : (
                  <OrderTracker steps={orderTrackerSteps} current={statusIndex} />
                )}
                <ul className="tracker-items">
                  {items.map((item) => (
                    <li key={item.produk_nama} className="tracker-item">
                      <span>
                        {item.produk_nama} x{item.qty}
                      </span>
                      <span>{fmtRp(item.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                <p className="tracker-meta">
                  Metode bayar: {METHOD_LABEL[order.metode_bayar] ?? order.metode_bayar}.
                  Status: {cancelled ? 'Dibatalkan' : orderTrackerSteps[statusIndex]}.
                  Pembayaran: {order.status_bayar === 'lunas' ? 'Lunas' : 'Belum dibayar'}.
                </p>
                {qris && order.status_bayar === 'belum' && (
                  <div className="qris-block">
                    <h3>Bayar dengan QRIS</h3>
                    <div className="qris-code">
                      <QRCode value={qris.qris_payload} size={192} />
                    </div>
                    <p className="tracker-meta">Total: {fmtRp(order.total)}</p>
                    {qris.note && <p className="form-note">{qris.note}</p>}
                    {qris.qris_dummy && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={paying}
                        onClick={() => void handlePayDummy()}
                      >
                        {paying ? 'Memproses...' : 'Simulasikan pembayaran berhasil (mode dummy)'}
                      </button>
                    )}
                  </div>
                )}
                {error && <p className="cart-error">{error}</p>}
                <Link to="/pelanggan" className="btn btn-primary cart-submit">
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
                        setError('');
                      }}
                      placeholder="MBG-20261108-1234"
                    />
                  </label>
                  {notFound && (
                    <p className="cart-error">Nomor pesanan tidak ditemukan.</p>
                  )}
                  {error && <p className="cart-error">{error}</p>}
                  <button type="submit" className="btn btn-primary cart-submit">
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
