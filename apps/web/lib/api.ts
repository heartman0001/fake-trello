import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { getCookie } from 'cookies-next';
import { useAuthStore } from '@/store/useAuthStore';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface ApiError {
  message: string | string[];
  statusCode?: number;
  errors?: Record<string, string[]>;
}

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use((config) => {
      const token = getCookie('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
          document.cookie =
            'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
          document.cookie =
            'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
          // Drop the persisted profile as well, so a different account cannot
          // inherit the previous user's cached identity.
          useAuthStore.getState().logout();
          if (!window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      },
    );
  }

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.request<T>(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError<ApiError>(error)) {
        const message = error.response?.data?.message;
        const text = Array.isArray(message)
          ? message.join(', ')
          : message || error.message || 'Something went wrong';
        throw new Error(text);
      }
      throw error;
    }
  }

  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  // Board Members
  addBoardMember<T>(
    boardId: string,
    data: { userId: string; role: string },
    config?: AxiosRequestConfig,
  ): Promise<T> {
    return this.post<T>(`/boards/${boardId}/members`, data, config);
  }

  removeBoardMember<T>(boardId: string, userId: string): Promise<T> {
    return this.delete<T>(`/boards/${boardId}/members/${userId}`);
  }

  getBoardMembers<T>(boardId: string): Promise<T> {
    return this.get<T>(`/boards/${boardId}/members`);
  }

  // Users
  getAllUsers<T>(params: {
    boardId: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<T> {
    return this.get<T>('/auth/users', { params });
  }
}

export const api = new ApiClient();
export { API_BASE_URL };
