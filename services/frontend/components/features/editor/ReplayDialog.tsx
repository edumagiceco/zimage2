'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Loader2, Search, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { getGalleryImages, replayEdit, type GalleryImage, type EditHistoryItem } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ReplayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  historyItem: EditHistoryItem;
  onReplayStarted: (taskId: string) => void;
}

export function ReplayDialog({
  open,
  onOpenChange,
  historyItem,
  onReplayStarted,
}: ReplayDialogProps) {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch gallery images
  const { data: galleryData, isLoading } = useQuery({
    queryKey: ['gallery-for-replay'],
    queryFn: () => getGalleryImages({ page: 1, limit: 50 }), // Get first 50 images
    enabled: open,
  });

  // Replay mutation
  const replayMutation = useMutation({
    mutationFn: () => replayEdit(historyItem.id, selectedImage!.id),
    onSuccess: (data) => {
      toast.success('편집 재적용을 시작합니다...');
      onReplayStarted(data.task_id);
      onOpenChange(false);
    },
    onError: (error: any) => {
      const message =
        error.response?.data?.detail || '편집 재적용에 실패했습니다.';
      toast.error(message);
    },
  });

  const handleReplay = () => {
    if (!selectedImage) {
      toast.error('대상 이미지를 선택해주세요.');
      return;
    }
    replayMutation.mutate();
  };

  // Filter images by search query and exclude the original image
  const filteredImages = galleryData?.images.filter(
    (img) =>
      img.id !== historyItem.original_image_id &&
      img.id !== historyItem.edited_image_id &&
      (searchQuery === '' ||
        img.prompt?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>편집 재적용</DialogTitle>
          <DialogDescription>
            이전 편집 설정을 적용할 새 이미지를 선택하세요
          </DialogDescription>
        </DialogHeader>

        {/* Edit info */}
        <div className="p-3 bg-muted rounded-lg text-sm">
          <div className="flex items-start gap-3">
            <div className="flex gap-2">
              {historyItem.original_thumbnail_url && (
                <img
                  src={historyItem.original_thumbnail_url}
                  alt="Original"
                  className="w-16 h-16 object-cover rounded"
                />
              )}
              {historyItem.edited_thumbnail_url && (
                <img
                  src={historyItem.edited_thumbnail_url}
                  alt="Edited"
                  className="w-16 h-16 object-cover rounded"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">적용할 편집 설정:</p>
              <p className="text-muted-foreground truncate">
                프롬프트: {historyItem.prompt || '(없음)'}
              </p>
              <p className="text-muted-foreground">
                강도: {Math.round((historyItem.strength || 0.85) * 100)}%
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="이미지 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Image grid */}
        <ScrollArea className="h-[300px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredImages && filteredImages.length > 0 ? (
            <div className="grid grid-cols-4 gap-3">
              {filteredImages.map((image) => (
                <button
                  key={image.id}
                  onClick={() => setSelectedImage(image)}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                    selectedImage?.id === image.id
                      ? 'border-primary ring-2 ring-primary/30'
                      : 'border-transparent hover:border-muted-foreground/30'
                  )}
                >
                  <img
                    src={image.thumbnail_url || image.url}
                    alt={image.prompt || 'Gallery image'}
                    className="w-full h-full object-cover"
                  />
                  {selectedImage?.id === image.id && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-primary" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
              <p>
                {searchQuery
                  ? '검색 결과가 없습니다'
                  : '적용 가능한 이미지가 없습니다'}
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Selected image info */}
        {selectedImage && (
          <div className="p-3 bg-primary/10 rounded-lg text-sm">
            <p className="font-medium">선택된 이미지:</p>
            <p className="text-muted-foreground truncate">
              {selectedImage.prompt || '프롬프트 없음'}
            </p>
            <p className="text-muted-foreground">
              크기: {selectedImage.width} x {selectedImage.height}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            onClick={handleReplay}
            disabled={!selectedImage || replayMutation.isPending}
          >
            {replayMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                재적용 중...
              </>
            ) : (
              '편집 재적용'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
