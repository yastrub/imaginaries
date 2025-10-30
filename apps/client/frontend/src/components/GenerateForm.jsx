import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Settings2, Pencil, Eye, EyeOff, Camera } from 'lucide-react';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { DrawingBoard } from './DrawingBoard';
// Import the openAuthModal function
import { openAuthModal } from './CompletelyIsolatedAuth';
import { usePromptContext } from '../contexts/PromptContext';
import { useSelector } from 'react-redux';
import { useSubscription } from '../hooks/useSubscription';
import { CameraCapture } from './CameraCapture';

export const GenerateForm = React.memo(function GenerateForm({ 
  onSubmit, 
  isLoading, 
  promptInputRef,
  isAuthenticated
}) {
  const { prompt, setPrompt, selectedPresets, openPresetsModal } = usePromptContext();
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingThumbnail, setDrawingThumbnail] = useState(null);
  const [drawingSvgData, setDrawingSvgData] = useState(null);
  const [drawingState, setDrawingState] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraThumbnail, setCameraThumbnail] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  // Always initialize as false (public/eye ON)
  const [isPrivate, setIsPrivate] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef(null);
  
  // Get user subscription plan from Redux store
  const user = useSelector(state => state.auth.user);
  const { plan: planDetails } = useSubscription(user?.id);
  const canUsePrivateImages = !!planDetails?.allowPrivateImages;
  const canUseCamera = !!planDetails?.allowCamera;
  const shouldShowCamera = isMobile && (isAuthenticated ? canUseCamera : true);
  // UI: camera availability is mobile-only; server enforces plan gating
  useEffect(() => {
    try {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const isMob = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
      const coarse = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(pointer:coarse)').matches : false;
      setIsMobile(!!(isMob || coarse));
    } catch {
      setIsMobile(false);
    }
  }, []);
  
  // Ensure privacy is always set to public (eye ON) initially and after any auth changes
  useEffect(() => {
    // Force to public (isPrivate = false) in all cases
    setIsPrivate(false);
    
    // Add a small delay to ensure this happens after any state initialization
    const timer = setTimeout(() => {
      setIsPrivate(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isAuthenticated, user?.id]);
  
  // EMERGENCY FIX: Listen for the prompt-reused event
  useEffect(() => {
    // Function to handle the prompt-reused event
    const handlePromptReused = (event) => {
      console.log('GenerateForm: Received prompt-reused event:', event.detail.prompt);
      setPrompt(event.detail.prompt);
    };

    // Function to check for the global prompt variable
    const checkGlobalPrompt = () => {
      if (window.__lastReusedPrompt) {
        console.log('GenerateForm: Found global prompt variable:', window.__lastReusedPrompt);
        setPrompt(window.__lastReusedPrompt);
        // Clear it to prevent it from being used again
        window.__lastReusedPrompt = null;
      }
    };
    
    // Add event listener for our custom event
    window.addEventListener('prompt-reused', handlePromptReused);
    
    // Check for the global prompt variable immediately
    checkGlobalPrompt();
    
    // Also check again after a short delay to ensure it's set
    const timeoutId = setTimeout(checkGlobalPrompt, 300);
    
    // Clean up
    return () => {
      window.removeEventListener('prompt-reused', handlePromptReused);
      clearTimeout(timeoutId);
    };
  }, [setPrompt]);

  const handlePromptInputChange = (e) => {
    const v = e.target.value;
    setPrompt(v);
    setIsTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 700);
  };

  const onPromptFocus = () => {
    setIsTyping(true);
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  };

  const onPromptBlur = () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 150);
  };

  const maskedFirstWord = useMemo(() => {
    const txt = typeof prompt === 'string' ? prompt.trim() : '';
    if (!txt) return '';
    const tokenMatch = txt.match(/^(\S+)/);
    const rawFirst = tokenMatch ? tokenMatch[1] : '';
    const first = rawFirst.replace(/[,:.]+$/, '');
    // Remainder after the first token
    const remainder = txt.slice(rawFirst.length);
    // Remove any leading punctuation and whitespace from remainder
    const restAfterPunct = remainder.replace(/^[,:.\s]+/, '');
    if (restAfterPunct.length > 0) {
      return first ? `${first}...` : '';
    }
    return first;
  }, [prompt]);

  const showIcons = !isTyping;
  const showMask = !isTyping && !!prompt;

  const handleDrawingComplete = (dataUrl, svgData) => {
    setDrawingThumbnail(dataUrl);
    setDrawingSvgData(svgData);
    setIsDrawing(false);
  };

  const handleCameraClick = () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    setIsCameraOpen(true);
  };

  const handleCameraCaptured = (dataUrl) => {
    setCameraThumbnail(dataUrl);
    setIsCameraOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!prompt?.trim()) {
      promptInputRef?.current?.focus();
      return;
    }

    // Pass drawing data (both PNG and SVG) and camera photo to the submit handler
    onSubmit(e, {
      drawingPng: drawingThumbnail,
      drawingSvg: drawingSvgData,
      isPrivate: isPrivate,
      cameraPng: cameraThumbnail
    });
  };

  const handleDrawingClick = () => {
    if (!isAuthenticated) {
      // Open the auth modal if user is not authenticated
      openAuthModal();
      return;
    }
    setIsDrawing(true);
  };

  return (
    <div className="w-full">
      {/* Using app-level auth modal instead */}

      {isDrawing ? (
        <DrawingBoard
          onGenerate={handleDrawingComplete}
          onCancel={() => setIsDrawing(false)}
          isLoading={isLoading}
          initialDrawing={drawingThumbnail}
          onDrawingStateChange={setDrawingState}
          savedDrawingState={drawingState}
        />
      ) : (
        <form onSubmit={handleSubmit} className="w-full">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="input-wrapper flex">
              {(drawingThumbnail || cameraThumbnail) && (
                <div className="flex items-center gap-[1px] bg-zinc-700/40">
                  {cameraThumbnail && (
                    <div className="relative flex-shrink-0 w-[4rem] h-[4rem] bg-zinc-800 border-r border-zinc-700">
                      <img src={cameraThumbnail} alt="Camera" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setCameraThumbnail(null)}
                        className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-zinc-900/80 hover:bg-red-600 rounded-bl text-zinc-400 hover:text-white transition-colors"
                        title="Remove photo"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                      </button>
                    </div>
                  )}
                  {drawingThumbnail && (
                    <div className="relative flex-shrink-0 w-[4rem] h-[4rem] bg-zinc-800 border-r border-zinc-700">
                      <button
                        type="button"
                        onClick={handleDrawingClick}
                        className="w-full h-full"
                      >
                        <img 
                          src={drawingThumbnail} 
                          alt="Drawing" 
                          className="h-full w-full object-contain"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDrawingThumbnail(null);
                          setDrawingSvgData(null);
                          setDrawingState(null);
                        }}
                        className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-zinc-900/80 hover:bg-red-600 rounded-bl text-zinc-400 hover:text-white transition-colors"
                        title="Remove drawing"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex-grow relative">
                <AutoResizeTextarea
                  ref={promptInputRef}
                  value={prompt}
                  onChange={handlePromptInputChange}
                  onFocus={onPromptFocus}
                  onBlur={onPromptBlur}
                  placeholder=""
                  name="prompt"
                  data-qa="prompt-textarea"
                  required
                  className={showMask ? 'text-transparent caret-white' : undefined}
                  fixedHeightPx={showMask ? 64 : null}
                />
                {showMask && (
                  <div className="pointer-events-none absolute inset-0 px-6 py-4 pr-24 text-foreground text-xl leading-relaxed whitespace-pre-wrap break-words select-none">
                    {maskedFirstWord}
                  </div>
                )}
                <div className="absolute right-4 top-0 h-[4rem] flex items-center">
                  <div className={`flex items-center gap-1 bg-zinc-800/50 p-1 rounded-lg transition-opacity ${showIcons ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                  >
                    <button
                      type="button"
                      onClick={handleDrawingClick}
                      className="p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    {shouldShowCamera && (
                      <button
                        type="button"
                        onClick={handleCameraClick}
                        className={`p-2 transition-colors text-zinc-400 hover:text-white`}
                        title={'Take a photo'}
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    )}
                    {isAuthenticated && canUsePrivateImages && (
                      <button
                        type="button"
                        onClick={() => setIsPrivate(!isPrivate)}
                        className={`p-2 transition-colors ${isPrivate ? 'text-primary' : 'text-zinc-400 hover:text-white'}`}
                        title={isPrivate ? 'Private image (only visible to you)' : 'Public image (visible to everyone)'}
                        data-privacy-state={isPrivate ? 'private' : 'public'}
                      >
                        {isPrivate ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={openPresetsModal}
                      className={`p-2 transition-colors ${selectedPresets.length > 0 ? 'text-primary' : 'text-zinc-400 hover:text-white'}`}
                    >
                      <Settings2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto primary-button"
              id="generateBtn"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Generating...</span>
                </div>
              ) : (
                <span className="button-content">
                  <Sparkles className="w-6 h-6" />
                  <span>Imagine...</span>
                </span>
              )}
            </button>
          </div>
        </form>
      )}
      {isCameraOpen && (
        <CameraCapture
          onCapture={handleCameraCaptured}
          onCancel={() => setIsCameraOpen(false)}
        />
      )}
    </div>
  );
});