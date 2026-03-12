// src/components/services/PackageCard.tsx
// Card thẻ gói khám — dùng cho grid danh sách trong ServiceCategoryPage.
// Toàn bộ thẻ là một Link clickable.
// Hiệu ứng hover: nền phần thông tin chuyển xanh, chữ chuyển trắng.

import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import type { ServicePackage } from '@/data/servicesData';

interface PackageCardProps {
    pkg: ServicePackage;
    categorySlug: string;
    /** Optional: ngày đăng bài (lấy từ servicePackageDetails nếu có, fallback để trống) */
    publishedAt?: string;
}

export default function PackageCard({ pkg, categorySlug, publishedAt }: PackageCardProps) {
    const href = `/dich-vu/${categorySlug}/${pkg.id}`;

    return (
        <Link
            to={href}
            className="group block cursor-pointer overflow-hidden rounded-xl bg-white shadow-md transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
        >
            {/* ── Phần ảnh thumbnail ─────────────────────────── */}
            <div className="relative overflow-hidden">
                {pkg.badge && (
                    <span className="absolute top-2 left-2 z-10 bg-blue-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow">
                        {pkg.badge}
                    </span>
                )}
                <img
                    src={pkg.imageUrl ?? pkg.thumbnail}
                    alt={pkg.name}
                    className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-105"
                />
            </div>

            {/* ── Phần thông tin — đổi màu khi hover ─────────── */}
            <div className="p-4 transition-colors duration-300 group-hover:bg-blue-600">
                {/* Ngày đăng */}
                {publishedAt && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 group-hover:text-blue-100 mb-2 transition-colors duration-300">
                        <CalendarDays className="w-3 h-3" />
                        <span>{publishedAt}</span>
                    </div>
                )}

                {/* Tên gói khám */}
                <h3 className="font-bold text-sm uppercase text-blue-900 leading-snug line-clamp-2 mb-2 transition-colors duration-300 group-hover:text-white">
                    {pkg.name}
                </h3>

                {/* Mô tả ngắn */}
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-3 transition-colors duration-300 group-hover:text-blue-100">
                    {pkg.summary ?? pkg.description}
                </p>

                {/* Giá */}
                <div className="mt-3 flex items-center justify-between">
                    <span className="text-base font-extrabold text-blue-600 group-hover:text-white transition-colors duration-300">
                        {pkg.price}
                    </span>
                    <span className="text-xs font-medium text-blue-600 group-hover:text-blue-100 transition-colors duration-300 underline underline-offset-2">
                        Xem chi tiết →
                    </span>
                </div>
            </div>
        </Link>
    );
}
