# Mobile Strategy: PWA + Native Shell (iOS & Android)

Deliver a near‑native Admin experience using a Next.js PWA wrapped by thin native shells. Most UI ships via web; native shells add device features, app‑store presence, and native look/feel.

- Core UI: Next.js (App Router) PWA
- Distribution: Web PWA + iOS (Capacitor) + Android (Capacitor or TWA)
- Brand: Use primary purple for theme, status bar, splash, and accent actions

## 1) Architecture

- Web (core): Next.js PWA, installable, offline-aware, safe caching.
- Native shells:
  - iOS: Capacitor (WKWebView) pointing to Admin URL; plugins for Haptics, Push, Files, Biometric.
  - Android: Capacitor (recommended) OR Trusted Web Activity (TWA) for pure-PWA route.

Benefits:
- Single UI codebase
- Native APIs where needed (push, files, biometrics)
- App‑store distribution and deep links

## 2) PWA Foundation (Admin)

Files/Dirs:
- `apps/admin/public/manifest.webmanifest`
- `apps/admin/public/icons/*` (maskable 192/512, `apple-touch-icon.png`)
- `apps/admin/public/.well-known/assetlinks.json` (Android TWA only)
- `apps/admin/src/app/layout.tsx` (Next Metadata)
- [apps/admin/next.config.mjs](cci:7://file:///Users/god/Code/imaginaries/apps/admin/next.config.mjs:0:0-0:0) (next-pwa)
- `apps/admin/src/app/offline/page.tsx` (optional)

### 2.1 Manifest

`apps/admin/public/manifest.webmanifest`:
```json
{
  "name": "Imaginaries Admin",
  "short_name": "Admin",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#6f42c1",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable any" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable any" }
  ]
}
```

### 2.2 Next Metadata in 

`apps/admin/src/app/layout.tsx`:
```tsx
export const metadata = {
  title: "Imaginaries Admin",
  description: "Admin console",
  manifest: "/manifest.webmanifest",
  themeColor: "#6f42c1",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Imaginaries Admin"
  }
};
```

### 2.3 next-pwa Configuration

`apps/admin/next.config.mjs`:
```js
import withPWA from 'next-pwa';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig = { reactStrictMode: true };

export default isProd
  ? withPWA({
      dest: 'public',
      register: true,
      skipWaiting: true,
      disable: false,
      runtimeCaching: [
        { // Next static assets
          urlPattern: /^https:\/\/.*\/_next\/static\/.*/i,
          handler: 'CacheFirst',
          options: { cacheName: 'next-static', expiration: { maxEntries: 50, maxAgeSeconds: 2592000 } }
        },
        { // Fonts
          urlPattern: /^https:\/\/fonts\.(gstatic|googleapis)\.com\/.*/i,
          handler: 'CacheFirst',
          options: { cacheName: 'fonts', expiration: { maxEntries: 30, maxAgeSeconds: 31536000 } }
        },
        { // Images/CDN
          urlPattern: /\/(images|img|cdn)\/.*/i,
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'images' }
        },
        { // HTML/navigation – prefer fresh admin UI
          urlPattern: ({ request }) => request.mode === 'navigate',
          handler: 'NetworkFirst',
          options: { cacheName: 'pages', networkTimeoutSeconds: 3 }
        },
        { // EXCLUDE APIs/auth from SW cache
          urlPattern: /\/api\/.*/i,
          handler: 'NetworkOnly'
        }
      ]
    })(nextConfig)
  : nextConfig;
```

### 2.4 Offline Page

`apps/admin/src/app/offline/page.tsx`:
```tsx
import { Offline } from 'next-pwa/app';

export default function OfflinePage() {
  return <Offline />;
}
```

### 3) Native Shells (iOS & Android) Implementation

```tsx
const config = {
  appId: "com.imaginaries.admin",
  appName: "Imaginaries Admin",
  webDir: "dist",
  server: {
    url: "https://admin.imaginaries.app",
    cleartext: false
  }
};
export default config;
```

This is for Android. For iOS, use Capacitor instead.
