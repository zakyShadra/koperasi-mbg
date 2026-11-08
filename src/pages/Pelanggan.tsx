import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '../lib/dummy';
import { orderTrackerSteps, productsKoperasi, productsWarkop } from '../lib/dummy';
import { fmtRp } from '../lib/format';
import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import { SlidingTabs } from '../components/SlidingTabs';
import { ProductCard } from '../features/pelanggan/ProductCard';
import { CartPanel } from '../features/pelanggan/CartPanel';
import type { CartLine } from '../features/pelanggan/CartPanel';
import { OrderTracker } from '../features/pelanggan/OrderTracker';
import { PelangganLoader } from '../features/pelanggan/PelangganLoader';
import './Pelanggan.css';

type CatalogTab = 'koperasi' | 'warkop';

interface PlacedOrder {
  number: string;
  name: string;
  wa: string;
  total: number;
  itemCount: number;
}

function randomLoadMs(): number {
  return 1500 + Math.random() * 1000;
}

function makeOrderNumber(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  return `MBG-${stamp}-${String(Math.floor(1000 + Math.random() * 9000))}`;
}

export default function Pelanggan() {
  const [tab, setTab] = useState<CatalogTab>('koperasi');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaderText, setLoaderText] = useState('Memuat katalog...');
  const [loadCycle, setLoadCycle] = useState(0);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const timers = useRef<number[]>([]);
  const cartRef = useRef<HTMLDivElement>(null);

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

  const cartCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const cartTotal = cart.reduce((sum, line) => sum + line.product.price * line.qty, 0);

  const handleTabChange = (id: string) => {
    const next = id === 'warkop' ? 'warkop' : 'koperasi';
    if (next === tab) return;
    setTab(next);
    startLoad('Memuat katalog...');
  };

  const handleAdd = (product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((line) => line.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stock) return prev;
        return prev.map((line) =>
          line.product.id === product.id ? { ...line, qty: line.qty + 1 } : line,
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const handleChangeQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.product.id !== productId) return line;
          const qty = Math.min(line.qty + delta, line.product.stock);
          return { ...line, qty };
        })
        .filter((line) => line.qty > 0),
    );
  };

  const handleCheckout = (name: string, wa: string) => {
    const total = cartTotal;
    const itemCount = cartCount;
    setLoaderText('Mengirim pesanan...');
    setLoading(true);
    const id = window.setTimeout(() => {
      setPlacedOrder({ number: makeOrderNumber(), name, wa, total, itemCount });
      setCart([]);
      setLoading(false);
      setLoadCycle((c) => c + 1);
    }, randomLoadMs());
    timers.current.push(id);
  };

  const handleShopeeFood = () => {
    console.log('[ShopeeFood intent]', {
      items: cart.map((line) => ({
        name: line.product.name,
        qty: line.qty,
        price: line.product.price,
      })),
      total: cartTotal,
    });
  };

  const scrollToCart = () => {
    cartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
          <button type="button" className="btn-secondary cart-jump" onClick={scrollToCart}>
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

        <SlidingTabs
          options={[
            { id: 'koperasi', label: 'Barang Koperasi' },
            { id: 'warkop', label: 'Warkop' },
          ]}
          value={tab}
          onChange={handleTabChange}
        />

        <div className="pelanggan-layout">
          <div className="catalog-col">
            {placedOrder && (
              <GlassCard className="order-confirm">
                <h2>Pesanan diterima</h2>
                <p className="order-confirm-text">
                  Terima kasih, {placedOrder.name}. Nomor pesanan kamu{' '}
                  <strong>{placedOrder.number}</strong> ({placedOrder.itemCount} item,{' '}
                  {fmtRp(placedOrder.total)}). Konfirmasi pesanan dikirim ke WA{' '}
                  {placedOrder.wa}.
                </p>
                <OrderTracker steps={orderTrackerSteps} current={0} />
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setPlacedOrder(null)}
                >
                  Buat pesanan baru
                </button>
              </GlassCard>
            )}

            {loading ? (
              <div className="product-grid" aria-busy="true" aria-label="Memuat katalog">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="pelanggan-skeleton" aria-hidden="true" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="catalog-empty">Tidak ada barang yang cocok dengan pencarian.</p>
            ) : (
              <div key={loadCycle} className="product-grid product-grid-enter">
                {filtered.map((product, i) => (
                  <ProductCard key={product.id} product={product} onAdd={handleAdd} delay={i * 50} />
                ))}
              </div>
            )}
          </div>

          <div ref={cartRef} className="cart-col">
            <CartPanel
              items={cart}
              onChangeQty={handleChangeQty}
              onCheckout={handleCheckout}
              onShopeeFood={handleShopeeFood}
              submitting={loading}
            />
          </div>
        </div>
      </div>
    </View>
  );
}
