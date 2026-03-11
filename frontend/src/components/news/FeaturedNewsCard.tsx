// src/components/news/FeaturedNewsCard.tsx
import { Link } from 'react-router-dom';
import { CalendarDays, ArrowRight } from 'lucide-react';
import type { NewsArticle } from '@/data/newsData';

interface Props {
    article: NewsArticle;
}

export default function FeaturedNewsCard({ article }: Props) {
    const href = `/tin-tuc/${article.categorySlug}/${article.slug}`;

    return (
        <div className="flex flex-col md:flex-row rounded-2xl overflow-hidden shadow-md border border-blue-100 bg-white hover:shadow-lg transition-shadow duration-300 group">
            {/* Ảnh — 60% chiều rộng trên desktop */}
            <Link
                to={href}
                className="md:w-[60%] shrink-0 overflow-hidden block"
            >
                <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-full h-56 md:h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                />
            </Link>

            {/* Nội dung */}
            <div className="flex flex-col justify-between p-6 md:p-8 bg-gray-50 md:w-[40%]">
                <div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {article.publishedAt}
                    </div>
                    <Link to={href}>
                        <h2 className="text-xl md:text-2xl font-bold uppercase text-blue-900 leading-snug mb-3 hover:text-blue-700 transition-colors line-clamp-3">
                            {article.title}
                        </h2>
                    </Link>
                    <p className="text-sm md:text-base text-gray-600 leading-relaxed line-clamp-4">
                        {article.summary}
                    </p>
                </div>

                <Link
                    to={href}
                    className="mt-6 inline-flex items-center gap-2 self-start bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors duration-200"
                >
                    Xem chi tiết
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}
