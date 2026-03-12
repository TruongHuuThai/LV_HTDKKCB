// src/pages/about/WhyChooseUsPage.tsx
import { Link } from 'react-router-dom';
import { ChevronRight, Home, CheckCircle2, ArrowRight, Cpu, GraduationCap, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';

function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
    return (
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-8">
            <Link to="/" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                <Home className="w-3.5 h-3.5" /> Trang chủ
            </Link>
            {items.map((item, i) => (
                <span key={i} className="flex items-center gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                    {item.href
                        ? <Link to={item.href} className="hover:text-blue-600 transition-colors">{item.label}</Link>
                        : <span className="text-gray-800 font-medium">{item.label}</span>
                    }
                </span>
            ))}
        </nav>
    );
}

import { whyChooseUsData } from '@/data/aboutData';

const FEATURES = [
    {
        id: 'thiet-bi',
        icon: Cpu,
        subtitle: 'Công nghệ đỉnh cao',
        points: ['Máy MRI 3.0 Tesla thế hệ mới', 'CT Scan 256 lát cắt', 'Robot phẫu thuật Da Vinci Xi', 'Lab xét nghiệm tự động ISO 15189'],
        imgAlt: 'Thiết bị MRI hiện đại',
        badge: 'Công nghệ tiên tiến',
        badgeColor: 'bg-blue-100 text-blue-700',
    },
    {
        id: 'bac-si',
        icon: GraduationCap,
        subtitle: 'Đội ngũ hàng đầu',
        points: ['Giáo sư, Phó Giáo sư đầu ngành', 'Tu nghiệp quốc tế Mỹ, Pháp, Nhật', 'Liên tục cập nhật phác đồ mới', 'Hội chẩn đa chuyên khoa'],
        imgAlt: 'Bác sĩ chuyên gia',
        badge: 'Đội ngũ xuất sắc',
        badgeColor: 'bg-green-100 text-green-700',
    },
    {
        id: 'dich-vu',
        icon: Award,
        subtitle: 'Tiêu chuẩn JCI',
        points: ['Chứng nhận JCI quốc tế', 'Không gian bệnh viện 5 sao', 'Đặt lịch & tư vấn online 24/7', 'Phiên dịch đa ngôn ngữ'],
        imgAlt: 'Không gian sang trọng',
        badge: 'Chuẩn JCI',
        badgeColor: 'bg-amber-100 text-amber-700',
    },
];

export default function WhyChooseUsPage() {
    return (
        <div className="bg-white">
            {/* ── Header ─── */}
            <section className="bg-gradient-to-br from-blue-700 to-blue-500 text-white py-16 text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <p className="text-blue-200 text-sm uppercase tracking-[0.2em] font-semibold mb-3">Lý do lựa chọn</p>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">TẠI SAO CHỌN CHÚNG TÔI</h1>
                    <p className="text-blue-100 text-lg leading-relaxed">
                        Khám phá những lý do hàng triệu bệnh nhân tin tưởng lựa chọn UMC Clinic trong hành trình chăm sóc sức khỏe.
                    </p>
                </div>
            </section>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <Breadcrumb items={[
                    { label: 'Giới thiệu', href: '/gioi-thieu' },
                    { label: 'Tại sao chọn chúng tôi' },
                ]} />

                {/* ── Zig-Zag Feature List ─── */}
                <div className="space-y-20">
                    {FEATURES.map((f, idx) => {
                        const reverse = idx % 2 === 1;
                        const defaultData = whyChooseUsData.find(item => item.id === f.id) || whyChooseUsData[0];

                        return (
                            <div
                                key={f.id}
                                className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
                            >
                                {/* Image — order changes by reverse */}
                                <div className={`rounded-2xl overflow-hidden shadow-lg ${reverse ? 'lg:order-last' : ''}`}>
                                    <img src={defaultData.imageUrl} alt={f.imgAlt} className="w-full object-cover aspect-[4/3]" />
                                </div>

                                {/* Text */}
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                                            <f.icon className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${f.badgeColor}`}>
                                                {f.badge}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-blue-600 text-sm font-semibold uppercase tracking-wider mb-1">{f.subtitle}</p>
                                        <h2 className="text-2xl font-bold text-gray-900">{defaultData.title}</h2>
                                    </div>
                                    <p className="text-gray-600 leading-relaxed">{defaultData.description}</p>
                                    <ul className="space-y-2.5">
                                        {f.points.map((p) => (
                                            <li key={p} className="flex items-center gap-2.5 text-gray-700">
                                                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                                <span className="text-sm">{p}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 mt-2">
                                        <Link to={defaultData.linkTo}>
                                            Xem chi tiết <ArrowRight className="w-4 h-4 ml-1" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── CTA ─── */}
                <div className="mt-20 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-12 text-center text-white">
                    <h2 className="text-3xl font-bold mb-3">Sẵn sàng trải nghiệm dịch vụ y tế đẳng cấp?</h2>
                    <p className="text-blue-100 mb-8 text-lg">Đặt lịch khám ngay hôm nay — nhanh chóng, dễ dàng và tiện lợi.</p>
                    <Button asChild size="lg" className="bg-white text-blue-700 hover:bg-blue-50 font-bold px-8">
                        <Link to="/booking">Đặt lịch khám ngay</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
