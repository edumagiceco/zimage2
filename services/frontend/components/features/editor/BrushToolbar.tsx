'use client';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Paintbrush, Eraser, Trash2, Square } from 'lucide-react';

interface BrushToolbarProps {
  brushSize: number;
  brushMode: 'brush' | 'eraser';
  onBrushSizeChange: (size: number) => void;
  onBrushModeChange: (mode: 'brush' | 'eraser') => void;
  onClear: () => void;
  onFillAll: () => void;
}

export function BrushToolbar({
  brushSize,
  brushMode,
  onBrushSizeChange,
  onBrushModeChange,
  onClear,
  onFillAll,
}: BrushToolbarProps) {
  return (
    <div className="flex flex-col gap-4 p-4 bg-card rounded-lg border">
      <div className="space-y-2">
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

      <div className="text-xs text-muted-foreground mt-2">
        <p>빨간색으로 표시된 영역이 수정됩니다.</p>
        <p>브러시로 수정할 영역을 칠하세요.</p>
      </div>
    </div>
  );
}
