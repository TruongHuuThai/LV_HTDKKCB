// src/pages/services/LabTestPage.tsx
import { Link } from 'react-router-dom';
import { ChevronRight, Home, Droplets, FlaskConical, ShieldCheck, Bug, Baby, Microscope, HeartPulse, Dna, ArrowRight } from 'lucide-react';
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

const LAB_CATEGORIES = [
    {
        icon: Droplets,
        title: 'Xét nghiệm Huyết học',
        desc: 'Tổng phân tích tế bào máu, đông máu cơ bản và nâng cao.',
        count: '25+ chỉ số',
        color: 'bg-red-50 text-red-600 border-red-100',
        iconBg: 'bg-red-100',
    },
    {
        icon: FlaskConical,
        title: 'Sinh hóa máu',
        desc: 'Chức năng gan, thận, mỡ máu, đường huyết, men tim.',
        count: '40+ chỉ số',
        color: 'bg-blue-50 text-blue-600 border-blue-100',
        iconBg: 'bg-blue-100',
    },
    {
        icon: ShieldCheck,
        title: 'Miễn dịch – Hormone',
        desc: 'Dấu ấn ung thư, hormone tuyến giáp, viêm gan B/C.',
        count: '30+ chỉ số',
        color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        iconBg: 'bg-emerald-100',
    },
    {
        icon: Bug,
        title: 'Vi sinh – Ký sinh trùng',
        desc: 'Cấy vi khuẩn, kháng sinh đồ, PCR, phân tích phân.',
        count: '20+ xét nghiệm',
        color: 'bg-orange-50 text-orange-600 border-orange-100',
        iconBg: 'bg-orange-100',
    },
    {
        icon: Baby,
        title: 'Sàng lọc trước sinh',
        desc: 'Double test, Triple test, NIPT, siêu âm hình thái thai nhi.',
        count: '10+ gói',
        color: 'bg-pink-50 text-pink-600 border-pink-100',
        iconBg: 'bg-pink-100',
    },
    {
        icon: Microscope,
        title: 'Nước tiểu – Tổng phân tích',
        desc: 'Cặn lắng nước tiểu, kháng thể, protein niệu.',
        count: '15+ chỉ số',
        color: 'bg-yellow-50 text-yellow-600 border-yellow-100',
        iconBg: 'bg-yellow-100',
    },
    {
        icon: HeartPulse,
        title: 'Tim mạch – Troponin',
        desc: 'BNP, hs-CRP, Troponin I – đánh giá nguy cơ tim mạch.',
        count: '12+ chỉ số',
        color: 'bg-violet-50 text-violet-600 border-violet-100',
        iconBg: 'bg-violet-100',
    },
    {
        icon: Dna,
        title: 'Xét nghiệm Di truyền',
        desc: 'Phân tích gen, xét nghiệm PCR, giải mã DNA.',
        count: '8+ dịch vụ',
        color: 'bg-teal-50 text-teal-600 border-teal-100',
        iconBg: 'bg-teal-100',
    },
];

const ISO_STATS = [
    { num: 'ISO 15189', label: 'Tiêu chuẩn phòng lab' },
    { num: '200+', label: 'Loại xét nghiệm' },
    { num: '6h', label: 'Trả kết quả nhanh nhất' },
    { num: '99.8%', label: 'Độ chính xác' },
];

export default function LabTestPage() {
    return (
        <div className="bg-gray-50 min-h-screen">
            {/* ── Hero Header ─── */}
            <section className="bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-500 text-white py-14 text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <p className="text-teal-200 text-sm uppercase tracking-[0.2em] font-semibold mb-3">Dịch vụ y tế</p>
                    <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
                        DỊCH VỤ XÉT NGHIỆM Y KHOA
                    </h1>
                    <div className="w-20 h-1 bg-teal-300 rounded-full mx-auto mt-4" />
                </div>
            </section>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <Breadcrumb items={[{ label: 'Dịch vụ' }, { label: 'Xét nghiệm' }]} />

                {/* ── Intro Section ─── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-12 flex flex-col md:flex-row gap-8 items-center">
                    <div className="md:w-1/2 flex-shrink-0">
                        <img
                            src="https://placehold.co/560x360/d1fae5/065f46?text=Phòng+Lab+ISO+15189"
                            alt="Phòng xét nghiệm ISO 15189"
                            className="w-full rounded-xl object-cover shadow-md"
                        />
                    </div>
                    <div className="space-y-4">
                        <span className="inline-flex w-fit items-center bg-teal-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                            Chuẩn ISO Quốc Tế
                        </span>
                        <h2 className="text-2xl font-bold text-gray-900">Hệ thống Phòng Lab đạt chuẩn ISO 15189</h2>
                        <p className="text-gray-600 leading-relaxed text-sm">
                            Phòng xét nghiệm UMC Clinic được vận hành theo tiêu chuẩn quốc tế <strong>ISO 15189</strong> — tiêu chuẩn cao nhất dành riêng cho phòng xét nghiệm y tế. Với hệ thống máy móc tự động hóa hiện đại từ Siemens, Abbott và Roche, chúng tôi đảm bảo kết quả chính xác, nhanh chóng và bảo mật tuyệt đối.
                        </p>
                        <p className="text-gray-600 leading-relaxed text-sm">
                            Đội ngũ kỹ thuật viên được đào tạo chuyên sâu, thường xuyên tham gia kiểm tra ngoại kiểm (EQA) quốc tế, cho phép phát hiện các bất thường nhỏ nhất trong kết quả xét nghiệm.
                        </p>
                        <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white">
                            <Link to="#">Tìm hiểu thêm <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
                        </Button>
                    </div>
                </div>

                {/* ── ISO Stats ─── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                    {ISO_STATS.map(({ num, label }) => (
                        <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
                            <div className="text-2xl font-extrabold text-teal-600 mb-1">{num}</div>
                            <div className="text-xs text-gray-500">{label}</div>
                        </div>
                    ))}
                </div>

                {/* ── Section Title ─── */}
                <div className="text-center mb-8">
                    <p className="text-teal-600 text-sm font-semibold uppercase tracking-[0.2em] mb-2">Nhóm xét nghiệm</p>
                    <h2 className="text-2xl font-bold text-gray-900">CÁC NHÓM XÉT NGHIỆM</h2>
                    <div className="w-14 h-1 bg-teal-600 rounded-full mx-auto mt-3" />
                </div>

                {/* ── Lab Categories Grid ─── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {LAB_CATEGORIES.map((cat) => (
                        <div
                            key={cat.title}
                            className={`group bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 p-6 flex flex-col gap-4 ${cat.color}`}
                        >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cat.iconBg}`}>
                                <cat.icon className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 mb-2 leading-snug">{cat.title}</h3>
                                <p className="text-xs text-gray-500 leading-relaxed">{cat.desc}</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/60 border">{cat.count}</span>
                                <Button variant="ghost" size="sm" asChild className="text-xs px-2 h-7">
                                    <Link to="#">Chi tiết →</Link>
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
