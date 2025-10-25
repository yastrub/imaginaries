import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Download, BadgeDollarSign, Loader2, Repeat, Heart, Share2, Lock, Unlock, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from './ui/use-toast';
import { ImageLightbox } from './ImageLightbox';


// CRITICAL PERFORMANCE OPTIMIZATION:
// PREVENT UNNECESSARY RE-RENDERS WITH REACT.MEMO!
//
// 1. WRAP COMPONENT WITH REACT.MEMO - Only re-render when props change
// 2. MAINTAIN PROP STABILITY - Ensure props are stable across renders
// 3. OPTIMIZE FOR FREQUENT RENDERING - ImageCard appears many times in lists
//
// This ensures the component only re-renders when its props actually change

function ImageCardComponent({ 
  image, 
  isAuthenticated = false,
  onQuoteRequest,
  onDownload,
  downloadingImageId,
  showActions = true,
  onReusePrompt,
  onToggleLike,
  hideDescription = false,
  onTogglePrivacy,
  allowPrivateImages = false,
  isLiked,
  likesCount,
  allImages = [],
  currentIndex = 0,
  isPublicGallery = false // New prop to identify if this is in the public gallery
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDescriptionHovering, setIsDescriptionHovering] = useState(false);
  const [isLikeHovered, setIsLikeHovered] = useState(false);
  const [isLikedState, setIsLikedState] = useState(isLiked);
  const [likesCountState, setLikesCountState] = useState(likesCount || 0);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [imageHeight, setImageHeight] = useState(0);
  const imageRef = useRef(null);
  const { toast } = useToast();

  // Update local state when props change
  useEffect(() => {
    // Check all possible sources for liked status
    // First check if the image object has is_liked property
    // Then check if the image is in the likedImages set (passed from parent)
    // Finally fall back to isLiked prop
    let likedStatus = false;
    
    if (image.is_liked !== undefined) {
      // Convert to boolean to handle string values like 'true'/'false'
      likedStatus = image.is_liked === true || image.is_liked === 'true';
    } else if (isLiked !== undefined) {
      likedStatus = !!isLiked;
    }
    
    setIsLikedState(likedStatus);
    
    // Similarly, prioritize like_count from the image object
    setLikesCountState(parseInt(image.like_count || likesCount || 0, 10));
  }, [image, isLiked, likesCount]);

  useEffect(() => {
    if (!isDescriptionHovering && !isExpanded) return;

    const handleClickOutside = () => {
      if (isExpanded) setIsExpanded(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isDescriptionHovering, isExpanded]);
  
  // Measure image height when it loads
  useEffect(() => {
    // Define the update function with proper null checks
    const updateImageHeight = () => {
      if (imageRef.current) {
        const height = imageRef.current.clientHeight;
        setImageHeight(height);
      }
    };
    
    // Initial measurement (with a small delay to ensure DOM is ready)
    setTimeout(updateImageHeight, 0);
    
    // Update on window resize
    window.addEventListener('resize', updateImageHeight);
    
    // Update when image loads (only if ref exists)
    if (imageRef.current) {
      imageRef.current.addEventListener('load', updateImageHeight);
    }
    
    return () => {
      window.removeEventListener('resize', updateImageHeight);
      if (imageRef.current) {
        imageRef.current.removeEventListener('load', updateImageHeight);
      }
    };
  }, []);

  const handleDescriptionClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleReuseClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onReusePrompt) {
      onReusePrompt(image.prompt);
    }
  };

  const handleLikeClick = async (e) => {
    // ███████╗████████╗ ██████╗ ██████╗     ██╗
    // ██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗    ██║
    // ███████╗   ██║   ██║   ██║██████╔╝    ██║
    // ╚════██║   ██║   ██║   ██║██╔═══╝     ╚═╝
    // ███████║   ██║   ╚██████╔╝██║         ██╗
    // ╚══════╝   ╚═╝    ╚═════╝ ╚═╝         ╚═╝
    //
    // CRITICAL EVENT HANDLING FIX:
    // PREVENT ROUTER NAVIGATION WHEN LIKING IMAGES!
    //
    // Ensure the event doesn't propagate and prevent default behavior
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      // Use the native event object to ensure propagation is completely stopped
      if (e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation();
      }
    }
    
    if (!isAuthenticated) return false;

    // CRITICAL FIX: Use setTimeout to break the event chain completely
    // This prevents router navigation by executing the like action
    // in a completely separate call stack from the event handler
    setTimeout(() => {
      // Set loading state before API call
      setIsLikeLoading(true);

      // Use a promise to handle the async operation
      const likePromise = async () => {
        try {
          // Call the onToggleLike function and get the updated like status
          const success = await onToggleLike(image.id);
          
          if (success) {
            // Update the local state based on the current state
            // This ensures the UI updates immediately without waiting for a refetch
            setIsLikedState(prev => !prev);
            setLikesCountState(prev => prev + (isLikedState ? -1 : 1));
            
            // Also update the image object directly for consistency
            image.is_liked = !isLikedState;
            image.like_count = parseInt(image.like_count || 0, 10) + (isLikedState ? -1 : 1);
          }
        } catch (error) {
          console.error('Error toggling like:', error);
          toast({
            title: "Failed to like image",
            description: "Please try again",
            variant: "destructive",
          });
        } finally {
          // Reset loading state after API call completes (success or error)
          setIsLikeLoading(false);
        }
      };
      
      // Execute the promise
      likePromise();
    }, 0);
    
    // Return false to prevent any default behavior
    return false;
  };

  const handlePrivacyToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onTogglePrivacy) {
      try {
        await onTogglePrivacy(image.id, !image.is_private);
        toast({
          title: image.is_private ? "Image is now public" : "Image is now private",
          description: image.is_private 
            ? "Your image will be visible in the gallery" 
            : "Your image will only be visible to you",
        });
      } catch (error) {
        toast({
          title: "Failed to update privacy",
          description: "Please try again",
          variant: "destructive",
        });
      }
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // All images are sharable with direct link, even private ones
    const shareUrl = `${window.location.origin}/share/${image.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      
      // Show different toast messages based on privacy status
      if (image.is_private) {
        toast({
          title: "Private image link copied!",
          description: "Anyone with this link can view this private image",
        });
      } else {
        toast({
          title: "Link copied!",
          description: "Share link has been copied to your clipboard",
        });
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  // Handle image click to open lightbox
  const handleImageClick = (e) => {
    // Always prevent default behavior to avoid page reloads
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      // Use the native event object to ensure propagation is completely stopped
      if (e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation();
      }
    }
    
    // Don't open lightbox if clicking on a button or SVG inside a button
    if (e && (e.target.closest('button') || e.target.closest('svg'))) {
      return false;
    }
    
    // Open the lightbox
    setIsLightboxOpen(true);
    
    // Return false to prevent any default behavior
    return false;
  };

  return (
    <>
      {/* Lightbox - persistently mounted to avoid remount flicker */}
      <ImageLightbox 
        open={isLightboxOpen}
        image={image} 
        images={useMemo(() => (allImages.length > 0 ? allImages : [image]), [allImages, image])}
        currentIndex={currentIndex}
        onClose={() => setIsLightboxOpen(false)}
        isAuthenticated={isAuthenticated}
        onQuoteRequest={onQuoteRequest}
        onDownload={onDownload}
        downloadingImageId={downloadingImageId}
        onReusePrompt={onReusePrompt}
        onToggleLike={onToggleLike}
        isLiked={isLikedState}
        likesCount={likesCountState}
        isPublicGallery={isPublicGallery} /* Pass the isPublicGallery prop */
      />
      
      <div 
        className="relative group rounded-lg overflow-hidden bg-zinc-800 aspect-square cursor-pointer"
        onClick={handleImageClick}
      >
      <img
        ref={imageRef}
        src={image.image_url || image.url}
        alt={image.prompt}
        className="w-full h-full object-cover pointer-events-none select-none"
        onContextMenu={(e) => e.preventDefault()}
        draggable="false"
        style={{
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none'
        }}
      />
      
      {/* Date display - separate from description, positioned higher - only shown if not in public gallery */}
      {!hideDescription && !isPublicGallery && (image.created_at || image.createdAt) && (
        <div className="absolute bottom-[3.5rem] left-0 right-0 px-4 pointer-events-none">
          <span className="text-zinc-300 text-xs block">
            {new Date(image.created_at || image.createdAt).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Like button - always visible */}
      {showActions && isAuthenticated && (
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {/* Like button with count */}
          <div className="flex items-center">
            <div 
              onClick={(e) => {
                // Ensure event doesn't propagate and prevent default behavior
                if (e) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                }
                handleLikeClick(e);
                return false;
              }}
              onMouseEnter={() => setIsLikeHovered(true)}
              onMouseLeave={() => setIsLikeHovered(false)}
              className={`m-[5px] rounded-md flex items-center justify-center cursor-pointer ${
                isLikeLoading ? 'opacity-50 cursor-not-allowed' : ''
              } ${!isLikedState && 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]'}`}
              role="button"
              aria-label={isLikedState ? "Unlike" : "Like"}
              tabIndex="0"
            >
              {isLikeLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <Heart
                  className={`w-5 h-5 transition-colors duration-200 ${
                    isLikedState || isLikeHovered ? 'fill-primary text-primary' : 'text-white/70'
                  }`}
                  style={{
                    filter: !isLikedState ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' : 'none'
                  }}
                />
              )}
            </div>
            {/* Like count - simple text with shadow */}
            <span className="text-white text-sm drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] ml-1">
              {likesCountState}
            </span>
          </div>
          
          {/* Private indicator */}
          {image.is_private && (
            <div className="flex items-center" title="This image is private">
              <div className="m-[5px] rounded-md flex items-center justify-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                <EyeOff className="w-5 h-5 text-white/70" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {showActions && isAuthenticated && (
        <div className="absolute top-3 right-3 flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
          {allowPrivateImages && (
            <Button
              variant="default"
              size="icon"
              onClick={handlePrivacyToggle}
              className="h-10 w-10"
              title={image.is_private ? "Make public" : "Make private"}
            >
              {image.is_private ? (
                <Lock className="w-5 h-5" />
              ) : (
                <Unlock className="w-5 h-5" />
              )}
            </Button>
          )}
          <Button
            variant="default"
            size="icon"
            onClick={() => onQuoteRequest(image)}
            className="h-10 w-10"
          >
            <BadgeDollarSign className="w-5 h-5" />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={handleShare}
            className="h-10 w-10"
          >
            <Share2 className="w-5 h-5" />
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={(e) => {
              // Prevent event propagation and default behavior
              e.preventDefault();
              e.stopPropagation();
              // Use setTimeout to break the event chain completely
              setTimeout(() => {
                onDownload(image);
              }, 0);
            }}
            disabled={downloadingImageId === image.id}
            className="h-10 w-10"
          >
            {downloadingImageId === image.id ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
          </Button>
        </div>
      )}

      {/* Image info - only show if not hiding description and not in public gallery */}
      {!hideDescription && !isPublicGallery && image.prompt && (
        <div 
          className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none"
        >
          <div 
            className="bg-[#c7c7c74a] backdrop-blur-sm rounded p-2 pointer-events-auto transition-all duration-200" 
            onClick={handleDescriptionClick}
            onMouseEnter={() => setIsDescriptionHovering(true)}
            onMouseLeave={() => setIsDescriptionHovering(false)}
          >
            <div className="relative">
              {(isExpanded || isDescriptionHovering) && onReusePrompt && (
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleReuseClick}
                  className="absolute bottom-0 right-0 h-6 w-6 z-10"
                  title="Reuse prompt"
                >
                  <Repeat className="w-3 h-3 text-[rgb(10,10,10)]" />
                </Button>
              )}
              <p className={`text-[rgb(10,10,10)] text-sm pr-8 ${!isExpanded && !isDescriptionHovering ? 'truncate' : 'overflow-y-auto scrollbar-thin scrollbar-thumb-white scrollbar-track-transparent scrollbar-track-rounded-md scrollbar-thumb-rounded-md'}`} style={{maxHeight: isExpanded || isDescriptionHovering ? `${Math.max(50, imageHeight * 0.5)}px` : 'none'}}>
                {image.prompt || 'No description'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

// Export a memoized version of the component to prevent unnecessary re-renders
// This is especially important for components that appear in lists
export const ImageCard = React.memo(ImageCardComponent);