import React, { useState, useEffect, useRef } from 'react';
import { useImageDownload } from '../hooks/useImageDownload';
import { QuoteModal } from './QuoteModal';
import { ImageCard } from './ImageCard';
import { triggerConfetti, CONFETTI_EVENTS } from './GlobalConfetti';

// EMERGENCY FIX: Completely simplified component to break render loops
export const ImageResults = React.memo(function ImageResults({
  images,
  publicImages,
  isLoading,
  isGenerating,
  isAuthenticated,
  onReusePrompt,
  onToggleLike,
  likedImages,
  likeCounts
}) {
  // Basic state
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const { handleDownload, downloadingImageId } = useImageDownload();
  
  // Use the isLoading prop directly instead of maintaining our own state
  // This ensures we're in sync with the parent component
  // const [loading, setLoading] = useState(true);
  
  // Ref to track mounted state
  const mounted = useRef(false);
  
  // Determine which images to show based on authentication state
  // CRITICAL FIX: For authenticated users, show their images ONLY if they exist
  // Otherwise show empty array (not public images)
  const displayImages = React.useMemo(() => {
    // Log the incoming image data
    console.log('ImageResults calculating displayImages:', {
      isAuthenticated,
      images: images?.length || 0,
      publicImages: publicImages?.length || 0
    });
    
    // EMERGENCY FIX: Ensure we're working with arrays
    const safeImages = Array.isArray(images) ? images : [];
    const safePublicImages = Array.isArray(publicImages) ? publicImages : [];
    
    // If we have images from the combined API endpoint, use those directly
    // The API already handles the logic of which images to show based on auth
    const result = isAuthenticated
      ? (safeImages.length > 0 ? safeImages.slice(0, 10) : [])
      : (safePublicImages.length > 0 ? safePublicImages.slice(0, 10) : []);
    
    console.log('ImageResults displayImages result:', result.length);
    return result;
  }, [isAuthenticated, images, publicImages]);

  // One-time debug output to help diagnose issues
  // Using ref to ensure it only runs once
  const hasLogged = useRef(false);
  useEffect(() => {
    if (!hasLogged.current) {
      console.log('ImageResults initial props:', {
        isAuthenticated,
        imagesLength: images?.length || 0,
        publicImagesLength: publicImages?.length || 0
      });
      hasLogged.current = true;
    }
  }, []);

  // Simple initialization effect
  useEffect(() => {
    mounted.current = true;
    console.log('ImageResults mounted, isLoading:', isLoading);
    
    return () => {
      mounted.current = false;
    };
  }, []);
  
  // Show confetti when generation completes
  useEffect(() => {
    if (!isGenerating && images && images.length > 0) {
      triggerConfetti(CONFETTI_EVENTS.GENERATION_SUCCESS);
    }
  }, [isGenerating, images]);

  // Handle quote request
  const handleQuoteRequest = (image) => {
    setSelectedImage(image);
    setShowQuoteModal(true);
  };

  // Create a wrapper for the onToggleLike function to ensure it's properly handled
  const handleToggleLike = React.useCallback(async (imageId) => {
    console.log('ImageResults: handleToggleLike called for image', imageId);
    try {
      if (typeof onToggleLike === 'function') {
        const result = await onToggleLike(imageId);
        console.log('ImageResults: onToggleLike result:', result);
        return result;
      } else {
        console.warn('ImageResults: onToggleLike is not a function');
        return false;
      }
    } catch (error) {
      console.error('ImageResults: Error in handleToggleLike:', error);
      return false;
    }
  }, [onToggleLike]);

  // Helper to compute a stable key when id is missing
  const getImageKey = (img, index) => {
    if (img && (img.id !== undefined && img.id !== null)) return img.id;
    return img?.url || img?.image_url || img?.created_at || img?.createdAt || `idx-${index}`;
  };

  return (
    <>
      {/* Debug indicators removed */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ contain: 'layout paint' }}>
        {/* Show skeleton loader while loading */}
        {isLoading && (
          <>
            {[...Array(10)].map((_, index) => (
              <div 
                key={`skeleton-${index}`} 
                className="w-full aspect-square"
                style={{
                  position: 'relative',
                  gridColumn: 'span 1',
                  gridRow: 'span 1'
                }}
              >
                <div className="w-full h-full bg-zinc-800 rounded-xl animate-pulse" />
              </div>
            ))}
          </>
        )}
        
        {/* Show images when loaded */}
        {!isLoading && (
          <>
            {(() => {
              const pendingList = isGenerating ? [{ id: 'pending:gen' }] : [];
              const combined = [...pendingList, ...displayImages];
              return combined.length > 0 ? (
                combined.map((image, index) => (
                  <div 
                    key={getImageKey(image, index)}
                    className="w-full aspect-square relative"
                  >
                  {String(image?.id || '').startsWith('pending:') ? (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl animate-pulse flex items-center justify-center">
                      <div className="text-white text-center p-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mx-auto mb-2"></div>
                        <p className="text-sm font-medium">Creating your masterpiece...</p>
                      </div>
                    </div>
                  ) : (
                    <ImageCard
                      key={getImageKey(image, index)}
                      image={image}
                      isAuthenticated={isAuthenticated}
                      onQuoteRequest={handleQuoteRequest}
                      onDownload={handleDownload}
                      downloadingImageId={downloadingImageId}
                      onReusePrompt={onReusePrompt}
                      onToggleLike={handleToggleLike}
                      isLiked={likedImages?.has(image?.id) || false}
                      likesCount={likeCounts?.[image?.id] || image?.like_count || 0}
                      allImages={isAuthenticated ? images : publicImages}
                      currentIndex={index}
                    />
                  )}
                  </div>
                ))
              ) : (
              // Show message when authenticated user has no images
              isAuthenticated && (
                <div className="col-span-2 py-8 text-center">
                  <p className="text-zinc-400">No images in your history yet.</p>
                  <p className="text-zinc-500 text-sm mt-2">Create your first image to see it here!</p>
                </div>
              )
            })()}
          </>
        )}
      </div>

      {/* Quote modal */}
      {showQuoteModal && selectedImage && (
        <QuoteModal
          image={selectedImage}
          onClose={() => {
            setShowQuoteModal(false);
            setSelectedImage(null);
          }}
        />
      )}
    </>
  );
});