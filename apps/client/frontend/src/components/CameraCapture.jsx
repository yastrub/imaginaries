import React, { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { X, Camera, RotateCw } from 'lucide-react';

export function CameraCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (!active) return;
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
    return () => {
      active = false;
      try {
        streamRef.current?.getTracks()?.forEach(t => t.stop());
      } catch {}
    };
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    // Target 9:16 portrait canvas
    const targetW = 1080;
    const targetH = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    const video = videoRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;

    // Cover compute (object-fit: cover) to fill 9:16
    const targetRatio = targetW / targetH; // 0.5625
    const srcRatio = vw / vh;
    let sw, sh, sx, sy;
    if (srcRatio > targetRatio) {
      // Wider than target, crop width
      sh = vh;
      sw = Math.round(vh * targetRatio);
      sx = Math.round((vw - sw) / 2);
      sy = 0;
    } else {
      // Taller than target, crop height
      sw = vw;
      sh = Math.round(vw / targetRatio);
      sx = 0;
      sy = Math.round((vh - sh) / 2);
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);

    const dataUrl = canvas.toDataURL('image/png');
    onCapture?.(dataUrl);
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
          <div className="w-full aspect-[9/16] bg-black rounded-lg overflow-hidden flex items-center justify-center">
            <video ref={videoRef} playsInline muted className="h-full" />
          </div>
          <div className="w-full flex gap-2">
            <Button variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button>
            <Button onClick={handleCapture} disabled={!isReady} className="flex-1 gap-2">
              <Camera className="w-4 h-4" /> Capture
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
