import { useEffect, useState } from 'react';
import './loader.css';

/**
 * PelangganLoader: teapot pouring coffee into a cup, flat SVG, no box or
 * card around the scene. One 2.6s cycle, synchronised: the teapot tilts
 * and pours, the coffee surface in the cup rises, drops spill onto the
 * saucer and form a puddle, steam rises in waves, the cup sways.
 *
 * Props:
 * - active: true while loading. The loader slides down from the top edge
 *   of the view when it turns true, hangs at the top while loading, and
 *   slides back up out of view when it turns false.
 * - text: free-floating label under the scene, defaults to
 *   "Memuat katalog...". No glass card behind it, readable via text shadow.
 * - onDone: called after the slide-up exit finishes (about 380ms after
 *   active turns false). Pass a stable reference if you use it.
 * - durationMs: accepted for callers that think in durations, but the
 *   loader itself never hides on a timer. The parent owns the duration
 *   and flips `active` off when loading really completes.
 */
export interface PelangganLoaderProps {
  active: boolean;
  text?: string;
  durationMs?: number;
  onDone?: () => void;
}

export function PelangganLoader({
  active,
  text = 'Memuat katalog...',
  durationMs: _durationMs,
  onDone,
}: PelangganLoaderProps) {
  const [mounted, setMounted] = useState(active);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let exitTimer: number | undefined;
    let raf = 0;
    if (active) {
      setMounted(true);
      raf = window.requestAnimationFrame(() => {
        raf = window.requestAnimationFrame(() => setShown(true));
      });
    } else if (mounted) {
      setShown(false);
      exitTimer = window.setTimeout(() => {
        setMounted(false);
        onDone?.();
      }, 380);
    }
    return () => {
      window.cancelAnimationFrame(raf);
      if (exitTimer !== undefined) window.clearTimeout(exitTimer);
    };
  }, [active, mounted, onDone]);

  if (!mounted) return null;

  return (
    <div
      className={`pelanggan-loader${shown ? ' is-visible' : ''}${!active ? ' is-exiting' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="loader-scene" aria-hidden="true">
        <svg viewBox="0 0 320 200" width="320" height="200">
          <g className="loader-steam">
            <path d="M178 102 q-7 -9 0 -17 q7 -8 0 -15" />
            <path d="M192 100 q7 -9 0 -17 q-7 -8 0 -15" />
            <path d="M206 102 q-7 -9 0 -17 q7 -8 0 -15" />
          </g>
          <g className="loader-teapot">
            <path className="teapot-handle" d="M46 88 C28 88 24 110 42 118" />
            <path
              className="teapot-body"
              d="M58 76 C40 82 34 98 40 114 C46 130 66 138 84 134 C100 130 108 116 104 100 C100 84 82 74 66 74 Z"
            />
            <path className="teapot-spout" d="M100 92 L140 102 L136 116 L96 108 Z" />
            <ellipse className="teapot-lid" cx="70" cy="74" rx="17" ry="6" />
            <circle className="teapot-knob" cx="70" cy="66" r="4" />
          </g>
          <path className="loader-stream" d="M138 110 Q148 114 155 122" />
          <g className="loader-cup">
            <rect
              className="loader-coffee"
              x="150"
              y="112"
              width="80"
              height="58"
              clipPath="url(#cup-clip)"
            />
            <path
              className="cup-body"
              d="M158 116 h64 l-7 42 a9 9 0 0 1 -9 8 h-32 a9 9 0 0 1 -9 -8 z"
            />
            <path className="cup-handle" d="M222 126 q20 3 14 19 q-4 11 -17 9" />
          </g>
          <circle className="loader-drop drop-a" cx="224" cy="122" r="3.5" />
          <circle className="loader-drop drop-b" cx="232" cy="126" r="2.5" />
          <ellipse className="loader-saucer" cx="190" cy="172" rx="60" ry="10" />
          <ellipse className="loader-puddle" cx="222" cy="172" rx="22" ry="4.5" />
          <defs>
            <clipPath id="cup-clip">
              <path d="M158 116 h64 l-7 42 a9 9 0 0 1 -9 8 h-32 a9 9 0 0 1 -9 -8 z" />
            </clipPath>
          </defs>
        </svg>
      </div>
      <p className="loader-text">{text}</p>
      <div className="loader-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
