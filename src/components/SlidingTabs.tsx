// Sliding tabs, pola 1 skill code-xr-motion: satu pill yang sama
// berjalan melintasi gap antar tab, diukur di JS, 250ms ease-in-out.

import { useLayoutEffect, useRef, useState } from 'react';

interface SlidingTabsProps {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}

export function SlidingTabs({
  options,
  value,
  onChange,
}: SlidingTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState({ x: 0, width: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const index = options.findIndex((o) => o.id === value);
      const btn = buttonRefs.current[index];
      const container = containerRef.current;
      if (!btn || !container) {
        return;
      }
      setPill({
        x: btn.offsetLeft,
        width: btn.offsetWidth,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [options, value]);

  return (
    <div className="tabs" ref={containerRef} role="tablist">
      <span
        className="tab-indicator"
        style={{ transform: `translateX(${pill.x}px)`, width: pill.width }}
        aria-hidden="true"
      />
      {options.map((option, index) => (
        <button
          key={option.id}
          ref={(el) => {
            buttonRefs.current[index] = el;
          }}
          type="button"
          role="tab"
          aria-selected={option.id === value}
          className={`tab-btn ${option.id === value ? 'tab-btn--active' : ''}`}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default SlidingTabs;
