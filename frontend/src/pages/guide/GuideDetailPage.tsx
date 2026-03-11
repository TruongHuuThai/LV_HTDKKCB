// src/pages/guide/GuideDetailPage.tsx
import { useParams, Navigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { GUIDE_ARTICLES, GUIDE_MENU } from '@/data/guidesData';
import { BookOpen, CheckCircle2 } from 'lucide-react';

// ── Sidebar ──────────────────────────────────────────────────────────────────
function GuideSidebar({ activeSlug }: { activeSlug: string }) {
    return (
        <aside className="w-full">
            {/* Header */}
            <div className="bg-blue-800 text-white rounded-t-xl px-5 py-4 flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 shrink-0 text-blue-200" />
                <span className="text-sm font-bold uppercase tracking-wide leading-tight">
                    Hướng dẫn khách hàng
                </span>
            </div>

            {/* Links */}
            <nav className="bg-white border border-t-0 border-blue-100 rounded-b-xl overflow-hidden shadow-sm">
                {GUIDE_MENU.map((item, idx) => {
                    const isActive = activeSlug === item.slug;
                    return (
                        <Link
                            key={item.slug}
                            to={`/huong-dan/${item.slug}`}
                            className={cn(
                                'flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors border-l-4',
                                idx !== GUIDE_MENU.length - 1 && 'border-b border-blue-50',
                                isActive
                                    ? 'border-l-blue-600 bg-blue-50 text-blue-700'
                                    : 'border-l-transparent text-gray-600 hover:bg-gray-50 hover:text-blue-700',
                            )}
                        >
                            <CheckCircle2
                                className={cn(
                                    'w-4 h-4 shrink-0',
                                    isActive ? 'text-blue-600' : 'text-gray-300',
                                )}
                            />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}

// ── Step Card ─────────────────────────────────────────────────────────────────
function StepTimeline({ steps }: { steps: NonNullable<(typeof GUIDE_ARTICLES)[number]['steps']> }) {
    return (
        <div className="mt-8">
            <h2 className="text-xl font-bold text-blue-900 mb-6 flex items-center gap-2">
                <span className="block w-1 h-6 bg-blue-700 rounded-full" />
                Các bước thực hiện
            </h2>
            <div className="space-y-6">
                {steps.map((step, idx) => (
                    <div key={idx} className="flex gap-5 group">
                        {/* Step number + connector */}
                        <div className="flex flex-col items-center shrink-0">
                            <div className="w-10 h-10 rounded-full bg-blue-700 text-white flex items-center justify-center text-sm font-bold shadow-md group-hover:bg-blue-800 transition-colors">
                                {idx + 1}
                            </div>
                            {idx < steps.length - 1 && (
                                <div className="flex-1 w-0.5 bg-blue-200 mt-2 min-h-[2rem]" />
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 pb-4">
                            <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                {step.imageUrl && (
                                    <img
                                        src={step.imageUrl}
                                        alt={step.title}
                                        className="w-full h-40 object-cover"
                                    />
                                )}
                                <div className="p-5">
                                    <h3 className="text-base font-bold text-blue-900 mb-2">
                                        {step.title}
                                    </h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">
                                        {step.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GuideDetailPage() {
    const { slug } = useParams<{ slug: string }>();

    const article = GUIDE_ARTICLES.find((a) => a.slug === slug);
    if (!article) return <Navigate to="/huong-dan/quy-trinh-dat-lich" replace />;

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* ── Sidebar (25%) ─────────────────────── */}
                    <div className="lg:w-[25%] shrink-0">
                        <div className="sticky top-24">
                            <GuideSidebar activeSlug={slug ?? ''} />
                        </div>
                    </div>

                    {/* ── Main Content (75%) ────────────────── */}
                    <main className="flex-1 min-w-0">
                        {/* Banner */}
                        <div className="rounded-2xl overflow-hidden shadow-md mb-7">
                            <img
                                src={article.coverImage}
                                alt={article.title}
                                className="w-full h-48 md:h-64 object-cover"
                            />
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl md:text-3xl font-extrabold text-blue-900 mb-2 leading-snug">
                            {article.title}
                        </h1>
                        {article.subtitle && (
                            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                                {article.subtitle}
                            </p>
                        )}

                        {/* Divider */}
                        <div className="flex items-center gap-2 mb-8">
                            <span className="block h-0.5 w-12 bg-blue-600 rounded-full" />
                            <span className="block h-0.5 flex-1 bg-blue-100 rounded-full" />
                        </div>

                        {/* HTML Content (prose) */}
                        <div
                            className="prose prose-blue max-w-none
                                prose-headings:text-blue-900 prose-headings:font-bold prose-headings:mt-6 prose-headings:mb-3
                                prose-h2:text-lg prose-h2:border-b prose-h2:border-blue-100 prose-h2:pb-2
                                prose-p:text-gray-700 prose-p:leading-relaxed prose-p:text-sm
                                prose-li:text-gray-700 prose-li:text-sm prose-li:leading-relaxed
                                prose-strong:text-blue-900 prose-strong:font-semibold
                                prose-ul:space-y-1.5"
                            dangerouslySetInnerHTML={{ __html: article.htmlContent }}
                        />

                        {/* Steps Timeline */}
                        {article.steps && article.steps.length > 0 && (
                            <StepTimeline steps={article.steps} />
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
