// src/components/news/NewsSubNav.tsx
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { NEWS_CATEGORIES } from '@/data/newsData';

export default function NewsSubNav() {
    const { pathname } = useLocation();

    return (
        <nav className="bg-white border-b border-blue-100 shadow-sm sticky top-16 z-40">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <ul className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                    {NEWS_CATEGORIES.map((cat) => {
                        const href = `/tin-tuc/${cat.slug}`;
                        const isActive = pathname === href || pathname.startsWith(href + '/');
                        return (
                            <li key={cat.slug}>
                                <Link
                                    to={href}
                                    className={cn(
                                        'inline-block px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors duration-200',
                                        isActive
                                            ? 'border-blue-700 text-blue-700 font-semibold'
                                            : 'border-transparent text-gray-600 hover:text-blue-700 hover:border-blue-300',
                                    )}
                                >
                                    {cat.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </nav>
    );
}
