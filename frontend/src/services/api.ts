// ============================================================
// API Service - Axios wrapper với auto refresh token
// ============================================================
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
};

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Gửi cookie (refresh token)
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor: gắn access token vào header
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: xử lý 401 - tự động refresh token
api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Xếp hàng các request đang chờ
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        const newToken = data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ---- API Functions ----

export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; full_name: string }) =>
    api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const photosAPI = {
  list: (projectId: string, params?: Record<string, unknown>) =>
    api.get(`/projects/${projectId}/photos`, { params }),
  get: (projectId: string, photoId: string) =>
    api.get(`/projects/${projectId}/photos/${photoId}`),
  upload: (projectId: string, formData: FormData) =>
    api.post(`/projects/${projectId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (projectId: string, photoId: string) =>
    api.delete(`/projects/${projectId}/photos/${photoId}`),
  searchByRadius: (projectId: string, params: {
    lat: number; lng: number; radius: number;
    start_date?: string; end_date?: string;
  }) => api.get(`/projects/${projectId}/media/search`, { params }),
  getTree: (projectId: string) =>
    api.get(`/projects/${projectId}/media/tree`),
  getTimeline: (projectId: string, groupBy?: 'day' | 'week' | 'month') =>
    api.get(`/projects/${projectId}/media/timeline`, { params: { group_by: groupBy } }),
  getStats: (projectId: string) =>
    api.get(`/projects/${projectId}/media/stats`),
};

export const tasksAPI = {
  list: (projectId: string, view?: 'kanban' | 'gantt', params?: Record<string, unknown>) =>
    api.get(`/projects/${projectId}/tasks`, { params: { view, ...params } }),
  gantt: (projectId: string, start?: string, end?: string) =>
    api.get(`/projects/${projectId}/tasks/gantt`, { params: { start, end } }),
  create: (projectId: string, data: Record<string, unknown>) =>
    api.post(`/projects/${projectId}/tasks`, data),
  update: (projectId: string, taskId: string, data: Record<string, unknown>) =>
    api.patch(`/projects/${projectId}/tasks/${taskId}`, data),
  reorder: (projectId: string, updates: Array<{ id: string; status: string; kanban_order: number }>) =>
    api.post(`/projects/${projectId}/tasks/reorder`, { updates }),
  delete: (projectId: string, taskId: string) =>
    api.delete(`/projects/${projectId}/tasks/${taskId}`),
};

export const pinsAPI = {
  list: (projectId: string, params?: Record<string, unknown>) =>
    api.get(`/projects/${projectId}/pins`, { params }),
  create: (projectId: string, data: Record<string, unknown>) =>
    api.post(`/projects/${projectId}/pins`, data),
  updateStatus: (projectId: string, pinId: string, status: string) =>
    api.patch(`/projects/${projectId}/pins/${pinId}/status`, { status }),
};

export default api;
