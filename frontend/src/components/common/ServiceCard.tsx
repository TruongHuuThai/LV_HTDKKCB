// src/components/common/ServiceCard.tsx
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface ServiceCardProps {
    image?: string;
    title: string;
    price: string;
    priceColor?: 'blue' | 'red';
    href?: string;
    badge?: string;
    description?: string;
}

export default function ServiceCard({
    image = 'https://placehold.co/600x400/dbeafe/1e40af?text=Gói+Khám',
    title,
    price,
    priceColor = 'blue',
    href = '#',
    badge,
    description,
}: ServiceCardProps) {
    return (
        <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 overflow-hidden flex flex-col">
            {/* Image */}
            <div className="relative overflow-hidden aspect-[3/2]">
                <img
                    src={image}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {badge && (
                    <span className="absolute top-2 left-2 bg-blue-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow">
                        {badge}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="flex flex-col flex-1 p-5 gap-3">
                <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-2">{title}</h3>
                {description && (
                    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{description}</p>
                )}
                <div className="mt-auto flex items-center justify-between gap-2">
                    <span
                        className={`text-lg font-extrabold ${priceColor === 'red' ? 'text-red-600' : 'text-blue-600'
                            }`}
                    >
                        {price}
                    </span>
                    <Button variant="outline" size="sm" asChild className="border-blue-600 text-blue-600 hover:bg-blue-50 shrink-0">
                        <Link to={href}>Xem chi tiết</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
