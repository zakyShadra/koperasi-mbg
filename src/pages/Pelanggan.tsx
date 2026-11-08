import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { productsKoperasi, productsWarkop } from '../lib/dummy';
import { View } from '../components/View';
import { SlidingTabs } from '../components/SlidingTabs';
import { ProductCard } from '../features/pelanggan/ProductCard';
import { PelangganLoader } from '../features/pelanggan/PelangganLoader';
import { useCart } from '../features/pelanggan/cart-context';
import './Pelanggan.css';

type CatalogTab = 'koperasi' | 'warkop';

function randomLoadMs(): number {
  return 1500 + Math.random() * 1000;
}

// Katalog saja. Keranjang, checkout, dan lacak pesanan sudah jadi halaman
// sendiri (/pelanggan/keranjang, /pelanggan/checkout, /pelanggan/lacak).
// Keranjang tinggal di CartProvider supaya tidak hilang saat pindah halaman.
export default function Pelanggan() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { add, count: cartCount } = useCart();
  const tab: CatalogTab = searchParams.get('tab') === 'warkop' ? 'warkop' : 'koperasi';
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaderText, setLoaderText] = useState('Memuat katalog...');
  const [loadCycle, setLoadCycle] = useState(0);
  const timers = useRef<number[]>([]);

  const startLoad = useCallback((text: string) => {
    setLoaderText(text);
    setLoading(true);
    const id = window.setTimeout(() => {
      setLoading(false);
      setLoadCycle((c) => c + 1);
    }, randomLoadMs());
    timers.current.push(id);
  }, []);

  useEffect(() => {
    setLoaderText('Memuat katalog...');
    setLoading(true);
    const id = window.setTimeout(() => {
      setLoading(false);
      setLoadCycle((c) => c + 1);
    }, randomLoadMs());
    return () => window.clearTimeout(id);
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const products = tab === 'koperasi' ? productsKoperasi : productsWarkop;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  const handleTabChange = (id: string) => {
    const next = id === 'warkop' ? 'warkop' : 'koperasi';
    if (next === tab) return;
    setSearchParams(next === 'warkop' ? { tab: 'warkop' } : {});
    startLoad('Memuat katalog...');
  };

  return (
    <View>
      <div className="pelanggan-page view-enter">
        <PelangganLoader active={loading} text={loaderText} />

        <div className="pelanggan-header">
          <label className="pelanggan-search">
            <span className="sr-only">Cari barang</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari barang..."
            />
          </label>
          <div className="pelanggan-header-actions">
            <button
              type="button"
              className="btn-secondary cart-jump"
              onClick={() => navigate('/pelanggan/keranjang')}
            >
              Keranjang
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => startLoad('Memuat katalog...')}
            >
              Coba Loading
            </button>
          </div>
        </div>

        <SlidingTabs
          options={[
            { id: 'koperasi', label: 'Barang Koperasi' },
            { id: 'warkop', label: 'Warkop' },
          ]}
          value={tab}
          onChange={handleTabChange}
        />

        <div className="catalog-col">
          {loading ? (
            <div className="product-grid" aria-busy="true" aria-label="Memuat katalog">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="pelanggan-skeleton" aria-hidden="true">
                  <div className="sk-thumb" />
                  <div className="sk-line sk-line--name" />
                  <div className="sk-line sk-line--price" />
                  <div className="sk-line sk-line--btn" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="catalog-empty">Tidak ada barang yang cocok dengan pencarian.</p>
          ) : (
            <div key={loadCycle} className="product-grid product-grid-enter">
              {filtered.map((product, i) => (
                <ProductCard key={product.id} product={product} onAdd={add} delay={i * 50} />
              ))}
            </div>
          )}
        </div>
      </div>
    </View>
  );
}
