import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import StatCard from '../components/StatCard';
import { OmzetBarChart } from '../components/MbgCharts';
import OrderTable from '../components/OrderTable';
import View from '../components/View';
import { managerStats, omzet7Hari, recentOrders } from '../lib/dummy';
import { fmtRp } from '../lib/format';
import './Manager.css';

const MANAGER_ICONS: ReactNode[] = [
  <svg key="omzet" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6 12h.01M18 12h.01" />
  </svg>,
  <svg key="pesanan" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4.5A2.5 2.5 0 0 1 14 4.5" />
    <path d="M9 11h6M9 15h4" />
  </svg>,
  <svg key="anggota" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M16 15.2c2.6.3 4.7 1.9 5.5 4.8" />
  </svg>,
  <svg key="stok" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
    <path d="M3 8l9 5 9-5" />
    <path d="M12 13v8" />
  </svg>,
];

export default function Manager() {
  const chartData = useMemo(
    () => omzet7Hari.map((d) => ({ day: d.day, value: d.value })),
    [],
  );
  const totalOmzet = useMemo(() => omzet7Hari.reduce((sum, d) => sum + d.value, 0), []);
  const maxIndex = useMemo(() => {
    let best = 0;
    omzet7Hari.forEach((d, i) => {
      if (d.value > omzet7Hari[best].value) best = i;
    });
    return best;
  }, []);

  return (
    <View>
      <div className="manager-page">
        <section className="stats-row" aria-label="Ringkasan hari ini">
          {managerStats.map((s, i) => (
            <StatCard
              key={s.label}
              label={s.label}
              value={s.value}
              delta={s.delta}
              deltaUp={s.deltaUp}
              icon={MANAGER_ICONS[i]}
              delay={i * 50}
            />
          ))}
        </section>

        <section className="manager-mid">
          <GlassCard className="chart-card stagger" style={{ '--d': '200ms' } as CSSProperties}>
            <div className="card-head">
              <h2>Omzet 7 hari terakhir</h2>
              <span className="card-total">{fmtRp(totalOmzet)}</span>
            </div>
            <OmzetBarChart data={chartData} />
            <p className="card-foot">Total 7 hari: {fmtRp(totalOmzet)}. Hari tertinggi: {omzet7Hari[maxIndex].day}.</p>
          </GlassCard>
          <GlassCard className="manager-links stagger" style={{ '--d': '250ms' } as CSSProperties}>
            <div className="card-head">
              <h2>Lanjut ke</h2>
            </div>
            <p className="card-foot">Pesanan lengkap dengan filter status, dan panel laporan per periode.</p>
            <div className="manager-links__actions">
              <Link to="/manager/pesanan" className="btn btn-primary">
                Semua pesanan
              </Link>
              <Link to="/manager/laporan" className="btn btn-secondary">
                Laporan
              </Link>
            </div>
          </GlassCard>
        </section>

        <GlassCard className="orders-card stagger" style={{ '--d': '250ms' } as CSSProperties}>
          <div className="card-head">
            <h2>Pesanan terbaru</h2>
          </div>
          <OrderTable orders={recentOrders} />
        </GlassCard>
      </div>
    </View>
  );
}
