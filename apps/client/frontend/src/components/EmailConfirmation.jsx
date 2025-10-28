import React, { useState, useEffect, useRef } from 'react';
import { useViewportOverlay } from '../hooks/useViewportOverlay';
import { useReduxAuth } from '../hooks/useReduxAuth';
import { useToast } from './ui/use-toast';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function EmailConfirmation() {
  const { logout, resendConfirmation, isEmailConfirmed, confirmEmail } = useReduxAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isResending, setIsResending] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const overlayStyle = useViewportOverlay();

  // Get user from Redux auth
  const { user } = useReduxAuth();
  
  // Only render and poll if we have a user and email is not confirmed
  // This prevents any processing for confirmed users
  if (!user || isEmailConfirmed) {
    return null;
  }

  // Poll for email confirmation status - only for unconfirmed users
  useEffect(() => {
    const pollInterval = 5000; // Poll every 5 seconds
    const pollTimer = setInterval(async () => {
      try {
        await confirmEmail();
        
        // If email got confirmed during polling, reload the page
        if (isEmailConfirmed) {
          window.location.reload();
        }
      } catch (error) {
        console.error('Error polling for email confirmation:', error);
      }
    }, pollInterval);

    return () => clearInterval(pollTimer);
  }, [confirmEmail, isEmailConfirmed]);

  const onResendConfirmation = async () => {
    if (isResending) return;
    
    setIsResending(true);
    try {
      const result = await resendConfirmation();
      if (result.success) {
        toast({
          title: "Confirmation email sent",
          description: "Please check your inbox and click the confirmation link.",
        });
      } else {
        throw new Error(result.error || 'Failed to send confirmation email');
      }
    } catch (error) {
      toast({
        title: "Failed to send confirmation email",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const onSignOut = async () => {
    if (isSigningOut) return;
    
    setIsSigningOut(true);
    try {
      await logout();
      navigate('/');
    } catch (error) {
      toast({
        title: "Failed to sign out",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setIsSigningOut(false);
    }
  };



  return (
    <div className="fixed bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]" style={overlayStyle}>
      <div className="w-full max-w-md mx-auto p-6 bg-zinc-900 rounded-xl shadow-xl">
        <h2 className="text-2xl font-bold text-white mb-4">
          Email Confirmation Required
        </h2>
        <p className="text-zinc-400 mb-2">
          A confirmation email has been sent to:
        </p>
        <p className="text-white font-medium mb-6">
          {user?.email}
        </p>
        <p className="text-zinc-400 mb-6">
          Please check your email and click the confirmation link to activate your account.
          You won't be able to use the application until your email is confirmed.
        </p>
        <div className="space-y-4">
          <button
            onClick={onResendConfirmation}
            disabled={isResending}
            className="w-full py-2 px-4 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 h-10"
          >
            {isResending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Resend confirmation email'
            )}
          </button>
          <button
            onClick={onSignOut}
            disabled={isSigningOut}
            className="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 h-10"
          >
            {isSigningOut ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing out...
              </>
            ) : (
              'Sign out'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}