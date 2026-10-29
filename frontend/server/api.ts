import { authStore } from '@/store/authStore';
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import { authApi } from './auth';

export interface ApiError extends Error {
  status?: number;
  data?: unknown;
}

interface RetryRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface RefreshTokenResponse {
  accessToken: string;
}

export class ApiClient {
  private instance: AxiosInstance;
  private baseURL: string;

  // Các request cùng chờ một lần refresh token
  private refreshPromise: Promise<{ accessToken: string }> | null = null;

  constructor(baseUrl: string = '') {
    this.baseURL =
      baseUrl || process.env.NEXT_PUBLIC_API_URL || '';

    this.instance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    // Interceptor cho request
    this.instance.interceptors.request.use((config) => {
      const token = authStore.getState().accessToken;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    });

    // Interceptor cho response
    this.instance.interceptors.response.use(
      (response) => response,

      async (error: AxiosError) => {
        const originalRequest =
          error.config as RetryRequestConfig | undefined;

        const status = error.response?.status;

        // Chỉ refresh khi gặp 403 và request chưa retry
        if (
          status === 403 &&
          originalRequest &&
          !originalRequest._retry &&
          !originalRequest.url?.includes('/auth/refresh')
        ) {
          originalRequest._retry = true;

          try {
            const newAccessToken = await this.refreshAccessToken();

            // Cập nhật token cho request cần retry
            originalRequest.headers.Authorization =
              `Bearer ${newAccessToken}`;

            // Gửi lại request ban đầu
            return await this.instance(originalRequest);
          } catch (refreshError) {
            // TODO: Xóa auth state / logout nếu refresh thất bại
            return Promise.reject(refreshError);
          } finally {
            this.refreshPromise = null;
          }
        }

        // Giữ cách chuẩn hóa lỗi hiện tại
        const customError: ApiError = new Error(
          (error.response?.data as { message?: string })?.message ||
            error.message ||
            `HTTP Error: ${status}`
        );

        customError.status = status;
        customError.data = error.response?.data;

        return Promise.reject(customError);
      }
    );
  }

private async refreshAccessToken(): Promise<string> {
  if (!this.refreshPromise) {
    this.refreshPromise = authApi.refresh()
  }

  const token = (await this.refreshPromise).accessToken;
  authStore.setState({accessToken: token})
  return token;
}

  public setHeader(key: string, value: string): void {
    this.instance.defaults.headers.common[key] = value;
  }

  public removeHeader(key: string): void {
    delete this.instance.defaults.headers.common[key];
  }

  public async get<T>(
    endpoint: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.instance.get<T>(endpoint, config);
    return response.data;
  }

  public async post<T, B = unknown>(
    endpoint: string,
    body?: B,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.instance.post<T>(
      endpoint,
      body,
      config
    );
    return response.data;
  }

  public async put<T, B = unknown>(
    endpoint: string,
    body: B,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.instance.put<T>(
      endpoint,
      body,
      config
    );
    return response.data;
  }

  public async patch<T, B = unknown>(
    endpoint: string,
    body?: B,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.instance.patch<T>(
      endpoint,
      body,
      config
    );
    return response.data;
  }

  public async delete<T>(
    endpoint: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.instance.delete<T>(
      endpoint,
      config
    );
    return response.data;
  }
}

export const api = new ApiClient(
  process.env.NEXT_PUBLIC_API_URL || ''
);

export default ApiClient;