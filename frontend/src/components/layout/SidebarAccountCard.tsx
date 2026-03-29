import { cn } from '@/lib/utils';

interface SidebarAccountCardProps {
    displayName: string;
    roleLabel: string;
    initials: string;
    collapsed?: boolean;
    className?: string;
}

export default function SidebarAccountCard({
    displayName,
    roleLabel,
    initials,
    collapsed = false,
    className,
}: SidebarAccountCardProps) {
    return (
        <div
            className={cn(
                'flex items-center gap-3 px-[var(--sidebar-menu-padding-x)] py-2 rounded-lg transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] overflow-hidden',
                'bg-white/5 border border-white/10',
                className,
            )}
        >
            <div
                className={cn(
                    'w-[var(--sidebar-avatar-size)] h-[var(--sidebar-avatar-size)] rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                    'bg-slate-800 text-slate-100',
                )}
            >
                {initials}
            </div>
            <div
                className={cn(
                    'min-w-0 overflow-hidden transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
                    collapsed ? 'opacity-0 -translate-x-2 pointer-events-none' : 'opacity-100 translate-x-0',
                )}
            >
                <p className="text-sm font-medium truncate text-slate-100">
                    {displayName}
                </p>
                <p
                    className={cn(
                        'text-xs',
                        'text-slate-400',
                    )}
                >
                    {roleLabel}
                </p>
            </div>
        </div>
    );
}
