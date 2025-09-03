import React, { memo } from 'react';
import { Auth } from './Auth';
import { useToast } from './ui/use-toast';
import { useAuthModal } from '../contexts/AuthModalContext';

// Use memo to prevent unnecessary re-renders
const AuthModalPortalComponent = memo(() => {
  const { toast } = useToast();
  const { isAuthModalOpen, closeAuthModal } = useAuthModal();
  
  // Don't render anything if the modal is closed
  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
      <Auth 
        onClose={closeAuthModal} 
        toast={toast}
      />
    </div>
  );
});

export const AuthModalPortal = AuthModalPortalComponent;
