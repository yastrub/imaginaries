// Simple QR modal using DOM. Avoids extra dependencies.
let qrOverlay = null;

export function showQrModal({ url, title = 'Scan to open', subtitle = '', hint = 'Use your phone camera', size = 512, showLink = true } = {}) {
  try {
    if (!url) return;
    const encoded = encodeURIComponent(url);
    const px = Math.max(256, Math.min(size, 1024));
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${px}x${px}&data=${encoded}&margin=24&ecc=H`;

    if (qrOverlay) {
      try { qrOverlay._cleanup && qrOverlay._cleanup(); } catch {}
      try { qrOverlay.remove(); } catch {}
      qrOverlay = null;
    }

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.zIndex = '100000';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    // Follow the visual viewport (Android address bar hide/show)
    const applyViewportRect = () => {
      try {
        const vv = window.visualViewport;
        if (vv) {
          overlay.style.top = (vv.offsetTop || 0) + 'px';
          overlay.style.left = (vv.offsetLeft || 0) + 'px';
          overlay.style.width = (vv.width || window.innerWidth) + 'px';
          overlay.style.height = (vv.height || window.innerHeight) + 'px';
        } else {
          overlay.style.top = '0px';
          overlay.style.left = '0px';
          overlay.style.width = '100vw';
          overlay.style.height = '100vh';
        }
      } catch {}
    };
    applyViewportRect();

    // Attach listeners while overlay is open
    const vv = window.visualViewport;
    const onVVResize = () => applyViewportRect();
    const onVVScroll = () => applyViewportRect();
    const onWinResize = () => applyViewportRect();
    const onOrientation = () => applyViewportRect();
    if (vv) {
      vv.addEventListener('resize', onVVResize);
      vv.addEventListener('scroll', onVVScroll);
    }
    window.addEventListener('resize', onWinResize);
    window.addEventListener('orientationchange', onOrientation);

    // Cleanup function to remove listeners on close
    overlay._cleanup = () => {
      try {
        if (vv) {
          vv.removeEventListener('resize', onVVResize);
          vv.removeEventListener('scroll', onVVScroll);
        }
        window.removeEventListener('resize', onWinResize);
        window.removeEventListener('orientationchange', onOrientation);
      } catch {}
    };

    const panel = document.createElement('div');
    panel.style.background = '#0b0b0f';
    panel.style.border = '1px solid #27272a';
    panel.style.borderRadius = '20px';
    panel.style.width = 'min(92vw, 560px)';
    panel.style.padding = '24px';
    panel.style.color = '#e4e4e7';
    panel.style.boxShadow = '0 20px 60px rgba(0,0,0,0.6)';

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.alignItems = 'center';
    head.style.justifyContent = 'space-between';
    head.style.marginBottom = '12px';

    const h = document.createElement('div');
    h.textContent = title;
    h.style.fontSize = '18px';
    h.style.fontWeight = '700';

    const close = document.createElement('button');
    close.textContent = 'Close';
    close.style.background = '#18181b';
    close.style.border = '1px solid #3f3f46';
    close.style.color = '#fff';
    close.style.borderRadius = '10px';
    close.style.height = '36px';
    close.style.padding = '0 14px';
    close.onclick = () => { try { overlay._cleanup && overlay._cleanup(); } catch {} try { overlay.remove(); } catch {}; qrOverlay = null; };

    head.appendChild(h);
    head.appendChild(close);

    const noteTop = document.createElement('div');
    noteTop.textContent = '';
    noteTop.style.margin = '0';

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.padding = '10px';

    // Spinner keyframes (scoped)
    const styleEl = document.createElement('style');
    styleEl.textContent = `@keyframes qrspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    overlay.appendChild(styleEl);

    // Fixed-size square box to prevent layout shift
    const box = document.createElement('div');
    box.style.width = 'min(78vw, 420px)';
    box.style.aspectRatio = '1 / 1';
    box.style.borderRadius = '12px';
    box.style.background = '#fff';
    box.style.padding = '12px';
    box.style.display = 'flex';
    box.style.alignItems = 'center';
    box.style.justifyContent = 'center';
    box.style.overflow = 'hidden';

    const spinner = document.createElement('div');
    spinner.style.width = '56px';
    spinner.style.height = '56px';
    spinner.style.border = '4px solid rgba(0,0,0,0.1)';
    spinner.style.borderTop = '4px solid rgba(0,0,0,0.55)';
    spinner.style.borderRadius = '50%';
    spinner.style.animation = 'qrspin 1s linear infinite';

    // Image element (hidden until loaded)
    const img = document.createElement('img');
    img.alt = 'QR Code';
    img.style.display = 'none';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '8px';

    box.appendChild(spinner);
    box.appendChild(img);

    wrap.appendChild(box);
    if (showLink) {
      const link = document.createElement('div');
      link.textContent = url;
      link.style.marginTop = '12px';
      link.style.fontSize = '12px';
      link.style.color = '#a1a1aa';
      link.style.wordBreak = 'break-all';
      link.style.textAlign = 'center';
      wrap.appendChild(link);
    }

    panel.appendChild(head);
    panel.appendChild(noteTop);
    panel.appendChild(wrap);

    // Subtitle under QR
    if (subtitle || hint) {
      const note = document.createElement('div');
      note.textContent = subtitle || hint;
      note.style.opacity = '0.85';
      note.style.fontSize = '14px';
      note.style.textAlign = 'center';
      note.style.margin = '14px 0 6px 0';
      panel.appendChild(note);
    }

    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { try { overlay._cleanup && overlay._cleanup(); } catch {} try { overlay.remove(); } catch {}; qrOverlay = null; } });

    document.body.appendChild(overlay);
    qrOverlay = overlay;

    // Load QR after DOM is in place to ensure spinner shows
    img.onload = () => {
      spinner.style.display = 'none';
      img.style.display = 'block';
    };
    img.onerror = () => {
      spinner.style.display = 'none';
      const err = document.createElement('div');
      err.textContent = 'Failed to load QR. Open the link below on your phone.';
      err.style.color = '#ef4444';
      err.style.fontSize = '12px';
      err.style.textAlign = 'center';
      err.style.position = 'absolute';
      err.style.bottom = '8px';
      err.style.left = '0';
      err.style.right = '0';
      err.style.opacity = '0.9';
      box.appendChild(err);
    };
    // Set src last to trigger load
    img.src = qrUrl;
  } catch {}
}
