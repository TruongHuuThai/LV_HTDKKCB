// src/routes/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

interface ProtectedRouteProps {
    allowedRoles?: Array<'ADMIN' | 'BAC_SI' | 'BENH_NHAN'>;
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
    const { token, user } = useAuthStore();

    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.TK_VAI_TRO)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
