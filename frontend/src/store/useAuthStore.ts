// src/store/useAuthStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
    TK_SDT: string;
    TK_VAI_TRO: 'ADMIN' | 'BAC_SI' | 'BENH_NHAN';
    BS_MA?: string | null;
    BN_MA?: string | null;
    TEN_HIEN_THI?: string | null;
    BS_HO_TEN?: string | null;
    BN_HO_TEN?: string | null;
}

interface AuthState {
    token: string | null;
    refreshToken: string | null;
    user: AuthUser | null;

    setAuth: (token: string, refreshToken: string, user: AuthUser) => void;
    setUser: (user: AuthUser | null) => void;
    clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            refreshToken: null,
            user: null,

            setAuth: (token, refreshToken, user) => set({ token, refreshToken, user }),
            setUser: (user) => set((state) => ({ ...state, user })),
            clearAuth: () => set({ token: null, refreshToken: null, user: null }),
        }),
        {
            name: 'umc-auth', // localStorage key
        },
    ),
);
