// src/services/authService.ts
import api from './api';
import type { AuthUser } from '@/store/useAuthStore';

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    user: AuthUser;
}

export interface RegisterInput {
    TK_SDT: string;
    TK_PASS: string;
    BN_HO_CHU_LOT?: string;
    BN_TEN?: string;
    BN_EMAIL?: string;
}

export const authService = {
    login: async (TK_SDT: string, TK_PASS: string): Promise<LoginResponse> => {
        const res = await api.post<LoginResponse>('/auth/login', { TK_SDT, TK_PASS });
        return res.data;
    },

    register: async (data: RegisterInput): Promise<{ TK_SDT: string; BN_MA: string }> => {
        const res = await api.post('/auth/register', data);
        return res.data;
    },

    refresh: async (refresh_token: string): Promise<LoginResponse> => {
        const res = await api.post<LoginResponse>('/auth/refresh', { refresh_token });
        return res.data;
    },

    logout: async (refresh_token: string): Promise<void> => {
        await api.post('/auth/logout', { refresh_token });
    },

    me: async (): Promise<AuthUser> => {
        const res = await api.get<AuthUser>('/auth/me');
        return res.data;
    },
};
