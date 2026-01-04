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

export default api;
