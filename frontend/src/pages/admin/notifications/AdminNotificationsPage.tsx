import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  BellRing,
  Bot,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Eye,
  Filter,
  Loader2,
  MessageSquareText,
  MonitorCog,
  Send,
  Stethoscope,
  TriangleAlert,
  UserRound,
  Users,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AdminSelect,
  AdminSelectContent,
  AdminSelectItem,
  AdminSelectTrigger,
  AdminSelectValue,
} from '@/components/admin/AdminSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { adminApi } from '@/services/api/adminApi';
import {
  notificationsApi,
  type AdminBulkNotificationPayload,
  type AdminBulkNotificationType,
  type AdminNotificationQuickPreset,
  type AdminNotificationRecipientScope,
  type AdminNotificationTargetGroup,
} from '@/services/api/notificationsApi';

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getTomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function toNumberOrUndefined(raw: string) {
  const value = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function parseIdList(raw: string) {
  const ids = raw
    .split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isFinite(item) && item > 0);
  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

function parseStatusList(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function extractErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}

interface NotificationTypeOption {
  value: AdminBulkNotificationType;
  label: string;
  description: string;
  icon: LucideIcon;
  toneClass: string;
  defaultTitle: string;
  defaultMessage: string;
}

interface TargetGroupOption {
  value: AdminNotificationTargetGroup;
  label: string;
  description: string;
  icon: LucideIcon;
  toneClass: string;
}

interface QuickTargetPreset {
  id: AdminNotificationQuickPreset;
  label: string;
  targetGroup: AdminNotificationTargetGroup;
  description: string;
}

const TYPE_OPTIONS: NotificationTypeOption[] = [
  {
    value: 'system_admin',
    label: 'Thông báo hệ thống (Admin)',
    description: 'Thông báo do quản trị viên khởi tạo thủ công.',
    icon: MonitorCog,
    toneClass: 'border-blue-200 bg-blue-50 text-blue-700',
    defaultTitle: 'Thông báo hệ thống',
    defaultMessage: 'Hệ thống vừa cập nhật một số thay đổi. Vui lòng kiểm tra thông tin mới nhất.',
  },
  {
    value: 'system_auto',
    label: 'Thông báo hệ thống (Tự động)',
    description: 'Thông báo kích hoạt theo luồng tự động của hệ thống.',
    icon: Bot,
    toneClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    defaultTitle: 'Thông báo tự động từ hệ thống',
    defaultMessage: 'Hệ thống vừa ghi nhận cập nhật mới. Vui lòng theo dõi các thông tin liên quan.',
  },
  {
    value: 'rescheduled',
    label: 'Nhắc / đổi lịch',
    description: 'Thông báo cập nhật lịch khám và khung giờ.',
    icon: CalendarClock,
    toneClass: 'border-amber-200 bg-amber-50 text-amber-700',
    defaultTitle: 'Cập nhật lịch khám',
    defaultMessage: 'Lịch khám của bạn đã được cập nhật. Vui lòng kiểm tra lại thời gian khám.',
  },
  {
    value: 'canceled_session',
    label: 'Hủy lịch',
    description: 'Thông báo hủy ca khám hoặc lịch hẹn liên quan.',
    icon: CalendarX2,
    toneClass: 'border-rose-200 bg-rose-50 text-rose-700',
    defaultTitle: 'Thông báo hủy lịch khám',
    defaultMessage: 'Lịch khám của bạn đã bị hủy. Vui lòng đặt lịch mới nếu cần.',
  },
  {
    value: 'doctor_changed',
    label: 'Đổi bác sĩ',
    description: 'Thông báo thay đổi bác sĩ phụ trách lịch hẹn.',
    icon: Stethoscope,
    toneClass: 'border-teal-200 bg-teal-50 text-teal-700',
    defaultTitle: 'Thông báo thay đổi bác sĩ',
    defaultMessage: 'Bác sĩ phụ trách lịch khám của bạn đã thay đổi. Vui lòng kiểm tra thông tin mới.',
  },
  {
    value: 'room_changed',
    label: 'Đổi phòng',
    description: 'Thông báo thay đổi phòng khám / khu vực khám.',
    icon: Workflow,
    toneClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    defaultTitle: 'Thông báo thay đổi phòng khám',
    defaultMessage: 'Phòng khám của bạn đã được thay đổi. Vui lòng đến đúng khu vực hướng dẫn.',
  },
  {
    value: 'doctor_unavailable',
    label: 'Bác sĩ vắng mặt',
    description: 'Thông báo khi bác sĩ không thể tiếp nhận lịch.',
    icon: BellRing,
    toneClass: 'border-orange-200 bg-orange-50 text-orange-700',
    defaultTitle: 'Thông báo bác sĩ vắng mặt',
    defaultMessage: 'Bác sĩ phụ trách tạm thời vắng mặt. Chúng tôi sẽ cập nhật phương án thay thế sớm.',
  },
  {
    value: 'custom',
    label: 'Thông báo tùy chỉnh',
    description: 'Thông báo linh hoạt cho các tình huống đặc biệt.',
    icon: MessageSquareText,
    toneClass: 'border-slate-200 bg-slate-50 text-slate-700',
    defaultTitle: 'Thông báo',
    defaultMessage: '',
  },
];

const TARGET_GROUP_OPTIONS: TargetGroupOption[] = [
  {
    value: 'ALL_USERS',
    label: 'Tất cả người dùng',
    description: 'Gửi diện rộng cho toàn hệ thống (nhạy cảm).',
    icon: Users,
    toneClass: 'border-red-200 bg-red-50 text-red-700',
  },
  {
    value: 'PATIENTS',
    label: 'Bệnh nhân',
    description: 'Gửi cho toàn bộ bệnh nhân hoặc theo lịch hẹn.',
    icon: UserRound,
    toneClass: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  {
    value: 'DOCTORS',
    label: 'Bác sĩ',
    description: 'Gửi cho toàn bộ bác sĩ, có thể lọc thêm.',
    icon: Stethoscope,
    toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  {
    value: 'BY_SPECIALTY',
    label: 'Theo chuyên khoa',
    description: 'Gửi theo một hoặc nhiều chuyên khoa.',
    icon: Filter,
    toneClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  },
  {
    value: 'ADVANCED_FILTER',
    label: 'Bộ lọc nâng cao',
    description: 'Dành cho tình huống đặc biệt với điều kiện chi tiết.',
    icon: Workflow,
    toneClass: 'border-slate-200 bg-slate-50 text-slate-700',
  },
];

const QUICK_TARGET_PRESETS: QuickTargetPreset[] = [
  {
    id: 'all_patients',
    label: 'Tất cả bệnh nhân',
    targetGroup: 'PATIENTS',
    description: 'Gửi nhanh toàn bộ bệnh nhân.',
  },
  {
    id: 'all_doctors',
    label: 'Tất cả bác sĩ',
    targetGroup: 'DOCTORS',
    description: 'Gửi nhanh toàn bộ bác sĩ.',
  },
  {
    id: 'all_users',
    label: 'Tất cả người dùng',
    targetGroup: 'ALL_USERS',
    description: 'Thông báo diện rộng toàn hệ thống.',
  },
  {
    id: 'patients_today',
    label: 'Bệnh nhân lịch hôm nay',
    targetGroup: 'PATIENTS',
    description: 'Bệnh nhân có lịch trong ngày hiện tại.',
  },
  {
    id: 'patients_tomorrow',
    label: 'Bệnh nhân lịch ngày mai',
    targetGroup: 'PATIENTS',
    description: 'Bệnh nhân có lịch vào ngày mai.',
  },
];

const FLOW_STEPS = [
  { id: 'type', label: '1 Loại' },
  { id: 'recipient', label: '2 Đối tượng' },
  { id: 'filters', label: '3 Lọc' },
  { id: 'preview', label: '4 Xem trước' },
  { id: 'content', label: '5 Nội dung' },
  { id: 'send', label: '6 Gửi' },
] as const;

function StepTag({
  label,
  active,
  completed,
}: {
  label: string;
  active?: boolean;
  completed?: boolean;
}) {
  return (
    <div
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium',
        completed
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : active
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-white text-slate-600',
      )}
    >
      {completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
    </div>
  );
}

function SectionCard({
  step,
  title,
  description,
  icon: Icon,
  children,
}: {
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-600">Bước {step}</p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FieldLabel({ label, required = false }: { label: string; required?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {required ? (
        <span aria-hidden="true" className="text-base leading-none font-semibold text-red-500">
          *
        </span>
      ) : (
        <span className="text-xs font-normal text-slate-500">(không bắt buộc)</span>
      )}
    </span>
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={`recipient-skeleton-${index}`} className="h-11 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function AdminNotificationsPage() {
  const queryClient = useQueryClient();

  const defaultTypeOption = TYPE_OPTIONS[0];
  const [type, setType] = useState<AdminBulkNotificationType>('system_admin');
  const [targetGroup, setTargetGroup] = useState<AdminNotificationTargetGroup>('PATIENTS');
  const [advancedScope, setAdvancedScope] = useState<AdminNotificationRecipientScope>('PATIENTS');
  const [title, setTitle] = useState(defaultTypeOption.defaultTitle);
  const [message, setMessage] = useState(defaultTypeOption.defaultMessage);

  const [specificDate, setSpecificDate] = useState('');
  const [fromDate, setFromDate] = useState(getTodayIso());
  const [toDate, setToDate] = useState('');
  const [appointmentIdsRaw, setAppointmentIdsRaw] = useState('');
  const [appointmentStatusesRaw, setAppointmentStatusesRaw] = useState('');
  const [scheduleIdRaw, setScheduleIdRaw] = useState('');
  const [slotIdRaw, setSlotIdRaw] = useState('');
  const [specialtyIds, setSpecialtyIds] = useState<number[]>([]);
  const [doctorIds, setDoctorIds] = useState<number[]>([]);
  const [doctorPickerValue, setDoctorPickerValue] = useState('all');
  const [listTypeFilter, setListTypeFilter] = useState<'' | AdminBulkNotificationType>('');
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [lastQuickPreset, setLastQuickPreset] = useState<AdminNotificationQuickPreset | undefined>(undefined);

  const selectedTypeOption = useMemo(() => TYPE_OPTIONS.find((item) => item.value === type), [type]);
  const selectedTargetOption = useMemo(
    () => TARGET_GROUP_OPTIONS.find((item) => item.value === targetGroup),
    [targetGroup],
  );

  const specialtiesQuery = useQuery({
    queryKey: ['admin-notification-specialties-options'],
    queryFn: () => adminApi.getSpecialties(),
  });

  const doctorsQuery = useQuery({
    queryKey: ['admin-notification-doctors-options'],
    queryFn: () =>
      adminApi.getDoctors({
        page: 1,
        limit: 200,
      }),
    placeholderData: (oldData) => oldData,
  });

  const specialtyOptions = specialtiesQuery.data || [];
  const doctorOptions = doctorsQuery.data?.items || [];

  const selectedSpecialtyLabels = useMemo(
    () =>
      specialtyIds.map((id) => specialtyOptions.find((item) => item.CK_MA === id)?.CK_TEN || `CK_MA #${id}`),
    [specialtyIds, specialtyOptions],
  );
  const selectedDoctorLabels = useMemo(
    () =>
      doctorIds.map((id) => doctorOptions.find((item) => item.BS_MA === id)?.BS_HO_TEN || `BS_MA #${id}`),
    [doctorIds, doctorOptions],
  );

  const appointmentIds = parseIdList(appointmentIdsRaw);
  const appointmentStatuses = parseStatusList(appointmentStatusesRaw);
  const scheduleId = toNumberOrUndefined(scheduleIdRaw);
  const slotId = toNumberOrUndefined(slotIdRaw);

  const hasDateRange = Boolean(specificDate || fromDate || toDate);
  const hasAdvancedMeaningfulFilter =
    specialtyIds.length > 0 ||
    doctorIds.length > 0 ||
    appointmentIds.length > 0 ||
    hasDateRange ||
    Boolean(scheduleId) ||
    Boolean(slotId) ||
    appointmentStatuses.length > 0;

  const payload = useMemo<AdminBulkNotificationPayload>(() => {
    const filters = {
      ...(specialtyIds.length > 0 ? { specialtyIds } : {}),
      ...(doctorIds.length > 0 ? { doctorIds } : {}),
      ...(appointmentIds.length > 0 ? { appointmentIds } : {}),
      ...(specificDate ? { specificDate } : {}),
      ...(specificDate ? {} : fromDate ? { fromDate } : {}),
      ...(specificDate ? {} : toDate ? { toDate } : {}),
      ...(scheduleId ? { scheduleId } : {}),
      ...(slotId ? { slotId } : {}),
      ...(appointmentStatuses.length > 0 ? { appointmentStatuses } : {}),
      ...(targetGroup === 'ADVANCED_FILTER' ? { recipientScope: advancedScope } : {}),
    };

    return {
      type,
      targetGroup,
      message: message.trim(),
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(lastQuickPreset ? { quickPreset: lastQuickPreset } : {}),
      filters,

      // Legacy mapping for compatibility.
      ...(appointmentIds.length > 0 ? { appointmentIds } : {}),
      ...(doctorIds[0] ? { doctorId: doctorIds[0] } : {}),
      ...(specificDate ? { date: specificDate } : {}),
      ...(specificDate ? {} : fromDate ? { dateFrom: fromDate } : {}),
      ...(specificDate ? {} : toDate ? { dateTo: toDate } : {}),
      ...(scheduleId ? { scheduleId } : {}),
      ...(slotId ? { slotId } : {}),
      ...(specialtyIds[0] ? { specialtyId: specialtyIds[0] } : {}),
    };
  }, [
    advancedScope,
    appointmentIds,
    appointmentStatuses,
    doctorIds,
    fromDate,
    lastQuickPreset,
    message,
    scheduleId,
    slotId,
    specificDate,
    specialtyIds,
    targetGroup,
    title,
    toDate,
    type,
  ]);

  const listQuery = useQuery({
    queryKey: ['admin-bulk-notification-batches', listTypeFilter],
    queryFn: () =>
      notificationsApi.listBulkBatchesByAdmin({
        page: 1,
        limit: 20,
        ...(listTypeFilter ? { type: listTypeFilter } : {}),
      }),
    placeholderData: (old) => old,
  });

  const selectedBatchQuery = useQuery({
    queryKey: ['admin-bulk-notification-batch-detail', selectedBatchId],
    queryFn: () => notificationsApi.getBulkBatchDetailByAdmin(selectedBatchId as number),
    enabled: Boolean(selectedBatchId),
  });

  const previewMutation = useMutation({
    mutationFn: () => notificationsApi.previewBulkByAdmin(payload),
    onError: (error) => {
      toast.error(extractErrorMessage(error, 'Không thể xem trước danh sách người nhận.'));
    },
  });

  const createMutation = useMutation({
    mutationFn: () => notificationsApi.createBulkByAdmin(payload),
    onSuccess: (result) => {
      toast.success(result?.message || 'Đã xếp hàng gửi thông báo hàng loạt.');
      queryClient.invalidateQueries({ queryKey: ['admin-bulk-notification-batches'] });
      if (result?.batchId) {
        setSelectedBatchId(result.batchId);
      }
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, 'Không thể tạo batch thông báo.'));
    },
  });

  const preview = previewMutation.data;
  const previewRecipients = preview?.previewRecipients || preview?.sampleRecipients || [];
  const canSubmit = Boolean(message.trim());

  const applyTypePreset = (nextType: AdminBulkNotificationType) => {
    const currentOption = TYPE_OPTIONS.find((item) => item.value === type);
    const nextOption = TYPE_OPTIONS.find((item) => item.value === nextType);

    setType(nextType);
    if (!nextOption) return;

    const shouldReplaceTitle =
      !title.trim() || (currentOption ? title.trim() === currentOption.defaultTitle : false);
    const shouldReplaceMessage =
      !message.trim() || (currentOption ? message.trim() === currentOption.defaultMessage : false);

    if (shouldReplaceTitle) {
      setTitle(nextOption.defaultTitle);
    }
    if (shouldReplaceMessage) {
      setMessage(nextOption.defaultMessage);
    }
  };

  const applyQuickPreset = (preset: QuickTargetPreset) => {
    setLastQuickPreset(preset.id);
    setTargetGroup(preset.targetGroup);
    setSpecialtyIds([]);
    setDoctorIds([]);
    setDoctorPickerValue('all');
    setAppointmentIdsRaw('');
    setAppointmentStatusesRaw('');
    setScheduleIdRaw('');
    setSlotIdRaw('');

    if (preset.id === 'patients_today') {
      setSpecificDate(getTodayIso());
      setFromDate('');
      setToDate('');
      return;
    }

    if (preset.id === 'patients_tomorrow') {
      setSpecificDate(getTomorrowIso());
      setFromDate('');
      setToDate('');
      return;
    }

    setSpecificDate('');
    setFromDate(getTodayIso());
    setToDate('');
  };

  const toggleSpecialty = (specialtyId: number) => {
    setSpecialtyIds((prev) =>
      prev.includes(specialtyId) ? prev.filter((id) => id !== specialtyId) : [...prev, specialtyId],
    );
  };

  const addDoctorFromPicker = (value: string) => {
    if (value === 'all') {
      setDoctorPickerValue('all');
      return;
    }
    const id = Number.parseInt(value, 10);
    if (!Number.isFinite(id) || id <= 0) return;
    setDoctorIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setDoctorPickerValue('all');
  };

  const validateBeforeSubmit = () => {
    if (!message.trim()) {
      toast.error('Nội dung thông báo không được để trống.');
      return false;
    }

    if (targetGroup === 'BY_SPECIALTY' && specialtyIds.length === 0) {
      toast.error('Đối tượng theo chuyên khoa cần chọn ít nhất 1 chuyên khoa.');
      return false;
    }

    if (targetGroup === 'ADVANCED_FILTER' && !hasAdvancedMeaningfulFilter) {
      toast.error('Bộ lọc nâng cao cần ít nhất 1 điều kiện lọc có nghĩa.');
      return false;
    }

    return true;
  };

  const handlePreview = () => {
    if (!validateBeforeSubmit()) return;
    previewMutation.mutate();
  };

  const handleCreate = () => {
    if (!validateBeforeSubmit()) return;

    const naturalSummary = preview?.summaryText ? `\n\nPhạm vi gửi: ${preview.summaryText}` : '';
    const warningText = preview?.warnings?.length
      ? `\n\nCảnh báo:\n- ${preview.warnings.join('\n- ')}`
      : targetGroup === 'ALL_USERS'
        ? '\n\nCảnh báo: Bạn đang gửi diện rộng cho toàn bộ người dùng.'
        : '';

    const confirmText = preview?.totalRecipients
      ? `Bạn sắp gửi thông báo đến ${preview.totalRecipients} người nhận. Bạn có chắc chắn muốn tiếp tục?${naturalSummary}${warningText}`
      : `Bạn sắp gửi thông báo theo phạm vi đã chọn. Bạn có chắc chắn muốn tiếp tục?${naturalSummary}${warningText}`;

    if (!window.confirm(confirmText)) {
      return;
    }

    createMutation.mutate();
  };

  const recipientSummaryLine = useMemo(() => {
    if (preview?.summaryText) return preview.summaryText;
    if (preview?.scopeSummary) return preview.scopeSummary;

    if (targetGroup === 'ALL_USERS') return 'Gửi cho toàn bộ người dùng trong hệ thống.';
    if (targetGroup === 'DOCTORS') return 'Gửi cho nhóm bác sĩ theo bộ lọc hiện tại.';
    if (targetGroup === 'BY_SPECIALTY') return 'Gửi cho bác sĩ theo chuyên khoa đã chọn.';
    if (targetGroup === 'ADVANCED_FILTER') return 'Gửi theo bộ lọc nâng cao.';

    if (specificDate) return `Gửi cho bệnh nhân có lịch vào ngày ${specificDate}.`;
    if (fromDate || toDate) return `Gửi cho bệnh nhân theo khoảng ngày ${fromDate || '...'} đến ${toDate || '...'}.`;
    return 'Gửi cho bệnh nhân theo phạm vi mặc định.';
  }, [fromDate, preview?.scopeSummary, preview?.summaryText, specificDate, targetGroup, toDate]);

  const stepCompletion = {
    type: Boolean(type),
    recipient: Boolean(targetGroup),
    filters:
      (targetGroup === 'ADVANCED_FILTER' && hasAdvancedMeaningfulFilter) ||
      (targetGroup === 'BY_SPECIALTY' && specialtyIds.length > 0) ||
      (targetGroup !== 'ADVANCED_FILTER' && targetGroup !== 'BY_SPECIALTY'),
    preview: Boolean(preview),
    content: Boolean(message.trim()),
    send: createMutation.isSuccess,
  };

  const activeStepIndex = FLOW_STEPS.findIndex((item) => !stepCompletion[item.id]);
  const resolvedActiveStepIndex = activeStepIndex === -1 ? FLOW_STEPS.length - 1 : activeStepIndex;

  const shouldShowDateFilter =
    targetGroup === 'PATIENTS' || targetGroup === 'DOCTORS' || targetGroup === 'ADVANCED_FILTER';
  const shouldShowSpecialtyFilter =
    targetGroup === 'DOCTORS' || targetGroup === 'BY_SPECIALTY' || targetGroup === 'ADVANCED_FILTER';
  const shouldShowAppointmentFilters =
    targetGroup === 'PATIENTS' || targetGroup === 'ADVANCED_FILTER';
  const shouldShowAdvancedTechnical = targetGroup === 'ADVANCED_FILTER';

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 px-3 pb-4 sm:px-4 lg:px-0">
      <div className="rounded-xl border border-blue-100 bg-white p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Quản lý thông báo hệ thống</h1>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Tạo thông báo hệ thống, xem trước danh sách người nhận và theo dõi kết quả gửi batch.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
            <BellRing className="h-4 w-4" />
            Kênh thông báo nội bộ
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {FLOW_STEPS.map((item, index) => (
            <span key={item.id} className="inline-flex items-center gap-1.5">
              <StepTag
                label={item.label}
                active={index === resolvedActiveStepIndex}
                completed={stepCompletion[item.id]}
              />
              {index < FLOW_STEPS.length - 1 ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" /> : null}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Ký hiệu: <span className="font-semibold text-red-500">*</span> là bắt buộc,{' '}
          <span className="font-medium text-slate-500">(không bắt buộc)</span> là tùy chọn.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <div className="space-y-4">
          <SectionCard
            step="1"
            title="Loại thông báo"
            description="Chọn loại thông báo trước khi cấu hình đối tượng nhận."
            icon={BellRing}
          >
            <div className="mb-2">
              <FieldLabel label="Loại thông báo" required />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {TYPE_OPTIONS.map((item) => {
                const Icon = item.icon;
                const isSelected = type === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => applyTypePreset(item.value)}
                    className={cn(
                      'rounded-lg border p-2.5 text-left transition',
                      isSelected ? item.toneClass : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold leading-5">{item.label}</p>
                        <p className="mt-0.5 text-xs leading-5 opacity-80">{item.description}</p>
                      </div>
                      <Icon className="h-4 w-4 shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            step="2"
            title="Đối tượng nhận"
            description="Chọn nhóm đối tượng ở mức cao trước khi lọc chi tiết."
            icon={Users}
          >
            <div className="space-y-3">
              <div>
                <FieldLabel label="Nhóm đối tượng nhận" required />
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {TARGET_GROUP_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = targetGroup === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setTargetGroup(option.value);
                        setLastQuickPreset(undefined);
                      }}
                      className={cn(
                        'rounded-lg border p-2.5 text-left transition',
                        selected ? option.toneClass : 'border-slate-200 bg-white hover:border-slate-300',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold leading-5">{option.label}</p>
                          <p className="mt-0.5 text-xs leading-5 opacity-80">{option.description}</p>
                        </div>
                        <Icon className="h-4 w-4 shrink-0" />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Preset nhanh
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {QUICK_TARGET_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyQuickPreset(preset)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                        lastQuickPreset === preset.id
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                      )}
                      title={preset.description}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            step="3"
            title="Điều kiện lọc"
            description="Filter được hiển thị theo nhóm đối tượng đã chọn."
            icon={Filter}
          >
            <div className="space-y-3">
              {targetGroup === 'ALL_USERS' ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Đối tượng “Tất cả người dùng” không bắt buộc điều kiện lọc. Hãy kiểm tra preview trước khi gửi.
                </div>
              ) : null}

              {targetGroup === 'ADVANCED_FILTER' ? (
                <label className="block text-sm text-slate-700">
                  <FieldLabel label="Đối tượng trong chế độ nâng cao" required />
                  <AdminSelect
                    value={advancedScope}
                    onValueChange={(value) => setAdvancedScope(value as AdminNotificationRecipientScope)}
                  >
                    <AdminSelectTrigger className="mt-1 w-full">
                      <AdminSelectValue />
                    </AdminSelectTrigger>
                    <AdminSelectContent>
                      <AdminSelectItem value="PATIENTS">Bệnh nhân</AdminSelectItem>
                      <AdminSelectItem value="DOCTORS">Bác sĩ</AdminSelectItem>
                      <AdminSelectItem value="ALL_USERS">Tất cả người dùng</AdminSelectItem>
                    </AdminSelectContent>
                  </AdminSelect>
                </label>
              ) : null}

              {shouldShowSpecialtyFilter ? (
                <div className="space-y-2">
                  <FieldLabel
                    label="Chuyên khoa"
                    required={targetGroup === 'BY_SPECIALTY'}
                  />
                  <div className="max-h-36 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                    <div className="flex flex-wrap gap-1.5">
                      {specialtyOptions.map((specialty) => (
                        <button
                          key={specialty.CK_MA}
                          type="button"
                          onClick={() => toggleSpecialty(specialty.CK_MA)}
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-xs transition',
                            specialtyIds.includes(specialty.CK_MA)
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                          )}
                        >
                          {specialty.CK_TEN}
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedSpecialtyLabels.length ? (
                    <p className="text-xs text-slate-500">Đã chọn: {selectedSpecialtyLabels.join(' · ')}</p>
                  ) : null}
                </div>
              ) : null}

              {(targetGroup === 'PATIENTS' ||
                targetGroup === 'DOCTORS' ||
                targetGroup === 'BY_SPECIALTY' ||
                targetGroup === 'ADVANCED_FILTER') ? (
                <div className="space-y-2">
                  <FieldLabel label="Bác sĩ (lọc thêm)" />
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr),auto]">
                    <AdminSelect value={doctorPickerValue} onValueChange={addDoctorFromPicker}>
                      <AdminSelectTrigger className="w-full">
                        <AdminSelectValue placeholder="Chọn bác sĩ để thêm vào bộ lọc" />
                      </AdminSelectTrigger>
                      <AdminSelectContent>
                        <AdminSelectItem value="all">-- Chọn bác sĩ --</AdminSelectItem>
                        {doctorOptions.map((item) => (
                          <AdminSelectItem key={item.BS_MA} value={String(item.BS_MA)}>
                            {item.BS_HO_TEN}
                          </AdminSelectItem>
                        ))}
                      </AdminSelectContent>
                    </AdminSelect>
                    <Button
                      variant="outline"
                      onClick={() => setDoctorIds([])}
                      disabled={doctorIds.length === 0}
                    >
                      Xóa bác sĩ
                    </Button>
                  </div>
                  {selectedDoctorLabels.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDoctorLabels.map((name, index) => (
                        <span
                          key={`${name}-${index}`}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {shouldShowDateFilter ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="block text-sm text-slate-700">
                    <FieldLabel label="Ngày cụ thể" />
                    <Input
                      type="date"
                      value={specificDate}
                      onChange={(event) => setSpecificDate(event.target.value)}
                      className="mt-1"
                    />
                  </label>
                  <label className="block text-sm text-slate-700">
                    <FieldLabel label="Từ ngày" />
                    <Input
                      type="date"
                      value={fromDate}
                      disabled={Boolean(specificDate)}
                      onChange={(event) => setFromDate(event.target.value)}
                      className="mt-1"
                    />
                  </label>
                  <label className="block text-sm text-slate-700">
                    <FieldLabel label="Đến ngày" />
                    <Input
                      type="date"
                      value={toDate}
                      disabled={Boolean(specificDate)}
                      onChange={(event) => setToDate(event.target.value)}
                      className="mt-1"
                    />
                  </label>
                </div>
              ) : null}

              {shouldShowAppointmentFilters ? (
                <>
                  <label className="block text-sm text-slate-700">
                    <FieldLabel label="Mã lịch hẹn (nhiều mã cách nhau dấu phẩy)" />
                    <Input
                      value={appointmentIdsRaw}
                      onChange={(event) => setAppointmentIdsRaw(event.target.value)}
                      placeholder="Ví dụ: 1021, 1022, 2050"
                      className="mt-1"
                    />
                  </label>

                  <label className="block text-sm text-slate-700">
                    <FieldLabel label="Trạng thái lịch hẹn (CSV, ví dụ CHO_KHAM,DA_CHECKIN)" />
                    <Input
                      value={appointmentStatusesRaw}
                      onChange={(event) => setAppointmentStatusesRaw(event.target.value)}
                      placeholder="Ví dụ: CHO_KHAM,DA_CHECKIN"
                      className="mt-1"
                    />
                  </label>
                </>
              ) : null}

              {shouldShowAdvancedTechnical ? (
                <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700">
                    Tùy chọn kỹ thuật mở rộng
                  </summary>
                  <p className="mt-2 text-xs text-slate-500">
                    Chỉ dùng khi cần mapping chính xác với dữ liệu backend nội bộ.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block text-sm text-slate-700">
                      <FieldLabel label="Mã lịch làm việc (LBM_ID)" />
                      <Input
                        inputMode="numeric"
                        value={scheduleIdRaw}
                        onChange={(event) => setScheduleIdRaw(event.target.value)}
                        placeholder="Ví dụ: 1204"
                        className="mt-1 bg-white"
                      />
                    </label>
                    <label className="block text-sm text-slate-700">
                      <FieldLabel label="Mã khung giờ (KG_MA)" />
                      <Input
                        inputMode="numeric"
                        value={slotIdRaw}
                        onChange={(event) => setSlotIdRaw(event.target.value)}
                        placeholder="Ví dụ: 8"
                        className="mt-1 bg-white"
                      />
                    </label>
                  </div>
                </details>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            step="5"
            title="Soạn nội dung thông báo"
            description="Soạn tiêu đề/nội dung và xem trước nội dung sẽ gửi."
            icon={ClipboardList}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)]">
              <div className="space-y-3">
                <label className="block text-sm text-slate-700">
                  <FieldLabel label="Tiêu đề" />
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Ví dụ: Cập nhật lịch khám"
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-slate-500">{title.trim().length} ký tự</p>
                </label>

                <label className="block text-sm text-slate-700">
                  <FieldLabel label="Nội dung thông báo" required />
                  <Textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Mô tả rõ thông tin cần gửi đến người nhận..."
                    className="mt-1 min-h-[120px] max-h-[240px] resize-y overflow-y-auto"
                  />
                  <p className="mt-1 text-xs text-slate-500">{message.trim().length} ký tự</p>
                </label>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Xem trước thông báo</p>
                <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-500">{selectedTypeOption?.label || 'Thông báo'}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{title.trim() || '(Chưa có tiêu đề)'}</p>
                  <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {message.trim() || '(Chưa có nội dung)'}
                  </p>
                  <p className="mt-3 text-[11px] text-slate-400">{formatDateTime(new Date().toISOString())}</p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-4">
          <div className="space-y-4 lg:sticky lg:top-4">
            <SectionCard
              step="4"
              title="Xem trước người nhận"
              description="Xem trước người nhận dùng chung logic với bước gửi."
              icon={Users}
            >
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-sm font-medium leading-5 text-slate-800">{recipientSummaryLine}</p>
                  {preview?.summaryText ? (
                    <p className="mt-1 text-xs text-slate-500">{preview.summaryText}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(preview?.filterSummary || []).length === 0 ? (
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">
                        Chưa có mô tả filter.
                      </span>
                    ) : (
                      (preview?.filterSummary || []).map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                        >
                          {item}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {preview?.warnings?.length ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                    <p className="font-semibold">Cảnh báo</p>
                    <ul className="mt-1 space-y-1">
                      {preview.warnings.map((item) => (
                        <li key={item} className="flex items-start gap-1.5">
                          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {previewMutation.isPending ? (
                  <PreviewSkeleton />
                ) : preview ? (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-sm text-emerald-800">
                      Tổng người nhận dự kiến: <span className="font-semibold">{preview.totalRecipients}</span>
                    </div>

                    {preview.totalRecipients === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-600">
                        {preview.emptyReason || 'Không tìm thấy người nhận phù hợp với điều kiện hiện tại.'}
                      </div>
                    ) : null}

                    {previewRecipients.length ? (
                      <div className="max-h-56 space-y-2 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
                        {previewRecipients.map((item, index) => (
                          <div key={`${item.phone}-${item.appointmentId}-${index}`} className="rounded-md border border-slate-100 px-2 py-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900">
                                {item.patientName || item.doctorName || item.phone}
                              </p>
                              <p className="text-xs text-slate-500">{item.appointmentId ? `#${item.appointmentId}` : 'N/A'}</p>
                            </div>
                            <p className="mt-0.5 text-xs text-slate-600">{item.phone || '--'}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {item.doctorName || item.roomName || item.role || '--'}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-center">
                    <Eye className="mx-auto h-5 w-5 text-slate-300" />
                    <p className="mt-2 text-sm font-medium text-slate-700">Chưa có dữ liệu xem trước</p>
                    <p className="mt-1 text-xs text-slate-500">Bấm “Xem trước” để kiểm tra danh sách người nhận.</p>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              step="6"
              title="Xác nhận và gửi"
              description="Summary cuối cùng trước khi tạo batch."
              icon={Send}
            >
              <div className="space-y-3">
                <div className="grid gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Loại thông báo</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{selectedTypeOption?.label || '--'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Đối tượng nhận</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{selectedTargetOption?.label || '--'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Phạm vi nhận</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">
                      {preview?.totalRecipients ? `${preview.totalRecipients} người (preview)` : 'Theo bộ lọc đã chọn'}
                    </p>
                    {preview?.summaryText ? (
                      <p className="mt-1 text-xs text-slate-500">{preview.summaryText}</p>
                    ) : null}
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Tiêu đề</p>
                    <p className="mt-0.5 line-clamp-2 text-sm font-semibold text-slate-900">{title.trim() || '--'}</p>
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  {canSubmit
                    ? 'Xem trước và gửi dùng chung logic recipient resolver để hạn chế sai lệch phạm vi.'
                    : 'Cần nhập nội dung thông báo trước khi xem trước hoặc gửi.'}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={handlePreview} disabled={!canSubmit || previewMutation.isPending}>
                    {previewMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Eye className="mr-1.5 h-4 w-4" />}
                    Xem trước
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={!canSubmit || createMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-4 w-4" />
                    )}
                    Gửi thông báo
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-900">Batch gần đây</h3>
              <div className="min-w-[180px]">
                <AdminSelect
                  value={listTypeFilter || 'all'}
                  onValueChange={(value) => setListTypeFilter(value === 'all' ? '' : (value as AdminBulkNotificationType))}
                >
                  <AdminSelectTrigger className="w-full">
                    <div className="flex items-center gap-1.5">
                      <Filter className="h-3.5 w-3.5 text-slate-500" />
                      <AdminSelectValue placeholder="Tất cả loại" />
                    </div>
                  </AdminSelectTrigger>
                  <AdminSelectContent>
                    <AdminSelectItem value="all">Tất cả loại</AdminSelectItem>
                    {TYPE_OPTIONS.map((item) => (
                      <AdminSelectItem key={item.value} value={item.value}>
                        {item.label}
                      </AdminSelectItem>
                    ))}
                  </AdminSelectContent>
                </AdminSelect>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              {listQuery.isLoading ? (
                <p className="text-sm text-slate-500">Đang tải danh sách batch...</p>
              ) : (listQuery.data?.items || []).length === 0 ? (
                <p className="text-sm text-slate-500">Chưa có batch thông báo.</p>
              ) : (
                (listQuery.data?.items || []).map((item) => (
                  <button
                    key={item.TBB_MA}
                    onClick={() => setSelectedBatchId(item.TBB_MA)}
                    className={cn(
                      'w-full rounded-lg border px-2.5 py-2 text-left transition',
                      selectedBatchId === item.TBB_MA
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-5 text-slate-900">
                          #{item.TBB_MA} - {item.TBB_TIEU_DE || 'Thông báo'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{item.TBB_LOAI}</p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {item.TBB_TRANG_THAI}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {formatDateTime(item.TBB_THOI_GIAN_TAO)} • {item.TBB_TONG_NGUOI_NHAN} người nhận
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>

          {selectedBatchId ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-base font-semibold text-slate-900">Chi tiết batch #{selectedBatchId}</h3>
              {selectedBatchQuery.isLoading ? (
                <p className="mt-2 text-sm text-slate-500">Đang tải chi tiết batch...</p>
              ) : selectedBatchQuery.data ? (
                <>
                  <p className="mt-2 text-sm text-slate-600">
                    Tổng người nhận backend trả về: {(selectedBatchQuery.data.recipients || []).length}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {Object.entries(selectedBatchQuery.data.summary || {}).map(([key, value]) => (
                      <div key={key} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                        <p className="text-xs uppercase tracking-wide text-slate-500">{key}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Không có dữ liệu chi tiết.</p>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
