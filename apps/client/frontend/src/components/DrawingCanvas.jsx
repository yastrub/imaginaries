import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { getStroke } from 'perfect-freehand';
import { Undo2, Redo2, X } from 'lucide-react';
import { Button } from './ui/button';

function getSvgPathFromStroke(points) {
  if (!points.length) return '';

  const d = points.reduce((acc, [x0, y0], i, arr) => {
    if (i === 0) return `M ${x0} ${y0}`;

    const [x1, y1] = arr[(i + 1) % arr.length];
    const [x2, y2] = arr[(i + 2) % arr.length];

    if (i === arr.length - 1) {
      return `${acc} L ${x1} ${y1}`;
    }

    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    
    return `${acc} Q ${x0} ${y0} ${cx} ${cy}`;
  }, '');

  return d;
}

export const DrawingCanvas = forwardRef(({ 
  width = 512, 
  height = 512, 
  tool = 'pencil', 
  brushSize = 8,
  color = '#000000',
  initialDrawing,
  savedPaths = []
}, ref) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [paths, setPaths] = useState(savedPaths);
  const [undoStack, setUndoStack] = useState([]);
  const lastPoint = useRef(null);
  const lastTime = useRef(Date.now());
  const velocities = useRef([]);
  const isInitialDrawingLoaded = useRef(false);
  const currentTool = useRef(tool);

  // Update paths when savedPaths changes
  useEffect(() => {
    setPaths(savedPaths);
  }, [savedPaths]);

  useImperativeHandle(ref, () => ({
    getCanvas: () => {
      const canvas = canvasRef.current;
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      
      // Set dimensions for the export canvas
      tempCanvas.width = 512;
      tempCanvas.height = 512;
      
      // Fill with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 512, 512);
      
      // Draw all paths onto the export canvas
      paths.forEach(path => {
        if (path.points.length > 0) {
          const scaleX = 512 / path.width;
          const scaleY = 512 / path.height;
          
          const scaledPoints = path.points.map(point => [
            point[0] * scaleX,
            point[1] * scaleY,
            ...(point.slice(2) || [])
          ]);

          const stroke = getStroke(scaledPoints, {
            ...path.options,
            size: path.options.size * (512 / path.width)
          });
          
          const pathData = getSvgPathFromStroke(stroke);
          const tempPath = new Path2D(pathData);
          
          ctx.globalCompositeOperation = path.tool === 'eraser' ? 'destination-out' : 'source-over';
          ctx.fillStyle = path.tool === 'eraser' ? 'rgba(0,0,0,1)' : path.color;
          ctx.fill(tempPath);
        }
      });

      // Reset composite operation
      ctx.globalCompositeOperation = 'source-over';
      
      return tempCanvas;
    },
    // NEW METHOD: Export drawing as SVG data
    getSvgData: () => {
      // Create an SVG element
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '512');
      svg.setAttribute('height', '512');
      svg.setAttribute('viewBox', '0 0 512 512');
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      
      // Add a white background rect
      const background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('width', '512');
      background.setAttribute('height', '512');
      background.setAttribute('fill', 'white');
      svg.appendChild(background);
      
      // Add each path
      paths.forEach(path => {
        if (path.points.length > 0) {
          const scaleX = 512 / path.width;
          const scaleY = 512 / path.height;
          
          const scaledPoints = path.points.map(point => [
            point[0] * scaleX,
            point[1] * scaleY,
            ...(point.slice(2) || [])
          ]);

          const stroke = getStroke(scaledPoints, {
            ...path.options,
            size: path.options.size * (512 / path.width)
          });
          
          const pathData = getSvgPathFromStroke(stroke);
          
          const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          pathElement.setAttribute('d', pathData);
          pathElement.setAttribute('fill', path.tool === 'eraser' ? 'white' : path.color);
          pathElement.setAttribute('data-tool', path.tool);
          svg.appendChild(pathElement);
        }
      });
      
      // Convert to SVG string
      const serializer = new XMLSerializer();
      return serializer.serializeToString(svg);
    },
    getPaths: () => paths,
    clear: () => {
      setPaths([]);
      setUndoStack([]);
    }
  }));

  // Update current tool ref when tool prop changes
  useEffect(() => {
    currentTool.current = tool;
  }, [tool]);

  const getOptions = (velocity = 0) => {
    const baseSize = brushSize;
    const scaleFactor = width / 512;
    const scaledSize = baseSize * scaleFactor;

    return {
      size: scaledSize,
      thinning: 0.3,
      smoothing: 0.4,
      streamline: 0.15,
      easing: (t) => t,
      start: {
        taper: Math.min(12 * scaleFactor, scaledSize),
        easing: (t) => t,
        cap: true
      },
      end: {
        taper: Math.min(12 * scaleFactor, scaledSize),
        easing: (t) => t,
        cap: true
      },
      simulatePressure: true,
      last: isDrawing
    };
  };

  // Initialize canvas and load initial drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    if (initialDrawing && !isInitialDrawingLoaded.current) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        isInitialDrawingLoaded.current = true;
      };
      img.src = initialDrawing;
    }
  }, [width, height, initialDrawing]);

  const getPointerPosition = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (width / rect.width);
    const y = (e.clientY - rect.top) * (height / rect.height);
    return [x, y];
  };

  const calculateVelocity = (point) => {
    if (!lastPoint.current) {
      lastPoint.current = point;
      lastTime.current = Date.now();
      return 0;
    }

    const now = Date.now();
    const timeDelta = now - lastTime.current;
    const [x0, y0] = lastPoint.current;
    const [x1, y1] = point;
    const distance = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
    const velocity = distance / (timeDelta || 1);

    lastPoint.current = point;
    lastTime.current = now;

    velocities.current.push(velocity);
    if (velocities.current.length > 4) {
      velocities.current.shift();
    }

    return velocities.current.reduce((a, b) => a + b, 0) / velocities.current.length;
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    setIsDrawing(true);
    const point = getPointerPosition(e.nativeEvent || e);
    lastPoint.current = point;
    lastTime.current = Date.now();
    velocities.current = [];
    setCurrentPath([point]);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const native = e.nativeEvent || e;
    const events = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [native];
    const additions = [];
    for (const ev of events) {
      const point = getPointerPosition(ev);
      const velocity = calculateVelocity(point);
      additions.push([...point, velocity]);
    }
    if (additions.length) {
      setCurrentPath(prev => [...prev, ...additions]);
    }
  };

  const handlePointerUp = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    try { e && e.currentTarget && e.currentTarget.releasePointerCapture && e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    lastPoint.current = null;
    
    if (currentPath.length > 0) {
      const newPath = {
        points: currentPath,
        tool: currentTool.current,
        color,
        options: getOptions(),
        width,
        height
      };
      setPaths(prev => [...prev, newPath]);
      setUndoStack([]);
    }
    
    setCurrentPath([]);
  };

  const handleUndo = () => {
    if (paths.length === 0) return;
    const lastPath = paths[paths.length - 1];
    setUndoStack(prev => [...prev, lastPath]);
    setPaths(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (undoStack.length === 0) return;
    const pathToRedo = undoStack[undoStack.length - 1];
    setPaths(prev => [...prev, pathToRedo]);
    setUndoStack(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (paths.length === 0) return;
    setUndoStack(prev => [...prev, ...paths]);
    setPaths([]);
  };

  // Draw all paths
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear canvas with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Draw all completed paths
    paths.forEach(path => {
      if (path.points.length > 0) {
        const scaleX = width / path.width;
        const scaleY = height / path.height;
        
        const scaledPoints = path.points.map(point => [
          point[0] * scaleX,
          point[1] * scaleY,
          ...(point.slice(2) || [])
        ]);

        const stroke = getStroke(scaledPoints, {
          ...path.options,
          size: path.options.size * (width / path.width)
        });
        
        const pathData = getSvgPathFromStroke(stroke);
        const tempPath = new Path2D(pathData);

        // Set composite operation based on tool
        ctx.globalCompositeOperation = path.tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.fillStyle = path.tool === 'eraser' ? 'rgba(0,0,0,1)' : path.color;
        ctx.fill(tempPath);
      }
    });

    // Draw current path
    if (currentPath.length > 0) {
      const stroke = getStroke(currentPath, getOptions());
      const pathData = getSvgPathFromStroke(stroke);
      const tempPath = new Path2D(pathData);

      // Set composite operation based on current tool
      ctx.globalCompositeOperation = currentTool.current === 'eraser' ? 'destination-out' : 'source-over';
      ctx.fillStyle = currentTool.current === 'eraser' ? 'rgba(0,0,0,1)' : color;
      ctx.fill(tempPath);
    }

    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
  }, [paths, currentPath, color, width, height]);

  return (
    <div className="relative">
      <div 
        className="absolute top-2 left-2 flex items-center gap-0.5 bg-zinc-900/90 rounded-lg backdrop-blur-sm shadow-lg overflow-hidden"
        style={{ zIndex: 50 }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={handleUndo}
          disabled={paths.length === 0}
          className="h-8 w-8 rounded-none bg-transparent hover:bg-zinc-700/50"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRedo}
          disabled={undoStack.length === 0}
          className="h-8 w-8 rounded-none bg-transparent hover:bg-zinc-700/50"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          disabled={paths.length === 0}
          className="h-8 w-8 rounded-none bg-transparent hover:bg-zinc-700/50"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerOut={handlePointerUp}
        style={{ 
          touchAction: 'none',
          width: '100%',
          height: 'auto',
          maxWidth: `${width}px`,
          maxHeight: `${height}px`,
          aspectRatio: '1/1'
        }}
        className="bg-white rounded-lg border border-zinc-700 w-full"
      />
    </div>
  );
});

DrawingCanvas.displayName = 'DrawingCanvas';