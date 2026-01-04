'use client';

import { useState, useEffect } from 'react';
import { ImageGenerator } from '@/components/features/ImageGenerator';
import { Button } from '@/components/ui/button';
import { Sparkles, Zap, Image as ImageIcon, Palette, ShoppingBag, MessageSquare, Monitor, Smartphone } from 'lucide-react';
import { type Template } from '@/lib/api';

// 마케팅 템플릿 카테고리
const TEMPLATE_CATEGORIES = [
  { id: 'all', label: '전체', icon: Sparkles },
  { id: 'social', label: 'SNS', icon: MessageSquare },
  { id: 'ecommerce', label: '이커머스', icon: ShoppingBag },
  { id: 'banner', label: '배너', icon: Monitor },
  { id: 'mobile', label: '모바일', icon: Smartphone },
];

// 프리셋 템플릿
const TEMPLATES = [
  {
    id: 1,
    category: 'social',
    title: '인스타그램 제품 홍보',
    prompt: 'Product photography, minimalist background, soft lighting, professional studio shot, Instagram style',
    thumbnail: '📸',
    size: '1080x1080',
    tags: ['제품', 'SNS', '미니멀'],
  },
  {
    id: 2,
    category: 'social',
    title: '인스타 스토리 프로모션',
    prompt: 'Vertical promotional image, vibrant colors, modern design, call-to-action style, Instagram story format',
    thumbnail: '📱',
    size: '1080x1920',
    tags: ['프로모션', '스토리', '세로형'],
  },
  {
    id: 3,
    category: 'ecommerce',
    title: '쇼핑몰 상품 이미지',
    prompt: 'E-commerce product photo, clean white background, professional lighting, detailed product shot, high resolution',
    thumbnail: '🛍️',
    size: '1024x1024',
    tags: ['상품', '쇼핑몰', '화이트'],
  },
  {
    id: 4,
    category: 'ecommerce',
    title: '라이프스타일 제품샷',
    prompt: 'Lifestyle product photography, natural setting, warm lighting, cozy atmosphere, brand storytelling',
    thumbnail: '🏠',
    size: '1024x768',
    tags: ['라이프스타일', '자연광', '감성'],
  },
  {
    id: 5,
    category: 'banner',
    title: '웹사이트 히어로 배너',
    prompt: 'Website hero banner, modern design, gradient background, professional corporate style, wide format',
    thumbnail: '🖥️',
    size: '1920x600',
    tags: ['배너', '웹사이트', '와이드'],
  },
  {
    id: 6,
    category: 'banner',
    title: '이벤트 프로모션 배너',
    prompt: 'Sale promotion banner, exciting colors, discount badge, attention grabbing design, marketing material',
    thumbnail: '🎉',
    size: '1200x624',
    tags: ['이벤트', '세일', '프로모션'],
  },
  {
    id: 7,
    category: 'mobile',
    title: '앱 스토어 스크린샷',
    prompt: 'Mobile app screenshot mockup, clean UI design, smartphone frame, app store style, professional',
    thumbnail: '📲',
    size: '1240x2688',
    tags: ['앱', '모바일', '스크린샷'],
  },
  {
    id: 8,
    category: 'social',
    title: '페이스북 광고 이미지',
    prompt: 'Facebook ad creative, engaging design, clear message, social media optimized, eye-catching colors',
    thumbnail: '👍',
    size: '1200x624',
    tags: ['페이스북', '광고', 'SNS'],
  },
  {
    id: 9,
    category: 'ecommerce',
    title: '패션 룩북 이미지',
    prompt: 'Fashion lookbook photo, model wearing clothes, trendy style, editorial photography, high fashion',
    thumbnail: '👗',
    size: '1024x1536',
    tags: ['패션', '룩북', '에디토리얼'],
  },
  {
    id: 10,
    category: 'banner',
    title: '유튜브 썸네일',
    prompt: 'YouTube thumbnail, bold text space, vibrant colors, clickbait style, attention grabbing, 16:9 ratio',
    thumbnail: '▶️',
    size: '1280x720',
    tags: ['유튜브', '썸네일', '영상'],
  },
  {
    id: 11,
    category: 'social',
    title: '트위터 헤더 이미지',
    prompt: 'Twitter header image, professional branding, clean design, wide banner format, social media cover',
    thumbnail: '🐦',
    size: '1504x504',
    tags: ['트위터', '헤더', '커버'],
  },
  {
    id: 12,
    category: 'mobile',
    title: '카카오톡 채널 이미지',
    prompt: 'KakaoTalk channel promotional image, friendly design, Korean style, chat app optimized, square format',
    thumbnail: '💬',
    size: '720x720',
    tags: ['카카오톡', '채널', '메시지'],
  },
];

// Local template type for homepage templates
interface LocalTemplate {
  id: number;
  category: string;
  title: string;
  prompt: string;
  thumbnail: string;
  size: string;
  tags: string[];
}

