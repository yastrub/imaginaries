import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Settings2, Pencil, Eye, EyeOff, Camera, Upload } from 'lucide-react';
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
  const [uploadedThumbnail, setUploadedThumbnail] = useState(null);
  const fileInputRef = useRef(null);
  const [reimagineImageUrl, setReimagineImageUrl] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  // Always initialize as false (public/eye ON)
  const [isPrivate, setIsPrivate] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef(null);
  const [hasPromptFocus, setHasPromptFocus] = useState(false);
  const [initialPromptHeight, setInitialPromptHeight] = useState(null);
  
  // Get user subscription plan from Redux store
  const user = useSelector(state => state.auth.user);
  const { plan: planDetails } = useSubscription(user?.id);
  const canUsePrivateImages = !!planDetails?.allowPrivateImages;
  const canUseCamera = !!planDetails?.allowCamera;
  const shouldShowCamera = isMobile && isAuthenticated && canUseCamera;
  const canUseUpload = !!planDetails?.allowUpload;
  const shouldShowUpload = isAuthenticated && canUseUpload;
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

  // Measure initial textarea height once and lock the button to it
  useEffect(() => {
    const measure = () => {
      const el = promptInputRef?.current;
      if (el && !initialPromptHeight) {
        try {
          setInitialPromptHeight(el.offsetHeight);
        } catch {}
      }
    };
    // Defer to ensure DOM is ready and AutoResizeTextarea has applied height
    const t = setTimeout(measure, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Reimagine: listen for global flag and event; show image preview near prompt and focus textarea
  useEffect(() => {
    const applyReimagineFromWindow = () => {
      try {
        const url = window.__reimagineImageUrl;
        if (url && typeof url === 'string') {
          setReimagineImageUrl(url);
          // Clear existing text for reimagine flow only
          try { setPrompt(''); } catch {}
          // Focus prompt so user can type instructions immediately
          try { promptInputRef?.current?.focus(); } catch {}
        }
      } catch {}
    };

    const onReimagineSet = (e) => {
      const url = (e && e.detail && e.detail.url) ? e.detail.url : (window.__reimagineImageUrl || null);
      if (url) {
        setReimagineImageUrl(url);
        // Clear existing text for reimagine flow only
        try { setPrompt(''); } catch {}
        try { promptInputRef?.current?.focus(); } catch {}
      }
    };

    window.addEventListener('reimagine-set', onReimagineSet);
    // Initial check in case it was set prior to mount
    applyReimagineFromWindow();
    const t = setTimeout(applyReimagineFromWindow, 200);
    return () => {
      window.removeEventListener('reimagine-set', onReimagineSet);
      clearTimeout(t);
    };
  }, [promptInputRef]);

  const handlePromptInputChange = (e) => {
    const v = e.target.value;
    setPrompt(v);
    setIsTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 2400);
  };

  const onPromptFocus = () => {
    setIsTyping(true);
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setHasPromptFocus(true);
  };

  const onPromptBlur = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setHasPromptFocus(false);
    setIsTyping(false);
  };

  // Always show full prompt text; no masking
  const showIcons = true;

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

  const onUploadClick = () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    try { fileInputRef.current?.click(); } catch {}
  };

  const onFileSelected = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const allowed = ['image/jpeg','image/png','image/webp','image/jpg'];
    if (!allowed.includes(file.type)) {
      e.target.value = '';
      return;
    }
    const max = 10 * 1024 * 1024;
    if (file.size > max) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedThumbnail(reader.result);
      try { promptInputRef?.current?.focus(); } catch {}
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!prompt?.trim()) {
      promptInputRef?.current?.focus();
      return;
    }

    // Pass drawing data (both PNG and SVG), camera photo, and reimagine URL to the submit handler
    onSubmit(e, {
      drawingPng: drawingThumbnail,
      drawingSvg: drawingSvgData,
      isPrivate: isPrivate,
      cameraPng: cameraThumbnail,
      uploadedPng: uploadedThumbnail,
      reimagineImageUrl: reimagineImageUrl
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
          {/* Action toolbar above prompt area */}
          <div className="w-full flex justify-center mb-4">
            <div className={`flex items-center gap-2 flex-wrap justify-center`}>
              <button
                type="button"
                onClick={handleDrawingClick}
                className="p-2 rounded-full border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-700/60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Open drawing board"
                title="Sketch"
              >
                <Pencil className="w-5 h-5" />
              </button>
              {shouldShowCamera && (
                <button
                  type="button"
                  onClick={handleCameraClick}
                  className="p-2 rounded-full border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-700/60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Open camera"
                  title="Take a photo"
                >
                  <Camera className="w-5 h-5" />
                </button>
              )}
              {shouldShowUpload && (
                <>
                  <button
                    type="button"
                    onClick={onUploadClick}
                    className="p-2 rounded-full border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:text-white hover:bg-zinc-700/60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-label="Upload image"
                    title="Upload image"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    className="hidden"
                    onChange={onFileSelected}
                  />
                </>
              )}
              {isAuthenticated && canUsePrivateImages && (
                <button
                  type="button"
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={`p-2 rounded-full border border-zinc-700 bg-zinc-800/60 ${isPrivate ? 'text-primary' : 'text-zinc-300 hover:text-white hover:bg-zinc-700/60'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                  aria-label={isPrivate ? 'Set image as public' : 'Set image as private'}
                  title={isPrivate ? 'Private image (only visible to you)' : 'Public image (visible to everyone)'}
                  data-privacy-state={isPrivate ? 'private' : 'public'}
                >
                  {isPrivate ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              )}
              <button
                type="button"
                onClick={openPresetsModal}
                className={`p-2 rounded-full border border-zinc-700 bg-zinc-800/60 ${selectedPresets.length > 0 ? 'text-primary' : 'text-zinc-300 hover:text-white hover:bg-zinc-700/60'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                aria-label="Open presets"
                title="Presets"
              >
                <Settings2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="input-wrapper flex">
              {(drawingThumbnail || cameraThumbnail || uploadedThumbnail || reimagineImageUrl) && (
                <div className="flex items-center gap-[1px] bg-zinc-700/40">
                  {cameraThumbnail && (
                    <div className="relative flex-shrink-0 w-[4rem] h-[4rem] bg-zinc-800 border-r border-zinc-700">
                      <img src={cameraThumbnail} alt="Camera" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setCameraThumbnail(null)} className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-zinc-900/80 hover:bg-red-600 rounded-bl text-zinc-400 hover:text-white transition-colors" title="Remove photo">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                      </button>
                    </div>
                  )}
                  {uploadedThumbnail && (
                    <div className="relative flex-shrink-0 w-[4rem] h-[4rem] bg-zinc-800 border-r border-zinc-700">
                      <img src={uploadedThumbnail} alt="Upload" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setUploadedThumbnail(null)} className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-zinc-900/80 hover:bg-red-600 rounded-bl text-zinc-400 hover:text-white transition-colors" title="Remove image">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                      </button>
                    </div>
                  )}
                  {reimagineImageUrl && (
                    <div className="relative flex-shrink-0 w-[4rem] h-[4rem] bg-zinc-800 border-r border-zinc-700">
                      <img src={reimagineImageUrl} alt="Reimagine" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setReimagineImageUrl(null)} className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-zinc-900/80 hover:bg-red-600 rounded-bl text-zinc-400 hover:text-white transition-colors" title="Remove image">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                      </button>
                    </div>
                  )}
                  {drawingThumbnail && (
                    <div className="relative flex-shrink-0 w-[4rem] h-[4rem] bg-zinc-800 border-r border-zinc-700">
                      <button type="button" onClick={handleDrawingClick} className="w-full h-full">
                        <img src={drawingThumbnail} alt="Drawing" className="h-full w-full object-contain" />
                      </button>
                      <button type="button" onClick={() => { setDrawingThumbnail(null); setDrawingSvgData(null); setDrawingState(null); }} className="absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-zinc-900/80 hover:bg-red-600 rounded-bl text-zinc-400 hover:text-white transition-colors" title="Remove drawing">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
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
                  className={undefined}
                  fixedHeightPx={null}
                  spellCheck={true}
                  autoCorrect={'on'}
                  autoCapitalize={undefined}
                  data-gramm={undefined}
                  data-enable-grammarly={undefined}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto primary-button self-start flex items-center"
              id="generateBtn"
              style={initialPromptHeight ? { height: `${initialPromptHeight}px` } : undefined}
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