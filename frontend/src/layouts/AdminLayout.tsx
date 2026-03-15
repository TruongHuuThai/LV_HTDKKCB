// src/layouts/AdminLayout.tsx
import { useState } from 'react';
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
    Menu,
    Globe,
    FileText,
    Building2,
    MessageSquare,
    UserCircle,
    PackageSearch,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authService } from '@/services/authService';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const sidebarGroups = [
    {
        title: 'Chính',
        items: [
            { label: 'Tổng quan', to: '/admin/dashboard', icon: LayoutDashboard },
        ],
    },
    {
        title: 'Quản lý Web',
        items: [
            { label: 'Dịch vụ', to: '/admin/services', icon: PackageSearch },
            { label: 'Chuyên khoa', to: '/admin/specialties', icon: BookOpen },
            { label: 'Đội ngũ Bác sĩ', to: '/admin/doctors', icon: Stethoscope },
            { label: 'Tin tức & Hướng dẫn', to: '/admin/news', icon: FileText },
            { label: 'Cơ sở vật chất', to: '/admin/facilities', icon: Building2 },
        ],
    },
    {
        title: 'Vận hành',
        items: [
            { label: 'Bệnh nhân', to: '/admin/patients', icon: Users },
            { label: 'Khách hàng Liên hệ', to: '/admin/contacts', icon: MessageSquare },
        ],
    },
    {
        title: 'Hệ thống',
        items: [
            { label: 'Tài khoản & Phân quyền', to: '/admin/accounts', icon: UserCircle },
            { label: 'Cài đặt Web', to: '/admin/settings', icon: Settings },
        ],
    },
];

export default function AdminLayout() {
    const { user, refreshToken, clearAuth } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = async () => {
        try {
            if (refreshToken) await authService.logout(refreshToken);
        } finally {
            clearAuth();
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen flex bg-gray-50">
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 flex flex-col shadow-xl transition-transform duration-300 md:translate-x-0 md:static',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                <div className="px-6 py-5 border-b border-white/10 shrink-0">
                    <Link to="/admin/dashboard" className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
                            <Heart className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="font-bold text-base leading-tight">UMC Clinic</p>
                            <div className="flex items-center gap-1 mt-0.5">
                                <ShieldCheck className="w-3 h-3 text-amber-400" />
                                <p className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Admin Panel</p>
                            </div>
                        </div>
                    </Link>
                </div>

                <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                    {sidebarGroups.map((group, idx) => (
                        <div key={idx}>
                            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                {group.title}
                            </p>
                            <div className="space-y-1">
                                {group.items.map(({ label, to, icon: Icon }) => {
                                    const active = location.pathname.startsWith(to);
                                    return (
                                        <Link
                                            key={to}
                                            to={to}
                                            onClick={() => setSidebarOpen(false)}
                                            className={cn(
                                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                                                active
                                                    ? 'bg-blue-600/10 text-blue-400 font-medium'
                                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                                            )}
                                        >
                                            <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-blue-400' : 'text-slate-400')} />
                                            <span className="flex-1">{label}</span>
                                            {active && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>

            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
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

                        <div className="w-px h-6 bg-gray-200" />

                        <DropdownMenu>
                            <DropdownMenuTrigger className="flex items-center gap-2 focus:outline-none">
                                <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-sm font-bold text-blue-700">
                                    AD
                                </div>
                                <div className="hidden md:block text-left">
                                    <p className="text-sm font-medium text-gray-700 leading-tight">
                                        {user?.TK_SDT ?? 'Admin'}
                                    </p>
                                    <p className="text-xs text-gray-500">Quản trị viên</p>
                                </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Tài khoản của tôi</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={handleLogout}
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer text-sm"
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Đăng xuất
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                <main className="flex-1 overflow-auto p-4 md:p-6 pb-20">
                    <div className="mx-auto max-w-6xl">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
