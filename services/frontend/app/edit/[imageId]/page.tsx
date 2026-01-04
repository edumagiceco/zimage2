'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageEditor } from '@/components/features/editor';
import api, { type GalleryImage } from '@/lib/api';

async function getImage(imageId: string): Promise<GalleryImage> {
  const response = await api.get<GalleryImage>(`/api/gallery/${imageId}`);
  return response.data;
}

export default function EditPage() {
  const params = useParams();
  const router = useRouter();
  const imageId = params.imageId as string;

  const { data: image, isLoading, error } = useQuery({
    queryKey: ['image', imageId],
    queryFn: () => getImage(imageId),
    enabled: !!imageId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-20 flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !image) {
    return (
      <div className="container mx-auto py-20 text-center">
        <h2 className="text-xl font-semibold mb-4">이미지를 찾을 수 없습니다</h2>
        <p className="text-muted-foreground mb-6">
          이미지가 삭제되었거나 접근 권한이 없습니다.
        </p>
        <Button onClick={() => router.push('/gallery')}>
          갤러리로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <ImageEditor image={image} />
    </div>
  );
}
