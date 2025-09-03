import { useState, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';

export function useLikes() {
  // Always initialize state hooks regardless of auth state
  const [likedImages, setLikedImages] = useState(new Set());
  const [likeCounts, setLikeCounts] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [pendingLikes, setPendingLikes] = useState(new Set()); // Track pending like operations
  
  // Get authentication state from Redux
  const { isAuthenticated } = useSelector(state => state.auth);

  const toggleLike = useCallback(async (imageId) => {
    if (!imageId) {
      console.error('No image ID provided to toggleLike');
      return false;
    }
    
    // Check authentication state before proceeding
    if (!isAuthenticated) {
      console.log('User not authenticated, cannot toggle like');
      return false;
    }

    // Check if this image is already being processed
    if (pendingLikes.has(imageId)) {
      console.log('Like operation already in progress for image:', imageId);
      return false;
    }

    try {
      // Mark this image as having a pending like operation
      setPendingLikes(prev => {
        const next = new Set(prev);
        next.add(imageId);
        return next;
      });
      
      setIsLoading(true);
      const isLiked = likedImages.has(imageId);
      const method = isLiked ? 'DELETE' : 'POST';
      
      console.log(`Making ${method} request to /api/likes/${imageId}`);
      
      // Optimistically update the UI
      setLikedImages(prev => {
        const next = new Set(prev);
        if (isLiked) {
          next.delete(imageId);
        } else {
          next.add(imageId);
        }
        return next;
      });

      setLikeCounts(prev => ({
        ...prev,
        [imageId]: Math.max(0, (prev[imageId] || 0) + (isLiked ? -1 : 1))
      }));
      
      const response = await fetch(`/api/likes/${imageId}`, {
        method,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Toggle like error response:', error);
        
        // Revert the optimistic update on error
        setLikedImages(prev => {
          const next = new Set(prev);
          if (!isLiked) {
            next.delete(imageId);
          } else {
            next.add(imageId);
          }
          return next;
        });

        setLikeCounts(prev => ({
          ...prev,
          [imageId]: Math.max(0, (prev[imageId] || 0) + (!isLiked ? -1 : 1))
        }));
        
        throw new Error(error.error || 'Failed to toggle like');
      }

      console.log('Like operation successful for image:', imageId);
      return true; // Return success
    } catch (error) {
      console.error('Error toggling like:', error);
      return false; // Return failure
    } finally {
      setIsLoading(false);
      
      // Remove this image from the pending likes set
      setPendingLikes(prev => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    }
  }, [likedImages]);

  const fetchLikes = useCallback(async (imageIds) => {
    if (!imageIds?.length) {
      console.log('No image IDs provided to fetchLikes');
      return;
    }
    
    // Skip API call if not authenticated
    if (!isAuthenticated) {
      console.log('User not authenticated, skipping likes fetch');
      return;
    }
    
    try {
      setIsLoading(true);
      console.log('Fetching likes for images:', imageIds);

      const response = await fetch('/api/likes/status/get', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageIds }),
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Fetch likes error response:', error);
        throw new Error(error.error || 'Failed to fetch likes');
      }

      const data = await response.json();
      console.log('Received likes data:', data);
      
      setLikedImages(new Set(data.liked || []));
      setLikeCounts(data.counts || {});
    } catch (error) {
      console.error('Error fetching likes:', error);
      // Don't throw error here, just log it
      // This allows the share page to still work even if likes fetch fails
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);
  
  // Reset likes state when authentication state changes
  useEffect(() => {
    if (!isAuthenticated) {
      setLikedImages(new Set());
      setLikeCounts({});
    }
  }, [isAuthenticated]);

  // Create a separate function for toggling likes in the history view
  // This is needed because the ImageHistory component has special event handling requirements
  const toggleLikeInHistory = useCallback(async (imageId) => {
    console.log('toggleLikeInHistory called for image:', imageId);
    return toggleLike(imageId);
  }, [toggleLike]);

  return {
    likedImages,
    likeCounts,
    toggleLike,
    toggleLikeInHistory, // Add the new function to the returned object
    fetchLikes,
    isLoading,
    // Include authentication state for components to check
    isAuthenticated,
    pendingLikes // Expose pending likes for components that need it
  };
}