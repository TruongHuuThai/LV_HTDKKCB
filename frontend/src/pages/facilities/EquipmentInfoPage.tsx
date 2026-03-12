// src/pages/facilities/EquipmentInfoPage.tsx
import { Link } from 'react-router-dom';
import { Home, ChevronRight, CheckCircle2 } from 'lucide-react';
import { equipmentData } from '@/data/equipmentData';

export default function EquipmentInfoPage() {
    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Header / Hero */}
            <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white py-16 text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <p className="text-blue-200 text-sm uppercase tracking-[0.2em] font-semibold mb-3">
                        Cơ sở vật chất
                    </p>
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight uppercase mb-4">
                        TRANG THIẾT BỊ Y TẾ HIỆN ĐẠI
                    </h1>
                    <div className="w-16 h-1 bg-blue-300 rounded-full mx-auto my-4" />
                    <p className="text-blue-100 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
                        UMC Clinic tiên phong đầu tư hệ thống trang thiết bị y khoa tân tiến nhất thế giới, hỗ trợ đắc lực cho công tác chẩn đoán và điều trị chính xác, hiệu quả.
                    </p>
                </div>
            </section>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-10">
                    <Link to="/" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                        <Home className="w-4 h-4" /> Trang chủ
                    </Link>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                    <span className="text-gray-800 font-medium">Trang thiết bị</span>
                </nav>

                {/* Grid Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {equipmentData.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                        >
                            {/* Image Placeholder */}
                            <div className="aspect-[4/3] w-full bg-gray-100 relative overflow-hidden group">
                                <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur text-blue-700 p-2 rounded-xl shadow-sm">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 flex flex-col flex-1">
                                <h2 className="text-xl font-bold text-blue-900 mb-3 leading-snug">
                                    {item.name}
                                </h2>
                                <p className="text-gray-600 text-sm leading-relaxed flex-1">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom CTA */}
                <div className="mt-16 bg-blue-50 border border-blue-100 rounded-2xl p-8 text-center">
                    <h3 className="text-xl font-bold text-blue-900 mb-2">Đội ngũ kỹ thuật viên chuyên nghiệp</h3>
                    <p className="text-gray-600 max-w-2xl mx-auto text-sm">
                        Toàn bộ hệ thống máy móc được vận hành bởi đội ngũ bác sĩ và kỹ thuật viên giàu kinh nghiệm, đảm bảo kết quả nhanh chóng, chuẩn xác.
                    </p>
                </div>
            </div>
        </div>
    );
}
