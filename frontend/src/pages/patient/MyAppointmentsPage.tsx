import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  LoaderCircle,
  Search,
  Stethoscope,
  UserRound,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMyAppointments } from '@/hooks/usePatientAppointments';
import {
  canOpenPaymentUrl,
  getAppointmentStatusLabel,
  getPaymentStatusLabel,
  getStatusGroupLabel,
  isRetryPaymentAllowed,
  type AppointmentStatusGroup,
  type PaymentStatus,
} from '@/lib/appointments';
import { logFrontendError } from '@/lib/frontendLogger';
import { getPatientFlowErrorMessage } from '@/lib/patientFlowError';
import { setLastPaymentContext } from '@/lib/patientPaymentFlow';
import { cn } from '@/lib/utils';
import { appointmentsApi, type AppointmentListItem, type AppointmentListQuery } from '@/services/api/appointmentsApi';
import { patientProfilesApi } from '@/services/api/patientProfilesApi';
import { queryKeys } from '@/services/api/queryKeys';

const statusGroups: AppointmentStatusGroup[] = ['upcoming', 'completed', 'canceled', 'no_show'];

type QuickDateKey = 'none' | 'today' | 'next3days' | 'thisWeek' | 'thisMonth';
type BadgeTone = 'slate' | 'blue' | 'emerald' | 'amber' | 'rose';
type ActiveFilterChipKey = 'keyword' | 'profile' | 'date';

interface BadgeConfig {
  tone: BadgeTone;
  label: string;
  icon: LucideIcon;
}

const QUICK_DATE_OPTIONS: Array<{ key: QuickDateKey; label: string }> = [
  { key: 'none', label: 'T\u1ea5t c\u1ea3 th\u1eddi gian' },
  { key: 'today', label: 'H\u00f4m nay' },
  { key: 'next3days', label: '3 ng\u00e0y t\u1edbi' },
  { key: 'thisWeek', label: 'Tu\u1ea7n n\u00e0y' },
  { key: 'thisMonth', label: 'Th\u00e1ng n\u00e0y' },
];

