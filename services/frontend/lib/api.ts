import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8100';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Types
export interface GenerateImageRequest {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_images?: number;
  seed?: number;
}

export interface GenerateImageResponse {
  task_id: string;
  status: string;
  estimated_time: number;
}

export interface GeneratedImage {
  id: string;
  url: string;
  thumbnail_url?: string;
  width: number;
  height: number;
  seed?: number;
}

export interface TaskStatusResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  images: GeneratedImage[];
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress?: number;
  progress_message?: string;
  estimated_seconds?: number;
  elapsed_seconds?: number;
  // Translation info
  original_prompt?: string;
  translated_prompt?: string;
  was_translated?: boolean;
}

export interface GalleryImage {
  id: string;
  url: string;
  thumbnail_url?: string;
  prompt: string;
  negative_prompt?: string;
  width: number;
  height: number;
  seed?: number;
  is_favorite: boolean;
  created_at: string;
}

export interface GalleryResponse {
  images: GalleryImage[];
  total: number;
  page: number;
  limit: number;
}

export interface GalleryParams {
  page?: number;
  limit?: number;
  folder_id?: string;
  favorites_only?: boolean;
  search?: string;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  prompt: string;
  negative_prompt?: string;
  width: number;
  height: number;
  is_public: boolean;
  thumbnail?: string;
  icon?: string;
}

export interface TemplatesResponse {
  templates: Template[];
  total: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

// Keep for backward compatibility
export interface LoginResponse extends AuthResponse {}

// API Functions
export async function generateImage(request: GenerateImageRequest): Promise<GenerateImageResponse> {
  const response = await api.post<GenerateImageResponse>('/api/images/generate', request);
  return response.data;
}

export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
  const response = await api.get<TaskStatusResponse>(`/api/tasks/${taskId}`);
  return response.data;
}

export async function getGalleryImages(params?: GalleryParams): Promise<GalleryResponse> {
  const response = await api.get<GalleryResponse>('/api/gallery/', { params });
  return response.data;
}

export async function toggleFavorite(imageId: string): Promise<GalleryImage> {
  const response = await api.post<GalleryImage>(`/api/gallery/${imageId}/favorite`);
  return response.data;
}

export async function deleteImage(imageId: string): Promise<void> {
  await api.delete(`/api/gallery/${imageId}`);
}

export async function getTemplates(category?: string): Promise<TemplatesResponse> {
  const params = category ? { category } : {};
  const response = await api.get<TemplatesResponse>('/api/templates/', { params });
  return response.data;
}

export async function getTemplateCategories(): Promise<{ categories: { id: string; name: string }[] }> {
  const response = await api.get('/api/templates/categories');
  return response.data;
}

export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/api/auth/login', credentials);
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', response.data.access_token);
    localStorage.setItem('refresh_token', response.data.refresh_token);
  }
  return response.data;
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>('/api/auth/register', data);
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', response.data.access_token);
    localStorage.setItem('refresh_token', response.data.refresh_token);
  }
  return response.data;
}

export async function logout(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
}

export async function getCurrentUser(): Promise<User> {
  const response = await api.get<User>('/api/auth/me');
  return response.data;
}

export async function refreshToken(): Promise<LoginResponse> {
  const refreshToken = localStorage.getItem('refresh_token');
  const response = await api.post<LoginResponse>('/api/auth/refresh', {
    refresh_token: refreshToken,
  });
  return response.data;
}

// Inpainting Types
export interface InpaintRequest {
  original_image_id: string;
  mask_data: string;
  prompt: string;
  negative_prompt?: string;
  strength?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  seed?: number;
}

export interface InpaintResponse {
  task_id: string;
  status: string;
  estimated_time: number;
}

export interface InpaintTaskStatusResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  progress_message?: string;
  elapsed_seconds?: number;
  estimated_seconds?: number;
  original_image_url?: string;
  images?: GeneratedImage[];
  error?: string;
  created_at?: string;
  completed_at?: string;
}

// Inpainting API Functions
export async function inpaintImage(request: InpaintRequest): Promise<InpaintResponse> {
  const response = await api.post<InpaintResponse>('/api/images/inpaint', request);
  return response.data;
}

export async function getInpaintTaskStatus(taskId: string): Promise<InpaintTaskStatusResponse> {
  const response = await api.get<InpaintTaskStatusResponse>(`/api/images/inpaint/tasks/${taskId}`);
  return response.data;
}

// Edit History Types
export interface EditHistoryItem {
  id: string;
  user_id: string;
  original_image_id: string;
  edited_image_id: string;
  inpaint_task_id?: string;
  edit_type: string;
  prompt?: string;
  negative_prompt?: string;
  strength?: number;
  original_thumbnail_url?: string;
  edited_thumbnail_url?: string;
  edit_metadata: Record<string, any>;
  created_at: string;
}

