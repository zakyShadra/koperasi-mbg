import { useMemo } from 'react';
import { AreaChart } from './charts/area-chart';
import { Area } from './charts/area';
import { BarChart } from './charts/bar-chart';
import { Bar } from './charts/bar';
import { BarXAxis } from './charts/bar-x-axis';
import { Grid } from './charts/grid';
import { XAxis } from './charts/x-axis';
import { ChartTooltip } from './charts/tooltip';
import { PieChart } from './charts/pie-chart';
import { PieSlice } from './charts/pie-slice';
import { PieCenter } from './charts/pie-center';
import { fmtRp } from '../lib/format';

const TEAL = '#2dd4bf';
const ORANGE = '#fb923c';

function fmtShort(n: number): string {
  return `Rp ${(n / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;
}

export interface OmzetPoint {
  day: string;
  value: number;
  [key: string]: unknown;
}

export function OmzetBarChart({ data }: { data: OmzetPoint[] }) {
  return (
    <BarChart
      data={data}
      xDataKey="day"
      aspectRatio="3 / 1"
      margin={{ top: 16, right: 16, bottom: 32, left: 16 }}
    >
      <Grid />
      <Bar
        dataKey="value"
        fill={TEAL}
        showValue
        valueLabelFormatter={(v) =>
          `${(v / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`
        }
      />
      <BarXAxis showAllLabels />
      <ChartTooltip
        rows={(point) => [
          { color: TEAL, label: 'Omzet', value: fmtShort(Number(point.value)) },
        ]}
      />
    </BarChart>
  );
}

export interface CashPoint {
  day: string;
  masuk: number;
  keluar: number;
  [key: string]: unknown;
}

export function CashFlowChart({ data }: { data: CashPoint[] }) {
  return (
    <div>
      <div className="chart-legend">
        <span>
          <i style={{ background: TEAL }} />
          Masuk
        </span>
        <span>
          <i style={{ background: ORANGE }} />
          Keluar
        </span>
      </div>
      <BarChart
        data={data}
        xDataKey="day"
        aspectRatio="3 / 1"
        margin={{ top: 16, right: 16, bottom: 32, left: 16 }}
      >
        <Grid />
        <Bar dataKey="masuk" fill={TEAL} />
        <Bar dataKey="keluar" fill={ORANGE} />
        <BarXAxis showAllLabels />
        <ChartTooltip
          rows={(point) => [
            { color: TEAL, label: 'Masuk', value: fmtRp(Number(point.masuk)) },
            { color: ORANGE, label: 'Keluar', value: fmtRp(Number(point.keluar)) },
          ]}
        />
      </BarChart>
    </div>
  );
}

export interface CategoryPoint {
  label: string;
  value: number;
  color: string;
}

export function CategoryDonut({ data }: { data: CategoryPoint[] }) {
  return (
    <div className="donut-wrap">
      <PieChart data={data} size={260} innerRadius={80} cornerRadius={4} padAngle={0.02}>
        {data.map((d, i) => (
          <PieSlice key={d.label} index={i} color={d.color} />
        ))}
        <PieCenter defaultLabel="Total">
          {({ value, label }) => (
            <span className="donut-center">
              <span className="donut-center__value">{fmtShort(value)}</span>
              <span className="donut-center__label">{label}</span>
            </span>
          )}
        </PieCenter>
      </PieChart>
      <ul className="donut-legend">
        {data.map((d) => (
          <li key={d.label}>
            <span className="donut-legend__dot" style={{ background: d.color }} />
            {d.label}
            <span className="donut-legend__value">{fmtRp(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface TrendPoint {
  date: Date;
  day: string;
  value: number;
  [key: string]: unknown;
}

export function OmzetAreaChart({ data }: { data: TrendPoint[] }) {
  const labels = useMemo(() => data.map((d) => d.day), [data]);
  return (
    <AreaChart
      data={data}
      xDataKey="date"
      aspectRatio="3 / 1"
      margin={{ top: 16, right: 16, bottom: 32, left: 16 }}
    >
      <Grid />
      <Area dataKey="value" fill={TEAL} />
      <XAxis labels={labels} numTicks={7} />
      <ChartTooltip
        showDatePill={false}
        dateLabels={labels}
        rows={(point) => [
          { color: TEAL, label: 'Omzet', value: fmtShort(Number(point.value)) },
        ]}
      />
    </AreaChart>
  );
}