const TEXT = {
  title: 'L\u1ecbch h\u1eb9n c\u1ee7a t\u00f4i',
  description:
    'Theo d\u00f5i tr\u1ea1ng th\u00e1i kh\u00e1m v\u00e0 thanh to\u00e1n. B\u1ea1n c\u00f3 th\u1ec3 thanh to\u00e1n l\u1ea1i, \u0111\u1ed5i l\u1ecbch ho\u1eb7c h\u1ee7y l\u1ecbch theo ch\u00ednh s\u00e1ch h\u1ec7 th\u1ed1ng.',
  searchPlaceholder: 'T\u00ecm theo m\u00e3 l\u1ecbch h\u1eb9n, b\u00e1c s\u0129 ho\u1eb7c chuy\u00ean khoa',
  allProfiles: 'T\u1ea5t c\u1ea3 th\u00e0nh vi\u00ean',
  clearFilters: 'X\u00f3a b\u1ed9 l\u1ecdc',
  activeFilters: '\u0110ang \u00e1p d\u1ee5ng b\u1ed9 l\u1ecdc',
  loading: '\u0110ang t\u1ea3i danh s\u00e1ch l\u1ecbch h\u1eb9n...',
  loadFailed: 'Kh\u00f4ng th\u1ec3 t\u1ea3i danh s\u00e1ch l\u1ecbch h\u1eb9n l\u00fac n\u00e0y.',
  retry: 'Th\u1eed l\u1ea1i',
  emptyTitle: 'B\u1ea1n ch\u01b0a c\u00f3 l\u1ecbch h\u1eb9n n\u00e0o',
  emptyDescription: 'H\u00e3y \u0111\u1eb7t l\u1ecbch m\u1edbi \u0111\u1ec3 b\u1eaft \u0111\u1ea7u theo d\u00f5i l\u1ecbch h\u1eb9n t\u1ea1i \u0111\u00e2y.',
  emptyFilteredTitle: 'Kh\u00f4ng t\u00ecm th\u1ea5y l\u1ecbch h\u1eb9n ph\u00f9 h\u1ee3p',
  emptyFilteredDescription: 'H\u00e3y th\u1eed thay \u0111\u1ed5i b\u1ed9 l\u1ecdc ho\u1eb7c t\u1eeb kh\u00f3a t\u00ecm ki\u1ebfm.',
  bookNow: '\u0110\u1eb7t l\u1ecbch ngay',
  showing: 'Hi\u1ec3n th\u1ecb',
  previousPage: 'Trang tr\u01b0\u1edbc',
  nextPage: 'Trang sau',
  pagePlaceholder: 'Trang',
  appointmentCode: 'M\u00e3 l\u1ecbch h\u1eb9n',
  doctorUnknown: 'B\u00e1c s\u0129 ch\u01b0a x\u00e1c \u0111\u1ecbnh',
  specialtyUnknown: 'Ch\u01b0a c\u00f3 chuy\u00ean khoa',
  roomUnknown: 'Ch\u01b0a c\u00f3 ph\u00f2ng kh\u00e1m',
  profileLabel: 'H\u1ed3 s\u01a1',
  retryPayment: 'Thanh to\u00e1n l\u1ea1i',
  viewDetail: 'Xem chi ti\u1ebft',
  reschedule: '\u0110\u1ed5i l\u1ecbch',
  cancel: 'H\u1ee7y l\u1ecbch',
  bookAgain: '\u0110\u1eb7t l\u1ecbch m\u1edbi',
  paymentRetryCreated: '\u0110\u00e3 t\u1ea1o y\u00eau c\u1ea7u thanh to\u00e1n l\u1ea1i.',
  paymentRetryFailed: 'Kh\u00f4ng th\u1ec3 thanh to\u00e1n l\u1ea1i l\u00fac n\u00e0y.',
  cancelReason: 'B\u1ec7nh nh\u00e2n ch\u1ee7 \u0111\u1ed9ng h\u1ee7y',
  cancelSuccess: '\u0110\u00e3 h\u1ee7y l\u1ecbch h\u1eb9n.',
  cancelFailed: 'Kh\u00f4ng th\u1ec3 h\u1ee7y l\u1ecbch h\u1eb9n.',
  upcomingSummary: 'S\u1eafp kh\u00e1m',
  paymentSummary: 'C\u1ea7n thanh to\u00e1n',
  completedSummary: '\u0110\u00e3 ho\u00e0n t\u1ea5t',
  filteredByProfile: '\u0110ang l\u1ecdc theo',
  statusSectionTitle: 'Tr\u1ea1ng th\u00e1i l\u1ecbch h\u1eb9n',
  timeSectionTitle: 'Th\u1eddi gian',
  clearSearchAria: 'X\u00f3a t\u1eeb kh\u00f3a t\u00ecm ki\u1ebfm',
  keywordPrefix: 'T\u1eeb kh\u00f3a',
  fromPrefix: 'T\u1eeb',
  toPrefix: '\u0110\u1ebfn',
};

const badgeToneClass: Record<BadgeTone, string> = {
  slate: 'border-slate-200 bg-slate-100 text-slate-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
};

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function parseDateParam(value: string | null): string | undefined {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(base: Date) {
  const start = new Date(base);
  const day = start.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + delta);
  return start;
}

function endOfWeek(base: Date) {
  return addDays(startOfWeek(base), 6);
}

function getQuickDateRange(key: QuickDateKey): { fromDate: string; toDate: string } | null {
  const today = new Date();
  const todayIso = toIsoDate(today);

  if (key === 'today') return { fromDate: todayIso, toDate: todayIso };
  if (key === 'next3days') return { fromDate: todayIso, toDate: toIsoDate(addDays(today, 2)) };
  if (key === 'thisWeek') return { fromDate: toIsoDate(startOfWeek(today)), toDate: toIsoDate(endOfWeek(today)) };
  if (key === 'thisMonth') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { fromDate: toIsoDate(first), toDate: toIsoDate(last) };
  }
  return null;
}

