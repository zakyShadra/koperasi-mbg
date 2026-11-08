import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import TopBar from '../components/TopBar';
import RequireAuth from '../components/RequireAuth';
import Login from '../pages/Login';
import Manager from '../pages/Manager';
import Finance from '../pages/Finance';
import Barista from '../pages/Barista';
import Pelanggan from '../pages/Pelanggan';

const TITLES: Record<string, string> = {
  '/manager': 'Dashboard manager',
  '/finance': 'Keuangan',
  '/barista': 'Barista',
  '/pelanggan': 'Katalog koperasi dan warkop',
  '/kprmbg20asdf': 'Masuk staff',
};

function Layout() {
  const location = useLocation();
  const title = TITLES[location.pathname] ?? 'Koperasi MBG';

  return (
    <>
      <TopBar title={title} />
      <main className="app-content">
        <Routes>
          <Route path="/" element={<Navigate to="/pelanggan" replace />} />
          <Route path="/pelanggan" element={<Pelanggan />} />
          <Route
            path="/manager"
            element={
              <RequireAuth>
                <Manager />
              </RequireAuth>
            }
          />
          <Route
            path="/finance"
            element={
              <RequireAuth>
                <Finance />
              </RequireAuth>
            }
          />
          <Route
            path="/barista"
            element={
              <RequireAuth>
                <Barista />
              </RequireAuth>
            }
          />
          <Route path="/kprmbg20asdf" element={<Login />} />
          <Route path="*" element={<Navigate to="/pelanggan" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter basename="/koperasi-mbg">
      <Layout />
    </BrowserRouter>
  );
}
