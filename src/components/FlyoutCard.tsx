import { useEffect, useRef, useState } from 'react';
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

// Kartu preview melayang di samping sidebar: total yang menghitung naik,
// perbandingan periode, grafik batang yang tumbuh, tooltip per batang.
export function FlyoutCard({ data }: { data: FlyoutData }) {
  const [shown, setShown] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const rafRef = useRef(0);

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

  const max = Math.max(...data.bars.map((b) => b.value), 1);

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
        {data.bars.map((bar, i) => (
          <div
            key={bar.label}
            className="flyout-bar"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            tabIndex={0}
          >
            <div
              className={`flyout-bar__fill${i === data.bars.length - 1 ? ' is-last' : ''}`}
              style={{
                height: `${Math.max((bar.value / max) * 100, 6)}%`,
                animationDelay: `${i * 40}ms`,
              }}
            />
            <span className="flyout-bar__label">{bar.label}</span>
            {hovered === i && (
              <span className="flyout-bar__tip">
                {bar.label}: {data.totalKind === 'rp' ? fmtShortRp(bar.value) : bar.value.toLocaleString('id-ID')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default FlyoutCard;
