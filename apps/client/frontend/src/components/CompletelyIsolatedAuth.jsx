import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { useReduxAuth } from '../hooks/useReduxAuth';
import { useToast } from './ui/use-toast';
import { cn } from '@/lib/utils';
import { Provider } from 'react-redux';
import { store } from '../store';
import { TermsOfUseModal } from './TermsOfUseModal';
import { useViewportOverlay } from '../hooks/useViewportOverlay';
import { AUTH_PROVIDER } from '../auth/config';
import { SignInButton } from '@clerk/clerk-react';

/**
 * A completely isolated auth component that manages its own state
 * and doesn't depend on any parent components
 */
const CompletelyIsolatedAuthComponent = memo(function CompletelyIsolatedAuthComponent() {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [error, setError] = useState(null);
  const [portalElement, setPortalElement] = useState(null);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [resetRequestSuccess, setResetRequestSuccess] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  // Refs
  const formRef = useRef(null);
  
  // Auth - use Redux directly instead of the old context
  const { login, register, logout, isAuthenticated, user, isEmailConfirmed, checkAuthState, setUser, resendConfirmation } = useReduxAuth();
  const { toast } = useToast();
  const overlayStyle = useViewportOverlay();
  
  // Create portal element
  useEffect(() => {
    // Create a div for the modal portal
    let element = document.getElementById('isolated-auth-modal');
    if (!element) {
      element = document.createElement('div');
      element.id = 'isolated-auth-modal';
      document.body.appendChild(element);
    }
    setPortalElement(element);

    // Cleanup
    return () => {
      if (element && element.parentNode === document.body) {
        document.body.removeChild(element);
      }
    };
  }, []);
  
  // Callbacks
  const openModal = useCallback(() => {
    // Check if promo code exists in localStorage and set to signup mode if it does
    const promoCode = localStorage.getItem('promo_code');
    if (promoCode && promoCode.trim()) {
      console.log('Promo code found in localStorage, opening in signup mode:', promoCode);
      setIsSignUp(true);
    }
    setIsOpen(true);
  }, []);
  
  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);
  
  const shakeForm = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 820);
  }, []);
  
  // Get promo code from localStorage if available
  const getPromoCode = useCallback(() => {
    return localStorage.getItem('promo_code') || '';
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (loading) return;
    
    // Check if terms are accepted for signup
    if (isSignUp && !acceptedTerms) {
      setError('You must accept the Terms of Service to create an account');
      shakeForm();
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    // Get promo code from localStorage if signing up
    // Ensure it's properly formatted and non-empty
    let promoCode = null;
    if (isSignUp) {
      const storedCode = getPromoCode();
      if (storedCode && storedCode.trim()) {
        promoCode = storedCode.trim().toLowerCase();
      }
    }

    try {
      // We're going to handle authentication manually to prevent any state updates
      // that might cause the modal to close
      
      // Determine which API endpoint to use
      const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/signin';
      
      // Use Redux auth functions directly
      const result = isSignUp 
        ? await register(email, password, promoCode)
        : await login(email, password);
      
      if (!result.success) {
        throw new Error(result.error || (isSignUp ? 'Failed to create account' : 'Authentication failed'));
      }

      // Check if email confirmation is required
      if (result.requiresConfirmation) {
        // Show email confirmation screen
        setShowEmailConfirmation(true);
        return;
      }
      
      // Close the modal
      closeModal();
      
      // Show success toast
      toast({
        title: isSignUp ? 'Account created successfully' : 'Signed in successfully',
        description: 'Welcome to Imaginaries!',
      });
      
      // Instead of forcing a page reload, we'll use a more robust approach to update auth state
      console.log('Authentication successful, updating auth state');
      
      // First, directly update the auth state with the user data we already have
      if (result.user) {
        setUser(result.user);
      }
      
      // Then, call checkAuthState to ensure everything is in sync
      await checkAuthState();
      
      // Add a small delay to ensure state updates have propagated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Dispatch a custom event to notify all components that auth state has changed
      // Use a unique ID to help prevent duplicate handling
      const eventId = Date.now();
      const authChangeEvent = new CustomEvent('auth-state-changed', { 
        detail: { 
          authenticated: true,
          isAuthenticated: true,
          user: result.user || 'unknown',
          eventId: eventId
        }
      });
      
      // Only dispatch the event once
      console.log(`Dispatching auth change event with ID: ${eventId}`);
      window.dispatchEvent(authChangeEvent);
      // Prompt any quota UI to refresh immediately
      try { window.dispatchEvent(new CustomEvent('quota-refresh')); } catch {}
      
      // Log the current auth state to help with debugging
      console.log('Current auth state after sign in:', { user, isEmailConfirmed });
    } catch (error) {
      // Handle errors locally without causing parent re-renders
      console.error('Auth error:', error);
      setError(error.message);
      shakeForm();
      
      // IMPORTANT: Don't close the modal on error
      // This keeps the form state intact
    } finally {
      setLoading(false);
    }
  }, [loading, isSignUp, login, register, email, password, closeModal, shakeForm, toast, getPromoCode, acceptedTerms]);
  
  // Poll for email confirmation status
  useEffect(() => {
    if (!showEmailConfirmation) return;
    
    const pollForConfirmation = async () => {
      try {
        setIsPolling(true);
        // Use the checkAuthState method from useReduxAuth
        const result = await checkAuthState();
        
        if (result.user && result.user.email_confirmed) {
          // Email is confirmed, reload the page
          console.log('Email confirmed, reloading page');
          window.location.reload();
        }
      } catch (error) {
        console.error('Error polling for email confirmation:', error);
      } finally {
        setIsPolling(false);
      }
    };

    // Poll immediately and then every 5 seconds
    pollForConfirmation();
    const pollInterval = 5000; // Poll every 5 seconds
    const pollTimer = setInterval(pollForConfirmation, pollInterval);
    
    return () => clearInterval(pollTimer);
  }, [showEmailConfirmation, checkAuthState]);
  
  // ███████╗████████╗ ██████╗ ██████╗     ██╗
  // ██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗    ██║
  // ███████╗   ██║   ██║   ██║██████╔╝    ██║
  // ╚════██║   ██║   ██║   ██║██╔═══╝     ╚═╝
  // ███████║   ██║   ╚██████╔╝██║         ██╗
  // ╚══════╝   ╚═╝    ╚═════╝ ╚═╝         ╚═╝
  //   
  // CRITICAL AUTH FLOW FIX:
  // ALWAYS CHECK FOR UNCONFIRMED USERS AND SHOW THE MODAL!
  //
  // 1. REMOVED THE isOpen DEPENDENCY - This was preventing the modal from showing
  // 2. AUTOMATICALLY OPEN THE MODAL - When user is logged in but not confirmed
  // 3. SET THE EMAIL FROM SESSION - So the user knows which email to check
  //
  // This ensures the confirmation modal always appears for unconfirmed users
  useEffect(() => {
    // Check if user is logged in but email is not confirmed
    if (isAuthenticated && user && !isEmailConfirmed) {
      console.log('User logged in but not confirmed, showing confirmation modal');
      
      // Set email from user data
      if (user?.email) {
        setEmail(user.email);
      }
      
      // Show email confirmation screen and open the modal
      setShowEmailConfirmation(true);
      setIsOpen(true);  // This is the key fix - always open the modal!
    }
  }, [isAuthenticated, user, isEmailConfirmed, setEmail]);

  // Expose methods to window - CRITICAL FIX
  useEffect(() => {
    // Create global interface with additional method for email confirmation
    window.IsolatedAuth = {
      open: openModal,
      close: closeModal,
      // New method to open modal directly to confirmation screen
      openWithConfirmation: (userEmail) => {
        console.log('Opening auth modal with confirmation screen for:', userEmail);
        // Set the email if provided
        if (userEmail) {
          setEmail(userEmail);
        }
        // Show email confirmation screen
        setShowEmailConfirmation(true);
        // Open the modal
        setIsOpen(true);
      }
    };
    
    console.log('Auth modal interface created with confirmation support');
    
    // Cleanup
    return () => {
      delete window.IsolatedAuth;
      console.log('Auth modal interface removed');
    };
  }, [openModal, closeModal]);
  
  // Handle resend confirmation email
  const handleResendConfirmation = useCallback(async () => {
    if (isResending) return;
    
    setIsResending(true);
    try {
      // Use the resendConfirmation method from useReduxAuth
      const result = await resendConfirmation();
      
      // Check if the response is successful
      if (!result.success) {
        throw new Error(result.error || 'Failed to resend confirmation email');
      }
      
      // If we got here, the request was successful
      toast({
        title: "Confirmation email sent",
        description: "Please check your inbox and click the confirmation link.",
      });
    } catch (error) {
      console.error('Error resending confirmation:', error);
      toast({
        title: "Failed to send confirmation email",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  }, [isResending, toast, resendConfirmation]);
  
  // Handle sign out
  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    
    setIsSigningOut(true);
    try {
      // Make a direct API call to sign out
      await logout();
      
      // Force a page reload to update the auth state
      window.location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Failed to sign out",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setIsSigningOut(false);
    }
  }, [isSigningOut, toast, logout]);

  // Don't render anything if not open or no portal element
  if (!isOpen || !portalElement) return null;
  
  // Render the modal in the portal
  return ReactDOM.createPortal(
    <div className="fixed bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]" style={overlayStyle}>
      <div className="w-full max-w-md mx-auto p-6 bg-zinc-900 rounded-xl shadow-xl relative">
        {!showEmailConfirmation && (
          <Button
            variant="ghost"
            size="icon"
            onClick={closeModal}
            className="absolute right-4 top-4 text-zinc-400 hover:text-white"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </Button>
        )}

        {showEmailConfirmation ? (
          <>
            <h2 className="text-2xl font-bold text-white mb-4">
              Email Confirmation Required
            </h2>
            <p className="text-zinc-400 mb-2">
              A confirmation email has been sent to:
            </p>
            <p className="text-white font-medium mb-6">
              {email}
            </p>
            <p className="text-zinc-400 mb-6">
              Please check your email and click the confirmation link to activate your account.
              You won't be able to use the application until your email is confirmed.
            </p>
            <div className="space-y-4">
              <Button
                onClick={handleResendConfirmation}
                disabled={isResending || isPolling}
                className="w-full h-10 gap-2"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Resend confirmation email'
                )}
              </Button>
              <Button
                onClick={handleSignOut}
                disabled={isSigningOut || isPolling}
                variant="outline"
                className="w-full h-10 gap-2"
              >
                {isSigningOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing out...
                  </>
                ) : (
                  'Sign out'
                )}
              </Button>
            </div>
          </>
        ) : isForgotPassword ? (
          <>
            <h2 className="text-2xl font-bold text-white mb-6">
              Reset Your Password
            </h2>
            
            {resetRequestSuccess ? (
              <div className="text-center">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <p className="text-zinc-400 mb-6">
                  We've sent a password reset link to <span className="text-white font-medium">{email}</span>.
                  Please check your email and follow the instructions to reset your password.
                </p>
                <p className="text-xs text-zinc-500 mb-6">
                  If you don't receive an email within a few minutes, please check your spam folder or try again.
                </p>
                <Button
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetRequestSuccess(false);
                  }}
                  className="w-full h-10"
                >
                  Back to Sign In
                </Button>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                    {error}
                  </div>
                )}
                
                <p className="text-zinc-400 mb-4">
                  Enter your email address below and we'll send you a link to reset your password.
                </p>
                
                <form 
                  ref={formRef}
                  className={cn(
                    "space-y-4",
                    isShaking && "animate-shake"
                  )}
                  onSubmit={async (e) => {
                  e.preventDefault();
                  if (isRequestingReset) return;
                  
                  // Validate email format
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!emailRegex.test(email)) {
                    setError('Please enter a valid email address');
                    return;
                  }
                  
                  setIsRequestingReset(true);
                  setError(null);
                  
                  try {
                    const response = await fetch('/api/auth/forgot-password', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ email }),
                      credentials: 'include'
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                      setResetRequestSuccess(true);
                    } else {
                      // Show the specific error from the server
                      setError(data.error || 'Failed to process your request. Please try again later.');
                      
                      // Shake the form to draw attention to the error
                      if (formRef.current) {
                        setIsShaking(true);
                        setTimeout(() => setIsShaking(false), 820);
                      }
                    }
                  } catch (error) {
                    console.error('Password reset request error:', error);
                    setError('Network error. Please try again later.');
                  } finally {
                    setIsRequestingReset(false);
                  }
                }}>
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-medium text-zinc-400 mb-1">
                      Email address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white disabled:opacity-50"
                      required
                      disabled={isRequestingReset}
                    />
                  </div>
                  
                  <div className="flex space-x-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setError(null);
                      }}
                      disabled={isRequestingReset}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    
                    <Button
                      type="submit"
                      disabled={isRequestingReset}
                      className="flex-1 gap-2"
                    >
                      {isRequestingReset ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send Reset Link'
                      )}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white mb-6">
              {isSignUp ? 'Create an account' : 'Sign in to your account'}
            </h2>

            {AUTH_PROVIDER === 'clerk' ? (
              <div className="space-y-3">
                <SignInButton mode="modal" afterSignInUrl="/imagine" afterSignUpUrl="/imagine">
                  <Button className="w-full h-10 gap-2">Continue</Button>
                </SignInButton>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                    {error}
                  </div>
                )}

                <form 
                  ref={formRef}
                  onSubmit={handleSubmit} 
                  className={cn(
                    "space-y-4 transition-transform",
                    isShaking && "animate-shake"
                  )}
                >
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-1">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white disabled:opacity-50"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-zinc-400 mb-1">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white disabled:opacity-50"
                      required
                      disabled={loading}
                    />
                  </div>

                  {isSignUp && getPromoCode() && (
                    <div>
                      <label htmlFor="promoCode" className="block text-sm font-medium text-zinc-400 mb-1">
                        Promo Code
                      </label>
                      <input
                        id="promoCode"
                        type="text"
                        defaultValue={getPromoCode()}
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white disabled:opacity-50"
                        disabled={loading}
                        readOnly
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Promo code will be applied during signup
                      </p>
                    </div>
                  )}

                  {!isSignUp && (
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (loading) return;
                          setIsForgotPassword(true);
                          setError(null);
                        }}
                        className="text-xs text-zinc-400 hover:text-primary transition-colors"
                        disabled={loading}
                      >
                        Forgot your password?
                      </button>
                    </div>
                  )}

                  {isSignUp && (
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                        <input
                          id="terms"
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(e) => setAcceptedTerms(e.target.checked)}
                          disabled={loading}
                          className="w-4 h-4 text-primary bg-zinc-800 border-zinc-700 rounded focus:ring-primary focus:ring-2"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="terms" className="text-zinc-400">
                          I agree to the{' '}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowTermsModal(true);
                            }}
                            className="text-primary hover:underline focus:outline-none"
                          >
                            Terms of Service
                          </button>
                        </label>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-10 gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isSignUp ? 'Creating account...' : 'Signing in...'}
                      </>
                    ) : (
                      isSignUp ? 'Sign up' : 'Sign in'
                    )}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <button
                    onClick={() => {
                      if (loading) return;
                      setIsSignUp(!isSignUp);
                      setError(null);
                    }}
                    className="text-zinc-400 hover:text-white text-sm disabled:opacity-50"
                    disabled={loading}
                  >
                    {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
        
        {/* Terms of Use Modal */}
        {showTermsModal && (
          <TermsOfUseModal
            onClose={() => {
              setShowTermsModal(false);
              setAcceptedTerms(true);
            }}
          />
        )}

      </div>
    </div>,
    portalElement
  );
});

