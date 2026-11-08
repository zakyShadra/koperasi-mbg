import { fmtRp } from '../lib/format';

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
}

const RADIUS = 64;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({ data }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let offset = 0;

  const segments = data.map((d, i) => {
    const fraction = total > 0 ? d.value / total : 0;
    const length = fraction * CIRCUMFERENCE;
    const seg = {
      ...d,
      dasharray: `${length} ${CIRCUMFERENCE - length}`,
      dashoffset: -offset,
      delay: i * 80,
    };
    offset += length;
    return seg;
  });

  return (
    <div className="donut-chart">
      <svg
        className="donut-chart__svg"
        width="160"
        height="160"
        viewBox="0 0 160 160"
        role="img"
        aria-label="Donat kategori keuangan"
      >
        <circle cx="80" cy="80" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="22" />
        {segments.map((seg) => (
          <circle
            key={seg.label}
            className="donut-chart__seg"
            cx="80"
            cy="80"
            r={RADIUS}
            stroke={seg.color}
            strokeDasharray={seg.dasharray}
            strokeDashoffset={seg.dashoffset}
            style={{ animationDelay: `${seg.delay}ms` }}
          />
        ))}
      </svg>
      <ul className="donut-legend">
        {data.map((d) => (
          <li key={d.label}>
            <span
              className="donut-legend__dot"
              style={{ background: d.color }}
            />
            {d.label}
            <span className="donut-legend__value">{fmtRp(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DonutChart;
