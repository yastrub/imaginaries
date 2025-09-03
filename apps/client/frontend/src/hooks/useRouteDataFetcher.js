/**
 * useRouteDataFetcher.js
 * A hook that monitors route changes and triggers appropriate data fetching
 * based on the current route.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to monitor route changes and trigger appropriate data fetching
 * @param {Object} options - Configuration options
 * @param {Function} options.refreshMainScreen - Function to refresh main screen data
 * @param {Function} options.togglePublicView - Function to toggle between public and user images
 * @param {Function} options.switchView - Function to switch between recent and top views
 * @returns {Object} - Route monitoring state
 */
export function useRouteDataFetcher({
  refreshMainScreen,
  toggleHistoryView,
  switchView
}) {
  // Ensure all functions are defined to prevent TypeError
  const safeRefresh = typeof refreshMainScreen === 'function' ? refreshMainScreen : () => console.warn('refreshMainScreen is not a function');
  const safeToggleHistory = typeof toggleHistoryView === 'function' ? toggleHistoryView : () => console.warn('toggleHistoryView is not a function');
  const safeSwitchView = typeof switchView === 'function' ? switchView : () => console.warn('switchView is not a function');
  const location = useLocation();
  const currentPath = location.pathname;
  const previousPathRef = useRef(currentPath);
  
  // Debug logging
  console.log('Route monitor - Current path:', currentPath);
  
  useEffect(() => {
    // Skip if the path hasn't changed
    if (previousPathRef.current === currentPath) {
      console.log('Route monitor - Path unchanged, skipping data fetch');
      return;
    }
    
    const previousPath = previousPathRef.current;
    previousPathRef.current = currentPath;
    
    console.log(`Route changed from ${previousPath} to ${currentPath}`);
    
    // Determine route type
    const isMainRoute = currentPath === '/';
    const isImagineRoute = currentPath === '/imagine';
    const isGalleryRoute = currentPath.startsWith('/gallery');
    const isGalleryTopRoute = currentPath === '/gallery/top';
    const isGalleryRecentRoute = currentPath === '/gallery';
    
    // Handle route-specific data fetching
    if (isMainRoute) {
      // Main route - show public images (default behavior)
      console.log('Route monitor - Loading public images for main route');
      safeToggleHistory(false);
      safeSwitchView('recent');
      safeRefresh();
    } 
    else if (isImagineRoute) {
      // Imagine route - show user history
      console.log('Route monitor - Loading user history for imagine route');
      safeToggleHistory(true);
      safeRefresh();
    }
    else if (isGalleryTopRoute) {
      // Gallery top route - show top public images
      console.log('Route monitor - Loading top public images for gallery/top route');
      safeToggleHistory(false);
      // CRITICAL FIX: Only call switchView, don't call refresh to prevent double requests
      // The switchView function will handle the data fetching
      // CRITICAL FIX: Use 'top-liked' to match apiService.js condition
      safeSwitchView('top-liked');
      // safeRefresh(); // Removed to prevent double requests
    }
    else if (isGalleryRecentRoute) {
      // Gallery recent route - show recent public images
      console.log('Route monitor - Loading recent public images for gallery route');
      safeToggleHistory(false);
      // CRITICAL FIX: Only call switchView, don't call refresh to prevent double requests
      // The switchView function will handle the data fetching
      safeSwitchView('recent');
      // safeRefresh(); // Removed to prevent double requests
    }
    
    // Special case transitions
    if (previousPath === '/imagine' && isGalleryRoute) {
      // Transitioning from imagine to gallery - show public images
      console.log('Route monitor - Transitioning from imagine to gallery');
      safeToggleHistory(false);
      safeRefresh();
    }
    else if (previousPath.startsWith('/gallery') && isImagineRoute) {
      // Transitioning from gallery to imagine - show user history
      console.log('Route monitor - Transitioning from gallery to imagine');
      safeToggleHistory(true);
      safeRefresh();
    }
    else if (previousPath === '/gallery/top' && isGalleryRecentRoute) {
      // Transitioning from gallery/top to gallery - switch to recent
      console.log('Route monitor - Transitioning from gallery/top to gallery');
      safeSwitchView('recent');
      safeRefresh();
    }
    else if (previousPath === '/gallery' && isGalleryTopRoute) {
      // Transitioning from gallery to gallery/top - switch to top
      console.log('Route monitor - Transitioning from gallery to gallery/top');
      safeSwitchView('top');
      safeRefresh();
    }
  }, [currentPath, safeRefresh, safeToggleHistory, safeSwitchView]);
  
  return {
    currentPath,
    previousPath: previousPathRef.current,
    isMainRoute: currentPath === '/',
    isImagineRoute: currentPath === '/imagine',
    isGalleryRoute: currentPath.startsWith('/gallery'),
    isGalleryTopRoute: currentPath === '/gallery/top',
    isGalleryRecentRoute: currentPath === '/gallery'
  };
}
