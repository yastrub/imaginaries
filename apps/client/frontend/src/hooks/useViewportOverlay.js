import { useEffect, useState } from 'react';

export function useViewportOverlay() {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    const update = () => {
      const vv = typeof window !== 'undefined' ? window.visualViewport : null;
      if (vv) {
        setRect({ top: vv.offsetTop || 0, left: vv.offsetLeft || 0, width: vv.width || window.innerWidth, height: vv.height || window.innerHeight });
      } else {
        setRect({ top: 0, left: 0, width: window.innerWidth, height: window.innerHeight });
      }
    };
    update();
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  if (!rect) return { position: 'fixed', inset: 0 };
  return { position: 'fixed', top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}
