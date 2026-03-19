import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';
import {
  getAccessTokenForRequest,
  getApiBaseUrl,
  isAuthRequest,
  refreshAccessToken,
} from './authSession';

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    if (isAuthRequest(config.url)) {
      return config;
    }

    const token = await getAccessTokenForRequest({
      allowAnonymousFallback: true,
    });

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
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
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const accessToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearAuth();
      return Promise.reject(refreshError);
    }
  },
);

export default api;

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
