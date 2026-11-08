import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import { fmtRp } from '../lib/format';
import { getSession } from '../lib/auth-session';
import {
  createWalkIn,
  friendlyError,
  getCatalog,
  invalidateCatalog,
  mapProduct,
  requestOtp,
  setProductAvailability,
  setProductPrice,
  verifyFreshOtp,
} from '../lib/api';
import type { Product } from '../lib/dummy';
import './Barista.css';

function PriceEditor({ product, onDone }: { product: Product; onDone: () => void }) {
  const session = getSession();
  const [harga, setHarga] = useState(String(product.price));
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleRequestCode = async () => {
    if (!session) return;
    setError('');
    setBusy(true);
    try {
      const res = await requestOtp(session.email, 'action');
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setDevCode(res.devCode ?? null);
      setStep(2);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const value = Number(harga);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Harga harus lebih dari 0.');
      return;
    }
    if (code.trim().length < 6) {
      setError('Masukkan 6 digit kode OTP.');
      return;
    }
    if (!product.apiId) return;
    setError('');
    setBusy(true);
    try {
      const fresh = await verifyFreshOtp(code.trim());
      await setProductPrice(product.apiId, value, fresh.action_token);
      invalidateCatalog();
      onDone();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="price-editor">
      {step === 1 ? (
        <>
          <label className="cart-field">
            <span>Harga baru (Rp)</span>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={harga}
              onChange={(e) => setHarga(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void handleRequestCode()}>
            {busy ? 'Mengirim...' : 'Minta kode OTP'}
          </button>
        </>
      ) : (
        <>
          <p className="form-note">Kode OTP dikirim ke email kamu, berlaku 10 menit.</p>
          {devCode && (
            <p className="form-note">
              Kode demo: <strong>{devCode}</strong>
            </p>
          )}
          <label className="cart-field">
            <span>Kode OTP</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
            />
          </label>
          <div className="price-editor-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onDone}>
              Batal
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void handleSave()}>
              {busy ? 'Menyimpan...' : 'Simpan harga'}
            </button>
          </div>
        </>
      )}
      {error && <p className="cart-error">{error}</p>}
    </div>
  );
}

export default function BaristaKatalog() {
  const navigate = useNavigate();
  const session = getSession();
  const isManager = session?.role === 'manager';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [walkInBusy, setWalkInBusy] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const items = await getCatalog();
      setProducts(items.map(mapProduct).filter((p) => p.category === 'warkop'));
      setError('');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const handleToggle = async (product: Product) => {
    if (!product.apiId) return;
    setError('');
    try {
      await setProductAvailability(product.apiId, product.available ? 0 : 1);
      invalidateCatalog();
      await loadCatalog();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const handleWalkIn = async () => {
    const first = products.find((p) => p.available && p.stock > 0);
    if (!first?.apiId) {
      setError('Tidak ada menu yang tersedia untuk walk-in.');
      return;
    }
    setError('');
    setWalkInBusy(true);
    try {
      await createWalkIn([{ product_id: first.apiId, qty: 1 }]);
      navigate('/barista');
    } catch (e) {
      setError(friendlyError(e));
      setWalkInBusy(false);
    }
  };

  return (
    <View>
      <div className="barista-page view-enter">
        <GlassCard className="catalog-panel">
          <div className="catalog-panel-head">
            <h2>Katalog warkop</h2>
            <button
              type="button"
              className="btn btn-primary"
              disabled={walkInBusy}
              onClick={() => void handleWalkIn()}
            >
              {walkInBusy ? 'Menambah...' : 'Tambah pesanan walk-in'}
            </button>
          </div>
          {error && (
            <p className="cart-error" role="alert">
              {error}
            </p>
          )}
          {loading ? (
            <p className="empty-note">Memuat katalog...</p>
          ) : (
            <ul className="catalog-list">
              {products.map((item) => {
                const available = item.available ?? true;
                return (
                  <li key={item.id} className="catalog-row">
                    <div>
                      <p className="catalog-name">{item.name}</p>
                      <p className="catalog-price">{fmtRp(item.price)}</p>
                      {isManager && editingId === item.id && (
                        <PriceEditor product={item} onDone={() => {
                          setEditingId(null);
                          void loadCatalog();
                        }} />
                      )}
                    </div>
                    <div className="catalog-row-actions">
                      {isManager && editingId !== item.id && (
                        <button
                          type="button"
                          className="btn-sm catalog-edit"
                          onClick={() => setEditingId(item.id)}
                        >
                          Ubah harga
                        </button>
                      )}
                      <button
                        type="button"
                        className={`btn-sm catalog-toggle${available ? ' is-available' : ' is-out'}`}
                        aria-pressed={available}
                        onClick={() => void handleToggle(item)}
                      >
                        {available ? 'Tersedia' : 'Habis'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="catalog-hint">
            Pesanan walk-in masuk ke antrean dengan satu item pertama yang tersedia.
            {isManager ? ' Ubah harga butuh kode OTP baru.' : ''}
          </p>
        </GlassCard>
      </div>
    </View>
  );
}
