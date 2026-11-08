import type { ReactNode } from 'react';
import { IconChart } from './icons';

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaUp?: boolean;
  icon?: ReactNode;
  delay?: number;
}

export function StatCard({
  label,
  value,
  delta,
  deltaUp,
  icon,
  delay = 0,
}: StatCardProps) {
  const deltaClass = delta
    ? `stat-card__delta ${deltaUp ? 'stat-card__delta--up' : 'stat-card__delta--down'}`
    : '';
  const arrow = deltaUp === undefined ? '' : deltaUp ? '↑ ' : '↓ ';

  return (
    <div
      className="glass-card glass-card--lift stat-card stagger"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="stat-card__top">
        <span className="stat-card__label">{label}</span>
        <span className="stat-card__icon">{icon ?? <IconChart />}</span>
      </div>
      <span className="stat-card__value">{value}</span>
      {delta ? (
        <span className={deltaClass}>
          {arrow}
          {delta}
        </span>
      ) : null}
    </div>
  );
}

export default StatCard;
