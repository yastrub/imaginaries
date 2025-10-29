import React, { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { X, Camera, RotateCw } from 'lucide-react';

export function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isCounting, setIsCounting] = useState(false);
  const [isFlash, setIsFlash] = useState(false);
  const [rotateFixDeg, setRotateFixDeg] = useState(0); // 0 or -90

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', aspectRatio: 3/4 },
          audio: false
        });
        if (!active) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Attempt to minimize camera zoom if supported
          try {
            const track = stream.getVideoTracks && stream.getVideoTracks()[0];
            const caps = track && track.getCapabilities ? track.getCapabilities() : null;
            if (caps && caps.zoom) {
              const minZoom = typeof caps.zoom.min === 'number' ? caps.zoom.min : (Array.isArray(caps.zoom) ? Math.min(...caps.zoom) : 1);
              await track.applyConstraints({ advanced: [{ zoom: minZoom }] });
            }
          } catch {}
          await videoRef.current.play();
          setIsReady(true);
          // Decide rotation fix: only if feed is landscape but screen is portrait
          try {
            const v = videoRef.current;
            const vw = v.videoWidth, vh = v.videoHeight;
            const scrAngle = (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === 'number')
              ? window.screen.orientation.angle
              : (typeof window.orientation === 'number' ? window.orientation : 0);
            const isScreenPortrait = scrAngle === 0 || scrAngle === 180;
            if (vw && vh && vw > vh && isScreenPortrait) {
              setRotateFixDeg(-90);
            } else {
              setRotateFixDeg(0);
            }
          } catch {}
        }
      } catch (e) {
        setError(e?.message || 'Failed to access camera');
      }
    }
    start();
    return () => {
      active = false;
      try {
        streamRef.current?.getTracks()?.forEach(t => t.stop());
      } catch {}
    };
  }, []);

  // Re-evaluate rotation on orientation changes and metadata load
  useEffect(() => {
    const handle = () => {
      const v = videoRef.current;
      if (!v) return;
      const vw = v.videoWidth, vh = v.videoHeight;
      const scrAngle = (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === 'number')
        ? window.screen.orientation.angle
        : (typeof window.orientation === 'number' ? window.orientation : 0);
      const isScreenPortrait = scrAngle === 0 || scrAngle === 180;
      if (vw && vh && vw > vh && isScreenPortrait) {
        setRotateFixDeg(-90);
      } else {
        setRotateFixDeg(0);
      }
    };
    const v = videoRef.current;
    if (v) v.addEventListener('loadedmetadata', handle);
    window.addEventListener('orientationchange', handle);
    window.addEventListener('resize', handle);
    return () => {
      if (v) v.removeEventListener('loadedmetadata', handle);
      window.removeEventListener('orientationchange', handle);
      window.removeEventListener('resize', handle);
    };
  }, []);

  const performCapture = async () => {
    if (!videoRef.current) return;
    // Target 3:4 portrait canvas
    const targetW = 1200;
    const targetH = 1600;
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    const video = videoRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    // Contain compute (object-fit: contain) to show as wide as possible
    let dw, dh, dx, dy;
    if (rotateFixDeg === -90) {
      const srcRotW = vh; // effective width after rotation
      const srcRotH = vw; // effective height after rotation
      const scaleR = Math.min(targetW / srcRotW, targetH / srcRotH);
      dw = Math.round(srcRotW * scaleR);
      dh = Math.round(srcRotH * scaleR);
      dx = Math.round((targetW - dw) / 2);
      dy = Math.round((targetH - dh) / 2);
    } else {
      const scale = Math.min(targetW / vw, targetH / vh);
      dw = Math.round(vw * scale);
      dh = Math.round(vh * scale);
      dx = Math.round((targetW - dw) / 2);
      dy = Math.round((targetH - dh) / 2);
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, targetW, targetH);
    // Draw with selfie mirror; apply -90 rotation correction when needed
    ctx.save();
    if (rotateFixDeg === -90) {
      // Move origin to center of target and rotate CCW 90, then mirror
      ctx.translate(targetW / 2, targetH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.scale(-1, 1);
      ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh);
    } else {
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, vw, vh, dx, dy, dw, dh);
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
          <div className="w-full aspect-[3/4] bg-black rounded-lg overflow-hidden relative flex items-center justify-center">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-contain"
              style={{ transform: rotateFixDeg === -90 ? 'rotate(-90deg) scaleX(-1)' : 'scaleX(-1)', transformOrigin: 'center center' }}
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
          <div className="w-full flex gap-2">
            <Button variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button>
            <Button onClick={handleCapture} disabled={!isReady || isCounting} className="flex-1 gap-2">
              <Camera className="w-4 h-4" /> Capture
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
