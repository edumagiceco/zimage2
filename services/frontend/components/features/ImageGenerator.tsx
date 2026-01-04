'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, Download, Heart, RefreshCw, Clock, Cpu, Languages } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { generateImage, getTaskStatus, type GeneratedImage } from '@/lib/api';
import { ImageGrid } from './ImageGrid';
import { toast } from 'sonner';

interface TemplateData {
  id: number;
  category: string;
  title: string;
  prompt: string;
  thumbnail: string;
  size: string;
  tags: string[];
}

interface ImageGeneratorProps {
  initialTemplate?: TemplateData | null;
}

const SIZE_PRESETS = [
  { label: '1:1 (1024x1024)', value: '1024x1024' },
  { label: '16:9 (1024x576)', value: '1024x576' },
  { label: '9:16 (576x1024)', value: '576x1024' },
  { label: '4:3 (1024x768)', value: '1024x768' },
  { label: '3:4 (768x1024)', value: '768x1024' },
  { label: 'Instagram (1080x1080)', value: '1080x1080' },
  { label: 'Instagram Story (1080x1920)', value: '1080x1920' },
  { label: 'Facebook Cover (816x312)', value: '816x312' },
  { label: 'Twitter Header (1504x504)', value: '1504x504' },
  { label: 'YouTube 썸네일 (1280x720)', value: '1280x720' },
  { label: 'Facebook 광고 (1200x624)', value: '1200x624' },
  { label: '히어로 배너 (1920x600)', value: '1920x600' },
  { label: '패션 룩북 (1024x1536)', value: '1024x1536' },
  { label: '카카오톡 (720x720)', value: '720x720' },
  { label: '앱스토어 (1240x2688)', value: '1240x2688' },
  { label: 'Twitter Header (1500x500)', value: '1500x500' },
];

const STYLE_PRESETS = [
  { label: '선택 안함', value: 'none' },
  { label: '포토리얼리스틱', value: 'photorealistic' },
  { label: '미니멀', value: 'minimal' },
  { label: '일러스트', value: 'illustration' },
  { label: '3D 렌더', value: '3d-render' },
  { label: '플랫 디자인', value: 'flat-design' },
];

// Style preset text lookup - used when generating images
const STYLE_PRESET_TEXT: Record<string, string> = {
  'none': '',
  'photorealistic': 'photorealistic, high quality, 8k, detailed, professional photography',
  'minimal': 'minimal, clean, simple, modern design, white space',
  'illustration': 'illustration, digital art, vibrant colors, artistic',
  '3d-render': '3D render, octane render, studio lighting, realistic materials',
  'flat-design': 'flat design, vector art, simple shapes, bold colors',
};

