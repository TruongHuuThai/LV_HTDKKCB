import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileClock,
  LayoutList,
  ListFilter,
  Rows2,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  doctorScheduleWorkflowApi,
  type ExceptionRequestType,
  type ScheduleExceptionRequestItem,
  type WeeklyScheduleItem,
} from '@/services/api/scheduleWorkflowApi';
import { SHIFT_STATUS, WEEK_STATUS } from '@/contracts/scheduleStatusContract';
import { doctorScheduleApi } from '@/services/api/doctorScheduleApi';
import {
  formatDateDdMmYyyy,
  formatDateDdMmYyyySlash,
  getSessionLabel,
  getWeekdayLabelFromDate,
} from '@/lib/scheduleDisplay';
import {
  getExceptionStatusBadgeClass,
  getExceptionStatusLabel,
  getExceptionTypeLabel,
  getWeekWorkflowStatusBadgeClass,
  getWeekWorkflowStatusLabel,
  getWeeklyScheduleSourceLabel,
  getWeeklyScheduleStatusBadgeClass,
  getWeeklyScheduleStatusLabel,
} from '@/lib/scheduleWorkflowDisplay';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AdminSelect,
  AdminSelectContent,
  AdminSelectItem,
  AdminSelectTrigger,
  AdminSelectValue,
} from '@/components/admin/AdminSelect';

type ExceptionFormState = {
  open: boolean;
  target: WeeklyScheduleItem | null;
  type: ExceptionRequestType;
  leaveHandling: 'admin_arrange' | 'makeup';
  reason: string;
  requestedDate: string;
  requestedSession: string;
  requestedRoomId: string;
};

type ShiftViewMode = 'grouped' | 'table';
type ShiftFilterKey = 'all' | 'needs_confirm' | 'needs_adjustment' | 'official' | 'with_exception';

const EMPTY_EXCEPTION_FORM: ExceptionFormState = {
  open: false,
  target: null,
  type: 'leave',
  leaveHandling: 'admin_arrange',
  reason: '',
  requestedDate: '',
  requestedSession: '',
  requestedRoomId: '',
};

const SESSION_ORDER: Record<string, number> = {
  SANG: 1,
  CHIEU: 2,
  TOI: 3,
};

const SHIFT_FILTERS: Array<{ key: ShiftFilterKey; label: string }> = [
  { key: 'all', label: 'Tất cả ca' },
  { key: 'needs_confirm', label: 'Cần xác nhận' },
  { key: 'needs_adjustment', label: 'Cần điều chỉnh' },
  { key: 'with_exception', label: 'Đã gửi ngoại lệ' },
  { key: 'official', label: 'Ca chính thức' },
];

function getNextWeekStartIso() {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + 7);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(
    monday.getDate(),
  ).padStart(2, '0')}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const maybeResponse = error as { response?: { data?: { message?: string | string[] } } };
    const message = maybeResponse.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message.trim()) return message;

    const maybeError = error as { message?: string };
    if (typeof maybeError.message === 'string' && maybeError.message.trim()) return maybeError.message;
  }
  return fallback;
}

function formatRequestedChange(item: ScheduleExceptionRequestItem) {
  const parts: string[] = [];
  if (item.requestedChange.date) parts.push(formatDateDdMmYyyy(item.requestedChange.date));
  if (item.requestedChange.session) parts.push(getSessionLabel(item.requestedChange.session));
  if (item.requestedChange.room) parts.push(item.requestedChange.room.P_TEN);
  return parts.length > 0 ? parts.join(' • ') : 'Không có đề xuất cụ thể';
}

function isSunday(dateValue?: string) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  return date.getDay() === 0;
}

function isSameProposedShift(
  target: WeeklyScheduleItem | null,
  requestedDate: string,
  requestedSession: string,
  requestedRoomId: string,
) {
  if (!target) return false;
  if (!requestedDate || !requestedSession || !requestedRoomId) return false;
  return (
    requestedDate === target.N_NGAY &&
    requestedSession === target.B_TEN &&
    Number(requestedRoomId) === target.room.P_MA
  );
}

