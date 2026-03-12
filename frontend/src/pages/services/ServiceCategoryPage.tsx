// src/pages/services/ServiceCategoryPage.tsx
// Trang danh sách gói khám theo nhóm dịch vụ.
// Layout: Featured Card (ngang) + Grid Cards (3 cột).
// Toàn bộ ảnh và nút "Xem chi tiết" đều là Link → navigate to detail.

import { Link, useParams } from 'react-router-dom';
import { ChevronRight, ArrowRight, Phone } from 'lucide-react';
import { getServiceBySlug, type ServicePackage } from '@/data/servicesData';
import { SERVICE_PACKAGE_DETAILS } from '@/data/servicePackageDetails';
import PackageCard from '@/components/services/PackageCard';

// ── Breadcrumb ────────────────────────────────────────────────────────────────
function Breadcrumb({ label }: { label: string }) {
    return (
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500 mb-7">
            <Link to="/" className="hover:text-blue-600 transition-colors">
                Trang chủ
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <span className="text-gray-400">Dịch vụ</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <span className="text-blue-700 font-medium">{label}</span>
        </nav>
    );
}

// ── Featured Card (ngang to — gói nổi bật) ───────────────────────────────────
function FeaturedCard({
    pkg,
    categorySlug,
}: {
    pkg: ServicePackage;
    categorySlug: string;
}) {
    const href = `/dich-vu/${categorySlug}/${pkg.id}`;
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden mb-10">
            <div className="flex flex-col md:flex-row">
                {/* Ảnh — click để navigate */}
                <Link
                    to={href}
                    className="block md:w-2/5 shrink-0 overflow-hidden group"
                    tabIndex={-1}
                    aria-hidden
                >
                    <img
                        src={pkg.imageUrl ?? pkg.thumbnail}
                        alt={pkg.name}
                        className="w-full h-60 md:h-full object-cover cursor-pointer group-hover:opacity-90 group-hover:scale-[1.02] transition-all duration-500"
                    />
                </Link>

                {/* Nội dung */}
                <div className="flex flex-col justify-center gap-4 p-7 md:p-10">
                    {pkg.badge && (
                        <span className="inline-block w-fit bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                            {pkg.badge}
                        </span>
                    )}
                    <h2 className="text-xl md:text-2xl font-extrabold text-blue-900 uppercase leading-snug">
                        {pkg.name}
                    </h2>
                    {pkg.summary && (
                        <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">
                            {pkg.summary}
                        </p>
                    )}
                    <div className="flex items-center gap-4 flex-wrap">
                        <span className="text-2xl font-extrabold text-orange-500">
                            {pkg.price}
                        </span>
                        <Link
                            to={href}
                            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors shadow"
                        >
                            Xem chi tiết <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Hotline Banner ─────────────────────────────────────────────────────────────
function HotlineBanner() {
    return (
        <div className="w-full bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 rounded-2xl p-7 flex flex-col md:flex-row items-center justify-between gap-5 shadow-lg shadow-blue-500/20 my-10">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6 text-white" />
                </div>
                <div className="text-white">
                    <p className="text-sm font-medium text-blue-100 mb-0.5">Đặt lịch &amp; Tư vấn miễn phí</p>
                    <p className="text-2xl font-extrabold tracking-wide">(084) 867 504 590</p>
                    <p className="text-xs text-blue-200 mt-0.5">
                        Thứ 2 – Thứ 7: 7:00 – 20:00 | Chủ nhật: 7:00 – 12:00
                    </p>
                </div>
            </div>
            <div className="flex gap-3 shrink-0">
                <Link
                    to="/booking"
                    className="bg-white text-blue-700 font-bold px-6 py-2.5 rounded-xl shadow hover:bg-blue-50 transition-colors text-sm"
                >
                    Đặt lịch ngay →
                </Link>
                <Link
                    to="/lien-he"
                    className="border border-white/40 text-white font-medium px-6 py-2.5 rounded-xl hover:bg-white/10 transition-colors text-sm"
                >
                    Liên hệ
                </Link>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ServiceCategoryPage() {
    const { categorySlug } = useParams<{ categorySlug: string }>();
    const service = getServiceBySlug(categorySlug ?? '');

    if (!service) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-20">
                <p className="text-2xl font-bold text-gray-700 mb-4">Danh mục không tồn tại</p>
                <Link to="/" className="text-blue-600 hover:underline text-sm">
                    ← Về trang chủ
                </Link>
            </div>
        );
    }

    const featuredPkg = service.packages.find((p) => p.isFeatured);
    const gridPkgs = service.packages.filter((p) => !p.isFeatured);

    return (
        <div className="min-h-screen bg-gray-50 pb-16">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
                <Breadcrumb label={service.title} />

                {/* Page header */}
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-extrabold uppercase text-blue-900 leading-snug mb-2">
                        {service.title}
                    </h1>
                    <p className="text-sm text-gray-500">{service.bannerDesc}</p>
                </div>

                {/* ── Featured Card ─────────────────────────────── */}
                {featuredPkg && (
                    <FeaturedCard pkg={featuredPkg} categorySlug={categorySlug ?? ''} />
                )}

                {/* ── Hotline banner ────────────────────────────── */}
                <HotlineBanner />

                {/* ── Section tiêu đề grid ─────────────────────── */}
                {gridPkgs.length > 0 && (
                    <section>
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-extrabold uppercase text-blue-900 tracking-wide">
                                Các Gói Dịch Vụ
                            </h2>
                            <div className="mt-3 flex items-center justify-center gap-2">
                                <span className="block w-14 h-0.5 bg-blue-300 rounded-full" />
                                <span className="block w-2.5 h-2.5 rounded-full bg-blue-600" />
                                <span className="block w-14 h-0.5 bg-blue-300 rounded-full" />
                            </div>
                            <p className="text-sm text-gray-500 mt-3">
                                Chọn gói phù hợp với nhu cầu và ngân sách của bạn
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {gridPkgs.map((pkg) => {
                                const detail = SERVICE_PACKAGE_DETAILS.find(
                                    (d) => d.categorySlug === (categorySlug ?? '') && d.slug === pkg.id
                                );
                                return (
                                    <PackageCard
                                        key={pkg.id}
                                        pkg={pkg}
                                        categorySlug={categorySlug ?? ''}
                                        publishedAt={detail?.publishedAt}
                                    />
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
