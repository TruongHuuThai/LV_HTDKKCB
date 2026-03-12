// src/services/api/axiosClient.ts
import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

const axiosClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Attach Bearer token
axiosClient.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

// Response Interceptor: Handle 401 & Refresh Token
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

axiosClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            const { refreshToken, setAuth, clearAuth } = useAuthStore.getState();

            if (!refreshToken) {
                clearAuth();
                window.location.href = '/login';
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve) => {
                    pendingRequests.push((newToken: string) => {
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        resolve(axiosClient(originalRequest));
                    });
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const res = await axios.post(
                    `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/auth/refresh`,
                    { refresh_token: refreshToken },
                );
                const { access_token, refresh_token: newRefreshToken, user } = res.data;

                setAuth(access_token, newRefreshToken, user);

                // Re-run pending requests
                pendingRequests.forEach((cb) => cb(access_token));
                pendingRequests = [];

                originalRequest.headers.Authorization = `Bearer ${access_token}`;
                return axiosClient(originalRequest);
            } catch (refreshError) {
                clearAuth();
                pendingRequests = [];
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    },
);

export default axiosClient;
