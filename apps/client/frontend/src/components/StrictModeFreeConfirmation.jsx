import React from 'react';
//import { useNavigate, useSearchParams } from 'react-router-dom';
//import { CheckCircle2 } from 'lucide-react';
//import { Button } from './ui/button';

/**
 * StrictModeFreeConfirmation
 * A class-based component that completely bypasses React's hooks and re-rendering issues
 */
class ConfirmationComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      status: 'loading',
      errorMessage: null
    };
    
    // Get the token from URL params
    this.token = props.token;
    this.navigate = props.navigate;
    
    // Flag to track if confirmation has been attempted
    this.hasAttemptedConfirmation = false;
    
    console.log('ConfirmationComponent constructed with token:', this.token?.substring(0, 8) + '...');
  }
  
  componentDidMount() {
    console.log('ConfirmationComponent mounted');
    this.confirmEmail();
  }
  
  handleReturn = () => {
    this.navigate('/', { replace: true });
  };
  
  async confirmEmail() {
    // Only attempt confirmation once
    if (this.hasAttemptedConfirmation) {
      console.log('Already attempted confirmation, skipping');
      return;
    }
    
    this.hasAttemptedConfirmation = true;
    console.log('Attempting confirmation with token:', this.token?.substring(0, 8) + '...');
    
    // Check if we have a token
    if (!this.token) {
      console.log('No token found');
      this.setState({
        status: 'error',
        errorMessage: 'No confirmation token provided. Please check your email link.'
      });
      return;
    }
    
    try {
      console.log('Making API request to confirm email');
      const response = await fetch(`/api/auth/confirm-email?token=${encodeURIComponent(this.token)}`, {
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
        this.setState({ status: 'success' });
      } else if (response.status === 400) {
        if (data.error && data.error.includes('already confirmed')) {
          console.log('Email already confirmed');
          this.setState({ status: 'success' });
        } else {
          console.log('Error confirming email:', data.error);
          this.setState({
            status: 'error',
            errorMessage: data.error || 'Invalid confirmation token'
          });
        }
      } else {
        console.log('Unexpected response status:', response.status);
        this.setState({
          status: 'error',
          errorMessage: data.error || 'Failed to confirm email'
        });
      }
    } catch (err) {
      console.error('Confirmation error:', err);
      this.setState({
        status: 'error',
        errorMessage: 'Network error. Please try again later.'
      });
    }
  }
  
  render() {
    const { status, errorMessage } = this.state;
    console.log('Rendering with status:', status);
    
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-xl p-8 max-w-md w-full text-center">
          {status === 'loading' && (
            <>
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
              <h2 className="text-2xl font-semibold text-white mb-4">
                Confirmation Failed
              </h2>
              <p className="text-zinc-400 mb-8">
                {errorMessage || 'There was a problem confirming your email. Please try again or contact support.'}
              </p>
            </>
          )}
          
        </div>
      </div>
    );
  }
}

/**
 * Wrapper component to get URL parameters and navigation
 */
export const StrictModeFreeConfirmation = () => {
  //const navigate = useNavigate();
  //const [searchParams] = useSearchParams();
  //const token = searchParams.get('token');
  
  console.log('StrictModeFreeConfirmation wrapper rendered');
  
  //return <ConfirmationComponent token={token} navigate={navigate} />;
};
