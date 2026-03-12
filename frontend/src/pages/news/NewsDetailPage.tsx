// src/pages/news/NewsDetailPage.tsx
import { useMemo } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { ChevronRight, CalendarDays, Home } from 'lucide-react';
import { NEWS_ARTICLES, NEWS_CATEGORIES } from '@/data/newsData';
import NewsCard from '@/components/news/NewsCard';
import NewsSubNav from '@/components/news/NewsSubNav';

export default function NewsDetailPage() {
    const { categorySlug, articleSlug } = useParams<{ categorySlug: string; articleSlug: string }>();

    // 1. Fetch current article
    const article = useMemo(() => {
        return NEWS_ARTICLES.find(
            (a) => a.categorySlug === categorySlug && a.slug === articleSlug
        );
    }, [categorySlug, articleSlug]);

    // 2. Lấy related articles (3 bài khác bài hiện tại)
    const relatedArticles = useMemo(() => {
        if (!article) return [];
        return NEWS_ARTICLES.filter(
            (a) => a.categorySlug === categorySlug && a.id !== article.id
        ).slice(0, 3);
    }, [categorySlug, article]);

    // Error handling nếu không tìm thấy bài
    if (!article) {
        return <Navigate to="/tin-tuc/y-hoc-thuong-thuc" replace />;
    }

    const category = NEWS_CATEGORIES.find((c) => c.slug === categorySlug);

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Nav Banner header chung */}
            <NewsSubNav />

            {/* Breadcrumb section */}
            <div className="bg-white border-b border-gray-200 py-3 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex items-center gap-1.5 text-xs text-gray-500 overflow-x-auto whitespace-nowrap hide-scrollbar">
                        <Link to="/" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                            <Home className="w-3.5 h-3.5" /> Trang chủ
                        </Link>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        <Link to="/tin-tuc" className="hover:text-blue-600 transition-colors">Tin tức</Link>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        <Link to={`/tin-tuc/${categorySlug}`} className="hover:text-blue-600 transition-colors">
                            {category?.label || 'Danh mục'}
                        </Link>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        <span className="text-gray-800 font-medium truncate max-w-[200px] md:max-w-[400px]">
                            {article.title}
                        </span>
                    </nav>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
                {/* ─── NỘI DUNG CHÍNH ────────────────────────────────────────────────── */}
                <article className="bg-white rounded-2xl p-6 md:p-10 shadow-sm border border-gray-100">
                    <header className="mb-8">
                        {/* Title */}
                        <h1 className="text-2xl md:text-4xl font-extrabold text-blue-900 leading-tight mb-4 uppercase">
                            {article.title}
                        </h1>

                        {/* Meta info */}
                        <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
                            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md font-medium">
                                <CalendarDays className="w-4 h-4" />
                                {article.publishedAt}
                            </div>
                            <div className="py-1 px-3 border border-gray-200 rounded-md font-medium text-gray-600">
                                {category?.label}
                            </div>
                        </div>

                        {/* Cover image */}
                        {article.imageUrl && (
                            <div className="rounded-xl overflow-hidden mb-8 shadow-sm">
                                <img
                                    src={article.imageUrl}
                                    alt={article.title}
                                    className="w-full h-auto max-h-[500px] object-cover"
                                />
                            </div>
                        )}
                        
                        {/* Summary / Sapo */}
                        <div className="text-lg font-medium text-gray-700 mb-8 pb-8 border-b border-gray-100 italic leading-relaxed">
                            {article.summary}
                        </div>
                    </header>

                    {/* Content CMS */}
                    {article.htmlContent ? (
                        <div
                            className="prose prose-blue prose-lg max-w-none prose-img:rounded-2xl prose-img:shadow-sm prose-headings:text-blue-900 prose-a:text-blue-600"
                            dangerouslySetInnerHTML={{ __html: article.htmlContent }}
                        />
                    ) : (
                        <div className="prose prose-blue max-w-none text-gray-500">
                            (Nội dung bài viết đang được cập nhật...)
                        </div>
                    )}
                </article>

                {/* ─── BÀI VIẾT LIÊN QUAN ────────────────────────────────────────────── */}
                {relatedArticles.length > 0 && (
                    <section className="mt-16">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl md:text-2xl font-bold text-blue-900 flex items-center gap-2">
                                <span className="block w-1.5 h-6 bg-blue-700 rounded-full" />
                                Cùng chuyên mục
                            </h2>
                            <Link
                                to={`/tin-tuc/${categorySlug}`}
                                className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                            >
                                Xem thêm <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {relatedArticles.map((rel) => (
                                <NewsCard key={rel.id} article={rel} />
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
