import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

/**
 * StandaloneEmailConfirmation
 * A completely isolated component for email confirmation with minimal dependencies
 * This component makes a single API call and doesn't interact with any other part of the app
 */
export function StandaloneEmailConfirmation() {
  // Basic state management
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  // Track if we've already attempted confirmation
  const hasAttempted = React.useRef(false);
  
  // Return to home page
  const handleReturn = () => {
    navigate('/', { replace: true });
  };
  
  // One-time effect to confirm email
  useEffect(() => {
    // Only run once
    if (hasAttempted.current) return;
    hasAttempted.current = true;
    
    // Check if we have a token
    if (!token) {
      setStatus('error');
      setErrorMessage('No confirmation token provided. Please check your email link.');
      return;
    }
    
    // Confirm the email
    const confirmEmail = async () => {
      try {
        console.log('Confirming email with token:', token.substring(0, 8) + '...');
        
        const response = await fetch(`/api/auth/confirm-email?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.status === 200) {
          setStatus('success');
        } else if (response.status === 400) {
          if (data.error && data.error.includes('already confirmed')) {
            setStatus('success');
          } else {
            setStatus('error');
            setErrorMessage(data.error || 'Invalid confirmation token');
          }
        } else {
          setStatus('error');
          setErrorMessage(data.error || 'Failed to confirm email');
        }
      } catch (err) {
        console.error('Confirmation error:', err);
        setStatus('error');
        setErrorMessage('Network error. Please try again later.');
      }
    };
    
    confirmEmail();
  }, []); // Empty dependency array ensures this runs once
  
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
