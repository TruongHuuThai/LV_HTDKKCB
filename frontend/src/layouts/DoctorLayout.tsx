// src/layouts/DoctorLayout.tsx
import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    CalendarDays,
    ClipboardList,
    UserCircle,
    ChevronRight,
    Menu,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authService } from '@/services/authService';
import { cn } from '@/lib/utils';
import AppSidebar from '@/components/layout/AppSidebar';

const sidebarItems = [
    { label: 'Tổng quan', to: '/doctor/dashboard', icon: LayoutDashboard, exact: true },
    { label: 'Lịch trực', to: '/doctor/schedules', icon: CalendarDays, exact: true },
    { label: 'Lịch hẹn', to: '/doctor/appointments', icon: ClipboardList, exact: true },
    { label: 'Hồ sơ của tôi', to: '/doctor/profile', icon: UserCircle, exact: true },
];

export default function DoctorLayout() {
    const { user, refreshToken, clearAuth } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const doctorDisplayName =
        user?.TEN_HIEN_THI?.trim() || user?.BS_HO_TEN?.trim() || user?.TK_SDT || '---';
    const collapsed = !isPinned && !isHovering;

    useEffect(() => {
        const stored = localStorage.getItem('doctor-sidebar-pinned');
        if (stored) setIsPinned(stored === '1');
    }, []);

    useEffect(() => {
        localStorage.setItem('doctor-sidebar-pinned', isPinned ? '1' : '0');
    }, [isPinned]);

    const handleLogout = async () => {
        try {
            if (refreshToken) await authService.logout(refreshToken);
        } finally {
            clearAuth();
            navigate('/login');
        }
    };

    return (
        <div
            className="relative h-screen overflow-hidden bg-[hsl(210,30%,97%)]"
            style={{
                ['--sidebar-rail-width' as never]: '80px',
                ['--sidebar-expanded-width' as never]: '260px',
            }}
        >
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside
                style={{
                    ['--sidebar-width' as never]: collapsed
                        ? 'var(--sidebar-rail-width)'
                        : 'var(--sidebar-expanded-width)',
                }}
                className={cn(
                    'fixed inset-y-0 left-0 z-50 w-[var(--sidebar-width)] bg-slate-950 text-slate-100 flex flex-col shadow-2xl overflow-hidden transition-[width,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] md:translate-x-0',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full',
                )}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <div className="h-full w-[var(--sidebar-expanded-width)]">
                    <AppSidebar
                        variant="doctor"
                        brandLabel="UMC Clinic"
                        brandTo="/doctor/dashboard"
                        roleLabel="Bác sĩ"
                        displayName={doctorDisplayName}
                        initials="BS"
                        items={sidebarItems}
                        activePath={location.pathname}
                        collapsed={collapsed}
                        pinned={isPinned}
                        onTogglePin={() => setIsPinned((prev) => !prev)}
                        onNavigate={() => setSidebarOpen(false)}
                        onLogout={handleLogout}
                    />
                </div>
            </aside>

            <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden pl-0 md:pl-[var(--sidebar-rail-width)]">
                <header className="h-14 md:h-0 md:invisible bg-white border-b border-gray-200 flex items-center gap-3 px-4 shrink-0 md:border-none">
                    <button
                        className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="flex items-center text-sm font-medium text-gray-600">
                        Bác sĩ
                        <ChevronRight className="w-4 h-4 mx-1" />
                        <span className="text-gray-900 capitalize">
                            {location.pathname.split('/').pop() || 'Dashboard'}
                        </span>
                    </div>
                </header>

                <main className="flex-1 min-h-0 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

