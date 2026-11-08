import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Order } from '../lib/dummy';
import { View } from '../components/View';
import UpdatedHint from '../components/UpdatedHint';
import { KanbanColumn } from '../features/barista/KanbanColumn';
import { orderWaiting } from '../features/barista/OrderCard';
import { useWarkopStatus } from '../lib/warkop';
import { usePolling } from '../lib/usePolling';
import {
  friendlyError,
  getQueue,
  mapApiOrder,
  payDummy,
  setOrderStatus,
  setWarkopStatus,
} from '../lib/api';
import './Barista.css';

type BoardStatus = 'Baru' | 'Disiapkan' | 'Siap';

const BOARD_STATUSES: BoardStatus[] = ['Baru', 'Disiapkan', 'Siap'];

const NEXT_STATUS: Record<BoardStatus, string> = {
  Baru: 'disiapkan',
  Disiapkan: 'siap',
  Siap: 'selesai',
};

const DONE_KEY = 'mbg-barista-done-v1';

function loadDoneCount(): number {
  try {
    return Number(localStorage.getItem(DONE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export default function Barista() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doneCount, setDoneCount] = useState(loadDoneCount);
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status');
  const { status: warkopStatus, refresh: refreshWarkop } = useWarkopStatus();
  const isOpen = warkopStatus !== 'tutup';
  const [now, setNow] = useState(() => new Date());

  const refreshQueue = useCallback(async (): Promise<string> => {
    try {
      const queue = await getQueue();
      const mapped = queue.map(mapApiOrder);
      setOrders(mapped);
      setError('');
      return JSON.stringify(mapped.map((o) => [o.id, o.status, o.total]));
    } catch (e) {
      setError(friendlyError(e));
      return '';
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  const { justUpdated } = usePolling(refreshQueue);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const columns = useMemo(() => {
    const grouped: Record<BoardStatus, Order[]> = { Baru: [], Disiapkan: [], Siap: [] };
    for (const order of orders) {
      if (order.status === 'Baru' || order.status === 'Disiapkan' || order.status === 'Siap') {
        grouped[order.status].push(order);
      }
    }
    (Object.keys(grouped) as BoardStatus[]).forEach((key) => {
      grouped[key].sort((a, b) => orderWaiting(b) - orderWaiting(a));
    });
    return grouped;
  }, [orders]);

  const visibleStatuses =
    statusFilter && (BOARD_STATUSES as string[]).includes(statusFilter)
      ? [statusFilter as BoardStatus]
      : BOARD_STATUSES;

  const timeLabel = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
  const dateLabel = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });

  const handleToggleOpen = async () => {
    const next = isOpen ? 'tutup' : 'buka';
    try {
      await setWarkopStatus(next);
      await refreshWarkop();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const handleAdvance = async (order: Order) => {
    const next = NEXT_STATUS[order.status as BoardStatus];
    if (!next || !order.apiId) return;
    setError('');
    try {
      const extra =
        next === 'selesai' && order.metodeBayar === 'tunai'
          ? { tunai_diterima: true }
          : undefined;
      await setOrderStatus(order.apiId, next, extra);
      if (next === 'selesai') {
        const n = doneCount + 1;
        setDoneCount(n);
        try {
          localStorage.setItem(DONE_KEY, String(n));
        } catch {
          // Abaikan, hitungan tetap jalan di memori.
        }
      }
      await refreshQueue();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const handleMarkPaid = async (order: Order) => {
    setError('');
    try {
      await payDummy(order.id);
      await refreshQueue();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <View>
      <div className="barista-page view-enter">
        <div className="barista-header">
          <div className="barista-open">
            <button
              type="button"
              role="switch"
              aria-checked={isOpen}
              aria-label="Buka atau tutup warkop"
              className={`open-switch${isOpen ? ' is-on' : ''}`}
              disabled={warkopStatus === null}
              onClick={() => void handleToggleOpen()}
            >
              <span className="open-knob" />
            </button>
            <div>
              <p className="barista-open-label">{isOpen ? 'Buka' : 'Tutup'}</p>
              <p className="barista-open-sub">
                {isOpen ? 'Warkop sedang buka' : 'Warkop sedang tutup'}
              </p>
            </div>
          </div>
          <div className="barista-clock">
            <p className="barista-time">{timeLabel} WIB</p>
            <p className="barista-date">{dateLabel}</p>
            <UpdatedHint show={justUpdated} />
          </div>
        </div>

        {error && (
          <p className="cart-error" role="alert">
            {error}
          </p>
        )}

        {statusFilter && (
          <div className="chips" role="group" aria-label="Filter status antrean">
            <span className="pill">Status: {statusFilter}</span>
            <button
              type="button"
              className="pill chip"
              onClick={() => {
                searchParams.delete('status');
                setSearchParams(searchParams);
              }}
            >
              Tampilkan semua
            </button>
          </div>
        )}

        {loading ? (
          <p className="empty-note">Memuat antrean...</p>
        ) : (
          <div className="kanban-board">
            {visibleStatuses.includes('Baru') && (
              <KanbanColumn
                title="Baru"
                tone="peach"
                orders={columns.Baru}
                onAdvance={(o) => void handleAdvance(o)}
                onMarkPaid={(o) => void handleMarkPaid(o)}
                emptyText="Belum ada pesanan baru."
              />
            )}
            {visibleStatuses.includes('Disiapkan') && (
              <KanbanColumn
                title="Disiapkan"
                tone="teal"
                orders={columns.Disiapkan}
                onAdvance={(o) => void handleAdvance(o)}
                onMarkPaid={(o) => void handleMarkPaid(o)}
                emptyText="Belum ada yang disiapkan."
              />
            )}
            {visibleStatuses.includes('Siap') && (
              <KanbanColumn
                title="Siap"
                tone="green"
                orders={columns.Siap}
                onAdvance={(o) => void handleAdvance(o)}
                onMarkPaid={(o) => void handleMarkPaid(o)}
                emptyText="Belum ada yang siap diambil."
              />
            )}
          </div>
        )}

        {doneCount > 0 && (
          <p className="barista-done-note">{doneCount} pesanan selesai hari ini.</p>
        )}
        <p className="barista-shopee-note">
          Pesanan ShopeeFood harus dikonfirmasi maks 3 menit sebelum auto-batal.
        </p>
      </div>
    </View>
  );
}
