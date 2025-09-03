import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { checkAuthStatus } from '../store/authSlice';

/**
 * AuthInitializer component
 * Initializes authentication state by making a dedicated API call to /api/auth/me
 * This component should be rendered at the root level of the application
 */
export function AuthInitializer({ children }) {
  const dispatch = useDispatch();
  
  const { isLoading, error } = useSelector(state => state.auth);

  // Check authentication status on mount - but only once
  useEffect(() => {
    console.log('AuthInitializer: Checking authentication status');
    
    // Use a flag in sessionStorage to prevent multiple auth checks in case of errors
    const authCheckFlag = sessionStorage.getItem('auth_check_in_progress');
    
    if (authCheckFlag === 'true') {
      console.log('AuthInitializer: Auth check already in progress, skipping');
      return;
    }
    
    // Set the flag before making the request
    sessionStorage.setItem('auth_check_in_progress', 'true');
    
    // Dispatch the checkAuthStatus action to make API call to /api/auth/me
    dispatch(checkAuthStatus())
      .then(() => {
        // Clear the flag on success
        sessionStorage.removeItem('auth_check_in_progress');
      })
      .catch(() => {
        // Clear the flag on error and clear the token cookie
        sessionStorage.removeItem('auth_check_in_progress');
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      });
  }, []);
  
  // Render children
  return <>{children}</>;
}
