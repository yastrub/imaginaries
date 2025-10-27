import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Auth is now handled by Redux
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from './store';
import { setIsTerminalApp, setTerminalName } from './store/envSlice';
import { queryClient } from './lib/reactQuery';
import { AuthInitializer } from './components/AuthInitializer';
import { AppUnlocker } from './components/AppUnlocker';
import './styles/main.css';
try {
  const prevent = (e) => { e.preventDefault(); };
  document.addEventListener('selectstart', prevent);
  document.addEventListener('dragstart', prevent);
  document.addEventListener('contextmenu', prevent);
  const preventKbdMenu = (e) => {
    const key = e.key;
    const code = e.keyCode || e.which;
    if ((e.shiftKey && (key === 'F10' || code === 121)) || key === 'ContextMenu' || code === 93) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  document.addEventListener('keydown', preventKbdMenu, { capture: true });
} catch {}

try {
  const isTwaReferrer = document.referrer?.startsWith('android-app://com.octadiam.imaginarium');
  const sp = new URLSearchParams(location.search);
  const isTerminalFlag = sp.get('terminal') === '1';
  let isTerminalClass = false;
  let isTerminalLS = false;
  try { isTerminalClass = document.documentElement.classList.contains('terminal-app'); } catch {}
  try { isTerminalLS = (localStorage.getItem('terminal_app') === '1'); } catch {}
  const isTerminal = !!(isTwaReferrer || isTerminalFlag || isTerminalClass || isTerminalLS);
  store.dispatch(setIsTerminalApp(isTerminal));
} catch {}

try {
  if (window.__TERMINAL_NAME__) {
    store.dispatch(setTerminalName(String(window.__TERMINAL_NAME__)));
  }
  window.addEventListener('terminal:name', (e) => {
    const n = e?.detail?.name;
    if (typeof n === 'string') store.dispatch(setTerminalName(n));
  });
} catch {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <AppUnlocker>
          <App />
        </AppUnlocker>
      </AuthInitializer>
    </QueryClientProvider>
  </Provider>
);