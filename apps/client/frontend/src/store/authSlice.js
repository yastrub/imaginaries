import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
// No longer checking cookies - we rely solely on API responses

/**
 * Async thunk to check authentication status and get user data
 * This is now our primary method for getting authentication status
 */
export const checkAuthStatus = createAsyncThunk(
  'auth/checkAuthStatus',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      console.log('checkAuthStatus: Fetching authentication status from /api/auth/me');
      
      // Make API call to get authentication status
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        // If response is 401, clear the token cookie to prevent infinite loops
        if (response.status === 401) {
          console.log('checkAuthStatus: Received 401 Unauthorized, clearing token cookie');
          document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        }
        
        // If response is not OK, user is not authenticated
        console.log(`checkAuthStatus: Not authenticated (${response.status})`);
        return { isAuthenticated: false, user: null };
      }
      
      const data = await response.json();
      console.log('checkAuthStatus: Received user data', data);
      return data;
    } catch (error) {
      console.error('checkAuthStatus error:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Async thunk to check email confirmation status
 * This is used specifically for polling email confirmation
 */
export const checkEmailConfirmation = createAsyncThunk(
  'auth/checkEmailConfirmation',
  async (_, { rejectWithValue }) => {
    try {
      console.log('checkEmailConfirmation: Polling for email confirmation status');
      
      // Use the dedicated endpoint for checking email confirmation
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to check email confirmation');
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('checkEmailConfirmation error:', error);
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Function to check if user is authenticated based on Redux store
 * This is a simple utility function to check if we have a user object in the store
 */
export function isUserAuthenticated(state) {
  return state && state.auth && state.auth.user !== null;
}

/**
 * Function to handle 401 unauthorized responses
 * This will clear the auth state and attempt to clear the token cookie
 */
export function handleUnauthorized() {
  return logout();
}

/**
 * Auth slice for Redux store
 * Manages authentication state across the app
 */
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    // Initial authentication state will be determined by API responses
    isAuthenticated: false,
    user: null,
    // Start with app locked - we'll unlock after checking auth status
    isAppUnlocked: false,
    isLoading: true, // Start with loading state
    error: null,
    isEmailConfirmed: false
  },
  reducers: {
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      // Clear cookie on logout
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      // Dispatch event for legacy components
      window.dispatchEvent(new CustomEvent('auth-state-changed', {
        detail: { isAuthenticated: false }
      }));
    },
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      // Dispatch event for legacy components
      window.dispatchEvent(new CustomEvent('auth-state-changed', {
        detail: { isAuthenticated: true, user: action.payload }
      }));
    },
    updateAuthFromResponse: (state, action) => {
      const { isAuthenticated, user } = action.payload;
      state.isAuthenticated = isAuthenticated;
      if (user) {
        state.user = user;
        // When we get user data, unlock the app
        state.isAppUnlocked = true;
        // Notify listeners about auth state change
        try { window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { isAuthenticated: true, user } })); } catch {}
      } else if (isAuthenticated === false) {
        // Notify listeners about logout/unauthenticated state
        try { window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { isAuthenticated: false } })); } catch {}
      }
    },
    
    // Action to update user data and unlock the app
    updateUserAndUnlockApp: (state, action) => {
      state.user = action.payload;
      state.isAppUnlocked = true;
      // If we have user data, we're definitely authenticated
      state.isAuthenticated = true;
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle auth status check
      .addCase(checkAuthStatus.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.user) {
          state.user = action.payload.user;
          state.isAuthenticated = true;
          state.isAppUnlocked = true;
          state.isEmailConfirmed = action.payload.user.email_confirmed || false;
          // Notify listeners about login/authenticated state
          try { window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { isAuthenticated: true, user: action.payload.user } })); } catch {}
        } else {
          state.user = null;
          state.isAuthenticated = false;
          state.isAppUnlocked = true; // Unlock app even if not authenticated
          // Notify listeners about unauthenticated state
          try { window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { isAuthenticated: false } })); } catch {}
        }
      })
      .addCase(checkAuthStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
        state.user = null; // Ensure user is cleared on rejection
        state.isAppUnlocked = true; // Unlock app even if there's an error
        // Notify listeners about unauthenticated/error state
        try { window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: { isAuthenticated: false } })); } catch {}
      })
      
      // Handle email confirmation check
      .addCase(checkEmailConfirmation.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkEmailConfirmation.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload.user) {
          state.user = action.payload.user;
          state.isAuthenticated = true;
          state.isEmailConfirmed = action.payload.user.email_confirmed || false;
        }
      })
      .addCase(checkEmailConfirmation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // We don't need any extra reducers for initial auth state
      // The initial state is already set based on cookie presence
      // and user data comes from API responses
  }
});

// Export slice actions
export const { logout, setUser, updateAuthFromResponse, updateUserAndUnlockApp } = authSlice.actions;

// Export the thunks directly - no re-export to avoid duplication
// setInitialAuthState and checkEmailConfirmation are already exported above
export default authSlice.reducer;
