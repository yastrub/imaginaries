/**
 * React Query version of the Main Screen Data hook
 * This hook combines authentication and image loading in a single hook
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { updateReduxAuthFromApiResponse } from '../utils/reduxAuthMonitor';

/**
 * Hook for fetching main screen data using React Query
 * This combines authentication check and image loading in a single request
 */
export function useReactQueryMainScreenData() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  
  // Define the query key - this is used for caching and invalidation
  const queryKey = ['mainScreenData', page];
  
  // Use React Query's useQuery hook to fetch data
  const {
    data: apiData,
    isLoading,
    error,
    refetch
  } = useQuery(
    queryKey,
    () => apiService.getRecentImages({ page, limit: 20 }),
    {
      // Keep previous data while loading new data
      keepPreviousData: true,
      
      // Only refetch when explicitly requested
      refetchOnWindowFocus: false,
      
      // Process the response
      onSuccess: (data) => {
        // Update the auth monitor with the authentication state from the API
        updateReduxAuthFromApiResponse(data);
      }
    }
  );
  
  // Transform the data into the expected format
  const data = {
    isAuthenticated: apiData?.isAuthenticated || false,
    userId: apiData?.userId || null,
    user: apiData?.user || null,
    userImages: apiData?.isAuthenticated ? (apiData?.images || []) : [],
    publicImages: apiData?.isAuthenticated ? [] : (apiData?.images || []),
    totalPages: apiData?.totalPages || 1,
    hasMore: page < (apiData?.totalPages || 1)
  };
  
  // Function to load next page
  const loadNextPage = useCallback(() => {
    if (data.hasMore && !isLoading) {
      setPage(prev => prev + 1);
    }
  }, [data.hasMore, isLoading]);
  
  // Function to refresh data
  const refresh = useCallback(() => {
    // Reset to page 1
    setPage(1);
    // Force refetch
    refetch();
  }, [refetch]);
  
  // Function to explicitly load data (for compatibility with old code)
  const loadData = useCallback((pageNum = 1) => {
    setPage(pageNum);
    return refetch();
  }, [refetch]);
  
  return {
    data,
    loading: isLoading,
    error,
    loadMore: loadNextPage,
    refresh,
    page,
    loadData
  };
}