export interface EditHistoryListResponse {
  items: EditHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// Edit History API Functions
export async function getImageEditHistory(
  imageId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<EditHistoryListResponse> {
  const response = await api.get<EditHistoryListResponse>(
    `/api/images/${imageId}/edit-history`,
    { params: { page, page_size: pageSize } }
  );
  return response.data;
}

export async function getAllEditHistory(
  page: number = 1,
  pageSize: number = 20
): Promise<EditHistoryListResponse> {
  const response = await api.get<EditHistoryListResponse>(
    '/api/edit-history',
    { params: { page, page_size: pageSize } }
  );
  return response.data;
}

export async function getEditHistoryDetail(historyId: string): Promise<EditHistoryItem> {
  const response = await api.get<EditHistoryItem>(`/api/edit-history/${historyId}`);
  return response.data;
}

export async function deleteEditHistory(historyId: string): Promise<void> {
  await api.delete(`/api/edit-history/${historyId}`);
}

// Replay edit on a new target image
export interface ReplayEditResponse {
  task_id: string;
  status: string;
  estimated_time: number;
}

export async function replayEdit(
  historyId: string,
  targetImageId: string
): Promise<ReplayEditResponse> {
  const response = await api.post<ReplayEditResponse>(
    `/api/edit-history/${historyId}/replay`,
    { target_image_id: targetImageId }
  );
  return response.data;
}

// ============================================
// Phase 5: Advanced Image Editing Features
// ============================================

// SAM Segmentation Types
export interface SAMResponse {
  task_id: string;
  status: string;
  estimated_time: number;
}

export interface SAMTaskStatusResponse {
  task_id: string;
  status: string;
  mask_url?: string;
  mask_base64?: string;
  masks?: Array<{
    id: string;
    url: string;
    base64: string;
  }>;
  error?: string;
}

// SAM API Functions
export async function segmentByPoint(
  imageId: string,
  pointCoords: number[][],
  pointLabels: number[]
): Promise<SAMResponse> {
  const response = await api.post<SAMResponse>('/api/images/sam/segment-point', {
    image_id: imageId,
    point_coords: pointCoords,
    point_labels: pointLabels,
  });
  return response.data;
}

export async function segmentByBox(
  imageId: string,
  box: number[]
): Promise<SAMResponse> {
  const response = await api.post<SAMResponse>('/api/images/sam/segment-box', {
    image_id: imageId,
    box: box,
  });
  return response.data;
}

export async function segmentAuto(imageId: string): Promise<SAMResponse> {
  const response = await api.post<SAMResponse>('/api/images/sam/segment-auto', {
    image_id: imageId,
  });
  return response.data;
}

export async function getSAMTaskStatus(taskId: string): Promise<SAMTaskStatusResponse> {
  const response = await api.get<SAMTaskStatusResponse>(`/api/images/sam/tasks/${taskId}`);
  return response.data;
}

// Background Removal Types
export interface BackgroundResponse {
  task_id: string;
  status: string;
  estimated_time: number;
}

export interface BackgroundTaskStatusResponse {
  task_id: string;
  status: string;
  image?: {
    id: string;
    url: string;
    width: number;
    height: number;
  };
  mask_url?: string;
  mask_base64?: string;
  error?: string;
}

// Background API Functions
export async function removeBackground(
  imageId: string,
  alphaMatting: boolean = true
): Promise<BackgroundResponse> {
  const response = await api.post<BackgroundResponse>('/api/images/background/remove', {
    image_id: imageId,
    alpha_matting: alphaMatting,
  });
  return response.data;
}

export async function replaceBackgroundImage(
  imageId: string,
  backgroundImageId: string,
  alphaMatting: boolean = true
): Promise<BackgroundResponse> {
  const response = await api.post<BackgroundResponse>('/api/images/background/replace-image', {
    image_id: imageId,
    background_image_id: backgroundImageId,
    alpha_matting: alphaMatting,
  });
  return response.data;
}

export async function replaceBackgroundColor(
  imageId: string,
  color: number[],
  alphaMatting: boolean = true
): Promise<BackgroundResponse> {
  const response = await api.post<BackgroundResponse>('/api/images/background/replace-color', {
    image_id: imageId,
    color: color,
    alpha_matting: alphaMatting,
  });
  return response.data;
}

export async function getForegroundMask(imageId: string): Promise<BackgroundResponse> {
  const response = await api.post<BackgroundResponse>('/api/images/background/mask', {
    image_id: imageId,
  });
  return response.data;
}

export async function getBackgroundTaskStatus(taskId: string): Promise<BackgroundTaskStatusResponse> {
  const response = await api.get<BackgroundTaskStatusResponse>(`/api/images/background/tasks/${taskId}`);
  return response.data;
}

// Style Transfer Types
export interface StylePreset {
  id: string;
  name: string;
  description: string;
}

export interface StylePresetsResponse {
  styles: StylePreset[];
}

export interface StyleTransferResponse {
  task_id: string;
  status: string;
  estimated_time: number;
}

export interface StyleTaskStatusResponse {
  task_id: string;
  status: string;
  style?: string;
  image?: {
    id: string;
    url: string;
    width: number;
    height: number;
  };
  error?: string;
}

// Style API Functions
export async function getStylePresets(): Promise<StylePresetsResponse> {
  const response = await api.get<StylePresetsResponse>('/api/images/style/presets');
  return response.data;
}

export async function applyStyle(
  imageId: string,
  style: string,
  prompt: string = '',
  strength?: number,
  seed?: number
): Promise<StyleTransferResponse> {
  const response = await api.post<StyleTransferResponse>('/api/images/style/apply', {
    image_id: imageId,
    style: style,
    prompt: prompt,
    strength: strength,
    seed: seed,
  });
  return response.data;
}

export async function getStyleTaskStatus(taskId: string): Promise<StyleTaskStatusResponse> {
  const response = await api.get<StyleTaskStatusResponse>(`/api/images/style/tasks/${taskId}`);
  return response.data;
}

export default api;
