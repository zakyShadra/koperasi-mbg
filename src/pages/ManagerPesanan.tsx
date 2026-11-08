import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import OrderTable from '../components/OrderTable';
import UpdatedHint from '../components/UpdatedHint';
import type { Order, OrderStatus } from '../lib/dummy';
import { friendlyError, getOrders, mapApiOrder } from '../lib/api';
import { usePolling } from '../lib/usePolling';
import './Manager.css';

const STATUSES: Array<'Semua' | OrderStatus> = [
  'Semua',
  'Baru',
  'Disiapkan',
  'Siap',
  'Selesai',
  'Dibatalkan',
];

const API_STATUS: Record<OrderStatus, string> = {
  Baru: 'baru',
  Disiapkan: 'disiapkan',
  Siap: 'siap',
  Selesai: 'selesai',
  Dibatalkan: 'dibatalkan',
};

export default function ManagerPesanan() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? 'Semua';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false): Promise<string> => {
    if (!silent) setLoading(true);
    try {
      const apiStatus = status !== 'Semua' ? API_STATUS[status as OrderStatus] : undefined;
      const list = await getOrders(apiStatus, 50);
      const mapped = list.map(mapApiOrder);
      setOrders(mapped);
      setError('');
      return JSON.stringify(mapped.map((o) => [o.id, o.status, o.total]));
    } catch (e) {
      setError(friendlyError(e));
      return '';
    } finally {
      if (!silent) setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const { justUpdated } = usePolling(() => load(true), { resetKey: status });

  return (
    <View>
      <div className="manager-page">
        <GlassCard className="orders-card">
          <div className="card-head">
            <h2>Pesanan</h2>
            <UpdatedHint show={justUpdated} />
            <span className="card-count">{orders.length} pesanan</span>
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
          {error && (
            <p className="cart-error" role="alert">
              {error}
            </p>
          )}
          {loading ? <p className="empty-note">Memuat pesanan...</p> : <OrderTable orders={orders} />}
        </GlassCard>
      </div>
    </View>
  );
}