// Convert API template to generator format
function convertTemplateForGenerator(template: Template | LocalTemplate) {
  if ('name' in template) {
    // API Template
    return {
      id: parseInt(template.id.replace('template-', '')) || 0,
      category: template.category,
      title: template.name,
      prompt: template.prompt,
      thumbnail: '',
      size: `${template.width}x${template.height}`,
      tags: [],
    };
  }
  // Local template
  return template;
}

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState<LocalTemplate | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);

  // Check for template from /templates page
  useEffect(() => {
    const storedTemplate = sessionStorage.getItem('selectedTemplate');
    if (storedTemplate) {
      try {
        const template: Template = JSON.parse(storedTemplate);
        const converted = convertTemplateForGenerator(template);
        setSelectedTemplate(converted);
        setShowGenerator(true);
        sessionStorage.removeItem('selectedTemplate');
      } catch (e) {
        console.error('Failed to parse stored template', e);
      }
    }
  }, []);

  const filteredTemplates = selectedCategory === 'all'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === selectedCategory);

  const handleTemplateSelect = (template: LocalTemplate) => {
    setSelectedTemplate(template);
    setShowGenerator(true);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 to-white dark:from-violet-950/20 dark:to-background">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container py-12 md:py-20 relative">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              AI 기반 1초 이미지 생성
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                MagicEcole
              </span>
              <br />
              <span className="text-foreground">Image Maker</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              마케팅에 필요한 모든 이미지를 AI로 빠르게 생성하세요.
              <br className="hidden md:block" />
              SNS, 배너, 이커머스 등 다양한 템플릿을 제공합니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-lg shadow-violet-500/25"
                onClick={() => setShowGenerator(true)}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                바로 시작하기
              </Button>
              <Button size="lg" variant="outline" onClick={() => {
                document.getElementById('templates')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                <Palette className="mr-2 h-5 w-5" />
                템플릿 둘러보기
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-violet-600">1초</div>
              <div className="text-sm text-muted-foreground">이미지 생성</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-fuchsia-600">12+</div>
              <div className="text-sm text-muted-foreground">마케팅 템플릿</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-pink-600">무제한</div>
              <div className="text-sm text-muted-foreground">이미지 생성</div>
            </div>
          </div>
        </div>
      </section>

      {/* Generator Section (conditionally shown) */}
      {showGenerator && (
        <section className="container py-12 border-b">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">이미지 생성</h2>
              {selectedTemplate && (
                <p className="text-muted-foreground">
                  템플릿: {selectedTemplate.title}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setShowGenerator(false);
                setSelectedTemplate(null);
              }}
            >
              닫기
            </Button>
          </div>
          <ImageGenerator initialTemplate={selectedTemplate} />
        </section>
      )}

      {/* Templates Section */}
      <section id="templates" className="container py-12 md:py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-4">마케팅 템플릿</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            용도에 맞는 템플릿을 선택하고, 원하는 내용을 입력하면 바로 이미지가 생성됩니다.
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {TEMPLATE_CATEGORIES.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className={selectedCategory === category.id ? 'bg-violet-600 hover:bg-violet-700' : ''}
            >
              <category.icon className="w-4 h-4 mr-2" />
              {category.label}
            </Button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="group relative bg-card border rounded-xl overflow-hidden hover:shadow-lg hover:border-violet-300 dark:hover:border-violet-700 transition-all cursor-pointer"
              onClick={() => handleTemplateSelect(template)}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/30 dark:to-fuchsia-900/30 flex items-center justify-center">
                <span className="text-5xl group-hover:scale-110 transition-transform">
                  {template.thumbnail}
                </span>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-semibold mb-1 group-hover:text-violet-600 transition-colors">
                  {template.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {template.size}
                </p>
                <div className="flex flex-wrap gap-1">
                  {template.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-violet-600/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button variant="secondary" size="sm">
                  <Sparkles className="w-4 h-4 mr-2" />
                  이 템플릿으로 시작
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-muted/50 py-12 md:py-16">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">왜 MagicEcole인가요?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-background rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="font-semibold mb-2">초고속 생성</h3>
              <p className="text-sm text-muted-foreground">
                최신 AI 모델로 1초 이내에 고품질 이미지를 생성합니다.
              </p>
            </div>
            <div className="bg-background rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-fuchsia-100 dark:bg-fuchsia-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Palette className="w-6 h-6 text-fuchsia-600" />
              </div>
              <h3 className="font-semibold mb-2">마케팅 최적화</h3>
              <p className="text-sm text-muted-foreground">
                SNS, 배너, 이커머스 등 마케팅에 최적화된 템플릿을 제공합니다.
              </p>
            </div>
            <div className="bg-background rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <ImageIcon className="w-6 h-6 text-pink-600" />
              </div>
              <h3 className="font-semibold mb-2">다양한 크기</h3>
              <p className="text-sm text-muted-foreground">
                인스타그램, 페이스북, 유튜브 등 각 플랫폼에 맞는 크기를 지원합니다.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
