import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

// ███████╗██████╗  ██╗   ██╗██████╗ ██╗      ██████╗ ██████╗ ██╗
// ██╔════╝██╔══██╗ ██║   ██║██╔════╝██║     ██╔═══██╗██╔══██╗██║
// ██║     ███████║ ██║   ██║█████╗  ██║     ██║   ██║██████╔╝██║
// ██║     ██╔══██║ ██║   ██║██╔══╝  ██║     ██║   ██║██╔══██╗╚═╝
// ███████╗██║  ██║ ╚██████╔╝███████╗███████╗██████╔╝██║  ██║██╗
// ╚══════╝╚═╝  ╚═╝  ╚═════╝ ╚══════╝╚══════╝╚═════╝ ╚═╝  ╚═╝╚═╝

// ██╗   ██╗ █████╗ ██████╗ ██████╗ ██╗██████╗ 
// ██║   ██║██╔══██╗██╔════╝██╔══██╗██║██╔════╝
// ██║   ██║██║  ██║█████╗  ██║  ██║██║█████╗  
// ██║   ██║██║  ██║╚════██╗██║  ██║██║╚════██╗
// ╚██████╔╝██████╔╝██████╔╝██████╔╝██║██████╔╝
//  ╚═════╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚═╝╚═════╝ 

// CRITICAL PERFORMANCE OPTIMIZATION:
// MODULE-LEVEL STATE PREVENTS DUPLICATE API CALLS!
//
// 1. NEVER USE COMPONENT STATE ALONE FOR API CALL TRACKING - It resets on remounts
// 2. ALWAYS USE MODULE-LEVEL VARIABLES - They persist across component lifecycles
// 3. RESET MODULE VARIABLES DURING HOT RELOADING - See the code at the bottom
//
// This pattern prevents duplicate API calls even when React remounts components
let globalConfirmationAttempted = false;

/**
 * PureConfirmation - A component that handles email confirmation with minimal dependencies
 * This component is designed to be mounted directly by React Router without any context providers
 */
export function PureConfirmation() {
  // Get navigation and URL parameters
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  // Component state
  const [state, setState] = React.useState({
    status: 'loading',
    errorMessage: null
  });
  
  // Confirmation logic in a ref to prevent re-creation on re-renders
  const confirmEmail = React.useRef(async () => {
    console.log('confirmEmail called, globalConfirmationAttempted:', globalConfirmationAttempted);
    
    // Skip if we've already attempted confirmation globally
    if (globalConfirmationAttempted) {
      console.log('Skipping confirmation - already attempted globally');
      return;
    }
    
    // Set the global flag immediately to prevent duplicate calls
    globalConfirmationAttempted = true;
    console.log('Set globalConfirmationAttempted to true');
    
    // Check if we have a token
    if (!token) {
      console.log('No token found');
      setState({
        status: 'error',
        errorMessage: 'No confirmation token provided. Please check your email link.'
      });
      return;
    }
    
    try {
      console.log('Making API request with token:', token.substring(0, 8) + '...');
      
      const response = await fetch(`/api/auth/confirm-email?token=${encodeURIComponent(token)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      console.log('Response received, status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);
      
      if (response.status === 200) {
        console.log('Email confirmed successfully');
        setState({
          status: 'success',
          errorMessage: null
        });
      } else if (response.status === 400) {
        if (data.error && data.error.includes('already confirmed')) {
          console.log('Email already confirmed');
          setState({
            status: 'success',
            errorMessage: null
          });
        } else {
          console.log('Error confirming email:', data.error);
          setState({
            status: 'error',
            errorMessage: data.error || 'Invalid confirmation token'
          });
        }
      } else {
        console.log('Unexpected response status:', response.status);
        setState({
          status: 'error',
          errorMessage: data.error || 'Failed to confirm email'
        });
      }
    } catch (err) {
      console.error('Confirmation error:', err);
      setState({
        status: 'error',
        errorMessage: 'Network error. Please try again later.'
      });
    }
  }).current;
  
  // Handle return to app
  const handleReturn = React.useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);
  
  // ██████╗ ██████╗ ██████╗ ██████╗ █████╗ ██████╗ 
  // ██╔═══╝ ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔════╝
  // █████╗  ██████╔╝█████╗  █████╗  ██║  ██║█████╗  
  // ██╔══╝  ██╔══╝  ██╔══╝  ██╔══╝  ██║  ██║╚════██╗
  // ██║     ██║     ██║     ██║     ██████╔╝██████╔╝
  // ╚═╝     ╚═╝     ╚═╝     ╚═╝     ╚═════╝ ╚═════╝ 
  //
  // CRITICAL PERFORMANCE OPTIMIZATION:
  // USE EMPTY DEPENDENCY ARRAY WITH CAREFUL REF MANAGEMENT!
  //
  // 1. KEEP YOUR EFFECT DEPENDENCIES MINIMAL - Empty array = run once only
  // 2. USE REF FOR FUNCTIONS INSIDE EFFECTS - Prevents recreation on re-renders
  // 3. COMBINE WITH MODULE-LEVEL FLAGS - Belt and suspenders approach
  //
  // This pattern ensures the effect runs exactly once, even with React's double-mounting
  React.useEffect(() => {
    console.log('PureConfirmation mounted');
    confirmEmail();
    
    // Reset the global flag when the component is unmounted
    return () => {
      console.log('PureConfirmation unmounted');
    };
  }, [confirmEmail]);
  
  // Destructure state for easier access
  const { status, errorMessage } = state;
  
  console.log('Rendering PureConfirmation with status:', status);
  
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
            <Button onClick={handleReturn} className="w-full">
              Return to Application
            </Button>
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
            <Button onClick={handleReturn} className="w-full">
              Return to Application
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ██████╗ ██████╗ ██╗   ██╗██████╗ 
// ██╔═══╝ ██╔════╝██║   ██║██╔════╝
// █████╗  █████╗  ██║   ██║█████╗  
// ╚════██╗╚════██╗╚█║   ██╔╚════██╗
// ██████╔╝██████╔╝ ╚█████╔╝ ██████╔╝
// ╚═════╝ ╚═════╝   ╚════╝  ╚═════╝ 
//
// CRITICAL PERFORMANCE OPTIMIZATION:
// ALWAYS RESET MODULE STATE DURING HOT RELOADING!
//
// 1. NEVER FORGET THIS CODE IN DEVELOPMENT - Module state persists between reloads
// 2. MODULE STATE MUST BE RESET - Otherwise you'll get stuck states during development
// 3. THIS IS DEVELOPMENT-ONLY CODE - It won't run in production
//
// This ensures clean development experience with proper state resets
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('Hot module replacement - resetting confirmation state');
    globalConfirmationAttempted = false;
  });
}
