import type { CSSProperties } from 'react';
import GlassCard from '../../components/GlassCard';
import { SHEET_URL } from '../../lib/api';
import { fmtRp } from '../../lib/format';

type Periode = '7 hari' | '30 hari';

interface ReportPanelProps {
  periode: Periode;
  onPeriodeChange: (p: Periode) => void;
  from: string;
  to: string;
  total: { pesanan: number; omzet: number };
}

export function ReportPanel({ periode, onPeriodeChange, from, to, total }: ReportPanelProps) {
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
          onChange={(e) => onPeriodeChange(e.target.value as Periode)}
        >
          <option value="7 hari">7 hari</option>
          <option value="30 hari">30 hari</option>
        </select>
      </label>
      <p className="report-note">
        Periode {from} sampai {to}: {total.pesanan} pesanan selesai, omzet{' '}
        {fmtRp(total.omzet)}. Laporan tersimpan di Spreadsheet kerja, buka
        lewat tombol di bawah. Download atau export dilakukan dari Sheets.
      </p>
      <div className="report-actions">
        <a className="btn btn-primary" href={SHEET_URL} target="_blank" rel="noreferrer">
          Buka Spreadsheet
        </a>
      </div>
    </GlassCard>
  );
}
