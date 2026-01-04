'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Wand2,
  Eraser,
  Palette,
  ImageIcon,
  MousePointer2,
  Square,
  Sparkles,
  Check,
} from 'lucide-react';
import {
  segmentByPoint,
  segmentAuto,
  getSAMTaskStatus,
  removeBackground,
  replaceBackgroundColor,
  getForegroundMask,
  getBackgroundTaskStatus,
  applyStyle,
  getStylePresets,
  getStyleTaskStatus,
  type StylePreset,
} from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AdvancedToolsPanelProps {
  imageId: string;
  onMaskGenerated?: (maskBase64: string) => void;
  onImageGenerated?: (imageUrl: string) => void;
}

type ActiveTab = 'sam' | 'background' | 'style';
type SAMMode = 'point' | 'auto';

// Preset colors for background replacement
const PRESET_COLORS = [
  { name: '흰색', color: [255, 255, 255] },
  { name: '검정', color: [0, 0, 0] },
  { name: '빨강', color: [255, 0, 0] },
  { name: '초록', color: [0, 255, 0] },
  { name: '파랑', color: [0, 0, 255] },
  { name: '노랑', color: [255, 255, 0] },
  { name: '보라', color: [128, 0, 128] },
  { name: '주황', color: [255, 165, 0] },
];

