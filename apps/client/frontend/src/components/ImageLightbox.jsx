import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { createPortal } from 'react-dom';
import { showQrModal } from '../lib/qr';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, EyeOff, Heart, DollarSign, Share2, Download, Repeat } from 'lucide-react';

export function ImageLightbox({
  image, 
  images = [], 
  currentIndex = 0, 
  onClose, 
  onQuoteRequest, 
  onDownload, 
  downloadingImageId, 
  onReusePrompt, 
  onToggleLike, 
  isLiked, 
  likesCount, 
  isAuthenticated, 
  open = true,
  isPublicGallery = false // New prop to identify if this is in the public gallery
}) {
  const [loaded, setLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true); // Start with controls hidden
  // Delay showing spinner to avoid quick flash on cached images
  const [showSpinner, setShowSpinner] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isLikedState, setIsLikedState] = useState(isLiked);
  const [likesCountState, setLikesCountState] = useState(likesCount || 0);
  const [isDescriptionHovering, setIsDescriptionHovering] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const imageRef = useRef(null);
  const prevSrcRef = useRef(null);
  const [prevDisplayedSrc, setPrevDisplayedSrc] = useState(null);
  const [hasShownOnce, setHasShownOnce] = useState(false);
  const [activeIndex, setActiveIndex] = useState(currentIndex);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [touchDragStart, setTouchDragStart] = useState(null);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState(null);
  const isTerminalApp = useSelector((state) => state?.env?.isTerminalApp);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const canGoNextRef = useRef(false);
  const canGoPrevRef = useRef(false);
  
  // Get the current image from the array or use the single image prop
  const currentImage = images.length > 0 ? images[activeIndex] : image;
  
  // Log when active index changes (avoid resetting `loaded` here to prevent flicker)
  useEffect(() => {
    console.log('Navigation - Active index:', activeIndex);
  }, [activeIndex]);

  // Only show a spinner if image isn't loaded after a short delay
  useEffect(() => {
    if (loaded) {
      setShowSpinner(false);
      return;
    }
    let t = setTimeout(() => setShowSpinner(true), 120);
    return () => clearTimeout(t);
  }, [loaded, currentImage]);

  // When the displayed image changes, set `loaded` based on cache state to avoid a flash
  // Only react when the actual src changes, not when the image object reference changes
  useEffect(() => {
    const src = currentImage?.image_url || currentImage?.url;
    if (prevSrcRef.current === src) {
      return; // no actual image change; avoid toggling loaded
    }
    prevSrcRef.current = src;

    // If element already rendered and complete, mark loaded
    if (imageRef.current && imageRef.current.complete) {
      setLoaded(true);
      return;
    }
    if (!src) {
      setLoaded(true);
      return;
    }
    const test = new Image();
    test.src = src;
    if (test.complete) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [currentImage?.image_url, currentImage?.url]);

  // Keep previous image available for background fallback whenever we consider the current one loaded
  useEffect(() => {
    const srcNow = currentImage?.image_url || currentImage?.url;
    if (loaded && srcNow) {
      setPrevDisplayedSrc(srcNow);
    }
  }, [loaded, currentImage?.image_url, currentImage?.url]);

  // Preload neighbor images to reduce flicker when navigating
  useEffect(() => {
    const preloadAt = (idx) => {
      const img = images[idx];
      const src = img?.image_url || img?.url;
      if (src) {
        const im = new Image();
        im.src = src;
      }
    };
    if (images.length > 1) {
      if (activeIndex < images.length - 1) preloadAt(activeIndex + 1);
      if (activeIndex > 0) preloadAt(activeIndex - 1);
    }
  }, [activeIndex, images]);
  
  // Check if navigation is possible
  const hasMultipleImages = images.length > 1;
  const canGoNext = hasMultipleImages && activeIndex < images.length - 1;
  const canGoPrev = hasMultipleImages && activeIndex > 0;
  // Sync navigation booleans into refs after they are defined
  useEffect(() => {
    canGoNextRef.current = canGoNext;
    canGoPrevRef.current = canGoPrev;
  }, [canGoNext, canGoPrev]);
  
  // Track the last navigation direction for keyboard navigation recovery
  const [lastNavDirection, setLastNavDirection] = useState(null);
  
  // Refs for swipe sensitivity
  const minSwipeDistance = 50;
  
  // Navigation functions
  const goToNext = () => {
    if (activeIndex < images.length - 1) {
      // Reset zoom and drag position
      setScale(1);
      setDragPosition({ x: 0, y: 0 });
      // Reset description expanded state
      setIsDescriptionExpanded(false);
      setIsDescriptionHovering(false);
      // Change the image index immediately
      setActiveIndex(activeIndex + 1);
    }
  };
  
  const goToPrev = () => {
    if (activeIndex > 0) {
      // Reset zoom and drag position
      setScale(1);
      setDragPosition({ x: 0, y: 0 });
      // Reset description expanded state
      setIsDescriptionExpanded(false);
      setIsDescriptionHovering(false);
      // Change the image index immediately
      setActiveIndex(activeIndex - 1);
    }
  };
  
  // Handle touch events for swipe detection and dragging
  const onTouchStart = (e) => {
    // If zoomed in, handle as drag rather than swipe
    if (scale > 1) {
      e.stopPropagation();
      setIsDragging(true);
      setTouchDragStart({
        x: e.touches[0].clientX - dragPosition.x,
        y: e.touches[0].clientY - dragPosition.y
      });
      return;
    }
    
    // Otherwise handle as swipe
    setTouchEnd(null); // Reset touchEnd
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };
  
  const onTouchMove = (e) => {
    // If we're dragging in zoomed mode
    if (scale > 1 && isDragging && touchDragStart) {
      e.stopPropagation();
      e.preventDefault(); // Prevent scrolling while dragging
      
      const newX = e.touches[0].clientX - touchDragStart.x;
      const newY = e.touches[0].clientY - touchDragStart.y;
      
      // Calculate max drag boundaries based on zoom level
      const maxDragX = (scale - 1) * 300;
      const maxDragY = (scale - 1) * 300;
      
      // Constrain drag within boundaries
      const constrainedX = Math.max(-maxDragX, Math.min(maxDragX, newX));
      const constrainedY = Math.max(-maxDragY, Math.min(maxDragY, newY));
      
      setDragPosition({ x: constrainedX, y: constrainedY });
      return;
    }
    
    // Otherwise track for swipe
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    });
  };
  
  const onTouchEnd = () => {
    // Reset dragging state if we were dragging
    if (isDragging) {
      setIsDragging(false);
      return;
    }
    
    // Handle swipe if not dragging
    if (!touchStart || !touchEnd) return;
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
    
    // Minimum distance required for a swipe - adjust as needed
    const minSwipeDistance = 50;
    
    if (isHorizontalSwipe && Math.abs(distanceX) > minSwipeDistance) {
      // Reset description expanded state on swipe
      setIsDescriptionExpanded(false);
      setIsDescriptionHovering(false);
      
      if (distanceX > 0 && canGoNext) {
        goToNext();
      } else if (distanceX < 0 && canGoPrev) {
        goToPrev();
      }
    }
  };
  
  // Handle zoom in/out
  const handleZoomIn = () => {
    const newScale = Math.min(scale + 0.5, 3);
    setScale(newScale);
    // Keep controls visible when zooming in, but hide other UI elements
    setShowControls(true);
  };
  
  const handleZoomOut = () => {
    const newScale = Math.max(scale - 0.5, 1);
    setScale(newScale);
    // Show controls back when fully zoomed out
    if (newScale === 1) {
      setShowControls(true);
      // Reset drag position when zoomed out
      setDragPosition({ x: 0, y: 0 });
    }
  };
  
  // Reset states when changing images
  useEffect(() => {
    setScale(1);
    setDragPosition({ x: 0, y: 0 });
    setIsDescriptionExpanded(false);
    setIsDescriptionHovering(false);
    // Don't show controls automatically when changing images
    // Let the user click to show them
  }, [activeIndex]);
  
  // Handle image dragging when zoomed in
  const handleMouseDown = (e) => {
    // Only enable dragging when zoomed in
    if (scale > 1) {
      e.preventDefault(); // Prevent image selection
      e.stopPropagation(); // Prevent other click handlers
      setIsDragging(true);
      setDragStart({ x: e.clientX - dragPosition.x, y: e.clientY - dragPosition.y });
    }
  };
  
  const handleMouseMove = useCallback((e) => {
    if (isDragging && scale > 1) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // Calculate max drag boundaries based on zoom level
      // The boundary increases with zoom level to allow more movement area
      const maxDragX = (scale - 1) * 300;
      const maxDragY = (scale - 1) * 300;
      
      // Constrain drag within boundaries
      const constrainedX = Math.max(-maxDragX, Math.min(maxDragX, newX));
      const constrainedY = Math.max(-maxDragY, Math.min(maxDragY, newY));
      
      setDragPosition({ x: constrainedX, y: constrainedY });
    }
  }, [isDragging, scale, dragStart]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Add mouse event listeners for dragging
  useEffect(() => {
    // Always add the listeners when component mounts, but they only do something when isDragging is true
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseleave', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]); // Only re-add listeners when these callbacks change
  
  // State for debouncing keyboard navigation
  const [isKeyboardNavigating, setIsKeyboardNavigating] = useState(false);
  const isKeyboardNavigatingRef = useRef(false);
  useEffect(() => { isKeyboardNavigatingRef.current = isKeyboardNavigating; }, [isKeyboardNavigating]);
  
  // Add keyboard event listeners for escape key and arrow navigation (only when open)
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key)) {
        e.preventDefault();
      }
      if (isKeyboardNavigating) return;
      if (e.key === 'Escape') {
        onCloseRef.current && onCloseRef.current();
      } else if (e.key === 'ArrowRight') {
        setLastNavDirection('right');
        if (canGoNextRef.current) {
          setIsKeyboardNavigating(true);
          setScale(1);
          setDragPosition({ x: 0, y: 0 });
          setIsDescriptionExpanded(false);
          setIsDescriptionHovering(false);
          setActiveIndex(prevIndex => prevIndex + 1);
          setTimeout(() => { setIsKeyboardNavigating(false); }, 300);
        }
      } else if (e.key === 'ArrowLeft') {
        setLastNavDirection('left');
        if (canGoPrevRef.current) {
          setIsKeyboardNavigating(true);
          setScale(1);
          setDragPosition({ x: 0, y: 0 });
          setIsDescriptionExpanded(false);
          setIsDescriptionHovering(false);
          setActiveIndex(prevIndex => prevIndex - 1);
          setTimeout(() => { setIsKeyboardNavigating(false); }, 300);
        }
      }
    };

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    let orig = null;
    if (viewportMeta) {
      orig = viewportMeta.getAttribute('content');
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
      if (viewportMeta && orig) {
        viewportMeta.setAttribute('content', orig);
      }
    };
  }, [open]);

  // Sync to currentIndex without forcing a reload on mount
  useEffect(() => {
    setActiveIndex((prev) => (prev !== currentIndex ? currentIndex : prev));
    // Do NOT reset `loaded` here; it causes a visible reload right after open
  }, [currentIndex]);
  
  // Update state when current image changes
  useEffect(() => {
    // Check all possible sources for liked status
    // First check if the image object has is_liked property
    // Then fall back to isLiked prop
    let likedStatus = false;
    const img = currentImage;
    
    if (img.is_liked !== undefined) {
      // Convert to boolean to handle string values like 'true'/'false'
      likedStatus = img.is_liked === true || img.is_liked === 'true';
    } else if (isLiked !== undefined) {
      likedStatus = !!isLiked;
    }
    
    setIsLikedState(likedStatus);
    setLikesCountState(parseInt(img.like_count || likesCount || 0, 10));
  }, [currentImage, isLiked, likesCount, activeIndex]);

  // Handle click on the backdrop to close
  const handleBackdropClick = (e) => {
    // CRITICAL FIX: More robust check for like button interaction
    // Check if the click is on or inside any button, svg, or interactive element
    if (e.target.closest('button') || 
        e.target.closest('[role="button"]') ||
        e.target.tagName.toLowerCase() === 'svg' || 
        e.target.tagName.toLowerCase() === 'path' ||
        e.target.closest('.like-button-area')) {
      e.preventDefault();
      e.stopPropagation();
      if (e.nativeEvent) {
        e.nativeEvent.stopImmediatePropagation();
      }
      return false;
    }
    
    // Only close if clicking directly on the backdrop
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  // ██████╗██╗██╗  ███████╗██████╗ ██╗   ██╗
  // ██╔═══╝██║██║  ╚══██╔══╝██╔══██╗██║   ██║
  // ██║    ██║██║     ██║   ██████╔╝██║   ██║
  // ██║    ██║██║     ██║   ██╔══██╗██║   ██║
  // ██████╗██║███████╗██║   ██║  ██║███████║
  // ╚═════╝╚═╝╚══════╝╚═╝   ╚═╝  ╚═╝╚══════╝
  //
  // CRITICAL EVENT HANDLING FIX:
  // PREVENT LIGHTBOX FROM CLOSING WHEN LIKING AN IMAGE!
  //
  // Handle like button click
  const handleLikeClick = async (e) => {
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

    try {
      // Set loading state before API call
      setIsLikeLoading(true);
      
      // Direct call to toggle like without nested promises or timeouts
      const success = await onToggleLike(image.id);
      
      if (success) {
        // Update local state
        const newLikedState = !isLikedState;
        setIsLikedState(newLikedState);
        setLikesCountState(prev => prev + (isLikedState ? -1 : 1));
        
        // Also update the image object directly for consistency
        currentImage.is_liked = newLikedState;
        currentImage.like_count = parseInt(currentImage.like_count || 0, 10) + (isLikedState ? -1 : 1);
        
        console.log('Like toggled successfully:', {
          imageId: currentImage.id,
          liked: newLikedState
        });
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      // Reset loading state after API call completes (success or error)
      setIsLikeLoading(false);
    }
    
    // Return false to prevent any default behavior
    return false;
  };
  
  // Handle reuse prompt click
  const handleReuseClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onReusePrompt) {
      onReusePrompt(currentImage.prompt);
      onClose();
    }
  };
  
  // Handle description click to expand/collapse
  const handleDescriptionClick = (e) => {
    e.stopPropagation();
    const newExpandedState = !isDescriptionExpanded;
    setIsDescriptionExpanded(newExpandedState);
    
    // When expanding description, reset zoom to 1, show controls, and hide zoom buttons
    if (newExpandedState) {
      setScale(1);
      setDragPosition({ x: 0, y: 0 });
      setShowControls(true);
    }
  };
  
  // Handle share button click
  const handleShare = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // All images are sharable with direct link, even private ones
    const shareUrl = `${window.location.origin}/share/${currentImage.id}`;
    
    try {
      if (isTerminalApp) {
        showQrModal({ url: shareUrl, title: 'Scan to open', subtitle: 'Open this design on your phone' });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      alert("Link copied! Share link has been copied to your clipboard");
      
      // If it's a private image, show a note about privacy
      if (currentImage.is_private) {
        setTimeout(() => {
          alert("Note: This is a private image, but anyone with this direct link can view it.");
        }, 500);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      alert("Failed to copy. Please try again.");
    }
  };

  // If not open, render nothing while keeping component state mounted
  if (!open) {
    return null;
  }

  // Use createPortal to render the lightbox at the document root level
  // This ensures it's not constrained by any parent containers
  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onTouchStart={(e) => {
        // Prevent pinch zoom on the entire lightbox container
        if (e.touches && e.touches.length > 1) {
          e.preventDefault();
        }
      }}
      onTouchMove={(e) => {
        // Prevent pinch zoom on the entire lightbox container
        if (e.touches && e.touches.length > 1) {
          e.preventDefault();
        }
      }}
      style={{
        position: 'fixed',  // Ensure fixed positioning
        top: 0,            // Explicitly set positioning
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      {/* Close button */}
      <button 
        className="absolute top-6 right-6 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors z-[60]"
        onClick={onClose}
      >
        <X className="w-8 h-8" />
      </button>
      
      {/* Image container */}
      <div 
        className={`transition-opacity duration-300 ${(hasShownOnce || loaded) ? 'opacity-100' : 'opacity-0'}
          max-w-[80vw] max-h-[80vh] flex items-center justify-center`}
        style={{
          // Only animate the initial reveal after open; avoid animations during navigation
          animation: !hasShownOnce && loaded ? 'zoom-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' : 'none',
          // Keep previous image visible as background while the next one loads
          backgroundImage: !loaded && prevDisplayedSrc ? `url(${prevDisplayedSrc})` : 'none',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center center'
        }}
      >
        <div 
          className="relative"
          onClick={(e) => {
            // Prevent click from reaching the backdrop if clicking on the image or controls
            e.stopPropagation();
            
            // Only show controls when not zoomed in and not dragging
            if (scale === 1 && !isDragging) {
              setShowControls(true);
            }
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Navigation arrows - only visible when not zoomed in and multiple images */}
          {hasMultipleImages && scale === 1 && (
            <>
              {/* Left arrow - positioned outside the image with increased spacing */}
              <button
                className={`absolute bg-black/50 p-2 rounded-full z-20 ${
                  canGoPrev ? 'opacity-70 hover:opacity-100 cursor-pointer' : 'opacity-30 cursor-not-allowed'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canGoPrev) goToPrev();
                }}
                disabled={!canGoPrev}
                style={{ 
                  position: 'absolute',
                  left: '-60px', // Fixed distance from the image container
                  top: '50%',
                  transform: 'translateY(-50%)'
                }}
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </button>
              
              {/* Right arrow - positioned outside the image with increased spacing */}
              <button
                className={`absolute bg-black/50 p-2 rounded-full z-20 ${
                  canGoNext ? 'opacity-70 hover:opacity-100 cursor-pointer' : 'opacity-30 cursor-not-allowed'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canGoNext) goToNext();
                }}
                disabled={!canGoNext}
                style={{ 
                  position: 'absolute',
                  right: '-60px', // Fixed distance from the image container
                  top: '50%',
                  transform: 'translateY(-50%)'
                }}
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </button>
              
              <div 
                className="bg-black/50 px-3 py-1 rounded-full text-white text-sm z-20"
                style={{
                  position: 'absolute',
                  top: '-40px', // Fixed distance above the image
                  left: '50%',
                  transform: 'translateX(-50%)'
                }}
              >
                {activeIndex + 1} / {images.length}
              </div>
            </>
          )}
          {!loaded && showSpinner && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img 
            ref={imageRef}
            src={currentImage?.image_url || currentImage?.url} // Try both possible image URL properties
            alt={currentImage?.prompt || 'Jewelry image'} 
            className="max-w-full max-h-[80vh] rounded-lg shadow-2xl transition-transform duration-200"
            style={{ 
              objectFit: 'contain', 
              userSelect: 'none',
              transform: `scale(${scale}) translate(${dragPosition.x / scale}px, ${dragPosition.y / scale}px)`,
              // Fade the img in when it finishes loading; avoid fading the whole container during navigation
              transition: isDragging ? 'none' : 'transform 0.3s ease, opacity 150ms ease',
              opacity: loaded ? 1 : 0,
              transformOrigin: 'center center',
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              willChange: 'transform' // Performance optimization for transforms
            }} // Prevent selection and apply zoom
            onContextMenu={(e) => e.preventDefault()} // Prevent right-click menu
            draggable={false} // Prevent dragging
            onMouseDown={handleMouseDown}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onLoad={(e) => {
              // Ensure the image is fully loaded before showing it
              console.log('Image loaded:', currentImage?.image_url || currentImage?.url);
              // Set loaded immediately to avoid visible flicker
              setLoaded(true);
              // After the first successful load post-open, keep container opaque for subsequent navigations
              if (!hasShownOnce) setHasShownOnce(true);
              // Update the previously displayed src for seamless background fallback on next navigation
              const srcNow = currentImage?.image_url || currentImage?.url;
              if (srcNow) setPrevDisplayedSrc(srcNow);
            }}
            onError={(e) => {
              console.error('Error loading image:', e, currentImage);
              setLoaded(true); // Prevent infinite loading state
            }}
          />
          
          {/* Zoom controls - always shown when not in description expanded mode */}
          {loaded && !isDescriptionExpanded && (
            <div className="absolute top-1/2 right-4 -translate-y-1/2 flex flex-col gap-2 z-20">
              <button
                className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomIn();
                }}
                disabled={scale >= 3}
                title="Zoom in"
              >
                <ZoomIn className="w-5 h-5 text-white" />
              </button>
              <button
                className="p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleZoomOut();
                }}
                disabled={scale <= 1}
                title="Zoom out"
              >
                <ZoomOut className="w-5 h-5 text-white" />
              </button>
            </div>
          )}
          
          {/* Copyright watermark - always show in public gallery, otherwise only when controls are hidden */}
          {loaded && (isPublicGallery || !showControls) && (
            <div 
              className="absolute left-4 bottom-4 font-medium text-black/60 opacity-90 transition-all duration-300"
              style={{
                fontSize: 'calc(10vw * 0.15)',
                textShadow: '0 1px 2px rgba(255,255,255,0.5)'
              }}
            >
              {isPublicGallery ? '© IMAGINARIES' : 'IMAGINARIES'}
            </div>
          )}
          
          {/* Like button - visible when not zoomed in */}
          {loaded && scale === 1 && isAuthenticated && showControls && (
            <div 
              className="absolute top-4 left-4 flex items-center gap-0.5 z-10"
              onClick={(e) => {
                // Completely prevent event propagation at the container level
                e.preventDefault();
                e.stopPropagation();
                if (e.nativeEvent) {
                  e.nativeEvent.stopImmediatePropagation();
                }
                return false;
              }}
            >
              {/* Privacy indicator - only shown for private images */}
              {currentImage.is_private && (
                <button
                  className="p-2 rounded-full bg-black/30 flex items-center justify-center mr-2"
                  title="This image is private"
                  onClick={(e) => {
                    // Prevent event propagation
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.nativeEvent) {
                      e.nativeEvent.stopImmediatePropagation();
                    }
                    return false;
                  }}
                >
                  <EyeOff className="w-5 h-5 text-white/70" />
                </button>
              )}
              
              {/* Like button */}
              <button
                className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors flex items-center justify-center like-button-area"
                onClick={(e) => {
                  // Completely prevent event propagation
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.nativeEvent) {
                    e.nativeEvent.stopImmediatePropagation();
                  }
                  // Call the handler directly without nested timeouts
                  handleLikeClick(e);
                  return false;
                }}
                disabled={isLikeLoading}
                data-action="like"
                id="lightbox-like-button"
              >
                {isLikeLoading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Heart className={`w-5 h-5 transition-colors duration-200 ${isLikedState ? 'text-primary' : 'text-white'}`} />
                )}
              </button>
              
              {/* Like count - simple text with shadow */}
              <span className="text-white text-sm drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] ml-1">
                {likesCountState}
              </span>
            </div>
          )}
          
          {/* Action buttons - only shown when not zoomed in */}
          {isAuthenticated && showControls && scale === 1 && (
            <div className="absolute top-4 right-4 flex gap-2 z-10">
              {onQuoteRequest && (
                <button
                  className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
                  onClick={() => { onQuoteRequest(image); onClose(); }}
                >
                  <DollarSign className="w-5 h-5 text-white" />
                </button>
              )}
              {/* Share button */}
              <button
                className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
                onClick={handleShare}
                title="Copy share link"
              >
                <Share2 className="w-5 h-5 text-white" />
              </button>
              {onDownload && !isTerminalApp && (
                <button
                  className="p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
                  onClick={() => onDownload(image)}
                  disabled={downloadingImageId === image.id}
                >
                  {downloadingImageId === image.id ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Download className="w-5 h-5 text-white" />
                  )}
                </button>
              )}
            </div>
          )}
          
          {/* Date display - only shown when controls are visible, not zoomed in, not in public gallery, and has a date */}
          {!isPublicGallery && currentImage.createdAt && loaded && showControls && scale === 1 && (
            <div className="absolute bottom-[3.5rem] left-0 right-0 px-6 pointer-events-none">
              <span className="text-zinc-300 text-xs block">
                {new Date(currentImage.createdAt).toLocaleDateString()}
              </span>
            </div>
          )}
          
          {/* Image caption with reuse prompt button - only shown when controls are visible and not zoomed in */}
          {!isPublicGallery && currentImage.prompt && loaded && showControls && scale === 1 && (
            <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 pointer-events-none">
              <div 
                className="bg-[#c7c7c74a] backdrop-blur-sm rounded p-3 pointer-events-none select-none transition-all duration-200" 
                onClick={handleDescriptionClick}
                onMouseEnter={() => setIsDescriptionHovering(true)}
                onMouseLeave={() => setIsDescriptionHovering(false)}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
              >
                <div className="relative">
                  {(isDescriptionExpanded || isDescriptionHovering) && onReusePrompt && (
                    <button
                      className="absolute bottom-0 right-0 p-2 rounded-md bg-[rgba(0,0,0,0.2)] hover:bg-[rgba(0,0,0,0.3)] transition-colors flex-shrink-0 z-10 pointer-events-auto"
                      onClick={handleReuseClick}
                      title="Reuse prompt"
                    >
                      <Repeat className="w-5 h-5 text-white" />
                    </button>
                  )}
                  <div 
                    className={`text-[rgb(10,10,10)] text-lg pr-10 ${!isDescriptionExpanded && !isDescriptionHovering ? 'line-clamp-2' : 'overflow-hidden'}`}
                    style={{
                      maxHeight: isDescriptionExpanded || isDescriptionHovering ? 
                        // More mobile-friendly approach with fallbacks
                        'min(50vh, 250px)' : 'none',
                      // Ensure text is readable on all devices
                      fontSize: '16px',
                      lineHeight: '1.5'
                    }}
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                  >
                    {currentImage.prompt}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
  document.body  // Mount the portal directly to the document body
  );
}
