// src/pages/HomePage.tsx
import { Link } from 'react-router-dom';
import { Calendar, Clock, Star, Shield, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
    { icon: Calendar, label: 'Đặt lịch 24/7', desc: 'Đặt lịch bất kỳ lúc nào, không cần xếp hàng' },
    { icon: Clock, label: 'Tiết kiệm thời gian', desc: 'Xác nhận lịch tức thì qua SMS và email' },
    { icon: Star, label: 'Bác sĩ chuyên khoa', desc: 'Đội ngũ bác sĩ giàu kinh nghiệm, tận tâm' },
    { icon: Shield, label: 'Bảo mật thông tin', desc: 'Hồ sơ bệnh án được bảo mật tuyệt đối' },
];

export default function HomePage() {
    return (
        <div>
            {/* Hero section */}
            <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(210,90%,40%)] via-[hsl(205,85%,45%)] to-[hsl(195,80%,50%)] text-white">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDE4aDExdjNoLTExek0zNiAyNGgxMXYzaC0xMXpNMzYgMzBoMTF2M2gtMTF6TTQgMThoMTF2M0g0ek00IDI0aDExdjNINHpNNCAzMGgxMXYzSDR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
                <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm mb-6">
                            <CheckCircle2 className="w-4 h-4 text-green-300" />
                            Bệnh viện được chứng nhận tiêu chuẩn JCI
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                            Đặt lịch khám <br />
                            <span className="text-[hsl(195,100%,85%)]">nhanh chóng</span> và<br />
                            tiện lợi
                        </h1>
                        <p className="text-lg text-white/80 mb-8 leading-relaxed">
                            Hệ thống đặt lịch khám chữa bệnh trực tuyến UMC Clinic — kết nối bạn với đội ngũ
                            bác sĩ chuyên khoa hàng đầu chỉ trong vài bước đơn giản.
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <Button size="lg" className="bg-white text-[hsl(var(--primary))] border border-white shadow-lg hover:bg-white/20 hover:text-white hover:border-white hover:scale-[1.03] transition-all duration-200" asChild>
                                <Link to="/booking">
                                    <Calendar className="w-5 h-5 mr-2" />
                                    Đặt lịch ngay
                                </Link>
                            </Button>
                            <Button size="lg" className="bg-white text-[hsl(var(--primary))] border border-white shadow-lg hover:bg-white/20 hover:text-white hover:border-white hover:scale-[1.03] transition-all duration-200" asChild>
                                <Link to="/doctors">
                                    Xem bác sĩ <ArrowRight className="w-4 h-4 ml-1" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
                {/* Wave decoration */}
                <div className="absolute bottom-0 left-0 right-0">
                    <svg viewBox="0 0 1440 60" className="fill-[hsl(210,30%,97%)]">
                        <path d="M0,60 C360,0 1080,0 1440,60 L1440,60 L0,60 Z" />
                    </svg>
                </div>
            </section>

            {/* Features */}
            <section className="py-20 bg-[hsl(210,30%,97%)]">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-3">Tại sao chọn UMC?</h2>
                        <p className="text-[hsl(var(--muted-foreground))] max-w-xl mx-auto">
                            Chúng tôi cam kết mang đến trải nghiệm chăm sóc sức khỏe tốt nhất cho bạn
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map(({ icon: Icon, label, desc }) => (
                            <div
                                key={label}
                                className="bg-white rounded-2xl p-6 shadow-sm border border-[hsl(var(--border))] hover:shadow-md hover:-translate-y-1 transition-all duration-300"
                            >
                                <div className="w-12 h-12 bg-[hsl(var(--accent))] rounded-xl flex items-center justify-center mb-4">
                                    <Icon className="w-6 h-6 text-[hsl(var(--primary))]" />
                                </div>
                                <h3 className="font-semibold text-[hsl(var(--foreground))] mb-2">{label}</h3>
                                <p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
