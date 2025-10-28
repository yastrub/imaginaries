import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useViewportOverlay } from '../hooks/useViewportOverlay';
import { X, Clock, Trash2, Loader2 } from 'lucide-react';
import { QuoteModal } from './QuoteModal';
import { Button } from './ui/button';
import { ImageCard } from './ImageCard';
import { ImageCardSkeleton } from './ImageCardSkeleton';
import { useInView } from 'react-intersection-observer';
import { useSubscription } from '../hooks/useSubscription';
import { ALLOW_DELETE_IMAGES } from '../config/featureFlags';

const ITEMS_PER_PAGE = 12;
const SKELETON_COUNT = 10; // Number of skeleton cards to show during loading

// CRITICAL EVENT HANDLING FIX:
// PREVENT EVENTS FROM BUBBLING UP TO ROUTER!
//
// 1. USE CUSTOM WRAPPER FOR LIKE EVENTS - Stop propagation completely
// 2. PREVENT DEFAULT BEHAVIOR - Avoid page reloads
// 3. ISOLATE COMPONENT EVENTS - Keep events from reaching router
//
// This ensures like events don't trigger router navigation

export function ImageHistory({ 
  images, 
  userId,
  onClose, 
  onDownload, 
  isDownloading, 
  onClearHistory, 
  isLoading,
  onReusePrompt,
  onToggleLike,
  likedImages,
  likeCounts,
  onQuoteRequest,
  onTogglePrivacy,
  loadNextPage,
  hasMore
}) {
  const overlayStyle = useViewportOverlay();
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [visibleItems, setVisibleItems] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // Create a wrapped version of onToggleLike that prevents event propagation
  // This is crucial to prevent router navigation when liking an image
  const safeToggleLike = React.useCallback(async (imageId) => {
    console.log('ImageHistory: safeToggleLike called for image', imageId);
    // Create a promise that resolves with the result of onToggleLike
    // This prevents the event from bubbling up to the router
    try {
      return new Promise((resolve) => {
        // Use setTimeout to break the event chain
        setTimeout(async () => {
          try {
            // Check if onToggleLike is a function
            if (typeof onToggleLike === 'function') {
              // Call the original onToggleLike function
              const result = await onToggleLike(imageId);
              console.log('ImageHistory: onToggleLike result:', result);
              resolve(result);
            } else {
              console.warn('ImageHistory: onToggleLike is not a function');
              resolve(false);
            }
          } catch (error) {
            console.error('ImageHistory: Error in safeToggleLike:', error);
            resolve(false);
          }
        }, 0);
      });
    } catch (error) {
      console.error('ImageHistory: Error in outer safeToggleLike:', error);
      return false;
    }
  }, [onToggleLike]);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const { plan } = useSubscription();

  // Handle loading more images
  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      console.log('ImageHistory: Loading more images');
      setIsLoadingMore(true);
      
      try {
        // Call the loadNextPage function provided as a prop
        if (typeof loadNextPage === 'function') {
          Promise.resolve(loadNextPage())
            .then(() => {
              console.log('ImageHistory: Successfully loaded more images');
              setIsLoadingMore(false);
            })
            .catch(error => {
              console.error('ImageHistory: Error loading more images:', error);
              setIsLoadingMore(false);
            });
        } else {
          console.log('ImageHistory: loadNextPage is not a function');
          setIsLoadingMore(false);
        }
      } catch (error) {
        console.error('ImageHistory: Error in handleLoadMore:', error);
        setIsLoadingMore(false);
      }
    }
  }, [hasMore, isLoadingMore, loadNextPage]);

  const handleClearHistory = async () => {
    if (!ALLOW_DELETE_IMAGES) return;
    try {
      setIsDeletingHistory(true);
      await onClearHistory();
      setShowDeleteConfirm(false);
    } finally {
      setIsDeletingHistory(false);
    }
  };


  //
  // CRITICAL PERFORMANCE OPTIMIZATION:
  // MEMOIZE HANDLER FUNCTIONS TO PREVENT UNNECESSARY RE-RENDERS!
  //
  // 1. USE useCallback FOR EVENT HANDLERS - Prevents function recreation
  // 2. STABLE DEPENDENCY ARRAYS - Only recreate when dependencies change
  // 3. PREVENT PROP CHANGES - Keep props stable across renders
  //
  // This ensures ImageCard components don't re-render unnecessarily

  // Memoize the reuse prompt handler
  const handleReusePrompt = useCallback((prompt) => {
    onReusePrompt(prompt);
    onClose();
  }, [onReusePrompt, onClose]);  // Only recreate if these functions change

  // Memoize the quote request handler
  const handleQuoteRequest = useCallback((image) => {
    setSelectedImage(image);
    setShowQuoteModal(true);
  }, []);  // No dependencies, only create once

  const visibleImages = images.slice(0, visibleItems);
  const hasMoreVisible = visibleItems < images.length;

  // Render the delete confirmation modal content - not defining a new component
  const renderDeleteConfirmModal = React.useMemo(() => (
    <div className="fixed bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60]" style={overlayStyle}>
      <div className="bg-zinc-900 rounded-xl p-6 max-w-md mx-4 w-full">
        <h3 className="text-xl font-semibold text-white mb-4">Delete All Images</h3>
        <div className="space-y-4 mb-6">
          <p className="text-zinc-400">
            Are you sure you want to delete all your generated images? This action cannot be undone.
          </p>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-500 text-sm">
              Warning: All likes associated with your images will also be permanently deleted.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button
            variant="ghost"
            onClick={() => setShowDeleteConfirm(false)}
            disabled={isDeletingHistory}
            className="hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleClearHistory}
            disabled={isDeletingHistory}
            className="gap-2 bg-red-600 hover:bg-red-700"
          >
            {isDeletingHistory ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete All
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  ), [overlayStyle, isDeletingHistory, handleClearHistory, setShowDeleteConfirm]);

  // Track if images have been loaded at least once
  const [imagesEverLoaded, setImagesEverLoaded] = useState(false);
  
  // Listen for the history:append-images event
  useEffect(() => {
    const handleAppendHistoryImages = (event) => {
      const { images: newImages, hasMore: newHasMore } = event.detail;
      console.log('ImageHistory: Received history:append-images event with', newImages.length, 'new images');
      
      // Since we can't directly update the images prop, we need to use a different approach
      // We'll dispatch a custom event to notify the parent component
      console.log('ImageHistory: New images received, total would be', (images?.length || 0) + newImages.length);
      
      // Reset loading state
      setIsLoadingMore(false);
    };
    
    window.addEventListener('history:append-images', handleAppendHistoryImages);
    return () => {
      window.removeEventListener('history:append-images', handleAppendHistoryImages);
    };
  }, [images]);

  // When images arrive, mark them as loaded
  useEffect(() => {
    if (images && images.length > 0 && !imagesEverLoaded) {
      console.log('ImageHistory: Images loaded for the first time:', images.length);
      // Use a small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setImagesEverLoaded(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [images, imagesEverLoaded]);
  
  // Determine if we should show skeletons or images
  const showSkeletons = isLoading && !imagesEverLoaded;
  const showEmptyState = !isLoading && images.length === 0;
  const showImages = imagesEverLoaded || (!isLoading && images.length > 0);
  
  return (
    <div className="fixed bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4" style={overlayStyle}>
      <div className="bg-zinc-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-zinc-400" />
            <h2 className="text-xl font-semibold text-white">My Jewelry</h2>
          </div>
          <div className="flex items-center gap-4">
            {ALLOW_DELETE_IMAGES && images.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-zinc-400 hover:text-red-500"
                title="Clear history"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-zinc-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] custom-scrollbar">
          {/* Always render both skeletons and images, but control visibility with CSS */}
          {/* Skeleton loading state */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${showSkeletons ? 'block' : 'hidden'}`} style={{ contain: 'layout paint' }}>
            {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
              <ImageCardSkeleton key={`skeleton-${index}`} />
            ))}
          </div>
          
          {/* Empty state */}
          <div className={`text-center py-12 ${showEmptyState ? 'block' : 'hidden'}`}>
            <div className="w-16 h-16 mx-auto mb-4 text-zinc-600">
              <Clock className="w-full h-full" />
            </div>
            <p className="text-zinc-500">No images generated yet</p>
          </div>
          
          {/* Loaded images */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${showImages ? 'block' : 'hidden'}`} style={{ contain: 'layout paint' }}>
            {images.map((image) => (
              <div 
                key={image.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.nativeEvent) {
                    e.nativeEvent.stopImmediatePropagation();
                  }
                  console.log('History wrapper div clicked, stopping propagation');
                  return false;
                }}
                className="contents"
              >
                <ImageCard
                  image={image}
                  isAuthenticated={true}
                  onQuoteRequest={handleQuoteRequest}
                  onDownload={onDownload}
                  downloadingImageId={isDownloading}
                  onReusePrompt={handleReusePrompt}
                  onToggleLike={safeToggleLike}
                  isLiked={likedImages?.has(image.id)}
                  likesCount={likeCounts?.[image.id] || 0}
                  onTogglePrivacy={onTogglePrivacy}
                  allowPrivateImages={plan?.allowPrivateImages}
                  allImages={images}
                  currentIndex={images.findIndex(img => img.id === image.id)}
                />
              </div>
            ))}
            {hasMore && (
              <div className="col-span-full mt-8 mb-12 flex justify-center">
                <Button
                  variant="secondary"
                  onClick={handleLoadMore}
                  className="gap-2"
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {ALLOW_DELETE_IMAGES && showDeleteConfirm && renderDeleteConfirmModal}
      
      {showQuoteModal && selectedImage && (
        <QuoteModal
          image={selectedImage}
          onClose={() => {
            setShowQuoteModal(false);
            setSelectedImage(null);
          }}
        />
      )}
    </div>
  );
}
