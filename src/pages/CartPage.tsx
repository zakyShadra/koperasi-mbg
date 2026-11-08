import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import { CartLines } from '../features/pelanggan/CartPanel';
import { findOutLines } from '../features/pelanggan/cart';
import { WarkopClosedBanner } from '../features/pelanggan/WarkopClosed';
import { useCart } from '../features/pelanggan/cart-context';
import { getCatalog, mapProduct } from '../lib/api';
import type { Product } from '../lib/dummy';
import { useWarkopStatus } from '../lib/warkop';
import './Pelanggan.css';

export default function CartPage() {
  const { lines, changeQty, count } = useCart();
  const navigate = useNavigate();
  const { status: warkopStatus, refresh: refreshWarkop } = useWarkopStatus();
  const closed = warkopStatus === 'tutup';
  const [fresh, setFresh] = useState<Map<number, Product>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void getCatalog()
      .then((items) => {
        if (cancelled) return;
        setFresh(new Map(items.map((p) => [p.id, mapProduct(p)])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const outLines = useMemo(() => findOutLines(lines, fresh), [lines, fresh]);

  const handleShopeeFood = () => {
    console.log('[ShopeeFood intent]', {
      items: lines.map((line) => ({
        name: line.product.name,
        qty: line.qty,
        price: line.product.price,
      })),
    });
  };

  return (
    <View>
      <div className="pelanggan-page view-enter">
        <WarkopClosedBanner status={warkopStatus} onRefresh={() => void refreshWarkop()} />
        <GlassCard className="cart-page-card">
          <div className="cart-solid">
            <h2 className="cart-title">Keranjang</h2>
            <CartLines items={lines} onChangeQty={changeQty} />
            {outLines.length > 0 && (
              <p className="cart-error" role="alert">
                {outLines.map((l) => l.product.name).join(', ')} sudah Habis. Hapus dari keranjang untuk lanjut ke checkout.
              </p>
            )}
            {lines.length > 0 && (
              <>
                <button
                  type="button"
                  className="btn btn-primary cart-submit"
                  disabled={closed || outLines.length > 0}
                  onClick={() => navigate('/pelanggan/checkout')}
                >
                  {closed ? 'Warkop tutup, pesanan dijeda' : `Lanjut ke checkout (${count} item)`}
                </button>
                <a
                  href="#"
                  className="btn btn-secondary shopeefood-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    handleShopeeFood();
                  }}
                >
                  Pesan lewat ShopeeFood
                </a>
                <p className="shopeefood-note">Deep link toko ShopeeFood menyusul.</p>
              </>
            )}
            <Link to="/pelanggan" className="back-link">
              Kembali ke katalog
            </Link>
          </div>
        </GlassCard>
      </div>
    </View>
  );
}
