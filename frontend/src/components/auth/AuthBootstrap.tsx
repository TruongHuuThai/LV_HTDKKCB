import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { isJwtExpired, refreshAccessToken } from '@/services/authSession';
import { authService } from '@/services/authService';

type AuthBootstrapProps = {
  children: ReactNode;
};

export default function AuthBootstrap({ children }: AuthBootstrapProps) {
  const token = useAuthStore((state) => state.token);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const startedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!token || !user) {
      setReady(true);
      return;
    }

    let cancelled = false;
    const syncCurrentUser = async () => {
      try {
        const currentUser = await authService.me();
        if (cancelled) return;

        if (!currentUser) {
          clearAuth();
          setReady(true);
          return;
        }

        setUser(currentUser);
        setReady(true);
      } catch {
        if (cancelled) return;
        clearAuth();
        setReady(true);
      }
    };

    if (!isJwtExpired(token)) {
      void syncCurrentUser();
      return;
    }

    if (!refreshToken) {
      clearAuth();
      setReady(true);
      return;
    }

    refreshAccessToken()
      .then(() => syncCurrentUser())
      .catch(() => {
        if (cancelled) return;
        clearAuth();
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [clearAuth, refreshToken, setUser, token, user]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(210,30%,97%)]">
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
          Dang kiem tra phien dang nhap...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
