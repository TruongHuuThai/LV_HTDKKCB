// src/services/api.ts
import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json',
    },
});

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Tự động gắn Bearer token từ store vào mỗi request
api.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

// ─── Response Interceptor ─────────────────────────────────────────────────────
// Nếu nhận 401 → thử refresh token → retry; thất bại → logout
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

api.interceptors.response.use(
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
                // Xếp hàng chờ token mới
                return new Promise((resolve) => {
                    pendingRequests.push((newToken: string) => {
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        resolve(api(originalRequest));
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

                // Thả hàng đợi
                pendingRequests.forEach((cb) => cb(access_token));
                pendingRequests = [];

                originalRequest.headers.Authorization = `Bearer ${access_token}`;
                return api(originalRequest);
            } catch {
                clearAuth();
                pendingRequests = [];
                window.location.href = '/login';
                return Promise.reject(error);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    },
);

export default api;

// ─── Specialty ───────────────────────────────────────────────────────────────
export interface Specialty {
    CK_MA: number;
    CK_TEN: string;
    CK_MO_TA?: string | null;
    CK_ANH?: string | null;
    CK_DOI_TUONG_KHAM?: string | null;
}

export const getSpecialties = async (): Promise<Specialty[]> => {
    const res = await api.get<Specialty[]>('/users/specialties');
    return res.data;
};

// ─── Doctor ─────────────────────────────────────────────────────────────────────────
export interface Doctor {
    BS_MA: number;
    BS_HO_TEN: string;
    BS_HOC_HAM: string | null;
    BS_ANH: string | null;
    BS_EMAIL: string | null;
    BS_SDT: string | null;
    CK_MA: number;
    CHUYEN_KHOA: Specialty & {
        CK_DOI_TUONG_KHAM?: string | null;
    };
}

export const getDoctors = async (specialtyId?: number): Promise<Doctor[]> => {
    const params = specialtyId ? { specialtyId } : {};
    const res = await api.get<Doctor[]>('/users/doctors', { params });
    return res.data;
};

export const getDoctorDetail = async (id: number): Promise<Doctor> => {
    const res = await api.get<Doctor>(`/users/doctors/${id}`);
    return res.data;
};

