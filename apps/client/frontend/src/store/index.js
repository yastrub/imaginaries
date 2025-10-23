import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import quotaReducer from './quotaSlice';

/**
 * Redux store configuration
 * Centralizes all application state
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    quota: quotaReducer
  },
  // Enable Redux DevTools in development
  devTools: import.meta.env.DEV
});

// Reset store during development for HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('HMR: Resetting Redux store');
  });
}
