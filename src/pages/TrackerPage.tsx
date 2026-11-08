import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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
  maskWa,
  normWa,
  payDummy,
} from '../lib/api';
import type { ApiOrder, ApiOrderItem } from '../lib/api';
import { useCart } from '../features/pelanggan/cart-context';
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
  const location = useLocation();
  const { lastOrder } = useCart();
  const [query, setQuery] = useState('');
  const [queryWa, setQueryWa] = useState('');
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [items, setItems] = useState<ApiOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [verifiedWa, setVerifiedWa] = useState('');
  const [maskedWa, setMaskedWa] = useState('');
  const [waInput, setWaInput] = useState('');
  const [waError, setWaError] = useState('');
  const [qris, setQris] = useState<{
    qris_payload: string;
    qris_dummy: boolean;
    note?: string;
  } | null>(null);
  const [paying, setPaying] = useState(false);

  const loadOrder = useCallback(async (number: string, noWa?: string) => {
    setLoading(true);
    setNotFound(false);
    setError('');
    setWaError('');
    setQris(null);
    try {
      const res = await getOrder(number, noWa);
      setOrder(res.order);
      const fullWa = res.order.no_wa_pelanggan ?? '';
      const masked =
        res.order.no_wa_masked ??
        (fullWa.includes('*') ? fullWa : fullWa ? maskWa(fullWa) : '');
      setMaskedWa(masked);
      const isVerified =
        res.order.verified === true ||
        (noWa !== undefined &&
          noWa.trim() !== '' &&
          fullWa !== '' &&
          normWa(noWa) === normWa(fullWa));
      setVerified(isVerified);
      setVerifiedWa(isVerified ? (noWa ?? '') : '');
      setItems(isVerified ? res.items : []);
      if (
        isVerified &&
        res.order.metode_bayar === 'qris' &&
        res.order.status_bayar === 'belum'
      ) {
        try {
          const q = await getOrderQris(number);
          setQris({ qris_payload: q.qris_payload, qris_dummy: q.qris_dummy, note: q.note });
        } catch {
          // QRIS gagal dimuat, status pesanan tetap tampil.
        }
      }
      if (noWa !== undefined && noWa.trim() !== '' && !isVerified) {
        setWaError('Nomor WA tidak cocok dengan pesanan ini.');
      }
    } catch (e) {
      const message = friendlyError(e);
      setOrder(null);
      setVerified(false);
      setItems([]);
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
    if (!orderNumber) return;
    const stateWa = (location.state as { wa?: string } | null)?.wa;
    const ownWa =
      lastOrder && lastOrder.number === orderNumber ? lastOrder.wa : undefined;
    void loadOrder(orderNumber, stateWa ?? ownWa);
  }, [orderNumber, loadOrder, location.state, lastOrder]);

  const handleLookup = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const number = query.trim();
    if (!number) return;
    navigate(`/pelanggan/lacak/${number}`, {
      state: queryWa.trim() ? { wa: queryWa.trim() } : undefined,
    });
  };

  const handleVerifyWa = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!orderNumber || !waInput.trim()) return;
    void loadOrder(orderNumber, waInput.trim());
  };

  const handlePayDummy = async () => {
    if (!order) return;
    setPaying(true);
    try {
      await payDummy(order.nomor_pesanan);
      await loadOrder(order.nomor_pesanan, verifiedWa || undefined);
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
                {verified ? (
                  <p className="order-confirm-text">
                    Terima kasih, {order.nama_pelanggan}. Nomor pesanan kamu{' '}
                    <strong>{order.nomor_pesanan}</strong> ({items.reduce((s, i) => s + i.qty, 0)}{' '}
                    item, {fmtRp(order.total)}). Simpan nomor ini untuk melacak statusnya.
                  </p>
                ) : (
                  <p className="order-confirm-text">
                    Pesanan <strong>{order.nomor_pesanan}</strong> ditemukan.
                    {maskedWa && (
                      <>
                        {' '}
                        Nomor WA terdaftar: <strong>{maskedWa}</strong>.
                      </>
                    )}
                  </p>
                )}
                {cancelled ? (
                  <p className="cart-error">Pesanan ini dibatalkan.</p>
                ) : (
                  <OrderTracker steps={orderTrackerSteps} current={statusIndex} />
                )}
                {!verified && (
                  <form className="cart-form" onSubmit={handleVerifyWa}>
                    <p className="cart-empty">
                      Detail lengkap (nama, item, dan total) hanya tampil untuk pemilik
                      pesanan. Masukkan nomor WA yang dipakai saat checkout.
                    </p>
                    <label className="cart-field">
                      <span>Nomor WA</span>
                      <input
                        type="tel"
                        value={waInput}
                        onChange={(e) => {
                          setWaInput(e.target.value);
                          setWaError('');
                        }}
                        placeholder="08xxxxxxxxxx"
                        autoComplete="tel"
                      />
                    </label>
                    {waError && <p className="cart-error">{waError}</p>}
                    <button type="submit" className="btn btn-primary cart-submit">
                      Tampilkan detail lengkap
                    </button>
                  </form>
                )}
                {verified && (
                  <>
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
                      {maskedWa && (
                        <>
                          {' '}
                          WA: {maskedWa}.
                        </>
                      )}
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
                  </>
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
                  <label className="cart-field">
                    <span>Nomor WA (opsional, untuk detail lengkap)</span>
                    <input
                      type="tel"
                      value={queryWa}
                      onChange={(e) => setQueryWa(e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      autoComplete="tel"
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
