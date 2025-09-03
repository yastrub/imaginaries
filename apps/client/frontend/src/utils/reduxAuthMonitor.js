import { store } from '../store';
import { updateAuthFromResponse, updateUserAndUnlockApp, logout } from '../store/authSlice';

/**
 * Updates the Redux auth state from API responses
 * This function is now only used for backward compatibility
 * The main authentication is handled by the checkAuthStatus thunk
 * @param {Object} data - API response data that might contain user information
 */
export function updateReduxAuthFromApiResponse(data) {
  // We no longer need to extract user data from regular API responses
  // Authentication is now handled by a dedicated call to /api/auth/me
  // This function is kept for backward compatibility
  console.log('updateReduxAuthFromApiResponse: This function is deprecated');
  
  return false;
}

/**
 * Middleware function for fetch requests to handle 401 responses
 * @param {Function} fetchFn - The original fetch function
 * @returns {Function} - Enhanced fetch function that handles 401 responses
 */
export function createAuthAwareFetch(fetchFn = fetch) {
  return async function authAwareFetch(url, options = {}) {
    // CRITICAL FIX: Prevent duplicate API calls
    // Add cache busting to prevent duplicates for GET requests
    if ((!options.method || options.method === 'GET') && !url.includes('_cb=')) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}_cb=${Date.now()}`;
      console.log('authAwareFetch: Added cache busting to URL:', url);
    }
    
    try {
      const response = await fetchFn(url, options);
      
      // Check for authentication-related status codes
      if (response.status === 401) {
        console.log('authAwareFetch: Got 401 response, immediately logging out user');
        // Immediately clear user data and authentication state
        store.dispatch(logout());
        
        // Try to delete the token cookie client-side (may not work for HttpOnly cookies)
        try {
          document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
          console.log('authAwareFetch: Attempted to clear token cookie client-side');
        } catch (e) {
          console.log('authAwareFetch: Unable to clear token cookie client-side');
        }
      }
      
      return response;
    } catch (error) {
      // Network error or other fetch error
      console.error('authAwareFetch: Network error', error);
      throw error;
    }
  };
}
