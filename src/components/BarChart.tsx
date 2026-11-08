interface BarChartProps {
  data: { label: string; value: number }[];
  highlightIndex?: number;
}

function fmtShort(n: number): string {
  const jt = n / 1000000;
  return `Rp ${jt.toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;
}

export function BarChart({ data, highlightIndex }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="bar-chart" role="img" aria-label="Grafik batang omzet">
      {data.map((d, i) => (
        <div className="bar-chart__col" key={d.label}>
          <span className="bar-chart__value">{fmtShort(d.value)}</span>
          <div
            className={`bar-chart__bar ${i === highlightIndex ? 'bar-chart__bar--highlight' : ''}`}
            style={{
              height: `${Math.max((d.value / max) * 100, 4)}%`,
              animationDelay: `${i * 40}ms`,
            }}
          />
          <span className="bar-chart__label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default BarChart;
