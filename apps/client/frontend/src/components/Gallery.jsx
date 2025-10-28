import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ImageCard } from './ImageCard';
import { ImageCardSkeleton } from './ImageCardSkeleton';
import { Button } from './ui/button';
import { Loader2, Clock, ThumbsUp } from 'lucide-react';
import { useInView } from 'react-intersection-observer';
import { QuoteModal } from './QuoteModal';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

const ITEMS_PER_PAGE = 12;
const SKELETON_COUNT = 10; // Number of skeleton cards to show during loading

export function Gallery({
  images: initialImages,
  isLoading,
  isAuthenticated,
  onQuoteRequest,
  onDownload,
  downloadingImageId,
  onReusePrompt,
  onToggleLike,
  likedImages,
  likeCounts,
  loadImages,
  hasMore: initialHasMore,
  currentView = 'recent',
  switchView = () => {},
  isMainScreenGallery = false
}) {
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  // Removed local pagination logic that was causing the semi-fake Load More behavior
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(currentView);
  
  // Add local state to manage images and hasMore when parent props aren't available
  const [images, setImages] = useState(initialImages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  
  // Track authentication state from Redux store
  const reduxAuthState = useSelector(state => state.auth.isAuthenticated);
  const prevAuthStateRef = useRef(reduxAuthState);
  const navigate = useNavigate();
  
  // Only log this once during initial render
  const didLogRef = useRef(false);
  useEffect(() => {
    if (!didLogRef.current) {
      console.log('Gallery: isMainScreenGallery:', isMainScreenGallery, 'path:', window.location.pathname);
      didLogRef.current = true;
    }
  }, [isMainScreenGallery]);
  
  // Path tracking for route changes
  const [previousPath, setPreviousPath] = useState(window.location.pathname);
  
  // Force public images for gallery routes and trigger data loading
  useEffect(() => {
    // Get current path
    const currentPath = window.location.pathname;
    const isGalleryPath = currentPath.startsWith('/gallery') || currentPath === '/';
    const pathChanged = currentPath !== previousPath;
    
    console.log('Gallery component path check:', {
      currentPath,
      previousPath,
      isGalleryPath,
      pathChanged
    });
    
    // Update path tracking
    setPreviousPath(currentPath);
    
    if (isGalleryPath) {
      console.log('Gallery: On gallery path, forcing public images');
      setIsTabLoading(true);
      
      // CRITICAL: Ensure we're showing public images (default behavior), not user history
      if (typeof window.toggleHistoryView === 'function') {
        console.log('Gallery: Explicitly showing public images via toggleHistoryView(false)');
        window.toggleHistoryView(false);
      }
      
      // Set active tab based on URL path
      if (currentPath === '/gallery/top') {
        setActiveTab('top-liked');
      } else if (currentPath === '/gallery' || currentPath === '/') {
        setActiveTab('recent');
      }
      
      // Always force a data reload when on gallery routes
      // This is especially important when coming from other routes
      // CRITICAL FIX: Always load images immediately, don't use setTimeout
      if (typeof loadImages === 'function') {
        console.log('Gallery: Triggering data load for public images');
        // CRITICAL FIX: Always use 'top-liked' (not 'top') to match apiService.js condition
        loadImages(1, activeTab === 'top-liked' ? 'top-liked' : 'recent');
      }
    }
  }, [loadImages, window.location.pathname, activeTab]); // Explicitly depend on pathname and activeTab to detect route changes
  
  // We still use the intersection observer for potential future optimizations
  // but we don't automatically load more images when it comes into view
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false
  });
  
  // Update local active tab state when currentView prop changes
  useEffect(() => {
    console.log('Gallery component received currentView:', currentView);
    setActiveTab(currentView);
    
    // When view changes, ensure we're showing public images if on gallery route
    const isGalleryPath = window.location.pathname.startsWith('/gallery') || window.location.pathname === '/';
    if (isGalleryPath && typeof window.toggleHistoryView === 'function') {
      console.log('Gallery: View changed, ensuring public images');
      window.toggleHistoryView(false);
      
      // Reload data with the new view
      if (typeof loadImages === 'function') {
        loadImages(1, currentView === 'top-liked' ? 'top' : 'recent');
      }
    }
  }, [currentView, loadImages]);
  
  // Monitor authentication state changes and reload data when user logs in
  // BUT only on the main screen, not in the dedicated gallery section
  useEffect(() => {
    // Only trigger reload on the main screen gallery
    if (isMainScreenGallery) {
      // Check if auth state changed from false to true (user just logged in)
      if (!prevAuthStateRef.current && reduxAuthState) {
        console.log('Gallery: Auth state changed from FALSE to TRUE, reloading data (main screen only)');
        setIsTabLoading(true);
        
        // Trigger data reload
        if (typeof loadImages === 'function') {
          // Use a small timeout to ensure Redux state is fully updated
          setTimeout(() => {
            loadImages();
          }, 100);
        }
      }
    } else {
      console.log('Gallery: Auth state change detected but ignoring (not on dedicated gallery section)');
    }
    
    // Update the ref for next comparison
    prevAuthStateRef.current = reduxAuthState;
  }, [reduxAuthState, loadImages, isMainScreenGallery]);

  // Handle tab switching with loading state
  const handleSwitchView = useCallback((newView) => {
    if (newView !== activeTab) {
      console.log('Attempting to switch view from', activeTab, 'to', newView);
      setIsTabLoading(true);
      setActiveTab(newView); // Update local state immediately for UI feedback
      
      try {
        // CRITICAL: Ensure public images when switching tabs
        if (typeof window.toggleHistoryView === 'function') {
          console.log('Gallery: Tab switch, ensuring public images');
          window.toggleHistoryView(false);
        }
        
        // Update URL for dedicated gallery routes
        if (window.location.pathname.startsWith('/gallery')) {
          // Navigate to the appropriate URL based on the view
          // Use { replace: false } to preserve browser history
          if (newView === 'top-liked') {
            navigate('/gallery/top', { replace: false });
          } else {
            navigate('/gallery', { replace: false });
          }
        }
        
        // CRITICAL FIX: Only call loadImages directly, don't call switchView first
        // This prevents double requests since the URL change will trigger useEffect
        // which will call loadImages again
        if (typeof loadImages === 'function') {
          // Use the correct view parameter for the API call
          // CRITICAL FIX: Always use 'top-liked' (not 'top') to match apiService.js condition
          const viewParam = newView === 'top-liked' ? 'top-liked' : 'recent';
          console.log('Gallery: Triggering data load after tab switch with view:', viewParam);
          loadImages(1, viewParam);
        }
      } catch (error) {
        console.error('Error switching view:', error);
      }
    }
  }, [activeTab, loadImages, navigate]);
  
  // Reset loading state when images are loaded
  useEffect(() => {
    if (isTabLoading && !isLoading) {
      setIsTabLoading(false);
    }
  }, [isLoading, isTabLoading]);
  
  // Local state for button loading
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Handle loading more images from the server
  const loadMoreImages = useCallback(() => {
    if (hasMore && !isLoading && !isTabLoading && !isLoadingMore) {
      console.log('Gallery: Loading next page of images from server');
      // Set both loading states to ensure UI updates
      setIsTabLoading(true);
      setIsLoadingMore(true);
      
      try {
        // Get the correct view parameter based on the active tab
        const viewParam = activeTab === 'top-liked' ? 'top' : 'recent';
        console.log('Gallery: Attempting to load more with view:', viewParam);
        
        if (typeof loadImages === 'function') {
          // Call the hook's loadData function with undefined to trigger loadNextPage
          loadImages(undefined, viewParam);
        } else {
          // Silently use fallback without error message
          // Fallback: Make a direct API call without page reload
          import('../services/apiService').then(module => {
            const { apiService } = module;
            // Calculate next page based on current images
            const nextPage = Math.ceil(images.length / 20) + 1;
            console.log('Gallery: Calculating next page as', nextPage, 'based on', images.length, 'images');
            
            // Make the correct API call based on the active tab
            const apiParams = {
              page: nextPage,
              limit: 20,
              _cb: Date.now() // Cache busting
            };
            
            // Use the correct endpoint based on the active tab
            let apiCall;
            if (viewParam === 'top') {
              console.log('Gallery: Making API call for top-liked view');
              apiCall = apiService.getRecentImages({ ...apiParams, view: 'top-liked' });
            } else {
              console.log('Gallery: Making API call for recent view');
              apiCall = apiService.getRecentImages({ ...apiParams, view: 'recent' });
            }
            
            apiCall.then(response => {
              console.log('Gallery: Direct API call successful for', viewParam, 'view, got', response?.images?.length, 'new images');
              
              if (response && response.images && response.images.length > 0) {
                // Manually append the new images to the existing ones
                // This is done by updating the parent component's state
                const newImages = [...images, ...response.images];
                
                // Create a custom event to notify the parent component
                const updateEvent = new CustomEvent('gallery:append-images', { 
                  detail: { 
                    images: response.images,
                    hasMore: response.hasMore,
                    totalPages: response.totalPages
                  } 
                });
                window.dispatchEvent(updateEvent);
                
                // If we can't update the parent, at least update our local state
                // This will cause a re-render with the new images
                if (typeof setImages === 'function') {
                  setImages(newImages);
                }
              } else {
                console.log('Gallery: No more images to load');
              }
              
              // Reset loading states
              setIsLoadingMore(false);
              setIsTabLoading(false);
            }).catch(err => {
              console.error('Gallery: Direct API call failed', err);
              setIsLoadingMore(false);
              setIsTabLoading(false);
            });
          }).catch(err => {
            console.error('Gallery: Failed to import apiService', err);
            setIsLoadingMore(false);
            setIsTabLoading(false);
          });
        }
      } catch (error) {
        console.error('Error loading more images:', error);
        setIsLoadingMore(false);
        setIsTabLoading(false);
      }
    }
  }, [hasMore, isLoading, isTabLoading, isLoadingMore, loadImages, activeTab, images]);

  const handleQuoteRequest = (image) => {
    setSelectedImage(image);
    setShowQuoteModal(true);
  };

  // Create a wrapper for the onToggleLike function to ensure it's properly handled
  const handleToggleLike = useCallback(async (imageId) => {
    console.log('Gallery: handleToggleLike called for image', imageId);
    try {
      if (typeof onToggleLike === 'function') {
        const result = await onToggleLike(imageId);
        console.log('Gallery: onToggleLike result:', result);
        return result;
      } else {
        console.warn('Gallery: onToggleLike is not a function');
        return false;
      }
    } catch (error) {
      console.error('Gallery: Error in handleToggleLike:', error);
      return false;
    }
  }, [onToggleLike]);

  // Sort images if needed (server should already return them in the correct order)
  const sortedImages = React.useMemo(() => {
    // We trust the server's sorting but apply a local sort as a fallback
    return [...images].sort((a, b) => {
      if (currentView === 'recent') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else {
        const likesA = a.like_count || 0;
        const likesB = b.like_count || 0;
        return likesB - likesA;
      }
    });
  }, [images, currentView]);
  
  // Show all images we have - no local pagination
  const visibleImages = sortedImages;
  
  // Only show Load More if server indicates there are more items to load
  // The server already handles pagination correctly, so we should trust its hasMore flag
  const hasMoreToLoad = hasMore;
  
  // Only log pagination info when it changes
  const paginationInfoRef = useRef({});
  useEffect(() => {
    const currentInfo = {
      imagesCount: images.length,
      hasMore,
      isLoading,
      currentView,
      activeTab
    };
    
    // Only log if something changed
    if (JSON.stringify(currentInfo) !== JSON.stringify(paginationInfoRef.current)) {
      console.log('Gallery pagination info changed:', currentInfo);
      paginationInfoRef.current = currentInfo;
    }
  }, [images.length, hasMore, isLoading, currentView, activeTab]);
  
  // Update local state when props change
  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);
  
  useEffect(() => {
    setHasMore(initialHasMore);
  }, [initialHasMore]);
  
  // Listen for the custom event to update images
  useEffect(() => {
    const handleAppendImages = (event) => {
      const { images: newImages, hasMore: newHasMore } = event.detail;
      console.log('Gallery: Received append-images event with', newImages.length, 'new images');
      
      setImages(prevImages => [...prevImages, ...newImages]);
      if (newHasMore !== undefined) {
        setHasMore(newHasMore);
      }
      setIsTabLoading(false);
    };
    
    window.addEventListener('gallery:append-images', handleAppendImages);
    return () => {
      window.removeEventListener('gallery:append-images', handleAppendImages);
    };
  }, []);

  // ██████╗ ██╗   ██╗
  // ██╔════╝██║   ██║
  // █████╗  ██║   ██║
  // ╚════██╗██║   ██║
  // ██████╔╝╚██████╔╝
  // ╚═════╝ ╚═════╝
  //
  // CRITICAL REACT HOOKS FIX:
  // DON'T CREATE COMPONENTS INSIDE OTHER COMPONENTS!
  //
  // 1. NEVER USE useMemo TO CREATE COMPONENTS - This causes React Hook errors
  // 2. DEFINE COMPONENTS OUTSIDE OR SEPARATELY - Components should be top-level
  // 3. MEMOIZE THE RENDERED OUTPUT, NOT THE COMPONENT - Use useMemo correctly
  //
  // This fixes the "Minified React error #306" when clicking Gallery
  const renderImageGrid = React.useMemo(() => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" style={{ contain: 'layout paint' }}>
      {visibleImages.map((image) => (
        <ImageCard
          key={image.id}
          image={image}
          isAuthenticated={isAuthenticated}
          onQuoteRequest={handleQuoteRequest}
          onDownload={() => onDownload(image)}
          downloadingImageId={downloadingImageId}
          onReusePrompt={(prompt) => onReusePrompt(prompt, true)}
          onToggleLike={handleToggleLike}
          isLiked={likedImages?.has(image.id)}
          likesCount={likeCounts?.[image.id] || 0}
          allImages={visibleImages}
          currentIndex={visibleImages.findIndex(img => img.id === image.id)}
          isPublicGallery={true} /* Always true in Gallery component */
        />
      ))}
      {/* Hidden reference element for intersection observer */}
      <div ref={loadMoreRef} className="col-span-full h-0 opacity-0"></div>
    </div>
  ), [visibleImages, isAuthenticated, handleQuoteRequest, onDownload, downloadingImageId, onReusePrompt, onToggleLike, likedImages, likeCounts, hasMore, loadMoreRef]);

  return (
    <div className="container mx-auto px-4 pt-32 pb-8">
      {/* Title and Tagline */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-light text-white mb-3">
          Public Gallery
        </h1>
        <p className="text-zinc-400 text-lg">
          Browse and ♥ masterpieces created by our community
        </p>
      </div>

      <div className="flex gap-4 mb-8 justify-center">
        <button
          className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all ${
            activeTab === 'recent' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
          onClick={() => handleSwitchView('recent')}
          disabled={isTabLoading}
        >
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">
            {isTabLoading && activeTab === 'recent' ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading...
              </span>
            ) : (
              'Recent'
            )}
          </span>
        </button>
        <button
          className={`px-4 py-2 rounded-md flex items-center gap-2 transition-all ${
            activeTab === 'top-liked' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
          onClick={() => handleSwitchView('top-liked')}
          disabled={isTabLoading}
        >
          <ThumbsUp className="w-4 h-4" />
          <span className="text-sm font-medium">
            {isTabLoading && activeTab === 'top-liked' ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading...
              </span>
            ) : (
              'Top Likes'
            )}
          </span>
        </button>
      </div>

      {isLoading || isTabLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" style={{ contain: 'layout paint' }}>
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <ImageCardSkeleton key={`skeleton-${index}`} />
          ))}
        </div>
      ) : visibleImages.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          No images found
        </div>
      ) : (
        renderImageGrid
      )}

      {/* Always show Load More if server says hasMore is true */}
      {hasMore && (
        <div className="mt-8 mb-12 flex justify-center">
          <Button
            variant="secondary"
            onClick={loadMoreImages}
            className="gap-2"
            disabled={isLoading || isTabLoading || isLoadingMore}
          >
            {isLoading || isTabLoading || isLoadingMore ? (
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