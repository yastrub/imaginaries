import React, { memo } from 'react';
import { Auth } from './Auth';
import { useToast } from './ui/use-toast';

/**
 * A completely isolated auth modal component
 * This follows the same pattern as our successful JewelryTypeBadges component
 */
const IsolatedAuthModalComponent = ({ isOpen, onClose }) => {
  const { toast } = useToast();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <Auth 
        onClose={onClose} 
        toast={toast}
      />
    </div>
  );
};

// Wrap in memo to prevent unnecessary re-renders
export const IsolatedAuthModal = memo(IsolatedAuthModalComponent);
