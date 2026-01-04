'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Heart,
  Grid3X3,
  LayoutGrid,
  Loader2,
  Download,
  Trash2,
  Copy,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';
import { getGalleryImages, toggleFavorite, deleteImage, type GalleryImage } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'large';

export default function GalleryPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const limit = viewMode === 'large' ? 12 : 20;

  // Fetch images
  const { data, isLoading, error } = useQuery({
    queryKey: ['gallery', page, limit, search, favoritesOnly],
    queryFn: () =>
      getGalleryImages({
        page,
        limit,
        search: search || undefined,
        favorites_only: favoritesOnly,
      }),
  });

  // Toggle favorite mutation
  const favoriteMutation = useMutation({
    mutationFn: toggleFavorite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      toast.success('즐겨찾기가 변경되었습니다.');
    },
    onError: () => {
      toast.error('즐겨찾기 변경에 실패했습니다.');
    },
  });

  // Delete image mutation
  const deleteMutation = useMutation({
    mutationFn: deleteImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
      setSelectedImage(null);
      toast.success('이미지가 삭제되었습니다.');
    },
    onError: () => {
      toast.error('이미지 삭제에 실패했습니다.');
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleDownload = async (image: GalleryImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zimage-${image.id}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('이미지가 다운로드되었습니다.');
    } catch (error) {
      toast.error('다운로드에 실패했습니다.');
    }
  };

  const handleCopyUrl = async (image: GalleryImage) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(image.url);
      } else {
        // Fallback for HTTP environments
        const textArea = document.createElement('textarea');
        textArea.value = image.url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedId(image.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success('URL이 복사되었습니다.');
    } catch (error) {
      toast.error('URL 복사에 실패했습니다.');
    }
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">갤러리</h1>
          <p className="text-muted-foreground mt-1">
            생성된 이미지를 관리하세요
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
            title="작은 그리드"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'large' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('large')}
            title="큰 그리드"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="프롬프트로 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit">검색</Button>
        </form>

        <Button
          variant={favoritesOnly ? 'default' : 'outline'}
          onClick={() => {
            setFavoritesOnly(!favoritesOnly);
            setPage(1);
          }}
        >
          <Heart className={cn('h-4 w-4 mr-2', favoritesOnly && 'fill-current')} />
          즐겨찾기
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">이미지를 불러오는데 실패했습니다.</p>
          <Button
            variant="outline"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['gallery'] })}
            className="mt-4"
          >
            다시 시도
          </Button>
        </div>
      ) : data?.images.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <LayoutGrid className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">이미지가 없습니다</h3>
          <p className="text-muted-foreground">
            {search || favoritesOnly
              ? '검색 조건에 맞는 이미지가 없습니다.'
              : '이미지를 생성해보세요!'}
          </p>
        </div>
      ) : (
        <>
          {/* Image Grid */}
          <div
            className={cn(
              'grid gap-4',
              viewMode === 'grid'
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
            )}
          >
            {data?.images.map((image) => (
              <div
                key={image.id}
                className="group relative aspect-square rounded-lg overflow-hidden bg-muted border cursor-pointer"
                onClick={() => setSelectedImage(image)}
              >
                <img
                  src={image.url}
                  alt={image.prompt}
                  className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Favorite Badge */}
                  {image.is_favorite && (
                    <div className="absolute top-2 left-2">
                      <Heart className="h-5 w-5 text-red-500 fill-current" />
                    </div>
                  )}

                  {/* Size Badge */}
                  <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded text-xs text-white">
                    {image.width}x{image.height}
                  </div>

                  {/* Actions */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-sm line-clamp-2 mb-2">
                      {image.prompt}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Total Count */}
          <p className="text-center text-sm text-muted-foreground mt-4">
            총 {data?.total || 0}개의 이미지
          </p>
        </>
      )}

      {/* Image Detail Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] flex flex-col md:flex-row gap-4 bg-background rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image */}
            <div className="flex-1 flex items-center justify-center bg-black min-h-[300px] md:min-h-[500px]">
              <img
                src={selectedImage.url}
                alt={selectedImage.prompt}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>

            {/* Details */}
            <div className="w-full md:w-80 p-6 overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold">이미지 상세</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedImage(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    프롬프트
                  </label>
                  <p className="mt-1 text-sm">{selectedImage.prompt}</p>
                </div>

                {selectedImage.negative_prompt && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      네거티브 프롬프트
                    </label>
                    <p className="mt-1 text-sm">{selectedImage.negative_prompt}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      크기
                    </label>
                    <p className="mt-1 text-sm">
                      {selectedImage.width}x{selectedImage.height}
                    </p>
                  </div>
                  {selectedImage.seed && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        시드
                      </label>
                      <p className="mt-1 text-sm">{selectedImage.seed}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    생성일
                  </label>
                  <p className="mt-1 text-sm">
                    {new Date(selectedImage.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Link href={`/edit/${selectedImage.id}`}>
                    <Button variant="default" size="sm">
                      <Pencil className="h-4 w-4 mr-2" />
                      편집
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(selectedImage)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    다운로드
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyUrl(selectedImage)}
                  >
                    {copiedId === selectedImage.id ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                        복사됨
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        URL 복사
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => favoriteMutation.mutate(selectedImage.id)}
                    disabled={favoriteMutation.isPending}
                  >
                    <Heart
                      className={cn(
                        'h-4 w-4 mr-2',
                        selectedImage.is_favorite && 'fill-current text-red-500'
                      )}
                    />
                    {selectedImage.is_favorite ? '즐겨찾기 해제' : '즐겨찾기'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm('정말 삭제하시겠습니까?')) {
                        deleteMutation.mutate(selectedImage.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
