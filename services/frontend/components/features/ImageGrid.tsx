'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Heart, Maximize2, Copy, Check } from 'lucide-react';
import { type GeneratedImage } from '@/lib/api';
import { toast } from 'sonner';

interface ImageGridProps {
  images: GeneratedImage[];
  onFavorite?: (imageId: string) => void;
}

export function ImageGrid({ images, onFavorite }: ImageGridProps) {
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleDownload = async (image: GeneratedImage) => {
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

  const handleCopyUrl = async (image: GeneratedImage) => {
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

  return (
    <>
      {/* Image Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {images.map((image) => (
          <div
            key={image.id}
            className="group relative aspect-square rounded-lg overflow-hidden bg-muted border"
          >
            {/* Image - using img tag for better compatibility with external URLs */}
            <img
              src={image.url}
              alt="Generated image"
              className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />

            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Actions */}
              <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => handleDownload(image)}
                    title="다운로드"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => handleCopyUrl(image)}
                    title="URL 복사"
                  >
                    {copiedId === image.id ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  {onFavorite && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => onFavorite(image.id)}
                      title="즐겨찾기"
                    >
                      <Heart className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setSelectedImage(image)}
                  title="크게 보기"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Size Badge */}
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded text-xs text-white">
              {image.width}x{image.height}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex items-center justify-center">
            <img
              src={selectedImage.url}
              alt="Generated image"
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>

          {/* Close button */}
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setSelectedImage(null)}
          >
            <svg
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Actions in lightbox */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            <Button
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(selectedImage);
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              다운로드
            </Button>
            <Button
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyUrl(selectedImage);
              }}
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
          </div>
        </div>
      )}
    </>
  );
}
