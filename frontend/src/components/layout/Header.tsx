// src/components/layout/Header.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Heart, Menu, ChevronDown, LogOut, User,
    Stethoscope, Calendar, Phone, Home, Info,
    Briefcase, Newspaper, BookOpen, AlertCircle
} from 'lucide-react';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { authService } from '@/services/authService';
import { useSpecialties } from '@/hooks/useSpecialties';
import { cn, toSlug } from '@/lib/utils';
import { SERVICES } from '@/data/servicesData';
import { SPECIALTIES_DATA } from '@/data/specialtiesData';

// ─── Mock fallback khi DB chưa có dữ liệu ──────────────────────────────────
const MOCK_SPECIALTIES = [
    { CK_MA: 0, CK_TEN: 'Nội tổng quát' },
    { CK_MA: 0, CK_TEN: 'Ngoại tổng quát' },
    { CK_MA: 0, CK_TEN: 'Tim mạch' },
    { CK_MA: 0, CK_TEN: 'Thần kinh' },
    { CK_MA: 0, CK_TEN: 'Da liễu' },
    { CK_MA: 0, CK_TEN: 'Nhi khoa' },
];

// ─── Cấu hình menu chính ────────────────────────────────────────────────────
type MenuItem = { title: string; href: string; desc: string };
type MenuGroup = { id: string; label: string; icon: React.ElementType; items: MenuItem[] };

const MENU_GROUPS: MenuGroup[] = [
    {
        id: 'gioi-thieu',
        label: 'Giới thiệu',
        icon: Info,
        items: [
            { title: 'Về chúng tôi', href: '/gioi-thieu/ve-chung-toi', desc: 'Lịch sử hình thành và sứ mệnh UMC' },
            { title: 'Tại sao chọn chúng tôi', href: '/gioi-thieu/tai-sao-chon-chung-toi', desc: 'Lý do hàng triệu bệnh nhân tin tưởng' },
            { title: 'Cơ sở vật chất', href: '/gioi-thieu/co-so-vat-chat', desc: 'Trang thiết bị y tế hiện đại hàng đầu' },
        ],
    },
    {
        id: 'dich-vu',
        label: 'Dịch vụ',
        icon: Briefcase,
        // Dynamically built from SERVICES data
        items: SERVICES.map((s) => ({
            title: s.title,
            href: `/dich-vu/${s.id}`,
            desc: s.shortDesc,
        })),
    },
    {
        id: 'tin-tuc',
        label: 'Tin tức',
        icon: Newspaper,
        items: [
            { title: 'Y học thường thức', href: '/tin-tuc/y-hoc-thuong-thuc', desc: 'Kiến thức y tế hữu ích cho sức khỏe hàng ngày' },
            { title: 'Tin tức sự kiện', href: '/tin-tuc/tin-tuc-su-kien', desc: 'Tin tức, sự kiện mới nhất từ UMC Clinic' },
            { title: 'Hỏi đáp y khoa', href: '/tin-tuc/hoi-dap-y-khoa', desc: 'Bác sĩ giải đáp các thắc mắc y tế thường gặp' },
        ],
    },
    {
        id: 'huong-dan',
        label: 'Hướng dẫn',
        icon: BookOpen,
        items: [
            { title: 'Quy trình đặt lịch', href: '/huong-dan/quy-trinh-dat-lich', desc: 'Hướng dẫn từng bước đặt lịch khám trực tuyến' },
            { title: 'Chuẩn bị khám', href: '/huong-dan/chuan-bi-kham', desc: 'Giấy tờ và lưu ý trước khi đến khám' },
            { title: 'Thanh toán và bảo hiểm', href: '/huong-dan/thanh-toan-va-bao-hiem', desc: 'Hình thức thanh toán và quyền lợi BHYT' },
        ],
    },
];

