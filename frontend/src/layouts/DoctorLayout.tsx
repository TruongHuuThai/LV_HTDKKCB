// src/layouts/DoctorLayout.tsx
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    Heart,
    LayoutDashboard,
    CalendarDays,
    ClipboardList,
    UserCircle,
    LogOut,
    ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authService } from '@/services/authService';
import { cn } from '@/lib/utils';

const sidebarLinks = [
    { label: 'Tổng quan', to: '/doctor/dashboard', icon: LayoutDashboard },
    { label: 'Lịch trực', to: '/doctor/schedules', icon: CalendarDays },
    { label: 'Lịch hẹn', to: '/doctor/appointments', icon: ClipboardList },
    { label: 'Hồ sơ của tôi', to: '/doctor/profile', icon: UserCircle },
];

export default function DoctorLayout() {
    const { user, refreshToken, clearAuth } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        try {
            if (refreshToken) await authService.logout(refreshToken);
        } finally {
            clearAuth();
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen flex bg-[hsl(210,30%,97%)]">
            {/* ─── Sidebar ──────────────────────────────────────── */}
            <aside className="w-64 min-h-screen bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] flex flex-col shadow-xl">
                {/* Logo */}
                <div className="px-6 py-5 border-b border-[hsl(var(--sidebar-border))]">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-[hsl(var(--sidebar-primary))/0.15] rounded-xl flex items-center justify-center">
                            <Heart className="w-5 h-5 text-[hsl(var(--sidebar-primary))]" />
                        </div>
                        <div>
                            <p className="font-bold text-base leading-tight">UMC Clinic</p>
                            <p className="text-[10px] text-[hsl(var(--sidebar-foreground))/0.55] uppercase tracking-wider">Bác sĩ</p>
                        </div>
                    </div>
                </div>

                {/* User info */}
                <div className="px-4 py-4 border-b border-[hsl(var(--sidebar-border))]">
                    <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-[hsl(var(--sidebar-accent))]">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[hsl(var(--sidebar-primary))] to-[hsl(200,60%,55%)] flex items-center justify-center text-sm font-bold">
                            BS
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate">{user?.TK_SDT ?? '---'}</p>
                            <p className="text-xs text-[hsl(var(--sidebar-foreground))/0.55]">Bác sĩ</p>
                        </div>
                    </div>
                </div>

                {/* Nav links */}
                <nav className="flex-1 px-4 py-4 space-y-1">
                    {sidebarLinks.map(({ label, to, icon: Icon }) => {
                        const active = location.pathname === to;
                        return (
                            <Link
                                key={to}
                                to={to}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                                    active
                                        ? 'bg-[hsl(var(--sidebar-primary))/0.15] text-[hsl(var(--sidebar-primary))] shadow-sm'
                                        : 'text-[hsl(var(--sidebar-foreground))/0.7] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]',
                                )}
                            >
                                <Icon className="w-4.5 h-4.5 shrink-0" />
                                <span className="flex-1">{label}</span>
                                {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                            </Link>
                        );
                    })}
                </nav>

                {/* Logout */}
                <div className="px-4 pb-6">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[hsl(var(--sidebar-foreground))/0.6] hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                        <LogOut className="w-4 h-4 shrink-0" />
                        Đăng xuất
                    </button>
                </div>
            </aside>

            {/* ─── Main content ─────────────────────────────────── */}
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    );
}
