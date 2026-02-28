// src/layouts/AdminLayout.tsx
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    Heart,
    LayoutDashboard,
    Users,
    Stethoscope,
    BookOpen,
    Settings,
    LogOut,
    ChevronRight,
    ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authService } from '@/services/authService';
import { cn } from '@/lib/utils';

const sidebarLinks = [
    { label: 'Tổng quan', to: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Quản lý bác sĩ', to: '/admin/doctors', icon: Stethoscope },
    { label: 'Quản lý bệnh nhân', to: '/admin/patients', icon: Users },
    { label: 'Danh mục chuyên khoa', to: '/admin/specialties', icon: BookOpen },
    { label: 'Cài đặt hệ thống', to: '/admin/settings', icon: Settings },
];

export default function AdminLayout() {
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
            <aside className="w-64 min-h-screen bg-gradient-to-b from-[hsl(220,60%,15%)] to-[hsl(210,55%,20%)] text-white flex flex-col shadow-xl">
                {/* Logo */}
                <div className="px-6 py-5 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                            <Heart className="w-5 h-5 text-[hsl(200,80%,75%)]" />
                        </div>
                        <div>
                            <p className="font-bold text-base leading-tight">UMC Clinic</p>
                            <div className="flex items-center gap-1 mt-0.5">
                                <ShieldCheck className="w-2.5 h-2.5 text-amber-400" />
                                <p className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Admin Panel</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Admin user info */}
                <div className="px-4 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-white/5">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-sm font-bold text-white">
                            AD
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate">{user?.TK_SDT ?? '---'}</p>
                            <p className="text-xs text-white/50">Quản trị viên</p>
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
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                                    active
                                        ? 'bg-white/10 text-white shadow-sm border border-white/10'
                                        : 'text-white/60 hover:bg-white/8 hover:text-white',
                                )}
                            >
                                <Icon className="w-4 h-4 shrink-0" />
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
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:bg-red-500/20 hover:text-red-300 transition-colors"
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
