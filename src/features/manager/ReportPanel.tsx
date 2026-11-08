import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import GlassCard from '../../components/GlassCard';

type Periode = 'Hari ini' | '7 hari' | 'Bulan ini';

const PERIODE_OPTIONS: Periode[] = ['Hari ini', '7 hari', 'Bulan ini'];

export function ReportPanel() {
  const [periode, setPeriode] = useState<Periode>('Hari ini');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const showDemoNotice = () => {
    setNotice('Demo: belum terhubung ke Sheet');
  };

  return (
    <GlassCard className="report-panel stagger" style={{ '--d': '200ms' } as CSSProperties}>
      <div className="card-head">
        <h2>Laporan</h2>
      </div>
      <label className="report-field" htmlFor="report-periode">
        <span>Periode</span>
        <select
          id="report-periode"
          value={periode}
          onChange={(e) => {
            setPeriode(e.target.value as Periode);
            setNotice('');
          }}
        >
          {PERIODE_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <div className="report-actions">
        <button type="button" className="btn btn-primary" onClick={showDemoNotice}>
          Download laporan
        </button>
        <button type="button" className="btn btn-secondary" onClick={showDemoNotice}>
          Simpan ke Sheet
        </button>
      </div>
      <p className="report-note">Laporan tersimpan sebagai dummy, backend Sheet menyusul.</p>
      {notice && (
        <p className="demo-notice" role="status">
          {notice}
        </p>
      )}
    </GlassCard>
  );
}
