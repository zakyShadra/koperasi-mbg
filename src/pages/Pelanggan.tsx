import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { friendlyError, getCatalog, mapProduct } from '../lib/api';
import type { Product } from '../lib/dummy';
import { useWarkopStatus } from '../lib/warkop';
import { View } from '../components/View';
import { SlidingTabs } from '../components/SlidingTabs';
import { ProductCard } from '../features/pelanggan/ProductCard';
import { PelangganLoader } from '../features/pelanggan/PelangganLoader';
import { WarkopClosedBanner } from '../features/pelanggan/WarkopClosed';
import { useCart } from '../features/pelanggan/cart-context';
import './Pelanggan.css';

type CatalogTab = 'koperasi' | 'warkop';

export default function Pelanggan() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { add, count: cartCount } = useCart();
  const tab: CatalogTab = searchParams.get('tab') === 'warkop' ? 'warkop' : 'koperasi';
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [gridReady, setGridReady] = useState(false);
  const { status: warkopStatus, refresh: refreshWarkop } = useWarkopStatus();
  const closed = warkopStatus === 'tutup';

  const loadCatalog = useCallback(async () => {
    setLoadError('');
    setLoading(true);
    try {
      const items = await getCatalog();
      setProducts(items.map(mapProduct));
    } catch (e) {
      setLoadError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const handleLoaderDone = useCallback(() => {
    setGridReady(true);
  }, []);

  const visible = useMemo(() => {
    const list = products.filter((p) => p.category === tab);
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query, tab]);

  const handleTabChange = (id: string) => {
    const next = id === 'warkop' ? 'warkop' : 'koperasi';
    if (next === tab) return;
    setSearchParams(next === 'warkop' ? { tab: 'warkop' } : {});
  };

  return (
    <View>
      <div className="pelanggan-page view-enter">
        <PelangganLoader active={loading} text="Memuat katalog..." onDone={handleLoaderDone} />
        <WarkopClosedBanner status={warkopStatus} onRefresh={() => void refreshWarkop()} />

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
              className="btn btn-secondary cart-jump"
              onClick={() => navigate('/pelanggan/keranjang')}
            >
              Keranjang
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
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
          {!gridReady ? (
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
          ) : loadError ? (
            <div className="catalog-empty">
              <p>{loadError}</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void loadCatalog()}
              >
                Muat ulang
              </button>
            </div>
          ) : visible.length === 0 ? (
            <p className="catalog-empty">Tidak ada barang yang cocok dengan pencarian.</p>
          ) : (
            <div key={tab} className="product-grid product-grid-enter">
              {visible.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={add}
                  delay={i * 50}
                  disabled={closed}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </View>
  );
}
