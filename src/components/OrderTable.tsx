import type { Order } from '../lib/dummy';
import { fmtRp } from '../lib/format';
import StatusPill from './StatusPill';
import { IconClock } from './icons';

interface OrderTableProps {
  orders: Order[];
}

export function OrderTable({ orders }: OrderTableProps) {
  if (orders.length === 0) {
    return <p className="empty-note">Belum ada pesanan.</p>;
  }

  return (
    <div className="mbg-table-wrap">
      <table className="mbg-table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Pelanggan</th>
            <th>Barang</th>
            <th>Total</th>
            <th>Sumber</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.time}</td>
              <td>
                <strong style={{ color: 'var(--ink)' }}>{order.customer}</strong>
                <div className="form-note">{order.id}</div>
              </td>
              <td>
                {order.items}
                {order.draft ? (
                  <span className="table-draft-note">
                    <IconClock size={14} />
                    Draft, cek item dulu
                  </span>
                ) : null}
              </td>
              <td className="num">{fmtRp(order.total)}</td>
              <td>
                <span
                  className={`pill ${order.source === 'ShopeeFood' ? 'src-shopeefood' : 'src-web'}`}
                >
                  {order.source}
                </span>
              </td>
              <td>
                <StatusPill status={order.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default OrderTable;
