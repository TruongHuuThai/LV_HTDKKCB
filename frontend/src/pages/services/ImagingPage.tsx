// src/pages/services/ImagingPage.tsx
import { Link } from 'react-router-dom';
import { ChevronRight, Home, ArrowRight } from 'lucide-react';
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
                        : <span className="text-gray-800 font-medium">{item.label}</span>}
                </span>
            ))}
        </nav>
    );
}

interface ImagingService {
    id: number;
    title: string;
    subtitle: string;
    description: string;
    features: string[];
    image: string;
    imageAlt: string;
    tag: string;
    tagColor: string;
}

const IMAGING_SERVICES: ImagingService[] = [
    {
        id: 1,
        title: 'Chụp X-Quang Kỹ thuật số',
        subtitle: 'Digital Radiography (DR)',
        description:
            'Hệ thống X-Quang kỹ thuật số tiên tiến với liều bức xạ tối thiểu, cho ra hình ảnh độ phân giải cao ngay lập tức. Thích hợp cho chẩn đoán phổi, xương khớp, cột sống và nhiều cơ quan khác.',
        features: ['Liều bức xạ giảm 70% so với X-Quang phim', 'Kết quả trong 5–10 phút', 'Lưu trữ số hóa, dễ chia sẻ'],
        image: 'https://placehold.co/580x380/dbeafe/1e40af?text=X-Quang+Kỹ+Thuật+Số',
        imageAlt: 'Máy X-Quang kỹ thuật số',
        tag: 'Phổ biến',
        tagColor: 'bg-blue-100 text-blue-700',
    },
    {
        id: 2,
        title: 'Siêu âm màu 4D',
        subtitle: 'Color Doppler & 4D Ultrasound',
        description:
            'Công nghệ siêu âm màu 4D hiện đại, cho phép quan sát thai nhi theo thời gian thực với chất lượng hình ảnh sắc nét. Đồng thời ứng dụng trong đánh giá mạch máu, tim mạch và các cơ quan nội tạng.',
        features: ['Theo dõi thai nhi 4D thời gian thực', 'Đánh giá lưu lượng máu Doppler màu', 'An toàn, không bức xạ'],
        image: 'https://placehold.co/580x380/d1fae5/065f46?text=Siêu+Âm+4D+Màu',
        imageAlt: 'Siêu âm màu 4D',
        tag: 'Không bức xạ',
        tagColor: 'bg-emerald-100 text-emerald-700',
    },
    {
        id: 3,
        title: 'Chụp Cắt lớp vi tính (CT)',
        subtitle: 'Computed Tomography Scanner',
        description:
            'Hệ thống máy CT 64–256 lát cắt với tốc độ quét trong chưa đến 1 giây, cho hình ảnh 3D cực kỳ chi tiết của các cơ quan nội tạng, mạch máu, não bộ và ung thư. Thời gian quét ngắn giảm thiểu khó chịu cho bệnh nhân.',
        features: ['CT 256 lát cắt thế hệ mới', 'Tái tạo hình ảnh 3D, 4D', 'Hỗ trợ tầm soát ung thư phổi liều thấp'],
        image: 'https://placehold.co/580x380/fef3c7/92400e?text=CT+Scanner+256+Slice',
        imageAlt: 'Máy CT Scanner 256 lát cắt',
        tag: 'Hiện đại',
        tagColor: 'bg-amber-100 text-amber-700',
    },
    {
        id: 4,
        title: 'Chụp Cộng hưởng từ (MRI)',
        subtitle: 'Magnetic Resonance Imaging',
        description:
            'Máy MRI 1.5T – 3.0T Tesla không sử dụng bức xạ ion hóa, cho hình ảnh mô mềm cực kỳ rõ nét. Ứng dụng chẩn đoán tổn thương não, tủy sống, khớp, tim mạch và phần mềm cơ thể với độ chính xác vượt trội.',
        features: ['MRI 3.0 Tesla – độ phân giải cao nhất', 'Hoàn toàn không bức xạ', 'Chẩn đoán não, khớp, tim mạch, ung thư'],
        image: 'https://placehold.co/580x380/f3e8ff/5b21b6?text=MRI+3.0+Tesla',
        imageAlt: 'Máy MRI 3.0 Tesla',
        tag: 'Không bức xạ',
        tagColor: 'bg-violet-100 text-violet-700',
    },
];

export default function ImagingPage() {
    return (
        <div className="bg-gray-50 min-h-screen">
            {/* ── Hero Header ─── */}
            <section className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-500 text-white py-14 text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <p className="text-indigo-200 text-sm uppercase tracking-[0.2em] font-semibold mb-3">Dịch vụ y tế</p>
                    <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
                        TRUNG TÂM CHẨN ĐOÁN HÌNH ẢNH
                    </h1>
                    <div className="w-20 h-1 bg-indigo-300 rounded-full mx-auto mt-4" />
                    <p className="text-indigo-100 mt-4 text-base max-w-xl mx-auto leading-relaxed">
                        Trang bị hệ thống máy móc hiện đại bậc nhất — chẩn đoán chính xác, nhanh chóng.
                    </p>
                </div>
            </section>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <Breadcrumb items={[{ label: 'Dịch vụ' }, { label: 'Chẩn đoán hình ảnh' }]} />

                {/* ── Section Title ─── */}
                <div className="text-center mb-12">
                    <p className="text-indigo-600 text-sm font-semibold uppercase tracking-[0.2em] mb-2">Dịch vụ nổi bật</p>
                    <h2 className="text-2xl font-bold text-gray-900">CÁC KỸ THUẬT CHẨN ĐOÁN</h2>
                    <div className="w-14 h-1 bg-indigo-600 rounded-full mx-auto mt-3" />
                </div>

                {/* ── Zig-zag Layout ─── */}
                <div className="flex flex-col gap-16">
                    {IMAGING_SERVICES.map((svc, idx) => {
                        const isEven = idx % 2 === 0;
                        return (
                            <div
                                key={svc.id}
                                className={`flex flex-col ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'} gap-8 md:gap-12 items-center`}
                            >
                                {/* Image */}
                                <div className="w-full md:w-1/2 flex-shrink-0">
                                    <div className="rounded-2xl overflow-hidden shadow-md group">
                                        <img
                                            src={svc.image}
                                            alt={svc.imageAlt}
                                            className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="w-full md:w-1/2 flex flex-col gap-4">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${svc.tagColor}`}>
                                            {svc.tag}
                                        </span>
                                        <span className="text-xs text-gray-400 font-mono">{svc.subtitle}</span>
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                                        {svc.title}
                                    </h2>
                                    <p className="text-gray-600 leading-relaxed text-sm md:text-base">
                                        {svc.description}
                                    </p>
                                    <ul className="space-y-2">
                                        {svc.features.map((feat) => (
                                            <li key={feat} className="flex items-start gap-2 text-sm text-gray-700">
                                                <span className="mt-1 w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 block" />
                                                </span>
                                                {feat}
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-2">
                                        <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                                            <Link to="#">
                                                Tìm hiểu thêm <ArrowRight className="w-4 h-4 ml-1.5" />
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
