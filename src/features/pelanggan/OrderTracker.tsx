import { orderTrackerSteps } from '../../lib/dummy';

export interface OrderTrackerProps {
  steps?: string[];
  current?: number;
}

export function OrderTracker({ steps = orderTrackerSteps, current = 0 }: OrderTrackerProps) {
  return (
    <ol className="order-tracker" aria-label="Status pesanan">
      {steps.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo';
        return (
          <li key={step} className={`tracker-step tracker-${state}`}>
            <span className="tracker-dot" aria-hidden="true">
              {i < current ? '✓' : i + 1}
            </span>
            <span className="tracker-label">{step}</span>
            {i < steps.length - 1 && <span className="tracker-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
