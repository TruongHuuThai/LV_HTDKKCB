// src/pages/specialty/SpecialtyListPage.tsx
import { Link } from 'react-router-dom';
import {
    Heart, Scissors, Baby, ScanLine,
    ActivitySquare, Brain, Sparkles, Stethoscope,
    Loader2, AlertCircle,
} from 'lucide-react';
import { useSpecialties } from '@/hooks/useSpecialties';
import { SPECIALTIES_DATA } from '@/data/specialtiesData';
import { toSlug } from '@/lib/utils';
import type { Specialty } from '@/services/api';

// ─── Icon mapping — fallback icon from mock data by matching slug ─────────────
const ICON_MAP: Record<string, React.ElementType> = {
    Heart, Scissors, Baby, ScanLine,
    ActivitySquare, Brain, Sparkles, Stethoscope,
};

function getIconForSpecialty(slug: string): React.ElementType {
    const match = SPECIALTIES_DATA.find((s) => s.slug === slug);
    return match ? (ICON_MAP[match.iconName] ?? Stethoscope) : Stethoscope;
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function SpecialtyCard({ specialty }: { specialty: Specialty }) {
    const slug = toSlug(specialty.CK_TEN);
    const Icon = getIconForSpecialty(slug);

    return (
        <Link
            to={`/chuyen-khoa/${slug}`}
            className="group flex items-center gap-4 bg-white border border-gray-100 rounded-xl
                       shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 p-4"
        >
            {/* Icon box */}
            <div className="shrink-0 w-12 h-12 rounded-lg bg-blue-700 flex items-center justify-center
                            group-hover:bg-blue-600 transition-colors shadow-sm">
                <Icon className="w-6 h-6 text-white" />
            </div>

            {/* Text */}
            <div className="min-w-0">
                <p className="font-bold text-blue-800 uppercase tracking-wide text-sm leading-snug group-hover:text-blue-600 transition-colors">
                    {specialty.CK_TEN}
                </p>
                {specialty.CK_MO_TA && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{specialty.CK_MO_TA}</p>
                )}
            </div>

            {/* Arrow */}
            <div className="ml-auto shrink-0 text-gray-300 group-hover:text-blue-500 transition-colors text-base">→</div>
        </Link>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SpecialtyListPage() {
    const { data: specialties = [], isLoading, isError } = useSpecialties();

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* Hero */}
            <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 py-14 text-center text-white">
                <div className="max-w-2xl mx-auto px-4">
                    <p className="text-blue-200 text-xs uppercase tracking-[0.25em] font-semibold mb-3">UMC Clinic</p>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight uppercase">Chuyên khoa</h1>
                    <div className="w-16 h-1 bg-blue-300 rounded-full mx-auto mt-4" />
                    <p className="text-blue-100 mt-4 text-sm max-w-md mx-auto leading-relaxed">
                        Chọn chuyên khoa phù hợp để được tư vấn và thăm khám bởi đội ngũ bác sĩ chuyên gia hàng đầu.
                    </p>
                </div>
            </section>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Section header */}
                <div className="text-center mb-10">
                    <h2 className="text-xl font-bold text-blue-900 uppercase tracking-wide">
                        Danh sách chuyên khoa
                    </h2>
                    <div className="flex items-center justify-center gap-3 mt-3">
                        <span className="h-px w-16 bg-blue-200" />
                        <Stethoscope className="w-4 h-4 text-blue-400" />
                        <span className="h-px w-16 bg-blue-200" />
                    </div>
                </div>

                {/* States */}
                {isLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 bg-white border border-gray-100 rounded-xl p-4 animate-pulse">
                                <div className="w-12 h-12 rounded-lg bg-blue-100 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                                    <div className="h-3 bg-gray-100 rounded w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {isError && !isLoading && (
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                        <AlertCircle className="w-10 h-10 text-red-300" />
                        <p className="text-gray-500 text-sm">Không thể tải danh sách chuyên khoa. Vui lòng thử lại.</p>
                    </div>
                )}

                {/* Grid */}
                {!isLoading && !isError && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {specialties.map((specialty) => (
                            <SpecialtyCard key={specialty.CK_MA} specialty={specialty} />
                        ))}
                    </div>
                )}

                {!isLoading && !isError && specialties.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                        <Stethoscope className="w-10 h-10 text-blue-200" />
                        <p className="text-gray-400 text-sm">Chưa có chuyên khoa nào trong hệ thống.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
