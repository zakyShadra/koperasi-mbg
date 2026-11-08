import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getSession, clearSession } from '../lib/auth-session';
import {
  categorySummary,
  omzet7Hari,
  productsKoperasi,
  productsWarkop,
  recentOrders,
  warkopCatalog,
} from '../lib/dummy';
import { useCart } from '../features/pelanggan/cart-context';
import { useTransactions } from '../features/finance/transactions-store';
import { useBaristaOrders } from '../features/barista/barista-store';
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

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    map[k] = (map[k] ?? 0) + 1;
  }
  return map;
}

function orderStatusCounts() {
  return countBy(recentOrders, (o) => o.status);
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  // Sesi dibaca tiap render, bukan sekali di useState: Sidebar tidak
  // pernah remount saat login client-side, jadi state awal akan basi
  // dan menu tamu tetap tampil setelah staff login.
  const session = getSession();
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [flyoutId, setFlyoutId] = useState<string | null>(null);
  const { count: cartCount } = useCart();
  const txs = useTransactions();
  const baristaOrders = useBaristaOrders();

  const expanded = pinned || hovering;
  const role: RoleKey = session ? session.role : 'guest';

  // Ganti role: tutup submenu dan kartu preview dari role sebelumnya.
  useEffect(() => {
    setOpenGroup(null);
    setFlyoutId(null);
  }, [role]);
  const statusCounts = orderStatusCounts();
  const txCategoryCounts = countBy(txs, (t) => t.category);
  const baristaCounts = countBy(baristaOrders, (o) => o.status);
  const koperasiStock = productsKoperasi.reduce((s, p) => s + p.stock, 0);
  const warkopStock = productsWarkop.reduce((s, p) => s + p.stock, 0);

  const omzetFlyout: FlyoutData = {
    title: 'Omzet hari ini',
    total: 1000000,
    totalKind: 'rp',
    delta: '33,3% vs Sabtu',
    deltaTone: 'down',
    bars: omzet7Hari.map((d) => ({ label: d.day, value: d.value })),
    barsLabel: 'Omzet 7 hari terakhir',
  };

  const pesananFlyout: FlyoutData = {
    title: 'Pesanan hari ini',
    total: 24,
    totalKind: 'number',
    totalSuffix: 'pesanan',
    delta: '4 pesanan vs kemarin',
    deltaTone: 'up',
    bars: ['Baru', 'Disiapkan', 'Siap', 'Selesai'].map((s) => ({
      label: s,
      value: statusCounts[s] ?? 0,
    })),
    barsLabel: 'Pesanan per status',
  };

  const saldoFlyout: FlyoutData = {
    title: 'Saldo kas',
    total: 6150000,
    totalKind: 'rp',
    delta: 'Rp 18,45 jt masuk bulan ini',
    deltaTone: 'up',
    bars: categorySummary.map((c) => ({ label: c.category, value: c.value })),
    barsLabel: 'Rekap per kategori',
  };

  const katalogFlyout: FlyoutData = {
    title: 'Katalog',
    total: productsKoperasi.length + productsWarkop.length,
    totalKind: 'number',
    totalSuffix: 'produk',
    delta: '8 koperasi dan 8 warkop',
    deltaTone: 'flat',
    bars: [
      { label: 'Koperasi', value: koperasiStock },
      { label: 'Warkop', value: warkopStock },
    ],
    barsLabel: 'Stok per katalog',
  };

  const antreanFlyout: FlyoutData = {
    title: 'Antrean barista',
    total: baristaOrders.length,
    totalKind: 'number',
    totalSuffix: 'pesanan',
    delta: '1 draft ShopeeFood perlu dicek',
    deltaTone: 'flat',
    bars: ['Baru', 'Disiapkan', 'Siap'].map((s) => ({
      label: s,
      value: baristaCounts[s] ?? 0,
    })),
    barsLabel: 'Antrean per status',
  };

  const menus: Record<RoleKey, MenuItem[]> = {
    guest: [
      {
        id: 'katalog',
        to: '/pelanggan',
        label: 'Katalog',
        icon: <IconBag />,
        status: `${productsKoperasi.length + productsWarkop.length} produk`,
        flyout: katalogFlyout,
        children: [
          { to: '/pelanggan?tab=koperasi', label: 'Koperasi', status: `${productsKoperasi.length} produk` },
          { to: '/pelanggan?tab=warkop', label: 'Warkop', status: `${productsWarkop.length} produk` },
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
        status: 'Rp 1.000.000',
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
        status: 'Rp 6.150.000',
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
        status: `${txs.length} transaksi`,
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
        status: `${warkopCatalog.length} menu`,
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

  const handleLogout = () => {
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
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        setFlyoutId(null);
      }}
    >
      <div className="sidebar__brand">
        <span className="sidebar__logo">MBG</span>
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
            onClick={handleLogout}
            aria-label="Keluar"
            title="Keluar"
          >
            <IconLogout size={18} />
          </button>
        )}
      </div>

      {session && (
        <button type="button" className="sidebar-item__link sidebar-logout--mobile" onClick={handleLogout}>
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
