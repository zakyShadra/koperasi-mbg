import type { CSSProperties, ReactNode } from 'react';

interface GlassCardProps {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function GlassCard({
  className = '',
  style,
  children,
}: GlassCardProps) {
  return (
    <div className={`glass-card ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

export default GlassCard;
