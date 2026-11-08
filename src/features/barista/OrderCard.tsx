import type { Order, OrderStatus } from '../../lib/dummy';
import { fmtRp } from '../../lib/format';
import { GlassCard } from '../../components/GlassCard';
import { StatusPill } from '../../components/StatusPill';

/**
 * Small accessors that tolerate the dummy Order shape: the order number is
 * the `id` (e.g. MBG-238), `items` is one comma-separated string
 * ("Kopi Tubruk x2, Pisang Goreng") or an array of strings or
 * { name, qty } objects, and the draft flag is `draft` or `isDraft`.
 */
export function orderKey(order: Order): string {
  const raw = order as unknown as { id?: unknown; number?: unknown; orderNumber?: unknown };
  if (typeof raw.id === 'string' && raw.id) return raw.id;
  if (typeof raw.number === 'string' && raw.number) return raw.number;
  if (typeof raw.orderNumber === 'string' && raw.orderNumber) return raw.orderNumber;
  return String(raw.id ?? raw.number ?? 'order');
}

export function orderNumber(order: Order): string {
  const raw = order as unknown as { number?: unknown; orderNumber?: unknown; id?: unknown };
  if (typeof raw.number === 'string' && raw.number) return raw.number;
  if (typeof raw.orderNumber === 'string' && raw.orderNumber) return raw.orderNumber;
  return String(raw.id ?? '');
}

export function orderIsDraft(order: Order): boolean {
  const raw = order as unknown as { isDraft?: unknown; draft?: unknown };
  return raw.isDraft === true || raw.draft === true;
}

export function orderWaiting(order: Order): number {
  const raw = order as unknown as { waitingMinutes?: unknown };
  return typeof raw.waitingMinutes === 'number' ? raw.waitingMinutes : 0;
}

export interface OrderItemLine {
  name: string;
  qty: number;
}

export function orderItems(order: Order): OrderItemLine[] {
  const raw = (order as unknown as { items?: unknown }).items;
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((part) => {
        const text = part.trim();
        const match = text.match(/^(.*?)\s*x(\d+)\s*$/i);
        if (match) return { name: match[1].trim(), qty: Number(match[2]) };
        return { name: text, qty: 1 };
      })
      .filter((line) => line.name.length > 0);
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string') return { name: item, qty: 1 };
    if (item && typeof item === 'object') {
      const rec = item as { name?: unknown; qty?: unknown; quantity?: unknown };
      const qty =
        typeof rec.qty === 'number' ? rec.qty : typeof rec.quantity === 'number' ? rec.quantity : 1;
      return { name: typeof rec.name === 'string' ? rec.name : 'Item', qty };
    }
    return { name: 'Item', qty: 1 };
  });
}

function actionLabel(status: OrderStatus, isDraft: boolean): string | null {
  if (status === 'Baru') return isDraft ? 'Konfirmasi draft' : 'Konfirmasi';
  if (status === 'Disiapkan') return 'Tandai siap';
  if (status === 'Siap') return 'Selesai';
  return null;
}

const PAY_LABEL: Record<string, string> = {
  tunai: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
};

export interface OrderCardProps {
  order: Order;
  onAdvance: (order: Order) => void;
  onMarkPaid?: (order: Order) => void;
  delay?: number;
}

export function OrderCard({ order, onAdvance, onMarkPaid, delay = 0 }: OrderCardProps) {
  const isDraft = orderIsDraft(order);
  const label = actionLabel(order.status, isDraft);
  const waiting = orderWaiting(order);
  const items = orderItems(order);
  const source = order.source === 'ShopeeFood' ? 'ShopeeFood' : 'Web';
  const needsPayment =
    order.status === 'Siap' && order.statusBayar === 'belum' && order.metodeBayar !== 'tunai';
  const draftMinutesLeft = isDraft ? Math.max(0, 3 - waiting) : 0;

  return (
    <GlassCard className="order-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="order-card-head">
        <span className="order-number">{orderNumber(order)}</span>
        <StatusPill status={order.status} />
      </div>
      <p className="order-customer">{order.customer}</p>
      <p className="order-pay">
        Bayar: {order.metodeBayar ? (PAY_LABEL[order.metodeBayar] ?? order.metodeBayar) : '-'}
        {order.statusBayar === 'lunas' ? ' (Lunas)' : ' (Belum lunas)'}
      </p>
      {order.status === 'Siap' && order.wa && (
        <p className="order-wa">WA: {order.wa}</p>
      )}
      <ul className="order-items">
        {items.map((item, i) => (
          <li key={`${item.name}-${i}`}>
            <span>{item.name}</span>
            <span className="order-qty">x{item.qty}</span>
          </li>
        ))}
      </ul>
      <div className="order-meta">
        <span className="order-total">{fmtRp(order.total)}</span>
        <span
          className={`source-badge ${source === 'ShopeeFood' ? 'source-shopeefood' : 'source-web'}`}
        >
          {source}
        </span>
      </div>
      <p className={`order-waiting${waiting >= 10 ? ' is-late' : ''}`}>
        {waiting} mnt menunggu
      </p>
      {isDraft && order.status === 'Baru' && (
        <p className="order-draft-warning">
          Draft, cek item dulu, sisa {draftMinutesLeft} mnt sebelum auto-batal
        </p>
      )}
      {needsPayment && onMarkPaid && (
        <button
          type="button"
          className="btn btn-secondary btn-sm order-action"
          onClick={() => onMarkPaid(order)}
        >
          Tandai lunas (dummy)
        </button>
      )}
      {label && (
        <button type="button" className="btn btn-primary btn-sm order-action" onClick={() => onAdvance(order)}>
          {label}
        </button>
      )}
    </GlassCard>
  );
}
