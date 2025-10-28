import React, { memo } from 'react';
import { useViewportOverlay } from '../hooks/useViewportOverlay';
import { Auth } from './Auth';
import { useToast } from './ui/use-toast';
import { useAuthModal } from '../contexts/AuthModalContext';

// Use memo to prevent unnecessary re-renders
const AuthModalPortalComponent = memo(() => {
  const { toast } = useToast();
  const { isAuthModalOpen, closeAuthModal } = useAuthModal();
  const overlayStyle = useViewportOverlay();
  
  // Don't render anything if the modal is closed
  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]" style={overlayStyle}>
      <Auth 
        onClose={closeAuthModal} 
        toast={toast}
      />
    </div>
  );
});

export const AuthModalPortal = AuthModalPortalComponent;
