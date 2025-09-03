import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';

// Module-level variable to track reset attempts across component remounts
// This ensures we only make one API call even if the component remounts
let hasResetAttempted = false;

/**
 * PasswordResetPage - A component for handling password reset
 */
export function PasswordResetPage() {
  // Navigation and URL parameters
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  // Component state
  const [status, setStatus] = useState('verifying'); // verifying, ready, submitting, success, error
  const [errorMessage, setErrorMessage] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Track if we've already attempted verification
  const hasVerified = useRef(false);
  
  // Return to home page
  const handleReturn = () => {
    navigate('/', { replace: true });
  };
  
  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };
  
  // Verify the token when component mounts
  React.useEffect(() => {
    // Skip if we've already verified
    if (hasVerified.current) {
      console.log('Skipping token verification - already verified');
      return;
    }
    
    // Set the flag to prevent duplicate verification
    hasVerified.current = true;
    
    // Check if we have a token
    if (!token) {
      console.log('No token found');
      setStatus('error');
      setErrorMessage('No reset token provided. Please check your email link.');
      return;
    }
    
    const verifyToken = async () => {
      try {
        console.log('Verifying token:', token.substring(0, 8) + '...');
        
        const response = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        
        console.log('Response received, status:', response.status);
        const data = await response.json();
        
        if (response.ok) {
          console.log('Token verified successfully');
          setStatus('ready');
        } else {
          console.log('Error verifying token:', data.error);
          setStatus('error');
          setErrorMessage(data.error || 'Invalid or expired reset token');
        }
      } catch (err) {
        console.error('Token verification error:', err);
        setStatus('error');
        setErrorMessage('Network error. Please try again later.');
      }
    };
    
    verifyToken();
  }, [token]);
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Skip if we're already submitting
    if (status === 'submitting') {
      return;
    }
    
    // Validate passwords
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      return;
    }
    
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    
    // Reset error message and set submitting state
    setErrorMessage(null);
    setStatus('submitting');
    
    try {
      console.log('Submitting password reset');
      
      // Add a small delay to ensure the submitting state is visible
      // This prevents the flash of empty content
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, password }),
        credentials: 'include'
      });
      
      console.log('Response received, status:', response.status);
      const data = await response.json();
      
      if (response.ok) {
        console.log('Password reset successful');
        // Add a small delay before showing success to ensure smooth transition
        await new Promise(resolve => setTimeout(resolve, 300));
        setStatus('success');
      } else {
        console.log('Error resetting password:', data.error);
        setStatus('error');
        setErrorMessage(data.error || 'Failed to reset password');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setStatus('error');
      setErrorMessage('Network error. Please try again later.');
    }
  };
  
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl p-8 max-w-md w-full text-center">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-6 animate-spin" />
            <h2 className="text-2xl font-semibold text-white mb-4">
              Verifying Reset Link
            </h2>
            <p className="text-zinc-400 mb-8">
              Please wait while we verify your password reset link...
            </p>
          </>
        )}
        
        {status === 'submitting' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-6 animate-spin" />
            <h2 className="text-2xl font-semibold text-white mb-4">
              Resetting Your Password
            </h2>
            <p className="text-zinc-400 mb-8">
              Please wait while we update your password...
            </p>
          </>
        )}
        
        {status === 'ready' && (
          <>
            <h2 className="text-2xl font-semibold text-white mb-6">
              Reset Your Password
            </h2>
            
            {errorMessage && (
              <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                {errorMessage}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-zinc-400 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white pr-10"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-zinc-500">Password must be at least 8 characters long</p>
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-400 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white pr-10"
                    required
                  />
                </div>
              </div>
              
              <Button
                type="submit"
                className="w-full mt-6"
                disabled={status === 'submitting'}
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-white mb-4">
              Password Reset Successful
            </h2>
            <p className="text-zinc-400 mb-8">
              Your password has been successfully reset. You can now return to the application and sign in with your new password.
            </p>
            <Button onClick={handleReturn} className="w-full">
              Return to Application
            </Button>
          </>
        )}
        
        {status === 'error' && (
          <>
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-white mb-4">
              Password Reset Failed
            </h2>
            <p className="text-zinc-400 mb-8">
              {errorMessage || 'There was a problem resetting your password. Please try again or contact support.'}
            </p>
            <Button onClick={handleReturn} className="w-full">
              Return to Application
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// Reset the module state when the module is hot-reloaded during development
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('Hot module replacement - resetting password reset state');
    hasResetAttempted = false;
  });
}
