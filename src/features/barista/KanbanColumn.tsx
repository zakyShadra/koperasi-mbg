import type { Order } from '../../lib/dummy';
import { OrderCard, orderKey } from './OrderCard';

export type KanbanTone = 'peach' | 'teal' | 'green';

export interface KanbanColumnProps {
  title: string;
  tone: KanbanTone;
  orders: Order[];
  onAdvance: (order: Order) => void;
  onMarkPaid?: (order: Order) => void;
  emptyText: string;
}

export function KanbanColumn({ title, tone, orders, onAdvance, onMarkPaid, emptyText }: KanbanColumnProps) {
  return (
    <section className={`kanban-column kanban-${tone}`} aria-label={`Kolom ${title}`}>
      <header className="kanban-header">
        <h2>{title}</h2>
        <span className="kanban-count">{orders.length}</span>
      </header>
      <div className="kanban-list">
        {orders.length === 0 ? (
          <p className="kanban-empty">{emptyText}</p>
        ) : (
          orders.map((order, i) => (
            <OrderCard key={orderKey(order)} order={order} onAdvance={onAdvance} onMarkPaid={onMarkPaid} delay={i * 50} />
          ))
        )}
      </div>
    </section>
  );
}
