'use client';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Paintbrush,
  Eraser,
  Trash2,
  Square,
  Undo2,
  Redo2,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrushToolbarProps {
  brushSize: number;
  brushHardness: number;
  brushMode: 'brush' | 'eraser';
  canUndo: boolean;
  canRedo: boolean;
  onBrushSizeChange: (size: number) => void;
  onBrushHardnessChange: (hardness: number) => void;
  onBrushModeChange: (mode: 'brush' | 'eraser') => void;
  onClear: () => void;
  onFillAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function BrushToolbar({
  brushSize,
  brushHardness,
  brushMode,
  canUndo,
  canRedo,
  onBrushSizeChange,
  onBrushHardnessChange,
  onBrushModeChange,
  onClear,
  onFillAll,
  onUndo,
  onRedo,
}: BrushToolbarProps) {
  return (
    <div className="flex flex-col gap-4 p-4 bg-card rounded-lg border">
      {/* Undo/Redo */}
      <div className="space-y-2">
        <label className="text-sm font-medium">실행 취소</label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onUndo}
            disabled={!canUndo}
            className="flex-1"
            title="실행 취소 (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4 mr-2" />
            취소
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRedo}
            disabled={!canRedo}
            className="flex-1"
            title="다시 실행 (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-4 w-4 mr-2" />
            재실행
          </Button>
        </div>
      </div>

      <div className="border-t pt-4 space-y-2">
        <label className="text-sm font-medium">도구</label>
        <div className="flex gap-2">
          <Button
            variant={brushMode === 'brush' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onBrushModeChange('brush')}
            className="flex-1"
          >
            <Paintbrush className="h-4 w-4 mr-2" />
            브러시
          </Button>
          <Button
            variant={brushMode === 'eraser' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onBrushModeChange('eraser')}
            className="flex-1"
          >
            <Eraser className="h-4 w-4 mr-2" />
            지우개
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">브러시 크기</label>
          <span className="text-sm text-muted-foreground">{brushSize}px</span>
        </div>
        <Slider
          value={[brushSize]}
          onValueChange={(value) => onBrushSizeChange(value[0])}
          min={10}
          max={100}
          step={5}
        />
        {/* Brush size preview */}
        <div className="flex items-center justify-center h-12 bg-muted/50 rounded">
          <div
            className="rounded-full bg-red-500/50 border border-red-500"
            style={{
              width: Math.min(brushSize, 48),
              height: Math.min(brushSize, 48),
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">브러시 경도</label>
          <span className="text-sm text-muted-foreground">
            {brushHardness === 100 ? '딱딱함' : brushHardness === 0 ? '부드러움' : `${brushHardness}%`}
          </span>
        </div>
        <Slider
          value={[brushHardness]}
          onValueChange={(value) => onBrushHardnessChange(value[0])}
          min={0}
          max={100}
          step={10}
        />
        {/* Hardness preview */}
        <div className="flex items-center justify-center gap-4 h-8">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Circle className="h-4 w-4 opacity-30" />
            부드러움
          </div>
          <div className="flex-1 h-2 bg-gradient-to-r from-red-500/20 to-red-500/80 rounded" />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            딱딱함
            <Circle className="h-4 w-4 fill-current" />
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t">
        <label className="text-sm font-medium">빠른 작업</label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onFillAll}
            className="flex-1"
          >
            <Square className="h-4 w-4 mr-2" />
            전체 선택
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            className="flex-1"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            초기화
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mt-2 space-y-1">
        <p>빨간색으로 표시된 영역이 수정됩니다.</p>
        <p>브러시로 수정할 영역을 칠하세요.</p>
        <p className="text-muted-foreground/70">
          단축키: Ctrl+Z (취소), Ctrl+Shift+Z (재실행)
        </p>
      </div>
    </div>
  );
}
