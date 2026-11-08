import type { CSSProperties } from 'react';
import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import { OmzetAreaChart } from '../components/MbgCharts';
import { ReportPanel } from '../features/manager/ReportPanel';
import { omzet7Hari, recentOrders } from '../lib/dummy';
import { fmtRp } from '../lib/format';
import './Manager.css';

const TREND_DATES = (() => {
  const today = new Date();
  return omzet7Hari.map((_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (omzet7Hari.length - 1 - i));
    return date;
  });
})();

export default function ManagerLaporan() {
  const totalOmzet = omzet7Hari.reduce((sum, d) => sum + d.value, 0);
  const trendData = omzet7Hari.map((d, i) => ({ date: TREND_DATES[i], day: d.day, value: d.value }));

  return (
    <View>
      <div className="manager-page">
        <section className="stats-row stats-row-3" aria-label="Ringkasan laporan">
          <GlassCard className="stat-card">
            <p className="stat-card__label">Total omzet 7 hari</p>
            <p className="stat-card__value">{fmtRp(totalOmzet)}</p>
          </GlassCard>
          <GlassCard className="stat-card">
            <p className="stat-card__label">Pesanan tercatat</p>
            <p className="stat-card__value">{recentOrders.length}</p>
          </GlassCard>
          <GlassCard className="stat-card">
            <p className="stat-card__label">Periode laporan</p>
            <p className="stat-card__value">7 hari</p>
          </GlassCard>
        </section>
        <GlassCard className="chart-card stagger" style={{ '--d': '200ms' } as CSSProperties}>
          <div className="card-head">
            <h2>Tren omzet 7 hari</h2>
            <span className="card-total">{fmtRp(totalOmzet)}</span>
          </div>
          <OmzetAreaChart data={trendData} />
          <p className="card-foot">Total 7 hari: {fmtRp(totalOmzet)}.</p>
        </GlassCard>
        <ReportPanel />
      </div>
    </View>
  );
}
