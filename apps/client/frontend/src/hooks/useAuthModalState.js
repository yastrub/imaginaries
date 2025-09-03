import { useState, useCallback } from 'react';

/**
 * Custom hook for managing auth modal state
 * Following the same pattern as the jewelry type selection
 */
export function useAuthModalState() {
  // State for modal visibility
  const [isOpen, setIsOpen] = useState(false);
  
  // Memoized open function
  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);
  
  // Memoized close function
  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);
  
  return {
    isOpen,
    openModal,
    closeModal
  };
}
