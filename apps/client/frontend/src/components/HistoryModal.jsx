import React, { useEffect, useState } from 'react';
import { ImageHistory } from './ImageHistory';

/**
 * HistoryModal component that handles showing user history
 * regardless of which route it's opened from.
 * 
 * This component temporarily disables the forcePublic flag
 * when opened from Gallery to ensure user history is shown correctly.
 */
function HistoryModal({
  userImages,
  userId,
  onClose,
  handleDownload,
  downloadingImageId,
  refreshMainScreen,
  handleReusePrompt,
  toggleLike,
  likedImages,
  likeCounts,
  setSelectedImage,
  setShowQuoteModal,
  setIsHistoryOpen,
  isLoadingMainScreen,
  toast
}) {
  // No need to toggle history view anymore since we have separate queries
  // Just log that the history modal is opened
  // State to track if there are more images to load
  const [hasMoreUserImages, setHasMoreUserImages] = useState(true);
  
  // State to track all user images, including loaded ones
  const [allUserImages, setAllUserImages] = useState(userImages || []);
  
  useEffect(() => {
    console.log('History modal opened - using dedicated user history data');
    
    // Refresh data to ensure we have the latest user history
    if (refreshMainScreen) {
      refreshMainScreen();
    }
    
    return () => {
      console.log('History modal closed');
    };
  }, [refreshMainScreen]);
  
  // Function to load the next page of user history
  const loadNextPageOfHistory = async () => {
    console.log('HistoryModal: Loading next page of user history');
    
    try {
      // Calculate the next page based on current images
      const nextPage = Math.ceil((allUserImages?.length || 0) / 20) + 1;
      console.log('HistoryModal: Calculated next page as', nextPage);
      
      // Import the API service directly to make the call
      const { apiService } = await import('../services/apiService');
      
      // Make a direct API call to get user history
      console.log('HistoryModal: Making direct API call for user history page', nextPage);
      const response = await apiService.getUserImages({
        page: nextPage,
        limit: 20,
        _cb: Date.now() // Cache busting
      });
      
      console.log('HistoryModal: Received', response?.images?.length, 'new images');
      
      // If we got images, append them to the existing ones
      if (response && response.images && response.images.length > 0) {
        // Update our local state with the new images
        const updatedImages = [...allUserImages, ...response.images];
        console.log('HistoryModal: Updating images array from', allUserImages.length, 'to', updatedImages.length);
        setAllUserImages(updatedImages);
        
        // If we got fewer than 20 new images, we've reached the end
        if (response.images.length < 20) {
          console.log('HistoryModal: No more images to load');
          setHasMoreUserImages(false);
        }
        
        // Call refreshMainScreen to update the global state
        if (typeof refreshMainScreen === 'function') {
          console.log('HistoryModal: Refreshing main screen to update state');
          refreshMainScreen();
        }
      } else {
        console.log('HistoryModal: No more images to load');
        setHasMoreUserImages(false);
      }
    } catch (error) {
      console.error('Error loading next page of history:', error);
    }
  };
  
  // Update allUserImages when userImages changes
  useEffect(() => {
    setAllUserImages(userImages || []);
  }, [userImages]);
  
  return (
    <ImageHistory
      images={allUserImages}
      userId={userId}
      onClose={onClose}
      onDownload={handleDownload}
      isDownloading={downloadingImageId}
      onClearHistory={() => {
        toast({
          title: 'Clearing History',
          description: 'Your generation history is being cleared...'
        });
        // Simulate clearing history and refreshing
        setTimeout(() => {
          refreshMainScreen();
          toast({
            title: 'History Cleared',
            description: 'Your generation history has been cleared successfully.'
          });
        }, 1000);
      }}
      isLoading={isLoadingMainScreen}
      onReusePrompt={handleReusePrompt}
      onToggleLike={toggleLike}
      likedImages={likedImages}
      likeCounts={likeCounts}
      onQuoteRequest={(image) => {
        setSelectedImage(image);
        setShowQuoteModal(true);
        setIsHistoryOpen(false);
      }}
      onTogglePrivacy={(imageId) => {
        console.log('Toggle privacy for image:', imageId);
        // Implement privacy toggle if needed
      }}
      loadNextPage={loadNextPageOfHistory}
      hasMore={hasMoreUserImages}
    />
  );
}

export default HistoryModal;
