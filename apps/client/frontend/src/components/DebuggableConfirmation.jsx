import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { RenderDebugger } from './RenderDebugger';

// Module-level variables to persist across component remounts
// This is crucial for handling React Strict Mode's double mounting
let hasConfirmationBeenAttempted = false;
let confirmationRequestCount = 0;
let isStrictMode = process.env.NODE_ENV === 'development';

/**
 * DebuggableConfirmation
 * A component for email confirmation with render debugging
 */
function ConfirmationComponent() {
  // Basic state management
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  // Component instance counter to detect remounts
  const componentInstanceId = React.useRef(Math.random().toString(36).substring(2, 9));
  
  // Return to home page
  const handleReturn = () => {
    navigate('/', { replace: true });
  };
  
  // Log component lifecycle
  console.log(`Rendering ConfirmationComponent with status: ${status}, token: ${token?.substring(0, 8)}...`);
  
  // One-time effect to confirm email
  useEffect(() => {
    console.log(`Effect running in instance ${componentInstanceId.current}, hasAttempted:`, hasConfirmationBeenAttempted);
    console.log(`Total confirmation requests so far: ${confirmationRequestCount}`);
    
    // Only run once across all component instances
    if (hasConfirmationBeenAttempted) {
      console.log('Skipping confirmation - already attempted globally');
      return;
    }
    
    // Set the module-level flag to prevent future attempts
    console.log('Setting global hasConfirmationBeenAttempted to true');
    hasConfirmationBeenAttempted = true;
    
    // Check if we have a token
    if (!token) {
      console.log('No token found, setting error state');
      setStatus('error');
      setErrorMessage('No confirmation token provided. Please check your email link.');
      return;
    }
    
    // Confirm the email
    const confirmEmail = async () => {
      // Increment the request counter
      confirmationRequestCount++;
      const thisRequestNumber = confirmationRequestCount;
      
      try {
        console.log(`Request #${thisRequestNumber}: Confirming email with token:`, token.substring(0, 8) + '...');
        
        // If we're in Strict Mode and this isn't the first request, simulate the response
        // This prevents actual duplicate API calls in development
        if (isStrictMode && thisRequestNumber > 1) {
          console.log(`Request #${thisRequestNumber}: SIMULATED in Strict Mode to prevent duplicate API calls`);
          
          // Wait a bit to simulate network delay
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Use the same logic as below to update state
          if (thisRequestNumber === 2) { // Only process the second request in strict mode
            setStatus('error');
            setErrorMessage('Invalid confirmation token (Simulated in Strict Mode)');
          }
          return;
        }
        
        const response = await fetch(`/api/auth/confirm-email?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        console.log(`Request #${thisRequestNumber}: Response received, status:`, response.status);
        const data = await response.json();
        console.log(`Request #${thisRequestNumber}: Response data:`, data);
        
        if (response.status === 200) {
          console.log('Setting success state');
          setStatus('success');
        } else if (response.status === 400) {
          if (data.error && data.error.includes('already confirmed')) {
            console.log('Email already confirmed, setting success state');
            setStatus('success');
          } else {
            console.log('Setting error state:', data.error);
            setStatus('error');
            setErrorMessage(data.error || 'Invalid confirmation token');
          }
        } else {
          console.log('Setting error state for non-200/400 response');
          setStatus('error');
          setErrorMessage(data.error || 'Failed to confirm email');
        }
      } catch (err) {
        console.error('Confirmation error:', err);
        setStatus('error');
        setErrorMessage('Network error. Please try again later.');
      }
    };
    
    console.log('Calling confirmEmail function');
    confirmEmail();
    
    // Cleanup function
    return () => {
      console.log(`Effect cleanup called for instance ${componentInstanceId.current}`);
    };
  }, []); // Empty dependency array ensures this runs once per component instance
  
  // Render based on status
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl p-8 max-w-md w-full text-center">
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
        
        {status === 'error' && (
          <>
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-white mb-4">
              Confirmation Failed
            </h2>
            <p className="text-zinc-400 mb-8">
              {errorMessage || 'There was a problem confirming your email. Please try again or contact support.'}
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

// Reset the module variables when the component is first imported
// This ensures a clean state if the module is hot-reloaded during development
if (module.hot) {
  module.hot.dispose(() => {
    console.log('Hot module replacement - resetting confirmation state');
    hasConfirmationBeenAttempted = false;
    confirmationRequestCount = 0;
  });
}

// Wrap the component with RenderDebugger
export const DebuggableConfirmation = () => {
  console.log('Rendering DebuggableConfirmation wrapper, strict mode:', isStrictMode);
  
  return (
    <RenderDebugger name="EmailConfirmation" trackProps={true}>
      <ConfirmationComponent />
    </RenderDebugger>
  );
};
