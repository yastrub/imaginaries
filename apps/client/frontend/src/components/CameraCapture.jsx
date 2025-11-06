import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { X, Camera, SwitchCamera } from 'lucide-react';

export function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isCounting, setIsCounting] = useState(false);
  const [isFlash, setIsFlash] = useState(false);
  const [facing, setFacing] = useState('user'); // 'user' (front) | 'environment' (back)
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const isTerminalApp = useSelector((state) => state?.env?.isTerminalApp);

  // Load saved prefs
  useEffect(() => {
    try {
      const savedFacing = localStorage.getItem('cameraFacing');
      if (savedFacing === 'user' || savedFacing === 'environment') setFacing(savedFacing);
    } catch {}
  }, []);

  // Persist prefs
  useEffect(() => {
    try { localStorage.setItem('cameraFacing', facing); } catch {}
  }, [facing]);

  // Start/Restart stream based on facing, and detect available cameras
  useEffect(() => {
    let cancelled = false;
    const updateCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      } catch {}
    };
    async function start() {
      try {
        // Stop old stream
        try { streamRef.current?.getTracks()?.forEach(t => t.stop()); } catch {}
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false
        });
        if (cancelled) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsReady(true);
          // After permissions granted, device enumeration will work reliably
          updateCameras();
        }
      } catch (e) {
        setError(e?.message || 'Failed to access camera');
      }
    }
    start();
    navigator.mediaDevices?.addEventListener?.('devicechange', updateCameras);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', updateCameras);
    };
  }, [facing]);

  // No rotation control; rely on natural orientation

  const performCapture = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    // Target 3:4 canvas, letterbox if needed (no cropping)
    const targetRatio = 3 / 4;
    let cw = Math.round(vh * targetRatio);
    let ch = vh;
    if (cw > vw) {
      cw = vw;
      ch = Math.round(vw / targetRatio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');

    // Compute scale to fit entire video within canvas (object-contain)
    const scale = Math.min(cw / vw, ch / vh);
    const dw = Math.round(vw * scale);
    const dh = Math.round(vh * scale);
    const dx = Math.round((cw - dw) / 2);
    const dy = Math.round((ch - dh) / 2);

    ctx.save();
    if (facing === 'user') {
      // Mirror horizontally for front camera
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, cw - dx - dw, dy, dw, dh);
    } else {
      ctx.drawImage(video, dx, dy, dw, dh);
    }
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/png');
    onCapture?.(dataUrl);
  };

  const handleCapture = () => {
    if (!isReady || isCounting) return;
    setIsCounting(true);
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          setIsCounting(false);
          // AAA flash effect during shot
          setIsFlash(true);
          setTimeout(() => {
            performCapture();
            setTimeout(() => setIsFlash(false), 220);
          }, 50);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl w-full max-w-[420px] overflow-hidden shadow-xl">
        <div className="flex items-center justify-between p-3 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-white">
            <Camera className="w-5 h-5" />
            <span>Take a photo</span>
          </div>
          <button onClick={onCancel} className="text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 flex flex-col items-center gap-3">
          {error && (
            <div className="text-red-400 text-sm w-full">{error}</div>
          )}
          <div className="w-full bg-black rounded-lg overflow-hidden relative flex items-center justify-center aspect-[3/4]">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-contain"
              style={{ transform: facing==='user' ? 'scaleX(-1)' : 'none', transformOrigin: 'center center' }}
            />
            {isCounting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="flex items-center justify-center w-28 h-28 rounded-full bg-white/10 border border-white/30 shadow-xl">
                  <span className="text-5xl font-bold text-white animate-pulse">{countdown}</span>
                </div>
              </div>
            )}
            {isFlash && (
              <div className="absolute inset-0 bg-white/90 animate-[fadeOut_0.25s_ease-in_forwards]" style={{
                // Tailwind custom keyframes via inline style fallback
                animation: 'flashFade 250ms ease-in forwards'
              }} />
            )}
          </div>
          <div className="w-full flex gap-3 mt-2 items-center">
            {hasMultipleCameras && !isTerminalApp && (
              <button
                type="button"
                onClick={() => setFacing(f => f === 'user' ? 'environment' : 'user')}
                disabled={!isReady || isCounting}
                className="px-3 py-2 rounded-md bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50 flex items-center gap-2"
                aria-label="Switch camera"
                title="Switch camera"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleCapture}
              disabled={!isReady || isCounting}
              className="flex-1 px-4 py-2 rounded-md bg-white text-black hover:bg-zinc-100 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" /> Capture
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
