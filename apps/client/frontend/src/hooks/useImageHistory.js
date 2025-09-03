import React, { useState, useEffect, useCallback } from 'react';
import { useConsolidatedData } from './useConsolidatedData';

// Reset module state during development for HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('HMR: Resetting useImageHistory module state');
  });
}

export function useImageHistory(userId) {
  const [images, setImages] = useState([]);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Use the consolidated data hook instead of making a separate API call
  const { 
    userImages, 
    isLoading, 
    totalPages: apiTotalPages, 
    hasMore: apiHasMore,
    loadNextPage,
    refresh
  } = useConsolidatedData();
  
  // Update local state when consolidated data changes
  useEffect(() => {
    // Only update if userId is provided
    if (userId) {
      setImages(userImages || []);
      setTotalPages(apiTotalPages || 1);
      setHasMore(apiHasMore || false);
      setError(null);
    } else {
      setImages([]);
      setTotalPages(1);
      setHasMore(false);
    }
  }, [userId, userImages, apiTotalPages, apiHasMore]);

  // Load next page - delegate to consolidated data hook
  const loadNextPageLocal = useCallback(() => {
    if (userId) {
      loadNextPage();
    }
  }, [userId, loadNextPage]);

  // Refresh data - delegate to consolidated data hook
  const refreshData = useCallback(() => {
    if (userId) {
      return refresh();
    }
    return Promise.resolve([]);
  }, [userId, refresh]);

  // Function to clear all user history
  const clearHistory = useCallback(() => {
    if (!userId) return;
    
    try {
      console.log('Clearing history for user');
      fetch('/api/generate/history/delete', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            // Reset state
            setImages([]);
            setTotalPages(1);
            setHasMore(false);
            setError(null);
          } else {
            throw new Error(data.error || 'Failed to clear history');
          }
        })
        .catch(err => {
          console.error('Error clearing history:', err);
          setError('Failed to clear history');
          throw err;
        });
    } catch (error) {
      console.error('Error clearing history:', error);
      throw error;
    }
  }, [userId]);
  
  return { 
    images, 
    isLoading, 
    error, 
    hasMore, 
    loadNextPage: loadNextPageLocal, 
    refresh: refreshData,
    clearHistory 
  };
}