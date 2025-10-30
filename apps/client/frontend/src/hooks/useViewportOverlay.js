import { useEffect, useState } from 'react';

export function useViewportOverlay() {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    let rafId = null;
    const commit = (next) => {
      setRect((prev) => {
        if (!prev) return next;
        if (
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width &&
          prev.height === next.height
        ) return prev;
        return next;
      });
    };
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const vv = typeof window !== 'undefined' ? window.visualViewport : null;
        if (vv) {
          commit({ top: vv.offsetTop || 0, left: vv.offsetLeft || 0, width: vv.width || window.innerWidth, height: vv.height || window.innerHeight });
        } else {
          commit({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
        }
      });
    };
    schedule();
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv) {
      vv.addEventListener('resize', schedule);
      vv.addEventListener('scroll', schedule);
    }
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (vv) {
        vv.removeEventListener('resize', schedule);
        vv.removeEventListener('scroll', schedule);
      }
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
    };
  }, []);
  if (!rect) return { position: 'fixed', inset: 0 };
  return { position: 'fixed', top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}
