import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleCheckBig,
  CircleDashed,
  Clock3,
  ClipboardList,
  FileCheck2,
  Info,
  Lock,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { doctorScheduleApi } from '@/services/api/doctorScheduleApi';
import type { ScheduleWorkflowStatus } from '@/services/api/adminApi';
import {
  formatDateDdMmYyyy,
  getCycleStatusLabel,
  getScheduleStatusBadgeClass,
  getScheduleWorkflowStatusLabel,
  getSessionLabel,
  getWeekdayLabel,
  getWeekdayLabelFromDate,
  toDateOnlyIso,
} from '@/lib/scheduleDisplay';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

type RegistrationFormState = {
  originalKey: null | { date: string; session: string };
  N_NGAY: string;
  B_TEN: string;
  P_MA: string;
};

type RegistrationStatusFilter = 'all' | ScheduleWorkflowStatus;

const EMPTY_FORM: RegistrationFormState = { originalKey: null, N_NGAY: '', B_TEN: '', P_MA: '' };
const REGISTRATION_FILTERS: Array<{ value: RegistrationStatusFilter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' },
];

function getRegistrationFilterButtonClass(filter: RegistrationStatusFilter, active: boolean) {
  const baseClass =
    'border transition-colors shadow-none focus-visible:ring-2 focus-visible:ring-offset-0';

  if (filter === 'pending') {
    return cn(
      baseClass,
      active
        ? 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-100 focus-visible:ring-amber-200'
        : 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100 focus-visible:ring-amber-200',
    );
  }

  if (filter === 'approved') {
    return cn(
      baseClass,
      active
        ? 'border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-100 focus-visible:ring-emerald-200'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100 focus-visible:ring-emerald-200',
    );
  }

  if (filter === 'rejected') {
    return cn(
      baseClass,
      active
        ? 'border-rose-300 bg-rose-100 text-rose-900 hover:bg-rose-100 focus-visible:ring-rose-200'
        : 'border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-300 hover:bg-rose-100 focus-visible:ring-rose-200',
    );
  }

  return cn(
    baseClass,
    active
      ? 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-100 focus-visible:ring-slate-200'
      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 focus-visible:ring-slate-200',
  );
}

