// src/pages/specialty/SpecialtyDetailPage.tsx
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    ChevronRight, Home, Stethoscope,
    Heart, Scissors, Baby, ScanLine,
    ActivitySquare, Brain, Sparkles, Loader2, AlertCircle,
} from 'lucide-react';
import {
    Carousel, CarouselContent, CarouselItem,
    CarouselNext, CarouselPrevious,
} from '@/components/ui/carousel';
import { useSpecialties } from '@/hooks/useSpecialties';
import { SPECIALTIES_DATA } from '@/data/specialtiesData';
import { toSlug } from '@/lib/utils';
import type { Specialty } from '@/services/api';

// ─── Icon mapping ─────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
    Heart, Scissors, Baby, ScanLine, ActivitySquare, Brain, Sparkles, Stethoscope,
};

function getIcon(slug: string): React.ElementType {
    const match = SPECIALTIES_DATA.find((s) => s.slug === slug);
    return match ? (ICON_MAP[match.iconName] ?? Stethoscope) : Stethoscope;
}

function SpecialtyIcon({ slug, className }: { slug: string; className?: string }) {
    const Icon = getIcon(slug);
    return <Icon className={className ?? 'w-7 h-7 text-white'} />;
}

// ─── Not Found ────────────────────────────────────────────────────────────────
function NotFound() {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Stethoscope className="w-8 h-8 text-blue-300" />
            </div>
            <h1 className="text-2xl font-bold text-gray-700">Chuyên khoa không tồn tại</h1>
            <p className="text-gray-400 max-w-sm">Chuyên khoa bạn tìm kiếm không có trong hệ thống.</p>
            <Link to="/chuyen-khoa" className="text-blue-600 hover:underline font-medium text-sm">
                ← Xem tất cả chuyên khoa
            </Link>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SpecialtyDetailPage() {
    const { slug } = useParams<{ slug: string }>();
    const { data: specialties = [], isLoading, isError } = useSpecialties();

    // Find the specialty whose CK_TEN slugifies to the URL slug
    const specialty: Specialty | undefined = useMemo(() => {
        if (!slug) return undefined;
        return specialties.find((s) => toSlug(s.CK_TEN) === slug);
    }, [slug, specialties]);

    // Enrichment data from mock: images, rich description, icon
    const enrichment = useMemo(
        () => SPECIALTIES_DATA.find((s) => s.slug === slug),
        [slug],
    );

    // Other specialties for footer nav
    const others = useMemo(
        () => specialties.filter((s) => toSlug(s.CK_TEN) !== slug),
        [slug, specialties],
    );

    // ── Loading ──
    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <p className="text-gray-400 text-sm">Đang tải chuyên khoa...</p>
            </div>
        );
    }

    // ── Error ──
    if (isError) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
                <AlertCircle className="w-10 h-10 text-red-300" />
                <h2 className="text-lg font-semibold text-gray-700">Không thể tải dữ liệu</h2>
                <p className="text-gray-400 text-sm">Vui lòng thử lại sau.</p>
                <Link to="/chuyen-khoa" className="text-blue-600 hover:underline text-sm">← Quay lại danh sách</Link>
            </div>
        );
    }

    // ── Not found (after data loaded) ──
    if (!specialty) return <NotFound />;

    const currentSlug = slug ?? '';

    // Build description content
    const hasRichDesc = Boolean(enrichment?.description);
    const hasDbDesc = Boolean(specialty.CK_MO_TA);
    const hasDbTarget = Boolean(specialty.CK_DOI_TUONG_KHAM);

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* ── Hero ── */}
            <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 py-14 text-center text-white">
                <div className="max-w-3xl mx-auto px-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
                        <SpecialtyIcon slug={currentSlug} />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight uppercase">
                        {specialty.CK_TEN}
                    </h1>
                    <div className="w-16 h-1 bg-blue-300 rounded-full mx-auto mt-4" />
                    {specialty.CK_MO_TA && (
                        <p className="text-blue-100 mt-3 text-sm max-w-xl mx-auto">{specialty.CK_MO_TA}</p>
                    )}
                </div>
            </section>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Breadcrumb */}
                <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-8">
                    <Link to="/" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                        <Home className="w-3.5 h-3.5" /> Trang chủ
                    </Link>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                    <Link to="/chuyen-khoa" className="hover:text-blue-600 transition-colors">Chuyên khoa</Link>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                    <span className="text-gray-800 font-medium">{specialty.CK_TEN}</span>
                </nav>

                {/* ── Content Card ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
                    {hasRichDesc ? (
                        // Rich HTML description from mock enrichment
                        <div
                            className="
                                prose prose-blue max-w-none
                                [&_h2]:text-blue-800 [&_h2]:font-bold [&_h2]:text-lg [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:border-l-4 [&_h2]:border-blue-500 [&_h2]:pl-3
                                [&_p]:text-gray-600 [&_p]:leading-relaxed [&_p]:mb-4
                                [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_ul]:mb-4
                                [&_li]:text-gray-600 [&_li]:leading-relaxed
                                [&_h2:first-child]:mt-0
                            "
                            dangerouslySetInnerHTML={{ __html: enrichment!.description }}
                        />
                    ) : (
                        // Fallback: show DB fields
                        <div className="space-y-4">
                            {hasDbDesc && (
                                <div>
                                    <h2 className="text-blue-800 font-bold text-lg mb-2 border-l-4 border-blue-500 pl-3">
                                        Giới thiệu
                                    </h2>
                                    <p className="text-gray-600 leading-relaxed">{specialty.CK_MO_TA}</p>
                                </div>
                            )}
                            {hasDbTarget && (
                                <div>
                                    <h2 className="text-blue-800 font-bold text-lg mb-2 border-l-4 border-blue-500 pl-3">
                                        Đối tượng khám
                                    </h2>
                                    <p className="text-gray-600 leading-relaxed">{specialty.CK_DOI_TUONG_KHAM}</p>
                                </div>
                            )}
                            {!hasDbDesc && !hasDbTarget && (
                                <p className="text-gray-400 text-sm italic">Nội dung chi tiết đang được cập nhật.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Image Carousel (from enrichment) ── */}
                {enrichment?.images && enrichment.images.length > 0 && (
                    <div className="mb-10">
                        <h2 className="text-base font-bold text-blue-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <span className="w-1 h-5 bg-blue-600 rounded-full inline-block" />
                            Cơ sở vật chất
                        </h2>
                        <Carousel opts={{ align: 'start', loop: true }} className="w-full">
                            <CarouselContent className="-ml-3">
                                {enrichment.images.map((src, i) => (
                                    <CarouselItem key={i} className="pl-3 basis-full sm:basis-1/2 lg:basis-1/3">
                                        <div className="rounded-xl overflow-hidden shadow-sm border border-gray-100">
                                            <img
                                                src={src}
                                                alt={`${specialty.CK_TEN} - ảnh ${i + 1}`}
                                                className="w-full h-48 object-cover"
                                            />
                                        </div>
                                    </CarouselItem>
                                ))}
                            </CarouselContent>
                            <div className="flex justify-center gap-3 mt-4">
                                <CarouselPrevious className="static translate-y-0 bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-blue-700" />
                                <CarouselNext className="static translate-y-0 bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-blue-700" />
                            </div>
                        </Carousel>
                    </div>
                )}

                {/* ── CTA ── */}
                <div className="flex flex-wrap gap-3 mb-12">
                    <Link
                        to={`/doi-ngu-bac-si/${currentSlug}`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors shadow-sm"
                    >
                        <Stethoscope className="w-4 h-4" />
                        Xem bác sĩ chuyên khoa
                    </Link>
                    <Link
                        to="/booking"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-500 text-white text-sm font-semibold transition-colors shadow-sm"
                    >
                        Đặt lịch khám ngay
                    </Link>
                </div>

                {/* ── Other Specialties Carousel (from API) ── */}
                {others.length > 0 && (
                    <div>
                        <h2 className="text-base font-bold text-blue-900 uppercase tracking-wide mb-4 text-center">
                            Chuyên khoa khác
                        </h2>
                        <div className="flex items-center justify-center gap-3 mb-6">
                            <span className="h-px w-12 bg-blue-200" />
                            <Stethoscope className="w-4 h-4 text-blue-300" />
                            <span className="h-px w-12 bg-blue-200" />
                        </div>

                        <Carousel opts={{ align: 'start', loop: true }} className="w-full">
                            <CarouselContent className="-ml-3">
                                {others.map((sp) => {
                                    const spSlug = toSlug(sp.CK_TEN);
                                    const SpIcon = getIcon(spSlug);
                                    return (
                                        <CarouselItem key={sp.CK_MA} className="pl-3 basis-1/2 sm:basis-1/3 lg:basis-1/4">
                                            <Link
                                                to={`/chuyen-khoa/${spSlug}`}
                                                className="group flex flex-col items-center gap-2 p-4 bg-white border border-gray-100 rounded-xl shadow-sm
                                                           hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center"
                                            >
                                                <div className="w-11 h-11 rounded-xl bg-blue-700 group-hover:bg-blue-600 flex items-center justify-center transition-colors shadow-sm">
                                                    <SpIcon className="w-5 h-5 text-white" />
                                                </div>
                                                <span className="text-xs font-semibold text-blue-800 uppercase leading-snug group-hover:text-blue-600 transition-colors">
                                                    {sp.CK_TEN}
                                                </span>
                                            </Link>
                                        </CarouselItem>
                                    );
                                })}
                            </CarouselContent>
                            <div className="flex justify-center gap-3 mt-4">
                                <CarouselPrevious className="static translate-y-0 bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-blue-700" />
                                <CarouselNext className="static translate-y-0 bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-blue-700" />
                            </div>
                        </Carousel>
                    </div>
                )}
            </div>
        </div>
    );
}
