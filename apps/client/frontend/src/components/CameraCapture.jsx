import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, RotateCw, SwitchCamera } from 'lucide-react';

export function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isCounting, setIsCounting] = useState(false);
  const [isFlash, setIsFlash] = useState(false);
  const [rotation, setRotation] = useState(0); // 0,90,180,270 (clockwise)
  const [facing, setFacing] = useState('user'); // 'user' (front) | 'environment' (back)

  // Load saved prefs
  useEffect(() => {
    try {
      const savedFacing = localStorage.getItem('cameraFacing');
      if (savedFacing === 'user' || savedFacing === 'environment') setFacing(savedFacing);
      const savedRot = parseInt(localStorage.getItem('cameraRotation') || '0', 10);
      if ([0,90,180,270].includes(savedRot)) setRotation(savedRot);
    } catch {}
  }, []);

  // Persist prefs
  useEffect(() => {
    try { localStorage.setItem('cameraFacing', facing); } catch {}
  }, [facing]);
  useEffect(() => {
    try { localStorage.setItem('cameraRotation', String(rotation)); } catch {}
  }, [rotation]);

  // Start/Restart stream based on facing
  useEffect(() => {
    let cancelled = false;
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
        }
      } catch (e) {
        setError(e?.message || 'Failed to access camera');
      }
    }
    start();
    return () => { cancelled = true; };
  }, [facing]);

  // No automatic rotation; user controls rotation manually

  const performCapture = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const video = videoRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    // Set canvas to natural camera aspect (rotated if needed)
    const rot = ((rotation % 360) + 360) % 360; // normalize
    const rotated = rot === 90 || rot === 270;
    canvas.width = rotated ? vh : vw;
    canvas.height = rotated ? vw : vh;

    ctx.save();
    // Move origin to center
    ctx.translate(canvas.width / 2, canvas.height / 2);
    // Apply rotation (clockwise)
    ctx.rotate((rot * Math.PI) / 180);
    // Apply selfie mirror only for front camera
    if (facing === 'user') ctx.scale(-1, 1);
    // Draw full frame without cropping
    if (!rotated) {
      ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh);
    } else {
      // After 90/270 rotation, width/height swap
      ctx.drawImage(video, -vh / 2, -vw / 2, vh, vw);
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
          <div className="w-full bg-black rounded-lg overflow-hidden relative flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-auto object-contain"
              style={{ transform: `${facing==='user' ? 'scaleX(-1) ' : ''}rotate(${rotation}deg)`, transformOrigin: 'center center' }}
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
            <button
              type="button"
              onClick={() => setRotation(r => (r + 90) % 360)}
              disabled={!isReady || isCounting}
              className="px-3 py-2 rounded-md bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50 flex items-center gap-2"
              aria-label="Rotate"
              title="Rotate"
            >
              <RotateCw className="w-4 h-4" />
            </button>
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
