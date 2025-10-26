import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Auth is now handled by Redux
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from './store';
import { setIsTerminalApp } from './store/envSlice';
import { queryClient } from './lib/reactQuery';
import { AuthInitializer } from './components/AuthInitializer';
import { AppUnlocker } from './components/AppUnlocker';
import './styles/main.css';

// Global hardening: disable selection, drag, and context menu across the app
try {
  const prevent = (e) => { e.preventDefault(); };
  document.addEventListener('selectstart', prevent);
  document.addEventListener('dragstart', prevent);
  document.addEventListener('contextmenu', prevent);
} catch {}

// Detect terminal environment (TWA or explicit startUrl flag) and set global state
try {
  const isTwaReferrer = document.referrer?.startsWith('android-app://com.octadiam.imaginarium');
  const sp = new URLSearchParams(location.search);
  const isTerminalFlag = sp.get('terminal') === '1';
  store.dispatch(setIsTerminalApp(!!(isTwaReferrer || isTerminalFlag)));
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