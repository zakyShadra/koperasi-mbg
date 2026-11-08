import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getSession, clearSession } from '../lib/auth-session';
import { useCart } from '../features/pelanggan/cart-context';
import { FlyoutCard } from './FlyoutCard';
import type { FlyoutData } from './FlyoutCard';
import {
  IconBag,
  IconBox,
  IconCart,
  IconChart,
  IconChevronRight,
  IconClock,
  IconCoffee,
  IconDashboard,
  IconLogout,
  IconPlus,
  IconUsers,
  IconWallet,
} from './icons';
import {
  LOGO_URL,
  getCashReport,
  getCatalog,
  getOmzetReport,
  getOrders,
  getQueue,
  getStats,
  getTransactions,
  logoutApi,
} from '../lib/api';
import { fillDaily, fmtRp, rangeDays, weekdayShort } from '../lib/format';
import './Sidebar.css';

interface SubItem {
  to: string;
  label: string;
  status?: string;
}

interface MenuItem {
  id: string;
  to: string;
  label: string;
  icon: ReactNode;
  status?: string;
  flyout?: FlyoutData;
  children?: SubItem[];
}

type RoleKey = 'manager' | 'finance' | 'barista' | 'guest';

interface SidebarStats {
  catalogTotal: number;
  koperasiCount: number;
  warkopCount: number;
  koperasiStock: number;
  warkopStock: number;
  omzetHariIni: number;
  omzet7: { label: string; value: number }[];
  omzet7Total: number;
  pesananHariIni: number;
  statusCounts: Record<string, number>;
  saldo: number;
  masukBulanIni: number;
  categoryTotals: { label: string; value: number }[];
  txCount: number;
  txCategoryCounts: Record<string, number>;
  queueTotal: number;
  queueCounts: Record<string, number>;
  draftCount: number;
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    map[k] = (map[k] ?? 0) + 1;
  }
  return map;
}

const STATUS_LABEL_ID: Record<string, string> = {
  baru: 'Baru',
  disiapkan: 'Disiapkan',
  siap: 'Siap',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
};

