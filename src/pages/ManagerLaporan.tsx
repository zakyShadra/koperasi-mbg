import { View } from '../components/View';
import { GlassCard } from '../components/GlassCard';
import { ReportPanel } from '../features/manager/ReportPanel';
import { omzet7Hari, recentOrders } from '../lib/dummy';
import { fmtRp } from '../lib/format';
import './Manager.css';

export default function ManagerLaporan() {
  const totalOmzet = omzet7Hari.reduce((sum, d) => sum + d.value, 0);

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
        <ReportPanel />
      </div>
    </View>
  );
}
