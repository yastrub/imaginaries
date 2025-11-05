import { store } from '../store';
import { setUser, logout } from '../store/authSlice';
import { AUTH_PROVIDER } from '../auth/config';

/**
 * Authentication service functions
 * Handles login, signup, and logout operations
 */
export const authService = {
  /**
   * Sign in a user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} - Response with success status and user data or error
   */
  signIn: async (email, password) => {
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }

      // Update Redux store with user data
      store.dispatch(setUser(data.user));
      
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Sign up a new user
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} promoCode - Optional promo code
   * @returns {Promise<Object>} - Response with success status and user data or error
   */
  signUp: async (email, password, promoCode) => {
    try {
      // Ensure promoCode is properly formatted for the request
      const formattedPromoCode = promoCode ? promoCode.toLowerCase().trim() : null;
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, promoCode: formattedPromoCode }),
        credentials: 'include'
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      // Update Redux store with user data
      store.dispatch(setUser(data.user));
      
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Sign out the current user
   * @returns {Promise<Object>} - Response with success status or error
   */
  signOut: async () => {
    try {
      // If using Clerk, sign out there first to avoid re-signing via ClerkBridge
      if (AUTH_PROVIDER === 'clerk') {
        try { await window.Clerk?.signOut?.(); } catch {}
      }
      const response = await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to sign out');
      }

      // Update Redux store to clear user data
      store.dispatch(logout());
      
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  }
};
