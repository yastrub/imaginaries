import React, { useEffect } from 'react';
import { useReduxAuth } from '../hooks/useReduxAuth';
import { useSelector } from 'react-redux';

export function EmergencyMainView({
  prompt,
  handlePromptChange,
  handleSubmit,
  isGenerating,
  userImages,
  promptInputRef,
  setIsHistoryOpen
}) {
  // Add debug logging
  console.log('EmergencyMainView rendering with props:', { 
    prompt, 
    handlePromptChange: !!handlePromptChange,
    handleSubmit: !!handleSubmit,
    isGenerating,
    userImagesLength: userImages?.length || 0,
    promptInputRef: !!promptInputRef,
    setIsHistoryOpen: !!setIsHistoryOpen
  });
  
  // Get auth state from Redux
  const authState = useSelector(state => state.auth);
  console.log('EmergencyMainView auth state:', authState);
  const { isAuthenticated } = useReduxAuth();
  
  return (
    <div className="container mx-auto px-4 pt-40 pb-16 sm:pt-32 sm:pb-16">
      <div className="max-w-3xl mx-auto relative">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Imaginaries</h1>
        
        <div className="bg-zinc-800/50 backdrop-blur-sm rounded-xl p-6 mb-8">
          <h2 className="text-xl font-medium text-white mb-4">Generate Jewelry</h2>
          <div className="flex gap-2 flex-wrap mb-4">
            {['Ring', 'Necklace', 'Earrings', 'Bracelet', 'Pendant'].map(type => (
              <button 
                key={type}
                className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-1 rounded-full text-sm"
              >
                {type}
              </button>
            ))}
          </div>
          
          <textarea 
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={4}
            placeholder=""
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            ref={promptInputRef}
            name="prompt"
            data-qa="prompt-textarea"
          />
          
          <div className="mt-4 flex justify-end">
            <button 
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-medium"
              onClick={handleSubmit}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {userImages && userImages.length > 0 ? (
            userImages.slice(0, 4).map((image, index) => (
              <div key={index} className="bg-zinc-800 rounded-lg overflow-hidden aspect-square">
                {image.url && (
                  <img 
                    src={image.image_url || image.url} 
                    alt={image.prompt || 'Generated jewelry'} 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-8 text-zinc-400">
              No images yet. Generate your first jewelry design!
            </div>
          )}
        </div>
        
        {isAuthenticated && userImages && userImages.length > 0 && (
          <div className="mt-8 flex justify-center">
            <button 
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg"
              onClick={() => setIsHistoryOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v5h5" /><path d="M3 3l6.1 6.1" />
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l2 2" />
              </svg>
              Show all my jewelry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
