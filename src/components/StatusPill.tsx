import type { OrderStatus } from '../lib/dummy';

const STATUS_CLASS: Record<OrderStatus, string> = {
  Baru: 'st-baru',
  Disiapkan: 'st-disiapkan',
  Siap: 'st-siap',
  Selesai: 'st-selesai',
};

interface StatusPillProps {
  status: OrderStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  return <span className={`status-pill ${STATUS_CLASS[status]}`}>{status}</span>;
}

export default StatusPill;
