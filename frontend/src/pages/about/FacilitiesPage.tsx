// src/pages/about/FacilitiesPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Home, X } from 'lucide-react';

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

const GALLERY = [
    { id: 1, src: 'https://placehold.co/800x600/1e3a5f/ffffff?text=Máy+Nội+Soi+Tiêu+Hóa', label: 'Hệ thống nội soi tiêu hóa', cat: 'Thiết bị' },
    { id: 2, src: 'https://placehold.co/800x600/1e40af/ffffff?text=Máy+Chụp+CT+256+Lát', label: 'Máy chụp CT 256 lát cắt', cat: 'Thiết bị' },
    { id: 3, src: 'https://placehold.co/800x600/0f766e/ffffff?text=Phòng+Chờ+VIP', label: 'Phòng chờ khu VIP', cat: 'Không gian' },
    { id: 4, src: 'https://placehold.co/800x600/4338ca/ffffff?text=Sảnh+Tiếp+Đón', label: 'Sảnh tiếp đón tầng trệt', cat: 'Không gian' },
    { id: 5, src: 'https://placehold.co/800x600/0369a1/ffffff?text=Phòng+Mổ+Hiện+Đại', label: 'Phòng mổ hiện đại vô trùng', cat: 'Thiết bị' },
    { id: 6, src: 'https://placehold.co/800x600/065f46/ffffff?text=Khu+Xét+Nghiệm+Lab', label: 'Khu xét nghiệm Lab chuẩn ISO', cat: 'Thiết bị' },
    { id: 7, src: 'https://placehold.co/800x600/7c3aed/ffffff?text=Phòng+Hồi+Sức+ICU', label: 'Phòng hồi sức tích cực ICU', cat: 'Không gian' },
    { id: 8, src: 'https://placehold.co/800x600/b45309/ffffff?text=Robot+Da+Vinci+Xi', label: 'Hệ thống robot phẫu thuật Da Vinci', cat: 'Thiết bị' },
];

