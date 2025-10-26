import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Routes, Route, BrowserRouter, Navigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useToast } from './components/ui/use-toast';
import { Toaster } from './components/ui/Toaster';
// Auth hook is already imported as useReduxAuth below
import { usePromptContext, PromptProvider } from './contexts/PromptContext';
import { generateImage } from './services/api';
import { QuoteModal } from './components/QuoteModal';
import { MainContent } from './components/MainContent';
import { EmergencyMainView } from './components/EmergencyMainView';
import { useConsolidatedData } from './hooks/useConsolidatedData';
import { useRouteDataFetcher } from './hooks/useRouteDataFetcher';
import { fixPromptInDOM } from './components/PromptFixer';
import { useImageUpdater } from './hooks/useImageUpdater';
import { usePromptClearer } from './hooks/usePromptClearer';
import { useDirectPromptSubmission } from './hooks/useDirectPromptSubmission';
import { usePresetsData } from './hooks/usePresetsData';
import { EmailConfirmationPage } from './components/EmailConfirmationPage';
import { Header } from './components/Header';
import { Gallery } from './components/Gallery';
import { Modal } from './components/Modal';
import UpgradeCongratsModal from './components/UpgradeCongratsModal';
import { triggerConfetti, CONFETTI_EVENTS } from './components/GlobalConfetti';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useReduxAuth } from './hooks/useReduxAuth';
import { useImageDownload } from './hooks/useImageDownload';
import { useLikes } from './hooks/useLikes';
import { Footer } from './components/Footer';
import { ImageHistory } from './components/ImageHistory';
import { SharePage } from './components/SharePage';
import HistoryModal from './components/HistoryModal';
import { UpgradePage } from './components/UpgradePage';
import { decrement, fetchQuota, reset as resetQuota } from './store/quotaSlice';

/**
 * Main App component.
 */
// Main App wrapper that provides Router context
function App() {
  return (
    <PromptProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </PromptProvider>
  );
}

