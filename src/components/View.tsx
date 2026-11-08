import type { ReactNode } from 'react';

interface ViewProps {
  children: ReactNode;
}

// Pembungkus halaman: fade + slide up dari 12px, 350ms ease-out.
// Kartu di dalamnya memakai class .stagger dengan var --d untuk delay.
export function View({ children }: ViewProps) {
  return <div className="view-enter">{children}</div>;
}

export default View;
