import { useReduxAuth } from '../hooks/useReduxAuth';

/**
 * This is a compatibility wrapper around useAuth
 * It exists only for backward compatibility with existing code
 * All authentication is now handled by the useReduxAuth hook
 */
export function useStableAuth() {
  // Simply return the result of useReduxAuth
  // This ensures existing code continues to work
  return useReduxAuth().logout();
}

// Export the signOut function from useReduxAuth for backward compatibility
export const signOut = () => {
  console.warn('Direct import of signOut from useStableAuth is deprecated. Use useReduxAuth().logout instead.');
  const { logout } = useReduxAuth();
  return logout();
};
