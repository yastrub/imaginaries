import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

// Static flags outside component to ensure they persist across all renders and component instances
// These are module-level variables that will be shared across all instances of this component
let hasConfirmationBeenAttempted = false;
let initialStatusSet = false;

/**
 * Email Confirmation Page
 * This page confirms a user's email address by sending the token to the server
 * It uses a one-time API call to prevent infinite loops
 */
export function EmailConfirmationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  // State for confirmation process
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [error, setError] = useState(null);
  const [forceUpdate, setForceUpdate] = useState(0); // Used to force re-renders
  
  // Simple function to return to the home page
  const handleReturn = () => {
    navigate('/', { replace: true });
  };
  
  // Use a ref to track initialization
  const isInitialized = React.useRef(false);
  
  // Set initial status in an effect that runs once
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      initialStatusSet = true;
      
      if (token) {
        console.log('Token found, setting initial loading state');
        setStatus('loading');
      } else {
        console.log('No token provided, setting idle state');
        setStatus('idle');
      }
    }
  }, [token]);

  // Super simple one-time effect that runs on mount
  useEffect(() => {
    // If we don't have a token or confirmation has already been attempted, do nothing
    if (!token || hasConfirmationBeenAttempted) {
      return;
    }
    
    // Force the loading state again just to be sure
    setStatus('loading');
    
    // Set the static flag immediately
    hasConfirmationBeenAttempted = true;
    
    // Add a small delay to ensure the loading state is visible
    // This helps with the UI transition
    setTimeout(() => {
      // Log the single request attempt
      console.log('Making ONE confirmation request with token:', token.substring(0, 8) + '...');
      
      // Make the API call
      fetch(`/api/auth/confirm-email?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      .then(response => {
        // Log the response status for debugging
        console.log('Response status:', response.status);
        
        // Store the status code for error handling
        const statusCode = response.status;
        
        // Parse the JSON response
        return response.json().then(data => {
          console.log('Response data:', data);
          
          // Return both the data and status code
          return { data, statusCode };
        });
      })
      .then(({ data, statusCode }) => {
        // Handle different status codes
        if (statusCode === 200) {
          // Success case
          console.log('Email confirmed successfully, setting success state');
          setStatus('success');
        } else {
          // Error case - handle directly instead of throwing
          console.log('Error response received:', { statusCode, error: data.error });
          
          // Update UI state based on status code
          setStatus('error');
          
          // Set appropriate error message
          if (statusCode === 400) {
            if (data.error && data.error.includes('already confirmed')) {
              setStatus('success');
              setError(null);
            } else if (data.error && data.error.includes('token is required')) {
              setError('No confirmation token provided. Please check your email link.');
            } else if (data.error && data.error.includes('Invalid confirmation token')) {
              setError('Invalid or expired confirmation token. Please request a new confirmation email.');
            } else {
              setError('Invalid request. Please try again with a valid confirmation link.');
            }
          } else if (statusCode === 401) {
            setError('Authentication required. Please sign in and try again.');
          } else if (statusCode === 404) {
            setError('Confirmation endpoint not found. Please contact support.');
          } else if (statusCode === 500) {
            setError('Server error. Please try again later or contact support.');
          } else {
            setError(data.error || 'Failed to confirm email. Please try again later.');
          }
          
          // Return false to indicate error
          return false;
        }
      })
      .catch(err => {
        // Log the full error for debugging
        console.error('Network or parsing error:', err);
        
        // Set error state
        setStatus('error');
        setError('Network error. Please check your connection and try again.');
        
        // Force a re-render by setting a state variable
        setForceUpdate(prev => prev + 1);
      });
    }, 500); // Small delay to ensure loading state is visible
    
    // Return cleanup function
    return () => {
      console.log('Cleanup function called');
    };
  }, [token]); // Include token in dependencies to ensure it's available
  
  // Debug current state and force UI updates
  useEffect(() => {
    console.log('Current status:', status);
    console.log('Current error:', error);
    console.log('Has token:', !!token);
    console.log('Has attempted confirmation:', hasConfirmationBeenAttempted);
    console.log('Force update counter:', forceUpdate);
    
    // Force a re-render if needed
    if (status === 'error' && !error) {
      setError('An unknown error occurred. Please try again.');
    }
  }, [status, error, token, forceUpdate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl p-8 max-w-md w-full text-center">
        {/* Only show status in development mode */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-zinc-600 mb-2">Status: {status}</div>
        )}
        
        {/* Loading state */}
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-6 animate-spin" />
            <h2 className="text-2xl font-semibold text-white mb-4">
              Confirming Your Email
            </h2>
            <p className="text-zinc-400 mb-8">
              Please wait while we confirm your email address...
            </p>
          </>
        )}
        
        {/* Success state */}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-white mb-4">
              Email Confirmed Successfully
            </h2>
            <p className="text-zinc-400 mb-8">
              Thank you for confirming your email. You can now return to the application and sign in.
            </p>
          </>
        )}
        
        {/* Error state */}
        {status === 'error' && (
          <>
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-white mb-4">
              Confirmation Failed
            </h2>
            <p className="text-zinc-400 mb-8">
              {error || 'There was a problem confirming your email. Please try again or contact support.'}
            </p>
          </>
        )}
        
        {/* Idle state - no token */}
        {status === 'idle' && !token && (
          <>
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-white mb-4">
              No Confirmation Token
            </h2>
            <p className="text-zinc-400 mb-8">
              No confirmation token was provided. Please check your email and click the confirmation link.
            </p>
          </>
        )}
        
        {/* Default state - when we have a token but no specific status yet */}
        {token && status === 'idle' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-6 animate-spin" />
            <h2 className="text-2xl font-semibold text-white mb-4">
              Starting Email Verification
            </h2>
            <p className="text-zinc-400 mb-8">
              Preparing to verify your email with token: {token.substring(0, 8)}...
            </p>
          </>
        )}
        
        <Button onClick={handleReturn} className="w-full">
          Return to Application
        </Button>
      </div>
    </div>
  );
}