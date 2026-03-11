// src/pages/doctors/DoctorsPage.tsx
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    ChevronRight, Home, Users, Stethoscope,
    AlertCircle, Loader2,
} from 'lucide-react';
import DoctorCard from '@/components/doctors/DoctorCard';
import { useSpecialties, type Specialty } from '@/hooks/useSpecialties';
import { useDoctors } from '@/hooks/useDoctors';

// ─── Slug helper (must match the one used in Header DoctorsDropdown) ──────────
function toSlug(name: string) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/\s+/g, '-');
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function Breadcrumb({ label }: { label?: string }) {
    return (
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
            <Link to="/" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                <Home className="w-3.5 h-3.5" /> Trang chủ
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
            <Link to="/doi-ngu-bac-si" className="hover:text-blue-600 transition-colors">
                Đội ngũ bác sĩ
            </Link>
            {label && (
                <>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                    <span className="text-gray-800 font-medium">{label}</span>
                </>
            )}
        </nav>
    );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function DoctorSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col sm:flex-row animate-pulse">
            <div className="shrink-0 w-full sm:w-[150px] h-[200px] bg-gray-200" />
            <div className="flex-1 p-5 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-5 bg-gray-200 rounded w-2/3" />
                <div className="space-y-2 mt-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-3 bg-gray-100 rounded w-full" />
                    ))}
                </div>
                <div className="flex gap-2 mt-4">
                    <div className="h-8 w-28 bg-gray-200 rounded-lg" />
                    <div className="h-8 w-32 bg-gray-200 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
interface SidebarProps {
    activeSlug?: string;
    specialties: Specialty[];
    isLoading: boolean;
}

function SpecialtySidebar({ activeSlug, specialties, isLoading }: SidebarProps) {
    return (
        <aside className="w-full lg:w-[260px] shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-20">
                {/* Header */}
                <div className="bg-blue-700 px-4 py-3 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-blue-200" />
                    <span className="font-bold text-white text-sm uppercase tracking-wide">Chuyên khoa</span>
                </div>

                {/* All */}
                <Link
                    to="/doi-ngu-bac-si"
                    className={`flex items-center gap-2.5 px-4 py-3 text-sm border-b border-gray-100 transition-colors
                        ${!activeSlug
                            ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-l-blue-600'
                            : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                >
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    Tất cả bác sĩ
                </Link>

                {/* List */}
                {isLoading ? (
                    <div className="p-3 space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-50">
                        {specialties.map((sp) => {
                            const slug = toSlug(sp.CK_TEN);
                            const isActive = activeSlug === slug;
                            return (
                                <li key={sp.CK_MA}>
                                    <Link
                                        to={`/doi-ngu-bac-si/${slug}`}
                                        className={`flex items-center gap-2.5 px-4 py-3 text-sm transition-colors
                                            ${isActive
                                                ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-l-blue-600'
                                                : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                                            }`}
                                    >
                                        <Stethoscope className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                                        {sp.CK_TEN}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </aside>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DoctorsPage() {
    const { slug } = useParams<{ slug?: string }>();

    // 1. Load all specialties (for sidebar + resolve CK_MA from slug)
    const {
        data: specialties = [],
        isLoading: loadingSpecialties,
        isError: specError,
    } = useSpecialties();

    // 2. Resolve active specialty from slug → find CK_MA for API filter
    const activeSpecialty = useMemo(() => {
        if (!slug || specialties.length === 0) return undefined;
        return specialties.find((sp) => toSlug(sp.CK_TEN) === slug);
    }, [slug, specialties]);

    // 3. Load doctors — pass CK_MA if a specialty is matched
    const {
        data: doctors = [],
        isLoading: loadingDoctors,
        isError: docError,
        isFetching,
    } = useDoctors(activeSpecialty?.CK_MA);

    const isLoading = loadingDoctors || isFetching;
    const anyError = specError || docError;

    return (
        <div className="bg-gray-50 min-h-screen">
            {/* ── Hero ─── */}
            <section className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white py-14 text-center">
                <div className="max-w-3xl mx-auto px-4">
                    <p className="text-blue-200 text-sm uppercase tracking-[0.2em] font-semibold mb-3">UMC Clinic</p>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                        ĐỘI NGŨ BÁC SĨ CHUYÊN KHOA
                    </h1>
                    <div className="w-20 h-1 bg-blue-300 rounded-full mx-auto mt-4" />
                    <p className="text-blue-100 mt-4 text-base max-w-xl mx-auto leading-relaxed">
                        Hơn 2.000 bác sĩ và chuyên gia đầu ngành — tận tâm vì sức khỏe của bạn.
                    </p>
                </div>
            </section>

            {/* ── Body ─── */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <Breadcrumb label={activeSpecialty?.CK_TEN} />

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar */}
                    <SpecialtySidebar
                        activeSlug={slug}
                        specialties={specialties}
                        isLoading={loadingSpecialties}
                    />

                    {/* Main */}
                    <main className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {activeSpecialty?.CK_TEN ?? 'Tất cả bác sĩ'}
                                </h2>
                                {!isLoading && (
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        {doctors.length} bác sĩ
                                        {activeSpecialty ? ` – ${activeSpecialty.CK_TEN}` : ' trong hệ thống'}
                                    </p>
                                )}
                            </div>

                            {/* Status indicators */}
                            <div className="flex items-center gap-2">
                                {isLoading && (
                                    <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Đang tải...
                                    </div>
                                )}
                                {anyError && !isLoading && (
                                    <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        Lỗi tải dữ liệu
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        {isLoading ? (
                            <div className="flex flex-col gap-5">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <DoctorSkeleton key={i} />
                                ))}
                            </div>
                        ) : doctors.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                                    <Stethoscope className="w-7 h-7 text-blue-300" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                                    {anyError ? 'Không thể tải dữ liệu' : 'Chưa có bác sĩ'}
                                </h3>
                                <p className="text-gray-400 text-sm max-w-xs">
                                    {anyError
                                        ? 'Đã xảy ra lỗi khi kết nối đến máy chủ. Vui lòng thử lại sau.'
                                        : 'Hiện chưa có bác sĩ nào thuộc chuyên khoa này trong hệ thống.'}
                                </p>
                                <Link to="/doi-ngu-bac-si" className="mt-5 text-sm text-blue-600 hover:underline font-medium">
                                    ← Xem tất cả bác sĩ
                                </Link>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-5">
                                {doctors.map((doctor) => (
                                    <DoctorCard key={doctor.BS_MA} doctor={doctor} />
                                ))}
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
