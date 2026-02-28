// src/layouts/AuthLayout.tsx
import { Outlet } from 'react-router-dom';
import { Heart } from 'lucide-react';

export default function AuthLayout() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-[hsl(210,80%,97%)] to-[hsl(200,70%,94%)] flex flex-col">
            {/* Minimal header */}
            <header className="p-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[hsl(var(--primary))] rounded-lg flex items-center justify-center shadow-sm">
                        <Heart className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xl font-bold text-[hsl(var(--primary))]">UMC Clinic</span>
                </div>
            </header>

            {/* Page content */}
            <main className="flex-1 flex">
                <Outlet />
            </main>

            {/* Simple footer */}
            <footer className="p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
                © {new Date().getFullYear()} UMC Clinic — Hệ thống đặt lịch khám trực tuyến
            </footer>
        </div>
    );
}
