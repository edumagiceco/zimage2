'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  Wand2,
  ArrowLeft,
  Clock,
  Cpu,
  Download,
  Sparkles,
  CheckCircle2,
  XCircle,
  Timer,
} from 'lucide-react';
import { MaskCanvas, type ToolMode } from './MaskCanvas';
import { BrushToolbar } from './BrushToolbar';
import { ResultComparison } from './ResultComparison';
import { EditHistoryPanel } from './EditHistoryPanel';
import {
  inpaintImage,
  getInpaintTaskStatus,
  type GalleryImage,
  type GeneratedImage,
} from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ImageEditorProps {
  image: GalleryImage;
}

export function ImageEditor({ image }: ImageEditorProps) {
  const [maskData, setMaskData] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [strength, setStrength] = useState(0.85);
  const [brushSize, setBrushSize] = useState(30);
  const [brushHardness, setBrushHardness] = useState(80);
  const [toolMode, setToolMode] = useState<ToolMode>('brush');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultImages, setResultImages] = useState<GeneratedImage[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // Inpaint mutation
  const inpaintMutation = useMutation({
    mutationFn: inpaintImage,
    onSuccess: (data) => {
      setTaskId(data.task_id);
      toast.info('이미지 편집을 시작합니다...');
    },
    onError: (error: any) => {
      const message =
        error.response?.data?.detail || '이미지 편집에 실패했습니다.';
      toast.error(message);
    },
  });

  // Poll task status
  const { data: taskStatus } = useQuery({
    queryKey: ['inpaint-task', taskId],
    queryFn: () => getInpaintTaskStatus(taskId!),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 1000;
    },
  });

  // Handle task completion
  useEffect(() => {
    if (taskStatus?.status === 'completed' && taskStatus.images) {
      setResultImages(taskStatus.images);
      setTaskId(null);
      setShowComparison(true);
      toast.success('이미지 편집이 완료되었습니다!');
    } else if (taskStatus?.status === 'failed') {
      setTaskId(null);
      toast.error(taskStatus.error || '이미지 편집에 실패했습니다.');
    }
  }, [taskStatus]);

  const handleInpaint = () => {
    if (!maskData) {
      toast.error('수정할 영역을 선택해주세요.');
      return;
    }
    if (!prompt.trim()) {
      toast.error('수정 내용을 입력해주세요.');
      return;
    }

    inpaintMutation.mutate({
      original_image_id: image.id,
      mask_data: maskData,
      prompt: prompt,
      negative_prompt: negativePrompt || 'blurry, low quality, distorted',
      strength: strength,
    });
  };

  const handleHistoryChange = (undo: boolean, redo: boolean) => {
    setCanUndo(undo);
    setCanRedo(redo);
  };

  const handleClearMask = () => {
    if ((window as any).__maskCanvas) {
      (window as any).__maskCanvas.clear();
    }
  };

  const handleFillAll = () => {
    if ((window as any).__maskCanvas) {
      (window as any).__maskCanvas.fillAll();
    }
  };

  const handleUndo = () => {
    if ((window as any).__maskCanvas) {
      (window as any).__maskCanvas.undo();
    }
  };

  const handleRedo = () => {
    if ((window as any).__maskCanvas) {
      (window as any).__maskCanvas.redo();
    }
  };

  const handleInvert = () => {
    if ((window as any).__maskCanvas) {
      (window as any).__maskCanvas.invert();
    }
  };

  const handleGrow = (radius: number) => {
    if ((window as any).__maskCanvas) {
      (window as any).__maskCanvas.grow(radius);
    }
  };

  const handleShrink = (radius: number) => {
    if ((window as any).__maskCanvas) {
      (window as any).__maskCanvas.shrink(radius);
    }
  };

  const handleFeather = (radius: number) => {
    if ((window as any).__maskCanvas) {
      (window as any).__maskCanvas.feather(radius);
    }
  };

  const handleDownload = (imageUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `edited-image-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isProcessing =
    inpaintMutation.isPending ||
    (taskStatus && !['completed', 'failed'].includes(taskStatus.status));

  // Progress steps
  const progressSteps = [
    { key: 'pending', label: '대기', icon: Timer },
    { key: 'processing', label: '처리', icon: Cpu },
    { key: 'completed', label: '완료', icon: CheckCircle2 },
  ];

  const currentStepIndex = taskStatus
    ? progressSteps.findIndex((s) => s.key === taskStatus.status)
    : -1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/gallery">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            갤러리로 돌아가기
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">이미지 편집</h1>
      </div>

      {/* Show comparison view or editor */}
      {showComparison && resultImages.length > 0 ? (
        <div className="space-y-6">
          <ResultComparison
            originalUrl={image.url}
            editedUrl={resultImages[0].url}
            width={image.width}
            height={image.height}
            onDownload={() => handleDownload(resultImages[0].url, 0)}
          />

          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowComparison(false);
                setResultImages([]);
              }}
            >
              다시 편집하기
            </Button>
            <Link href="/gallery">
              <Button>갤러리로 이동</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Canvas Area */}
          <div className="lg:col-span-3 space-y-4">
            <MaskCanvas
              imageUrl={image.url}
              width={image.width}
              height={image.height}
              brushSize={brushSize}
              brushHardness={brushHardness}
              toolMode={toolMode}
              onMaskChange={setMaskData}
              onHistoryChange={handleHistoryChange}
            />

            {/* Prompt Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                수정할 내용을 설명해주세요
              </label>
              <Textarea
                placeholder="예: 파란색 셔츠를 빨간색으로 변경, 배경을 해변으로 변경..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[80px] resize-none"
                disabled={isProcessing}
              />
            </div>

            {/* Advanced Options */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-muted-foreground"
            >
              {showAdvanced ? '고급 설정 숨기기' : '고급 설정 보기'}
            </Button>

            {showAdvanced && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <label className="text-sm font-medium">네거티브 프롬프트</label>
                  <Textarea
                    placeholder="제외할 요소..."
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    className="min-h-[60px] resize-none"
                    disabled={isProcessing}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">수정 강도</label>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(strength * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[strength]}
                    onValueChange={(value) => setStrength(value[0])}
                    min={0.5}
                    max={1}
                    step={0.05}
                    disabled={isProcessing}
                  />
                  <p className="text-xs text-muted-foreground">
                    높을수록 더 많이 변경됩니다
                  </p>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <Button
              onClick={handleInpaint}
              disabled={!maskData || !prompt.trim() || isProcessing}
              className="w-full h-12 text-lg"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  이미지 편집 중...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-5 w-5" />
                  이미지 수정하기
                </>
              )}
            </Button>

            {/* Enhanced Progress */}
            {isProcessing && taskStatus && (
              <div className="rounded-xl border bg-card p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-7 h-7 text-primary animate-pulse" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">AI 이미지 편집 중</h3>
                    <p className="text-sm text-muted-foreground">
                      {taskStatus.progress_message || '처리 중...'}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">진행률</span>
                    <span className="font-medium">{taskStatus.progress || 0}%</span>
                  </div>
                  <Progress value={taskStatus.progress || 0} className="h-3" />
                </div>

                {/* Steps */}
                <div className="flex justify-between">
                  {progressSteps.map((step, index) => {
                    const StepIcon = step.icon;
                    const isActive = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;

                    return (
                      <div
                        key={step.key}
                        className={cn(
                          'flex flex-col items-center gap-2',
                          isActive ? 'text-primary' : 'text-muted-foreground'
                        )}
                      >
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                            isCurrent
                              ? 'bg-primary text-primary-foreground scale-110'
                              : isActive
                              ? 'bg-primary/20'
                              : 'bg-muted'
                          )}
                        >
                          <StepIcon className={cn('w-5 h-5', isCurrent && 'animate-pulse')} />
                        </div>
                        <span className="text-xs font-medium">{step.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Time Info */}
                <div className="flex items-center justify-between text-sm pt-4 border-t">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>경과: {Math.floor(taskStatus.elapsed_seconds || 0)}초</span>
                  </div>
                  {taskStatus.estimated_seconds && (
                    <div className="text-muted-foreground">
                      예상: ~{Math.ceil(taskStatus.estimated_seconds)}초
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="lg:col-span-1 space-y-4">
            <BrushToolbar
              brushSize={brushSize}
              brushHardness={brushHardness}
              toolMode={toolMode}
              canUndo={canUndo}
              canRedo={canRedo}
              onBrushSizeChange={setBrushSize}
              onBrushHardnessChange={setBrushHardness}
              onToolModeChange={setToolMode}
              onClear={handleClearMask}
              onFillAll={handleFillAll}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onInvert={handleInvert}
              onGrow={handleGrow}
              onShrink={handleShrink}
              onFeather={handleFeather}
            />

            {/* Original Image Info */}
            <div className="p-4 bg-card rounded-lg border">
              <h3 className="text-sm font-medium mb-2">원본 이미지 정보</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>크기: {image.width} x {image.height}</p>
                <p className="truncate" title={image.prompt}>
                  프롬프트: {image.prompt}
                </p>
              </div>
            </div>

            {/* Edit History */}
            <div className="p-4 bg-card rounded-lg border">
              <EditHistoryPanel imageId={image.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
