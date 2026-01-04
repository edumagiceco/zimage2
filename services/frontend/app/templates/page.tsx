'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, Layers, ArrowRight } from 'lucide-react';
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

const CATEGORY_COLORS: Record<string, string> = {
  social: 'from-pink-500 to-rose-500',
  ecommerce: 'from-blue-500 to-cyan-500',
  advertising: 'from-orange-500 to-amber-500',
  branding: 'from-purple-500 to-violet-500',
  email: 'from-green-500 to-emerald-500',
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
    sessionStorage.setItem('selectedTemplate', JSON.stringify(template));
    toast.success(`"${template.name}" 템플릿이 선택되었습니다.`);
    router.push('/');
  };

  const formatSize = (width: number, height: number) => {
    return `${width} x ${height}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/50 to-background dark:from-violet-950/20">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm font-medium mb-4">
            <Layers className="w-4 h-4" />
            {data?.total || 0}개의 템플릿
          </div>
          <h1 className="text-4xl font-bold mb-4">마케팅 템플릿</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            다양한 마케팅 목적에 맞는 템플릿을 선택하여 빠르게 이미지를 생성하세요.
            <br />
            클릭 한 번으로 최적화된 프롬프트와 크기가 자동 적용됩니다.
          </p>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
            className={selectedCategory === 'all' ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600' : ''}
          >
            전체
          </Button>
          {categoriesData?.categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className={selectedCategory === cat.id ? `bg-gradient-to-r ${CATEGORY_COLORS[cat.id] || 'from-violet-600 to-fuchsia-600'}` : ''}
            >
              {cat.name}
            </Button>
          ))}
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
                className="group relative rounded-2xl bg-card border overflow-hidden hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 cursor-pointer"
                onClick={() => handleSelectTemplate(template)}
              >
                {/* Thumbnail Image */}
                <div className="relative aspect-[4/3] overflow-hidden">
                  {template.thumbnail ? (
                    <img
                      src={template.thumbnail}
                      alt={template.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${CATEGORY_COLORS[template.category] || 'from-violet-500 to-fuchsia-500'} opacity-20 flex items-center justify-center`}>
                      <span className="text-6xl">{template.icon || '🎨'}</span>
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Icon Badge */}
                  {template.icon && (
                    <div className="absolute top-3 left-3 w-10 h-10 rounded-xl bg-white/90 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center text-xl shadow-lg">
                      {template.icon}
                    </div>
                  )}

                  {/* Size Badge */}
                  <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
                    {formatSize(template.width, template.height)}
                  </div>

                  {/* Bottom Content on Image */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r ${CATEGORY_COLORS[template.category] || 'from-violet-500 to-fuchsia-500'} text-white`}>
                        {CATEGORY_NAMES[template.category] || template.category}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-white leading-tight">
                      {template.name}
                    </h3>
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-primary/90 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center p-6">
                    <Sparkles className="h-8 w-8 text-white mb-3" />
                    <span className="text-white font-semibold text-lg mb-2">이 템플릿 사용하기</span>
                    <p className="text-white/80 text-sm text-center line-clamp-3 mb-4">
                      {template.description}
                    </p>
                    <Button variant="secondary" size="sm" className="gap-2">
                      시작하기 <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  {template.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {template.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        바로 사용 가능
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
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
    </div>
  );
}
