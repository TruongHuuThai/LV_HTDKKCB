import type { ScheduleWorkflowStatus } from '@/services/api/adminApi';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const SESSION_LABELS: Record<string, string> = {
  SANG: 'Sáng',
  CHIEU: 'Chiều',
  TOI: 'Tối',
};

const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Chủ nhật',
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
};

export type WeekdayFilterValue = 'all' | '0' | '1' | '2' | '3' | '4' | '5' | '6';

export const WEEKDAY_FILTER_OPTIONS: Array<{ value: WeekdayFilterValue; label: string }> = [
  { value: 'all', label: 'Tất cả các thứ' },
  { value: '1', label: 'Thứ 2' },
  { value: '2', label: 'Thứ 3' },
  { value: '3', label: 'Thứ 4' },
  { value: '4', label: 'Thứ 5' },
  { value: '5', label: 'Thứ 6' },
  { value: '6', label: 'Thứ 7' },
  { value: '0', label: 'Chủ nhật' },
];

function toDateOnlyFromDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDateParts(dateOnlyIso: string) {
  const [year, month, day] = dateOnlyIso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function getWeekdayFromDateOnly(dateOnlyIso: string) {
  const parts = parseIsoDateParts(dateOnlyIso);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function toDateOnlyIso(raw: string | Date) {
  if (raw instanceof Date) return toDateOnlyFromDate(raw);
  const normalized = raw.trim();
  if (!normalized) return '';
  if (DATE_ONLY_PATTERN.test(normalized)) return normalized;
  return toDateOnlyFromDate(new Date(normalized));
}

export function formatDateDdMmYyyy(raw: string | Date | null | undefined) {
  if (!raw) return '-';
  const iso = toDateOnlyIso(raw);
  if (!iso) return '-';
  const [year, month, day] = iso.split('-');
  return `${day}-${month}-${year}`;
}

export function formatDateDdMmYyyySlash(raw: string | Date | null | undefined) {
  return formatDateDdMmYyyy(raw).replace(/-/g, '/');
}

export function getSessionLabel(session: string | null | undefined) {
  if (!session) return '-';
  const normalized = session.trim().toUpperCase();
  return SESSION_LABELS[normalized] ?? session;
}

export function getScheduleWorkflowStatusLabel(status: string | null | undefined) {
  if (!status) return '-';
  switch (status.toLowerCase()) {
    case 'pending':
      return 'Chờ duyệt';
    case 'approved':
      return 'Đã duyệt';
    case 'rejected':
      return 'Từ chối';
    case 'official':
      return 'Chính thức';
    default:
      return status;
  }
}

export function getCycleStatusLabel(status: string | null | undefined) {
  if (!status) return '-';
  switch (status.toLowerCase()) {
    case 'open':
      return 'Đang mở';
    case 'locked':
      return 'Đã khóa';
    case 'finalized':
      return 'Đã chốt';
    default:
      return status;
  }
}

export function getScheduleStatusBadgeClass(status: string) {
  if (status === 'pending') return 'bg-amber-50 text-amber-700';
  if (status === 'approved' || status === 'official') return 'bg-emerald-50 text-emerald-700';
  if (status === 'rejected') return 'bg-red-50 text-red-700';
  return 'bg-slate-100 text-slate-700';
}

export function getWeekdayLabel(weekday: number | null | undefined) {
  if (weekday === null || weekday === undefined) return '-';
  return WEEKDAY_LABELS[weekday] ?? '-';
}

export function getWeekdayLabelFromDate(raw: string | Date | null | undefined) {
  if (!raw) return '-';
  const weekday = getWeekdayFromDateOnly(toDateOnlyIso(raw));
  return getWeekdayLabel(weekday);
}

export const WORKFLOW_STATUS_OPTIONS: Array<{ value: ScheduleWorkflowStatus; label: string }> = [
  { value: 'official', label: getScheduleWorkflowStatusLabel('official') },
  { value: 'approved', label: getScheduleWorkflowStatusLabel('approved') },
  { value: 'pending', label: getScheduleWorkflowStatusLabel('pending') },
  { value: 'rejected', label: getScheduleWorkflowStatusLabel('rejected') },
];

export const OFFICIAL_FORM_STATUS_OPTIONS: Array<{ value: 'approved' | 'official'; label: string }> = [
  { value: 'approved', label: 'Đã duyệt (chưa chốt)' },
  { value: 'official', label: 'Chính thức (tuần đã chốt)' },
];