// AppContent component that uses Router hooks 
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  
  // Check for promo code in URL and store in localStorage
  useEffect(() => {
    const promoCode = searchParams.get('code');
    if (promoCode) {
      // Store promo code in localStorage (will persist forever)
      localStorage.setItem('promo_code', promoCode.toLowerCase().trim());
      console.log('Promo code stored:', promoCode);
      
      // Remove the code from URL to keep it clean (without causing a page refresh)
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [searchParams]);
  
  // Clear promo code when user reaches the /imagine route
  // This ensures the promo code is cleared after successful authentication
  useEffect(() => {
    if (location.pathname === '/imagine' && localStorage.getItem('promo_code')) {
      console.log('User reached /imagine route, clearing promo code from localStorage');
      localStorage.removeItem('promo_code');
    }
  }, [location.pathname]);
  
  // Get authentication state from Redux
  const { isAuthenticated, isEmailConfirmed, user, logout } = useReduxAuth();
  
  // CRITICAL SECURITY: Force email confirmation check on every page load
  // This ensures users cannot bypass email verification by refreshing the page
  useEffect(() => {
    // Check if user is authenticated but email is not confirmed
    const checkEmailConfirmation = () => {
      if (isAuthenticated && user && !isEmailConfirmed) {
        console.log('SECURITY: User is authenticated but email is not confirmed');
        
        // Store a flag in localStorage (more persistent than sessionStorage)
        // This ensures the status persists across page reloads and browser restarts
        localStorage.setItem('needs_email_confirmation', 'true');
        localStorage.setItem('unconfirmed_email', user.email || '');
        
        // If not on the confirmation page, force the confirmation modal
        if (location.pathname !== '/confirm-email') {
          console.log('SECURITY: Forcing email confirmation modal');
          
          // Delay slightly to ensure the auth interface is available
          setTimeout(() => {
            if (window.IsolatedAuth && typeof window.IsolatedAuth.openWithConfirmation === 'function') {
              window.IsolatedAuth.openWithConfirmation(user.email);
            } else {
              console.error('Auth modal interface not found, creating fallback');
              // Fallback: Create the auth modal if it doesn't exist
              import('./components/CompletelyIsolatedAuth').then(module => {
                const { openAuthModal } = module;
                openAuthModal();
                // Try again after the modal is created
                setTimeout(() => {
                  if (window.IsolatedAuth && typeof window.IsolatedAuth.openWithConfirmation === 'function') {
                    window.IsolatedAuth.openWithConfirmation(user.email);
                  }
                }, 100);
              });
            }
          }, 300);
        }
      } else if (!isAuthenticated || (isAuthenticated && isEmailConfirmed)) {
        // Clear the flags if user is not authenticated or has confirmed email
        localStorage.removeItem('needs_email_confirmation');
        localStorage.removeItem('unconfirmed_email');
      }
    };
    
    // Run the check immediately
    checkEmailConfirmation();
    
    // Also set up an interval to periodically check (every 3 seconds)
    // This ensures the modal appears even if the initial check fails
    const intervalId = setInterval(checkEmailConfirmation, 3000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [isAuthenticated, isEmailConfirmed, user, location.pathname]);

  // Inject ElevenLabs Convai widget for business-tier users only
  useEffect(() => {
    const enabled = import.meta.env.VITE_ELEVENLABS_CONVAI_ENABLED === 'true';
    const agentId = import.meta.env.VITE_ELEVENLABS_CONVAI_AGENT_ID;
    const isBusiness = isAuthenticated && (user?.subscription_plan === 'business');

    // If disabled or misconfigured, ensure widget is removed
    if (!enabled || !agentId) {
      const existing = document.querySelector('elevenlabs-convai');
      if (existing) existing.remove();
      return;
    }

    if (isBusiness) {
      // Load widget script once
      if (!document.querySelector('script[data-elevenlabs-convai]')) {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
        s.async = true;
        s.type = 'text/javascript';
        s.setAttribute('data-elevenlabs-convai', '1');
        document.head.appendChild(s);
      }
      // Mount widget if not present
      if (!document.querySelector('elevenlabs-convai')) {
        const w = document.createElement('elevenlabs-convai');
        w.setAttribute('agent-id', agentId);
        document.body.appendChild(w);
      }
    } else {
      // Remove widget for non-business or logged-out users
      const existing = document.querySelector('elevenlabs-convai');
      if (existing) existing.remove();
    }

    // Cleanup: remove widget node (keep script to avoid flicker on re-mount)
    return () => {
      const existing = document.querySelector('elevenlabs-convai');
      if (existing) existing.remove();
    };
  }, [isAuthenticated, user?.subscription_plan]);
  
  // Get data from the consolidated hook
  const {
    userImages,
    publicImages,
    isLoading: isLoadingMainScreen,
    refreshMainScreen,
    hasMorePublic,
    view: currentView,  // Use the correct property name 'view' instead of 'currentView'
    switchView: switchGalleryView,
    toggleHistoryView,
  } = useConsolidatedData();
  
  // Get the image updater hook for directly adding new images
  const { addNewImageToHistory } = useImageUpdater();
  
  // Get the prompt clearer hook for safely clearing the prompt
  const { clearPromptCompletely } = usePromptClearer();
  
  // Get the direct prompt submission hook for accurate prompt tracking
  const { getAccuratePrompt } = useDirectPromptSubmission();
  
  // Make presets data available globally
  usePresetsData();
  
  // Make toggleHistoryView available globally for the Gallery component
  useEffect(() => {
    window.toggleHistoryView = toggleHistoryView;
    
    return () => {
      delete window.toggleHistoryView;
    };
  }, [toggleHistoryView]);
  
  // Use the route data fetcher to monitor route changes and trigger appropriate data fetching
  const routeData = useRouteDataFetcher({
    refreshMainScreen,
    toggleHistoryView,
    switchView: switchGalleryView
  });
  
  // Debug logging for route monitoring
  console.log('Route monitoring active:', routeData);
  
  // Redirect authenticated users from / to /imagine
  useEffect(() => {
    // Get the current path on each render
    const currentPath = window.location.pathname;
    console.log('Auth redirect check - Path:', currentPath, 'isAuthenticated:', isAuthenticated);
    // No celebrate/purge URL guards anymore; rely solely on localStorage + plan
    
    // Skip redirect if we're in the middle of signing out
    const isSigningOut = sessionStorage.getItem('isSigningOut');
    if (isSigningOut) {
      console.log('Skipping auth redirect because user is signing out');
      return;
    }
    
    // If user is authenticated and on the main route, redirect to /imagine
    if (isAuthenticated && (currentPath === '/' || currentPath === '')) {
      console.log('User is authenticated, redirecting from / to /imagine');
      // Use setTimeout to ensure this happens after the component is fully mounted
      setTimeout(() => {
        navigate('/imagine');
      }, 100);
    }
    
    // If user is not authenticated and on the /imagine route, redirect to /
    if (!isAuthenticated && currentPath === '/imagine') {
      console.log('User is not authenticated, redirecting from /imagine to /');
      // Use setTimeout to ensure this happens after the component is fully mounted
      setTimeout(() => {
        navigate('/');
      }, 100);
    }
  }, [isAuthenticated, navigate]);

  // REMOVE URL dependency: Do nothing on /upgrade or celebrate params. We rely purely on plan + localStorage
  useEffect(() => {
    return; // no-op
  }, [user?.id]);

  // NEW: Show upgrade modal purely based on current plan and per-user localStorage record
  useEffect(() => {
    if (!isAuthenticated) return;
    const plan = user?.subscription_plan;
    if (!plan || plan === 'free') return;
    if (!user?.id) return;
    const key = `last_upgrade_plan_${user.id}`;
    const stored = localStorage.getItem(key);
    if (!stored || stored !== plan) {
      setShowUpgradeCongrats(true);
      try { localStorage.setItem(key, plan); } catch {}
      try { triggerConfetti(CONFETTI_EVENTS.GENERATION_SUCCESS); } catch {}
    }
  }, [isAuthenticated, user?.id, user?.subscription_plan]);

  // NASA-grade quota sync: fetch on auth, reset on logout
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchQuota());
    } else {
      dispatch(resetQuota());
    }
  }, [isAuthenticated, dispatch]);

  // Removed quota-refresh event listener to prevent duplicate fetches.
  
  // Image download functionality
  const { handleDownload, downloadingImageId } = useImageDownload();
  
  // Likes functionality
  const { toggleLike, toggleLikeInHistory, likedImages, likeCounts } = useLikes();
  
  // Local state
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [showGallery, setShowGallery] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showUpgradeCongrats, setShowUpgradeCongrats] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Refs
  const promptInputRef = useRef(null);
  const promptContextRef = useRef({});
  const showGalleryRef = useRef(showGallery);
  
  // Update ref when state changes
  useEffect(() => {
    showGalleryRef.current = showGallery;
  }, [showGallery]);
  
  // Toast for notifications
  const { toast } = useToast();
  
  // Handlers
  const handlePromptChange = useCallback((value) => {
    setPrompt(value);
  }, []);
  
  // COMPLETELY NEW APPROACH: Use the existing promptContextRef to store the prompt context
  // This avoids issues with stale closures and dependency arrays
  
  // EMERGENCY FIX: Completely ignore the PromptContext
  // Just use the local prompt state for everything

  // Create a function to handle a newly generated image
  // This directly adds the image to the history without refreshing the screen
  function handleNewlyGeneratedImage(imageUrl, prompt) {
    console.log('Handling newly generated image:', imageUrl);
    
    try {
      // Create a new image object with the necessary properties
      const newImage = {
        id: `temp-${Date.now()}`, // Temporary ID until refresh
        image_url: imageUrl,
        url: imageUrl,
        prompt: prompt,
        created_at: new Date().toISOString(),
        user_id: user?.id,
        is_private: false,
        like_count: 0,
        is_liked: false
      };
      
      // Add the new image directly to the history
      addNewImageToHistory(newImage);
      
      // Show confetti animation for successful generation
      if (window.showConfetti) {
        window.showConfetti();
      }
      
      return Promise.resolve(newImage);
    } catch (error) {
      console.error('Error handling new image:', error);
      // Fall back to refreshing the screen if direct update fails
      return refreshMainScreen();
    }
  }

  // COMPLETE REWRITE: Create a non-callback version of handleSubmit
  // This function is defined outside of useCallback to avoid closure issues
  function handleSubmitDirect(e, drawingData = {}) {
    if (e) e.preventDefault();
    if (isGenerating) return;
    
    // Check authentication
    if (!isAuthenticated) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to generate images.',
        variant: 'destructive',
      });
      return;
    }
    
    // Check email confirmation
    if (!isEmailConfirmed) {
      toast({
        title: 'Email Confirmation Required',
        description: 'Please confirm your email address to generate images.',
        variant: 'destructive',
      });
      return;
    }
    
    // Clear any previous errors
    setError(null);
    
    // Set generating state
    setIsGenerating(true);
    
    // Get the prompt context to access jewelry type and presets
    const promptContext = window.PROMPT_CONTEXT_REF?.current;
    
    // CRITICAL FIX: Always use the combined prompt from context that includes presets
    // This ensures presets are always included regardless of text input
    let submissionPrompt = '';
    
    // 1. First priority: Get the COMPLETE prompt from context (includes jewelry type, text, AND presets)
    if (promptContext && typeof promptContext.getFinalPrompt === 'function') {
      try {
        const contextPrompt = promptContext.getFinalPrompt();
        console.log('CONTEXT FINAL PROMPT:', contextPrompt);
        if (contextPrompt && contextPrompt.trim() !== '') {
          submissionPrompt = contextPrompt;
        }
      } catch (e) {
        console.error('Error getting final prompt from context:', e);
      }
    }
    
    // 2. Fallback: If context prompt failed, try to get the prompt from the textarea
    if (!submissionPrompt || submissionPrompt.trim() === '') {
      const textareaPrompt = getAccuratePrompt();
      if (textareaPrompt && textareaPrompt.trim() !== '') {
        submissionPrompt = textareaPrompt;
      }
    }
    
    console.log('FINAL SUBMISSION PROMPT:', submissionPrompt);
    
    // Extract drawing data and privacy setting if provided
    const { drawingPng, drawingSvg, isPrivate = true } = drawingData || {};
    
    // Ensure we have a valid prompt
    if (!submissionPrompt || submissionPrompt.trim() === '') {
      // Check if we have a drawing - if so, we can still proceed with an empty prompt
      if (!(drawingPng && drawingSvg)) {
        setError('Please enter a prompt to generate an image');
        setIsGenerating(false);
        return;
      }
      // If we have a drawing but no prompt, use a default prompt
      console.log('No prompt provided but drawing exists, using default prompt');
    }
    
    console.log('Generating image with:', { 
      prompt: submissionPrompt, 
      userId: user?.id, 
      hasDrawing: !!(drawingPng && drawingSvg),
      isPrivate,
      promptLength: submissionPrompt.length,
      hasPresets: submissionPrompt !== prompt // Check if we're using presets
    });
    
    // Call the API and handle the response
    // First, store the prompt for later use with the image
    const promptForImage = submissionPrompt;
    
    // Clear the prompt completely (like the Clear button in Presets Modal)
    // This is done BEFORE the API call to ensure UI responsiveness
    clearPromptCompletely();
    
    // Then make the API call to generate the image
    generateImage(promptForImage, user?.id, drawingPng, drawingSvg, isPrivate)
      .then((imageData) => {
        console.log('Image generated successfully:', imageData);
        
        // Check if we received a full image object or just a URL
        if (typeof imageData === 'string') {
          // We received just the URL, create an image object
          return handleNewlyGeneratedImage(imageData, promptForImage);
        } else {
          // We received a full image object, add it directly
          // Make sure it has all the properties we need
          const imageObject = {
            ...imageData,
            url: imageData.image_url || imageData.url, // Ensure we have a url property
            prompt: imageData.prompt || promptForImage, // Use the prompt from the response or our submission
            is_private: imageData.is_private !== undefined ? imageData.is_private : isPrivate,
            created_at: imageData.created_at || new Date().toISOString(),
            like_count: imageData.like_count || 0,
            is_liked: imageData.is_liked || false
          };
          
          // Add the image directly to the history
          addNewImageToHistory(imageObject);
          
          // Show confetti animation for successful generation
          if (window.showConfetti) {
            window.showConfetti();
          }

          // Update quota immediately and reconcile with server in background
          try { dispatch(decrement(1)); } catch {}
          try { setTimeout(() => { dispatch(fetchQuota()); }, 800); } catch {}
          
          return Promise.resolve(imageObject);
        }
      })
      .catch((error) => {
        console.error('Failed to generate image:', error);
        
        // Handle generation limit error specifically
        if (error.isLimitError) {
          toast({
            title: 'Generation Limit Reached',
            description: `You've reached your daily limit of ${error.limit} generations. Upgrade your plan for more!`,
            variant: 'destructive',
          });
        } else {
          setError(error.message || 'Failed to generate image. Please try again.');
        }
      })
      .finally(() => {
        // Always reset the generating state
        setIsGenerating(false);
      });
  }
  
  // Create a simple wrapper that calls the direct function
  const handleSubmit = useCallback((e, drawingData) => {
    handleSubmitDirect(e, drawingData);
  }, [isGenerating, isAuthenticated, isEmailConfirmed, prompt, user?.id, toast]);

  
  // PromptFixer utility is now imported at the top of the file

  // COMPLETE REWRITE: Create a direct function for reusing prompts
  function handleReusePromptDirect(promptText, fromGallery = false) {
    // ULTRA DIRECT APPROACH: Use global window object to store the prompt
    // This will be picked up by our event listener
    window.__lastReusedPrompt = promptText;
    
    // Dispatch a custom event that components can listen for
    const promptEvent = new CustomEvent('prompt-reused', { detail: { prompt: promptText } });
    window.dispatchEvent(promptEvent);
    
    // Set the prompt in our local state
    setPrompt(promptText);
    
    // Log the reused prompt for debugging
    console.log('Reusing prompt with ultra direct approach:', promptText);
    
    // If we're in the gallery, navigate to the imagine page
    if (fromGallery) {
      setShowGallery(false);
      
      // If we're on a gallery route, navigate to the imagine route
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/gallery')) {
        // Use window.location for a hard navigation to avoid React Router issues
        // Store the prompt in sessionStorage so it persists across the navigation
        sessionStorage.setItem('reusedPrompt', promptText);
        window.location.href = '/imagine';
        return; // Exit early since we're navigating away
      }
    }
    
    // EMERGENCY FIX: Use our direct DOM manipulation utility as a last resort
    // This will directly set the value in the textarea and trigger the input event
    setTimeout(() => {
      const fixed = fixPromptInDOM(promptText);
      if (fixed) {
        console.log('Successfully fixed prompt in DOM');
      } else {
        console.warn('Failed to fix prompt in DOM, trying fallback method');
        
        // Fallback to the original method
        if (promptInputRef.current) {
          promptInputRef.current.focus();
          promptInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 100);
  }
  
  // Create a simple wrapper that calls the direct function
  const handleReusePrompt = useCallback((promptText, fromGallery = false) => {
    handleReusePromptDirect(promptText, fromGallery);
  }, []);
  
  // Set up a listener for the reused prompt from sessionStorage
  // This handles the case where we navigate from gallery to imagine
  useEffect(() => {
    const reusedPrompt = sessionStorage.getItem('reusedPrompt');
    if (reusedPrompt) {
      console.log('Found reused prompt in sessionStorage:', reusedPrompt);
      // Clear it immediately to prevent it from being used again
      sessionStorage.removeItem('reusedPrompt');
      // Use it after a short delay to ensure components are mounted
      setTimeout(() => {
        handleReusePromptDirect(reusedPrompt, false);
      }, 500);
    }
  }, []);
  
  const handleQuoteRequest = useCallback((image) => {
    if (!isEmailConfirmed) {
      toast({
        title: 'Email confirmation required',
        description: 'Please confirm your email address to request quotes.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedImage(image);
    setShowQuoteModal(true);
  }, [isEmailConfirmed, toast]);
  
  // Debug logging
  console.log('App rendering with auth state:', { isAuthenticated, isEmailConfirmed });
  console.log('Images available:', { userImages: userImages?.length || 0, publicImages: publicImages?.length || 0 });
  
  return (
    <div className="flex flex-col min-h-screen">
      <Toaster />
      
      {/* Modals that should be available across all routes */}
      {isHistoryOpen && (
        <HistoryModal
          userImages={userImages}
          userId={user?.id}
          onClose={() => setIsHistoryOpen(false)}
          handleDownload={handleDownload}
          downloadingImageId={downloadingImageId}
          refreshMainScreen={refreshMainScreen}
          handleReusePrompt={handleReusePrompt}
          toggleLike={toggleLike}
          likedImages={likedImages}
          likeCounts={likeCounts}
          setSelectedImage={setSelectedImage}
          setShowQuoteModal={setShowQuoteModal}
          setIsHistoryOpen={setIsHistoryOpen}
          isLoadingMainScreen={isLoadingMainScreen}
          toast={toast}
          /* No need to pass toggleHistoryView anymore */
        />
      )}

      {/* Upgrade Congrats Modal (one-time) */}
      {isAuthenticated && showUpgradeCongrats && (
        <UpgradeCongratsModal
          isOpen={showUpgradeCongrats}
          onClose={() => { setShowUpgradeCongrats(false); }}
          planLabel={(user?.subscription_plan || 'Pro')}
        />
      )}
      
      {/* Sign Out Confirmation Dialog */}
      {showSignOutConfirm && (
        <ConfirmDialog
          title="Sign Out"
          message="Are you sure you want to sign out of your account? You'll need to sign in again to access your generation history."
          confirmLabel="Sign Out"
          cancelLabel="Cancel"
          onConfirm={() => {
            // Close confirmation dialog immediately
            setShowSignOutConfirm(false);
            
            // Show loading toast
            toast({
              title: 'Signing out...',
              description: 'Please wait while we sign you out.'
            });
            
            // Set a flag to prevent auth redirects during sign out
            sessionStorage.setItem('isSigningOut', 'true');
            
            // Reset local state immediately
            setPrompt('');
            setShowGallery(false);
            
            // Use a simple approach that doesn't rely on hooks or async/await
            // Make a direct fetch call to sign out
            fetch('/api/auth/signout', {
              method: 'POST',
              credentials: 'include'
            })
            .then(response => {
              if (response.ok) {
                // Show success message
                toast({
                  title: 'Signed out successfully',
                  description: 'You have been signed out of your account.'
                });
                
                // Force refresh main screen to show public images
                if (typeof refreshMainScreen === 'function') {
                  refreshMainScreen();
                }
                
                // Get the current path
                const currentPath = window.location.pathname;
                
                // Redirect to main route if on /imagine or /gallery routes
                // Do not redirect if on /share route
                if (currentPath === '/imagine' || currentPath.startsWith('/gallery')) {
                  console.log('Sign out: Redirecting to main route from', currentPath);
                  
                  // Clear the signing out flag
                  sessionStorage.removeItem('isSigningOut');
                  
                  // Use window.location for a hard redirect to avoid React Router issues
                  window.location.href = '/';
                } else {
                  console.log('Sign out: Not redirecting from', currentPath);
                  
                  // Clear the signing out flag
                  sessionStorage.removeItem('isSigningOut');
                  
                  // Just reload the current page
                  setTimeout(() => {
                    window.location.reload();
                  }, 500);
                }
              } else {
                throw new Error('Failed to sign out');
              }
            })
            .catch(error => {
              console.error('Error signing out:', error);
              toast({
                title: 'Error signing out',
                description: 'There was a problem signing out. Please try again.',
                variant: 'destructive'
              });
              
              // Clear the signing out flag even on error
              sessionStorage.removeItem('isSigningOut');
              
              // Still reload the page to ensure a clean state
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            });
          }}
          onCancel={() => setShowSignOutConfirm(false)}
        />
      )}
      
      {/* Quote/Order Modal */}
      {showQuoteModal && selectedImage && (
        <QuoteModal image={selectedImage} onClose={() => setShowQuoteModal(false)} />
      )}
      
      <div className="flex-grow">
        <Routes>
          {/* Public landing page - only for non-authenticated users */}
          <Route path="/" element={
            <>
              <Header
                onOpenHistory={() => setIsHistoryOpen(true)}
                onSignOut={() => setShowSignOutConfirm(true)}
                onToggleGallery={() => setShowGallery(!showGallery)}
                isAuthenticated={isAuthenticated}
                showGallery={showGallery}
              />
              
              {showGallery ? (
                <Gallery
                  images={publicImages}
                  isLoading={isLoadingMainScreen}
                  isAuthenticated={isAuthenticated}
                  onQuoteRequest={(image) => {
                    setSelectedImage(image);
                    setShowQuoteModal(true);
                  }}
                  onDownload={handleDownload}
                  downloadingImageId={downloadingImageId}
                  onReusePrompt={handleReusePrompt}
                  onToggleLike={toggleLike}
                  likedImages={likedImages}
                  likeCounts={likeCounts}
                  loadImages={refreshMainScreen}
                  hasMore={hasMorePublic}
                  currentView={currentView}
                  switchView={switchGalleryView}
                  isMainScreenGallery={true}
                />
              ) : (
                <MainContent
                  prompt={prompt}
                  setPrompt={handlePromptChange}
                  handleSubmit={handleSubmit}
                  isLoading={isLoadingMainScreen}
                  error={error}
                  userImages={userImages}
                  publicImages={publicImages}
                  isGenerating={isGenerating}
                  isAuthenticated={isAuthenticated}
                  isEmailConfirmed={isEmailConfirmed}
                  handleDownload={handleDownload}
                  downloadingImageId={downloadingImageId}
                  handleReusePrompt={handleReusePrompt}
                  promptInputRef={promptInputRef}
                  toggleLike={toggleLike}
                  likedImages={likedImages}
                  likeCounts={likeCounts}
                  onOpenHistory={() => setIsHistoryOpen(true)}
                />
              )}
            </>
          } />
          
          {/* Main creation page - only for authenticated users */}
          <Route path="/imagine" element={
            <>
              <Header
                onOpenHistory={() => setIsHistoryOpen(true)}
                onSignOut={() => setShowSignOutConfirm(true)}
                onToggleGallery={() => navigate('/gallery')}
                isAuthenticated={isAuthenticated}
                showGallery={false}
              />
              <MainContent
                prompt={prompt}
                setPrompt={handlePromptChange}
                handleSubmit={handleSubmit}
                isLoading={isLoadingMainScreen}
                error={error}
                userImages={userImages}
                publicImages={publicImages}
                isGenerating={isGenerating}
                isAuthenticated={isAuthenticated}
                isEmailConfirmed={isEmailConfirmed}
                handleDownload={handleDownload}
                downloadingImageId={downloadingImageId}
                handleReusePrompt={handleReusePrompt}
                promptInputRef={promptInputRef}
                toggleLike={toggleLike}
                likedImages={likedImages}
                likeCounts={likeCounts}
                onOpenHistory={() => setIsHistoryOpen(true)}
              />
            </>
          } />

          {/* Upgrade page (auth required) */}
          <Route path="/upgrade" element={
            isAuthenticated ? (
              <>
                <Header
                  onOpenHistory={() => setIsHistoryOpen(true)}
                  onSignOut={() => setShowSignOutConfirm(true)}
                  onToggleGallery={() => navigate('/gallery')}
                  isAuthenticated={isAuthenticated}
                  showGallery={false}
                />
                <UpgradePage />
              </>
            ) : (
              <Navigate to="/" replace />
            )
          } />
          
          {/* Dedicated Gallery routes */}
          <Route path="/gallery" element={
            <>
              <Header
                onOpenHistory={() => setIsHistoryOpen(true)}
                onSignOut={() => setShowSignOutConfirm(true)}
                onToggleGallery={() => setShowGallery(!showGallery)}
                isAuthenticated={isAuthenticated}
                showGallery={showGallery}
              />
              <Gallery
                images={publicImages}
                isLoading={isLoadingMainScreen}
                isAuthenticated={isAuthenticated}
                onQuoteRequest={(image) => {
                  setSelectedImage(image);
                  setShowQuoteModal(true);
                }}
                onDownload={handleDownload}
                downloadingImageId={downloadingImageId}
                onReusePrompt={handleReusePrompt}
                onToggleLike={toggleLike}
                likedImages={likedImages}
                likeCounts={likeCounts}
                loadImages={refreshMainScreen}
                hasMore={hasMorePublic}
                currentView="recent"
                switchView={(newView) => {
                  // Navigate to the appropriate route instead of just switching view
                  if (newView === 'top-liked') {
                    // Store navigation data to trigger reload after route change
                    sessionStorage.setItem('galleryNavigation', JSON.stringify({
                      timestamp: Date.now(),
                      view: 'top-liked',
                      forcePublic: true
                    }));
                    navigate('/gallery/top');
                  }
                }}
                isMainScreenGallery={false}
              />
            </>
          } />
          
          <Route path="/gallery/top" element={
            <>
              <Header
                onOpenHistory={() => setIsHistoryOpen(true)}
                onSignOut={() => setShowSignOutConfirm(true)}
                onToggleGallery={() => setShowGallery(!showGallery)}
                isAuthenticated={isAuthenticated}
                showGallery={showGallery}
              />
              <Gallery
                images={publicImages}
                isLoading={isLoadingMainScreen}
                isAuthenticated={isAuthenticated}
                onQuoteRequest={(image) => {
                  setSelectedImage(image);
                  setShowQuoteModal(true);
                }}
                onDownload={handleDownload}
                downloadingImageId={downloadingImageId}
                onReusePrompt={handleReusePrompt}
                onToggleLike={toggleLike}
                likedImages={likedImages}
                likeCounts={likeCounts}
                loadImages={refreshMainScreen}
                hasMore={hasMorePublic}
                currentView="top-liked"
                switchView={(newView) => {
                  // Navigate to the appropriate route instead of just switching view
                  if (newView === 'recent') {
                    // Store navigation data to trigger reload after route change
                    sessionStorage.setItem('galleryNavigation', JSON.stringify({
                      timestamp: Date.now(),
                      view: 'recent',
                      forcePublic: true
                    }));
                    navigate('/gallery');
                  }
                }}
                isMainScreenGallery={false}
              />
            </>
          } />
          
          <Route path="/share/:imageId" element={<SharePage />} />
          <Route path="/confirm-email" element={<EmailConfirmationPage />} />
          <Route path="*" element={
            <div className="min-h-screen bg-black flex flex-col">
              {/* Header Component */}
              <Header
                user={user}
                isAuthenticated={isAuthenticated}
                isEmailConfirmed={isEmailConfirmed}
                logout={logout}
                userImages={userImages}
                clearHistory={() => {
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
                isLoadingHistory={isLoadingMainScreen}
                loadUserImages={refreshMainScreen}
                currentView={currentView}
                switchGalleryView={switchGalleryView}
                onToggleGallery={() => setShowGallery(!showGallery)}
                showGallery={showGallery}
                onOpenHistory={() => setIsHistoryOpen(true)}
                onSignOut={() => setShowSignOutConfirm(true)}
              />
              
              {/* Main Content or Gallery based on showGallery state */}
              {showGallery ? (
                <Gallery
                  images={publicImages || []}
                  isLoading={isLoadingMainScreen}
                  isAuthenticated={isAuthenticated}
                  onQuoteRequest={handleQuoteRequest}
                  onDownload={handleDownload}
                  downloadingImageId={downloadingImageId}
                  onReusePrompt={handleReusePrompt}
                  onToggleLike={toggleLikeInHistory}
                  likedImages={likedImages}
                  likeCounts={likeCounts}
                  loadImages={refreshMainScreen}
                  hasMore={hasMorePublic}
                  currentView={currentView}
                  switchView={switchGalleryView}
                />
              ) : (
                <MainContent
                  prompt={prompt}
                  setPrompt={handlePromptChange}
                  handleSubmit={handleSubmit}
                  isLoading={isLoadingMainScreen}
                  error={error}
                  userImages={userImages}
                  publicImages={publicImages}
                  isGenerating={isGenerating}
                  isAuthenticated={isAuthenticated}
                  isEmailConfirmed={isEmailConfirmed}
                  handleDownload={handleDownload}
                  downloadingImageId={downloadingImageId}
                  handleReusePrompt={handleReusePrompt}
                  promptInputRef={promptInputRef}
                  toggleLike={toggleLike}
                  likedImages={likedImages}
                  likeCounts={likeCounts}
                  onOpenHistory={() => setIsHistoryOpen(true)}
                />
              )}
              
              {/* Footer */}
              <Footer isAuthenticated={isAuthenticated} />
              
              {/* Quote Request Modal */}
              {showQuoteModal && selectedImage && (
                <Modal
                  title="Request Quote"
                  onClose={() => setShowQuoteModal(false)}
                  className="max-w-2xl"
                >
                  <div className="p-4">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="w-full md:w-1/3">
                        <div className="aspect-square bg-zinc-800 rounded-lg overflow-hidden">
                          <img
                            src={selectedImage.image_url || selectedImage.url}
                            alt={selectedImage.prompt || 'Selected jewelry'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      <div className="w-full md:w-2/3">
                        <form className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">
                              Your Name
                            </label>
                            <input
                              type="text"
                              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                              placeholder="Enter your name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">
                              Message
                            </label>
                            <textarea
                              rows={4}
                              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white resize-none"
                              placeholder="Describe any specific requirements or questions..."
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="button"
                              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg"
                              onClick={() => {
                                toast({
                                  title: 'Quote Requested',
                                  description: 'Your quote request has been sent. We will contact you soon.',
                                });
                                setShowQuoteModal(false);
                              }}
                            >
                              Submit Request
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                </Modal>
              )}
            </div>
          } />
        </Routes>
      </div>
      
      {/* Global Footer */}
      <Footer isAuthenticated={isAuthenticated} />
    </div>
  );
}

export default App;
