// src/pages/services/AllServicesOverviewPage.tsx
import { Link } from 'react-router-dom';
import { Home, ChevronRight, ArrowRight, ShieldCheck } from 'lucide-react';
import { SERVICES } from '@/data/servicesData';
import { Button } from '@/components/ui/button';

export default function AllServicesOverviewPage() {
    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Header / Hero */}
            <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white py-16 text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <p className="text-blue-200 text-sm uppercase tracking-[0.2em] font-semibold mb-3">
                        Dịch vụ Y tế Khám chữa bệnh
                    </p>
                    <h1 className="text-3xl md:text-5xl font-bold tracking-tight uppercase mb-4">
                        TẤT CẢ DỊCH VỤ Y KHOA
                    </h1>
                    <div className="w-16 h-1 bg-blue-300 rounded-full mx-auto my-4" />
                    <p className="text-blue-100 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
                        UMC Clinic tự hào mang đến các dịch vụ y tế chất lượng cao, từ khám tổng quát, tầm soát chuyên sâu đến chăm sóc tại nhà, đáp ứng tối đa nhu cầu của bạn và gia đình.
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
                    <span className="text-gray-800 font-medium">Tất cả dịch vụ</span>
                </nav>

                {/* Grid Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {SERVICES.map((service) => (
                        <div
                            key={service.id}
                            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
                        >
                            {/* Image Placeholder */}
                            <div className="aspect-[16/9] w-full relative overflow-hidden bg-gray-100">
                                <img
                                    src={`https://placehold.co/600x400/e0f2fe/0284c7?text=${encodeURIComponent(service.title)}`}
                                    alt={service.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                {/* Optional Badge Overlay */}
                                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5" /> Dịch vụ nổi bật
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 flex flex-col flex-1">
                                <h2 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">
                                    {service.title}
                                </h2>
                                <p className="text-gray-600 text-sm mb-6 flex-1 line-clamp-3">
                                    {service.shortDesc || "Quy trình chăm sóc sức khỏe toàn diện, được cá nhân hóa theo từng độ tuổi và nhu cầu, mang lại sự an tâm tuyệt đối."}
                                </p>

                                {/* Action */}
                                <Button asChild className="w-full bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors group-hover:shadow-md">
                                    <Link to={`/dich-vu/${service.id}`}>
                                        Tìm hiểu thêm <ArrowRight className="w-4 h-4 ml-1.5" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
