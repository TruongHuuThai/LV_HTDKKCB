import { ArrowRightLeft, CalendarDays, CreditCard, Phone, ShieldUser, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateDdMmYyyy } from '@/lib/scheduleDisplay';
import {
  getPatientGenderLabel,
  getPatientProfileFullName,
  getPatientRelationshipLabel,
} from '@/lib/patientProfiles';
import type { PatientProfile } from '@/services/api/patientProfilesApi';

interface PatientProfileSummaryCardProps {
  profile: PatientProfile;
  mode: 'viewing' | 'booking';
  changeHref?: string;
  compact?: boolean;
}

export default function PatientProfileSummaryCard({
  profile,
  mode,
  changeHref = '/profile',
  compact = false,
}: PatientProfileSummaryCardProps) {
  const fullName = getPatientProfileFullName(profile) || `Hồ sơ #${profile.BN_MA}`;

  return (
    <Card className="border-blue-100 bg-gradient-to-br from-white via-blue-50/60 to-sky-50/40 shadow-sm">
      <CardHeader className={compact ? 'pb-2' : ''}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border border-blue-100">
              <AvatarImage src={profile.BN_ANH || ''} alt={fullName} className="object-cover" />
              <AvatarFallback className="bg-blue-100 text-blue-700">
                <UserRound className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <CardDescription className="text-blue-700">
                {mode === 'booking'
                  ? 'Đang đặt lịch cho'
                  : 'Đang xem hồ sơ của'}
              </CardDescription>
              <CardTitle className="text-xl text-slate-900">{fullName}</CardTitle>
              <p className="mt-1 text-sm text-slate-600">
                Mã hồ sơ #{profile.BN_MA} • {getPatientRelationshipLabel(profile.BN_QUAN_HE_VOI_TK)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {profile.BN_DA_VO_HIEU ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Hồ sơ đã vô hiệu hóa
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                Có thể sử dụng đặt lịch
              </span>
            )}
            <Button asChild variant="outline" size="sm" className="border-blue-200 text-blue-700 hover:bg-blue-50">
              <Link to={changeHref}>
                <ArrowRightLeft className="mr-1 h-4 w-4" />
                Đổi hồ sơ
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={compact ? 'pt-0' : ''}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              Ngày sinh
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {formatDateDdMmYyyy(profile.BN_NGAY_SINH)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <ShieldUser className="h-4 w-4 text-blue-600" />
              Giới tính
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {getPatientGenderLabel(profile.BN_LA_NAM)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <Phone className="h-4 w-4 text-blue-600" />
              Số điện thoại
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {profile.BN_SDT_DANG_KY || 'Chưa cập nhật'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              <CreditCard className="h-4 w-4 text-blue-600" />
              BHYT
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {profile.BN_SO_BHYT || 'Chưa cập nhật'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
