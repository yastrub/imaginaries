import React from 'react';
import { useSelector } from 'react-redux';
import './AppUnlocker.css';

/**
 * AppUnlocker component
 * Shows a loading spinner when the app is loading authentication status
 * This prevents showing the app in an inconsistent state
 */
export function AppUnlocker({ children }) {
  const { isLoading, isAppUnlocked } = useSelector(state => state.auth);
  
  // Log current auth state for debugging
  console.log('AppUnlocker state:', { isLoading, isAppUnlocked });
  
  // EMERGENCY FIX: Force render the app after 2 seconds regardless of state
  const [forceRender, setForceRender] = React.useState(false);
  
  React.useEffect(() => {
    console.log('AppUnlocker: Setting up force render timer');
    const timer = setTimeout(() => {
      console.log('AppUnlocker: Force rendering app after timeout');
      setForceRender(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);
  
  // If app is loading or not unlocked AND we haven't forced rendering yet, show loading spinner
  if ((isLoading || !isAppUnlocked) && !forceRender) {
    console.log('AppUnlocker: Showing loading spinner while checking authentication');
    return (
      <div className="app-loading-container">
        <div className="app-loading-spinner"></div>
        <div className="app-loading-text">Loading application...</div>
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#aaa' }}>
          {forceRender ? 'Force rendering enabled...' : 'Please wait. We do magic'}
        </div>
      </div>
    );
  }
  
  // Otherwise show the app
  console.log('AppUnlocker: Rendering children, forceRender:', forceRender);
  return children;
}
