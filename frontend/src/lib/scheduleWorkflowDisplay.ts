import type {
  ExceptionRequestStatus,
  ExceptionRequestType,
  TemplateStatus,
  WeekWorkflowStatus,
  WeeklyScheduleSource,
  WeeklyScheduleStatus,
} from '@/services/api/scheduleWorkflowApi';

export function getTemplateStatusLabel(status: TemplateStatus) {
  return status === 'active' ? 'Đang hoạt động' : 'Đã dừng';
}

export function getTemplateStatusBadgeClass(status: TemplateStatus) {
  return status === 'active'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-slate-100 text-slate-700 border-slate-200';
}

const WEEK_WORKFLOW_STATUS_LABELS: Record<WeekWorkflowStatus, string> = {
  generated: 'Đã sinh lịch',
  finalized: 'Đã chốt',
  slot_opened: 'Đã mở slot',
  closed: 'Đã đóng',
};

const WEEK_WORKFLOW_STATUS_BADGE_CLASSES: Record<WeekWorkflowStatus, string> = {
  generated: 'bg-amber-50 text-amber-700 border-amber-200',
  finalized: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  slot_opened: 'bg-blue-50 text-blue-700 border-blue-200',
  closed: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function getWeekWorkflowStatusLabel(status: WeekWorkflowStatus) {
  return WEEK_WORKFLOW_STATUS_LABELS[status];
}

export function getWeekWorkflowStatusBadgeClass(status: WeekWorkflowStatus) {
  return WEEK_WORKFLOW_STATUS_BADGE_CLASSES[status];
}

const WEEKLY_SCHEDULE_STATUS_LABELS: Record<WeeklyScheduleStatus, string> = {
  generated: 'Đã sinh',
  confirmed: 'Đã xác nhận',
  change_requested: 'Cần điều chỉnh',
  adjusted: 'Đã điều chỉnh',
  finalized: 'Chính thức',
  cancelled: 'Đã hủy',
  vacant_by_leave: 'Chờ thay thế',
  cancelled_by_doctor_leave: 'Đã hủy do bác sĩ nghỉ',
};

const WEEKLY_SCHEDULE_STATUS_BADGE_CLASSES: Record<WeeklyScheduleStatus, string> = {
  generated: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  change_requested: 'bg-orange-50 text-orange-700 border-orange-200',
  adjusted: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  finalized: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  vacant_by_leave: 'bg-orange-50 text-orange-700 border-orange-200',
  cancelled_by_doctor_leave: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function getWeeklyScheduleStatusLabel(status: WeeklyScheduleStatus) {
  return WEEKLY_SCHEDULE_STATUS_LABELS[status];
}

export function getWeeklyScheduleStatusBadgeClass(status: WeeklyScheduleStatus) {
  return WEEKLY_SCHEDULE_STATUS_BADGE_CLASSES[status];
}

const WEEKLY_SCHEDULE_SOURCE_LABELS: Record<WeeklyScheduleSource, string> = {
  template: 'Tuần mẫu',
  admin_manual: 'Điều chỉnh tay',
  auto_rolling: 'Tự sinh rolling',
  copied_1_month: 'Sao chép 1 tháng',
  copied_2_months: 'Sao chép 2 tháng',
  copied_3_months: 'Sao chép 3 tháng',
  legacy_registration: 'Dữ liệu cũ',
};

export function getWeeklyScheduleSourceLabel(source: WeeklyScheduleSource) {
  return WEEKLY_SCHEDULE_SOURCE_LABELS[source];
}

const EXCEPTION_TYPE_LABELS: Record<ExceptionRequestType, string> = {
  leave: 'Xin nghỉ',
  shift_change: 'Đổi ca',
  room_change: 'Đổi phòng',
  other: 'Khác',
};

export function getExceptionTypeLabel(type: ExceptionRequestType) {
  return EXCEPTION_TYPE_LABELS[type];
}

const EXCEPTION_STATUS_LABELS: Record<ExceptionRequestStatus, string> = {
  pending: 'Chờ xử lý',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

export function getExceptionStatusLabel(status: ExceptionRequestStatus) {
  return EXCEPTION_STATUS_LABELS[status];
}

const EXCEPTION_STATUS_BADGE_CLASSES: Record<ExceptionRequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function getExceptionStatusBadgeClass(status: ExceptionRequestStatus) {
  return EXCEPTION_STATUS_BADGE_CLASSES[status];
}
