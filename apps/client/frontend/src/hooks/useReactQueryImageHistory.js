/**
 * React Query version of the Image History hook
 * This hook uses React Query for data fetching, caching, and state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { apiService } from '../services/apiService';

/**
 * Hook for fetching and managing user's image history using React Query
 */
export function useReactQueryImageHistory(userId) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  
  // Define the query key - this is used for caching and invalidation
  const queryKey = ['userImages', userId, page];
  
  // Use React Query's useQuery hook to fetch data
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery(
    queryKey,
    () => apiService.getUserImages({ page, limit: 20 }),
    {
      // Don't fetch if no userId is provided
      enabled: !!userId,
      
      // Keep previous data while loading new data
      keepPreviousData: true,
      
      // Only refetch when explicitly requested
      refetchOnWindowFocus: false,
      
      // Transform the response to match the expected format
      select: (data) => ({
        images: data.images?.map(img => ({
          id: img.id,
          url: img.image_url,
          prompt: img.prompt,
          createdAt: img.createdAt || img.created_at,
          metadata: img.metadata || {},
          watermarked: img.watermarked_url,
          user_id: img.user_id,
          is_private: img.is_private || false,
          like_count: parseInt(img.like_count || '0', 10),
          is_liked: typeof img.is_liked === 'boolean' ? img.is_liked : img.is_liked === 'true'
        })) || [],
        totalPages: data.totalPages || 1,
        hasMore: page < (data.totalPages || 1)
      })
    }
  );
  
  // Extract the processed data with defaults
  const images = data?.images || [];
  const totalPages = data?.totalPages || 1;
  const hasMore = data?.hasMore || false;
  
  // Set up mutation for clearing history
  const clearHistoryMutation = useMutation(
    () => apiService.clearHistory(),
    {
      onSuccess: () => {
        // Invalidate and refetch queries related to user images
        queryClient.invalidateQueries(['userImages', userId]);
        
        // Also invalidate recent images queries as they might include user images
        queryClient.invalidateQueries(['publicGallery']);
      }
    }
  );
  
  // Function to load next page
  const loadNextPage = useCallback(() => {
    if (hasMore && !isLoading) {
      setPage(prev => prev + 1);
    }
  }, [hasMore, isLoading]);
  
  // Function to refresh data
  const refresh = useCallback(() => {
    // Reset to page 1
    setPage(1);
    // Force refetch
    refetch();
  }, [refetch]);
  
  // Function to clear history
  const clearHistory = useCallback(() => {
    if (!userId) return Promise.resolve();
    
    if (confirm('Are you sure you want to clear your image history? This action cannot be undone.')) {
      return clearHistoryMutation.mutateAsync();
    }
    
    return Promise.resolve();
  }, [userId, clearHistoryMutation]);
  
  // Function to explicitly load images (for compatibility with old code)
  const loadImages = useCallback((pageNum = 1) => {
    setPage(pageNum);
    return refetch();
  }, [refetch]);
  
  return {
    images,
    isLoading,
    error: error || clearHistoryMutation.error,
    loadImages,
    loadNextPage,
    hasMore,
    refresh,
    clearHistory,
    page,
    totalPages,
    isClearingHistory: clearHistoryMutation.isLoading
  };
}
