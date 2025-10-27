// Simple QR modal using DOM. Avoids extra dependencies.
let qrOverlay = null;

export function showQrModal({ url, title = 'Scan to open', subtitle = '', hint = 'Use your phone camera', size = 512 } = {}) {
  try {
    if (!url) return;
    const encoded = encodeURIComponent(url);
    const px = Math.max(256, Math.min(size, 1024));
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${px}x${px}&data=${encoded}&margin=24&ecc=H`;

    if (qrOverlay) {
      try { qrOverlay.remove(); } catch {}
      qrOverlay = null;
    }

    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '100000';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

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
    close.onclick = () => { try { overlay.remove(); } catch {}; qrOverlay = null; };

    head.appendChild(h);
    head.appendChild(close);

    const note = document.createElement('div');
    note.textContent = subtitle || hint || '';
    note.style.opacity = '0.75';
    note.style.fontSize = '13px';
    note.style.margin = '2px 0 10px 0';

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.padding = '10px';

    const img = document.createElement('img');
    img.src = qrUrl;
    img.alt = 'QR Code';
    img.style.width = 'min(78vw, 420px)';
    img.style.height = 'auto';
    img.style.borderRadius = '12px';
    img.style.background = '#fff';
    img.style.padding = '12px';

    const link = document.createElement('div');
    link.textContent = url;
    link.style.marginTop = '12px';
    link.style.fontSize = '12px';
    link.style.color = '#a1a1aa';
    link.style.wordBreak = 'break-all';
    link.style.textAlign = 'center';

    const copy = document.createElement('button');
    copy.textContent = 'Copy Link';
    copy.style.marginTop = '8px';
    copy.style.background = '#111114';
    copy.style.border = '1px solid #27272a';
    copy.style.color = '#e4e4e7';
    copy.style.borderRadius = '10px';
    copy.style.height = '36px';
    copy.style.padding = '0 14px';
    copy.onclick = async () => { try { await navigator.clipboard.writeText(url); copy.textContent = 'Copied!'; setTimeout(()=> copy.textContent='Copy Link', 1200); } catch {} };

    wrap.appendChild(img);
    wrap.appendChild(link);
    wrap.appendChild(copy);

    panel.appendChild(head);
    panel.appendChild(note);
    panel.appendChild(wrap);

    overlay.appendChild(panel);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { try { overlay.remove(); } catch {}; qrOverlay = null; } });

    document.body.appendChild(overlay);
    qrOverlay = overlay;
  } catch {}
}
