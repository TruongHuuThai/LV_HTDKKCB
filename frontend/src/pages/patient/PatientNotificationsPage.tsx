import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Info,
  RefreshCw,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  notificationsApi,
  type PatientNotificationItem,
  type PatientNotificationType,
} from '@/services/api/notificationsApi';

const PAGE_SIZE = 20;

type NotificationDomain = 'all' | 'payment' | 'appointment' | 'system';
type ReadFilter = 'all' | 'true' | 'false';
type Tone = 'emerald' | 'rose' | 'amber' | 'blue' | 'slate' | 'sky';
type NotificationPriority = 'high' | 'medium' | 'normal';
type RelativeDateGroup = 'today' | 'yesterday' | 'last7days' | 'older';

interface NotificationTypeOption {
  value: PatientNotificationType;
  label: string;
  domain: Exclude<NotificationDomain, 'all'>;
}

interface NotificationVisualMeta {
  effectiveType: PatientNotificationType | 'unknown';
  domain: Exclude<NotificationDomain, 'all'>;
  typeLabel: string;
  icon: LucideIcon;
  tone: Tone;
  priority: NotificationPriority;
  priorityLabel: string;
}

interface NotificationEntry {
  item: PatientNotificationItem;
  unread: boolean;
  visual: NotificationVisualMeta;
}

interface NotificationGroup {
  key: RelativeDateGroup;
  label: string;
  items: NotificationEntry[];
}

interface NotificationAction {
  label: string;
  to: string;
}

const DOMAIN_OPTIONS: Array<{ value: NotificationDomain; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'payment', label: 'Thanh toán' },
  { value: 'appointment', label: 'Lịch khám' },
  { value: 'system', label: 'Hệ thống' },
];

const READ_OPTIONS: Array<{ value: ReadFilter; label: string }> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'false', label: 'Chưa đọc' },
  { value: 'true', label: 'Đã đọc' },
];

const TYPE_OPTIONS: NotificationTypeOption[] = [
  { value: 'payment_pending', label: 'Chờ thanh toán', domain: 'payment' },
  { value: 'payment_success', label: 'Thanh toán thành công', domain: 'payment' },
  { value: 'payment_failed', label: 'Thanh toán thất bại', domain: 'payment' },
  { value: 'payment_timeout', label: 'Thanh toán hết hạn', domain: 'payment' },
  { value: 'reminder', label: 'Nhắc lịch khám', domain: 'appointment' },
  { value: 'reschedule', label: 'Đổi lịch', domain: 'appointment' },
  { value: 'cancellation', label: 'Hủy lịch', domain: 'appointment' },
  { value: 'doctor_unavailable', label: 'Bác sĩ vắng mặt', domain: 'appointment' },
  { value: 'waitlist', label: 'Danh sách chờ', domain: 'appointment' },
  { value: 'system_admin', label: 'Thông báo hệ thống (Admin)', domain: 'system' },
  { value: 'system_auto', label: 'Thông báo hệ thống (Tự động)', domain: 'system' },
];

const TYPE_OPTION_MAP = new Map(TYPE_OPTIONS.map((option) => [option.value, option]));

const TYPE_DOMAIN_MAP: Record<PatientNotificationType, Exclude<NotificationDomain, 'all'>> = {
  payment_pending: 'payment',
  payment_success: 'payment',
  payment_failed: 'payment',
  payment_timeout: 'payment',
  reminder: 'appointment',
  reschedule: 'appointment',
  cancellation: 'appointment',
  doctor_unavailable: 'appointment',
  waitlist: 'appointment',
  system_admin: 'system',
  system_auto: 'system',
};

const GROUP_LABELS: Record<RelativeDateGroup, string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  last7days: '7 ngày gần đây',
  older: 'Cũ hơn',
};

const GROUP_ORDER: RelativeDateGroup[] = ['today', 'yesterday', 'last7days', 'older'];

const TONE_CLASSES: Record<
  Tone,
  {
    card: string;
    iconWrap: string;
    typeBadge: string;
    unreadRing: string;
    unreadBg: string;
    dot: string;
  }
