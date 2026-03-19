import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';
import {
  getAccessTokenForRequest,
  getApiBaseUrl,
  isAuthRequest,
  refreshAccessToken,
} from '../authSession';

const axiosClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use(
  async (config) => {
    if (isAuthRequest(config.url)) {
      return config;
    }

    const token = await getAccessTokenForRequest();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      isAuthRequest(originalRequest?.url)
    ) {
      return Promise.reject(error);
    }

    const { refreshToken, clearAuth } = useAuthStore.getState();

    if (!refreshToken) {
      clearAuth();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const accessToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return axiosClient(originalRequest);
    } catch (refreshError) {
      clearAuth();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    }
  },
);

export default axiosClient;
