// src/pages/NotFoundPage.tsx
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[hsl(210,30%,97%)] text-center px-4">
            <p className="text-8xl font-bold text-[hsl(var(--primary))] opacity-20 mb-4">404</p>
            <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] mb-2">Trang không tìm thấy</h1>
            <p className="text-[hsl(var(--muted-foreground))] mb-8">
                Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển.
            </p>
            <Button asChild>
                <Link to="/"><Home className="w-4 h-4 mr-2" /> Về trang chủ</Link>
            </Button>
        </div>
    );
}
