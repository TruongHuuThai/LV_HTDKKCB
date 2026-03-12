// src/pages/about/AboutPage.tsx
import { Link } from 'react-router-dom';
import { Eye, Heart, Zap, Shield, Star, ChevronRight, Home } from 'lucide-react';

// ─── Breadcrumb ─────────────────────────────────────────────────────────────
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

const CORE_VALUES = [
    { icon: Zap, label: 'Tiên phong', desc: 'Luôn đón đầu xu hướng y tế hiện đại', color: 'bg-blue-600' },
    { icon: Heart, label: 'Thấu hiểu', desc: 'Lắng nghe và đồng hành cùng bệnh nhân', color: 'bg-teal-600' },
    { icon: Star, label: 'Chuẩn mực', desc: 'Chất lượng dịch vụ đạt tiêu chuẩn quốc tế', color: 'bg-indigo-600' },
    { icon: Shield, label: 'An toàn', desc: 'Bảo đảm an toàn tuyệt đối cho người bệnh', color: 'bg-emerald-600' },
];

export default function AboutPage() {
    return (
        <div className="bg-white">
            {/* ── Header Section ─── */}
            <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white py-16 text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <p className="text-blue-200 text-sm uppercase tracking-[0.2em] font-semibold mb-3">Bệnh viện Đại học Y Dược TP.HCM</p>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">VỀ CHÚNG TÔI</h1>
                    <p className="text-blue-100 text-lg leading-relaxed">
                        Hơn 40 năm đồng hành cùng sức khỏe người Việt — tiên phong trong mô hình bệnh viện công - tư kết hợp tại Việt Nam.
                    </p>
                </div>
            </section>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <Breadcrumb items={[{ label: 'Giới thiệu', href: '/gioi-thieu' }, { label: 'Về chúng tôi' }]} />

                {/* ── Hero Image ─── */}
                <div className="rounded-2xl overflow-hidden mb-14 shadow-lg">
                    <img
                        src="https://placehold.co/1200x480/1e40af/ffffff?text=Đội+ngũ+y+bác+sĩ+UMC+Clinic"
                        alt="Đội ngũ bác sĩ UMC"
                        className="w-full object-cover"
                    />
                </div>

                {/* ── Content Block ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 items-center">
                    <div className="rounded-2xl overflow-hidden shadow-md">
                        <img
                            src="https://placehold.co/600x420/dbeafe/1e40af?text=Lễ+Khai+Trương+UMC+1975"
                            alt="Lễ khai trương UMC"
                            className="w-full object-cover"
                        />
                    </div>
                    <div className="space-y-5">
                        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm font-semibold">
                            <Heart className="w-4 h-4" /> Lịch sử hình thành
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 leading-tight">
                            Phòng khám đầu tiên theo mô hình công – tư
                        </h2>
                        <div className="space-y-3 text-gray-600 leading-relaxed">
                            <p>
                                Bệnh viện Đại học Y Dược TP.HCM (UMC) được thành lập năm 1975, là cơ sở y tế tiên phong trong mô hình kết hợp đào tạo và khám chữa bệnh tại Việt Nam.
                            </p>
                            <p>
                                Với đội ngũ hơn <strong className="text-blue-700">2.000 bác sĩ và chuyên gia</strong> đầu ngành, UMC không ngừng đổi mới và ứng dụng công nghệ y tế tiên tiến nhất, mang đến dịch vụ chăm sóc sức khỏe chất lượng cao cho hàng triệu bệnh nhân.
                            </p>
                            <p>
                                Trải qua hơn 4 thập kỷ, UMC đã trở thành địa chỉ tin cậy hàng đầu tại khu vực phía Nam, với hơn <strong className="text-blue-700">500.000 lượt bệnh nhân</strong> thăm khám mỗi năm.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Tầm nhìn & Sứ mệnh ─── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
                    <div className="relative rounded-2xl overflow-hidden">
                        <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: 'url(https://placehold.co/600x300/0f172a/ffffff?text=)' }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/95 to-blue-800/90" />
                        <div className="relative p-8 text-white">
                            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center mb-5">
                                <Eye className="w-6 h-6 text-blue-200" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-blue-100 uppercase tracking-wide">Tầm nhìn</h3>
                            <p className="text-blue-100/80 leading-relaxed">
                                Trở thành Trung tâm Y tế hàng đầu Đông Nam Á vào năm 2030, dẫn đầu trong nghiên cứu, đào tạo và ứng dụng công nghệ y tế tiên tiến.
                            </p>
                        </div>
                    </div>
                    <div className="relative rounded-2xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-teal-900/95 to-teal-800/90" />
                        <div className="relative p-8 text-white">
                            <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center mb-5">
                                <Heart className="w-6 h-6 text-teal-200" />
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-teal-100 uppercase tracking-wide">Sứ mệnh</h3>
                            <p className="text-teal-100/80 leading-relaxed">
                                Cung cấp dịch vụ y tế chất lượng cao, nhân văn và toàn diện — nơi mỗi bệnh nhân đều được chăm sóc tận tâm, an toàn và hiệu quả nhất.
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Giá trị cốt lõi ─── */}
                <div className="text-center mb-10">
                    <p className="text-blue-600 text-sm font-semibold uppercase tracking-[0.2em] mb-2">Định hướng phát triển</p>
                    <h2 className="text-3xl font-bold text-gray-900">GIÁ TRỊ CỐT LÕI</h2>
                    <div className="w-16 h-1 bg-blue-600 rounded-full mx-auto mt-4" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                    {CORE_VALUES.map(({ icon: Icon, label, desc, color }) => (
                        <div key={label} className="text-center group">
                            <div className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                                <Icon className="w-8 h-8 text-white" />
                            </div>
                            <h4 className="font-bold text-gray-900 mb-2">{label}</h4>
                            <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                        </div>
                    ))}
                </div>

                {/* ── Stats ─── */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-10 text-white mt-10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {[
                            { num: '40+', label: 'Năm kinh nghiệm' },
                            { num: '2.000+', label: 'Bác sĩ & chuyên gia' },
                            { num: '50+', label: 'Chuyên khoa' },
                            { num: '500K+', label: 'Bệnh nhân mỗi năm' },
                        ].map(({ num, label }) => (
                            <div key={label}>
                                <div className="text-4xl font-bold mb-1">{num}</div>
                                <div className="text-blue-200 text-sm">{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
