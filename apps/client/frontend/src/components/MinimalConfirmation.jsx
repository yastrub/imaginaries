import React from 'react';

/**
 * MinimalConfirmation
 * An extremely minimal component for email confirmation
 * Uses class component to avoid React hooks completely
 */
class MinimalConfirmation extends React.Component {
  constructor(props) {
    super(props);
    
    // Extract token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    this.state = {
      status: token ? 'loading' : 'error',
      errorMessage: token ? null : 'No confirmation token provided',
      token: token
    };
    
    // Binding
    this.handleReturn = this.handleReturn.bind(this);
  }
  
  componentDidMount() {
    // Only make the API call if we have a token
    if (this.state.token) {
      this.confirmEmail();
    }
  }
  
  async confirmEmail() {
    try {
      console.log('Confirming email with token:', this.state.token.substring(0, 8) + '...');
      
      const response = await fetch(`/api/auth/confirm-email?token=${encodeURIComponent(this.state.token)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (response.status === 200) {
        this.setState({ status: 'success' });
      } else if (response.status === 400) {
        if (data.error && data.error.includes('already confirmed')) {
          this.setState({ status: 'success' });
        } else {
          this.setState({
            status: 'error',
            errorMessage: data.error || 'Invalid confirmation token'
          });
        }
      } else {
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
  
  handleReturn() {
    window.location.href = '/';
  }
  
  render() {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          {this.state.status === 'loading' && (
            <>
              <div style={styles.spinner}></div>
              <h2 style={styles.heading}>Confirming Your Email</h2>
              <p style={styles.text}>Please wait while we confirm your email address...</p>
            </>
          )}
          
          {this.state.status === 'success' && (
            <>
              <div style={styles.successIcon}>✓</div>
              <h2 style={styles.heading}>Email Confirmed Successfully</h2>
              <p style={styles.text}>Thank you for confirming your email. You can now return to the application and sign in.</p>
            </>
          )}
          
          {this.state.status === 'error' && (
            <>
              <div style={styles.errorIcon}>!</div>
              <h2 style={styles.heading}>Confirmation Failed</h2>
              <p style={styles.text}>{this.state.errorMessage || 'There was a problem confirming your email. Please try again or contact support.'}</p>
            </>
          )}
          
          <button onClick={this.handleReturn} style={styles.button}>Return to Application</button>
        </div>
      </div>
    );
  }
}

// Inline styles to avoid any external dependencies
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'black',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem'
  },
  card: {
    backgroundColor: '#18181b',
    borderRadius: '0.75rem',
    padding: '2rem',
    maxWidth: '28rem',
    width: '100%',
    textAlign: 'center'
  },
  spinner: {
    width: '4rem',
    height: '4rem',
    borderRadius: '50%',
    border: '4px solid #3b82f6',
    borderTopColor: 'transparent',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 1.5rem auto'
  },
  successIcon: {
    width: '4rem',
    height: '4rem',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    color: 'white',
    fontSize: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.5rem auto'
  },
  errorIcon: {
    width: '4rem',
    height: '4rem',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    color: 'white',
    fontSize: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.5rem auto'
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: 'white',
    marginBottom: '1rem'
  },
  text: {
    color: '#a1a1aa',
    marginBottom: '2rem'
  },
  button: {
    backgroundColor: '#3b82f6',
    color: 'white',
    padding: '0.5rem 1rem',
    borderRadius: '0.375rem',
    border: 'none',
    width: '100%',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500'
  }
};

// Add keyframes for spinner animation
const styleSheet = document.createElement('style');
styleSheet.type = 'text/css';
styleSheet.innerText = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export { MinimalConfirmation };
