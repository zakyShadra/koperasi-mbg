import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isLoggedIn } from '../lib/auth-session';

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
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

  return <>{children}</>;
}

export default RequireAuth;
