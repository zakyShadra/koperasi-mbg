import { Link, useNavigate } from 'react-router-dom';
import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import { CartLines } from '../features/pelanggan/CartPanel';
import { WarkopClosedBanner } from '../features/pelanggan/WarkopClosed';
import { useCart } from '../features/pelanggan/cart-context';
import { useWarkopStatus } from '../lib/warkop';
import './Pelanggan.css';

export default function CartPage() {
  const { lines, changeQty, count } = useCart();
  const navigate = useNavigate();
  const { status: warkopStatus, refresh: refreshWarkop } = useWarkopStatus();
  const closed = warkopStatus === 'tutup';

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
            {lines.length > 0 && (
              <>
                <button
                  type="button"
                  className="btn btn-primary cart-submit"
                  disabled={closed}
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
