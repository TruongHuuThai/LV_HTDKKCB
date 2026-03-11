// src/pages/services/ServicePackageDetailPage.tsx
import { Link, useParams, Navigate } from 'react-router-dom';
import { ChevronRight, CalendarDays, Phone, ArrowRight } from 'lucide-react';
import {
    getPackageDetail,
    getRelatedPackages,
    type ServicePackageDetail,
} from '@/data/servicePackageDetails';
import { getServiceBySlug } from '@/data/servicesData';

// ── Breadcrumb ────────────────────────────────────────────────────────────────
function Breadcrumb({
    categorySlug,
    categoryTitle,
    packageTitle,
}: {
    categorySlug: string;
    categoryTitle: string;
    packageTitle: string;
}) {
    return (
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500 mb-7">
            <Link to="/" className="hover:text-blue-600 transition-colors">
                Trang chủ
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <Link to={`/dich-vu/${categorySlug}`} className="hover:text-blue-600 transition-colors">
                {categoryTitle}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <span className="text-blue-700 font-medium line-clamp-1">{packageTitle}</span>
        </nav>
    );
}

// ── Related Package Mini Card ─────────────────────────────────────────────────
function RelatedCard({ pkg }: { pkg: ServicePackageDetail }) {
    return (
        <Link
            to={`/dich-vu/${pkg.categorySlug}/${pkg.slug}`}
            className="group flex flex-col bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md border border-gray-100 hover:border-blue-100 transition-all duration-300 hover:-translate-y-0.5"
        >
            <div className="relative overflow-hidden" style={{ paddingTop: '52%' }}>
                <img
                    src={pkg.coverImage}
                    alt={pkg.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                />
            </div>
            <div className="p-4 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <CalendarDays className="w-3 h-3" />
                    {pkg.publishedAt}
                </div>
                <h3 className="text-sm font-bold uppercase text-blue-900 line-clamp-2 group-hover:text-blue-700 transition-colors">
                    {pkg.title}
                </h3>
                <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium mt-auto group-hover:gap-2 transition-all">
                    Xem chi tiết <ArrowRight className="w-3.5 h-3.5" />
                </span>
            </div>
        </Link>
    );
}

// ── Hotline Banner ────────────────────────────────────────────────────────────
function HotlineBanner() {
    return (
        <div className="w-full bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg shadow-blue-500/20 my-10">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Phone className="w-7 h-7 text-white" />
                </div>
                <div className="text-white">
                    <p className="text-sm font-medium text-blue-100 mb-0.5">
                        Đặt lịch &amp; Tư vấn miễn phí
                    </p>
                    <p className="text-3xl font-extrabold tracking-wide">
                        (084) 867 504 590
                    </p>
                    <p className="text-xs text-blue-200 mt-0.5">
                        Thứ 2 – Thứ 7: 7:00 – 20:00 | Chủ nhật: 7:00 – 12:00
                    </p>
                </div>
            </div>
            <Link
                to="/booking"
                className="shrink-0 bg-white text-blue-700 font-bold px-7 py-3 rounded-xl shadow hover:bg-blue-50 transition-colors text-sm"
            >
                Đặt lịch ngay →
            </Link>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ServicePackageDetailPage() {
    const { categorySlug, packageSlug } = useParams<{
        categorySlug: string;
        packageSlug: string;
    }>();

    const detail = getPackageDetail(categorySlug ?? '', packageSlug ?? '');
    if (!detail) return <Navigate to="/dich-vu/kham-tong-quat-ca-nhan" replace />;

    const serviceGroup = getServiceBySlug(categorySlug ?? '');
    const related = getRelatedPackages(categorySlug ?? '', packageSlug ?? '', 3);

    return (
        <div className="min-h-screen bg-gray-50 pb-16">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
                {/* Breadcrumb */}
                <Breadcrumb
                    categorySlug={categorySlug ?? ''}
                    categoryTitle={serviceGroup?.title ?? 'Dịch vụ'}
                    packageTitle={detail.title}
                />

                {/* Article header */}
                <h1 className="text-2xl md:text-3xl font-extrabold uppercase text-blue-900 leading-snug mb-3">
                    {detail.title}
                </h1>
                <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
                    <CalendarDays className="w-3.5 h-3.5" />
                    <time dateTime={detail.publishedAt}>{detail.publishedAt}</time>
                </div>

                {/* Cover image */}
                <div className="rounded-2xl overflow-hidden shadow-md mb-8">
                    <img
                        src={detail.coverImage}
                        alt={detail.title}
                        className="w-full h-64 md:h-96 object-cover"
                    />
                </div>

                {/* ── Main prose content (WYSIWYG rendered) ─────────────── */}
                <div
                    className="
                        prose prose-blue max-w-none
                        prose-headings:text-blue-900 prose-headings:font-bold
                        prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:border-b prose-h2:border-blue-100 prose-h2:pb-2
                        prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                        prose-p:text-gray-700 prose-p:leading-relaxed prose-p:text-sm
                        prose-li:text-gray-700 prose-li:text-sm prose-li:leading-relaxed
                        prose-strong:text-blue-900 prose-strong:font-semibold
                        prose-ul:space-y-1.5 prose-ul:pl-5
                        prose-img:rounded-xl prose-img:shadow-md prose-img:my-6

                        prose-table:border-collapse prose-table:w-full prose-table:text-sm
                        prose-thead:bg-blue-50
                        prose-th:bg-blue-50 prose-th:text-blue-900 prose-th:font-semibold
                        prose-th:border prose-th:border-blue-200 prose-th:px-3 prose-th:py-2.5
                        prose-td:border prose-td:border-gray-200 prose-td:px-3 prose-td:py-2.5
                        prose-td:text-gray-700
                        even:prose-tr:bg-gray-50
                        prose-tfoot:bg-blue-50/60 prose-tfoot:font-medium
                    "
                    dangerouslySetInnerHTML={{ __html: detail.htmlContent }}
                />

                {/* Hotline banner */}
                <HotlineBanner />

                {/* Related packages */}
                {related.length > 0 && (
                    <section>
                        <div className="text-center mb-7">
                            <h2 className="text-2xl font-extrabold uppercase text-blue-900 tracking-wide">
                                Gói khám khác
                            </h2>
                            <div className="mt-3 flex items-center justify-center gap-2">
                                <span className="block w-14 h-0.5 bg-blue-300 rounded-full" />
                                <span className="block w-2.5 h-2.5 rounded-full bg-blue-600" />
                                <span className="block w-14 h-0.5 bg-blue-300 rounded-full" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {related.map((r) => (
                                <RelatedCard key={r.id} pkg={r} />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
