import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import { OmzetAreaChart } from '../components/MbgCharts';
import UpdatedHint from '../components/UpdatedHint';
import { ReportPanel } from '../features/manager/ReportPanel';
import { friendlyError, getOmzetReport } from '../lib/api';
import { usePolling } from '../lib/usePolling';
import { fillDaily, fmtRp, rangeDays, weekdayShort } from '../lib/format';
import './Manager.css';

type Periode = '7 hari' | '30 hari';

export default function ManagerLaporan() {
  const [periode, setPeriode] = useState<Periode>('7 hari');
  const [daily, setDaily] = useState<{ tanggal: string; pesanan: number; omzet: number }[]>([]);
  const [total, setTotal] = useState({ pesanan: 0, omzet: 0 });
  const [range, setRange] = useState({ from: '', to: '' });
  const [error, setError] = useState('');

  const load = useCallback(async (): Promise<string> => {
    try {
      const days = periode === '7 hari' ? 7 : 30;
      const { from, to } = rangeDays(days);
      const report = await getOmzetReport(from, to);
      const filled = fillDaily(from, to, report.daily);
      setDaily(filled);
      setTotal(report.total);
      setRange({ from, to });
      setError('');
      return JSON.stringify([filled, report.total]);
    } catch (e) {
      setError(friendlyError(e));
      return '';
    }
  }, [periode]);

  useEffect(() => {
    void load();
  }, [load]);

  const { justUpdated } = usePolling(load, { resetKey: periode });

  const trendData = daily.map((d) => ({
    date: new Date(`${d.tanggal}T12:00:00+07:00`),
    day: weekdayShort(d.tanggal),
    value: d.omzet,
  }));
  const totalOmzet = daily.reduce((sum, d) => sum + d.omzet, 0);

  return (
    <View>
      <div className="manager-page">
        {error && (
          <p className="cart-error" role="alert">
            {error}
          </p>
        )}
        <section className="stats-row stats-row-3" aria-label="Ringkasan laporan">
          <GlassCard className="stat-card">
            <p className="stat-card__label">Total omzet {periode}</p>
            <p className="stat-card__value">{fmtRp(total.omzet)}</p>
          </GlassCard>
          <GlassCard className="stat-card">
            <p className="stat-card__label">Pesanan tercatat</p>
            <p className="stat-card__value">{total.pesanan}</p>
          </GlassCard>
          <GlassCard className="stat-card">
            <p className="stat-card__label">Periode laporan</p>
            <p className="stat-card__value">{periode}</p>
          </GlassCard>
        </section>
        <GlassCard className="chart-card stagger" style={{ '--d': '200ms' } as CSSProperties}>
          <div className="card-head">
            <h2>Tren omzet {periode}</h2>
            <UpdatedHint show={justUpdated} />
            <span className="card-total">{fmtRp(totalOmzet)}</span>
          </div>
          <OmzetAreaChart data={trendData} />
          <p className="card-foot">Total {periode}: {fmtRp(totalOmzet)}.</p>
        </GlassCard>
        <ReportPanel
          periode={periode}
          onPeriodeChange={setPeriode}
          from={range.from}
          to={range.to}
          total={total}
        />
      </div>
    </View>
  );
}
