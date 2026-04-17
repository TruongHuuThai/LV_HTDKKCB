import type { ElementType } from 'react';
import { Link } from 'react-router-dom';
import { Heart, LogOut, Pin, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import SidebarAccountCard from '@/components/layout/SidebarAccountCard';

type SidebarItem = {
    label: string;
    to: string;
    icon: ElementType;
    exact?: boolean;
};

type SidebarGroup = {
    title: string;
    items: SidebarItem[];
};

interface AppSidebarProps {
    variant: 'admin' | 'doctor';
    brandLabel: string;
    brandTo: string;
    roleLabel: string;
    displayName: string;
    initials: string;
    groups?: SidebarGroup[];
    items?: SidebarItem[];
    activePath: string;
    collapsed: boolean;
    pinned: boolean;
    onTogglePin: () => void;
    onNavigate?: () => void;
    onLogout: () => void;
}

export default function AppSidebar({
    variant,
    brandLabel,
    brandTo,
    roleLabel,
    displayName,
    initials,
    groups,
    items,
    activePath,
    collapsed,
    pinned,
    onTogglePin,
    onNavigate,
    onLogout,
}: AppSidebarProps) {
    const menuGroups = groups ?? (items ? [{ title: 'CHÍNH', items }] : []);
    const isCollapsed = collapsed;
    const isDoctor = variant === 'doctor';
    const roleTag =
        variant === 'admin' ? 'ADMIN PANEL' : 'BÁC SĨ';

    return (
        <div
            className="h-full flex flex-col"
            style={{
                ['--sidebar-icon-size' as never]: '20px',
                ['--sidebar-icon-wrapper' as never]: '40px',
                ['--sidebar-item-height' as never]: '50px',
                ['--sidebar-avatar-size' as never]: '40px',
                ['--sidebar-header-btn' as never]: '40px',
                ['--sidebar-menu-padding-x' as never]: '12px',
                ['--sidebar-menu-gap' as never]: '12px',
            }}
        >
            <div className="px-3 py-4 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-[var(--sidebar-menu-gap)]">
                    <Link to={brandTo} className="flex items-center gap-[var(--sidebar-menu-gap)]">
                        <div className="h-[var(--sidebar-icon-wrapper)] w-[var(--sidebar-icon-wrapper)] rounded-2xl bg-white/10 flex items-center justify-center">
                            <Heart
                                className={cn(
                                    'h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]',
                                    isDoctor ? 'text-cyan-300' : 'text-blue-300',
                                )}
                            />
                        </div>
                        <div
                            className={cn(
                                'min-w-0 overflow-hidden transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                                isCollapsed
                                    ? 'opacity-0 -translate-x-2 pointer-events-none'
                                    : 'opacity-100 translate-x-0',
                            )}
                        >
                            <p className="font-semibold text-base leading-tight text-white">
                                {brandLabel}
                            </p>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                                {roleTag}
                            </p>
                        </div>
                    </Link>
                    <button
                        type="button"
                        onClick={onTogglePin}
                        className={cn(
                            'ml-auto h-[var(--sidebar-header-btn)] w-[var(--sidebar-header-btn)] rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors',
                            isCollapsed ? '' : 'bg-white/5',
                        )}
                        aria-label={pinned ? 'Thu nhỏ sidebar' : 'Ghim sidebar'}
                    >
                        {pinned ? (
                            <PinOff className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
                        ) : (
                            <Pin className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
                        )}
                    </button>
                </div>
            </div>

            <div className="px-3 py-4 border-b border-white/10">
                <SidebarAccountCard
                    displayName={displayName}
                    roleLabel={roleLabel}
                    initials={initials}
                    collapsed={isCollapsed}
                />
                <button
                    onClick={onLogout}
                    className={cn(
                        'mt-3 flex items-center gap-[var(--sidebar-menu-gap)] w-full h-[var(--sidebar-item-height)] px-[var(--sidebar-menu-padding-x)] rounded-lg text-sm font-medium transition-colors overflow-hidden',
                        'text-slate-300 hover:bg-rose-500/10 hover:text-rose-200',
                    )}
                    title={isCollapsed ? 'Đăng xuất' : undefined}
                >
                    <span className="flex h-[var(--sidebar-icon-wrapper)] w-[var(--sidebar-icon-wrapper)] items-center justify-center shrink-0">
                        <LogOut className="h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)]" />
                    </span>
                    <span
                        className={cn(
                            'min-w-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                            isCollapsed
                                ? 'opacity-0 -translate-x-2 pointer-events-none'
                                : 'opacity-100 translate-x-0',
                        )}
                    >
                        Đăng xuất
                    </span>
                </button>
            </div>

            <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-5">
                {menuGroups.map((group, idx) => (
                    <div key={`${group.title}-${idx}`}>
                        <p
                            className={cn(
                                'px-[var(--sidebar-menu-padding-x)] text-[11px] font-semibold uppercase tracking-[0.2em] mb-2 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                                isDoctor ? 'text-cyan-300/70' : 'text-slate-500',
                                isCollapsed
                                    ? 'opacity-0 -translate-x-2 pointer-events-none'
                                    : 'opacity-100 translate-x-0',
                            )}
                        >
                            {group.title}
                        </p>
                        <div className="space-y-1">
                            {group.items.map(({ label, to, icon: Icon, exact }) => {
                                const active = exact
                                    ? activePath === to
                                    : activePath.startsWith(to);
                                return (
                                    <Link
                                        key={to}
                                        to={to}
                                        onClick={onNavigate}
                                        className={cn(
                                            'group relative flex items-center gap-[var(--sidebar-menu-gap)] rounded-xl h-[var(--sidebar-item-height)] px-[var(--sidebar-menu-padding-x)] text-sm transition-colors duration-150 overflow-hidden',
                                            active && !isDoctor
                                                ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                                                : '',
                                            !active && !isDoctor
                                                ? 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                                                : '',
                                            active && isDoctor
                                                ? 'bg-gradient-to-r from-blue-500/20 to-cyan-400/10 text-white shadow-[inset_0_0_0_1px_rgba(125,211,252,0.35)]'
                                                : '',
                                            !active && isDoctor
                                                ? 'text-slate-300 hover:bg-cyan-400/10 hover:text-cyan-100'
                                                : '',
                                        )}
                                        title={isCollapsed ? label : undefined}
                                    >
                                        <span className="flex h-[var(--sidebar-icon-wrapper)] w-[var(--sidebar-icon-wrapper)] items-center justify-center shrink-0">
                                            <Icon
                                                className={cn(
                                                    'h-[var(--sidebar-icon-size)] w-[var(--sidebar-icon-size)] transition-colors duration-300',
                                                    active
                                                        ? (isDoctor ? 'text-cyan-300' : 'text-blue-300')
                                                        : (isDoctor ? 'text-slate-300 group-hover:text-cyan-200' : 'text-slate-400'),
                                                )}
                                            />
                                        </span>
                                        <span
                                            className={cn(
                                                'flex-1 min-w-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                                                isCollapsed
                                                    ? 'opacity-0 -translate-x-2 pointer-events-none'
                                                    : 'opacity-100 translate-x-0',
                                            )}
                                        >
                                            {label}
                                        </span>
                                        {isCollapsed ? (
                                            <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs text-slate-100 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                                {label}
                                            </span>
                                        ) : null}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>
        </div>
    );
}

