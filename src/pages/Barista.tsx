import { useEffect, useMemo, useState } from 'react';
import type { Order, OrderStatus } from '../lib/dummy';
import { baristaOrders, warkopCatalog } from '../lib/dummy';
import { fmtRp } from '../lib/format';
import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import { KanbanColumn } from '../features/barista/KanbanColumn';
import { orderKey, orderWaiting } from '../features/barista/OrderCard';
import './Barista.css';

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  Baru: 'Disiapkan',
  Disiapkan: 'Siap',
  Siap: 'Selesai',
  Selesai: null,
};

type BoardStatus = 'Baru' | 'Disiapkan' | 'Siap';

export default function Barista() {
  const [orders, setOrders] = useState<Order[]>(baristaOrders);
  const [isOpen, setIsOpen] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [doneCount, setDoneCount] = useState(0);
  const [walkInCount, setWalkInCount] = useState(0);
  const [availability, setAvailability] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const item of warkopCatalog) map[item.id] = item.available;
    return map;
  });

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

  const handleAdvance = (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    if (next === 'Selesai') {
      setOrders((prev) => prev.filter((o) => orderKey(o) !== orderKey(order)));
      setDoneCount((c) => c + 1);
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (orderKey(o) === orderKey(order) ? { ...o, status: next } : o)),
    );
  };

  const handleWalkIn = () => {
    const fallback = warkopCatalog.find((item) => item.available) ?? warkopCatalog[0];
    const name = fallback ? fallback.name : 'Kopi Tubruk';
    const price = fallback ? fallback.price : 10000;
    const n = walkInCount + 1;
    setWalkInCount(n);
    const walkIn = {
      id: `WI-${String(n).padStart(2, '0')}`,
      time: now
        .toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Jakarta',
        })
        .replace(':', '.'),
      customer: 'Walk-in',
      items: name,
      total: price,
      source: 'Web',
      status: 'Baru',
      waitingMinutes: 0,
      draft: false,
    } as unknown as Order;
    setOrders((prev) => [walkIn, ...prev]);
  };

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
              onClick={() => setIsOpen((v) => !v)}
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
          </div>
        </div>

        <div className="kanban-board">
          <KanbanColumn
            title="Baru"
            tone="peach"
            orders={columns.Baru}
            onAdvance={handleAdvance}
            emptyText="Belum ada pesanan baru."
          />
          <KanbanColumn
            title="Disiapkan"
            tone="teal"
            orders={columns.Disiapkan}
            onAdvance={handleAdvance}
            emptyText="Belum ada yang disiapkan."
          />
          <KanbanColumn
            title="Siap"
            tone="green"
            orders={columns.Siap}
            onAdvance={handleAdvance}
            emptyText="Belum ada yang siap diambil."
          />
        </div>

        {doneCount > 0 && (
          <p className="barista-done-note">{doneCount} pesanan selesai hari ini.</p>
        )}
        <p className="barista-shopee-note">
          Pesanan ShopeeFood harus dikonfirmasi maks 3 menit sebelum auto-batal.
        </p>

        <GlassCard className="catalog-panel">
          <div className="catalog-panel-head">
            <h2>Katalog warkop</h2>
            <button type="button" className="btn-primary" onClick={handleWalkIn}>
              Tambah pesanan walk-in
            </button>
          </div>
          <ul className="catalog-list">
            {warkopCatalog.map((item) => {
              const available = availability[item.id] ?? item.available;
              return (
                <li key={item.id} className="catalog-row">
                  <div>
                    <p className="catalog-name">{item.name}</p>
                    <p className="catalog-price">{fmtRp(item.price)}</p>
                  </div>
                  <button
                    type="button"
                    className={`btn-sm catalog-toggle${available ? ' is-available' : ' is-out'}`}
                    aria-pressed={available}
                    onClick={() =>
                      setAvailability((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                    }
                  >
                    {available ? 'Tersedia' : 'Habis'}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="catalog-hint">
            Pesanan walk-in masuk ke kolom Baru dengan satu item default, bisa diubah nanti.
          </p>
        </GlassCard>
      </div>
    </View>
  );
}
