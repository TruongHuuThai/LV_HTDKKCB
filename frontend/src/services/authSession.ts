import axios from 'axios';
import { useAuthStore, type AuthUser } from '@/store/useAuthStore';

type SessionResponse = {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
};

const AUTH_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
]);

let refreshPromise: Promise<string> | null = null;

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
}

export function isAuthRequest(url?: string) {
  if (!url) return false;

  try {
    const pathname = new URL(url, getApiBaseUrl()).pathname;
    return AUTH_PATHS.has(pathname);
  } catch {
    return false;
  }
}

export function isJwtExpired(token: string, skewSeconds = 30) {
  try {
    const [, payload] = token.split('.');
    if (!payload) return true;

    const normalized = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const decoded = JSON.parse(window.atob(normalized));
    const exp = typeof decoded?.exp === 'number' ? decoded.exp : null;
    if (!exp) return true;

    const nowInSeconds = Math.floor(Date.now() / 1000);
    return exp <= nowInSeconds + skewSeconds;
  } catch {
    return true;
  }
}

export async function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  const { refreshToken, setAuth, clearAuth } = useAuthStore.getState();

  if (!refreshToken) {
    clearAuth();
    throw new Error('Missing refresh token');
  }

  refreshPromise = axios
    .post<SessionResponse>(`${getApiBaseUrl()}/auth/refresh`, {
      refresh_token: refreshToken,
    })
    .then(({ data }) => {
      setAuth(data.access_token, data.refresh_token, data.user);
      return data.access_token;
    })
    .catch((error) => {
      clearAuth();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function getAccessTokenForRequest(options?: {
  allowAnonymousFallback?: boolean;
}) {
  const allowAnonymousFallback = options?.allowAnonymousFallback ?? false;
  const { token } = useAuthStore.getState();

  if (!token) {
    return null;
  }

  if (!isJwtExpired(token)) {
    return token;
  }

  try {
    return await refreshAccessToken();
  } catch (error) {
    if (allowAnonymousFallback) {
      return null;
    }
    throw error;
  }
}
