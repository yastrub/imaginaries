/**
 * Consolidated Data Hook using React Query
 * This single hook replaces all the separate data fetching hooks to prevent duplicate API calls
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { apiService } from '../services/apiService';
import { updateReduxAuthFromApiResponse } from '../utils/reduxAuthMonitor';

// IMPORTANT: We're removing the singleton pattern as it's causing issues
// Instead, we'll rely on React Query's built-in caching
let hookInitialized = false;

// Reset module state during development for HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('HMR: Resetting useConsolidatedData hook state');
    hookInitialized = false;
  });
}

/**
 * A single consolidated hook for all data fetching needs
 * This prevents duplicate API calls by centralizing all data fetching logic
 * Uses a singleton pattern to ensure only one instance exists across the app
 */
export function useConsolidatedData() {
  // NOTE: We can't use a true singleton pattern with early returns
  // as it would break React's rules of hooks
  // Instead, we'll use the same instance but still call all hooks consistently
  
  // Only log on first call to reduce console spam
  if (!hookInitialized) {
    console.log('useConsolidatedData initialized for the first time');
    hookInitialized = true;
  }
  const queryClient = useQueryClient();
  const [view, setView] = useState('recent');
  const [page, setPage] = useState(1);
  const [showHistory, setShowHistory] = useState(false);
  
  // Determine data loading strategy based on route
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const isGalleryRoute = currentPath.startsWith('/gallery');
  const isMainRoute = currentPath === '/';
  const isImagineRoute = currentPath === '/imagine';
  
  // Set showHistory based on route - with initialization
  useEffect(() => {
    // CRITICAL: Set initial showHistory state immediately based on the current route
    // This prevents the initial API call with the wrong parameter value
    const initialShowHistory = isImagineRoute;
    console.log(`Initial route ${currentPath} detected: setting initial showHistory=${initialShowHistory}`);
    setShowHistory(initialShowHistory);
  }, []); // Empty dependency array - only run once on mount
  
  // Update showHistory when route changes
  useEffect(() => {
    // Show user history only on the imagine route
    if (isImagineRoute) {
      console.log(`Route ${currentPath} detected: showing user history`);
      setShowHistory(true);
    } else if (isGalleryRoute || isMainRoute) {
      console.log(`Route ${currentPath} detected: showing public gallery`);
      setShowHistory(false);
    }
  }, [isGalleryRoute, isMainRoute, isImagineRoute, currentPath]);
  
  // Get auth state from Redux
  const { isAuthenticated, user } = useSelector(state => state.auth);
  
  // CRITICAL FIX: Prevent duplicate API calls
  // Define a single query key for all data
  // Use a stable key that doesn't change with auth state
  // We'll handle auth-specific data in the transform function
  
  // Use separate query keys for public images and user history
  // This ensures we can access both datasets independently
  // CRITICAL FIX: Include the actual view parameter in the query key to ensure proper caching
  const publicImagesQueryKey = ['publicImages', view, page];
  const userHistoryQueryKey = ['userHistory', page];
  
  // CRITICAL: Determine which data to show based on the current route
  const shouldShowHistory = isImagineRoute;
  
  // Log the query keys for debugging
  console.log('Query keys:', {
    publicImagesQueryKey,
    userHistoryQueryKey,
    showHistory,
    shouldShowHistory
  });
  
  // Use React Query's useQuery hook to fetch data
  // The enabled option ensures we only make the API call once
  // Use separate queries for public images and user history
  // This ensures we can access both datasets independently
  
  // CRITICAL FIX: Track 401 errors to prevent infinite loops
  const unauthorizedErrorRef = useRef(false);
  const maxRetryAttemptsRef = useRef(0);
  
  // Function to handle 401 errors and prevent infinite loops
  const handle401Error = useCallback((error) => {
    // Check if this is a 401 error
    if (error?.response?.status === 401 || error?.status === 401) {
      console.error('Authentication error (401) detected');
      
      // If we already had a 401 error, don't retry again
      if (unauthorizedErrorRef.current) {
        console.warn('Multiple 401 errors detected, preventing retry loop');
        return false; // Don't retry
      }
      
      // Mark that we've seen a 401 error
      unauthorizedErrorRef.current = true;
      
      // Increment retry counter
      maxRetryAttemptsRef.current += 1;
      
      // If we've tried too many times, stop retrying
      if (maxRetryAttemptsRef.current >= 2) {
        console.warn('Max retry attempts reached, clearing auth cookie');
        
        // Clear the auth cookie to prevent further 401s
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
        // Force a page reload to clear any stale state
        // This is a last resort to break out of infinite loops
        if (typeof window !== 'undefined') {
          console.warn('Forcing page reload to clear stale state');
          setTimeout(() => {
            window.location.href = '/';
          }, 500);
        }
        
        return false; // Don't retry
      }
      
      return false; // Don't retry by default for 401s
    }
    
    // For other errors, allow retry
    return true;
  }, []);
  
  // 1. Query for public images
  const {
    data: publicImagesData,
    isLoading: isLoadingPublic,
    error: publicError,
    refetch: refetchPublic
  } = useQuery(
    publicImagesQueryKey,
    () => {
      console.log('Making API call to get PUBLIC images', { 
        page, 
        view, 
        path: currentPath
      });
      
      // Reset unauthorized error flag on new request
      unauthorizedErrorRef.current = false;
      
      // CRITICAL FIX: Use the correct API method based on the view parameter
      // For 'top' view, use the dedicated top endpoint
      if (view === 'top') {
        console.log('Using TOP endpoint for top-liked images');
        return apiService.getRecentImages({ 
          page, 
          limit: 20, 
          view: 'top-liked', // CRITICAL FIX: Must use 'top-liked' to match apiService.js condition
          showHistory: false, // Explicitly request public images
          _cb: Date.now() // Cache busting
        });
      }
      
      // For other views (recent), use the regular endpoint
      return apiService.getRecentImages({ 
        page, 
        limit: 20, 
        view: 'recent',
        showHistory: false, // Explicitly request public images
        _cb: Date.now() // Cache busting
      });
    },
    {
      // Configure the public images query
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      enabled: true,
      retry: (failureCount, error) => {
        // Use our custom 401 handler
        return handle401Error(error) && failureCount < 3;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
      cacheTime: 2 * 60 * 1000, // 2 minutes
      onSuccess: (data) => {
        // Update Redux auth state from API response
        if (data) {
          updateReduxAuthFromApiResponse(data);
        }
        return data;
      }
    }
  );
  
  // 2. Query for user history (only if authenticated)
  const {
    data: userHistoryData,
    isLoading: isLoadingHistory,
    error: historyError,
    refetch: refetchHistory
  } = useQuery(
    userHistoryQueryKey,
    () => {
      console.log('Making API call to get USER HISTORY', { 
        page, 
        isAuthenticated, 
        path: currentPath
      });
      
      // Always request user history with history=true parameter
      return apiService.getRecentImages({ 
        page, 
        limit: 20, 
        view: 'recent', // Always use recent view for history
        showHistory: true, // Explicitly request user history
        _cb: Date.now() // Cache busting
      });
    },
    {
      // Configure the user history query
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      enabled: isAuthenticated,
      retry: (failureCount, error) => {
        // Use our custom 401 handler
        return handle401Error(error) && failureCount < 3;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
      cacheTime: 2 * 60 * 1000, // 2 minutes
      onSuccess: (data) => {
        // Update Redux auth state from API response
        if (data) {
          updateReduxAuthFromApiResponse(data);
        }
        return data;
      }
    }
  );
  
  // Debug the API response
  console.log('API Response:', {
    publicData: publicImagesData,
    historyData: userHistoryData,
    hasPublicImages: publicImagesData?.images?.length > 0,
    hasHistoryImages: userHistoryData?.images?.length > 0,
    isAuthenticated
  });

  // Determine which data to use based on the current route
  // This is the main logic that decides what to show in the UI
  const apiData = shouldShowHistory ? userHistoryData : publicImagesData;
  const isLoading = shouldShowHistory ? isLoadingHistory : isLoadingPublic;
  const error = shouldShowHistory ? historyError : publicError;
  
  // Transform the data into the expected format
  const data = {
    // Use Redux auth state instead of API response for authentication status
    isAuthenticated,
    userId: user?.id || null,
    user,
    // IMPORTANT: We now have separate data sources for user images and public images
    // This ensures the History modal always has access to user images
    userImages: userHistoryData?.images || [],
    publicImages: publicImagesData?.images || [],
    totalPages: apiData?.totalPages || 1,
    // Use the server's hasMore flag directly if available, otherwise calculate it
    hasMore: apiData?.hasMore !== undefined ? apiData.hasMore : page < (apiData?.totalPages || 1),
    isPublicView: !shouldShowHistory,
    currentRoute: currentPath
  };
  
  // Enhanced debugging for pagination issues
  console.log('CRITICAL DEBUG - Transformed data with pagination info:', {
    userImagesLength: data.userImages.length,
    publicImagesLength: data.publicImages.length,
    isAuthenticated: data.isAuthenticated,
    hasMore: data.hasMore,
    totalPages: data.totalPages,
    apiDataHasMore: apiData?.hasMore,
    rawPublicHasMore: publicImagesData?.hasMore,
    rawHistoryHasMore: userHistoryData?.hasMore,
    page: page,
    shouldShowHistory: shouldShowHistory
  });
  
  // Stabilize array references for userImages and publicImages so downstream memoization works reliably
  const calcSig = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return 'len:0';
    try {
      const ids = arr.map((i) => (i?.id ?? i?.url ?? i?.created_at ?? i?.createdAt ?? 'x')).join(',');
      return `len:${arr.length}|ids:${ids}`;
    } catch {
      return `len:${arr?.length || 0}`;
    }
  };
  const stableUserRef = useRef({ sig: calcSig(data.userImages), arr: data.userImages });
  const stablePublicRef = useRef({ sig: calcSig(data.publicImages), arr: data.publicImages });
  const newUserSig = calcSig(data.userImages);
  const newPublicSig = calcSig(data.publicImages);
  if (stableUserRef.current.sig !== newUserSig) {
    stableUserRef.current = { sig: newUserSig, arr: data.userImages };
  }
  if (stablePublicRef.current.sig !== newPublicSig) {
    stablePublicRef.current = { sig: newPublicSig, arr: data.publicImages };
  }

  // Function to switch view
  const switchView = useCallback((newView) => {
    if (newView !== view) {
      console.log('Switching view from', view, 'to', newView);
      setView(newView);
      setPage(1);
      
      // CRITICAL FIX: Force a refetch when switching views to ensure proper sorting
      // This ensures the Top Likes tab properly sorts images by likes
      console.log('Forcing refetch after view switch to:', newView);
      refetchPublic();
    }
  }, [view, refetchPublic]);
  
  // Function to toggle between history and public view
  const toggleHistoryView = useCallback((value) => {
    console.log('Toggling history view to:', value);
    setShowHistory(value);
  }, []);
  
  // Flag to prevent multiple concurrent pagination requests
  const isLoadingNextPageRef = useRef(false);
  
  // Function to load next page
  const loadNextPage = useCallback(() => {
    // CRITICAL FIX: Prevent multiple concurrent requests
    if (data.hasMore && !isLoading && !isLoadingNextPageRef.current) {
      // Set loading flag to prevent duplicate calls
      isLoadingNextPageRef.current = true;
      
      console.log('useConsolidatedData: Loading next page, incrementing from', page);
      
      // Store the current page for reference
      const nextPage = page + 1;
      console.log('useConsolidatedData: Next page will be', nextPage);
      
      // Make a direct API call to get the next page
      if (showHistory) {
        // For history view
        console.log('useConsolidatedData: Fetching history page', nextPage);
        apiService.getRecentImages({ 
          page: nextPage, 
          limit: 20, 
          view: 'recent', // Always use recent view for history
          showHistory: true, // Explicitly request user history
          _cb: Date.now() // Cache busting
        }).then(newData => {
          if (newData && newData.images) {
            console.log('useConsolidatedData: Successfully loaded history page', nextPage, 'with', newData.images.length, 'items');
            
            // Update the page state
            setPage(nextPage);
            
            // Invalidate the query to force a refetch
            queryClient.invalidateQueries(userHistoryQueryKey);
            
            // Update the data directly
            queryClient.setQueryData(userHistoryQueryKey, oldData => {
              if (!oldData) return newData;
              
              return {
                ...newData,
                images: [...(oldData.images || []), ...(newData.images || [])]
              };
            });
          }
          
          // Reset loading flag
          isLoadingNextPageRef.current = false;
        }).catch(err => {
          console.error('Error loading next page of history:', err);
          isLoadingNextPageRef.current = false;
        });
      } else {
        // For public view
        console.log('useConsolidatedData: Fetching public page', nextPage, 'with view', view);
        apiService.getRecentImages({ 
          page: nextPage, 
          limit: 20, 
          view, // Use current view (recent or top)
          _cb: Date.now() // Cache busting
        }).then(newData => {
          if (newData && newData.images) {
            console.log('useConsolidatedData: Successfully loaded public page', nextPage, 'with', newData.images.length, 'items');
            
            // Update the page state
            setPage(nextPage);
            
            // Invalidate the query to force a refetch
            queryClient.invalidateQueries(publicImagesQueryKey);
            
            // Update the data directly
            queryClient.setQueryData(publicImagesQueryKey, oldData => {
              if (!oldData) return newData;
              
              return {
                ...newData,
                images: [...(oldData.images || []), ...(newData.images || [])]
              };
            });
          }
          
          // Reset loading flag
          isLoadingNextPageRef.current = false;
        }).catch(err => {
          console.error('Error loading next page of public images:', err);
          isLoadingNextPageRef.current = false;
        });
      }
    }
  }, [data.hasMore, isLoading, page, showHistory, view, queryClient, publicImagesQueryKey, userHistoryQueryKey]);
  
  // Function to refresh data
  const refresh = useCallback(() => {
    // Reset to page 1
    setPage(1);
    // Force refetch both data sources
    refetchPublic();
    if (isAuthenticated) {
      refetchHistory();
    }
    return Promise.resolve();
  }, [refetchPublic, refetchHistory, isAuthenticated]);
  
  // Function to explicitly load data (for compatibility with old code)
  const loadData = useCallback((pageNum, viewType = view) => {
    console.log('useConsolidatedData: loadData called with', { pageNum, viewType, currentPage: page, currentView: view });
    
    // CRITICAL FIX: Handle undefined pageNum - if undefined, this is a Load More request
    if (pageNum === undefined) {
      console.log('useConsolidatedData: Detected Load More request, calling loadNextPage()');
      // This is a Load More request - use loadNextPage which handles pagination properly
      loadNextPage();
      return Promise.resolve();
    }
    
    // Otherwise, set to the specified page or default to 1
    const newPage = pageNum || 1;
    setPage(newPage);
    
    // CRITICAL FIX: Normalize viewType to ensure it's either 'recent' or 'top'
    // The Gallery component might send 'top-liked', but the API expects 'top'
    const normalizedViewType = viewType === 'top-liked' ? 'top' : viewType;
    
    // Update view if needed
    if (normalizedViewType !== view) {
      console.log('useConsolidatedData: Switching view from', view, 'to', normalizedViewType);
      setView(normalizedViewType);
    }
    
    // Refetch the appropriate data source based on current view
    console.log('useConsolidatedData: Refetching with page', newPage, 'and view', normalizedViewType);
    if (showHistory) {
      refetchHistory();
    } else {
      // CRITICAL FIX: Force invalidate the query before refetching to ensure fresh data
      queryClient.invalidateQueries(publicImagesQueryKey);
      refetchPublic();
    }
    
    // Also fetch the other data source if authenticated, but don't wait for it
    if (isAuthenticated && !showHistory) {
      refetchHistory();
    }
    
    return Promise.resolve();
  }, [view, page, showHistory, loadNextPage, refetchPublic, refetchHistory, isAuthenticated, queryClient, publicImagesQueryKey]);
  
  // Set up mutation for clearing history
  const clearHistoryMutation = useMutation(
    () => apiService.clearHistory(),
    {
      onSuccess: () => {
        // Invalidate both query keys
        queryClient.invalidateQueries(publicImagesQueryKey);
        queryClient.invalidateQueries(userHistoryQueryKey);
        // Force a refresh of both data sources
        refresh();
      }
    }
  );
  
  // Force initial data load if no data is available
  useEffect(() => {
    if (!isLoading) {
      // Check if we need to load public images
      if (!publicImagesData || !publicImagesData.images) {
        console.log('No public images available, forcing initial data load');
        refetchPublic();
      }
      
      // Check if we need to load user history (only if authenticated)
      if (isAuthenticated && (!userHistoryData || !userHistoryData.images)) {
        console.log('No user history available, forcing initial data load');
        refetchHistory();
      }
    }
  }, [isLoading, publicImagesData, userHistoryData, isAuthenticated, refetchPublic, refetchHistory]);
  
  // Function to clear history
  const clearHistory = useCallback(() => {
    if (!data.userId) return Promise.resolve();
    
    if (confirm('Are you sure you want to clear your image history? This action cannot be undone.')) {
      return clearHistoryMutation.mutateAsync();
    }
    
    return Promise.resolve();
  }, [data.userId, clearHistoryMutation]);
  
  // If we have an existing instance, use its data but still return a new object
  // This ensures React's rules of hooks are followed
  
  // CRITICAL FIX: Don't use hookInstance anymore, always use fresh data
  const result = {
    // Main data
    data,
    isLoading,
    error,
    
    // User images data (stable reference)
    userImages: stableUserRef.current.arr,
    
    // Public gallery data (stable reference)
    publicImages: stablePublicRef.current.arr,
    view,
    switchView,
    toggleHistoryView,
    
    // Common functions
    loadData,
    loadNextPage,
    refresh,
    clearHistory,
    
    // Pagination
    page,
    hasMore: data.hasMore,
    hasMorePublic: apiData?.hasMore, // Directly expose the server's hasMore flag
    totalPages: data.totalPages,
    
    // Auth state
    isAuthenticated: data.isAuthenticated, // Always use latest auth state
    userId: data.userId,
    user: data.user
  };
  
  // Debug the final result
  console.log('Final result:', {
    userImagesLength: result.userImages.length,
    publicImagesLength: result.publicImages.length,
    isAuthenticated: result.isAuthenticated
  });
  
  // No longer storing the instance as a singleton
  
  return result;
}
