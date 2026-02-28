// src/pages/ProfilePage.tsx
import { UserCircle } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export default function ProfilePage() {
    const { user } = useAuthStore();

    return (
        <div className="max-w-2xl mx-auto p-8">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(200,80%,55%)] flex items-center justify-center">
                    <UserCircle className="w-9 h-9 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]">Hồ sơ cá nhân</h1>
                    <p className="text-[hsl(var(--muted-foreground))]">{user?.TK_SDT}</p>
                </div>
            </div>
            <div className="rounded-xl border border-[hsl(var(--border))] p-6 bg-[hsl(var(--card))] space-y-4">
                <div className="flex justify-between py-2 border-b border-[hsl(var(--border))]">
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">Số điện thoại</span>
                    <span className="text-sm font-medium">{user?.TK_SDT ?? '---'}</span>
                </div>
                <div className="flex justify-between py-2">
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">Vai trò</span>
                    <span className="text-sm font-medium">{user?.TK_VAI_TRO ?? '---'}</span>
                </div>
            </div>
            <p className="text-[hsl(var(--muted-foreground))] text-sm mt-4 text-center">
                Tính năng chỉnh sửa hồ sơ đang được phát triển.
            </p>
        </div>
    );
}