// Export the component
export const CompletelyIsolatedAuth = memo(CompletelyIsolatedAuthComponent);

// Helper function to open the auth modal from anywhere
export function openAuthModal() {
  console.log('Opening auth modal...', window.IsolatedAuth);
  
  // Check if the interface exists
  if (window.IsolatedAuth && typeof window.IsolatedAuth.open === 'function') {
    console.log('Auth modal interface found, opening...');
    window.IsolatedAuth.open();
    return true;
  }
  
  // If interface is not available, create a new auth modal instance
  console.warn('Auth modal interface not found, creating a new instance');
  
  // Create a fallback element if needed
  let element = document.getElementById('isolated-auth-modal');
  if (!element) {
    element = document.createElement('div');
    element.id = 'isolated-auth-modal';
    document.body.appendChild(element);
  }
  
  // Render the auth component into the element with Redux Provider
  const authRoot = ReactDOM.createRoot(element);
  authRoot.render(
    <Provider store={store}>
      <CompletelyIsolatedAuth />
    </Provider>
  );
  
  // Try again after a short delay
  setTimeout(() => {
    if (window.IsolatedAuth && typeof window.IsolatedAuth.open === 'function') {
      window.IsolatedAuth.open();
    } else {
      console.error('Failed to create auth modal interface');
    }
  }, 100);
}

// Helper function to close the auth modal from anywhere
export function closeAuthModal() {
  if (window.IsolatedAuth && window.IsolatedAuth.close) {
    window.IsolatedAuth.close();
  }
}
