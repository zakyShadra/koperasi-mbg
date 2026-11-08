import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import TopBar from '../components/TopBar';
import Sidebar from '../components/Sidebar';
import RequireAuth from '../components/RequireAuth';
import Login from '../pages/Login';
import Manager from '../pages/Manager';
import ManagerPesanan from '../pages/ManagerPesanan';
import ManagerLaporan from '../pages/ManagerLaporan';
import Finance from '../pages/Finance';
import FinanceTransaksiBaru from '../pages/FinanceTransaksiBaru';
import Barista from '../pages/Barista';
import BaristaKatalog from '../pages/BaristaKatalog';
import Pelanggan from '../pages/Pelanggan';
import CartPage from '../pages/CartPage';
import CheckoutPage from '../pages/CheckoutPage';
import TrackerPage from '../pages/TrackerPage';
import { appBase } from '../lib/app-base';

const TITLES: Record<string, string> = {
  '/manager': 'Dashboard manager',
  '/manager/pesanan': 'Pesanan',
  '/manager/laporan': 'Laporan',
  '/finance': 'Keuangan',
  '/finance/transaksi-baru': 'Tambah transaksi',
  '/barista': 'Barista',
  '/barista/katalog': 'Katalog warkop',
  '/pelanggan': 'Katalog koperasi dan warkop',
  '/pelanggan/keranjang': 'Keranjang',
  '/pelanggan/checkout': 'Checkout',
  '/pelanggan/lacak': 'Lacak pesanan',
  '/kprmbg20asdf': 'Masuk staff',
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith('/pelanggan/lacak/')) return 'Lacak pesanan';
  return 'Koperasi MBG';
}

function Layout() {
  const location = useLocation();
  const title = titleFor(location.pathname);
  const isLogin = location.pathname === '/kprmbg20asdf';

  return (
    <div className={isLogin ? 'app-shell app-shell--bare' : 'app-shell'}>
      {!isLogin && <Sidebar />}
      {!isLogin && <TopBar title={title} />}
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/pelanggan" replace />} />
          <Route path="/pelanggan" element={<Pelanggan />} />
          <Route path="/pelanggan/keranjang" element={<CartPage />} />
          <Route path="/pelanggan/checkout" element={<CheckoutPage />} />
          <Route path="/pelanggan/lacak" element={<TrackerPage />} />
          <Route path="/pelanggan/lacak/:orderNumber" element={<TrackerPage />} />
          <Route
            path="/manager"
            element={
              <RequireAuth roles={['manager']}>
                <Manager />
              </RequireAuth>
            }
          />
          <Route
            path="/manager/pesanan"
            element={
              <RequireAuth roles={['manager']}>
                <ManagerPesanan />
              </RequireAuth>
            }
          />
          <Route
            path="/manager/laporan"
            element={
              <RequireAuth roles={['manager']}>
                <ManagerLaporan />
              </RequireAuth>
            }
          />
          <Route
            path="/finance"
            element={
              <RequireAuth roles={['manager', 'finance']}>
                <Finance />
              </RequireAuth>
            }
          />
          <Route
            path="/finance/transaksi-baru"
            element={
              <RequireAuth roles={['manager', 'finance']}>
                <FinanceTransaksiBaru />
              </RequireAuth>
            }
          />
          <Route
            path="/barista"
            element={
              <RequireAuth roles={['manager', 'barista']}>
                <Barista />
              </RequireAuth>
            }
          />
          <Route
            path="/barista/katalog"
            element={
              <RequireAuth roles={['manager', 'barista']}>
                <BaristaKatalog />
              </RequireAuth>
            }
          />
          <Route path="/kprmbg20asdf" element={<Login />} />
          <Route path="*" element={<Navigate to="/pelanggan" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter basename={appBase() || "/"}>
      <Layout />
    </BrowserRouter>
  );
}
