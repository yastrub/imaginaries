import { useState, useCallback } from 'react';

/**
 * Custom hook for managing auth modal state
 * This follows the same pattern as our successful JewelryType hook
 */
export function useAuthModal() {
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