function useSidebarStats(role: RoleKey): SidebarStats | null {
  const [stats, setStats] = useState<SidebarStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (role === 'guest') {
          const products = await getCatalog();
          const koperasi = products.filter((p) => p.kategori === 'Barang Koperasi');
          const warkop = products.filter((p) => p.kategori === 'Warkop');
          if (cancelled) return;
          setStats({
            catalogTotal: products.length,
            koperasiCount: koperasi.length,
            warkopCount: warkop.length,
            koperasiStock: koperasi.reduce((s, p) => s + p.stok, 0),
            warkopStock: warkop.reduce((s, p) => s + p.stok, 0),
            omzetHariIni: 0,
            omzet7: [],
            omzet7Total: 0,
            pesananHariIni: 0,
            statusCounts: {},
            saldo: 0,
            masukBulanIni: 0,
            categoryTotals: [],
            txCount: 0,
            txCategoryCounts: {},
            queueTotal: 0,
            queueCounts: {},
            draftCount: 0,
          });
          return;
        }
        if (role === 'manager') {
          const { from, to } = rangeDays(7);
          const [s, report, orders] = await Promise.all([
            getStats(),
            getOmzetReport(from, to),
            getOrders(undefined, 200),
          ]);
          if (cancelled) return;
          const daily = fillDaily(from, to, report.daily);
          setStats({
            catalogTotal: 0,
            koperasiCount: 0,
            warkopCount: 0,
            koperasiStock: 0,
            warkopStock: 0,
            omzetHariIni: s.omzet_hari_ini,
            omzet7: daily.map((d) => ({ label: weekdayShort(d.tanggal), value: d.omzet })),
            omzet7Total: report.total.omzet,
            pesananHariIni: s.pesanan_hari_ini,
            statusCounts: countBy(orders, (o) => STATUS_LABEL_ID[o.status] ?? o.status),
            saldo: 0,
            masukBulanIni: 0,
            categoryTotals: [],
            txCount: 0,
            txCategoryCounts: {},
            queueTotal: 0,
            queueCounts: {},
            draftCount: 0,
          });
          return;
        }
        if (role === 'finance') {
          const today = rangeDays(1).to;
          const monthStart = `${today.slice(0, 8)}01`;
          const [report, txs] = await Promise.all([
            getCashReport(monthStart, today),
            getTransactions(),
          ]);
          if (cancelled) return;
          const byCategory = new Map<string, number>();
          for (const row of report.per_kategori) {
            const key = row.kategori ?? 'Lainnya';
            byCategory.set(key, (byCategory.get(key) ?? 0) + row.jumlah);
          }
          setStats({
            catalogTotal: 0,
            koperasiCount: 0,
            warkopCount: 0,
            koperasiStock: 0,
            warkopStock: 0,
            omzetHariIni: 0,
            omzet7: [],
            omzet7Total: 0,
            pesananHariIni: 0,
            statusCounts: {},
            saldo: report.saldo,
            masukBulanIni: report.masuk,
            categoryTotals: [...byCategory.entries()].map(([label, value]) => ({ label, value })),
            txCount: txs.length,
            txCategoryCounts: countBy(txs, (t) => t.kategori ?? 'Lainnya'),
            queueTotal: 0,
            queueCounts: {},
            draftCount: 0,
          });
          return;
        }
        const [queue, products] = await Promise.all([getQueue(), getCatalog()]);
        if (cancelled) return;
        const warkop = products.filter((p) => p.kategori === 'Warkop');
        setStats({
          catalogTotal: 0,
          koperasiCount: 0,
          warkopCount: warkop.length,
          koperasiStock: 0,
          warkopStock: 0,
          omzetHariIni: 0,
          omzet7: [],
          omzet7Total: 0,
          pesananHariIni: 0,
          statusCounts: {},
          saldo: 0,
          masukBulanIni: 0,
          categoryTotals: [],
          txCount: 0,
          txCategoryCounts: {},
          queueTotal: queue.length,
          queueCounts: countBy(queue, (o) => STATUS_LABEL_ID[o.status] ?? o.status),
          draftCount: queue.filter((o) => o.is_draft === 1).length,
        });
      } catch {
        // Angka sidebar boleh kosong, halaman tetap jalan.
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [role]);

  return stats;
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = getSession();
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [flyoutId, setFlyoutId] = useState<string | null>(null);
  const { count: cartCount } = useCart();

  const expanded = pinned || hovering;
  const role: RoleKey = session ? session.role : 'guest';
  const stats = useSidebarStats(role);

  useEffect(() => {
    setOpenGroup(null);
    setFlyoutId(null);
  }, [role]);

  const statusCounts = stats?.statusCounts ?? {};
  const txCategoryCounts = stats?.txCategoryCounts ?? {};
  const baristaCounts = stats?.queueCounts ?? {};

  const omzetFlyout: FlyoutData | undefined = stats
    ? {
        title: 'Omzet hari ini',
        total: stats.omzetHariIni,
        totalKind: 'rp',
        delta: `Total 7 hari ${fmtRp(stats.omzet7Total)}`,
        deltaTone: 'flat',
        bars: stats.omzet7,
        barsLabel: 'Omzet 7 hari terakhir',
      }
    : undefined;

  const pesananFlyout: FlyoutData | undefined = stats
    ? {
        title: 'Pesanan hari ini',
        total: stats.pesananHariIni,
        totalKind: 'number',
        totalSuffix: 'pesanan',
        delta: 'Hari ini',
        deltaTone: 'flat',
        bars: ['Baru', 'Disiapkan', 'Siap', 'Selesai'].map((s) => ({
          label: s,
          value: statusCounts[s] ?? 0,
        })),
        barsLabel: 'Pesanan per status',
      }
    : undefined;

  const saldoFlyout: FlyoutData | undefined = stats
    ? {
        title: 'Saldo kas',
        total: stats.saldo,
        totalKind: 'rp',
        delta: `${fmtRp(stats.masukBulanIni)} masuk bulan ini`,
        deltaTone: 'up',
        bars: stats.categoryTotals,
        barsLabel: 'Rekap per kategori',
      }
    : undefined;

  const katalogFlyout: FlyoutData | undefined = stats
    ? {
        title: 'Katalog',
        total: stats.catalogTotal,
        totalKind: 'number',
        totalSuffix: 'produk',
        delta: `${stats.koperasiCount} koperasi dan ${stats.warkopCount} warkop`,
        deltaTone: 'flat',
        bars: [
          { label: 'Koperasi', value: stats.koperasiStock },
          { label: 'Warkop', value: stats.warkopStock },
        ],
        barsLabel: 'Stok per katalog',
      }
    : undefined;

  const antreanFlyout: FlyoutData | undefined = stats
    ? {
        title: 'Antrean barista',
        total: stats.queueTotal,
        totalKind: 'number',
        totalSuffix: 'pesanan',
        delta:
          stats.draftCount > 0
            ? `${stats.draftCount} draft ShopeeFood perlu dicek`
            : 'Tidak ada draft',
        deltaTone: 'flat',
        bars: ['Baru', 'Disiapkan', 'Siap'].map((s) => ({
          label: s,
          value: baristaCounts[s] ?? 0,
        })),
        barsLabel: 'Antrean per status',
      }
    : undefined;

  const menus: Record<RoleKey, MenuItem[]> = {
    guest: [
      {
        id: 'katalog',
        to: '/pelanggan',
        label: 'Katalog',
        icon: <IconBag />,
        status: stats ? `${stats.catalogTotal} produk` : undefined,
        flyout: katalogFlyout,
        children: [
          { to: '/pelanggan?tab=koperasi', label: 'Koperasi', status: stats ? `${stats.koperasiCount} produk` : undefined },
          { to: '/pelanggan?tab=warkop', label: 'Warkop', status: stats ? `${stats.warkopCount} produk` : undefined },
        ],
      },
      {
        id: 'keranjang',
        to: '/pelanggan/keranjang',
        label: 'Keranjang',
        icon: <IconCart />,
        status: cartCount > 0 ? `${cartCount} item` : 'Kosong',
      },
      {
        id: 'lacak',
        to: '/pelanggan/lacak',
        label: 'Lacak pesanan',
        icon: <IconClock />,
        status: 'Cek status',
      },
    ],
    manager: [
      {
        id: 'dashboard',
        to: '/manager',
        label: 'Dashboard',
        icon: <IconDashboard />,
        status: stats ? fmtRp(stats.omzetHariIni) : undefined,
        flyout: omzetFlyout,
      },
      {
        id: 'pesanan',
        to: '/manager/pesanan',
        label: 'Pesanan',
        icon: <IconBag />,
        status: `${statusCounts.Baru ?? 0} baru`,
        flyout: pesananFlyout,
        children: ['Baru', 'Disiapkan', 'Siap', 'Selesai'].map((s) => ({
          to: `/manager/pesanan?status=${s}`,
          label: s,
          status: `${statusCounts[s] ?? 0}`,
        })),
      },
      {
        id: 'laporan',
        to: '/manager/laporan',
        label: 'Laporan',
        icon: <IconChart />,
        status: '7 hari',
      },
    ],
    finance: [
      {
        id: 'keuangan',
        to: '/finance',
        label: 'Keuangan',
        icon: <IconWallet />,
        status: stats ? fmtRp(stats.saldo) : undefined,
        flyout: saldoFlyout,
        children: ['Penjualan', 'Belanja bahan', 'Gaji', 'Operasional', 'Iuran anggota'].map((c) => ({
          to: `/finance?kategori=${encodeURIComponent(c)}`,
          label: c,
          status: `${txCategoryCounts[c] ?? 0}`,
        })),
      },
      {
        id: 'transaksi-baru',
        to: '/finance/transaksi-baru',
        label: 'Tambah transaksi',
        icon: <IconPlus />,
        status: stats ? `${stats.txCount} transaksi` : undefined,
      },
    ],
    barista: [
      {
        id: 'antrean',
        to: '/barista',
        label: 'Antrean',
        icon: <IconCoffee />,
        status: `${baristaCounts.Baru ?? 0} baru`,
        flyout: antreanFlyout,
        children: ['Baru', 'Disiapkan', 'Siap'].map((s) => ({
          to: `/barista?status=${s}`,
          label: s,
          status: `${baristaCounts[s] ?? 0}`,
        })),
      },
      {
        id: 'katalog-warkop',
        to: '/barista/katalog',
        label: 'Katalog warkop',
        icon: <IconBox />,
        status: stats ? `${stats.warkopCount} menu` : undefined,
      },
    ],
  };

  const items = menus[role];
  const isActive = (item: MenuItem) => {
    if (item.id === 'katalog' && role === 'guest') {
      return location.pathname === '/pelanggan';
    }
    return location.pathname === item.to;
  };

  const handleLogout = async () => {
    await logoutApi();
    clearSession();
    setFlyoutId(null);
    setOpenGroup(null);
    navigate('/pelanggan');
  };

  const userName = session ? session.email : 'Tamu';
  const userRole = session ? session.role : 'Pelanggan';
  const userInitial = session ? session.email.charAt(0).toUpperCase() : 'T';

  return (
    <aside
      className={`sidebar${expanded ? ' is-expanded' : ''}`}
      aria-label="Navigasi utama"
      onMouseEnter={() => {
        if (window.matchMedia('(hover: hover)').matches) setHovering(true);
      }}
      onMouseLeave={() => {
        setHovering(false);
        setFlyoutId(null);
      }}
    >
      <div className="sidebar__brand">
        <span className="sidebar__logo">
          <img src={LOGO_URL} alt="Logo Koperasi MBG" />
        </span>
        <span className="sidebar__brand-text">Koperasi MBG</span>
        <button
          type="button"
          className="sidebar__pin"
          aria-pressed={pinned}
          aria-label={pinned ? 'Kecilkan sidebar' : 'Kunci sidebar terbuka'}
          title={pinned ? 'Kecilkan sidebar' : 'Kunci sidebar terbuka'}
          onClick={() => setPinned((v) => !v)}
        >
          <IconChevronRight size={16} />
        </button>
      </div>

      <nav className="sidebar__nav">
        {items.map((item) => {
          const active = isActive(item);
          const groupOpen = openGroup === item.id;
          return (
            <div
              key={item.id}
              className="sidebar-item"
              onMouseEnter={() => {
                if (item.flyout) setFlyoutId(item.id);
              }}
              onMouseLeave={() => {
                if (flyoutId === item.id) setFlyoutId(null);
              }}
            >
              <div className="sidebar-item__row">
                <NavLink
                  to={item.to}
                  end={item.id === 'katalog' || item.id === 'dashboard' || item.id === 'keuangan' || item.id === 'antrean'}
                  className={`sidebar-item__link${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="sidebar-item__icon">{item.icon}</span>
                  <span className="sidebar-item__label">{item.label}</span>
                  {item.status && <span className="sidebar-item__status">{item.status}</span>}
                </NavLink>
                {item.children && (
                  <button
                    type="button"
                    className={`sidebar-item__chev${groupOpen ? ' is-open' : ''}`}
                    aria-expanded={groupOpen}
                    aria-label={`Submenu ${item.label}`}
                    onClick={() => setOpenGroup(groupOpen ? null : item.id)}
                  >
                    <IconChevronRight size={16} />
                  </button>
                )}
              </div>
              {item.children && groupOpen && expanded && (
                <div className="sidebar-submenu">
                  {item.children.map((child) => (
                    <NavLink key={child.to} to={child.to} className="sidebar-submenu__link">
                      <span className="sidebar-submenu__label">{child.label}</span>
                      {child.status && <span className="sidebar-submenu__status">{child.status}</span>}
                    </NavLink>
                  ))}
                </div>
              )}
              {item.flyout && flyoutId === item.id && (
                <div className="sidebar-flyout">
                  <FlyoutCard data={item.flyout} />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar__user">
        <span className="sidebar__avatar" aria-hidden="true">
          {userInitial}
        </span>
        <span className="sidebar__user-text">
          <span className="sidebar__user-name">{userName}</span>
          <span className="sidebar__user-role">
            <IconUsers size={12} /> {userRole}
          </span>
        </span>
        {session && (
          <button
            type="button"
            className="sidebar__logout"
            onClick={() => void handleLogout()}
            aria-label="Keluar"
            title="Keluar"
          >
            <IconLogout size={18} />
          </button>
        )}
      </div>

      {session && (
        <button type="button" className="sidebar-item__link sidebar-logout--mobile" onClick={() => void handleLogout()}>
          <span className="sidebar-item__icon">
            <IconLogout />
          </span>
          <span className="sidebar-item__label">Keluar</span>
        </button>
      )}
    </aside>
  );
}

export default Sidebar;
