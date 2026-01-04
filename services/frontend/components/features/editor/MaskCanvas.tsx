'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface MaskCanvasProps {
  imageUrl: string;
  width: number;
  height: number;
  brushSize: number;
  brushHardness: number; // 0-100, 0=soft, 100=hard
  brushMode: 'brush' | 'eraser';
  onMaskChange: (maskDataUrl: string) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

const MAX_HISTORY = 50;

export function MaskCanvas({
  imageUrl,
  width,
  height,
  brushSize,
  brushHardness,
  brushMode,
  onMaskChange,
  onHistoryChange,
}: MaskCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(false);

  // History for undo/redo
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);

  // Calculate scale to fit container
  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight || 600;
      const scaleX = containerWidth / width;
      const scaleY = containerHeight / height;
      setScale(Math.min(scaleX, scaleY, 1));
    }
  }, [width, height]);

  // Save state to history
  const saveToHistory = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, width, height);

    // Remove any redo states
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);

    // Add new state
    historyRef.current.push(imageData);

    // Limit history size
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }

    onHistoryChange?.(historyIndexRef.current > 0, false);
  }, [width, height, onHistoryChange]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;

    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    historyIndexRef.current--;
    const imageData = historyRef.current[historyIndexRef.current];
    ctx.putImageData(imageData, 0, 0);

    const maskDataUrl = canvas.toDataURL('image/png');
    onMaskChange(maskDataUrl);
    onHistoryChange?.(
      historyIndexRef.current > 0,
      historyIndexRef.current < historyRef.current.length - 1
    );
  }, [onMaskChange, onHistoryChange]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;

    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    historyIndexRef.current++;
    const imageData = historyRef.current[historyIndexRef.current];
    ctx.putImageData(imageData, 0, 0);

    const maskDataUrl = canvas.toDataURL('image/png');
    onMaskChange(maskDataUrl);
    onHistoryChange?.(
      historyIndexRef.current > 0,
      historyIndexRef.current < historyRef.current.length - 1
    );
  }, [onMaskChange, onHistoryChange]);

  // Load image onto canvas
  useEffect(() => {
    const imageCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imageCanvas || !maskCanvas) return;

    const imageCtx = imageCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!imageCtx || !maskCtx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Draw image
      imageCtx.clearRect(0, 0, width, height);
      imageCtx.drawImage(img, 0, 0, width, height);

      // Clear mask
      maskCtx.clearRect(0, 0, width, height);

      // Initialize history
      historyRef.current = [maskCtx.getImageData(0, 0, width, height)];
      historyIndexRef.current = 0;
      onHistoryChange?.(false, false);

      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl, width, height, onHistoryChange]);

  const getCanvasCoordinates = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const canvas = maskCanvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;

      if ('touches' in e) {
        if (e.touches.length === 0) return null;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const x = (clientX - rect.left) / scale;
      const y = (clientY - rect.top) / scale;

      return { x, y };
    },
    [scale]
  );

  // Create gradient brush based on hardness
  const createBrushGradient = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      const radius = brushSize / 2;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

      // Hardness affects the gradient falloff
      const hardnessNormalized = brushHardness / 100;
      const innerStop = hardnessNormalized * 0.9; // Where full opacity ends

      gradient.addColorStop(0, 'rgba(255, 0, 0, 0.5)');
      gradient.addColorStop(innerStop, 'rgba(255, 0, 0, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

      return gradient;
    },
    [brushSize, brushHardness]
  );

  const draw = useCallback(
    (x: number, y: number) => {
      const canvas = maskCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.globalCompositeOperation =
        brushMode === 'eraser' ? 'destination-out' : 'source-over';

      // Draw line from last position
      if (lastPos) {
        const distance = Math.sqrt(
          Math.pow(x - lastPos.x, 2) + Math.pow(y - lastPos.y, 2)
        );
        const steps = Math.max(1, Math.floor(distance / (brushSize / 4)));

        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const ix = lastPos.x + (x - lastPos.x) * t;
          const iy = lastPos.y + (y - lastPos.y) * t;

          ctx.beginPath();
          ctx.arc(ix, iy, brushSize / 2, 0, Math.PI * 2);

          if (brushHardness < 100 && brushMode !== 'eraser') {
            ctx.fillStyle = createBrushGradient(ctx, ix, iy);
          } else {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
          }
          ctx.fill();
        }
      } else {
        // Single dot
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);

        if (brushHardness < 100 && brushMode !== 'eraser') {
          ctx.fillStyle = createBrushGradient(ctx, x, y);
        } else {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        }
        ctx.fill();
      }

      setLastPos({ x, y });
    },
    [brushMode, brushSize, brushHardness, lastPos, createBrushGradient]
  );

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const pos = getCanvasCoordinates(e);
      if (!pos) return;

      setIsDrawing(true);
      setLastPos(null); // Reset lastPos to draw single dot first
      draw(pos.x, pos.y);
      setLastPos(pos);
    },
    [getCanvasCoordinates, draw]
  );

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;

      const pos = getCanvasCoordinates(e);
      if (!pos) return;

      draw(pos.x, pos.y);
    },
    [isDrawing, getCanvasCoordinates, draw]
  );

  const handleEnd = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      setLastPos(null);

      // Save to history
      saveToHistory();

      // Export mask data
      const canvas = maskCanvasRef.current;
      if (canvas) {
        const maskDataUrl = canvas.toDataURL('image/png');
        onMaskChange(maskDataUrl);
      }
    }
  }, [isDrawing, onMaskChange, saveToHistory]);

  // Clear mask
  const clearMask = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    saveToHistory();
    onMaskChange('');
  }, [width, height, onMaskChange, saveToHistory]);

  // Fill entire canvas
  const fillAll = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    saveToHistory();
    const maskDataUrl = canvas.toDataURL('image/png');
    onMaskChange(maskDataUrl);
  }, [width, height, onMaskChange, saveToHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // Expose methods via ref
  useEffect(() => {
    (window as any).__maskCanvas = {
      clear: clearMask,
      fillAll: fillAll,
      undo: undo,
      redo: redo,
    };
    return () => {
      delete (window as any).__maskCanvas;
    };
  }, [clearMask, fillAll, undo, redo]);

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center bg-black/5 rounded-lg overflow-hidden"
      style={{ minHeight: '400px' }}
    >
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">
            이미지 로딩 중...
          </div>
        </div>
      )}

      <div
        className="relative"
        style={{ width: scaledWidth, height: scaledHeight }}
      >
        {/* Image layer */}
        <canvas
          ref={imageCanvasRef}
          width={width}
          height={height}
          className="absolute inset-0"
          style={{
            width: scaledWidth,
            height: scaledHeight,
          }}
        />

        {/* Mask layer */}
        <canvas
          ref={maskCanvasRef}
          width={width}
          height={height}
          className="absolute inset-0 cursor-crosshair"
          style={{
            width: scaledWidth,
            height: scaledHeight,
          }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      </div>
    </div>
  );
}