function resolveActiveQuickDate(fromDate?: string, toDate?: string): QuickDateKey {
  if (!fromDate && !toDate) return 'none';
  const options: QuickDateKey[] = ['today', 'next3days', 'thisWeek', 'thisMonth'];
  const matched = options.find((key) => {
    const range = getQuickDateRange(key);
    return range && range.fromDate === fromDate && range.toDate === toDate;
  });
  return matched || 'none';
}

function normalizeDate(raw?: string | null) {
  if (!raw) return null;
  if (raw.includes('T')) {
    const datePart = raw.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function formatDateDisplay(raw?: string | null) {
  const normalized = normalizeDate(raw);
  if (!normalized) return '--/--/----';
  const [year, month, day] = normalized.split('-');
  return `${day}/${month}/${year}`;
}

function formatTimeDisplay(raw?: string | null) {
  if (!raw) return '--:--';
  if (raw.length >= 16 && raw.includes('T')) return raw.slice(11, 16);
  const matched = raw.match(/\d{2}:\d{2}/);
  return matched?.[0] || '--:--';
}

function formatDateFilterLabel(fromDate?: string, toDate?: string) {
  if (fromDate && toDate) return `${formatDateDisplay(fromDate)} - ${formatDateDisplay(toDate)}`;
  if (fromDate) return `${TEXT.fromPrefix} ${formatDateDisplay(fromDate)}`;
  if (toDate) return `${TEXT.toPrefix} ${formatDateDisplay(toDate)}`;
  return '';
}

function getVisitBadge(status?: string | null, statusGroup?: AppointmentStatusGroup): BadgeConfig {
  const label = getAppointmentStatusLabel(status);
  if (status === 'DA_KHAM' || statusGroup === 'completed') {
    return { label, tone: 'emerald', icon: CheckCircle2 };
  }
  if (status === 'HUY' || status === 'HUY_BS_NGHI' || statusGroup === 'canceled') {
    return { label, tone: 'slate', icon: XCircle };
  }
  if (status === 'NO_SHOW' || statusGroup === 'no_show') {
    return { label, tone: 'rose', icon: AlertCircle };
  }
  if (status === 'CHO_THANH_TOAN') {
    return { label, tone: 'amber', icon: Wallet };
  }
  return { label, tone: 'blue', icon: CalendarDays };
}

function getPaymentBadge(status: PaymentStatus): BadgeConfig {
  const label = getPaymentStatusLabel(status);
  if (status === 'paid' || status === 'refunded') {
    return { label, tone: 'emerald', icon: CheckCircle2 };
  }
  if (status === 'pending' || status === 'refund_pending') {
    return { label, tone: 'blue', icon: LoaderCircle };
  }
  if (status === 'failed' || status === 'expired' || status === 'refund_failed' || status === 'refund_rejected') {
    return { label, tone: 'rose', icon: AlertCircle };
  }
  return { label, tone: 'amber', icon: Wallet };
}

function getAppointmentCardStyle(item: AppointmentListItem, index: number) {
  if (isRetryPaymentAllowed(item.paymentStatus)) return 'border-amber-300 bg-amber-50/50 ring-1 ring-amber-100';
  if (item.statusGroup === 'upcoming' && index === 0) return 'border-blue-300 bg-blue-50/40 ring-1 ring-blue-100';
  if (item.statusGroup === 'completed') return 'border-emerald-200 bg-emerald-50/20';
  if (item.statusGroup === 'canceled' || item.statusGroup === 'no_show') return 'border-slate-200 bg-slate-50';
  return 'border-slate-200 bg-white';
}

function StatusBadge({ config }: { config: BadgeConfig }) {
  const Icon = config.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        badgeToneClass[config.tone],
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', config.icon === LoaderCircle ? 'animate-spin' : '')} />
      {config.label}
    </span>
  );
}

function QuickFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium transition',
        active
          ? 'border-blue-300 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50',
      )}
    >
      {label}
    </button>
  );
}

function AppointmentListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={`appointment-skeleton-${index}`} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="h-4 w-40 rounded bg-slate-200" />
            <div className="h-6 w-28 rounded-full bg-slate-200" />
          </div>
          <div className="mt-3 h-5 w-64 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-80 rounded bg-slate-200" />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="h-10 rounded-xl bg-slate-200" />
            <div className="h-10 rounded-xl bg-slate-200" />
            <div className="h-10 rounded-xl bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function AppointmentsErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <AlertCircle className="h-4 w-4" />
          {message}
        </p>
        <Button type="button" variant="outline" onClick={onRetry}>
          {TEXT.retry}
        </Button>
      </div>
    </div>
  );
}

function AppointmentsEmptyState({
  filtered,
  onClearFilters,
}: {
  filtered: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <CalendarDays className="mx-auto mb-3 h-8 w-8 text-slate-400" />
      <p className="text-lg font-semibold text-slate-900">
        {filtered ? TEXT.emptyFilteredTitle : TEXT.emptyTitle}
      </p>
      <p className="mt-2 text-sm text-slate-600">
        {filtered ? TEXT.emptyFilteredDescription : TEXT.emptyDescription}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        {filtered ? (
          <Button type="button" variant="outline" onClick={onClearFilters}>
            {TEXT.clearFilters}
          </Button>
        ) : null}
        <Button asChild>
          <Link to="/booking">{TEXT.bookNow}</Link>
        </Button>
      </div>
    </div>
  );
}

