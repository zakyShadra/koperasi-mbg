import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import StatCard from '../components/StatCard';
import { OmzetBarChart } from '../components/MbgCharts';
import OrderTable from '../components/OrderTable';
import View from '../components/View';
import { SHEET_URL, friendlyError, getOrders, getOmzetReport, getStats, mapApiOrder } from '../lib/api';
import { fillDaily, fmtRp, rangeDays, weekdayShort } from '../lib/format';
import type { Order } from '../lib/dummy';
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
  const [stats, setStats] = useState<{
    anggota_aktif: number;
    stok_menipis: number;
    pesanan_hari_ini: number;
    omzet_hari_ini: number;
    pesanan_selesai_hari_ini: number;
  } | null>(null);
  const [daily, setDaily] = useState<{ tanggal: string; pesanan: number; omzet: number }[]>([]);
  const [recent, setRecent] = useState<Order[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { from, to } = rangeDays(7);
        const [s, report, orders] = await Promise.all([
          getStats(),
          getOmzetReport(from, to),
          getOrders(undefined, 6),
        ]);
        setStats(s);
        setDaily(fillDaily(from, to, report.daily));
        setRecent(orders.map(mapApiOrder));
      } catch (e) {
        setError(friendlyError(e));
      }
    };
    void load();
  }, []);

  const chartData = useMemo(
    () => daily.map((d) => ({ day: weekdayShort(d.tanggal), value: d.omzet })),
    [daily],
  );
  const totalOmzet = useMemo(() => daily.reduce((sum, d) => sum + d.omzet, 0), [daily]);
  const maxIndex = useMemo(() => {
    let best = 0;
    daily.forEach((d, i) => {
      if (d.omzet > daily[best].omzet) best = i;
    });
    return best;
  }, [daily]);

  const statCards = [
    {
      label: 'Omzet hari ini',
      value: stats ? fmtRp(stats.omzet_hari_ini) : 'Memuat...',
      delta: stats ? `${stats.pesanan_selesai_hari_ini} pesanan selesai hari ini` : undefined,
      deltaUp: true,
    },
    {
      label: 'Pesanan hari ini',
      value: stats ? String(stats.pesanan_hari_ini) : 'Memuat...',
      delta: undefined,
      deltaUp: undefined,
    },
    {
      label: 'Anggota aktif',
      value: stats ? String(stats.anggota_aktif) : 'Memuat...',
      delta: undefined,
      deltaUp: undefined,
    },
    {
      label: 'Stok menipis',
      value: stats ? String(stats.stok_menipis) : 'Memuat...',
      delta: stats && stats.stok_menipis > 0 ? 'Perlu restock' : undefined,
      deltaUp: false,
    },
  ];

  return (
    <View>
      <div className="manager-page">
        {error && (
          <p className="cart-error" role="alert">
            {error}
          </p>
        )}
        <section className="stats-row" aria-label="Ringkasan hari ini">
          {statCards.map((s, i) => (
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
            <p className="card-foot">
              Total 7 hari: {fmtRp(totalOmzet)}.
              {daily.length > 0 ? ` Hari tertinggi: ${weekdayShort(daily[maxIndex].tanggal)}.` : ''}
            </p>
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
              <a className="btn btn-secondary" href={SHEET_URL} target="_blank" rel="noreferrer">
                Buka Spreadsheet
              </a>
            </div>
          </GlassCard>
        </section>

        <GlassCard className="orders-card stagger" style={{ '--d': '250ms' } as CSSProperties}>
          <div className="card-head">
            <h2>Pesanan terbaru</h2>
          </div>
          <OrderTable orders={recent} />
        </GlassCard>
      </div>
    </View>
  );
}
