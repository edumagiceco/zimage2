'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface MaskCanvasProps {
  imageUrl: string;
  width: number;
  height: number;
  brushSize: number;
  brushMode: 'brush' | 'eraser';
  onMaskChange: (maskDataUrl: string) => void;
}

export function MaskCanvas({
  imageUrl,
  width,
  height,
  brushSize,
  brushMode,
  onMaskChange,
}: MaskCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(false);

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

      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl, width, height]);

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

  const draw = useCallback(
    (x: number, y: number) => {
      const canvas = maskCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.globalCompositeOperation =
        brushMode === 'eraser' ? 'destination-out' : 'source-over';

      ctx.beginPath();

      if (lastPos) {
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // Draw circle at current position
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fill();

      setLastPos({ x, y });
    },
    [brushMode, brushSize, lastPos]
  );

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const pos = getCanvasCoordinates(e);
      if (!pos) return;

      setIsDrawing(true);
      setLastPos(pos);
      draw(pos.x, pos.y);
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

      // Export mask data
      const canvas = maskCanvasRef.current;
      if (canvas) {
        const maskDataUrl = canvas.toDataURL('image/png');
        onMaskChange(maskDataUrl);
      }
    }
  }, [isDrawing, onMaskChange]);

  // Clear mask
  const clearMask = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    onMaskChange('');
  }, [width, height, onMaskChange]);

  // Fill entire canvas
  const fillAll = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    const maskDataUrl = canvas.toDataURL('image/png');
    onMaskChange(maskDataUrl);
  }, [width, height, onMaskChange]);

  // Expose methods via ref
  useEffect(() => {
    // Attach methods to window for external access (temporary solution)
    (window as any).__maskCanvas = {
      clear: clearMask,
      fillAll: fillAll,
    };
    return () => {
      delete (window as any).__maskCanvas;
    };
  }, [clearMask, fillAll]);

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