// ─── HoverDropdown — mỗi menu item tự quản lý position ─────────────────────
function HoverDropdown({ group }: { group: MenuGroup }) {
    const [open, setOpen] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const show = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setOpen(true);
    };
    const hide = () => {
        timerRef.current = setTimeout(() => setOpen(false), 120);
    };

    return (
        <div
            className="relative"
            onMouseEnter={show}
            onMouseLeave={hide}
        >
            <button
                className={cn(
                    'flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                    open
                        ? 'bg-blue-700 text-white'
                        : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700',
                )}
            >
                {group.label}
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', open && 'rotate-180')} />
            </button>

            {open && (
                <div
                    className="absolute left-0 top-full pt-2 z-[60] min-w-[240px]"
                    onMouseEnter={show}
                    onMouseLeave={hide}
                >
                    <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl shadow-blue-500/15 border border-blue-100 overflow-hidden">
                        <div className="overflow-y-auto max-h-[70vh]">
                            {group.items.map((item) => (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    onClick={() => setOpen(false)}
                                    className="flex flex-col px-4 py-3 hover:bg-blue-50 transition-colors group border-b border-blue-50 last:border-0"
                                >
                                    <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
                                        {item.title}
                                    </span>
                                    <span className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                                        {item.desc}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── SpecialtiesDropdown — real API data, slug-based links ───────────────────
function SpecialtiesDropdown() {
    const [open, setOpen] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { data: specialties, isLoading, isError } = useSpecialties();

    const show = () => { if (timerRef.current) clearTimeout(timerRef.current); setOpen(true); };
    const hide = () => { timerRef.current = setTimeout(() => setOpen(false), 120); };

    // Use API data; fall back to SPECIALTIES_DATA names when API empty
    const items = useMemo(() => {
        if (specialties && specialties.length > 0) {
            return specialties.map((ck) => ({
                key: String(ck.CK_MA),
                name: ck.CK_TEN,
                slug: toSlug(ck.CK_TEN),
            }));
        }
        return SPECIALTIES_DATA.map((s) => ({ key: s.id, name: s.name, slug: s.slug }));
    }, [specialties]);

    return (
        <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
            <button
                className={cn(
                    'flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                    open ? 'bg-blue-700 text-white' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700',
                )}
            >
                Chuyên khoa
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', open && 'rotate-180')} />
            </button>

            {open && (
                <div
                    className="absolute left-0 top-full pt-2 z-[60] w-[480px]"
                    onMouseEnter={show}
                    onMouseLeave={hide}
                >
                    <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl shadow-blue-500/15 border border-blue-100 overflow-hidden">
                        {/* Header */}
                        <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-blue-100/60 border-b border-blue-100 flex items-center justify-between">
                            <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider">
                                Danh mục chuyên khoa
                            </span>
                            {isError && (
                                <span className="text-[10px] text-gray-400">Dữ liệu mẫu</span>
                            )}
                        </div>

                        {/* Content */}
                        <div className="p-3">
                            {isLoading ? (
                                <div className="grid grid-cols-2 gap-1.5">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg animate-pulse">
                                            <div className="w-6 h-6 rounded-md bg-blue-100" />
                                            <div className="h-3 bg-blue-100 rounded flex-1" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <ul className="grid grid-cols-2 gap-1">
                                    {items.map((item) => (
                                        <li key={item.key}>
                                            <Link
                                                to={`/chuyen-khoa/${item.slug}`}
                                                onClick={() => setOpen(false)}
                                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors group"
                                            >
                                                <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                                                    <Stethoscope className="w-3.5 h-3.5 text-blue-500" />
                                                </div>
                                                <span className="text-sm text-gray-700 group-hover:text-blue-700 truncate font-medium">
                                                    {item.name}
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-blue-100/60 border-t border-blue-100">
                            <Link
                                to="/chuyen-khoa"
                                onClick={() => setOpen(false)}
                                className="flex items-center justify-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-semibold transition-colors"
                            >
                                Xem tất cả chuyên khoa →
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}



// ─── DoctorsDropdown — dynamic by specialty from API ─────────────────────────
function DoctorsDropdown() {
    const [open, setOpen] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const { data: specialties, isLoading } = useSpecialties();

    const show = () => { if (timerRef.current) clearTimeout(timerRef.current); setOpen(true); };
    const hide = () => { timerRef.current = setTimeout(() => setOpen(false), 120); };

    // Convert API specialties to slug-form, fall back to MOCK_SPECIALTIES
    const items = (() => {
        const src = (specialties && specialties.length > 0) ? specialties : MOCK_SPECIALTIES;
        return src.map((ck) => ({
            id: ck.CK_MA,
            name: ck.CK_TEN,
            slug: ck.CK_TEN
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/đ/g, 'd')
                .replace(/\s+/g, '-'),
        }));
    })();

    return (
        <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
            <button
                className={cn(
                    'flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                    open ? 'bg-blue-700 text-white' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700',
                )}
            >
                Đội ngũ bác sĩ
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', open && 'rotate-180')} />
            </button>

            {open && (
                <div
                    className="absolute left-0 top-full pt-2 z-[60] w-[400px]"
                    onMouseEnter={show}
                    onMouseLeave={hide}
                >
                    <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-xl shadow-blue-500/15 border border-blue-100 overflow-hidden">
                        {/* Header */}
                        <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-blue-100/60 border-b border-blue-100 flex items-center justify-between">
                            <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Theo chuyên khoa</span>
                        </div>

                        {/* All doctors link */}
                        <Link
                            to="/doi-ngu-bac-si"
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-3 hover:bg-blue-50 transition-colors border-b border-blue-100 group"
                        >
                            <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                                <User className="w-3.5 h-3.5 text-blue-500" />
                            </div>
                            <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">Tất cả bác sĩ</span>
                        </Link>

                        {/* Specialty list */}
                        <div className="overflow-y-auto max-h-[60vh]">
                            {isLoading ? (
                                <div className="grid grid-cols-2 gap-1.5 p-3">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg animate-pulse">
                                            <div className="w-6 h-6 rounded-md bg-blue-100" />
                                            <div className="h-3 bg-blue-100 rounded flex-1" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <ul className="grid grid-cols-2 gap-1 p-3">
                                    {items.map((item, i) => (
                                        <li key={item.id || i}>
                                            <Link
                                                to={`/doi-ngu-bac-si/${item.slug}`}
                                                onClick={() => setOpen(false)}
                                                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors group"
                                            >
                                                <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                                                    <Stethoscope className="w-3.5 h-3.5 text-blue-500" />
                                                </div>
                                                <span className="text-sm text-gray-700 group-hover:text-blue-700 truncate font-medium">{item.name}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-blue-100/60 border-t border-blue-100">
                            <Link
                                to="/doi-ngu-bac-si"
                                onClick={() => setOpen(false)}
                                className="flex items-center justify-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-semibold transition-colors"
                            >
                                Xem tất cả bác sĩ →
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Header Component ───────────────────────────────────────────────────
export default function Header() {
    const { user, token, refreshToken, clearAuth } = useAuthStore();
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const handleLogout = async () => {
        try { if (refreshToken) await authService.logout(refreshToken); }
        finally { clearAuth(); navigate('/login'); }
    };

    return (
        <header
            className={cn(
                'sticky top-0 z-50 w-full bg-white border-b border-gray-200 transition-shadow duration-300',
                scrolled && 'shadow-md',
            )}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-16 items-center gap-6">

                    {/* ── Logo ─────────────────────────────── */}
                    <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-400 rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                            <Heart className="w-5 h-5 text-white" />
                        </div>
                        <div className="hidden sm:block leading-tight">
                            <span className="text-lg font-bold text-blue-700">UMC</span>
                            <span className="text-lg font-light text-gray-600"> Clinic</span>
                        </div>
                    </Link>

                    {/* ── Desktop Nav ──────────────────────── */}
                    <nav className="hidden lg:flex flex-1 items-center gap-0.5">
                        {MENU_GROUPS.map((group) => (
                            <HoverDropdown key={group.id} group={group} />
                        ))}
                        <DoctorsDropdown />
                        <SpecialtiesDropdown />
                        {/* Liên hệ — link đơn, không dropdown */}
                        <Link
                            to="/lien-he"
                            className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors whitespace-nowrap"
                        >
                            <Phone className="w-3.5 h-3.5" />
                            Liên hệ
                        </Link>
                    </nav>

                    {/* ── Desktop Right ─────────────────────── */}
                    <div className="hidden lg:flex items-center gap-2 ml-auto shrink-0">
                        {token && user ? (
                            <>
                                <Link
                                    to="/profile"
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 text-sm text-gray-700 transition-colors"
                                >
                                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                                        <User className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="font-medium max-w-[100px] truncate">{user.TK_SDT}</span>
                                </Link>
                                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-red-500 px-2">
                                    <LogOut className="w-4 h-4" />
                                </Button>
                            </>
                        ) : (
                            <Button variant="ghost" size="sm" asChild className="text-gray-600">
                                <Link to="/login">Đăng nhập</Link>
                            </Button>
                        )}
                        <Link
                            to="/booking"
                            className="inline-flex items-center gap-1.5 h-8 px-3 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors whitespace-nowrap"
                        >
                            <Calendar className="w-4 h-4" />
                            Đặt lịch ngay
                        </Link>
                    </div>

                    {/* ── Mobile ────────────────────────────── */}
                    <div className="flex lg:hidden items-center gap-2 ml-auto">
                        <Link
                            to="/booking"
                            className="inline-flex items-center h-8 px-3 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
                        >
                            Đặt lịch
                        </Link>
                        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                            <SheetTrigger asChild>
                                <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Menu">
                                    <Menu className="w-5 h-5 text-gray-700" />
                                </button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[280px] sm:max-w-[280px] p-0">
                                <SheetHeader className="px-5 py-4 border-b bg-blue-700">
                                    <SheetTitle className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                            <Heart className="w-4 h-4 text-white" />
                                        </div>
                                        <span className="font-bold text-white">UMC Clinic</span>
                                    </SheetTitle>
                                </SheetHeader>

                                <nav className="flex flex-col px-3 py-4 gap-0.5 overflow-y-auto max-h-[calc(100dvh-70px)]">
                                    {[
                                        { label: 'Trang chủ', href: '/', icon: Home },
                                        { label: 'Giới thiệu', href: '/gioi-thieu', icon: Info },
                                        { label: 'Đội ngũ bác sĩ', href: '/doctors', icon: User },
                                        { label: 'Tin tức', href: '/tin-tuc', icon: Newspaper },
                                        { label: 'Liên hệ', href: '/lien-he', icon: Phone },
                                    ].map(({ label, href, icon: Icon }) => (
                                        <Link
                                            key={href}
                                            to={href}
                                            onClick={() => setMobileOpen(false)}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                        >
                                            <Icon className="w-4 h-4 shrink-0" />
                                            {label}
                                        </Link>
                                    ))}

                                    {/* Chuyên khoa mobile */}
                                    <MobileSpecialties onNavigate={() => setMobileOpen(false)} />

                                    {/* Auth */}
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                        {token && user ? (
                                            <>
                                                <Link
                                                    to="/profile"
                                                    onClick={() => setMobileOpen(false)}
                                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 mb-1"
                                                >
                                                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                                                        <User className="w-4 h-4 text-white" />
                                                    </div>
                                                    <span className="truncate">{user.TK_SDT}</span>
                                                </Link>
                                                <button
                                                    onClick={() => { setMobileOpen(false); handleLogout(); }}
                                                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50"
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                    Đăng xuất
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex flex-col gap-2 px-1">
                                                <Button variant="outline" size="sm" asChild className="w-full">
                                                    <Link to="/login" onClick={() => setMobileOpen(false)}>Đăng nhập</Link>
                                                </Button>
                                                <Button size="sm" asChild className="w-full bg-blue-600 hover:bg-blue-700">
                                                    <Link to="/register" onClick={() => setMobileOpen(false)}>Đăng ký</Link>
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </nav>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
        </header>
    );
}

// ─── Mobile Specialties section ──────────────────────────────────────────────
function MobileSpecialties({ onNavigate }: { onNavigate: () => void }) {
    return (
        <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="px-3 text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Chuyên khoa</p>
            <div className="space-y-0.5">
                {SPECIALTIES_DATA.map((sp) => (
                    <Link
                        key={sp.id}
                        to={`/chuyen-khoa/${sp.slug}`}
                        onClick={onNavigate}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                    >
                        <Stethoscope className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                        {sp.name}
                    </Link>
                ))}
            </div>
        </div>
    );
}