function AppointmentCard({
  item,
  index,
  profileId,
  buildAppointmentHref,
  onRetryPayment,
  onCancel,
  retryPending,
  cancelPending,
}: {
  item: AppointmentListItem;
  index: number;
  profileId?: number;
  buildAppointmentHref: (appointmentId: number, action?: 'reschedule') => string;
  onRetryPayment: (appointmentId: number) => void;
  onCancel: (appointmentId: number) => void;
  retryPending: boolean;
  cancelPending: boolean;
}) {
  const visitBadge = getVisitBadge(item.status, item.statusGroup);
  const paymentBadge = getPaymentBadge(item.paymentStatus);
  const needsPayment = isRetryPaymentAllowed(item.paymentStatus);
  const primaryDetail = !needsPayment;

  const doctorName = item.doctor?.BS_HO_TEN || TEXT.doctorUnknown;
  const specialtyName = item.specialty?.CK_TEN || TEXT.specialtyUnknown;
  const roomName = item.room?.P_TEN || TEXT.roomUnknown;
  const appointmentDate = formatDateDisplay(item.N_NGAY);
  const startTime = formatTimeDisplay(item.KG_BAT_DAU);
  const endTime = formatTimeDisplay(item.KG_KET_THUC);

  return (
    <article className={cn('rounded-2xl border p-4 shadow-sm transition', getAppointmentCardStyle(item, index))}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1 text-sm font-medium text-slate-600">
          <span>{TEXT.appointmentCode}</span>
          <span className="font-semibold text-slate-900">#{item.appointmentId}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge config={visitBadge} />
          <StatusBadge config={paymentBadge} />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">{doctorName}</h3>
        <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <p className="inline-flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-slate-500" />
            {specialtyName}
          </p>
          <p className="inline-flex items-center gap-2">
            <UserRound className="h-4 w-4 text-slate-500" />
            {roomName}
          </p>
          <p className="inline-flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            {appointmentDate}
          </p>
          <p className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-slate-500" />
            {startTime} - {endTime}
          </p>
        </div>
        {!profileId && item.profile?.fullName ? (
          <p className="text-xs text-slate-500">
            {TEXT.profileLabel}: {item.profile.fullName}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {needsPayment ? (
          <Button
            size="sm"
            className="bg-amber-500 text-white hover:bg-amber-600"
            onClick={() => onRetryPayment(item.appointmentId)}
            disabled={retryPending}
          >
            {retryPending ? (
              <LoaderCircle className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CreditCard className="mr-1 h-3.5 w-3.5" />
            )}
            {TEXT.retryPayment}
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link to={buildAppointmentHref(item.appointmentId)}>{TEXT.viewDetail}</Link>
          </Button>
        )}

        {!primaryDetail ? (
          <Button asChild size="sm" variant="outline">
            <Link to={buildAppointmentHref(item.appointmentId)}>{TEXT.viewDetail}</Link>
          </Button>
        ) : null}

        {item.canReschedule ? (
          <Button asChild size="sm" variant="outline">
            <Link to={buildAppointmentHref(item.appointmentId, 'reschedule')}>{TEXT.reschedule}</Link>
          </Button>
        ) : null}

        {item.canCancel ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onCancel(item.appointmentId)}
            disabled={cancelPending}
          >
            {cancelPending ? (
              <LoaderCircle className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="mr-1 h-3.5 w-3.5" />
            )}
            {TEXT.cancel}
          </Button>
        ) : null}

        {item.statusGroup !== 'upcoming' ? (
          <Button asChild size="sm" variant="ghost">
            <Link to="/booking">{TEXT.bookAgain}</Link>
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export default function MyAppointmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const currentGroupRaw = searchParams.get('statusGroup');
  const currentGroup = statusGroups.includes(currentGroupRaw as AppointmentStatusGroup)
    ? (currentGroupRaw as AppointmentStatusGroup)
    : 'upcoming';
  const page = parsePositiveInt(searchParams.get('page')) || 1;
  const keyword = searchParams.get('keyword') || '';
  const profileId = parsePositiveInt(searchParams.get('profileId'));
  const fromDate = parseDateParam(searchParams.get('fromDate'));
  const toDate = parseDateParam(searchParams.get('toDate'));

  const profilesQuery = useQuery({
    queryKey: queryKeys.patientProfiles.mine,
    queryFn: patientProfilesApi.listMine,
  });

  const activeProfiles = useMemo(
    () => (profilesQuery.data?.items ?? []).filter((item) => item.BN_DA_VO_HIEU !== true),
    [profilesQuery.data?.items],
  );

  const selectedProfile = useMemo(
    () => activeProfiles.find((item) => item.BN_MA === profileId) || null,
    [activeProfiles, profileId],
  );

  const params: AppointmentListQuery = useMemo(
    () => ({
      statusGroup: currentGroup,
      page,
      limit: 10,
      keyword: keyword || undefined,
      profileId,
      fromDate,
      toDate,
    }),
    [currentGroup, page, keyword, profileId, fromDate, toDate],
  );

  const listQuery = useMyAppointments(params);

  const retryMutation = useMutation({
    mutationFn: (appointmentId: number) => appointmentsApi.retryPayment(appointmentId),
    onSuccess: (result, appointmentId) => {
      setLastPaymentContext({ appointmentId, createdAt: new Date().toISOString() });
      if (canOpenPaymentUrl(result.payment_url)) {
        window.location.assign(result.payment_url as string);
        return;
      }
      toast.success(TEXT.paymentRetryCreated);
      void queryClient.invalidateQueries({ queryKey: ['appointments-my'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments.paymentStatus(appointmentId) });
    },
    onError: (error) => {
      logFrontendError('my-appointments-retry-payment', error);
      toast.error(getPatientFlowErrorMessage(error, TEXT.paymentRetryFailed));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (appointmentId: number) =>
      appointmentsApi.cancel(appointmentId, { reason: TEXT.cancelReason, source: 'WEB' }),
    onSuccess: () => {
      toast.success(TEXT.cancelSuccess);
      void queryClient.invalidateQueries({ queryKey: ['appointments-my'] });
    },
    onError: (error) => {
      logFrontendError('my-appointments-cancel', error);
      toast.error(getPatientFlowErrorMessage(error, TEXT.cancelFailed));
    },
  });

  const updateSearchParam = (
    next: Partial<{
      statusGroup: string;
      page: string;
      keyword: string;
      profileId: string;
      fromDate: string;
      toDate: string;
    }>,
  ) => {
    const merged = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (!value) merged.delete(key);
      else merged.set(key, value);
    });
    setSearchParams(merged);
  };

  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('keyword');
    next.delete('profileId');
    next.delete('fromDate');
    next.delete('toDate');
    next.set('page', '1');
    setSearchParams(next);
  };

  const contextParams = useMemo(() => {
    const context = new URLSearchParams();
    if (currentGroup) context.set('statusGroup', currentGroup);
    if (page > 1) context.set('page', String(page));
    if (keyword) context.set('keyword', keyword);
    if (profileId) context.set('profileId', String(profileId));
    if (fromDate) context.set('fromDate', fromDate);
    if (toDate) context.set('toDate', toDate);
    return context;
  }, [currentGroup, page, keyword, profileId, fromDate, toDate]);

  const buildAppointmentHref = (appointmentId: number, action?: 'reschedule') => {
    const next = new URLSearchParams(contextParams);
    if (action) next.set('action', action);
    const suffix = next.toString();
    return `/appointments/${appointmentId}${suffix ? `?${suffix}` : ''}`;
  };

  const items = listQuery.data?.items || [];
  const meta = listQuery.data?.meta;
  const hasActiveFilters = Boolean(keyword || profileId || fromDate || toDate);
  const quickDateKey = resolveActiveQuickDate(fromDate, toDate);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: ActiveFilterChipKey; label: string }> = [];
    if (keyword) chips.push({ key: 'keyword', label: `${TEXT.keywordPrefix}: ${keyword}` });
    if (selectedProfile?.fullName) chips.push({ key: 'profile', label: selectedProfile.fullName });
    const dateLabel = formatDateFilterLabel(fromDate, toDate);
    if (dateLabel) chips.push({ key: 'date', label: dateLabel });
    return chips;
  }, [fromDate, keyword, selectedProfile?.fullName, toDate]);

  const summary = useMemo(() => {
    const upcoming = items.filter((item) => item.statusGroup === 'upcoming').length;
    const needsPayment = items.filter((item) => isRetryPaymentAllowed(item.paymentStatus)).length;
    const completed = items.filter((item) => item.statusGroup === 'completed').length;
    return { upcoming, needsPayment, completed };
  }, [items]);

  const pageStart = meta && items.length > 0 ? (meta.page - 1) * meta.limit + 1 : 0;
  const pageEnd = meta && items.length > 0 ? (meta.page - 1) * meta.limit + items.length : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-5">
        <Card className="border-slate-200">
          <CardHeader className="space-y-2 border-b border-slate-100 pb-4">
            <CardTitle className="text-2xl">{TEXT.title}</CardTitle>
            <CardDescription className="max-w-3xl">{TEXT.description}</CardDescription>
            <div className="grid gap-2 sm:grid-cols-3">
              <SummaryPill label={TEXT.upcomingSummary} value={summary.upcoming} tone="blue" />
              <SummaryPill label={TEXT.paymentSummary} value={summary.needsPayment} tone="amber" />
              <SummaryPill label={TEXT.completedSummary} value={summary.completed} tone="emerald" />
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pt-5">
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{TEXT.statusSectionTitle}</p>
                <div className="flex flex-wrap gap-2">
                  {statusGroups.map((group) => (
                    <QuickFilterButton
                      key={group}
                      active={group === currentGroup}
                      label={getStatusGroupLabel(group)}
                      onClick={() => updateSearchParam({ statusGroup: group, page: '1' })}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{TEXT.timeSectionTitle}</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_DATE_OPTIONS.map((option) => (
                    <QuickFilterButton
                      key={option.key}
                      active={option.key === quickDateKey}
                      label={option.label}
                      onClick={() => {
                        if (option.key === 'none') {
                          updateSearchParam({ fromDate: '', toDate: '', page: '1' });
                          return;
                        }
                        const range = getQuickDateRange(option.key);
                        if (!range) return;
                        updateSearchParam({
                          fromDate: range.fromDate,
                          toDate: range.toDate,
                          page: '1',
                        });
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-12">
                <div className="relative lg:col-span-5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="h-11 rounded-xl border-slate-300 bg-white pl-9 pr-10"
                    placeholder={TEXT.searchPlaceholder}
                    value={keyword}
                    onChange={(event) => updateSearchParam({ keyword: event.target.value, page: '1' })}
                  />
                  {keyword ? (
                    <button
                      type="button"
                      onClick={() => updateSearchParam({ keyword: '', page: '1' })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                      aria-label={TEXT.clearSearchAria}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <div className="lg:col-span-3">
                  <Select
                    value={profileId ? String(profileId) : 'all'}
                    onValueChange={(value) =>
                      updateSearchParam({ profileId: value === 'all' ? '' : value, page: '1' })
                    }
                  >
                    <SelectTrigger className="h-11 rounded-xl border-slate-300 bg-white">
                      <SelectValue placeholder={TEXT.allProfiles} />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">{TEXT.allProfiles}</SelectItem>
                      {activeProfiles.map((profile) => (
                        <SelectItem key={profile.BN_MA} value={String(profile.BN_MA)}>
                          {profile.fullName || `#${profile.BN_MA}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="lg:col-span-2">
                  <Input
                    type="date"
                    className="h-11 rounded-xl border-slate-300 bg-white"
                    value={fromDate || ''}
                    onChange={(event) => updateSearchParam({ fromDate: event.target.value, page: '1' })}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Input
                    type="date"
                    className="h-11 rounded-xl border-slate-300 bg-white"
                    value={toDate || ''}
                    onChange={(event) => updateSearchParam({ toDate: event.target.value, page: '1' })}
                  />
                </div>
              </div>

              {activeFilterChips.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{TEXT.activeFilters}</p>
                    <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                      {TEXT.clearFilters}
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {activeFilterChips.map((chip) => (
                      <button
                        key={`${chip.key}-${chip.label}`}
                        type="button"
                        onClick={() => {
                          if (chip.key === 'keyword') updateSearchParam({ keyword: '', page: '1' });
                          if (chip.key === 'profile') updateSearchParam({ profileId: '', page: '1' });
                          if (chip.key === 'date') updateSearchParam({ fromDate: '', toDate: '', page: '1' });
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        {chip.label}
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-600">
              <p>
                {meta ? `${TEXT.showing} ${pageStart}-${pageEnd} / ${meta.total}` : `${TEXT.showing} 0-0 / 0`}
              </p>
              {selectedProfile?.fullName ? (
                <p>
                  {TEXT.filteredByProfile}{' '}
                  <span className="font-medium text-slate-800">{selectedProfile.fullName}</span>
                </p>
              ) : null}
            </div>

            {listQuery.isLoading ? (
              <AppointmentListSkeleton />
            ) : listQuery.isError ? (
              <AppointmentsErrorState
                message={getPatientFlowErrorMessage(listQuery.error, TEXT.loadFailed)}
                onRetry={() => void listQuery.refetch()}
              />
            ) : items.length === 0 ? (
              <AppointmentsEmptyState filtered={hasActiveFilters} onClearFilters={resetFilters} />
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <AppointmentCard
                    key={item.appointmentId}
                    item={item}
                    index={index}
                    profileId={profileId}
                    buildAppointmentHref={buildAppointmentHref}
                    onRetryPayment={(appointmentId) => retryMutation.mutate(appointmentId)}
                    onCancel={(appointmentId) => cancelMutation.mutate(appointmentId)}
                    retryPending={retryMutation.isPending && retryMutation.variables === item.appointmentId}
                    cancelPending={cancelMutation.isPending && cancelMutation.variables === item.appointmentId}
                  />
                ))}
              </div>
            )}

            {meta ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>{TEXT.pagePlaceholder}</span>
                  <Select value={String(page)} onValueChange={(value) => updateSearchParam({ page: value })}>
                    <SelectTrigger className="h-9 w-20 rounded-lg bg-white">
                      <SelectValue placeholder={TEXT.pagePlaceholder} />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      {Array.from({ length: Math.max(meta.totalPages || 1, 1) }).map((_, idx) => (
                        <SelectItem key={idx + 1} value={String(idx + 1)}>
                          {idx + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateSearchParam({ page: String(Math.max(1, page - 1)) })}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                    {TEXT.previousPage}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateSearchParam({ page: String(Math.min(meta.totalPages, page + 1)) })}
                    disabled={page >= meta.totalPages}
                  >
                    {TEXT.nextPage}
                    <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'blue' | 'amber' | 'emerald';
}) {
  const className =
    tone === 'blue'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <div className={cn('rounded-xl border px-3 py-2', className)}>
      <p className="text-xs font-medium uppercase tracking-[0.08em]">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
