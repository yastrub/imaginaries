import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// Auth is now handled by Redux
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from './store';
import { queryClient } from './lib/reactQuery';
import { AuthInitializer } from './components/AuthInitializer';
import { AppUnlocker } from './components/AppUnlocker';
import './styles/main.css';

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