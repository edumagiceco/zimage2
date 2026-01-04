'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, Image as ImageIcon, Layers } from 'lucide-react';
import { getTemplates, getTemplateCategories, type Template } from '@/lib/api';
import { toast } from 'sonner';

const CATEGORY_NAMES: Record<string, string> = {
  all: '전체',
  social: '소셜 미디어',
  ecommerce: '이커머스',
  advertising: '광고',
  branding: '브랜딩',
  email: '이메일 마케팅',
};

export default function TemplatesPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['template-categories'],
    queryFn: getTemplateCategories,
  });

  // Fetch templates
  const { data, isLoading, error } = useQuery({
    queryKey: ['templates', selectedCategory],
    queryFn: () => getTemplates(selectedCategory === 'all' ? undefined : selectedCategory),
  });

  const handleSelectTemplate = (template: Template) => {
    // Store template in sessionStorage and navigate to home
    sessionStorage.setItem('selectedTemplate', JSON.stringify(template));
    toast.success(`"${template.name}" 템플릿이 선택되었습니다.`);
    router.push('/');
  };

  const formatSize = (width: number, height: number) => {
    return `${width} x ${height}`;
  };

  const getAspectRatioClass = (width: number, height: number) => {
    const ratio = width / height;
    if (ratio > 1.5) return 'aspect-[16/9]';
    if (ratio < 0.7) return 'aspect-[9/16]';
    if (ratio > 1.2) return 'aspect-[4/3]';
    if (ratio < 0.85) return 'aspect-[3/4]';
    return 'aspect-square';
  };

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Layers className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">마케팅 템플릿</h1>
        </div>
        <p className="text-muted-foreground">
          다양한 마케팅 목적에 맞는 템플릿을 선택하여 빠르게 이미지를 생성하세요.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8">
        <div className="w-[200px]">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="카테고리 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {categoriesData?.categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-20">
          <p className="text-destructive">템플릿을 불러오는데 실패했습니다.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            다시 시도
          </Button>
        </div>
      )}

      {/* Templates Grid */}
      {data && data.templates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data.templates.map((template) => (
            <div
              key={template.id}
              className="group relative rounded-xl border bg-card overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-primary/50"
            >
              {/* Thumbnail Placeholder */}
              <div
                className={`relative bg-gradient-to-br from-primary/10 to-primary/5 ${getAspectRatioClass(template.width, template.height)} max-h-[200px] flex items-center justify-center`}
              >
                <div className="text-center p-4">
                  <ImageIcon className="h-12 w-12 text-primary/30 mx-auto mb-2" />
                  <span className="text-sm text-muted-foreground">
                    {formatSize(template.width, template.height)}
                  </span>
                </div>

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    onClick={() => handleSelectTemplate(template)}
                    className="transform scale-90 group-hover:scale-100 transition-transform"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    이 템플릿 사용
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-lg leading-tight">
                    {template.name}
                  </h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary whitespace-nowrap">
                    {CATEGORY_NAMES[template.category] || template.category}
                  </span>
                </div>

                {template.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {template.description}
                  </p>
                )}

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">프롬프트:</span>
                    <p className="mt-1 line-clamp-2 italic">{template.prompt}</p>
                  </div>
                </div>

                {/* Action Button (mobile) */}
                <Button
                  className="w-full mt-4 lg:hidden"
                  onClick={() => handleSelectTemplate(template)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  이 템플릿 사용
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {data && data.templates.length === 0 && (
        <div className="text-center py-20">
          <Layers className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">템플릿이 없습니다</h3>
          <p className="text-muted-foreground">
            선택한 카테고리에 템플릿이 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}
