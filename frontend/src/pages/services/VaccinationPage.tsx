// src/pages/services/VaccinationPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home, Search, CheckCircle2, XCircle, Syringe, ShieldCheck, Calendar } from 'lucide-react';
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

interface Vaccine {
    id: number;
    name: string;
    origin: string;
    flag: string;
    diseases: string;
    price: string;
    inStock: boolean;
    ageGroup: string;
}

const VACCINES: Vaccine[] = [
    {
        id: 1,
        name: 'Hexaxim (6 trong 1)',
        origin: 'Pháp',
        flag: '🇫🇷',
        diseases: 'Bạch hầu, Ho gà, Uốn ván, Bại liệt, Hib, Viêm gan B',
        price: '950.000đ/mũi',
        inStock: true,
        ageGroup: '2 – 24 tháng',
    },
    {
        id: 2,
        name: 'Gardasil 9',
        origin: 'Mỹ',
        flag: '🇺🇸',
        diseases: 'Ung thư cổ tử cung, Mụn cóc sinh dục (9 chủng HPV)',
        price: '3.290.000đ/mũi',
        inStock: true,
        ageGroup: '9 – 45 tuổi',
    },
    {
        id: 3,
        name: 'Influvac Tetra',
        origin: 'Hà Lan',
        flag: '🇳🇱',
        diseases: 'Cúm mùa (4 chủng A và B)',
        price: '395.000đ/mũi',
        inStock: true,
        ageGroup: '≥ 6 tháng',
    },
    {
        id: 4,
        name: 'Varivax',
        origin: 'Mỹ',
        flag: '🇺🇸',
        diseases: 'Thủy đậu (Varicella)',
        price: '850.000đ/mũi',
        inStock: false,
        ageGroup: '≥ 12 tháng',
    },
    {
        id: 5,
        name: 'Engerix-B',
        origin: 'Bỉ',
        flag: '🇧🇪',
        diseases: 'Viêm gan B',
        price: '195.000đ/mũi',
        inStock: true,
        ageGroup: 'Mọi lứa tuổi',
    },
    {
        id: 6,
        name: 'PRIORIX-TETRA',
        origin: 'Bỉ',
        flag: '🇧🇪',
        diseases: 'Sởi, Quai bị, Rubella, Thủy đậu',
        price: '760.000đ/mũi',
        inStock: true,
        ageGroup: '9 tháng – 6 tuổi',
    },
    {
        id: 7,
        name: 'Boostrix',
        origin: 'Bỉ',
        flag: '🇧🇪',
        diseases: 'Bạch hầu, Ho gà, Uốn ván (nhắc lại)',
        price: '650.000đ/mũi',
        inStock: true,
        ageGroup: '≥ 4 tuổi',
    },
    {
        id: 8,
        name: 'Synflorix',
        origin: 'Bỉ',
        flag: '🇧🇪',
        diseases: 'Phế cầu khuẩn (10 type)',
        price: '1.200.000đ/mũi',
        inStock: false,
        ageGroup: '6 tuần – 5 tuổi',
    },
    {
        id: 9,
        name: 'Twinrix',
        origin: 'Bỉ',
        flag: '🇧🇪',
        diseases: 'Viêm gan A + Viêm gan B',
        price: '580.000đ/mũi',
        inStock: true,
        ageGroup: '≥ 1 tuổi',
    },
    {
        id: 10,
        name: 'Imojev',
        origin: 'Pháp',
        flag: '🇫🇷',
        diseases: 'Viêm não Nhật Bản',
        price: '720.000đ/mũi',
        inStock: true,
        ageGroup: '≥ 9 tháng',
    },
];

