// src/pages/services/GeneralCheckupPage.tsx
import { Link } from 'react-router-dom';
import { ChevronRight, Home, ArrowRight } from 'lucide-react';
import ServiceCard from '@/components/common/ServiceCard';
import { Button } from '@/components/ui/button';

// ─── Breadcrumb ──────────────────────────────────────────────────────────────
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

// ─── Mock data ────────────────────────────────────────────────────────────────
const PACKAGES = [
    {
        id: 1,
        title: 'Gói Cơ Bản',
        price: '1.200.000đ',
        image: 'https://placehold.co/600x400/dbeafe/1e40af?text=Gói+Cơ+Bản',
        description: 'Xét nghiệm máu cơ bản, đo huyết áp, chỉ số BMI, tư vấn bác sĩ.',
    },
    {
        id: 2,
        title: 'Gói Nâng Cao',
        price: '2.200.000đ',
        image: 'https://placehold.co/600x400/e0f2fe/0369a1?text=Gói+Nâng+Cao',
        badge: 'Phổ biến',
        description: 'Toàn bộ gói cơ bản + siêu âm bụng tổng quát, điện tâm đồ.',
    },
    {
        id: 3,
        title: 'Gói VIP Gold',
        price: '4.500.000đ',
        image: 'https://placehold.co/600x400/fef9c3/854d0e?text=Gói+VIP+Gold',
        badge: 'Hot',
        description: 'Kiểm tra toàn diện, tầm soát ung thư cơ bản, nội soi tiêu hóa.',
    },
    {
        id: 4,
        title: 'Gói Platinum',
        price: '8.800.000đ',
        image: 'https://placehold.co/600x400/f3e8ff/7c3aed?text=Gói+Platinum',
        description: 'Tầm soát ung thư toàn diện, MRI/CT, tư vấn chuyên sâu 1-1.',
    },
    {
        id: 5,
        title: 'Gói Gia Đình',
        price: '3.600.000đ',
        image: 'https://placehold.co/600x400/dcfce7/166534?text=Gói+Gia+Đình',
        description: 'Khám sức khỏe cho cặp đôi hoặc cha mẹ + 1 trẻ em.',
    },
    {
        id: 6,
        title: 'Gói Doanh Nghiệp',
        price: 'Liên hệ',
        priceColor: 'red' as const,
        image: 'https://placehold.co/600x400/fee2e2/991b1b?text=Gói+Doanh+Nghiệp',
        description: 'Thiết kế riêng theo nhu cầu doanh nghiệp, hỗ trợ tận nơi.',
    },
];

export default function GeneralCheckupPage() {
    return (
        <div className="bg-gray-50 min-h-screen">
            {/* ── Hero Header ─── */}
            <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white py-14 text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <p className="text-blue-200 text-sm uppercase tracking-[0.2em] font-semibold mb-3">Dịch vụ y tế</p>
                    <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
                        KHÁM SỨC KHỎE TỔNG QUÁT CÁ NHÂN
                    </h1>
                    <div className="w-20 h-1 bg-blue-300 rounded-full mx-auto mt-4" />
                    <p className="text-blue-100 mt-4 text-base max-w-xl mx-auto leading-relaxed">
                        Nắm bắt sức khỏe toàn diện – phát hiện sớm để điều trị kịp thời.
                    </p>
                </div>
            </section>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <Breadcrumb items={[{ label: 'Dịch vụ' }, { label: 'Khám tổng quát' }]} />

                {/* ── Featured Banner ─── */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl overflow-hidden shadow-sm mb-12 flex flex-col md:flex-row">
                    <div className="md:w-5/12 shrink-0">
                        <img
                            src="https://placehold.co/700x420/bfdbfe/1e40af?text=Tầm+Soát+Ung+Thư"
                            alt="Khám tổng quát và tầm soát ung thư"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="flex flex-col justify-center p-8 md:p-10 gap-5">
                        <span className="inline-flex w-fit items-center bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                            Nổi bật
                        </span>
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                            Khám sức khỏe tổng quát &amp; Tầm soát ung thư
                        </h2>
                        <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                            Chương trình tầm soát ung thư toàn diện với trang thiết bị hiện đại bậc nhất, đội ngũ chuyên gia đầu ngành, giúp phát hiện sớm nguy cơ ung thư và bảo vệ sức khỏe lâu dài cho bạn và gia đình.
                        </p>
                        <div>
                            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                                <Link to="#">
                                    Xem chi tiết <ArrowRight className="w-4 h-4 ml-1.5" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── Section Title ─── */}
                <div className="text-center mb-8">
                    <p className="text-blue-600 text-sm font-semibold uppercase tracking-[0.2em] mb-2">Danh mục dịch vụ</p>
                    <h2 className="text-2xl font-bold text-gray-900">CÁC GÓI KHÁM SỨC KHỎE</h2>
                    <div className="w-14 h-1 bg-blue-600 rounded-full mx-auto mt-3" />
                </div>

                {/* ── Grid Packages ─── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {PACKAGES.map((pkg) => (
                        <ServiceCard
                            key={pkg.id}
                            title={pkg.title}
                            price={pkg.price}
                            image={pkg.image}
                            badge={pkg.badge}
                            description={pkg.description}
                            priceColor={pkg.priceColor ?? 'blue'}
                            href="#"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
