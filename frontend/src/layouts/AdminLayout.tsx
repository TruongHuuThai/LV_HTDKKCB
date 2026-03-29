// src/layouts/AdminLayout.tsx
import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Stethoscope,
    BookOpen,
    Settings,
    ChevronRight,
    Menu,
    Globe,
    FileText,
    Building2,
    MessageSquare,
    UserCircle,
    PackageSearch,
    CalendarClock,
    Pill,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authService } from '@/services/authService';
import { cn } from '@/lib/utils';
import AppSidebar from '@/components/layout/AppSidebar';

const sidebarGroups = [
    {
        title: 'CHÍNH',
        items: [
            { label: 'Tổng quan', to: '/admin/dashboard', icon: LayoutDashboard },
        ],
    },
    {
        title: 'QUẢN LÝ WEB',
        items: [
            { label: 'Dịch vụ', to: '/admin/services', icon: PackageSearch },
            { label: 'Thuốc', to: '/admin/medicines', icon: Pill },
            { label: 'Chuyên khoa', to: '/admin/specialties', icon: BookOpen },
            { label: 'Đội ngũ bác sĩ', to: '/admin/doctors', icon: Stethoscope },
            { label: 'Tin tức & Hướng dẫn', to: '/admin/news', icon: FileText },
            { label: 'Cơ sở vật chất', to: '/admin/facilities', icon: Building2 },
        ],
    },
    {
        title: 'VẬN HÀNH',
        items: [
            { label: 'Bệnh nhân', to: '/admin/patients', icon: Users },
            { label: 'Lịch trực bác sĩ', to: '/admin/schedules', icon: CalendarClock },
            { label: 'Khách hàng liên hệ', to: '/admin/contacts', icon: MessageSquare },
        ],
    },
    {
        title: 'HỆ THỐNG',
        items: [
            { label: 'Tài khoản & Phân quyền', to: '/admin/accounts', icon: UserCircle },
            { label: 'Cài đặt web', to: '/admin/settings', icon: Settings },
        ],
    },
];

export default function AdminLayout() {
    const { user, refreshToken, clearAuth } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const adminDisplayName =
        user?.TEN_HIEN_THI?.trim() || user?.TK_SDT || 'Quản trị hệ thống';
    const collapsed = !isPinned && !isHovering;

    useEffect(() => {
        const stored = localStorage.getItem('admin-sidebar-pinned');
        if (stored) setIsPinned(stored === '1');
    }, []);

    useEffect(() => {
        localStorage.setItem('admin-sidebar-pinned', isPinned ? '1' : '0');
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
            className="relative h-screen overflow-hidden bg-gray-50"
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
                        variant="admin"
                        brandLabel="UMC Clinic"
                        brandTo="/admin/dashboard"
                        roleLabel="Quản trị viên"
                        displayName={adminDisplayName}
                        initials="AD"
                        groups={sidebarGroups}
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
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-10 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button
                            className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        <div className="hidden sm:flex items-center text-sm font-medium text-gray-500">
                            UMC Administration
                            <ChevronRight className="w-4 h-4 mx-2" />
                            <span className="text-gray-900 capitalize">
                                {location.pathname.split('/').pop() || 'Dashboard'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 md:gap-5">
                        <Link
                            to="/"
                            target="_blank"
                            className="text-sm font-medium text-gray-600 hover:text-blue-600 flex items-center gap-1.5 transition-colors"
                        >
                            <Globe className="w-4 h-4" />
                            <span className="hidden sm:inline">Xem trang web</span>
                        </Link>
                    </div>
                </header>

                <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
                    <div className="mx-auto max-w-screen-2xl">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