export function AdvancedToolsPanel({
  imageId,
  onMaskGenerated,
  onImageGenerated,
}: AdvancedToolsPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sam');
  const [samMode, setSamMode] = useState<SAMMode>('point');
  const [selectedColor, setSelectedColor] = useState<number[]>([255, 255, 255]);
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [styleStrength, setStyleStrength] = useState<number>(0.7);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch style presets
  const { data: stylePresetsData } = useQuery({
    queryKey: ['style-presets'],
    queryFn: getStylePresets,
  });

  // Poll for task completion
  const pollTask = async (
    taskId: string,
    getStatus: (id: string) => Promise<any>,
    onComplete: (result: any) => void
  ) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      try {
        const status = await getStatus(taskId);
        if (status.status === 'completed') {
          setIsProcessing(false);
          onComplete(status);
          return;
        } else if (status.status === 'failed') {
          setIsProcessing(false);
          toast.error(status.error || '작업에 실패했습니다.');
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        } else {
          setIsProcessing(false);
          toast.error('작업 시간이 초과되었습니다.');
        }
      } catch (error) {
        setIsProcessing(false);
        toast.error('상태 확인에 실패했습니다.');
      }
    };

    poll();
  };

  // SAM Auto Segmentation
  const handleSAMAutoSegment = async () => {
    setIsProcessing(true);
    toast.info('자동 선택 분석 중...');

    try {
      const response = await segmentAuto(imageId);
      pollTask(response.task_id, getSAMTaskStatus, (result) => {
        if (result.masks && result.masks.length > 0) {
          // Use the first (largest) mask
          onMaskGenerated?.(result.masks[0].base64);
          toast.success(`${result.masks.length}개의 객체를 감지했습니다.`);
        } else if (result.mask_base64) {
          onMaskGenerated?.(result.mask_base64);
          toast.success('마스크가 생성되었습니다.');
        }
      });
    } catch (error) {
      setIsProcessing(false);
      toast.error('자동 선택에 실패했습니다.');
    }
  };

  // Background Removal
  const handleRemoveBackground = async () => {
    setIsProcessing(true);
    toast.info('배경 제거 중...');

    try {
      const response = await removeBackground(imageId);
      pollTask(response.task_id, getBackgroundTaskStatus, (result) => {
        if (result.image?.url) {
          onImageGenerated?.(result.image.url);
          toast.success('배경이 제거되었습니다.');
        }
      });
    } catch (error) {
      setIsProcessing(false);
      toast.error('배경 제거에 실패했습니다.');
    }
  };

  // Get Foreground Mask
  const handleGetForegroundMask = async () => {
    setIsProcessing(true);
    toast.info('전경 마스크 생성 중...');

    try {
      const response = await getForegroundMask(imageId);
      pollTask(response.task_id, getBackgroundTaskStatus, (result) => {
        if (result.mask_base64) {
          onMaskGenerated?.(result.mask_base64);
          toast.success('전경 마스크가 생성되었습니다.');
        }
      });
    } catch (error) {
      setIsProcessing(false);
      toast.error('마스크 생성에 실패했습니다.');
    }
  };

  // Replace Background with Color
  const handleReplaceBackgroundColor = async () => {
    setIsProcessing(true);
    toast.info('배경 교체 중...');

    try {
      const response = await replaceBackgroundColor(imageId, selectedColor);
      pollTask(response.task_id, getBackgroundTaskStatus, (result) => {
        if (result.image?.url) {
          onImageGenerated?.(result.image.url);
          toast.success('배경이 교체되었습니다.');
        }
      });
    } catch (error) {
      setIsProcessing(false);
      toast.error('배경 교체에 실패했습니다.');
    }
  };

  // Apply Style
  const handleApplyStyle = async () => {
    if (!selectedStyle) {
      toast.error('스타일을 선택해주세요.');
      return;
    }

    setIsProcessing(true);
    toast.info('스타일 적용 중...');

    try {
      const response = await applyStyle(imageId, selectedStyle, '', styleStrength);
      pollTask(response.task_id, getStyleTaskStatus, (result) => {
        if (result.image?.url) {
          onImageGenerated?.(result.image.url);
          toast.success('스타일이 적용되었습니다.');
        }
      });
    } catch (error) {
      setIsProcessing(false);
      toast.error('스타일 적용에 실패했습니다.');
    }
  };

  const tabs = [
    { id: 'sam' as ActiveTab, label: 'AI 선택', icon: MousePointer2 },
    { id: 'background' as ActiveTab, label: '배경', icon: Eraser },
    { id: 'style' as ActiveTab, label: '스타일', icon: Palette },
  ];

  return (
    <div className="p-4 bg-card rounded-lg border space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        고급 도구
      </h3>

      {/* Tab Navigation */}
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="flex-1"
            disabled={isProcessing}
          >
            <tab.icon className="h-4 w-4 mr-1" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {/* SAM Tab */}
        {activeTab === 'sam' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              AI가 자동으로 객체를 감지하고 마스크를 생성합니다.
            </p>

            <Button
              onClick={handleSAMAutoSegment}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  분석 중...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  자동 객체 감지
                </>
              )}
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>* 이미지에서 주요 객체를 자동으로 감지합니다</p>
              <p>* 감지된 마스크는 편집에 바로 사용할 수 있습니다</p>
            </div>
          </div>
        )}

        {/* Background Tab */}
        {activeTab === 'background' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">배경 제거</p>
              <div className="flex gap-2">
                <Button
                  onClick={handleRemoveBackground}
                  disabled={isProcessing}
                  variant="outline"
                  className="flex-1"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Eraser className="mr-2 h-4 w-4" />
                      배경 제거
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleGetForegroundMask}
                  disabled={isProcessing}
                  variant="outline"
                  className="flex-1"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Square className="mr-2 h-4 w-4" />
                      마스크 생성
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">배경 색상 교체</p>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => setSelectedColor(preset.color)}
                    className={cn(
                      'w-full aspect-square rounded-lg border-2 transition-all',
                      selectedColor.join(',') === preset.color.join(',')
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-transparent hover:border-muted-foreground/30'
                    )}
                    style={{
                      backgroundColor: `rgb(${preset.color.join(',')})`,
                    }}
                    title={preset.name}
                  />
                ))}
              </div>
              <Button
                onClick={handleReplaceBackgroundColor}
                disabled={isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  '선택한 색상으로 배경 교체'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Style Tab */}
        {activeTab === 'style' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              이미지에 예술적 스타일을 적용합니다.
            </p>

            <ScrollArea className="h-[150px]">
              <div className="grid grid-cols-2 gap-2 pr-4">
                {stylePresetsData?.styles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={cn(
                      'p-2 text-left rounded-lg border transition-all',
                      selectedStyle === style.id
                        ? 'border-primary bg-primary/10'
                        : 'border-muted hover:border-muted-foreground/30'
                    )}
                  >
                    <div className="font-medium text-sm flex items-center gap-1">
                      {selectedStyle === style.id && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                      {style.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {style.description}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">강도</span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(styleStrength * 100)}%
                </span>
              </div>
              <Slider
                value={[styleStrength]}
                onValueChange={(v) => setStyleStrength(v[0])}
                min={0.3}
                max={1}
                step={0.05}
                disabled={isProcessing}
              />
            </div>

            <Button
              onClick={handleApplyStyle}
              disabled={isProcessing || !selectedStyle}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  적용 중...
                </>
              ) : (
                <>
                  <Palette className="mr-2 h-4 w-4" />
                  스타일 적용
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
