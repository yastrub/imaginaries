import React from 'react';
import { GenerateForm } from './GenerateForm';
import { ImageResults } from './ImageResults';
import { ErrorMessage } from './ErrorMessage';
import { WelcomeMessage } from './WelcomeMessage';
import { QuotaBadge } from './QuotaBadge';
import { Button } from './ui/button';
import { History, LogIn } from 'lucide-react';
import { JewelryTypeBadges } from './JewelryTypeBadges';
import { Modal } from './Modal';
import { PresetsGrid } from './PresetsGrid';
import { usePromptContext } from '../contexts/PromptContext';
import { openAuthModal } from './CompletelyIsolatedAuth';
// Import the consolidated data hook that prevents duplicate API calls
import { useConsolidatedData } from '../hooks/useConsolidatedData';

export const MainContent = React.memo(function MainContent({
  session,
  isAuthenticated,
  isEmailConfirmed,
  handleDownload,
  downloadingImageId,
  handlePromptChange,
  handleSubmit,
  isLoading,
  error,
  isGenerating,
  promptInputRef,
  handleReusePrompt,
  likedImages,
  likeCounts,
  toggleLike,
  onOpenHistory = () => console.log('onOpenHistory not provided')
}) {
  // Use the consolidated data hook that prevents duplicate API calls
  const { 
    userImages = [], 
    publicImages = [],
    isLoading: loading, 
    error: dataError, 
    refresh, 
    loadNextPage: loadMore, 
    loadData,
    hasMore,
    view: currentView,
    switchView: switchGalleryView
  } = useConsolidatedData();
  
  // Use a ref to track if we've already loaded data
  const initialLoadDoneRef = React.useRef(false);
  
  // IMPORTANT: We're disabling automatic data loading on mount to prevent duplicate API calls
  // Data will be loaded automatically by React Query with proper caching and deduplication
  React.useEffect(() => {
    console.log('MainContent: Component mounted - React Query will handle data loading');
    initialLoadDoneRef.current = true;
  }, []);
  
  // Determine which images to show based on authentication state
  // Note: 'images' prop should be the user's images from the parent component
  // If not provided, fall back to the hook data based on authentication state
  const imagesToDisplay = isAuthenticated ? userImages : publicImages;
  const isDataLoading = isLoading || loading;
  
  // Add detailed debugging
  console.log('MainContent data:', {
    userImages: userImages?.length || 0,
    publicImages: publicImages?.length || 0,
    imagesToDisplay: imagesToDisplay?.length || 0,
    isAuthenticated,
    loading,
    isLoading,
    isDataLoading,
    imagesToDisplayData: imagesToDisplay
  });

  // Use the prompt context for state management
  const { isPresetsModalOpen, closePresetsModal } = usePromptContext();
  return (
    <>
      {/* Gradient overlay */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.15) 0%, rgba(99, 102, 241, 0.15) 25%, rgba(0, 0, 0, 0) 50%)',
          height: '100vh',
        }}
      />

      <main className="container mx-auto px-4 pt-40 pb-16 sm:pt-32 sm:pb-16">
        {/* Debug indicators removed */}
        <div className="max-w-3xl mx-auto relative">
          <QuotaBadge isAuthenticated={isAuthenticated} />
          <WelcomeMessage />

          <JewelryTypeBadges />

          {error && <ErrorMessage message={error} />}

          <GenerateForm
            onSubmit={handleSubmit}
            isLoading={isGenerating}
            promptInputRef={promptInputRef}
            isAuthenticated={isAuthenticated}
          />

          {/* Presets Modal with higher z-index - only rendered when isPresetsModalOpen is true */}
          {isPresetsModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[9999]" style={{pointerEvents: 'auto'}}>
              <div className="bg-zinc-900 rounded-xl w-full max-w-lg mx-4 overflow-hidden shadow-xl transform transition-all">
                <div className="relative max-h-[80vh] overflow-y-auto p-4">
                  <button 
                    onClick={closePresetsModal}
                    className="absolute right-4 top-4 text-gray-400 hover:text-white"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"></path>
                    </svg>
                  </button>
                  <PresetsGrid />
                </div>
              </div>
            </div>
          )}

          <div className="mt-8">
            <ImageResults
              images={userImages}
              publicImages={publicImages}
              isLoading={isDataLoading}
              isGenerating={isGenerating}
              isAuthenticated={isAuthenticated}
              onReusePrompt={handleReusePrompt}
              onToggleLike={toggleLike}
              likedImages={likedImages}
              likeCounts={likeCounts}
            />

            {isAuthenticated && userImages?.length > 0 ? (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="secondary"
                  onClick={onOpenHistory}
                  className="gap-2"
                >
                  <History className="w-4 h-4" />
                  Show all my jewelry
                </Button>
              </div>
            ) : !isAuthenticated && (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="default"
                  onClick={openAuthModal}
                  className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in to start creating!
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
});