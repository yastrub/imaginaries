// Auth configuration switch
// VITE_AUTH_PROVIDER: 'local' | 'clerk'
export const AUTH_PROVIDER = (import.meta.env.VITE_AUTH_PROVIDER || 'local').toLowerCase();
export const AUTH_MODE = (import.meta.env.VITE_AUTH_MODE || 'password').toLowerCase(); // 'password' | 'magic' | 'both'
export const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
