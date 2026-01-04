// Re-export types from API
export type {
  GenerateImageRequest,
  GenerateImageResponse,
  TaskStatusResponse,
  GeneratedImage,
  GalleryImage,
  GalleryResponse,
  GalleryParams,
  Template,
  TemplatesResponse,
  LoginRequest,
  LoginResponse,
  User,
} from '@/lib/api';

// Additional types
export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  image_count: number;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  image_count: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export type ImageSize = {
  width: number;
  height: number;
  label: string;
};

export const IMAGE_SIZES: ImageSize[] = [
  { width: 1024, height: 1024, label: '1:1 (1024x1024)' },
  { width: 1024, height: 576, label: '16:9 (1024x576)' },
  { width: 576, height: 1024, label: '9:16 (576x1024)' },
  { width: 1024, height: 768, label: '4:3 (1024x768)' },
  { width: 768, height: 1024, label: '3:4 (768x1024)' },
  { width: 1080, height: 1080, label: 'Instagram (1080x1080)' },
  { width: 1080, height: 1920, label: 'Instagram Story (1080x1920)' },
  { width: 820, height: 312, label: 'Facebook Cover (820x312)' },
  { width: 1500, height: 500, label: 'Twitter Header (1500x500)' },
];
