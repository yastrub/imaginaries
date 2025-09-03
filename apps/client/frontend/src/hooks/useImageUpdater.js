import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Hook to provide functions for updating image data without refetching
 */
export function useImageUpdater() {
  const queryClient = useQueryClient();

  /**
   * Add a newly generated image to the user history cache
   * This avoids having to refetch all images
   */
  const addNewImageToHistory = useCallback((newImage) => {
    console.log('Adding new image to history:', newImage);

    // Update the user history query data
    queryClient.setQueryData(
      ['userHistory'],
      (oldData) => {
        if (!oldData) return oldData;

        // Create a new images array with the new image at the beginning
        const updatedImages = [newImage, ...(oldData.images || [])];

        // Return updated data
        return {
          ...oldData,
          images: updatedImages,
          totalCount: (oldData.totalCount || 0) + 1
        };
      }
    );

    // Also update the consolidated data if it exists
    const consolidatedKeys = queryClient.getQueryCache().findAll(['userHistory']);
    consolidatedKeys.forEach(query => {
      queryClient.setQueryData(
        query.queryKey,
        (oldData) => {
          if (!oldData) return oldData;

          // Create a new images array with the new image at the beginning
          const updatedImages = [newImage, ...(oldData.images || [])];

          // Return updated data
          return {
            ...oldData,
            images: updatedImages,
            totalCount: (oldData.totalCount || 0) + 1
          };
        }
      );
    });

    return true;
  }, [queryClient]);

  return {
    addNewImageToHistory
  };
}