export default function FacilitiesPage() {
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
    const [carouselIdx, setCarouselIdx] = useState(0);

    const openLightbox = (idx: number) => setLightboxIdx(idx);
    const closeLightbox = () => setLightboxIdx(null);
    const prevLight = () => setLightboxIdx((i) => (i === null ? 0 : (i - 1 + GALLERY.length) % GALLERY.length));
    const nextLight = () => setLightboxIdx((i) => (i === null ? 0 : (i + 1) % GALLERY.length));

    // Carousel: 1 big + 4 small per group
    const groups: (typeof GALLERY)[] = [];
    for (let i = 0; i < GALLERY.length; i += 5) groups.push(GALLERY.slice(i, i + 5));
    const currentGroup = groups[carouselIdx] ?? [];

    return (
        <div className="bg-white">
            {/* ── Header ─── */}
            <section className="bg-gradient-to-br from-blue-700 to-blue-500 text-white py-16 text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <p className="text-blue-200 text-sm uppercase tracking-[0.2em] font-semibold mb-3">Hạ tầng y tế đỉnh cao</p>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4">CƠ SỞ VẬT CHẤT</h1>
                    <p className="text-blue-100 text-lg leading-relaxed">
                        Hệ thống trang thiết bị y tế hiện đại hàng đầu, không gian khám chữa bệnh tiện nghi và đạt chuẩn quốc tế.
                    </p>
                </div>
            </section>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <Breadcrumb items={[
                    { label: 'Giới thiệu', href: '/gioi-thieu' },
                    { label: 'Cơ sở vật chất' },
                ]} />

                {/* ── Carousel Feature Gallery ─── */}
                <div className="mb-16">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Tổng quan cơ sở</h2>
                            <p className="text-gray-500 text-sm mt-1">Nhấn vào ảnh để xem phóng to</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCarouselIdx((i) => Math.max(0, i - 1))}
                                disabled={carouselIdx === 0}
                                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 disabled:opacity-30 transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4 text-gray-700" />
                            </button>
                            <span className="text-sm text-gray-500">{carouselIdx + 1} / {groups.length}</span>
                            <button
                                onClick={() => setCarouselIdx((i) => Math.min(groups.length - 1, i + 1))}
                                disabled={carouselIdx === groups.length - 1}
                                className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 disabled:opacity-30 transition-colors"
                            >
                                <ChevronRight className="w-4 h-4 text-gray-700" />
                            </button>
                        </div>
                    </div>

                    {/* 1 big + 4 small grid */}
                    {currentGroup.length > 0 && (
                        <div className="grid grid-cols-3 grid-rows-2 gap-3 h-[520px]">
                            {/* Big image left */}
                            <div
                                className="col-span-2 row-span-2 rounded-2xl overflow-hidden cursor-pointer group relative"
                                onClick={() => { const idx = GALLERY.findIndex(g => g.id === currentGroup[0]?.id); openLightbox(idx >= 0 ? idx : 0); }}
                            >
                                {currentGroup[0] && (
                                    <>
                                        <img src={currentGroup[0].src} alt={currentGroup[0].label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="absolute bottom-0 left-0 right-0 p-5 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">{currentGroup[0].cat}</span>
                                            <p className="font-semibold mt-1.5">{currentGroup[0].label}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                            {/* 4 small images right */}
                            {currentGroup.slice(1, 5).map((img, i) => (
                                <div
                                    key={img.id}
                                    className="rounded-xl overflow-hidden cursor-pointer group relative"
                                    onClick={() => { const idx = GALLERY.findIndex(g => g.id === img.id); openLightbox(idx >= 0 ? idx : 0); }}
                                >
                                    <img src={img.src} alt={img.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute bottom-0 left-0 right-0 p-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-xs font-medium truncate">{img.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── All Photos Grid ─── */}
                <div className="mb-16">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Tất cả hình ảnh</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {GALLERY.map((img, idx) => (
                            <div
                                key={img.id}
                                className="relative rounded-xl overflow-hidden cursor-pointer group aspect-[4/3]"
                                onClick={() => openLightbox(idx)}
                            >
                                <img src={img.src} alt={img.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute bottom-0 left-0 right-0 p-3 text-white translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                    <span className="text-[10px] bg-blue-600 px-1.5 py-0.5 rounded">{img.cat}</span>
                                    <p className="text-xs font-medium mt-1 leading-tight">{img.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Facility Stats ─── */}
                <div className="bg-gray-50 rounded-2xl p-8">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Con số ấn tượng</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                        {[
                            { num: '15+', label: 'Tòa nhà & Khu điều trị' },
                            { num: '1.200+', label: 'Giường bệnh nội trú' },
                            { num: '30+', label: 'Phòng mổ hiện đại' },
                            { num: '200+', label: 'Thiết bị y tế chuyên sâu' },
                        ].map(({ num, label }) => (
                            <div key={label}>
                                <div className="text-3xl font-bold text-blue-700 mb-1">{num}</div>
                                <div className="text-sm text-gray-500">{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Lightbox ─── */}
            {lightboxIdx !== null && (
                <div
                    className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
                    onClick={closeLightbox}
                >
                    {/* Prev */}
                    <button
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
                        onClick={(e) => { e.stopPropagation(); prevLight(); }}
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>

                    {/* Image */}
                    <div className="relative max-w-4xl w-full mx-16" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={GALLERY[lightboxIdx].src}
                            alt={GALLERY[lightboxIdx].label}
                            className="w-full rounded-xl shadow-2xl"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent rounded-b-xl p-6 text-white">
                            <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">{GALLERY[lightboxIdx].cat}</span>
                            <p className="font-semibold mt-2">{GALLERY[lightboxIdx].label}</p>
                            <p className="text-sm text-white/60 mt-1">{lightboxIdx + 1} / {GALLERY.length}</p>
                        </div>
                    </div>

                    {/* Next */}
                    <button
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
                        onClick={(e) => { e.stopPropagation(); nextLight(); }}
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>

                    {/* Close */}
                    <button
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                        onClick={closeLightbox}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    );
}
