import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getSession, homeForRole, isLoggedIn } from '../lib/auth-session';
import type { StaffRole } from '../lib/auth-session';

interface RequireAuthProps {
  children: ReactNode;
  roles?: StaffRole[];
}

export function RequireAuth({ children, roles }: RequireAuthProps) {
  const location = useLocation();

  if (!isLoggedIn()) {
    return (
      <Navigate
        to="/kprmbg20asdf"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  if (roles && roles.length > 0) {
    const session = getSession();
    if (!session || !roles.includes(session.role)) {
      return (
        <Navigate to={homeForRole(session?.role ?? '')} replace />
      );
    }
  }

  return <>{children}</>;
}

export default RequireAuth;