function sortWeeklyItems(items: WeeklyScheduleItem[]) {
  return [...items].sort((a, b) => {
    if (a.N_NGAY !== b.N_NGAY) return a.N_NGAY.localeCompare(b.N_NGAY);
    const sessionA = SESSION_ORDER[a.B_TEN] || 99;
    const sessionB = SESSION_ORDER[b.B_TEN] || 99;
    return sessionA - sessionB;
  });
}

function groupByDate(items: WeeklyScheduleItem[]) {
  const map = new Map<string, WeeklyScheduleItem[]>();
  items.forEach((item) => {
    const current = map.get(item.N_NGAY) || [];
    current.push(item);
    map.set(item.N_NGAY, current);
  });

  return Array.from(map.entries()).map(([date, groupedItems]) => ({
    date,
    weekday: getWeekdayLabelFromDate(date),
    items: sortWeeklyItems(groupedItems),
  }));
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-blue-300 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-slate-50',
      )}
    >
      {label}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  helper: string;
  tone: 'slate' | 'amber' | 'emerald' | 'blue' | 'rose';
  icon: LucideIcon;
}) {
  const toneCardClass: Record<typeof tone, string> = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    blue: 'border-blue-200 bg-blue-50 text-blue-950',
    rose: 'border-rose-200 bg-rose-50 text-rose-950',
  };

  const toneIconClass: Record<typeof tone, string> = {
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    rose: 'bg-rose-100 text-rose-700',
  };

  return (
    <Card className={cn('rounded-2xl shadow-sm', toneCardClass[tone])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-current/70">{label}</p>
            <p className="mt-2 text-3xl font-semibold leading-none">{value}</p>
            <p className="mt-2 text-xs text-current/75">{helper}</p>
          </div>
          <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl', toneIconClass[tone])}>
            <Icon className="h-4.5 w-4.5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={`doctor-shift-skeleton-${index}`} className="rounded-2xl border-slate-200">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-10/12" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-28 rounded-lg" />
              <Skeleton className="h-7 w-36 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ShiftCard({
  item,
  canConfirm,
  canRequestChange,
  onConfirm,
  onRequest,
  loadingConfirm,
}: {
  item: WeeklyScheduleItem;
  canConfirm: boolean;
  canRequestChange: boolean;
  onConfirm: () => void;
  onRequest: () => void;
  loadingConfirm: boolean;
}) {
  const needsAdjustment = item.status === SHIFT_STATUS.change_requested;
  const isOfficial = item.status === SHIFT_STATUS.finalized;

  return (
    <Card
      className={cn(
        'rounded-2xl border shadow-sm transition-colors',
        needsAdjustment
          ? 'border-rose-200 bg-rose-50/60'
          : canConfirm
            ? 'border-amber-200 bg-amber-50/60'
            : isOfficial
              ? 'border-blue-200 bg-blue-50/50'
              : 'border-slate-200 bg-white',
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                {getSessionLabel(item.B_TEN)} • {item.room.P_TEN}
              </h3>
              <span
                className={cn(
                  'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  getWeeklyScheduleStatusBadgeClass(item.status),
                )}
              >
                {getWeeklyScheduleStatusLabel(item.status)}
              </span>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {getWeeklyScheduleSourceLabel(item.source)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Slot: <span className="font-medium text-slate-800">{item.slotCount}</span>
              {item.slotMax ? `/${item.slotMax}` : ''} • Đang có{' '}
              <span className="font-medium text-slate-800">{item.bookingCount}</span> lịch hẹn
            </p>
            {item.latestException ? (
              <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <p className="font-medium text-slate-800">
                  Yêu cầu gần nhất: {getExceptionTypeLabel(item.latestException.type)} -{' '}
                  {getExceptionStatusLabel(item.latestException.status)}
                </p>
                <p className="mt-1 line-clamp-2">{item.latestException.reason}</p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={!canConfirm || loadingConfirm}
              className={cn(canConfirm ? 'bg-blue-600 hover:bg-blue-700' : '')}
              variant={canConfirm ? 'default' : 'outline'}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              {loadingConfirm ? 'Đang xác nhận...' : 'Xác nhận'}
            </Button>
            <Button
              size="sm"
              variant={canRequestChange ? 'outline' : 'ghost'}
              onClick={onRequest}
              disabled={!canRequestChange}
              className={cn(canRequestChange ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'text-slate-400')}
            >
              <Send className="mr-1 h-4 w-4" />
              Gửi yêu cầu điều chỉnh
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExceptionCard({ item }: { item: ScheduleExceptionRequestItem }) {
  return (
    <Card className="rounded-2xl border-slate-200 shadow-sm">
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{getExceptionTypeLabel(item.type)}</p>
          <span
            className={cn(
              'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium',
              getExceptionStatusBadgeClass(item.status),
            )}
          >
            {getExceptionStatusLabel(item.status)}
          </span>
        </div>
        <p className="text-sm text-slate-600">
          Ca mục tiêu: {formatDateDdMmYyyy(item.targetShift.N_NGAY)} • {getSessionLabel(item.targetShift.B_TEN)}
        </p>
        <p className="text-sm text-slate-600">Đề xuất: {formatRequestedChange(item)}</p>
        <p className="text-sm text-slate-700">Lý do: {item.reason}</p>
        {item.adminNote ? <p className="text-xs text-slate-500">Ghi chú admin: {item.adminNote}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function DoctorWeeklyScheduleWorkflowPage() {
  const queryClient = useQueryClient();
  const weekPickerRef = useRef<HTMLInputElement>(null);

  const [weekStart, setWeekStart] = useState(getNextWeekStartIso());
  const [viewMode, setViewMode] = useState<ShiftViewMode>('grouped');
  const [shiftFilter, setShiftFilter] = useState<ShiftFilterKey>('all');
  const [exceptionForm, setExceptionForm] = useState<ExceptionFormState>(EMPTY_EXCEPTION_FORM);

  const overviewQuery = useQuery({
    queryKey: ['doctor-weekly-workflow-overview', weekStart],
    queryFn: () => doctorScheduleWorkflowApi.getWeekOverview(weekStart),
  });

  const schedulesQuery = useQuery({
    queryKey: ['doctor-weekly-workflow-schedules', weekStart],
    queryFn: () => doctorScheduleWorkflowApi.getWeeklySchedules(weekStart),
  });

  const exceptionsQuery = useQuery({
    queryKey: ['doctor-weekly-workflow-exceptions', weekStart],
    queryFn: () => doctorScheduleWorkflowApi.getExceptionRequests(weekStart),
  });

  const supportOptionsQuery = useQuery({
    queryKey: ['doctor-weekly-workflow-support-options'],
    queryFn: doctorScheduleApi.getRegistrationOptions,
    enabled: exceptionForm.open,
    staleTime: 60_000,
  });

  const weekOverview = overviewQuery.data;
  const weeklyItemsRaw = schedulesQuery.data?.items ?? [];
  const weeklyItems = useMemo(() => sortWeeklyItems(weeklyItemsRaw), [weeklyItemsRaw]);
  const exceptionItems = exceptionsQuery.data?.items ?? [];

  const canConfirmShift = (item: WeeklyScheduleItem) =>
    Boolean(
      weekOverview?.canConfirm &&
        (item.status === SHIFT_STATUS.generated || item.status === SHIFT_STATUS.adjusted),
    );

  const canRequestChange = (item: WeeklyScheduleItem) =>
    Boolean(
      weekOverview?.canRequestChanges &&
        item.status !== SHIFT_STATUS.finalized &&
        item.status !== SHIFT_STATUS.cancelled &&
        item.status !== SHIFT_STATUS.cancelled_by_doctor_leave &&
        item.status !== SHIFT_STATUS.vacant_by_leave,
    );

  const filteredWeeklyItems = useMemo(() => {
    if (shiftFilter === 'all') return weeklyItems;
    if (shiftFilter === 'needs_confirm') return weeklyItems.filter((item) => canConfirmShift(item));
    if (shiftFilter === 'needs_adjustment')
      return weeklyItems.filter((item) => item.status === SHIFT_STATUS.change_requested);
    if (shiftFilter === 'official') return weeklyItems.filter((item) => item.status === SHIFT_STATUS.finalized);
    return weeklyItems.filter((item) => Boolean(item.latestException));
  }, [shiftFilter, weeklyItems, weekOverview]);

  const groupedSchedules = useMemo(() => groupByDate(filteredWeeklyItems), [filteredWeeklyItems]);
  const finalizedItems = useMemo(
    () => weeklyItems.filter((item) => item.status === SHIFT_STATUS.finalized),
    [weeklyItems],
  );

  const pendingExceptionCount = useMemo(
    () => exceptionItems.filter((item) => item.status === 'pending').length,
    [exceptionItems],
  );

  const needActionCount = useMemo(
    () =>
      weeklyItems.filter(
        (item) => canConfirmShift(item) || item.status === SHIFT_STATUS.change_requested,
      ).length,
    [weeklyItems, weekOverview],
  );

  const invalidateDoctorWorkflow = () => {
    queryClient.invalidateQueries({ queryKey: ['doctor-weekly-workflow-overview'] });
    queryClient.invalidateQueries({ queryKey: ['doctor-weekly-workflow-schedules'] });
    queryClient.invalidateQueries({ queryKey: ['doctor-weekly-workflow-exceptions'] });
  };

  const confirmWeekMutation = useMutation({
    mutationFn: () => doctorScheduleWorkflowApi.confirmWeek(weekStart),
    onSuccess: (result) => {
      toast.success(
        `Đã xác nhận tuần làm việc (${result.confirmedCount} ca, ${result.acknowledgedAdjustedCount} ca điều chỉnh).`,
      );
      invalidateDoctorWorkflow();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Không thể xác nhận tuần làm việc.'));
    },
  });

  const confirmShiftMutation = useMutation({
    mutationFn: (item: WeeklyScheduleItem) =>
      doctorScheduleWorkflowApi.confirmShift(item.N_NGAY, item.B_TEN),
    onSuccess: () => {
      toast.success('Đã xác nhận ca làm việc.');
      invalidateDoctorWorkflow();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Không thể xác nhận ca.'));
    },
  });

  const exceptionSaveReason = useMemo(() => {
    if (!exceptionForm.target) return 'Chưa chọn ca cần xử lý.';
    if (!exceptionForm.reason.trim()) return 'Nhập lý do gửi yêu cầu.';

    if (exceptionForm.type === 'leave' && exceptionForm.leaveHandling === 'makeup') {
      if (
        !exceptionForm.requestedDate ||
        !exceptionForm.requestedSession ||
        !exceptionForm.requestedRoomId
      ) {
        return 'Nhập đầy đủ ngày, buổi và phòng cho ca bù.';
      }
      if (isSunday(exceptionForm.requestedDate)) return 'Không thể chọn Chủ nhật cho ca bù.';
      if (
        isSameProposedShift(
          exceptionForm.target,
          exceptionForm.requestedDate,
          exceptionForm.requestedSession,
          exceptionForm.requestedRoomId,
        )
      ) {
        return 'Ca bù không được trùng ca hiện tại.';
      }
    }

    if (exceptionForm.type === 'shift_change') {
      if (
        !exceptionForm.requestedDate ||
        !exceptionForm.requestedSession ||
        !exceptionForm.requestedRoomId
      ) {
        return 'Nhập đầy đủ ngày, buổi và phòng đề xuất.';
      }
      if (isSunday(exceptionForm.requestedDate)) return 'Không thể chọn Chủ nhật cho ca đề xuất.';
      if (
        isSameProposedShift(
          exceptionForm.target,
          exceptionForm.requestedDate,
          exceptionForm.requestedSession,
          exceptionForm.requestedRoomId,
        )
      ) {
        return 'Ca đề xuất không được trùng ca hiện tại.';
      }
    }

    return null;
  }, [exceptionForm]);

  const exceptionMutation = useMutation({
    mutationFn: async () => {
      if (exceptionSaveReason) throw new Error(exceptionSaveReason);

      return doctorScheduleWorkflowApi.createExceptionRequest({
        targetDate: exceptionForm.target!.N_NGAY,
        targetSession: exceptionForm.target!.B_TEN,
        type: exceptionForm.type,
        reason: exceptionForm.reason.trim(),
        requestedDate: exceptionForm.requestedDate || null,
        requestedSession: exceptionForm.requestedSession || null,
        requestedRoomId: exceptionForm.requestedRoomId ? Number(exceptionForm.requestedRoomId) : null,
      });
    },
    onSuccess: () => {
      toast.success('Đã gửi yêu cầu điều chỉnh.');
      setExceptionForm(EMPTY_EXCEPTION_FORM);
      invalidateDoctorWorkflow();
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Không thể gửi yêu cầu lúc này.'));
    },
  });

  const openWeekPicker = () => {
    const input = weekPickerRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
  };

  const openExceptionDialog = (target: WeeklyScheduleItem) => {
    setExceptionForm({
      open: true,
      target,
      type: 'leave',
      leaveHandling: 'admin_arrange',
      reason: '',
      requestedDate: '',
      requestedSession: '',
      requestedRoomId: '',
    });
  };

  const hasError = overviewQuery.isError || schedulesQuery.isError || exceptionsQuery.isError;

  return (
    <div className="space-y-6 p-8">
      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Lịch làm việc của tôi</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Lịch tuần được sinh từ mẫu dài hạn. Bác sĩ có thể xem, xác nhận hoặc gửi yêu cầu điều chỉnh/ngoại lệ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Input
                type="text"
                readOnly
                value={formatDateDdMmYyyySlash(weekStart)}
                onClick={openWeekPicker}
                className="w-[170px] cursor-pointer bg-white"
              />
              <input
                ref={weekPickerRef}
                type="date"
                value={weekStart}
                onChange={(event) => setWeekStart(event.target.value)}
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0"
              />
            </div>

            <Button
              onClick={() => confirmWeekMutation.mutate()}
              disabled={confirmWeekMutation.isPending || !weekOverview?.canConfirm}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              <ShieldCheck className="h-4 w-4" />
              {confirmWeekMutation.isPending ? 'Đang xác nhận...' : 'Xác nhận tuần'}
            </Button>
          </div>
        </div>
      </section>

      {hasError ? (
        <Card className="rounded-2xl border-rose-200 bg-rose-50 shadow-sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-rose-700">
            <p>Không thể tải dữ liệu lịch làm việc. Vui lòng thử lại.</p>
            <Button
              variant="outline"
              className="border-rose-200 bg-white text-rose-700"
              onClick={() => {
                void overviewQuery.refetch();
                void schedulesQuery.refetch();
                void exceptionsQuery.refetch();
              }}
            >
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-1 text-sm text-blue-900">
            <p className="font-semibold">
              {overviewQuery.isLoading ? 'Đang tải thông tin tuần...' : weekOverview?.doctor.BS_HO_TEN || '-'}
            </p>
            <p>Chuyên khoa: {weekOverview?.doctor.CHUYEN_KHOA.CK_TEN || '-'}</p>
            <p>
              Tuần {formatDateDdMmYyyy(weekOverview?.weekStartDate)} -{' '}
              {formatDateDdMmYyyy(weekOverview?.weekEndDate)}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex rounded-full border px-3 py-1 text-sm font-medium',
                  getWeekWorkflowStatusBadgeClass(
                    weekOverview?.workflowStatus ?? WEEK_STATUS.generated,
                  ),
                )}
              >
                {getWeekWorkflowStatusLabel(weekOverview?.workflowStatus ?? WEEK_STATUS.generated)}
              </span>
              <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                Chờ xử lý: {needActionCount}
              </span>
            </div>
            <p className="text-sm text-blue-900">
              {weekOverview?.canRequestChanges
                ? 'Bạn có thể gửi yêu cầu điều chỉnh/ngoại lệ cho các ca chưa chốt.'
                : 'Tuần này chỉ còn chế độ xem lịch do đã chốt hoặc đóng.'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        {overviewQuery.isLoading ? (
          Array.from({ length: 6 }).map((_, idx) => (
            <Card key={`doctor-week-kpi-skeleton-${idx}`} className="rounded-2xl border-slate-200">
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-3 w-28" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <SummaryCard
              label="Tổng ca"
              value={weeklyItems.length}
              helper="Tổng ca trong tuần"
              tone="slate"
              icon={CalendarClock}
            />
            <SummaryCard
              label="Đã sinh"
              value={weekOverview?.summary.generated ?? 0}
              helper="Ca sinh từ template"
              tone="amber"
              icon={Clock3}
            />
            <SummaryCard
              label="Đã xác nhận"
              value={weekOverview?.summary.confirmed ?? 0}
              helper="Đã được bác sĩ xác nhận"
              tone="emerald"
              icon={ClipboardCheck}
            />
            <SummaryCard
              label="Cần điều chỉnh"
              value={weekOverview?.summary.changeRequested ?? 0}
              helper="Ưu tiên xử lý sớm"
              tone="rose"
              icon={AlertCircle}
            />
            <SummaryCard
              label="Ca chính thức"
              value={weekOverview?.summary.finalized ?? 0}
              helper="Đã chốt và mở slot"
              tone="blue"
              icon={ShieldCheck}
            />
            <SummaryCard
              label="Yêu cầu chờ duyệt"
              value={pendingExceptionCount}
              helper="Ngoại lệ đang chờ admin"
              tone="amber"
              icon={FileClock}
            />
          </>
        )}
      </section>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-base">Lịch tuần được sinh</CardTitle>
              <CardDescription>
                Ưu tiên xử lý các ca cần xác nhận hoặc cần điều chỉnh. Bạn có thể chuyển đổi cách xem theo nhu cầu.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={viewMode === 'grouped' ? 'default' : 'outline'}
                size="sm"
                className={cn(viewMode === 'grouped' ? 'bg-blue-600 hover:bg-blue-700' : '')}
                onClick={() => setViewMode('grouped')}
              >
                <Rows2 className="mr-1 h-4 w-4" />
                Theo ngày
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                <LayoutList className="mr-1 h-4 w-4" />
                Bảng
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {SHIFT_FILTERS.map((item) => (
              <FilterChip
                key={item.key}
                active={shiftFilter === item.key}
                label={item.label}
                onClick={() => setShiftFilter(item.key)}
              />
            ))}
          </div>

          {schedulesQuery.isLoading ? (
            <ScheduleSkeleton />
          ) : filteredWeeklyItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <ListFilter className="mx-auto h-9 w-9 text-slate-300" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900">Không có ca phù hợp bộ lọc hiện tại</h3>
              <p className="mt-1 text-sm text-slate-500">
                Hãy chọn bộ lọc khác hoặc đổi tuần để xem thêm lịch làm việc.
              </p>
              <Button variant="outline" className="mt-3" onClick={() => setShiftFilter('all')}>
                Xóa bộ lọc
              </Button>
            </div>
          ) : viewMode === 'grouped' ? (
            <div className="space-y-4">
              {groupedSchedules.map((group) => (
                <section key={group.date} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="text-sm font-semibold text-slate-800">
                      {group.weekday} - {formatDateDdMmYyyy(group.date)}
                    </h3>
                    <span className="text-xs text-slate-500">{group.items.length} ca</span>
                  </div>

                  <div className="space-y-3">
                    {group.items.map((item) => (
                      <ShiftCard
                        key={`${item.N_NGAY}-${item.B_TEN}`}
                        item={item}
                        canConfirm={canConfirmShift(item)}
                        canRequestChange={canRequestChange(item)}
                        loadingConfirm={confirmShiftMutation.isPending}
                        onConfirm={() => confirmShiftMutation.mutate(item)}
                        onRequest={() => openExceptionDialog(item)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="max-h-[560px] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-slate-50">
                    <TableRow className="hover:bg-slate-50">
                      <TableHead>Ngày</TableHead>
                      <TableHead>Thứ</TableHead>
                      <TableHead>Buổi</TableHead>
                      <TableHead>Phòng</TableHead>
                      <TableHead>Nguồn</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Yêu cầu gần nhất</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWeeklyItems.map((item) => (
                      <TableRow
                        key={`table-${item.N_NGAY}-${item.B_TEN}`}
                        className={cn(
                          item.status === SHIFT_STATUS.change_requested && 'bg-rose-50/60',
                          canConfirmShift(item) && 'bg-amber-50/40',
                        )}
                      >
                        <TableCell className="font-medium text-slate-900">
                          {formatDateDdMmYyyy(item.N_NGAY)}
                        </TableCell>
                        <TableCell>{getWeekdayLabelFromDate(item.N_NGAY)}</TableCell>
                        <TableCell>{getSessionLabel(item.B_TEN)}</TableCell>
                        <TableCell>{item.room.P_TEN}</TableCell>
                        <TableCell>{getWeeklyScheduleSourceLabel(item.source)}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium',
                              getWeeklyScheduleStatusBadgeClass(item.status),
                            )}
                          >
                            {getWeeklyScheduleStatusLabel(item.status)}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[260px] whitespace-normal text-sm leading-6 text-slate-600">
                          {item.latestException ? (
                            <div className="space-y-1">
                              <p>
                                {getExceptionTypeLabel(item.latestException.type)} -{' '}
                                {getExceptionStatusLabel(item.latestException.status)}
                              </p>
                              <p className="text-xs text-slate-500">{item.latestException.reason}</p>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant={canConfirmShift(item) ? 'default' : 'outline'}
                              className={cn(canConfirmShift(item) ? 'bg-blue-600 hover:bg-blue-700' : '')}
                              onClick={() => confirmShiftMutation.mutate(item)}
                              disabled={!canConfirmShift(item) || confirmShiftMutation.isPending}
                            >
                              Xác nhận
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openExceptionDialog(item)}
                              disabled={!canRequestChange(item)}
                            >
                              Điều chỉnh
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Yêu cầu điều chỉnh của tôi</CardTitle>
          <CardDescription>
            Theo dõi trạng thái duyệt, ghi chú từ admin và các thay đổi đã gửi trong tuần.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exceptionsQuery.isLoading ? (
            <ScheduleSkeleton />
          ) : exceptionItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
              Bạn chưa gửi yêu cầu điều chỉnh nào trong tuần này.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {exceptionItems.map((item) => (
                <ExceptionCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Lịch chính thức</CardTitle>
          <CardDescription>
            Các ca đã chốt chính thức trong tuần, sẵn sàng phục vụ lịch khám bệnh nhân.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schedulesQuery.isLoading ? (
            <ScheduleSkeleton />
          ) : finalizedItems.length === 0 ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-5 py-8 text-sm text-blue-900">
              Tuần này chưa có ca chính thức. Sau khi admin chốt tuần, dữ liệu sẽ hiển thị tại đây.
            </div>
          ) : (
            <div className="space-y-3">
              {groupByDate(finalizedItems).map((group) => (
                <div key={`official-${group.date}`} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {group.weekday} - {formatDateDdMmYyyy(group.date)}
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((item) => (
                      <div
                        key={`official-${item.N_NGAY}-${item.B_TEN}`}
                        className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm text-blue-900"
                      >
                        <p className="font-medium">{getSessionLabel(item.B_TEN)}</p>
                        <p className="text-blue-800">
                          {item.room.P_TEN} • Slot {item.slotCount}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={exceptionForm.open}
        onOpenChange={(open) =>
          setExceptionForm((prev) => (open ? prev : EMPTY_EXCEPTION_FORM))
        }
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gửi yêu cầu điều chỉnh</DialogTitle>
            <DialogDescription>
              {exceptionForm.target
                ? `${formatDateDdMmYyyy(exceptionForm.target.N_NGAY)} - ${getSessionLabel(exceptionForm.target.B_TEN)} - ${exceptionForm.target.room.P_TEN}`
                : '-'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Loại yêu cầu</label>
              <AdminSelect
                value={exceptionForm.type}
                onValueChange={(value) =>
                  setExceptionForm((prev) => ({
                    ...prev,
                    type: value as ExceptionRequestType,
                    leaveHandling: value === 'leave' ? 'admin_arrange' : prev.leaveHandling,
                    requestedDate: '',
                    requestedSession: '',
                    requestedRoomId: '',
                  }))
                }
              >
                <AdminSelectTrigger>
                  <AdminSelectValue placeholder="Chọn loại yêu cầu" />
                </AdminSelectTrigger>
                <AdminSelectContent>
                  <AdminSelectItem value="leave">Xin nghỉ</AdminSelectItem>
                  <AdminSelectItem value="shift_change">Đổi lịch trực</AdminSelectItem>
                </AdminSelectContent>
              </AdminSelect>
            </div>

            {exceptionForm.type === 'leave' ? (
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Phương án xử lý
                </label>
                <AdminSelect
                  value={exceptionForm.leaveHandling}
                  onValueChange={(value) =>
                    setExceptionForm((prev) => ({
                      ...prev,
                      leaveHandling: value as ExceptionFormState['leaveHandling'],
                      requestedDate: value === 'makeup' ? prev.requestedDate : '',
                      requestedSession: value === 'makeup' ? prev.requestedSession : '',
                      requestedRoomId: value === 'makeup' ? prev.requestedRoomId : '',
                    }))
                  }
                >
                  <AdminSelectTrigger>
                    <AdminSelectValue placeholder="Chọn phương án" />
                  </AdminSelectTrigger>
                  <AdminSelectContent>
                    <AdminSelectItem value="admin_arrange">
                      Nhờ admin sắp xếp người thay
                    </AdminSelectItem>
                    <AdminSelectItem value="makeup">Đề xuất ca bù</AdminSelectItem>
                  </AdminSelectContent>
                </AdminSelect>
              </div>
            ) : null}

            {(exceptionForm.type === 'shift_change' || exceptionForm.leaveHandling === 'makeup') ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Ngày đề xuất
                  </label>
                  <Input
                    type="date"
                    value={exceptionForm.requestedDate}
                    onChange={(event) =>
                      setExceptionForm((prev) => ({ ...prev, requestedDate: event.target.value }))
                    }
                  />
                  <p className="mt-1 text-xs text-slate-500">Không chọn Chủ nhật.</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Buổi đề xuất
                  </label>
                  <AdminSelect
                    value={exceptionForm.requestedSession || 'none'}
                    onValueChange={(value) =>
                      setExceptionForm((prev) => ({
                        ...prev,
                        requestedSession: value === 'none' ? '' : value,
                      }))
                    }
                  >
                    <AdminSelectTrigger>
                      <AdminSelectValue placeholder="Chọn buổi" />
                    </AdminSelectTrigger>
                    <AdminSelectContent>
                      <AdminSelectItem value="none">Chọn buổi</AdminSelectItem>
                      {(supportOptionsQuery.data?.sessions ?? []).map((session) => (
                        <AdminSelectItem key={session.B_TEN} value={session.B_TEN}>
                          {getSessionLabel(session.B_TEN)}
                        </AdminSelectItem>
                      ))}
                    </AdminSelectContent>
                  </AdminSelect>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Phòng đề xuất
                  </label>
                  <AdminSelect
                    value={exceptionForm.requestedRoomId || 'none'}
                    onValueChange={(value) =>
                      setExceptionForm((prev) => ({
                        ...prev,
                        requestedRoomId: value === 'none' ? '' : value,
                      }))
                    }
                  >
                    <AdminSelectTrigger>
                      <AdminSelectValue placeholder="Chọn phòng" />
                    </AdminSelectTrigger>
                    <AdminSelectContent>
                      <AdminSelectItem value="none">Chọn phòng</AdminSelectItem>
                      {(supportOptionsQuery.data?.rooms ?? []).map((room) => (
                        <AdminSelectItem key={room.P_MA} value={String(room.P_MA)}>
                          {room.P_TEN}
                        </AdminSelectItem>
                      ))}
                    </AdminSelectContent>
                  </AdminSelect>
                </div>
              </>
            ) : null}

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">Lý do</label>
              <Textarea
                value={exceptionForm.reason}
                onChange={(event) =>
                  setExceptionForm((prev) => ({ ...prev, reason: event.target.value }))
                }
                placeholder="Mô tả lý do và đề xuất xử lý"
              />
            </div>
          </div>

          {exceptionForm.target?.weekStatus === WEEK_STATUS.slot_opened ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Tuần này đã mở slot. Hãy cân nhắc kỹ vì có thể đã có lịch khám của bệnh nhân.
            </p>
          ) : null}

          {exceptionForm.target?.bookingCount ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              Ca này hiện có {exceptionForm.target.bookingCount} lịch hẹn bệnh nhân. Khi yêu cầu được duyệt, hệ thống
              có thể cần xử lý lịch hẹn liên quan theo quy trình vận hành.
            </p>
          ) : null}

          {exceptionSaveReason ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {exceptionSaveReason}
            </p>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setExceptionForm(EMPTY_EXCEPTION_FORM)}>
              Đóng
            </Button>
            <Button onClick={() => exceptionMutation.mutate()} disabled={exceptionMutation.isPending}>
              {exceptionMutation.isPending ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
