import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '@/store/auth.store';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Access token lives only in this module-level closure — never in localStorage,
// never in global Zustand state. XSS cannot enumerate it via React devtools or
// the Zustand store API. It is lost on page reload and silently re-acquired via
// the httpOnly refresh_token cookie on the first 401.
let _accessToken: string | null = null;

export function setAccessToken(token: string): void {
  _accessToken = token;
}

export function clearAccessToken(): void {
  _accessToken = null;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  withCredentials: true,
});

// Request interceptor — attach access token from closure
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (_accessToken) {
      config.headers.Authorization = `Bearer ${_accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle 401 and silent refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> =
  [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;

    // Public authentication failures are credentials errors, not expired sessions.
    // Never attempt cookie refresh or redirect while signing in or registering.
    const isPublicAuthRequest = /\/auth\/(login|register|password-reset\/request|password-reset\/confirm|oauth\/google|oauth\/linkedin)(?:\?|$)/.test(originalRequest?.url ?? '');
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isPublicAuthRequest) {
      // Don't attempt refresh on the refresh endpoint itself (prevents infinite loop)
      if (originalRequest.url?.includes('/auth/refresh')) {
        const { clearAuth } = useAuthStore.getState();
        clearAccessToken();
        clearAuth();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;

      const { clearAuth } = useAuthStore.getState();

      // The auth store may not have rehydrated when the first protected request
      // returns 401 after a hard reload. The httpOnly cookie is the authority;
      // attempt refresh even if the in-memory store currently says signed out.
      isRefreshing = true;

      try {
        // The httpOnly refresh_token cookie is sent automatically via withCredentials.
        const response = await axios.post(
          `${API_URL}/api/auth/refresh`,
          {},
          { withCredentials: true },
        );

        const newAccessToken: string = response.data.accessToken;
        setAccessToken(newAccessToken);
        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Only a rejected session ends it. A throttled refresh (429), a server
        // error or a dropped connection keeps the member signed in; the next
        // request tries again.
        const status = (refreshError as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          clearAccessToken();
          clearAuth();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
