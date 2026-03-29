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

export function getWeekWorkflowStatusLabel(status: WeekWorkflowStatus) {
  if (status === 'slot_opened') return 'Đã mở slot';
  if (status === 'finalized') return 'Đã chốt';
  return 'Đã sinh lịch';
}

export function getWeekWorkflowStatusBadgeClass(status: WeekWorkflowStatus) {
  if (status === 'slot_opened') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'finalized') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export function getWeeklyScheduleStatusLabel(status: WeeklyScheduleStatus) {
  switch (status) {
    case 'generated':
      return 'Đã sinh';
    case 'confirmed':
      return 'Đã xác nhận';
    case 'change_requested':
      return 'Cần điều chỉnh';
    case 'adjusted':
      return 'Đã điều chỉnh';
    case 'finalized':
      return 'Chính thức';
    case 'cancelled':
      return 'Đã hủy';
    case 'vacant_by_leave':
      return 'Chờ thay thế';
    case 'cancelled_by_doctor_leave':
      return 'Đã hủy do bác sĩ nghỉ';
    default:
      return status;
  }
}

export function getWeeklyScheduleStatusBadgeClass(status: WeeklyScheduleStatus) {
  switch (status) {
    case 'generated':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'change_requested':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'adjusted':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'finalized':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'vacant_by_leave':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'cancelled_by_doctor_leave':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function getWeeklyScheduleSourceLabel(source: WeeklyScheduleSource) {
  switch (source) {
    case 'template':
      return 'Tuần mẫu';
    case 'admin_manual':
      return 'Điều chỉnh tay';
    case 'auto_rolling':
      return 'Tự sinh rolling';
    case 'copied_1_month':
      return 'Sao chép 1 tháng';
    case 'copied_2_months':
      return 'Sao chép 2 tháng';
    case 'copied_3_months':
      return 'Sao chép 3 tháng';
    case 'legacy_registration':
      return 'Dữ liệu cũ';
    default:
      return source;
  }
}

export function getExceptionTypeLabel(type: ExceptionRequestType) {
  switch (type) {
    case 'leave':
      return 'Xin nghỉ';
    case 'shift_change':
      return 'Đổi ca';
    case 'room_change':
      return 'Đổi phòng';
    case 'other':
      return 'Khác';
    default:
      return type;
  }
}

export function getExceptionStatusLabel(status: ExceptionRequestStatus) {
  switch (status) {
    case 'pending':
      return 'Chờ xử lý';
    case 'approved':
      return 'Đã duyệt';
    case 'rejected':
      return 'Từ chối';
    default:
      return status;
  }
}

export function getExceptionStatusBadgeClass(status: ExceptionRequestStatus) {
  switch (status) {
    case 'pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'approved':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'rejected':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}