const STATS = [
    { icon: Syringe, value: '50+', label: 'Loại vắc-xin', color: 'text-blue-600', bg: 'bg-blue-50' },
    { icon: ShieldCheck, value: '100%', label: 'Vắc-xin nhập khẩu chính hãng', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { icon: Calendar, value: '7/7', label: 'Ngày trong tuần', color: 'text-violet-600', bg: 'bg-violet-50' },
];

export default function VaccinationPage() {
    const [query, setQuery] = useState('');

    const filtered = VACCINES.filter(
        (v) =>
            v.name.toLowerCase().includes(query.toLowerCase()) ||
            v.diseases.toLowerCase().includes(query.toLowerCase()) ||
            v.origin.toLowerCase().includes(query.toLowerCase()),
    );

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* ── Hero Header ─── */}
            <section className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 text-white py-14 text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <p className="text-emerald-200 text-sm uppercase tracking-[0.2em] font-semibold mb-3">Dịch vụ y tế</p>
                    <h1 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
                        TRUNG TÂM TIÊM CHỦNG
                    </h1>
                    <div className="w-20 h-1 bg-emerald-300 rounded-full mx-auto mt-4" />
                    <p className="text-emerald-100 mt-4 text-base max-w-xl mx-auto leading-relaxed">
                        Vắc-xin nhập khẩu chính hãng — bảo vệ sức khỏe cho cả gia đình bạn.
                    </p>
                </div>
            </section>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <Breadcrumb items={[{ label: 'Dịch vụ' }, { label: 'Tiêm chủng' }]} />

                {/* ── Stats Row ─── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                    {STATS.map(({ icon: Icon, value, label, color, bg }) => (
                        <div key={label} className={`rounded-xl ${bg} border border-transparent p-5 flex items-center gap-4`}>
                            <div className={`w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm ${color}`}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <div>
                                <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
                                <div className="text-sm text-gray-600">{label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Section Title ─── */}
                <div className="text-center mb-6">
                    <p className="text-emerald-600 text-sm font-semibold uppercase tracking-[0.2em] mb-2">Danh mục vắc-xin</p>
                    <h2 className="text-2xl font-bold text-gray-900">BẢNG GIÁ VẮC-XIN THAM KHẢO</h2>
                    <div className="w-14 h-1 bg-emerald-600 rounded-full mx-auto mt-3 mb-6" />
                </div>

                {/* ── Search Bar ─── */}
                <div className="relative max-w-lg mx-auto mb-8">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Tìm vắc-xin theo tên bệnh, nguồn gốc... (VD: Cúm, Sởi, Pháp)"
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition"
                    />
                </div>

                {/* ── Vaccine Table ─── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-emerald-600 text-white text-left">
                                    <th className="px-5 py-3.5 font-semibold">#</th>
                                    <th className="px-5 py-3.5 font-semibold">Tên Vắc-xin</th>
                                    <th className="px-5 py-3.5 font-semibold">Nước SX</th>
                                    <th className="px-5 py-3.5 font-semibold hidden md:table-cell">Nhóm tuổi</th>
                                    <th className="px-5 py-3.5 font-semibold hidden lg:table-cell">Phòng bệnh</th>
                                    <th className="px-5 py-3.5 font-semibold">Giá tham khảo</th>
                                    <th className="px-5 py-3.5 font-semibold text-center">Trạng thái</th>
                                    <th className="px-5 py-3.5 font-semibold"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-gray-400">
                                            <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                            Không tìm thấy vắc-xin phù hợp.
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((v, idx) => (
                                        <tr
                                            key={v.id}
                                            className="hover:bg-emerald-50/40 transition-colors group"
                                        >
                                            <td className="px-5 py-4 text-gray-400 font-mono text-xs">{String(idx + 1).padStart(2, '0')}</td>
                                            <td className="px-5 py-4">
                                                <span className="font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
                                                    {v.name}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className="text-lg mr-1">{v.flag}</span>
                                                <span className="text-gray-600">{v.origin}</span>
                                            </td>
                                            <td className="px-5 py-4 hidden md:table-cell text-gray-500 text-xs">{v.ageGroup}</td>
                                            <td className="px-5 py-4 hidden lg:table-cell text-gray-500 max-w-[220px] truncate">{v.diseases}</td>
                                            <td className="px-5 py-4 font-bold text-blue-600 whitespace-nowrap">{v.price}</td>
                                            <td className="px-5 py-4 text-center">
                                                {v.inStock ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Còn thuốc
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-100 px-2.5 py-1 rounded-full">
                                                        <XCircle className="w-3.5 h-3.5" /> Hết thuốc
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                    className="text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50 h-8"
                                                    disabled={!v.inStock}
                                                >
                                                    <Link to="/booking">Đặt lịch</Link>
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Footer */}
                    <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                        <span>Hiển thị {filtered.length} / {VACCINES.length} vắc-xin</span>
                        <span>* Giá trên chỉ mang tính chất tham khảo, có thể thay đổi.</span>
                    </div>
                </div>

                {/* ── CTA Banner ─── */}
                <div className="mt-10 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-white text-center">
                    <h3 className="text-xl font-bold mb-2">Cần tư vấn lịch tiêm chủng?</h3>
                    <p className="text-emerald-100 text-sm mb-5">
                        Đội ngũ chuyên gia của chúng tôi sẵn sàng hỗ trợ bạn lên lịch tiêm phù hợp nhất.
                    </p>
                    <Button asChild className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold shadow">
                        <Link to="/booking">Đặt lịch tiêm ngay</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
