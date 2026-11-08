import { useSearchParams } from 'react-router-dom';
import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import OrderTable from '../components/OrderTable';
import { recentOrders } from '../lib/dummy';
import type { OrderStatus } from '../lib/dummy';
import './Manager.css';

const STATUSES: Array<'Semua' | OrderStatus> = ['Semua', 'Baru', 'Disiapkan', 'Siap', 'Selesai'];

export default function ManagerPesanan() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? 'Semua';
  const visible =
    status === 'Semua' ? recentOrders : recentOrders.filter((o) => o.status === status);

  return (
    <View>
      <div className="manager-page">
        <GlassCard className="orders-card">
          <div className="card-head">
            <h2>Pesanan</h2>
            <span className="card-count">
              {visible.length} dari {recentOrders.length} pesanan
            </span>
          </div>
          <div className="chips" role="group" aria-label="Filter status">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={status === s ? 'pill chip chip-active' : 'pill chip'}
                aria-pressed={status === s}
                onClick={() => {
                  if (s === 'Semua') {
                    searchParams.delete('status');
                    setSearchParams(searchParams);
                  } else {
                    setSearchParams({ status: s });
                  }
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <OrderTable orders={visible} />
        </GlassCard>
      </div>
    </View>
  );
}
