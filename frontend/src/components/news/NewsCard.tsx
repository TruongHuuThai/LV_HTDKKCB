// src/components/news/NewsCard.tsx
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import type { NewsArticle } from '@/data/newsData';

interface Props {
    article: NewsArticle;
}

export default function NewsCard({ article }: Props) {
    const href = `/tin-tuc/${article.categorySlug}/${article.slug}`;

    return (
        <Link
            to={href}
            className="group flex flex-col bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md border border-gray-100 hover:border-blue-100 transition-all duration-300 hover:-translate-y-0.5"
        >
            {/* Thumbnail — tỉ lệ 16:9 */}
            <div className="relative overflow-hidden" style={{ paddingTop: '56.25%' }}>
                <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                />
            </div>

            {/* Nội dung */}
            <div className="flex flex-col flex-1 p-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                    <CalendarDays className="w-3 h-3" />
                    {article.publishedAt}
                </div>
                <h3 className="text-sm font-bold uppercase text-blue-900 leading-snug line-clamp-2 mb-2 group-hover:text-blue-700 transition-colors">
                    {article.title}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-3 flex-1">
                    {article.summary}
                </p>
            </div>
        </Link>
    );
}
