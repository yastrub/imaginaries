import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useCallback } from 'react';
import { checkEmailConfirmation, checkAuthStatus, logout, setUser, updateAuthFromResponse, updateUserAndUnlockApp } from '../store/authSlice';
import { authService } from '../services/authService';

/**
 * Custom hook for accessing authentication state and actions
 * Provides a consistent interface for auth across the app
 */
export function useReduxAuth() {
  const dispatch = useDispatch();
  const { isAuthenticated, user, isLoading, error } = useSelector(state => state.auth);

  // No need to initialize auth state here anymore
  // AuthInitializer component handles this by dispatching checkAuthStatus
  
  // Disable the periodic check as it's causing issues
  // We'll rely on API responses to update auth state instead

  // Authentication methods
  const logoutUser = useCallback(() => {
    return authService.signOut();
  }, [dispatch]);
  
  const loginUser = useCallback(async (email, password) => {
    return authService.signIn(email, password);
  }, [dispatch]);
  
  const signupUser = useCallback(async (email, password, promoCode) => {
    return authService.signUp(email, password, promoCode);
  }, [dispatch]);
  
  // Data update methods
  const updateFromApiResponse = useCallback((data) => {
    dispatch(updateAuthFromResponse(data));
  }, [dispatch]);
  
  // Email confirmation methods
  const checkEmailConfirmationStatus = useCallback(() => {
    return dispatch(checkEmailConfirmation());
  }, [dispatch]);
  
  const resendConfirmation = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to resend confirmation email');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  return {
    // Auth state
    isAuthenticated,
    user,
    isLoading,
    error,
    isAppUnlocked: useSelector(state => state.auth.isAppUnlocked),
    isEmailConfirmed: user?.email_confirmed || false,
    
    // Auth methods
    logout: logoutUser,
    login: loginUser,
    signup: signupUser,
    register: signupUser, // Alias for compatibility
    
    // Auth state check method
    checkAuthState: useCallback(async () => {
      // Dispatch the checkAuthStatus action to make API call to /api/auth/me
      const result = await dispatch(checkAuthStatus()).unwrap();
      return { 
        success: !!result.user, 
        user: result.user || null 
      };
    }, [dispatch]),
    
    // User data methods
    setUser: useCallback((userData) => {
      dispatch(updateUserAndUnlockApp(userData));
    }, [dispatch]),
    updateUser: useCallback((userData) => {
      dispatch(updateUserAndUnlockApp(userData));
    }, [dispatch]),
    
    // Email confirmation methods
    checkEmailConfirmation: checkEmailConfirmationStatus,
    resendConfirmation,
    
    // Data update methods
    updateFromApiResponse,
    
    // For compatibility with existing code
    session: user ? { user } : null,
    checkAuth: () => ({ success: !!user })
    // Note: We now determine authentication solely by the presence of user object
  };
}
