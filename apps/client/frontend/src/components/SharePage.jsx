import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { ImageCard } from './ImageCard';
import { Loader2, Home, Sparkles, Share2 } from 'lucide-react';
import { Button } from './ui/button';
import { openAuthModal } from './CompletelyIsolatedAuth';
import { useLikes } from '../hooks/useLikes';
import { useReduxAuth } from '../hooks/useReduxAuth';
import { MetaTags } from './MetaTags';
import { useToast } from './ui/use-toast';
import { QuoteModal } from './QuoteModal';
import { useConsolidatedData } from '../hooks/useConsolidatedData';
import { getVersionString } from '../config/app';

// ███████╗████████╗ █████╗ ████████╗███████╗
// ██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██╔════╝
// ███████╗   ██║   ███████║   ██║   █████╗  
// ╚════██║   ██║   ██╔══██║   ██║   ██╔══╝  
// ███████║   ██║   ██║  ██║   ██║   ███████╗
// ╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚══════╝

// CRITICAL PERFORMANCE OPTIMIZATION:
// MODULE-LEVEL STATE PREVENTS DUPLICATE API CALLS!
//
// 1. NEVER USE COMPONENT STATE ALONE FOR API CALL TRACKING - It resets on remounts
// 2. ALWAYS USE MODULE-LEVEL VARIABLES - They persist across component lifecycles
// 3. RESET MODULE VARIABLES DURING HOT RELOADING - See the code at the bottom
//
// This pattern prevents duplicate API calls even when React remounts components
let imageRequestsInProgress = new Map(); // Map of imageId -> boolean
let likesRequestsInProgress = new Map(); // Map of imageId -> boolean

// Create a module-level variable to disable unnecessary API calls on the share page
let disableConsolidatedDataHook = true;

// Custom hook that wraps useConsolidatedData to prevent API calls on the share page
function useOptimizedData() {
  // If we're on the share page, return empty data to prevent API calls
  if (disableConsolidatedDataHook) {
    console.log('Share page: Skipping consolidated data API calls');
    return {
      userImages: [],
      publicImages: [],
      isLoading: false,
      error: null,
      view: 'recent',
      switchView: () => {},
      loadData: () => Promise.resolve(),
      loadNextPage: () => {},
      refresh: () => Promise.resolve(),
      clearHistory: () => Promise.resolve(),
      page: 1,
      hasMore: false,
      totalPages: 1
    };
  }
  
  // Otherwise, use the real hook
  return useConsolidatedData();
}