> = {
  emerald: {
    card: 'border-emerald-200/80 bg-emerald-50/40',
    iconWrap: 'bg-emerald-100 text-emerald-700',
    typeBadge: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    unreadRing: 'ring-emerald-200',
    unreadBg: 'bg-emerald-50/70',
    dot: 'bg-emerald-500',
  },
  rose: {
    card: 'border-rose-200/80 bg-rose-50/40',
    iconWrap: 'bg-rose-100 text-rose-700',
    typeBadge: 'border-rose-200 bg-rose-100 text-rose-700',
    unreadRing: 'ring-rose-200',
    unreadBg: 'bg-rose-50/70',
    dot: 'bg-rose-500',
  },
  amber: {
    card: 'border-amber-200/80 bg-amber-50/40',
    iconWrap: 'bg-amber-100 text-amber-700',
    typeBadge: 'border-amber-200 bg-amber-100 text-amber-700',
    unreadRing: 'ring-amber-200',
    unreadBg: 'bg-amber-50/70',
    dot: 'bg-amber-500',
  },
  blue: {
    card: 'border-blue-200/80 bg-blue-50/40',
    iconWrap: 'bg-blue-100 text-blue-700',
    typeBadge: 'border-blue-200 bg-blue-100 text-blue-700',
    unreadRing: 'ring-blue-200',
    unreadBg: 'bg-blue-50/70',
    dot: 'bg-blue-500',
  },
  slate: {
    card: 'border-slate-200 bg-slate-50/60',
    iconWrap: 'bg-slate-100 text-slate-700',
    typeBadge: 'border-slate-200 bg-slate-100 text-slate-700',
    unreadRing: 'ring-slate-200',
    unreadBg: 'bg-slate-50',
    dot: 'bg-slate-500',
  },
  sky: {
    card: 'border-sky-200/80 bg-sky-50/40',
    iconWrap: 'bg-sky-100 text-sky-700',
    typeBadge: 'border-sky-200 bg-sky-100 text-sky-700',
    unreadRing: 'ring-sky-200',
    unreadBg: 'bg-sky-50/70',
    dot: 'bg-sky-500',
  },
};

