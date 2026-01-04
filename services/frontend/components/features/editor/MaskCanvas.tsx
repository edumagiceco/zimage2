'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

export type ToolMode = 'brush' | 'eraser' | 'rectangle' | 'lasso';

interface MaskCanvasProps {
  imageUrl: string;
  width: number;
  height: number;
  brushSize: number;
  brushHardness: number;
  toolMode: ToolMode;
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
  toolMode,
  onMaskChange,
  onHistoryChange,
}: MaskCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);
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

    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(imageData);

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
      imageCtx.clearRect(0, 0, width, height);
      imageCtx.drawImage(img, 0, 0, width, height);

      maskCtx.clearRect(0, 0, width, height);

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

      const hardnessNormalized = brushHardness / 100;
      const innerStop = hardnessNormalized * 0.9;

      gradient.addColorStop(0, 'rgba(255, 0, 0, 0.5)');
      gradient.addColorStop(innerStop, 'rgba(255, 0, 0, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');

      return gradient;
    },
    [brushSize, brushHardness]
  );

  // Draw brush stroke
  const drawBrush = useCallback(
    (x: number, y: number) => {
      const canvas = maskCanvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.globalCompositeOperation =
        toolMode === 'eraser' ? 'destination-out' : 'source-over';

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

          if (brushHardness < 100 && toolMode !== 'eraser') {
            ctx.fillStyle = createBrushGradient(ctx, ix, iy);
          } else {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
          }
          ctx.fill();
        }
      } else {
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);

        if (brushHardness < 100 && toolMode !== 'eraser') {
          ctx.fillStyle = createBrushGradient(ctx, x, y);
        } else {
          ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        }
        ctx.fill();
      }

      setLastPos({ x, y });
    },
    [toolMode, brushSize, brushHardness, lastPos, createBrushGradient]
  );

  // Draw rectangle preview
  const drawRectPreview = useCallback(
    (currentPos: { x: number; y: number }) => {
      const previewCanvas = previewCanvasRef.current;
      if (!previewCanvas || !startPos) return;

      const ctx = previewCanvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      const rectX = Math.min(startPos.x, currentPos.x);
      const rectY = Math.min(startPos.y, currentPos.y);
      const rectWidth = Math.abs(currentPos.x - startPos.x);
      const rectHeight = Math.abs(currentPos.y - startPos.y);

      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
      ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
    },
    [startPos, width, height]
  );

  // Draw lasso preview
  const drawLassoPreview = useCallback(
    (points: { x: number; y: number }[]) => {
      const previewCanvas = previewCanvasRef.current;
      if (!previewCanvas || points.length < 2) return;

      const ctx = previewCanvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();

      // Draw fill preview
      if (points.length > 2) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.closePath();
        ctx.fill();
      }
    },
    [width, height]
  );

  // Apply rectangle to mask
  const applyRectangle = useCallback(
    (endPos: { x: number; y: number }) => {
      const canvas = maskCanvasRef.current;
      if (!canvas || !startPos) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rectX = Math.min(startPos.x, endPos.x);
      const rectY = Math.min(startPos.y, endPos.y);
      const rectWidth = Math.abs(endPos.x - startPos.x);
      const rectHeight = Math.abs(endPos.y - startPos.y);

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

      // Clear preview
      const previewCanvas = previewCanvasRef.current;
      if (previewCanvas) {
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx?.clearRect(0, 0, width, height);
      }

      saveToHistory();
      const maskDataUrl = canvas.toDataURL('image/png');
      onMaskChange(maskDataUrl);
    },
    [startPos, width, height, saveToHistory, onMaskChange]
  );

  // Apply lasso to mask
  const applyLasso = useCallback(
    (points: { x: number; y: number }[]) => {
      const canvas = maskCanvasRef.current;
      if (!canvas || points.length < 3) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fill();

      // Clear preview
      const previewCanvas = previewCanvasRef.current;
      if (previewCanvas) {
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx?.clearRect(0, 0, width, height);
      }

      saveToHistory();
      const maskDataUrl = canvas.toDataURL('image/png');
      onMaskChange(maskDataUrl);
    },
    [width, height, saveToHistory, onMaskChange]
  );

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const pos = getCanvasCoordinates(e);
      if (!pos) return;

      setIsDrawing(true);

      if (toolMode === 'brush' || toolMode === 'eraser') {
        setLastPos(null);
        drawBrush(pos.x, pos.y);
        setLastPos(pos);
      } else if (toolMode === 'rectangle') {
        setStartPos(pos);
      } else if (toolMode === 'lasso') {
        setLassoPoints([pos]);
      }
    },
    [getCanvasCoordinates, toolMode, drawBrush]
  );

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;

      const pos = getCanvasCoordinates(e);
      if (!pos) return;

      if (toolMode === 'brush' || toolMode === 'eraser') {
        drawBrush(pos.x, pos.y);
      } else if (toolMode === 'rectangle') {
        drawRectPreview(pos);
      } else if (toolMode === 'lasso') {
        const newPoints = [...lassoPoints, pos];
        setLassoPoints(newPoints);
        drawLassoPreview(newPoints);
      }
    },
    [isDrawing, getCanvasCoordinates, toolMode, drawBrush, drawRectPreview, lassoPoints, drawLassoPreview]
  );

  const handleEnd = useCallback(
    (e?: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;

      if (toolMode === 'brush' || toolMode === 'eraser') {
        setIsDrawing(false);
        setLastPos(null);
        saveToHistory();

        const canvas = maskCanvasRef.current;
        if (canvas) {
          const maskDataUrl = canvas.toDataURL('image/png');
          onMaskChange(maskDataUrl);
        }
      } else if (toolMode === 'rectangle') {
        if (e) {
          const pos = getCanvasCoordinates(e);
          if (pos && startPos) {
            applyRectangle(pos);
          }
        }
        setIsDrawing(false);
        setStartPos(null);
      } else if (toolMode === 'lasso') {
        if (lassoPoints.length >= 3) {
          applyLasso(lassoPoints);
        }
        setIsDrawing(false);
        setLassoPoints([]);
      }
    },
    [isDrawing, toolMode, saveToHistory, onMaskChange, getCanvasCoordinates, startPos, applyRectangle, lassoPoints, applyLasso]
  );

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

  // Invert mask
  const invertMask = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Check if pixel has any mask (alpha > 0)
      if (data[i + 3] > 0) {
        // Clear this pixel
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        // Fill this pixel
        data[i] = 255;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 128;
      }
    }

    ctx.putImageData(imageData, 0, 0);
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
      // Escape to cancel current operation
      if (e.key === 'Escape' && isDrawing) {
        setIsDrawing(false);
        setStartPos(null);
        setLassoPoints([]);
        const previewCanvas = previewCanvasRef.current;
        if (previewCanvas) {
          const ctx = previewCanvas.getContext('2d');
          ctx?.clearRect(0, 0, width, height);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, isDrawing, width, height]);

  // Expose methods via ref
  useEffect(() => {
    (window as any).__maskCanvas = {
      clear: clearMask,
      fillAll: fillAll,
      undo: undo,
      redo: redo,
      invert: invertMask,
    };
    return () => {
      delete (window as any).__maskCanvas;
    };
  }, [clearMask, fillAll, undo, redo, invertMask]);

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  // Cursor based on tool
  const getCursor = () => {
    switch (toolMode) {
      case 'rectangle':
        return 'crosshair';
      case 'lasso':
        return 'crosshair';
      default:
        return 'crosshair';
    }
  };

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
          className="absolute inset-0"
          style={{
            width: scaledWidth,
            height: scaledHeight,
          }}
        />

        {/* Preview layer for rectangle/lasso */}
        <canvas
          ref={previewCanvasRef}
          width={width}
          height={height}
          className="absolute inset-0"
          style={{
            width: scaledWidth,
            height: scaledHeight,
            cursor: getCursor(),
          }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={() => {
            if (toolMode === 'brush' || toolMode === 'eraser') {
              handleEnd();
            }
          }}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      </div>
    </div>
  );
}
