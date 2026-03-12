// src/pages/news/NewsCategoryPage.tsx
import { useMemo, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { NEWS_ARTICLES, NEWS_CATEGORIES } from '@/data/newsData';
import NewsSubNav from '@/components/news/NewsSubNav';
import FeaturedNewsCard from '@/components/news/FeaturedNewsCard';
import NewsCard from '@/components/news/NewsCard';

// ── Dynamic pagination UI ──────────────────────────────────────────────────────
interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-center gap-2 mt-10">
            {/* Previous Button */}
            <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-full text-sm font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
                <ChevronRight className="w-4 h-4 rotate-180" /> Trước
            </button>

            {/* Page Numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`w-9 h-9 rounded-full text-sm font-semibold transition-colors ${page === currentPage
                            ? 'bg-blue-700 text-white shadow-sm'
                            : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
                        }`}
                >
                    {page}
                </button>
            ))}

            {/* Next Button */}
            <button
                onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-full text-sm font-semibold bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
                Tiếp <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function NewsCategoryPage() {
    const { categorySlug } = useParams<{ categorySlug: string }>();

    const featured = useMemo(
        () => NEWS_ARTICLES.find((a) => a.categorySlug === categorySlug && a.isFeatured),
        [categorySlug],
    );

    const gridArticles = useMemo(
        () => NEWS_ARTICLES.filter((a) => a.categorySlug === categorySlug && !a.isFeatured),
        [categorySlug],
    );

    const ITEMS_PER_PAGE = 6;
    const [currentPage, setCurrentPage] = useState(1);
    const [currentCategory, setCurrentCategory] = useState(categorySlug);

    // Reset page on category change (React 18+ recommended pattern for derived state)
    if (categorySlug !== currentCategory) {
        setCurrentCategory(categorySlug);
        setCurrentPage(1);
    }

    const totalPages = Math.ceil(gridArticles.length / ITEMS_PER_PAGE);
    const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
    const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
    const currentItems = gridArticles.slice(indexOfFirstItem, indexOfLastItem);

    // Validate category
    const category = NEWS_CATEGORIES.find((c) => c.slug === categorySlug);
    if (!category) return <Navigate to="/tin-tuc/y-hoc-thuong-thuc" replace />;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Sub Navigation */}
            <NewsSubNav />

            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Category heading */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl md:text-4xl font-extrabold uppercase text-blue-900 tracking-wide">
                        {category.label}
                    </h1>
                    {/* Decorative divider */}
                    <div className="mt-3 flex items-center justify-center gap-2">
                        <span className="block w-16 h-0.5 bg-blue-300 rounded-full" />
                        <span className="block w-3 h-3 rounded-full bg-blue-600" />
                        <span className="block w-16 h-0.5 bg-blue-300 rounded-full" />
                    </div>
                </div>

                {/* Featured article - Chỉ hiện ở trang 1 */}
                {currentPage === 1 && featured && (
                    <section className="mb-10">
                        <FeaturedNewsCard article={featured} />
                    </section>
                )}

                {/* Grid articles - slice theo phân trang */}
                {currentItems.length > 0 && (
                    <section>
                        <h2 className="text-lg font-bold text-blue-900 mb-5 flex items-center gap-2">
                            <span className="block w-1 h-5 bg-blue-700 rounded-full" />
                            Bài viết mới nhất
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {currentItems.map((article) => (
                                <NewsCard key={article.id} article={article} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Pagination */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </main>
        </div>
    );
}
