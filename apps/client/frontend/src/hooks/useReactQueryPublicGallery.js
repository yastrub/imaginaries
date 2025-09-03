/**
 * React Query version of the Public Gallery hook
 * This hook uses React Query for data fetching, caching, and state management
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { apiService } from '../services/apiService';

/**
 * Hook for fetching and managing public gallery images using React Query
 */
export function useReactQueryPublicGallery() {
  const queryClient = useQueryClient();
  const [view, setView] = useState('recent');
  const [page, setPage] = useState(1);
  
  // Define the query key - this is used for caching and invalidation
  const queryKey = ['publicGallery', view, page];
  
  // Use React Query's useQuery hook to fetch data
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery(
    queryKey,
    () => apiService.getRecentImages({ page, limit: 20, view }),
    {
      // Keep previous data while loading new data
      keepPreviousData: true,
      
      // Only refetch when explicitly requested
      refetchOnWindowFocus: false,
      
      // Transform the response to match the expected format
      select: (data) => ({
        images: data.images?.map(img => ({
          id: img.id,
          url: img.image_url,
          watermarked: img.watermarked_url,
          user_id: img.user_id,
          is_private: img.is_private || false,
          like_count: parseInt(img.like_count || '0', 10),
          is_liked: typeof img.is_liked === 'boolean' ? img.is_liked : img.is_liked === 'true',
          createdAt: img.created_at || new Date().toISOString(),
          prompt: img.prompt || ''
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
  
  // Function to switch view
  const switchView = useCallback((newView) => {
    if (newView !== view) {
      console.log('Switching view from', view, 'to', newView);
      setView(newView);
      setPage(1);
    }
  }, [view]);
  
  // Function to explicitly load images (for compatibility with old code)
  const loadImages = useCallback((pageNum = 1, viewType = view) => {
    setPage(pageNum);
    if (viewType !== view) {
      setView(viewType);
    }
    return refetch();
  }, [view, refetch]);
  
  return {
    images,
    isLoading,
    error,
    loadImages,
    loadNextPage,
    hasMore,
    refresh,
    switchView,
    view,
    page,
    totalPages
  };
}
