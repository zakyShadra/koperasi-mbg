import { useEffect, useRef, useState } from 'react';
import { BarSparkline, useSparklineHover } from './charts/sparkline';
import { fmtRp } from '../lib/format';

export interface FlyoutBar {
  label: string;
  value: number;
}

export interface FlyoutData {
  title: string;
  total: number;
  totalKind: 'rp' | 'number';
  totalSuffix?: string;
  delta: string;
  deltaTone: 'up' | 'down' | 'flat';
  bars: FlyoutBar[];
  barsLabel: string;
}

function fmtShortRp(n: number): string {
  const jt = n / 1000000;
  if (jt >= 1) return `Rp ${jt.toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;
  return fmtRp(n);
}

function formatValue(n: number, kind: 'rp' | 'number'): string {
  return kind === 'rp' ? fmtRp(n) : n.toLocaleString('id-ID');
}

export function FlyoutCard({ data }: { data: FlyoutData }) {
  const [shown, setShown] = useState(0);
  const rafRef = useRef(0);
  const hover = useSparklineHover<FlyoutBar>();

  useEffect(() => {
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(data.total * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [data.total]);

  const hovered = hover.datum;

  return (
    <div className="flyout-card" role="status">
      <p className="flyout-card__title">{data.title}</p>
      <p className="flyout-card__total">
        {formatValue(shown, data.totalKind)}
        {data.totalSuffix ? <span> {data.totalSuffix}</span> : null}
      </p>
      <p className={`flyout-card__delta is-${data.deltaTone}`}>
        {data.deltaTone === 'up' ? '▲ ' : data.deltaTone === 'down' ? '▼ ' : ''}
        {data.delta}
      </p>
      <div className="flyout-card__chart" aria-label={data.barsLabel}>
        <p className="flyout-card__tip">
          {hovered
            ? `${hovered.label}: ${data.totalKind === 'rp' ? fmtShortRp(hovered.value) : hovered.value.toLocaleString('id-ID')}`
            : data.barsLabel}
        </p>
        <BarSparkline
          data={data.bars}
          dataKey="value"
          color="#2dd4bf"
          height={56}
          barGap={4}
          barRadius={3}
          aria-label={data.barsLabel}
          {...hover.sparklineProps}
        />
        <div className="flyout-card__labels">
          {data.bars.map((bar) => (
            <span key={bar.label}>{bar.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FlyoutCard;
