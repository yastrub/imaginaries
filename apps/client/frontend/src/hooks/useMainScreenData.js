import { useState, useEffect, useRef, useCallback } from 'react';
import { updateReduxAuthFromApiResponse } from '../utils/reduxAuthMonitor';

// No need for module-level caching as we're using the global request cache

/**
 * Custom hook to fetch main screen data in a single request
 * This combines authentication check and image loading (either user history or public gallery)
 */
export function useMainScreenData() {
  const [data, setData] = useState({
    isAuthenticated: false,
    userId: null,
    user: null,  // Full user object for authenticated users
    userImages: [],
    publicImages: [],
    totalPages: 1,
    hasMore: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  
  // Track if component is mounted
  const isMounted = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Load main screen data - combines auth check and appropriate images in one request
   * Uses the global request cache to prevent duplicate API calls
   */
  const fetchData = useCallback(async (page = 1) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log(`[useMainScreenData] Fetching page ${page}`);
      
      // Always use the same URL format to ensure cache hits
      const url = `/api/images/recent?page=${page}&limit=20`;
      
      // Make a regular fetch request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // Important: include cookies for auth
      });
      
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      
      const result = await response.json();
        
      // Update the auth monitor with the authentication state from the API
      updateReduxAuthFromApiResponse(result);
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        setData({
          isAuthenticated: result.isAuthenticated,
          userId: result.userId,
          user: result.user,  // Store the full user object
          userImages: result.images || [],  // Images are now in a single 'images' array
          publicImages: result.isAuthenticated ? [] : (result.images || []),  // For authenticated users, publicImages is empty
          totalPages: result.totalPages || 1,
          hasMore: result.hasMore || false
        });
      }
      
      return result;
    } catch (err) {
      console.error('Error loading main screen data:', err);
      if (isMounted.current) {
        setError('Failed to load data');
      }
      throw err;
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [loading]);
  
  // Memoize the fetchData function to prevent recreation on re-renders
  const memoizedFetchData = useCallback(fetchData, [fetchData, loading]);
  
  // Load first page when component mounts - but only if explicitly requested
  // This prevents automatic loading on mount, which can cause duplicate requests
  useEffect(() => {
    // We'll let the parent component trigger the initial load
    // This prevents automatic API calls that might duplicate requests
    console.log('useMainScreenData mounted - waiting for explicit load request');
    
    return () => {
      // Cleanup on unmount
      isMounted.current = false;
    };
  }, []);
  
  // Function to load next page
  const loadNextPage = useCallback(() => {
    if (data.hasMore) {
      setPage(prev => {
        const nextPage = prev + 1;
        memoizedFetchData(nextPage);
        return nextPage;
      });
    }
  }, [data.hasMore, memoizedFetchData]);
  
  // Function to refresh data
  const refresh = useCallback(() => {
    setPage(1);
    
    // No need to clear cache anymore
    
    memoizedFetchData(1);
  }, [memoizedFetchData]);
  
  return {
    data,
    loading,
    error,
    loadMore: loadNextPage,
    refresh,
    page,
    loadData: memoizedFetchData // Expose the loadData function for explicit loading
  };
}
