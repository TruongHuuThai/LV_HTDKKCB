// src/layouts/PatientLayout.tsx
import { Outlet } from 'react-router-dom';
import { Heart } from 'lucide-react';
import Header from '@/components/layout/Header';

export default function PatientLayout() {
    return (
        <div className="min-h-screen flex flex-col bg-[hsl(var(--background))]">
            {/* ─── Header (Sticky, NavigationMenu) ──────────────── */}
            <Header />

            {/* ─── Page Content ─────────────────────────────────── */}
            <main className="flex-1">
                <Outlet />
            </main>

            {/* ─── Footer ───────────────────────────────────────── */}
            <footer className="bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))] mt-auto">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-8 h-8 bg-[hsl(var(--sidebar-primary))/0.2] rounded-lg flex items-center justify-center">
                                    <Heart className="w-4 h-4 text-[hsl(var(--sidebar-primary))]" />
                                </div>
                                <span className="font-bold text-lg">UMC Clinic</span>
                            </div>
                            <p className="text-sm text-[hsl(var(--sidebar-foreground))/0.6] leading-relaxed">
                                Hệ thống đặt lịch khám chữa bệnh trực tuyến hiện đại, an toàn và tiện lợi.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-3 text-[hsl(var(--sidebar-primary))]">Dịch vụ</h4>
                            <ul className="space-y-2 text-sm text-[hsl(var(--sidebar-foreground))/0.7]">
                                <li>Đặt lịch khám tổng quát</li>
                                <li>Khám chuyên khoa</li>
                                <li>Xem kết quả xét nghiệm</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-3 text-[hsl(var(--sidebar-primary))]">Liên hệ</h4>
                            <ul className="space-y-2 text-sm text-[hsl(var(--sidebar-foreground))/0.7]">
                                <li>📍 3/2 Xuân Khánh, Ninh Kiều, Cần Thơ, Vietnam</li>
                                <li>📞 (084) 867 504 590</li>
                                <li>✉️ thaib2203469@student.ctu.edu.vn</li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-[hsl(var(--sidebar-border))] text-center text-xs text-[hsl(var(--sidebar-foreground))/0.5]">
                        © {new Date().getFullYear()} UMC Clinic. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}
