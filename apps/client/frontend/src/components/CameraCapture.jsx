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

    // Contain compute (object-fit: contain) to show as wide as possible (minimal cropping)
    const scale = Math.min(targetW / vw, targetH / vh);
    const dw = Math.round(vw * scale);
    const dh = Math.round(vh * scale);
    const dx = Math.round((targetW - dw) / 2);
    const dy = Math.round((targetH - dh) / 2);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, targetW, targetH);
    // Mirror horizontally in the output and draw contained
    ctx.save();
    ctx.translate(targetW, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, vw, vh, dx, dy, dw, dh);
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
            <video ref={videoRef} playsInline muted className="w-full h-full object-contain" style={{ transform: 'scaleX(-1)' }} />
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
