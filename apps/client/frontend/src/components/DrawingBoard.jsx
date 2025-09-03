import React, { useState, useEffect, useRef } from 'react';
import { DrawingCanvas } from './DrawingCanvas';
import { Button } from './ui/button';
import { Loader2, Eraser, Pencil, Maximize2, Minimize2, Plus, Minus } from 'lucide-react';

const COLORS = [
  { name: 'black', value: '#000000' },
  { name: 'red', value: '#ef4444' },
  { name: 'blue', value: '#3b82f6' },
  { name: 'green', value: '#22c55e' }
];

export function DrawingBoard({ 
  onGenerate, 
  onCancel, 
  isLoading, 
  initialDrawing,
  onDrawingStateChange,
  savedDrawingState
}) {
  const [tool, setTool] = useState(savedDrawingState?.tool || 'pencil');
  const [brushSize, setBrushSize] = useState(savedDrawingState?.brushSize || 8);
  const [selectedColor, setSelectedColor] = useState(savedDrawingState?.color || COLORS[0].value);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasSize, setCanvasSize] = useState(512);
  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);

  // Update canvas size when fullscreen changes or window resizes
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!isFullscreen) {
        setCanvasSize(512);
        return;
      }

      const minDimension = Math.min(window.innerWidth, window.innerHeight);
      const padding = 32;
      const newSize = Math.min(minDimension - padding, 1024);
      setCanvasSize(newSize);
    };

    updateCanvasSize();

    if (isFullscreen) {
      window.addEventListener('resize', updateCanvasSize);
      return () => window.removeEventListener('resize', updateCanvasSize);
    }
  }, [isFullscreen]);

  const handleDrawingComplete = async () => {
    if (isLoading) return;
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;

    // Create a new canvas for the thumbnail that preserves transparency
    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.width = canvas.width;
    thumbnailCanvas.height = canvas.height;
    const ctx = thumbnailCanvas.getContext('2d');

    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the original canvas content
    ctx.drawImage(canvas, 0, 0);

    // Convert to PNG data URL
    const pngDataUrl = thumbnailCanvas.toDataURL('image/png');
    
    // Get SVG data
    const svgData = canvasRef.current?.getSvgData();
    
    // Pass both formats to parent component
    onGenerate?.(pngDataUrl, svgData);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      canvasContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const adjustBrushSize = (delta) => {
    setBrushSize(prev => Math.min(Math.max(1, prev + delta), 32));
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Save drawing state when it changes
  useEffect(() => {
    onDrawingStateChange?.({
      tool,
      brushSize,
      color: selectedColor,
      paths: canvasRef.current?.getPaths() || []
    });
  }, [tool, brushSize, selectedColor, onDrawingStateChange]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-full overflow-hidden px-2 sm:px-0">
      {/* Controls - Always outside fullscreen */}
      <div className="w-full max-w-[512px] flex items-center justify-between flex-wrap gap-2 sm:flex-nowrap">
        {/* Left side - Line weight controls */}
        <div className="flex items-center gap-2 bg-zinc-800/50 p-1 rounded-lg">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => adjustBrushSize(-1)}
            className="h-8 w-8 sm:h-9 sm:w-9"
            disabled={brushSize <= 1}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-6 sm:w-8 text-center text-sm">{brushSize}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => adjustBrushSize(1)}
            className="h-8 w-8 sm:h-9 sm:w-9"
            disabled={brushSize >= 32}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Center - Tools */}
        <div className="flex items-center gap-2 bg-zinc-800/50 p-1 rounded-lg">
          <Button
            variant={tool === 'pencil' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setTool('pencil')}
            className="h-9 w-9"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant={tool === 'eraser' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setTool('eraser')}
            className="h-9 w-9"
          >
            <Eraser className="h-4 w-4" />
          </Button>
        </div>

        {/* Right side - Color selection */}
        <div className="flex items-center gap-1 bg-zinc-800/50 p-1 rounded-lg">
          {COLORS.map(color => (
            <button
              key={color.name}
              onClick={() => setSelectedColor(color.value)}
              className={`w-8 h-8 rounded-md transition-transform ${
                selectedColor === color.value ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-90' : ''
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>
      </div>

      {/* Canvas container - Can go fullscreen */}
      <div 
        ref={canvasContainerRef} 
        className={`relative w-full flex justify-center ${
          isFullscreen 
            ? 'fixed inset-0 bg-black z-50 flex items-center justify-center' 
            : ''
        }`}
        style={{
          width: isFullscreen ? '100vw' : '100%',
          height: isFullscreen ? '100vh' : 'auto',
          maxWidth: '512px'
        }}
      >
        <DrawingCanvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          tool={tool}
          brushSize={brushSize}
          color={selectedColor}
          initialDrawing={initialDrawing}
          savedPaths={savedDrawingState?.paths}
        />

        {/* Fullscreen toggle button */}
        <Button
          variant="secondary"
          size="icon"
          onClick={toggleFullscreen}
          className="absolute bottom-4 right-4 h-10 w-10 bg-zinc-900/80 hover:bg-zinc-900"
        >
          {isFullscreen ? (
            <Minimize2 className="h-5 w-5" />
          ) : (
            <Maximize2 className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Action buttons - Always outside fullscreen */}
      <div className="w-full max-w-[512px] flex gap-2">
        <Button
          variant="secondary"
          onClick={onCancel}
          className="flex-1 text-sm sm:text-base py-2 h-auto"
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleDrawingComplete}
          disabled={isLoading}
          className="flex-1 gap-2 text-sm sm:text-base py-2 h-auto"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            'Use Drawing'
          )}
        </Button>
      </div>
    </div>
  );
}