function formatDateTime(raw: string | null | undefined) {
  if (!raw) return '-';
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function getCycleBadgeClass(status: string | null | undefined) {
  if (status === 'open') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'finalized') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function getDeadlineMessage(cycle?: {
  status?: string | null;
  registrationCloseAt?: string | null;
  adminReviewWindowEndAt?: string | null;
}) {
  if (!cycle) return 'Đang tải thông tin thời hạn đăng ký.';
  if (cycle.status === 'open') {
    return `Bạn có thể đăng ký, chỉnh sửa hoặc hủy đến ${formatDateTime(
      cycle.registrationCloseAt,
    )}. Sau đó admin sẽ duyệt và chốt lịch.`;
  }
  if (cycle.status === 'locked') {
    return `Đã hết thời gian tự điều chỉnh. Admin đang duyệt và chốt lịch đến ${formatDateTime(
      cycle.adminReviewWindowEndAt,
    )}.`;
  }
  return 'Tuần làm việc này đã được chốt. Bạn chỉ còn quyền xem lịch trực chính thức.';
}

function getContextMeta(status: string) {
  if (status === 'official') {
    return {
      label: 'Chính thức',
      Icon: CheckCircle2,
      cardClass: 'border-blue-200 bg-blue-50/80 text-blue-900',
      badgeClass: 'bg-blue-100 text-blue-800',
      iconClass: 'bg-blue-100 text-blue-700',
    };
  }
  if (status === 'approved') {
    return {
      label: 'Đã duyệt',
      Icon: CircleCheckBig,
      cardClass: 'border-emerald-200 bg-emerald-50/80 text-emerald-900',
      badgeClass: 'bg-emerald-100 text-emerald-800',
      iconClass: 'bg-emerald-100 text-emerald-700',
    };
  }
  if (status === 'pending') {
    return {
      label: 'Chờ duyệt',
      Icon: Clock3,
      cardClass: 'border-amber-200 bg-amber-50/80 text-amber-900',
      badgeClass: 'bg-amber-100 text-amber-800',
      iconClass: 'bg-amber-100 text-amber-700',
    };
  }
  if (status === 'rejected') {
    return {
      label: 'Từ chối',
      Icon: AlertCircle,
      cardClass: 'border-rose-200 bg-rose-50/80 text-rose-900',
      badgeClass: 'bg-rose-100 text-rose-800',
      iconClass: 'bg-rose-100 text-rose-700',
    };
  }
  return {
    label: 'Trống',
    Icon: CircleDashed,
    cardClass: 'border-slate-200 bg-slate-50 text-slate-900',
    badgeClass: 'bg-slate-200/80 text-slate-700',
    iconClass: 'bg-slate-200/80 text-slate-600',
  };
}

function SummaryStat({
  label,
  value,
  note,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: 'default' | 'warning' | 'success' | 'danger' | 'info';
}) {
  const cardClass =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50/70'
      : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50/70'
      : tone === 'danger'
      ? 'border-rose-200 bg-rose-50/70'
      : tone === 'info'
      ? 'border-blue-200 bg-blue-50/70'
      : 'border-gray-100 bg-gray-50';
  const valueClass =
    tone === 'warning'
      ? 'text-amber-700'
      : tone === 'success'
      ? 'text-emerald-700'
      : tone === 'danger'
      ? 'text-rose-700'
      : tone === 'info'
      ? 'text-blue-700'
      : 'text-gray-900';

  return (
    <div className={cn('rounded-xl border px-4 py-3 shadow-sm', cardClass)}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold', valueClass)}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{note}</p>
    </div>
  );
}

export default function DoctorSchedulePage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RegistrationFormState>(EMPTY_FORM);
  const [registrationFilter, setRegistrationFilter] =
    useState<RegistrationStatusFilter>('all');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, date: '', session: '' });

  const { data: cycle, isLoading: cycleLoading } = useQuery({
    queryKey: ['doctor-schedule-cycle'],
    queryFn: () => doctorScheduleApi.getRegistrationCycle(),
  });
  const { data: options, isLoading: optionsLoading } = useQuery({
    queryKey: ['doctor-schedule-options'],
    queryFn: () => doctorScheduleApi.getRegistrationOptions(),
  });
  const { data: registrations, isLoading: registrationsLoading } = useQuery({
    queryKey: ['doctor-schedule-registrations', cycle?.weekStartDate],
    queryFn: () => doctorScheduleApi.getMyRegistrations(cycle?.weekStartDate),
    enabled: Boolean(cycle?.weekStartDate),
  });
  const { data: officialShifts, isLoading: officialLoading } = useQuery({
    queryKey: ['doctor-schedule-official', cycle?.weekStartDate],
    queryFn: () => doctorScheduleApi.getMyOfficialShifts(cycle?.weekStartDate),
    enabled: Boolean(cycle?.weekStartDate),
  });

  const dayContextParams = useMemo(
    () => ({
      date: form.N_NGAY,
      roomId: form.P_MA ? Number(form.P_MA) : undefined,
      excludeDate: form.originalKey?.date,
      excludeSession: form.originalKey?.session,
    }),
    [form.N_NGAY, form.P_MA, form.originalKey],
  );
  const { data: dayContext, isLoading: dayContextLoading } = useQuery({
    queryKey: ['doctor-schedule-day-context', dayContextParams],
    queryFn: () => doctorScheduleApi.getDayContext(dayContextParams),
    enabled: Boolean(form.N_NGAY),
    staleTime: 15_000,
  });

  const sessionContextMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof dayContext>['sessionContext'][number]>();
    (dayContext?.sessionContext ?? []).forEach((item) => map.set(item.session, item));
    return map;
  }, [dayContext?.sessionContext]);
  const selectedSessionContext = useMemo(
    () => sessionContextMap.get(form.B_TEN),
    [form.B_TEN, sessionContextMap],
  );
  const selectedRoom = useMemo(
    () => options?.rooms.find((room) => room.P_MA === Number(form.P_MA)),
    [form.P_MA, options?.rooms],
  );

  const registrationItems = registrations?.items ?? [];
  const officialItems = officialShifts?.items ?? [];
  const pendingCount = registrationItems.filter((item) => item.status === 'pending').length;
  const approvedCount = registrationItems.filter((item) => item.status === 'approved').length;
  const rejectedCount = registrationItems.filter((item) => item.status === 'rejected').length;
  const officialCount =
    cycle?.status === 'finalized'
      ? officialItems.filter((item) => item.status === 'official').length
      : 0;
  const totalOfficialSlots = officialItems.reduce((sum, item) => sum + (item.slotCount || 0), 0);
  const filteredRegistrations = useMemo(() => {
    if (registrationFilter === 'all') return registrationItems;
    return registrationItems.filter((item) => item.status === registrationFilter);
  }, [registrationFilter, registrationItems]);

  const isCycleOpen = cycle?.status === 'open';
  const deadlineMessage = getDeadlineMessage(cycle);
  const saveBlockReason = useMemo(() => {
    if (!isCycleOpen) {
      return cycle?.status === 'finalized'
        ? 'Tuần này đã chốt lịch. Bạn chỉ có thể xem kết quả cuối cùng.'
        : 'Hệ thống đã khóa đăng ký. Bạn không thể sửa hoặc hủy thêm.';
    }
    if (!form.N_NGAY) return 'Chọn ngày trực trước khi tiếp tục.';
    if (!form.B_TEN) return 'Chọn buổi trực để xem phòng khả dụng.';
    if (!form.P_MA) return 'Chọn phòng trực phù hợp với chuyên khoa của bạn.';
    if (dayContext?.doctorSpecialtyMatchesRoom === false) {
      return 'Phòng đã chọn không thuộc chuyên khoa của bác sĩ.';
    }
    if (selectedSessionContext?.doctor.occupied) {
      return 'Buổi này đã có đăng ký khác của bạn trong cùng ngày.';
    }
    if (selectedSessionContext?.room.occupied) {
      return 'Phòng đã có bác sĩ khác đăng ký trong cùng buổi.';
    }
    return null;
  }, [
    cycle?.status,
    dayContext?.doctorSpecialtyMatchesRoom,
    form.B_TEN,
    form.N_NGAY,
    form.P_MA,
    isCycleOpen,
    selectedSessionContext?.doctor.occupied,
    selectedSessionContext?.room.occupied,
  ]);

  const resetForm = () => setForm(EMPTY_FORM);
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (saveBlockReason) throw new Error(saveBlockReason);
      const payload = { N_NGAY: form.N_NGAY, B_TEN: form.B_TEN, P_MA: Number(form.P_MA) };
      if (form.originalKey) {
        return doctorScheduleApi.updateRegistration(
          form.originalKey.date,
          form.originalKey.session,
          payload,
        );
      }
      return doctorScheduleApi.createRegistration(payload);
    },
    onSuccess: () => {
      toast.success(form.originalKey ? 'Cập nhật đăng ký lịch trực thành công' : 'Đăng ký lịch trực thành công');
      queryClient.invalidateQueries({ queryKey: ['doctor-schedule-cycle'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-schedule-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-schedule-official'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-schedule-day-context'] });
      resetForm();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Không thể lưu đăng ký lịch trực';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });
  const cancelMutation = useMutation({
    mutationFn: () => doctorScheduleApi.cancelRegistration(deleteDialog.date, deleteDialog.session),
    onSuccess: () => {
      toast.success('Hủy đăng ký lịch trực thành công');
      queryClient.invalidateQueries({ queryKey: ['doctor-schedule-cycle'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-schedule-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-schedule-official'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-schedule-day-context'] });
      setDeleteDialog({ open: false, date: '', session: '' });
      if (
        form.originalKey?.date === deleteDialog.date &&
        form.originalKey?.session === deleteDialog.session
      ) {
        resetForm();
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Không thể hủy đăng ký lịch trực';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Đăng ký lịch trực</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Đăng ký lịch trực cho tuần kế tiếp, theo dõi trạng thái duyệt và xem kết quả chính thức sau khi admin chốt lịch.
          </p>
        </div>
        {cycle ? (
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Chuyên khoa</p>
            <p className="mt-1 font-semibold text-gray-900">{cycle.doctor.CHUYEN_KHOA.CK_TEN}</p>
            <p className="mt-1 text-xs text-gray-500">Chỉ được chọn phòng cùng chuyên khoa.</p>
          </div>
        ) : null}
      </div>

      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Tuần đăng ký</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {cycleLoading ? 'Đang tải...' : `${formatDateDdMmYyyy(cycle?.weekStartDate)} - ${formatDateDdMmYyyy(cycle?.weekEndDate)}`}
            </p>
            <p className="mt-2 text-xs text-gray-500">Áp dụng cho tuần kế tiếp.</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Trạng thái chu kỳ</p>
            <span className={cn('mt-2 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', getCycleBadgeClass(cycle?.status))}>
              {cycleLoading ? 'Đang tải...' : getCycleStatusLabel(cycle?.status)}
            </span>
            <p className="mt-2 text-xs text-gray-500">
              {cycle?.status === 'open' ? 'Bạn còn quyền đăng ký, chỉnh sửa và hủy.' : cycle?.status === 'locked' ? 'Admin đang duyệt, bạn chỉ còn quyền theo dõi.' : 'Tuần đã chốt, lịch chính thức là kết quả cuối cùng.'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Mở đăng ký</p>
            <p className="mt-1 text-lg font-semibold text-emerald-700">{cycleLoading ? 'Đang tải...' : formatDateTime(cycle?.registrationOpenAt)}</p>
            <p className="mt-2 text-xs text-gray-500">Bắt đầu đăng ký cho tuần kế tiếp.</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Hạn tự điều chỉnh</p>
            <p className="mt-1 text-lg font-semibold text-rose-700">{cycleLoading ? 'Đang tải...' : formatDateTime(cycle?.registrationCloseAt)}</p>
            <p className="mt-2 text-xs text-gray-500">Sau mốc này bạn không thể sửa hoặc hủy.</p>
          </div>
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-900 shadow-sm">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <div>
              <p className="font-medium">Mốc thời gian quan trọng</p>
              <p className="mt-1 leading-6">{deadlineMessage}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-gray-900">Tóm tắt tuần đăng ký của tôi</p>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                <span className="font-medium text-emerald-700">Đã duyệt</span> nghĩa là admin đã chấp thuận đăng ký, nhưng tuần vẫn chưa trở thành lịch cuối cùng cho đến khi được <span className="font-medium text-blue-700">chốt chính thức</span>.
              </p>
            </div>
            <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium', getCycleBadgeClass(cycle?.status))}>{getCycleStatusLabel(cycle?.status)}</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryStat label="Tổng đăng ký của tôi" value={registrationItems.length} note="Tổng số ca bạn đã gửi trong tuần đang xem." />
            <SummaryStat label="Chờ duyệt" value={pendingCount} note="Đang chờ admin xem xét." tone="warning" />
            <SummaryStat label="Đã duyệt" value={approvedCount} note="Đã được chấp thuận, nhưng chưa phải lịch cuối cùng." tone="success" />
            <SummaryStat label="Từ chối" value={rejectedCount} note="Các ca admin không chấp thuận cho tuần này." tone="danger" />
            <SummaryStat label="Lịch chính thức" value={cycle?.status === 'finalized' ? officialCount : 'Chưa chốt'} note={cycle?.status === 'finalized' ? 'Chỉ hiển thị sau khi admin chốt tuần làm việc.' : 'Sẽ xuất hiện sau khi admin chốt lịch.'} tone="info" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-600"><CalendarDays className="h-5 w-5" /></div>
          <div className="flex-1">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Đăng ký ca trực mới</h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">Thực hiện theo thứ tự Ngày → Buổi → Phòng để hệ thống giải thích rõ buổi nào còn trống và vì sao một lựa chọn đang bị khóa.</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <p className="font-medium">Thời hạn tự điều chỉnh</p>
                <p className="mt-1 text-xs leading-5 text-blue-700">{deadlineMessage}</p>
              </div>
            </div>
          </div>
        </div>

        {isCycleOpen ? (
          <div className="mt-5 space-y-4">
            {form.originalKey ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <p className="font-medium">Bạn đang chỉnh sửa một đăng ký đã có</p>
                <p className="mt-1 text-blue-700">{formatDateDdMmYyyy(form.originalKey.date)} - {getSessionLabel(form.originalKey.session)}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Bước 1</p>
                <label className="mt-2 block text-sm font-medium text-gray-800">Ngày trực</label>
                <AdminSelect value={form.N_NGAY} onValueChange={(value) => setForm((prev) => ({ ...prev, N_NGAY: value, B_TEN: '', P_MA: '' }))}>
                  <AdminSelectTrigger className="mt-2"><AdminSelectValue placeholder="Chọn ngày trong tuần kế tiếp" /></AdminSelectTrigger>
                  <AdminSelectContent>{(options?.allowedDates ?? []).map((item) => <AdminSelectItem key={item.date} value={item.date}>{formatDateDdMmYyyy(item.date)} - {getWeekdayLabel(item.weekday)}</AdminSelectItem>)}</AdminSelectContent>
                </AdminSelect>
                <p className="mt-2 text-xs leading-5 text-gray-500">Chọn trước ngày muốn trực để hệ thống tải ngữ cảnh Sáng/Chiều.</p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Bước 2</p>
                <label className="mt-2 block text-sm font-medium text-gray-800">Buổi trực</label>
                <AdminSelect value={form.B_TEN} onValueChange={(value) => setForm((prev) => ({ ...prev, B_TEN: value }))} disabled={!form.N_NGAY}>
                  <AdminSelectTrigger className="mt-2"><AdminSelectValue placeholder="Chọn buổi trực" /></AdminSelectTrigger>
                  <AdminSelectContent>{(options?.sessions ?? []).map((session) => {
                    const ctx = sessionContextMap.get(session.B_TEN);
                    return <AdminSelectItem key={session.B_TEN} value={session.B_TEN} disabled={Boolean(ctx?.doctor.occupied)}>{getSessionLabel(session.B_TEN)}{ctx?.doctor.occupied ? ' - Đã có đăng ký' : ''}</AdminSelectItem>;
                  })}</AdminSelectContent>
                </AdminSelect>
                <p className="mt-2 text-xs leading-5 text-gray-500">{!form.N_NGAY ? 'Chọn ngày trước để xem buổi nào còn khả dụng.' : 'Nếu một buổi bị khóa, xem “Ngữ cảnh trong ngày” để biết lý do.'}</p>
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Bước 3</p>
                <label className="mt-2 block text-sm font-medium text-gray-800">Phòng trực</label>
                <AdminSelect value={form.P_MA} onValueChange={(value) => setForm((prev) => ({ ...prev, P_MA: value }))} disabled={!form.B_TEN}>
                  <AdminSelectTrigger className="mt-2"><AdminSelectValue placeholder="Chọn phòng theo chuyên khoa" /></AdminSelectTrigger>
                  <AdminSelectContent>{(options?.rooms ?? []).map((room) => <AdminSelectItem key={room.P_MA} value={String(room.P_MA)}>{room.P_TEN}</AdminSelectItem>)}</AdminSelectContent>
                </AdminSelect>
                <p className="mt-2 text-xs leading-5 text-gray-500">{selectedRoom ? `Phòng đang chọn thuộc chuyên khoa ${selectedRoom.CHUYEN_KHOA.CK_TEN}.` : !form.B_TEN ? 'Chọn buổi trước để mở danh sách phòng.' : 'Chỉ chọn phòng cùng chuyên khoa để tránh bị từ chối.'}</p>
              </div>
            </div>

            {form.N_NGAY ? (
              <div className="rounded-xl border border-gray-100 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-gray-500" /><p className="text-sm font-semibold text-gray-900">Ngữ cảnh trong ngày</p></div>
                    <p className="mt-1 text-sm leading-6 text-gray-500">Quét nhanh từng buổi để biết bạn đang trống, đã gửi đăng ký, đã được duyệt hay đã lên lịch chính thức.</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
                    <p className="font-medium text-slate-800">{formatDateDdMmYyyy(form.N_NGAY)} - {getWeekdayLabelFromDate(form.N_NGAY)}</p>
                    <p className="mt-1">{selectedRoom ? `Đang xem cùng phòng ${selectedRoom.P_TEN}.` : 'Chọn phòng để kiểm tra thêm xung đột theo phòng.'}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {(options?.sessions ?? []).map((session) => {
                    const ctx = sessionContextMap.get(session.B_TEN);
                    const status = ctx?.doctor.status ?? 'empty';
                    const meta = getContextMeta(status);
                    const Icon = meta.Icon;
                    return (
                      <div key={session.B_TEN} className={cn('rounded-xl border p-4 shadow-sm transition-colors', meta.cardClass, form.B_TEN === session.B_TEN && 'ring-2 ring-blue-200 ring-offset-1')}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className={cn('rounded-lg p-2', meta.iconClass)}><Icon className="h-4 w-4" /></div>
                            <div>
                              <p className="text-sm font-semibold">{getSessionLabel(session.B_TEN)}</p>
                              <p className="mt-1 text-xs leading-5 text-current/80">{ctx?.doctor.room ? 'Bạn đã có đăng ký trong buổi này.' : 'Buổi này hiện đang trống và có thể chọn.'}</p>
                            </div>
                          </div>
                          <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', meta.badgeClass)}>{meta.label}</span>
                        </div>
                        <div className="mt-4 space-y-2 text-sm leading-6 text-current/90">
                          <p className="font-medium">{ctx?.doctor.room ? `Phòng đã chọn: ${ctx.doctor.room.P_TEN}` : 'Bạn chưa đăng ký ca này.'}</p>
                          {ctx?.doctor.note ? <p className="text-xs text-current/80">{ctx.doctor.note}</p> : null}
                          {ctx && !ctx.canSelect && ctx.reasons.length > 0 ? <p className="text-xs font-medium text-current/90">{ctx.reasons[0]}</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {selectedSessionContext?.room.occupied ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Phòng đang bị trùng lịch trong buổi này</p>
                    <p className="mt-1 text-rose-700">Vui lòng đổi phòng hoặc chọn buổi khác để tiếp tục đăng ký.</p>
                  </div>
                </div>
              </div>
            ) : null}

            {saveBlockReason ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div>
                    <p className="font-medium">Chưa thể gửi đăng ký</p>
                    <p className="mt-1 text-amber-700">{saveBlockReason}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-500">{(optionsLoading || dayContextLoading) && form.N_NGAY ? 'Đang tải ngữ cảnh ngày trực...' : 'Khi thông tin hợp lệ, bạn có thể gửi hoặc cập nhật ngay bên dưới.'}</div>
              <div className="flex flex-wrap items-center gap-2">
                {form.originalKey ? <Button variant="outline" onClick={resetForm}>Bỏ chỉnh sửa</Button> : null}
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || dayContextLoading || Boolean(saveBlockReason)}>{saveMutation.isPending ? 'Đang lưu...' : form.originalKey ? 'Cập nhật đăng ký' : 'Gửi đăng ký'}</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div>
                <p className="font-medium">{cycle?.status === 'finalized' ? 'Tuần này đã chốt lịch' : 'Hết thời gian tự đăng ký hoặc chỉnh sửa'}</p>
                <p className="mt-1 leading-6 text-amber-700">{cycle?.status === 'finalized' ? 'Bạn chỉ còn quyền xem kết quả cuối cùng ở phần “Lịch trực chính thức của tôi”.' : 'Admin đang duyệt và chốt tuần làm việc. Các hành động sửa hoặc hủy hiện không còn khả dụng.'}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-50 p-2 text-amber-600"><FileCheck2 className="h-5 w-5" /></div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Đăng ký của tôi</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">Theo dõi trạng thái từng đăng ký. “Đã duyệt” chỉ có nghĩa là admin đã chấp thuận, chưa phải lịch chính thức cho tới khi tuần được chốt.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {REGISTRATION_FILTERS.map((filter) => {
              const count = filter.value === 'all' ? registrationItems.length : registrationItems.filter((item) => item.status === filter.value).length;
              const active = registrationFilter === filter.value;
              return <Button key={filter.value} size="sm" variant="outline" className={getRegistrationFilterButtonClass(filter.value, active)} onClick={() => setRegistrationFilter(filter.value)}>{filter.label} ({count})</Button>;
            })}
          </div>
          <p className="text-xs leading-5 text-gray-500">Chỉ có thể sửa hoặc hủy trước khi hệ thống khóa đăng ký.</p>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70 hover:bg-gray-50/70">
                <TableHead>Ngày</TableHead><TableHead>Thứ</TableHead><TableHead>Buổi</TableHead><TableHead>Phòng</TableHead><TableHead>Trạng thái</TableHead><TableHead className="w-[320px] whitespace-normal">Ghi chú</TableHead><TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrationsLoading ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-gray-500">Đang tải đăng ký...</TableCell></TableRow>
              ) : filteredRegistrations.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-gray-500">{registrationFilter === 'all' ? 'Bạn chưa có đăng ký nào cho tuần này.' : `Không có đăng ký ở trạng thái “${getScheduleWorkflowStatusLabel(registrationFilter)}”.`}</TableCell></TableRow>
              ) : filteredRegistrations.map((item) => {
                const itemDate = toDateOnlyIso(item.N_NGAY);
                const isEditing = form.originalKey?.date === itemDate && form.originalKey?.session === item.B_TEN;
                return (
                  <TableRow key={`${itemDate}-${item.B_TEN}`} className={cn(isEditing && 'bg-blue-50/60 hover:bg-blue-50/60')}>
                    <TableCell className="font-medium text-gray-900">{formatDateDdMmYyyy(item.N_NGAY)}</TableCell>
                    <TableCell>{getWeekdayLabelFromDate(item.N_NGAY)}</TableCell>
                    <TableCell>{getSessionLabel(item.B_TEN)}</TableCell>
                    <TableCell>{item.room.P_TEN}</TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${getScheduleStatusBadgeClass(item.status)}`}>{getScheduleWorkflowStatusLabel(item.status)}</span>
                        <p className="text-xs leading-5 text-gray-500">{item.reviewedAt ? `Cập nhật lúc ${formatDateTime(item.reviewedAt)}` : item.submittedAt ? `Gửi lúc ${formatDateTime(item.submittedAt)}` : 'Chưa có mốc thời gian duyệt'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal text-sm leading-6 text-gray-600">{item.note || 'Không có ghi chú thêm.'}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col items-end gap-2">
                        {isCycleOpen ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setForm({ originalKey: { date: itemDate, session: item.B_TEN }, N_NGAY: itemDate, B_TEN: item.B_TEN, P_MA: String(item.P_MA) })}><Pencil className="mr-1 h-4 w-4" />Sửa</Button>
                            <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setDeleteDialog({ open: true, date: itemDate, session: item.B_TEN })}><Trash2 className="mr-1 h-4 w-4" />Hủy</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" disabled><Lock className="mr-1 h-4 w-4" />Đã khóa</Button>
                        )}
                        <p className="text-right text-xs leading-5 text-gray-400">{isCycleOpen ? 'Có thể sửa hoặc hủy cho đến khi hệ thống khóa tuần đăng ký.' : 'Tuần đã khóa hoặc đã chốt, đăng ký này chỉ còn quyền xem.'}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-600"><CheckCircle2 className="h-5 w-5" /></div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Lịch trực chính thức của tôi</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">Đây là kết quả cuối cùng sau khi admin chốt tuần làm việc. Phần này khác với các đăng ký chỉ mới “Đã duyệt”.</p>
          </div>
        </div>

        {cycle?.status !== 'finalized' ? (
          <div className="mt-4 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-blue-100 p-2 text-blue-700"><CalendarClock className="h-5 w-5" /></div>
                <div>
                  <p className="text-base font-semibold text-blue-900">Lịch chính thức sẽ xuất hiện sau khi admin chốt tuần làm việc</p>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-blue-800">Các ca “Đã duyệt” mới chỉ là bước chấp thuận. Danh sách trực cuối cùng chỉ hiển thị ở đây khi tuần được chốt chính thức.</p>
                </div>
              </div>
              <div className="rounded-xl border border-blue-200 bg-white/90 px-4 py-3 text-sm shadow-sm">
                <p className="text-xs uppercase tracking-wide text-blue-700">Hiện tại</p>
                <p className="mt-1 text-lg font-semibold text-blue-900">{approvedCount} ca đã duyệt</p>
                <p className="mt-1 text-xs leading-5 text-blue-700">Chưa chuyển thành lịch trực chính thức.</p>
              </div>
            </div>
          </div>
        ) : officialLoading ? (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-10 text-center text-gray-500">Đang tải lịch trực chính thức...</div>
        ) : officialItems.length === 0 ? (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 px-5 py-5 text-blue-900">
            <p className="text-base font-semibold">Tuần này đã chốt nhưng chưa có ca trực chính thức</p>
            <p className="mt-1 text-sm leading-6 text-blue-700">Nếu đây là kết quả ngoài dự kiến, hãy kiểm tra lại phần đăng ký đã duyệt hoặc liên hệ admin để xác nhận quá trình chốt lịch.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <p className="font-medium">Tuần này đã được chốt với {officialCount} ca trực chính thức.</p>
                <p className="text-blue-700">Tổng số slot khám dự kiến: <span className="font-semibold">{totalOfficialSlots}</span></p>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/70 hover:bg-gray-50/70">
                    <TableHead>Ngày</TableHead><TableHead>Thứ</TableHead><TableHead>Buổi</TableHead><TableHead>Phòng</TableHead><TableHead>Slot</TableHead><TableHead>Trạng thái</TableHead><TableHead className="w-[320px] whitespace-normal">Ghi chú</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {officialItems.map((item) => (
                    <TableRow key={`${toDateOnlyIso(item.N_NGAY)}-${item.B_TEN}`}>
                      <TableCell className="font-medium text-gray-900">{formatDateDdMmYyyy(item.N_NGAY)}</TableCell>
                      <TableCell>{getWeekdayLabelFromDate(item.N_NGAY)}</TableCell>
                      <TableCell>{getSessionLabel(item.B_TEN)}</TableCell>
                      <TableCell>{item.room.P_TEN}</TableCell>
                      <TableCell>{item.slotCount}</TableCell>
                      <TableCell><span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${getScheduleStatusBadgeClass(item.status)}`}>{getScheduleWorkflowStatusLabel(item.status)}</span></TableCell>
                      <TableCell className="whitespace-normal text-sm leading-6 text-gray-600">{item.note || 'Không có ghi chú thêm.'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </section>

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" />Xác nhận hủy đăng ký</DialogTitle>
            <DialogDescription>{formatDateDdMmYyyy(deleteDialog.date)} - {getSessionLabel(deleteDialog.session)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, date: '', session: '' })}>Đóng</Button>
            <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>{cancelMutation.isPending ? 'Đang hủy...' : 'Xác nhận hủy'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