function isKnownType(value?: string | null): value is PatientNotificationType {
  return Boolean(value && TYPE_OPTION_MAP.has(value as PatientNotificationType));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function inferTypeFromText(item: PatientNotificationItem): PatientNotificationType | null {
  const raw = `${item.TB_TIEU_DE || ''} ${item.TB_NOI_DUNG || ''}`.trim();
  if (!raw) return null;

  const normalized = normalizeText(raw);

  if (
    includesAny(normalized, ['thanh toan']) &&
    includesAny(normalized, ['that bai', 'khong thanh cong', 'loi', 'tu choi'])
  ) {
    return 'payment_failed';
  }
  if (includesAny(normalized, ['thanh toan']) && includesAny(normalized, ['het han', 'qua han', 'timeout'])) {
    return 'payment_timeout';
  }
  if (includesAny(normalized, ['thanh toan']) && includesAny(normalized, ['thanh cong', 'hoan tat'])) {
    return 'payment_success';
  }
  if (includesAny(normalized, ['thanh toan', 'chi tra'])) {
    return 'payment_pending';
  }
  if (includesAny(normalized, ['huy lich', 'huy hen'])) {
    return 'cancellation';
  }
  if (includesAny(normalized, ['doi lich', 'cap nhat lich', 'reschedule'])) {
    return 'reschedule';
  }
  if (includesAny(normalized, ['nhac lich', 'sap den', 'lich kham', 'hen kham'])) {
    return 'reminder';
  }
  if (includesAny(normalized, ['bac si', 'vang mat', 'khong lam viec'])) {
    return 'doctor_unavailable';
  }
  if (includesAny(normalized, ['danh sach cho', 'waitlist'])) {
    return 'waitlist';
  }
  if (includesAny(normalized, ['he thong', 'thong bao chung', 'admin'])) {
    return 'system_auto';
  }
  return null;
}

function resolveEffectiveType(item: PatientNotificationItem): PatientNotificationType | 'unknown' {
  if (isKnownType(item.TB_LOAI)) {
    return item.TB_LOAI;
  }
  return inferTypeFromText(item) || 'unknown';
}

function getDomainByType(type: PatientNotificationType | 'unknown'): Exclude<NotificationDomain, 'all'> {
  if (type === 'unknown') return 'system';
  return TYPE_DOMAIN_MAP[type];
}

function getTypeLabel(type: PatientNotificationType | 'unknown') {
  if (type === 'unknown') return 'Thông báo';
  return TYPE_OPTION_MAP.get(type)?.label || type;
}

function isUnread(item: PatientNotificationItem) {
  return String(item.TB_TRANG_THAI || '').toUpperCase() !== 'READ';
}

function formatDateTime(value?: string | null) {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.toLocaleDateString('vi-VN')} ${parsed.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function parseValidDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function startOfDay(value: Date) {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function resolveRelativeDateGroup(value?: string | null): RelativeDateGroup {
  const target = parseValidDate(value);
  if (!target) return 'older';

  const today = startOfDay(new Date()).getTime();
  const compareDay = startOfDay(target).getTime();
  const diffDays = Math.floor((today - compareDay) / 86400000);

  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays <= 7) return 'last7days';
  return 'older';
}

function groupNotificationsByRelativeDate(entries: NotificationEntry[]): NotificationGroup[] {
  const grouped: Record<RelativeDateGroup, NotificationEntry[]> = {
    today: [],
    yesterday: [],
    last7days: [],
    older: [],
  };

  entries.forEach((entry) => {
    const key = resolveRelativeDateGroup(entry.item.TB_THOI_GIAN);
    grouped[key].push(entry);
  });

  return GROUP_ORDER.filter((key) => grouped[key].length > 0).map((key) => ({
    key,
    label: GROUP_LABELS[key],
    items: grouped[key],
  }));
}

function resolveAppointmentCode(item: PatientNotificationItem) {
  const raw = `${item.TB_NOI_DUNG || ''} ${item.TB_TIEU_DE || ''}`;
  const matched = raw.match(/DK_MA\s*=\s*(\d+)/i);
  return matched?.[1] || null;
}

function resolveAppointmentLink(item: PatientNotificationItem) {
  const appointmentCode = resolveAppointmentCode(item);
  if (!appointmentCode) return null;
  const id = Number.parseInt(appointmentCode, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return `/appointments/${id}`;
}

function resolvePaymentCode(item: PatientNotificationItem) {
  const raw = `${item.TB_NOI_DUNG || ''} ${item.TB_TIEU_DE || ''}`;
  const matched = raw.match(/TT_MA\s*=\s*(\d+)/i);
  return matched?.[1] || null;
}

function extractDoctorName(item: PatientNotificationItem) {
  const raw = item.TB_NOI_DUNG || '';
  const matched = raw.match(/(?:Bac si|BS\.?|Doctor)\s*[:\-]?\s*([^\n,.;]+)/i);
  if (!matched?.[1]) return null;
  return matched[1].trim();
}

function extractVisitDate(item: PatientNotificationItem) {
  const raw = item.TB_NOI_DUNG || '';
  const matched = raw.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  return matched?.[1] || null;
}

function extractVisitTime(item: PatientNotificationItem) {
  const raw = item.TB_NOI_DUNG || '';
  const matched = raw.match(/\b(\d{1,2}:\d{2})\b/);
  return matched?.[1] || null;
}

function getPriorityBadgeClass(priority: NotificationPriority) {
  if (priority === 'high') return 'border-rose-200 bg-rose-100 text-rose-700';
  if (priority === 'medium') return 'border-blue-200 bg-blue-100 text-blue-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

function getNotificationVisualMeta(item: PatientNotificationItem): NotificationVisualMeta {
  const effectiveType = resolveEffectiveType(item);
  const domain = getDomainByType(effectiveType);
  const typeLabel = getTypeLabel(effectiveType);

  switch (effectiveType) {
    case 'payment_success':
      return {
        effectiveType,
        domain,
        typeLabel,
        icon: CheckCircle2,
        tone: 'emerald',
        priority: 'normal',
        priorityLabel: 'Bình thường',
      };
    case 'payment_failed':
      return {
        effectiveType,
        domain,
        typeLabel,
        icon: XCircle,
        tone: 'rose',
        priority: 'high',
        priorityLabel: 'Quan trọng',
      };
    case 'payment_timeout':
      return {
        effectiveType,
        domain,
        typeLabel,
        icon: Clock3,
        tone: 'amber',
        priority: 'high',
        priorityLabel: 'Quan trọng',
      };
    case 'payment_pending':
      return {
        effectiveType,
        domain,
        typeLabel,
        icon: Wallet,
        tone: 'blue',
        priority: 'medium',
        priorityLabel: 'Cần theo dõi',
      };
    case 'reminder':
      return {
        effectiveType,
        domain,
        typeLabel,
        icon: CalendarDays,
        tone: 'blue',
        priority: 'medium',
        priorityLabel: 'Sắp tới',
      };
    case 'reschedule':
      return {
        effectiveType,
        domain,
        typeLabel,
        icon: RefreshCw,
        tone: 'amber',
        priority: 'high',
        priorityLabel: 'Quan trọng',
      };
    case 'cancellation':
      return {
        effectiveType,
        domain,
        typeLabel,
        icon: XCircle,
        tone: 'rose',
        priority: 'high',
        priorityLabel: 'Quan trọng',
      };
    case 'doctor_unavailable':
      return {
        effectiveType,
        domain,
        typeLabel,
        icon: AlertCircle,
        tone: 'amber',
        priority: 'high',
        priorityLabel: 'Quan trọng',
      };
    case 'waitlist':
      return {
        effectiveType,
        domain,
        typeLabel,
        icon: Users,
        tone: 'sky',
        priority: 'medium',
        priorityLabel: 'Theo dõi',
      };
    case 'system_admin':
    case 'system_auto':
      return {
        effectiveType,
        domain,
        typeLabel,
        icon: Info,
        tone: 'slate',
        priority: 'normal',
        priorityLabel: 'Thông tin',
      };
    default:
      return {
        effectiveType: 'unknown',
        domain,
        typeLabel,
        icon: Bell,
        tone: 'slate',
        priority: 'normal',
        priorityLabel: 'Thông tin',
      };
  }
}

function resolvePrimaryAction(entry: NotificationEntry): NotificationAction | null {
  const appointmentLink = resolveAppointmentLink(entry.item);
  const type = entry.visual.effectiveType;

  if (
    type === 'payment_pending' ||
    type === 'payment_failed' ||
    type === 'payment_timeout' ||
    type === 'payment_success'
  ) {
    return {
      label:
        type === 'payment_failed' || type === 'payment_timeout'
          ? 'Xử lý thanh toán'
          : 'Xem chi tiết thanh toán',
      to: appointmentLink || '/appointments/my',
    };
  }

  if (
    type === 'reminder' ||
    type === 'reschedule' ||
    type === 'cancellation' ||
    type === 'doctor_unavailable' ||
    type === 'waitlist'
  ) {
    return {
      label: 'Xem lịch hẹn',
      to: appointmentLink || '/appointments/my',
    };
  }

  if (appointmentLink) {
    return {
      label: 'Xem chi tiết',
      to: appointmentLink,
    };
  }

  return null;
}

function getDomainLabel(domain: NotificationDomain) {
  return DOMAIN_OPTIONS.find((item) => item.value === domain)?.label || '';
}

function FilterChip({
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

function NotificationSkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={`notification-skeleton-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <div className="flex flex-wrap gap-2 pt-1">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <Bell className="mx-auto h-10 w-10 text-slate-300" />
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

function NotificationCard({
  entry,
  onMarkRead,
  markReadPending,
}: {
  entry: NotificationEntry;
  onMarkRead: (notificationId: number) => void;
  markReadPending: boolean;
}) {
  const { item, unread, visual } = entry;
  const tone = TONE_CLASSES[visual.tone];
  const Icon = visual.icon;
  const action = resolvePrimaryAction(entry);
  const appointmentCode = resolveAppointmentCode(item);
  const paymentCode = resolvePaymentCode(item);
  const doctorName = extractDoctorName(item);
  const visitDate = extractVisitDate(item);
  const visitTime = extractVisitTime(item);

  return (
    <article
      className={cn(
        'rounded-2xl border bg-white p-4 shadow-sm transition-colors',
        tone.card,
        unread ? cn('ring-1', tone.unreadRing, tone.unreadBg) : 'opacity-95',
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="relative">
            <span
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent',
                tone.iconWrap,
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            {unread ? (
              <span className={cn('absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white', tone.dot)} />
            ) : null}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{item.TB_TIEU_DE || 'Thông báo'}</h3>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  tone.typeBadge,
                )}
              >
                {visual.typeLabel}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  getPriorityBadgeClass(visual.priority),
                )}
              >
                {visual.priorityLabel}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  unread
                    ? 'border-blue-200 bg-blue-100 text-blue-700'
                    : 'border-slate-200 bg-slate-100 text-slate-600',
                )}
              >
                {unread ? 'Chưa đọc' : 'Đã đọc'}
              </span>
            </div>

            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
              {item.TB_NOI_DUNG || '(Không có nội dung)'}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {appointmentCode ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                  DK_MA: {appointmentCode}
                </span>
              ) : null}
              {paymentCode ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                  TT_MA: {paymentCode}
                </span>
              ) : null}
              {doctorName ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                  Bác sĩ: {doctorName}
                </span>
              ) : null}
              {visitDate ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                  Ngày khám: {visitDate}
                </span>
              ) : null}
              {visitTime ? (
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                  Giờ: {visitTime}
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-xs text-slate-500">Gửi lúc: {formatDateTime(item.TB_THOI_GIAN)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {action ? (
            <Button asChild size="sm" className="bg-blue-600 text-white hover:bg-blue-700">
              <Link to={action.to}>{action.label}</Link>
            </Button>
          ) : null}

          {!unread ? null : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMarkRead(item.TB_MA)}
              disabled={markReadPending}
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              Đánh dấu đã đọc
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function PatientNotificationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [domainFilter, setDomainFilter] = useState<NotificationDomain>('all');
  const [typeFilter, setTypeFilter] = useState<'' | PatientNotificationType>('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [markingNotificationId, setMarkingNotificationId] = useState<number | null>(null);

  const notificationsQuery = useQuery({
    queryKey: ['patient-notifications', page, typeFilter, readFilter],
    queryFn: () =>
      notificationsApi.listMine({
        page,
        limit: PAGE_SIZE,
        ...(typeFilter ? { type: typeFilter } : {}),
        ...(readFilter === 'all' ? {} : { isRead: readFilter }),
      }),
    placeholderData: (previousData) => previousData,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      setMarkingNotificationId(notificationId);
      return notificationsApi.markRead(notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-notifications'] });
      toast.success('Đã đánh dấu thông báo đã đọc.');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể đánh dấu đã đọc.');
    },
    onSettled: () => {
      setMarkingNotificationId(null);
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['patient-notifications'] });
      toast.success(`Đã đánh dấu đã đọc ${result?.updatedCount || 0} thông báo.`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Không thể đánh dấu tất cả.');
    },
  });

  const queryItems = notificationsQuery.data?.items || [];
  const meta = notificationsQuery.data?.meta;

  const entries = useMemo<NotificationEntry[]>(
    () =>
      queryItems.map((item) => ({
        item,
        unread: isUnread(item),
        visual: getNotificationVisualMeta(item),
      })),
    [queryItems],
  );

  const typeOptionsForDomain = useMemo(() => {
    if (domainFilter === 'all') return TYPE_OPTIONS;
    return TYPE_OPTIONS.filter((option) => option.domain === domainFilter);
  }, [domainFilter]);

  const filteredEntries = useMemo(() => {
    if (domainFilter === 'all') return entries;
    return entries.filter((entry) => entry.visual.domain === domainFilter);
  }, [entries, domainFilter]);

  const groupedEntries = useMemo(() => groupNotificationsByRelativeDate(filteredEntries), [filteredEntries]);

  const unreadCount = useMemo(() => filteredEntries.filter((entry) => entry.unread).length, [filteredEntries]);
  const hasNoNotifications = !notificationsQuery.isLoading && !notificationsQuery.isError && queryItems.length === 0;
  const hasNoResultsAfterFilter = queryItems.length > 0 && filteredEntries.length === 0;

  const handleDomainFilter = (nextDomain: NotificationDomain) => {
    setDomainFilter(nextDomain);
    setPage(1);
    if (typeFilter && nextDomain !== 'all' && TYPE_DOMAIN_MAP[typeFilter] !== nextDomain) {
      setTypeFilter('');
    }
  };

  const clearFilters = () => {
    setDomainFilter('all');
    setTypeFilter('');
    setReadFilter('all');
    setPage(1);
  };

  const onMarkRead = (notificationId: number) => {
    markReadMutation.mutate(notificationId);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Thông báo cá nhân</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Trung tâm thông báo</h1>
            <p className="mt-1 text-sm text-slate-500">
              Theo dõi thanh toán, lịch khám và cập nhật hệ thống tại một nơi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => notificationsQuery.refetch()}
              disabled={notificationsQuery.isFetching}
              className="gap-1.5"
            >
              <RefreshCw className={cn('h-4 w-4', notificationsQuery.isFetching && 'animate-spin')} />
              Làm mới
            </Button>
            <Button
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending || unreadCount === 0}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              <CheckCheck className="h-4 w-4" />
              Đánh dấu tất cả đã đọc
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="flex flex-wrap gap-2">
            {DOMAIN_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                active={domainFilter === option.value}
                label={option.label}
                onClick={() => handleDomainFilter(option.value)}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={typeFilter === ''}
              label={domainFilter === 'all' ? 'Tất cả loại' : `Tất cả trong nhóm ${getDomainLabel(domainFilter)}`}
              onClick={() => {
                setTypeFilter('');
                setPage(1);
              }}
            />
            {typeOptionsForDomain.map((option) => (
              <FilterChip
                key={option.value}
                active={typeFilter === option.value}
                label={option.label}
                onClick={() => {
                  setTypeFilter(option.value);
                  setPage(1);
                }}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {READ_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                active={readFilter === option.value}
                label={option.label}
                onClick={() => {
                  setReadFilter(option.value);
                  setPage(1);
                }}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-white px-2 py-1">
              Hiển thị {filteredEntries.length}/{queryItems.length} thông báo trên trang này
            </span>
            <span className="rounded-full bg-white px-2 py-1">Chưa đọc: {unreadCount}</span>
          </div>
        </div>
      </section>

      <section className="mt-5 space-y-4">
        {notificationsQuery.isLoading ? (
          <NotificationSkeletonList />
        ) : notificationsQuery.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <p className="flex items-start gap-2 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              Không thể tải thông báo lúc này. Vui lòng thử lại.
            </p>
            <Button className="mt-3" variant="outline" onClick={() => notificationsQuery.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : hasNoNotifications ? (
          <NotificationEmptyState
            title="Bạn chưa có thông báo nào"
            description="Khi có thay đổi về lịch khám hoặc thanh toán, hệ thống sẽ hiển thị tại đây."
          />
        ) : hasNoResultsAfterFilter ? (
          <NotificationEmptyState
            title="Không có thông báo phù hợp"
            description="Bộ lọc hiện tại không trả về kết quả nào. Bạn có thể xóa bộ lọc để xem lại toàn bộ."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Xóa bộ lọc
              </Button>
            }
          />
        ) : (
          groupedEntries.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h2 className="text-sm font-semibold text-slate-700">{group.label}</h2>
                <span className="text-xs text-slate-500">{group.items.length} thông báo</span>
              </div>
              <div className="space-y-3">
                {group.items.map((entry) => (
                  <NotificationCard
                    key={entry.item.TB_MA}
                    entry={entry}
                    onMarkRead={onMarkRead}
                    markReadPending={markReadMutation.isPending && markingNotificationId === entry.item.TB_MA}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </section>

      <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row">
        <p>
          Trang {meta?.page || page}/{meta?.totalPages || 1} - Tổng {meta?.total || 0} thông báo
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((previous) => Math.max(1, previous - 1))}
            disabled={(meta?.page || page) <= 1 || notificationsQuery.isFetching}
          >
            Trang trước
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((previous) => previous + 1)}
            disabled={(meta?.page || page) >= (meta?.totalPages || 1) || notificationsQuery.isFetching}
          >
            Trang sau
          </Button>
        </div>
      </div>
    </div>
  );
}

