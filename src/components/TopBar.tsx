import { useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clearSession, getSession } from '../lib/auth-session';
import type { Session } from '../lib/auth-session';
import { IconLogout } from './icons';

const NAV_ITEMS = [
  { to: '/manager', label: 'Manager' },
  { to: '/finance', label: 'Finance' },
  { to: '/barista', label: 'Barista' },
  { to: '/pelanggan', label: 'Pelanggan' },
];

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(() => getSession());
  const navRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ x: 0, width: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const index = NAV_ITEMS.findIndex((item) => item.to === location.pathname);
      const link = linkRefs.current[index];
      if (!link) {
        return;
      }
      setIndicator({ x: link.offsetLeft, width: link.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [location.pathname, session]);

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleLogout = () => {
    clearSession();
    setSession(null);
    navigate('/pelanggan');
  };

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo">MBG</span>
        <span className="topbar__title">{title}</span>
      </div>
      <span className="topbar__date">{today}</span>

      {session ? (
        <>
          <nav className="topnav" ref={navRef} aria-label="Peran">
            <span
              className="topnav__indicator"
              style={{
                transform: `translateX(${indicator.x}px)`,
                width: indicator.width,
              }}
              aria-hidden="true"
            />
            {NAV_ITEMS.map((item, index) => (
              <NavLink
                key={item.to}
                ref={(el) => {
                  linkRefs.current[index] = el;
                }}
                to={item.to}
                className={({ isActive }) =>
                  `topnav__link ${isActive ? 'topnav__link--active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar__user">
            <span className="user-chip">
              <span className="user-chip__email">{session.email}</span>
              <span className="user-chip__role">{session.role}</span>
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLogout}
            >
              <IconLogout size={16} />
              Keluar
            </button>
          </div>
        </>
      ) : null}
    </header>
  );
}

export default TopBar;
