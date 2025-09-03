import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// Create the context
const AuthModalContext = createContext();

// Create the provider component
export function AuthModalProvider({ children }) {
  // State for auth modal
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  // Open auth modal
  const openAuthModal = useCallback(() => {
    setIsAuthModalOpen(true);
  }, []);
  
  // Close auth modal
  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);
  
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal
  }), [isAuthModalOpen, openAuthModal, closeAuthModal]);
  
  return (
    <AuthModalContext.Provider value={value}>
      {children}
    </AuthModalContext.Provider>
  );
}

// Custom hook to use the context
export function useAuthModal() {
  const context = useContext(AuthModalContext);
  if (!context) {
    throw new Error('useAuthModal must be used within an AuthModalProvider');
  }
  return context;
}
