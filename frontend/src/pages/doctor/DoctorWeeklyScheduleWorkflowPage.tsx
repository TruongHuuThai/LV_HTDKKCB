import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, FileClock, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import {
  doctorScheduleWorkflowApi,
  type ExceptionRequestType,
  type ScheduleExceptionRequestItem,
  type WeeklyScheduleItem,
} from '@/services/api/scheduleWorkflowApi';
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

function getNextWeekStartIso() {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + 7);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(
    monday.getDate(),
  ).padStart(2, '0')}`;
}

function SummaryCard({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number | string;
  tone?: 'slate' | 'amber' | 'emerald' | 'blue' | 'rose';
}) {
  const classes =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50 text-blue-900'
          : tone === 'rose'
            ? 'border-rose-200 bg-rose-50 text-rose-900'
            : 'border-slate-200 bg-slate-50 text-slate-900';

  return (
    <div className={cn('rounded-xl border px-4 py-3 shadow-sm', classes)}>
      <p className="text-xs uppercase tracking-wide text-current/70">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function formatRequestedChange(item: ScheduleExceptionRequestItem) {
  const parts: string[] = [];
  if (item.requestedChange.date) parts.push(formatDateDdMmYyyy(item.requestedChange.date));
  if (item.requestedChange.session) parts.push(getSessionLabel(item.requestedChange.session));
  if (item.requestedChange.room) parts.push(item.requestedChange.room.P_TEN);
  return parts.length > 0 ? parts.join(' | ') : '-';
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

export default function DoctorWeeklyScheduleWorkflowPage() {
  const queryClient = useQueryClient();
  const weekPickerRef = useRef<HTMLInputElement>(null);

  const [weekStart, setWeekStart] = useState(getNextWeekStartIso());
  const [exceptionForm, setExceptionForm] = useState<ExceptionFormState>(EMPTY_EXCEPTION_FORM);

  const { data: weekOverview, isLoading: weekLoading } = useQuery({
    queryKey: ['doctor-weekly-workflow-overview', weekStart],
    queryFn: () => doctorScheduleWorkflowApi.getWeekOverview(weekStart),
  });

  const { data: weeklySchedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['doctor-weekly-workflow-schedules', weekStart],
    queryFn: () => doctorScheduleWorkflowApi.getWeeklySchedules(weekStart),
  });

  const { data: exceptionRequests, isLoading: exceptionLoading } = useQuery({
    queryKey: ['doctor-weekly-workflow-exceptions', weekStart],
    queryFn: () => doctorScheduleWorkflowApi.getExceptionRequests(weekStart),
  });

  const { data: supportOptions } = useQuery({
    queryKey: ['doctor-weekly-workflow-support-options'],
    queryFn: doctorScheduleApi.getRegistrationOptions,
    enabled: exceptionForm.open,
    staleTime: 60_000,
  });

  const weeklyItems = weeklySchedules?.items ?? [];
  const exceptionItems = exceptionRequests?.items ?? [];
  const finalizedItems = useMemo(
    () => weeklyItems.filter((item) => item.status === 'finalized'),
    [weeklyItems],
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
        `Da xac nhan tuan lam viec (${result.confirmedCount} ca, ${result.acknowledgedAdjustedCount} ca dieu chinh).`,
      );
      invalidateDoctorWorkflow();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Khong the xac nhan tuan lam viec';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const confirmShiftMutation = useMutation({
    mutationFn: (item: WeeklyScheduleItem) =>
      doctorScheduleWorkflowApi.confirmShift(item.N_NGAY, item.B_TEN),
    onSuccess: () => {
      toast.success('Da xac nhan ca lam viec');
      invalidateDoctorWorkflow();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Khong the xac nhan ca';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const exceptionSaveReason = useMemo(() => {
    if (!exceptionForm.target) return 'Chua chon ca can xu ly.';
    if (!exceptionForm.reason.trim()) return 'Nhap ly do gui yeu cau.';
    if (exceptionForm.type === 'leave') {
      if (exceptionForm.leaveHandling === 'makeup') {
        if (!exceptionForm.requestedDate || !exceptionForm.requestedSession || !exceptionForm.requestedRoomId) {
          return 'Nhap day du ngay, buoi va phong de xuat ca bu.';
        }
        if (isSunday(exceptionForm.requestedDate)) {
          return 'Khong the chon Chu nhat cho ca bu.';
        }
        if (
          isSameProposedShift(
            exceptionForm.target,
            exceptionForm.requestedDate,
            exceptionForm.requestedSession,
            exceptionForm.requestedRoomId,
          )
        ) {
          return 'Ca bu khong duoc trung ca hien tai.';
        }
      }
    }
    if (exceptionForm.type === 'shift_change') {
      if (!exceptionForm.requestedDate || !exceptionForm.requestedSession || !exceptionForm.requestedRoomId) {
        return 'Nhap day du ngay, buoi va phong de xuat.';
      }
      if (isSunday(exceptionForm.requestedDate)) {
        return 'Khong the chon Chu nhat cho ca de xuat.';
      }
      if (
        isSameProposedShift(
          exceptionForm.target,
          exceptionForm.requestedDate,
          exceptionForm.requestedSession,
          exceptionForm.requestedRoomId,
        )
      ) {
        return 'Ca de xuat khong duoc trung ca hien tai.';
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
        requestedRoomId: exceptionForm.requestedRoomId
          ? Number(exceptionForm.requestedRoomId)
          : null,
      });
    },
    onSuccess: () => {
      toast.success('Da gui yeu cau dieu chinh');
      setExceptionForm(EMPTY_EXCEPTION_FORM);
      invalidateDoctorWorkflow();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Khong the gui yeu cau';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
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

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch làm việc của tôi</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Lịch tuần được sinh từ mẫu dài hạn. Bác sĩ chỉ cần xem, xác nhận hoặc gửi ngoại lệ
            thay vì đăng ký lại toàn bộ lịch mỗi tuần.
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
              onChange={(e) => setWeekStart(e.target.value)}
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0"
            />
          </div>
          <Button
            onClick={() => confirmWeekMutation.mutate()}
            disabled={confirmWeekMutation.isPending || !weekOverview?.canConfirm}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {confirmWeekMutation.isPending ? 'Đang xác nhận...' : 'Xác nhận tuần'}
          </Button>
        </div>
      </div>

      <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-900">
              {weekLoading ? 'Đang tải thông tin tuần...' : weekOverview?.doctor.BS_HO_TEN}
            </p>
            <p className="mt-1 text-sm text-blue-800">
              Chuyên khoa: {weekOverview?.doctor.CHUYEN_KHOA.CK_TEN || '-'}
            </p>
            <p className="mt-1 text-sm text-blue-800">
              Tuần {formatDateDdMmYyyy(weekOverview?.weekStartDate)} -{' '}
              {formatDateDdMmYyyy(weekOverview?.weekEndDate)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex rounded-full border px-3 py-1 text-sm font-medium',
                getWeekWorkflowStatusBadgeClass(weekOverview?.workflowStatus ?? 'generated'),
              )}
            >
              {getWeekWorkflowStatusLabel(weekOverview?.workflowStatus ?? 'generated')}
            </span>
            <span className="text-sm text-blue-800">
              {weekOverview?.canRequestChanges
                ? 'Có thể gửi yêu cầu thay đổi.'
                : 'Tuần này chỉ còn xem lịch.'}
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Tổng ca" value={weeklyItems.length} />
        <SummaryCard label="Đã sinh" value={weekOverview?.summary.generated ?? 0} tone="amber" />
        <SummaryCard
          label="Đã xác nhận"
          value={weekOverview?.summary.confirmed ?? 0}
          tone="emerald"
        />
        <SummaryCard
          label="Cần điều chỉnh"
          value={weekOverview?.summary.changeRequested ?? 0}
          tone="rose"
        />
        <SummaryCard
          label="Ca chính thức"
          value={weekOverview?.summary.finalized ?? 0}
          tone="blue"
        />
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Lịch tuần được sinh</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Xác nhận từng ca hoặc gửi yêu cầu xin nghỉ, đổi lịch trực khi lịch không còn phù hợp.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70 hover:bg-gray-50/70">
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
              {schedulesLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-gray-500">
                    Đang tải lịch tuần...
                  </TableCell>
                </TableRow>
              ) : weeklyItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-gray-500">
                    Chưa có lịch được sinh cho tuần này.
                  </TableCell>
                </TableRow>
              ) : (
                weeklyItems.map((item) => {
                  const canConfirmShift =
                    weekOverview?.canConfirm &&
                    (item.status === 'generated' || item.status === 'adjusted');
                  const canRequestChange =
                    weekOverview?.canRequestChanges &&
                    item.status !== 'finalized' &&
                    item.status !== 'cancelled' &&
                    item.status !== 'cancelled_by_doctor_leave' &&
                    item.status !== 'vacant_by_leave';

                  return (
                    <TableRow key={`${item.N_NGAY}-${item.B_TEN}`}>
                      <TableCell className="font-medium text-gray-900">
                        {formatDateDdMmYyyy(item.N_NGAY)}
                      </TableCell>
                      <TableCell>{getWeekdayLabelFromDate(item.N_NGAY)}</TableCell>
                      <TableCell>{getSessionLabel(item.B_TEN)}</TableCell>
                      <TableCell>{item.room.P_TEN}</TableCell>
                      <TableCell>{getWeeklyScheduleSourceLabel(item.source)}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex rounded-md border px-2.5 py-1 text-xs font-medium',
                            getWeeklyScheduleStatusBadgeClass(item.status),
                          )}
                        >
                          {getWeeklyScheduleStatusLabel(item.status)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[220px] whitespace-normal text-sm leading-6 text-gray-600">
                        {item.latestException ? (
                          <div className="space-y-1">
                            <p>
                              {getExceptionTypeLabel(item.latestException.type)} -{' '}
                              {getExceptionStatusLabel(item.latestException.status)}
                            </p>
                            <p className="text-xs text-gray-500">{item.latestException.reason}</p>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => confirmShiftMutation.mutate(item)}
                            disabled={!canConfirmShift || confirmShiftMutation.isPending}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Xác nhận
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => openExceptionDialog(item)}
                            disabled={!canRequestChange}
                          >
                            <Send className="mr-1 h-4 w-4" />
                            Gửi ngoại lệ
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
            <FileClock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Yêu cầu của tôi</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Theo dõi kết quả duyệt và nội dung điều chỉnh trên từng ca đã gửi.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70 hover:bg-gray-50/70">
                <TableHead>Loại yêu cầu</TableHead>
                <TableHead>Ca mục tiêu</TableHead>
                <TableHead>Đề xuất thay đổi</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptionLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-gray-500">
                    Đang tải yêu cầu...
                  </TableCell>
                </TableRow>
              ) : exceptionItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-gray-500">
                    Bạn chưa gửi yêu cầu nào cho tuần này.
                  </TableCell>
                </TableRow>
              ) : (
                exceptionItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{getExceptionTypeLabel(item.type)}</TableCell>
                    <TableCell>
                      {formatDateDdMmYyyy(item.targetShift.N_NGAY)} -{' '}
                      {getSessionLabel(item.targetShift.B_TEN)}
                    </TableCell>
                    <TableCell className="max-w-[220px] whitespace-normal text-sm leading-6 text-gray-600">
                      {formatRequestedChange(item)}
                    </TableCell>
                    <TableCell className="max-w-[260px] whitespace-normal text-sm leading-6 text-gray-600">
                      {item.reason}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span
                          className={cn(
                            'inline-flex rounded-md border px-2.5 py-1 text-xs font-medium',
                            getExceptionStatusBadgeClass(item.status),
                          )}
                        >
                          {getExceptionStatusLabel(item.status)}
                        </span>
                        {item.adminNote ? (
                          <p className="text-xs leading-5 text-gray-500">{item.adminNote}</p>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Lịch chính thức</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Khi admin chốt tuần, các ca được khóa thành lịch chính thức và mở slot khám theo quy
              trình vận hành.
            </p>
          </div>
        </div>

        {finalizedItems.length === 0 ? (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-5 text-sm text-blue-900">
            Chưa có ca chính thức cho tuần này.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/70 hover:bg-gray-50/70">
                  <TableHead>Ngày</TableHead>
                  <TableHead>Thứ</TableHead>
                  <TableHead>Buổi</TableHead>
                  <TableHead>Phòng</TableHead>
                  <TableHead>Slot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {finalizedItems.map((item) => (
                  <TableRow key={`final-${item.N_NGAY}-${item.B_TEN}`}>
                    <TableCell className="font-medium text-gray-900">
                      {formatDateDdMmYyyy(item.N_NGAY)}
                    </TableCell>
                    <TableCell>{getWeekdayLabelFromDate(item.N_NGAY)}</TableCell>
                    <TableCell>{getSessionLabel(item.B_TEN)}</TableCell>
                    <TableCell>{item.room.P_TEN}</TableCell>
                    <TableCell>{item.slotCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

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
              <label className="mb-1 block text-sm font-medium text-gray-700">Loại yêu cầu</label>
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
                <label className="mb-1 block text-sm font-medium text-gray-700">
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
                    <AdminSelectValue placeholder="Chọn phương án xử lý" />
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
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Ngày đề xuất
                  </label>
                  <Input
                    type="date"
                    value={exceptionForm.requestedDate}
                    onChange={(e) =>
                      setExceptionForm((prev) => ({ ...prev, requestedDate: e.target.value }))
                    }
                  />
                  <p className="mt-1 text-xs text-gray-500">Không chọn Chủ nhật.</p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
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
                      {(supportOptions?.sessions ?? []).map((session) => (
                        <AdminSelectItem key={session.B_TEN} value={session.B_TEN}>
                          {getSessionLabel(session.B_TEN)}
                        </AdminSelectItem>
                      ))}
                    </AdminSelectContent>
                  </AdminSelect>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
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
                      {(supportOptions?.rooms ?? []).map((room) => (
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Lý do</label>
              <Textarea
                value={exceptionForm.reason}
                onChange={(e) =>
                  setExceptionForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Mô tả lý do và đề xuất xử lý"
              />
            </div>
          </div>

          {exceptionForm.target?.weekStatus === 'slot_opened' ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Tuần này đã mở slot, có thể đã có lịch khám. Hãy cân nhắc trước khi gửi yêu cầu.
            </p>
          ) : null}

          {exceptionForm.target?.bookingCount ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              Ca n?y ?ang c? {exceptionForm.target.bookingCount} l?ch h?n b?nh nh?n. Khi admin duy?t, h? th?ng s? h?y c?c l?ch h?n v? th?ng b?o cho b?nh nh?n ??t l?i.
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
