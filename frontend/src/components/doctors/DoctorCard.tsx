// src/components/doctors/DoctorCard.tsx
import { Link } from 'react-router-dom';
import { Calendar, GraduationCap, Stethoscope } from 'lucide-react';
import type { Doctor } from '@/services/api';

interface DoctorCardProps {
    doctor: Doctor;
}

const DEFAULT_AVATAR = 'https://placehold.co/150x200/bfdbfe/1e40af?text=Bác+sĩ';

export default function DoctorCard({ doctor }: DoctorCardProps) {
    const avatar = doctor.BS_ANH ?? DEFAULT_AVATAR;
    const degree = doctor.BS_HOC_HAM ?? '';

    return (
        <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col sm:flex-row">
            {/* ── Avatar ── */}
            <div className="relative shrink-0 w-full sm:w-[150px]">
                <img
                    src={avatar}
                    alt={doctor.BS_HO_TEN}
                    className="w-full sm:w-[150px] h-[200px] object-cover group-hover:brightness-105 transition-all duration-300"
                    style={{ minHeight: '200px' }}
                    onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR;
                    }}
                />
                <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-blue-900/60 to-transparent" />
            </div>

            {/* ── Content ── */}
            <div className="flex flex-col flex-1 p-5 gap-3">
                {/* Specialty tag + Name */}
                <div>
                    <p className="text-[11px] text-blue-500 font-semibold uppercase tracking-wide mb-1">
                        {doctor.CHUYEN_KHOA.CK_TEN}
                    </p>
                    <h3 className="text-blue-800 font-bold text-base md:text-lg leading-snug uppercase tracking-wide">
                        {degree ? `${degree} ${doctor.BS_HO_TEN}` : doctor.BS_HO_TEN}
                    </h3>
                </div>

                {/* Info rows */}
                <ul className="space-y-1.5 text-sm">
                    {degree && (
                        <li className="flex items-start gap-2 text-gray-700">
                            <GraduationCap className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            <span>
                                <span className="font-semibold text-gray-800">Học hàm học vị: </span>
                                {degree}
                            </span>
                        </li>
                    )}
                    <li className="flex items-start gap-2 text-gray-700">
                        <Stethoscope className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <span>
                            <span className="font-semibold text-gray-800">Chuyên khoa: </span>
                            {doctor.CHUYEN_KHOA.CK_TEN}
                            {doctor.CHUYEN_KHOA.CK_DOI_TUONG_KHAM
                                ? ` — ${doctor.CHUYEN_KHOA.CK_DOI_TUONG_KHAM}`
                                : ''}
                        </span>
                    </li>
                    {doctor.CHUYEN_KHOA.CK_MO_TA && (
                        <li className="text-gray-500 text-xs leading-relaxed line-clamp-2 pl-6">
                            {doctor.CHUYEN_KHOA.CK_MO_TA}
                        </li>
                    )}
                </ul>

                {/* Actions */}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Link
                        to={`/doi-ngu-bac-si/bac-si/${doctor.BS_MA}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wide transition-colors shadow-sm"
                    >
                        Xem chi tiết
                    </Link>
                    <Link
                        to={`/booking?doctor=${doctor.BS_MA}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wide transition-colors shadow-sm"
                    >
                        <Calendar className="w-3.5 h-3.5" />
                        Đặt lịch khám
                    </Link>
                </div>
            </div>
        </div>
    );
}
