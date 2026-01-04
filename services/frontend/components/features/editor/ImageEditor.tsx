'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Loader2, Wand2, ArrowLeft, Clock, Cpu, Download } from 'lucide-react';
import { MaskCanvas } from './MaskCanvas';
import { BrushToolbar } from './BrushToolbar';
import {
  inpaintImage,
  getInpaintTaskStatus,
  type GalleryImage,
  type GeneratedImage,
} from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

interface ImageEditorProps {
  image: GalleryImage;
}

export function ImageEditor({ image }: ImageEditorProps) {
  const [maskData, setMaskData] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [strength, setStrength] = useState(0.85);
  const [brushSize, setBrushSize] = useState(30);
  const [brushMode, setBrushMode] = useState<'brush' | 'eraser'>('brush');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultImages, setResultImages] = useState<GeneratedImage[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Canvas Area */}
        <div className="lg:col-span-3 space-y-4">
          <MaskCanvas
            imageUrl={image.url}
            width={image.width}
            height={image.height}
            brushSize={brushSize}
            brushMode={brushMode}
            onMaskChange={setMaskData}
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

          {/* Progress */}
          {isProcessing && taskStatus && (
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Cpu className="w-6 h-6 text-primary animate-pulse" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">이미지 편집 중</h3>
                  <p className="text-sm text-muted-foreground">
                    {taskStatus.progress_message || '처리 중...'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">진행률</span>
                  <span className="font-medium">{taskStatus.progress || 0}%</span>
                </div>
                <Progress value={taskStatus.progress || 0} className="h-2" />
              </div>

              {taskStatus.elapsed_seconds && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>경과 시간: {Math.floor(taskStatus.elapsed_seconds)}초</span>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {resultImages.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">편집 결과</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    원본
                  </p>
                  <div className="relative rounded-lg overflow-hidden border">
                    <img
                      src={image.url}
                      alt="Original"
                      className="w-full h-auto"
                    />
                  </div>
                </div>

                {/* Result */}
                {resultImages.map((result, index) => (
                  <div key={result.id} className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      편집됨
                    </p>
                    <div className="relative rounded-lg overflow-hidden border group">
                      <img
                        src={result.url}
                        alt={`Edited ${index + 1}`}
                        className="w-full h-auto"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDownload(result.url, index)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          다운로드
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="lg:col-span-1">
          <BrushToolbar
            brushSize={brushSize}
            brushMode={brushMode}
            onBrushSizeChange={setBrushSize}
            onBrushModeChange={setBrushMode}
            onClear={handleClearMask}
            onFillAll={handleFillAll}
          />

          {/* Original Image Info */}
          <div className="mt-4 p-4 bg-card rounded-lg border">
            <h3 className="text-sm font-medium mb-2">원본 이미지 정보</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>크기: {image.width} x {image.height}</p>
              <p className="truncate">프롬프트: {image.prompt}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
