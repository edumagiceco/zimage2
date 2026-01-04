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
  RectangleHorizontal,
  Lasso,
  FlipHorizontal2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolMode } from './MaskCanvas';

interface BrushToolbarProps {
  brushSize: number;
  brushHardness: number;
  toolMode: ToolMode;
  canUndo: boolean;
  canRedo: boolean;
  onBrushSizeChange: (size: number) => void;
  onBrushHardnessChange: (hardness: number) => void;
  onToolModeChange: (mode: ToolMode) => void;
  onClear: () => void;
  onFillAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onInvert: () => void;
}

export function BrushToolbar({
  brushSize,
  brushHardness,
  toolMode,
  canUndo,
  canRedo,
  onBrushSizeChange,
  onBrushHardnessChange,
  onToolModeChange,
  onClear,
  onFillAll,
  onUndo,
  onRedo,
  onInvert,
}: BrushToolbarProps) {
  const tools: { mode: ToolMode; icon: typeof Paintbrush; label: string }[] = [
    { mode: 'brush', icon: Paintbrush, label: '브러시' },
    { mode: 'eraser', icon: Eraser, label: '지우개' },
    { mode: 'rectangle', icon: RectangleHorizontal, label: '사각형' },
    { mode: 'lasso', icon: Lasso, label: '올가미' },
  ];

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

      {/* Tools */}
      <div className="border-t pt-4 space-y-2">
        <label className="text-sm font-medium">도구</label>
        <div className="grid grid-cols-2 gap-2">
          {tools.map(({ mode, icon: Icon, label }) => (
            <Button
              key={mode}
              variant={toolMode === mode ? 'default' : 'outline'}
              size="sm"
              onClick={() => onToolModeChange(mode)}
              className="flex-1"
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Brush settings - only show for brush/eraser */}
      {(toolMode === 'brush' || toolMode === 'eraser') && (
        <>
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
        </>
      )}

      {/* Tool-specific hints */}
      {toolMode === 'rectangle' && (
        <div className="p-3 bg-muted/50 rounded text-xs text-muted-foreground">
          <p className="font-medium mb-1">사각형 선택 도구</p>
          <p>드래그하여 사각형 영역을 선택합니다.</p>
          <p>ESC로 선택을 취소할 수 있습니다.</p>
        </div>
      )}

      {toolMode === 'lasso' && (
        <div className="p-3 bg-muted/50 rounded text-xs text-muted-foreground">
          <p className="font-medium mb-1">올가미 선택 도구</p>
          <p>드래그하여 자유 형태로 영역을 선택합니다.</p>
          <p>마우스를 떼면 자동으로 닫힙니다.</p>
        </div>
      )}

      {/* Quick actions */}
      <div className="space-y-2 pt-2 border-t">
        <label className="text-sm font-medium">빠른 작업</label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onFillAll}
          >
            <Square className="h-4 w-4 mr-2" />
            전체 선택
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onInvert}
          >
            <FlipHorizontal2 className="h-4 w-4 mr-2" />
            반전
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            className="col-span-2"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            초기화
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mt-2 space-y-1">
        <p>빨간색으로 표시된 영역이 수정됩니다.</p>
        <p className="text-muted-foreground/70">
          단축키: Ctrl+Z (취소), Ctrl+Shift+Z (재실행), ESC (선택 취소)
        </p>
      </div>
    </div>
  );
}
