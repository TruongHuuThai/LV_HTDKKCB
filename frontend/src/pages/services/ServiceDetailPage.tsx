// src/pages/services/ServiceDetailPage.tsx
// Trang chi tiết danh mục dịch vụ — layout bài viết:
//   Breadcrumb → h1 → hero image → prose HTML article → packages grid → hotline CTA

import { Link, useParams } from 'react-router-dom';
import { ChevronRight, ArrowRight, PackageX, Phone, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getServiceBySlug, type ServicePackage } from '@/data/servicesData';

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
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

// ─── Package Card ─────────────────────────────────────────────────────────────
function PackageCard({ pkg, categorySlug }: { pkg: ServicePackage; categorySlug: string }) {
    const priceClass =
        pkg.priceColor === 'orange'
            ? 'text-orange-500'
            : pkg.priceColor === 'red'
                ? 'text-red-600'
                : 'text-blue-600';

    return (
        <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col">
            {/* Thumbnail */}
            <div className="relative overflow-hidden aspect-[4/3]">
                <img
                    src={pkg.thumbnail}
                    alt={pkg.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {pkg.badge && (
                    <span className="absolute top-2 left-2 bg-blue-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow">
                        {pkg.badge}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="flex flex-col flex-1 p-5 gap-3">
                <h3 className="font-bold text-blue-700 text-base leading-snug">{pkg.name}</h3>
                <p className={`text-xl font-extrabold ${priceClass}`}>{pkg.price}</p>
                <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 flex-1">
                    {pkg.description}
                </p>
            </div>

            {/* Footer */}
            <div className="px-5 pb-5">
                <Link
                    to={`/dich-vu/${categorySlug}/${pkg.id}`}
                    className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-4 text-sm font-medium border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                    Xem chi tiết <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>
        </div>
    );
}

// ─── Hotline CTA Banner ───────────────────────────────────────────────────────
function HotlineBanner() {
    return (
        <div className="w-full bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 rounded-2xl p-7 flex flex-col md:flex-row items-center justify-between gap-5 shadow-lg shadow-blue-500/20 my-10">
            <div className="flex items-center gap-4">
                <div className="w-13 h-13 rounded-full bg-white/20 flex items-center justify-center shrink-0">
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

// ─── Not Found State ──────────────────────────────────────────────────────────
function ServiceNotFound() {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-20">
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-6">
                <PackageX className="w-9 h-9 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Dịch vụ không tồn tại</h2>
            <p className="text-gray-500 mb-6 max-w-sm">
                Đường dẫn bạn truy cập không khớp với bất kỳ dịch vụ nào. Vui lòng quay lại trang chủ.
            </p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
                <Link to="/">Về trang chủ</Link>
            </Button>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ServiceDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const service = getServiceBySlug(slug ?? '');

    if (!service) return <ServiceNotFound />;

    return (
        <div className="min-h-screen bg-gray-50 pb-16">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

                {/* Breadcrumb */}
                <Breadcrumb label={service.title} />

                {/* Article header */}
                <h1 className="text-2xl md:text-3xl font-extrabold uppercase text-blue-900 leading-snug mb-3">
                    {service.bannerTitle}
                </h1>
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <time>Cập nhật: 10/03/2025</time>
                </div>

                {/* Hero cover image */}
                <div className="rounded-2xl overflow-hidden shadow-md mb-8">
                    <img
                        src={service.heroImage}
                        alt={service.bannerTitle}
                        className="w-full h-64 md:h-96 object-cover"
                    />
                </div>

                {/* ── Prose article content (WYSIWYG / CMS) ─────────────── */}
                {service.articleHtmlContent ? (
                    <div
                        className="
                            prose prose-blue max-w-none mb-4
                            prose-headings:text-blue-900 prose-headings:font-bold
                            prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
                            prose-h2:border-l-4 prose-h2:border-blue-500 prose-h2:pl-3
                            prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                            prose-p:text-gray-700 prose-p:leading-relaxed prose-p:text-sm
                            prose-li:text-gray-700 prose-li:text-sm prose-li:leading-relaxed
                            prose-strong:text-blue-900
                            prose-ul:space-y-1.5 prose-ul:pl-5
                            prose-img:rounded-xl prose-img:shadow-md prose-img:my-6
                            prose-table:border-collapse prose-table:w-full prose-table:text-sm
                            prose-th:bg-blue-50 prose-th:text-blue-900 prose-th:font-semibold
                            prose-th:border prose-th:border-blue-200 prose-th:px-3 prose-th:py-2.5
                            prose-td:border prose-td:border-gray-200 prose-td:px-3 prose-td:py-2.5
                            prose-td:text-gray-700
                        "
                        dangerouslySetInnerHTML={{ __html: service.articleHtmlContent }}
                    />
                ) : (
                    /* Fallback: show bannerDesc as intro paragraph */
                    <p className="text-gray-700 leading-relaxed text-sm mb-8 bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                        {service.bannerDesc}
                    </p>
                )}

                {/* Hotline banner */}
                <HotlineBanner />

                {/* ── Packages Grid ─────────────────────────────────────── */}
                {service.packages.length > 0 && (
                    <section>
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-extrabold uppercase text-blue-900 tracking-wide">
                                Các gói dịch vụ
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
                            {service.packages.map((pkg) => (
                                <PackageCard key={pkg.id} pkg={pkg} categorySlug={service.id} />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