export function SharePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const rootRef = useRef(null);
  // Get imageId directly from useParams since we're mounted directly by the router
  const { imageId } = useParams();
  
  // No longer need showAuthModal state since we're using CompletelyIsolatedAuth
  const [image, setImage] = useState(null);
  // Start with loading state true and show spinner immediately
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingImageId, setDownloadingImageId] = useState(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const { user, isAuthenticated, isEmailConfirmed } = useReduxAuth();
  const { likedImages, likeCounts, toggleLike, fetchLikes } = useLikes();
  const { toast } = useToast();

  // If no imageId is provided, redirect to home
  if (!imageId) {
    // Re-enable the consolidated data hook when navigating away
    disableConsolidatedDataHook = false;
    return <Navigate to="/" replace />;
  }
  
  // Disable the consolidated data hook when on the share page
  useEffect(() => {
    disableConsolidatedDataHook = true;
    return () => {
      // Re-enable the consolidated data hook when unmounting
      disableConsolidatedDataHook = false;
    };
  }, []);

  // Fetch image data - optimized to start immediately and prevent duplicate requests
  // Using module-level variables for tracking instead of component refs
  const fetchImage = useRef(async () => {
    // Skip if no ID is provided
    if (!imageId) {
      console.log('No image ID provided, skipping fetch');
      return;
    }
    
    // Check if this specific image request is already in progress
    if (imageRequestsInProgress.get(imageId)) {
      console.log(`Image fetch for ${imageId} already in progress, skipping duplicate request`);
      return;
    }
    
    // Mark that we're starting a request for this specific image
    imageRequestsInProgress.set(imageId, true);
    console.log(`Starting image fetch for ${imageId}, setting imageRequestsInProgress`);
    
    try {
      // We're already in loading state by default, no need to set it again
      setError(null);
      console.log('Fetching image:', imageId);
      
      const response = await fetch(`/api/generate/shared/${imageId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch image');
      }

      console.log('Received image data:', data);
      setImage(data);
      
      // Fetch likes for this image - but only if we haven't already started a likes request
      if (data.id && !likesRequestsInProgress.get(data.id)) {
        likesRequestsInProgress.set(data.id, true);
        console.log(`Starting likes fetch for ${data.id}, setting likesRequestsInProgress`);
        
        try {
          await fetchLikes([data.id]);
        } finally {
          // Reset the likes request tracking regardless of success/failure
          likesRequestsInProgress.set(data.id, false);
          console.log(`Completed likes fetch for ${data.id}, clearing likesRequestsInProgress`);
        }
      }
    } catch (error) {
      console.error('Failed to fetch image:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
      // Reset the request tracking so future requests can proceed if needed
      imageRequestsInProgress.set(imageId, false);
      console.log(`Completed image fetch for ${imageId}, clearing imageRequestsInProgress`);
    }
  }).current; // Use .current to get the stable function reference

  // Effect to trigger the fetch once
  useEffect(() => {
    console.log('SharePage mounted for image:', imageId);
    fetchImage();
    
    // Cleanup function to reset request tracking when component unmounts
    return () => {
      console.log('SharePage unmounted for image:', imageId);
      if (imageId) {
        imageRequestsInProgress.set(imageId, false);
        likesRequestsInProgress.set(imageId, false);
      }
    };
  }, [imageId]); // Only depend on the image ID

  // Auto-open Quote flow when arriving with ?quote=1
  const quoteOpenedRef = useRef(false);
  useEffect(() => {
    if (!image) return;
    if (quoteOpenedRef.current) return;
    try {
      const sp = new URLSearchParams(location.search);
      if (sp.get('quote') === '1') {
        quoteOpenedRef.current = true;
        // Reuse the same logic as clicking Quote
        const formattedImage = {
          id: image.id,
          prompt: image.prompt,
          url: image.url,
          image_url: image.url,
          watermarked: image.watermarked || null,
          user_id: image.user_id,
          created_at: image.createdAt || new Date().toISOString()
        };
        setSelectedImage(formattedImage);
        setShowQuoteModal(true);
      }
    } catch {}
  }, [image, location.search]);

  // Hide any app-level footer outside this page while mounted
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const hidden = [];
    const footers = Array.from(document.querySelectorAll('footer'));
    footers.forEach((el) => {
      if (!root.contains(el)) {
        const prev = el.style.display;
        hidden.push({ el, prev });
        el.style.display = 'none';
      }
    });
    return () => {
      hidden.forEach(({ el, prev }) => {
        el.style.display = prev || '';
      });
    };
  }, []);

  const handleImagineClick = () => {
    // Navigate without replacing the history entry so Back button works
    navigate('/', { replace: false });
  };
  
  // Add handleHomeClick function for the error state
  const handleHomeClick = () => {
    // Navigate to home without replacing history
    navigate('/', { replace: false });
  };
  
  const handleQuoteRequest = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // If not authenticated, show auth modal instead of proceeding
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    
    if (!image?.id) {
      toast({
        title: "Error",
        description: "Cannot request quote for this image",
        variant: "destructive",
      });
      return;
    }
    
    // Check if email is confirmed, just like in the main app
    if (!isEmailConfirmed) {
      toast({
        title: "Email confirmation required",
        description: "Please confirm your email address to request quotes.",
        variant: "destructive",
      });
      return;
    }
    
    // Format the image data to match exactly what the QuoteModal expects
    // The QuoteModal makes a POST request to /api/generate/estimate/${image.id}
    const formattedImage = {
      id: image.id,
      prompt: image.prompt,
      // Include both url and image_url to ensure compatibility
      url: image.url,
      image_url: image.url,
      // Include watermarked URL if available
      watermarked: image.watermarked || null,
      // Include user_id for authentication checks
      user_id: image.user_id,
      // Don't include estimatedCost to force a new API call
      created_at: image.createdAt || new Date().toISOString()
    };
    
    console.log('Opening quote modal with formatted image:', formattedImage);
    
    // Open the quote modal with the properly formatted image data
    setSelectedImage(formattedImage);
    setShowQuoteModal(true);
  };
  
  const handleShare = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Share functionality should work without authentication
    // as we're already on the share page
    if (!image?.id) {
      toast({
        title: "Error",
        description: "Cannot share this image",
        variant: "destructive",
      });
      return;
    }
    
    // Match the behavior in ImageCard component
    const shareUrl = `${window.location.origin}/share/${image.id}`;
    
    try {
      // Use clipboard API for consistency with ImageCard
      navigator.clipboard.writeText(shareUrl).then(() => {
        toast({
          title: "Link copied!",
          description: "Share link has been copied to your clipboard",
        });
      });
    } catch (err) {
      console.error('Failed to copy:', err);
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };
  
  const handleDownload = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // If not authenticated, show auth modal instead of proceeding
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    
    if (!image?.id) {
      toast({
        title: "Error",
        description: "Cannot download this image",
        variant: "destructive",
      });
      return;
    }
    
    if (!image || !image.id || downloadingImageId === image.id) {
      console.log('[Client] Invalid image data or already downloading:', image);
      return;
    }
    
    setDownloadingImageId(image.id);
    console.log('[Client] Starting download for image:', image);
    
    try {
      // Use the useImageDownload hook's implementation for consistency
      // First, request a watermarked version from the server
      console.log('[Client] Requesting watermarked version...');
      const response = await fetch(`/api/generate/download/${image.id}`, {
        method: 'POST', // Use POST method as required by the server
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: image.user_id }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Client] Server error:', errorData);
        throw new Error(errorData.error || `Failed to download image: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Client] Server response data:', data);
      
      if (!data.watermarkedUrl) {
        throw new Error('No watermarked URL received from server');
      }
      
      const downloadUrl = data.watermarkedUrl;
      console.log('[Client] Received watermarked URL:', downloadUrl);
      
      // Fetch the image from the URL
      console.log('[Client] Downloading from URL:', downloadUrl);
      const imageResponse = await fetch(downloadUrl);
      
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      
      const contentType = imageResponse.headers.get('content-type');
      console.log('[Client] Content type:', contentType);
      
      if (!contentType || !contentType.includes('image/')) {
        throw new Error('Invalid content type received');
      }
      
      // Get the image as a blob
      const blob = await imageResponse.blob();
      console.log('[Client] Got blob:', blob.size, 'bytes');
      
      const url = URL.createObjectURL(blob);
      console.log('[Client] Created object URL:', url);
      
      // Create a temporary anchor element
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      const sanitizedPrompt = (image.prompt || 'jewelry').slice(0, 30).replace(/[^a-z0-9]/gi, '-');
      a.download = `imaginaries-${sanitizedPrompt}.png`;
      document.body.appendChild(a);
      
      console.log('[Client] Triggering download');
      a.click();
      
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('[Client] Download completed successfully');
      
      toast({
        title: "Download started",
        description: "Your image is being downloaded",
      });
    } catch (error) {
      console.error('[Client] Download error:', error);
      toast({
        title: "Download failed",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setDownloadingImageId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-fadeIn">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !image) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-2">Image not found</h2>
          <p className="text-zinc-400">This design may have been removed or is no longer available.</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleHomeClick}
            className="text-zinc-400 hover:text-white gap-2 mt-4"
          >
            <Home className="w-4 h-4" />
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  // Prevent duplicate like toggle requests using module-level tracking
  const handleLikeClick = async () => {
    if (!image?.id) {
      toast({
        title: "Error",
        description: "Cannot like this image",
        variant: "destructive",
      });
      return;
    }
    
    // If not authenticated, show auth modal instead of proceeding
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    
    // Check if a like request is already in progress for this image
    if (likesRequestsInProgress.get(image.id)) {
      console.log(`Like toggle for ${image.id} already in progress, skipping`);
      return;
    }
    
    // Mark that we're starting a like request
    likesRequestsInProgress.set(image.id, true);
    
    // Use setTimeout to break the event chain and prevent React cascading updates
    setTimeout(async () => {
      try {
        await toggleLike(image.id);
      } finally {
        // Reset the like request tracking regardless of success/failure
        likesRequestsInProgress.set(image.id, false);
      }
    }, 0);
  };

  const isLiked = isAuthenticated && likedImages?.has(image?.id);
  const likesCount = image?.id ? (likeCounts?.[image.id] || 0) : 0;

  // Generate metadata for social sharing - don't rely on prompt which is now removed
  const pageTitle = 'Shared Jewelry Design | IMAGINARIES';
  const pageDescription = 'View this unique jewelry design created with IMAGINARIES';
  const pageUrl = `${window.location.origin}/share/${imageId}`;
  const imageUrl = image?.url;
  
  return (
    <div ref={rootRef} className="min-h-[100dvh] bg-black grid grid-rows-[auto_1fr_auto]">
      {/* Dynamic meta tags for social sharing */}
      <MetaTags 
        title={pageTitle}
        description={pageDescription}
        imageUrl={imageUrl}
        url={pageUrl}
      />
      
      {/* Header */}
      <header className="p-4 flex flex-row items-center justify-between bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
        <div className="font-mono text-zinc-600 text-sm text-left">
          IMAGINARIES
        </div>
        <nav className="flex items-center gap-4">
          {isAuthenticated && (
            <Button
              variant="default"
              size="sm"
              className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              onClick={handleImagineClick}
            >
              <Sparkles className="w-4 h-4" />
              Imagine
            </Button>
          )}
        </nav>
      </header>

      <main className="flex items-center justify-center">
        <div className="w-full mx-auto lg:max-w-[50vw] lg:min-w-[375px] px-4 p-8">
          <div className="w-full">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-white text-2xl font-semibold">
                Make to Order
              </h1>
              <Button
                variant="outline"
                size="icon"
                onClick={handleShare}
                className="h-10 w-10"
                title="Share this design"
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
          
          <div className="bg-zinc-900 rounded-xl p-6">
            <ImageCard
              image={image}
              showActions={false}
              hideDescription={true}
              isAuthenticated={false}
              isPublicGallery={true}
              onReusePrompt={() => navigate('/')}
            />
            <div className="mt-6 flex items-center justify-center">
              <Button
                variant="default"
                size="lg"
                onClick={handleQuoteRequest}
                className="h-11 px-6 text-base font-medium"
                title={isAuthenticated ? 'Order this design' : 'Sign in to order this design'}
              >
                <span>Order Now</span>
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-zinc-600 text-xs">
        © IMAGINARIES - OCTADIAM FZCO
      </footer>

      {/* Auth modal is now handled by CompletelyIsolatedAuth component */}
      
      {/* Quote Modal */}
      {showQuoteModal && selectedImage && (
        <QuoteModal
          image={selectedImage}
          fromSharePage={true}
          onClose={() => {
            setShowQuoteModal(false);
            setSelectedImage(null);
          }}
        />
      )}
    </div>
  );
}

// ██████╗ ██████╗ ██╗   ██╗██████╗ 
// ██╔═══╝ ██╔════╝ ██║   ██║██╔═══╝ 
// █████╗  █████╗  ██║   ██║█████╗  
// ╚════██╗██╔══╝  ██║   ██║╚════██╗
// ██████╔╝██║     ╚██████╔╝██████╔╝
// ╚═════╝ ╚═╝      ╚═════╝ ╚═════╝ 
//
// CRITICAL PERFORMANCE OPTIMIZATION:
// ALWAYS RESET MODULE STATE DURING HOT RELOADING!
//
// 1. NEVER FORGET THIS CODE IN DEVELOPMENT - Module state persists between reloads
// 2. MODULE STATE MUST BE RESET - Otherwise you'll get stuck states during development
// 3. THIS IS DEVELOPMENT-ONLY CODE - It won't run in production
//
// This ensures clean development experience with proper state resets
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('Hot module replacement - resetting share page state');
    imageRequestsInProgress.clear();
    likesRequestsInProgress.clear();
  });
}