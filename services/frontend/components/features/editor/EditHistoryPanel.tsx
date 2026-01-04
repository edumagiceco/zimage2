'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  History,
  ChevronRight,
  Trash2,
  Loader2,
  ArrowRight,
  Clock,
} from 'lucide-react';
import {
  getImageEditHistory,
  deleteEditHistory,
  type EditHistoryItem,
} from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface EditHistoryPanelProps {
  imageId: string;
  onSelectHistory?: (history: EditHistoryItem) => void;
}

export function EditHistoryPanel({ imageId, onSelectHistory }: EditHistoryPanelProps) {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['edit-history', imageId, page],
    queryFn: () => getImageEditHistory(imageId, page, 10),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEditHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edit-history', imageId] });
      toast.success('편집 기록이 삭제되었습니다.');
    },
    onError: () => {
      toast.error('편집 기록 삭제에 실패했습니다.');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        편집 기록을 불러오는데 실패했습니다.
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <div className="text-center py-8">
        <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-muted-foreground">편집 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5" />
        <h3 className="font-semibold">편집 기록</h3>
        <span className="text-sm text-muted-foreground">({data.total}개)</span>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-3 pr-4">
          {data.items.map((item) => (
            <EditHistoryCard
              key={item.id}
              item={item}
              onSelect={() => onSelectHistory?.(item)}
              onDelete={() => deleteMutation.mutate(item.id)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      </ScrollArea>

      {data.has_more && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
          >
            더 보기
          </Button>
        </div>
      )}
    </div>
  );
}

interface EditHistoryCardProps {
  item: EditHistoryItem;
  onSelect?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

function EditHistoryCard({ item, onSelect, onDelete, isDeleting }: EditHistoryCardProps) {
  const editTypeLabels: Record<string, string> = {
    inpaint: '인페인팅',
    filter: '필터',
    crop: '자르기',
    resize: '크기 조정',
  };

  return (
    <div className="p-3 bg-card rounded-lg border hover:border-primary/50 transition-colors">
      <div className="flex gap-3">
        {/* Thumbnails */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-12 h-12 rounded overflow-hidden bg-muted">
            {item.original_thumbnail_url ? (
              <img
                src={item.original_thumbnail_url}
                alt="원본"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                원본
              </div>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="w-12 h-12 rounded overflow-hidden bg-muted">
            {item.edited_thumbnail_url ? (
              <img
                src={item.edited_thumbnail_url}
                alt="편집됨"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                편집
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
              {editTypeLabels[item.edit_type] || item.edit_type}
            </span>
            {item.strength && (
              <span className="text-xs text-muted-foreground">
                강도: {Math.round(item.strength * 100)}%
              </span>
            )}
          </div>
          {item.prompt && (
            <p className="text-sm truncate" title={item.prompt}>
              {item.prompt}
            </p>
          )}
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(new Date(item.created_at), {
              addSuffix: true,
              locale: ko,
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <Link href={`/edit/${item.edited_image_id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>편집 기록 삭제</AlertDialogTitle>
                <AlertDialogDescription>
                  이 편집 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