export function ImageGenerator({ initialTemplate }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [numImages, setNumImages] = useState(2);
  const [stylePreset, setStylePreset] = useState('none');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [translationInfo, setTranslationInfo] = useState<{
    original: string;
    translated: string;
  } | null>(null);

  // Apply template when it changes
  useEffect(() => {
    if (initialTemplate) {
      console.log('Applying template:', initialTemplate);
      setPrompt(initialTemplate.prompt);
      setSize(initialTemplate.size);
      // Reset other states
      setGeneratedImages([]);
      setTaskId(null);
    }
  }, [initialTemplate]);

  // Generate image mutation
  const generateMutation = useMutation({
    mutationFn: generateImage,
    onSuccess: (data) => {
      setTaskId(data.task_id);
      toast.info('이미지 생성을 시작했습니다...');
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      let message = '이미지 생성에 실패했습니다.';

      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Pydantic v2 validation error format
        message = detail.map((e: any) => e.msg || e.message || String(e)).join(', ');
      }

      toast.error(message);
    },
  });

  // Poll task status
  const { data: taskStatus } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTaskStatus(taskId!),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 1000; // Poll every 1 second
    },
  });

  // Handle task completion
  useEffect(() => {
    if (taskStatus?.status === 'completed' && taskStatus.images) {
      setGeneratedImages(taskStatus.images);
      setTaskId(null);

      // Show translation info if prompt was translated
      if (taskStatus.was_translated && taskStatus.original_prompt && taskStatus.translated_prompt) {
        setTranslationInfo({
          original: taskStatus.original_prompt,
          translated: taskStatus.translated_prompt,
        });
        toast.success(`${taskStatus.images.length}개의 이미지가 생성되었습니다! (프롬프트가 영어로 번역됨)`);
      } else {
        setTranslationInfo(null);
        toast.success(`${taskStatus.images.length}개의 이미지가 생성되었습니다!`);
      }
    } else if (taskStatus?.status === 'failed') {
      setTaskId(null);
      toast.error(taskStatus.error || '이미지 생성에 실패했습니다.');
    }
  }, [taskStatus]);

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error('프롬프트를 입력해주세요.');
      return;
    }

    const [width, height] = size.split('x').map(Number);

    // Get style text from lookup table
    const styleText = STYLE_PRESET_TEXT[stylePreset] || '';
    const fullPrompt = styleText ? `${prompt}, ${styleText}` : prompt;

    console.log('Generating with style:', stylePreset, '-> Text:', styleText);
    console.log('Full prompt:', fullPrompt);

    generateMutation.mutate({
      prompt: fullPrompt,
      negative_prompt: negativePrompt || 'blurry, low quality, distorted, ugly',
      width,
      height,
      num_images: numImages,
    });
  };

  const isGenerating =
    generateMutation.isPending ||
    (taskStatus && !['completed', 'failed'].includes(taskStatus.status));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Prompt Input */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">프롬프트</label>
          <Textarea
            placeholder="생성하고 싶은 이미지를 설명해주세요... (예: 현대적인 사무실에서 노트북을 사용하는 비즈니스맨, 밝은 조명, 프로페셔널한 분위기)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[120px] text-base resize-none"
            disabled={isGenerating}
          />
        </div>

        {/* Options Row */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="text-sm font-medium mb-2 block">이미지 크기</label>
            <Select value={size} onValueChange={setSize} disabled={isGenerating}>
              <SelectTrigger>
                <SelectValue placeholder="크기 선택" />
              </SelectTrigger>
              <SelectContent>
                {/* Show custom size from template if not in presets */}
                {size && !SIZE_PRESETS.find(p => p.value === size) && (
                  <SelectItem value={size}>
                    커스텀 ({size})
                  </SelectItem>
                )}
                {SIZE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[120px]">
            <label className="text-sm font-medium mb-2 block">생성 개수</label>
            <Select
              value={String(numImages)}
              onValueChange={(v) => setNumImages(Number(v))}
              disabled={isGenerating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}장
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="text-sm font-medium mb-2 block">스타일 프리셋</label>
            <Select
              value={stylePreset}
              onValueChange={setStylePreset}
              disabled={isGenerating}
            >
              <SelectTrigger>
                <SelectValue placeholder="스타일 선택" />
              </SelectTrigger>
              <SelectContent>
                {STYLE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-muted-foreground"
        >
          {showAdvanced ? '고급 설정 숨기기' : '고급 설정 보기'}
        </Button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <label className="text-sm font-medium">네거티브 프롬프트</label>
            <Textarea
              placeholder="이미지에서 제외할 요소... (예: blurry, low quality, distorted)"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              className="min-h-[80px] resize-none"
              disabled={isGenerating}
            />
          </div>
        )}
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={!prompt.trim() || isGenerating}
        className="w-full h-12 text-lg"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            이미지 생성 중...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            이미지 생성
          </>
        )}
      </Button>

      {/* Progress Status */}
      {isGenerating && (
        <div className="rounded-xl border bg-card p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Cpu className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background animate-pulse" />
            </div>
            <div>
              <h3 className="font-semibold">AI 이미지 생성 중</h3>
              <p className="text-sm text-muted-foreground">
                {taskStatus?.progress_message || '준비 중...'}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">진행률</span>
              <span className="font-medium">{taskStatus?.progress || 0}%</span>
            </div>
            <Progress value={taskStatus?.progress || 0} className="h-2" />
          </div>

          {/* Time Info */}
          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>경과 시간: {Math.floor(taskStatus?.elapsed_seconds || 0)}초</span>
            </div>
            {taskStatus?.estimated_seconds && (
              <div className="text-muted-foreground">
                예상 시간: ~{Math.ceil(taskStatus.estimated_seconds)}초
              </div>
            )}
          </div>

          {/* Generation Steps */}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {[
              { label: '대기', threshold: 0 },
              { label: '초기화', threshold: 10 },
              { label: '생성', threshold: 30 },
              { label: '완료', threshold: 100 },
            ].map((step, i) => {
              const progress = taskStatus?.progress || 0;
              const isActive = progress >= step.threshold;
              const isCurrent =
                progress >= step.threshold &&
                (i === 3 || progress < [10, 30, 100, 100][i + 1]);

              return (
                <div
                  key={step.label}
                  className={`text-center py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? isCurrent
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Generated Images */}
      {generatedImages.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">생성된 이미지</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setGeneratedImages([]);
                setTranslationInfo(null);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              초기화
            </Button>
          </div>

          {/* Translation Info */}
          {translationInfo && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Languages className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-blue-700 dark:text-blue-300">원본 (한글):</span>
                    <p className="text-blue-600 dark:text-blue-400">{translationInfo.original}</p>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700 dark:text-blue-300">번역됨 (영어):</span>
                    <p className="text-blue-600 dark:text-blue-400">{translationInfo.translated}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <ImageGrid images={generatedImages} />
        </div>
      )}
    </div>
  );
}
