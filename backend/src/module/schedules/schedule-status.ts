export const SCHEDULE_STATUS_CONTRACT_VERSION = '2026-04-09.v2' as const;

/**
 * Week workflow status:
 * - generated: Week data exists but is not ready for patient booking.
 * - finalized: Week planning is finalized by admin workflow.
 * - slot_opened: Week is opened for booking visibility.
 * - closed: Week is closed and should not accept new booking visibility.
 */
export const WEEK_STATUS = {
  generated: 'generated',
  finalized: 'finalized',
  slot_opened: 'slot_opened',
  closed: 'closed',
} as const;

/**
 * Shift status:
 * - generated: Auto-generated draft shift.
 * - confirmed: Confirmed by doctor/admin but not final official shift.
 * - adjusted: Shift was adjusted after a change request.
 * - finalized: Official shift that can be used for booking visibility.
 * - cancelled: Shift is cancelled and not bookable.
 * - vacant_by_leave: Shift is left vacant due to leave request.
 * - cancelled_by_doctor_leave: Shift cancelled after leave approval with impact.
 */
export const SHIFT_STATUS = {
  generated: 'generated',
  confirmed: 'confirmed',
  change_requested: 'change_requested',
  adjusted: 'adjusted',
  finalized: 'finalized',
  cancelled: 'cancelled',
  vacant_by_leave: 'vacant_by_leave',
  cancelled_by_doctor_leave: 'cancelled_by_doctor_leave',
} as const;

export type WeekStatus = (typeof WEEK_STATUS)[keyof typeof WEEK_STATUS];
export type ShiftStatus = (typeof SHIFT_STATUS)[keyof typeof SHIFT_STATUS];

export const WEEK_STATUS_VALUES = Object.values(WEEK_STATUS) as WeekStatus[];
export const SHIFT_STATUS_VALUES = Object.values(SHIFT_STATUS) as ShiftStatus[];

export const BOOKING_VISIBLE_WEEK_STATUSES: ReadonlySet<WeekStatus> = new Set([
  WEEK_STATUS.slot_opened,
]);

export const BOOKING_VISIBLE_SHIFT_STATUSES: ReadonlySet<ShiftStatus> = new Set([
  SHIFT_STATUS.finalized,
]);

export function normalizeWeekStatus(value?: string | null): WeekStatus {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === WEEK_STATUS.finalized) return WEEK_STATUS.finalized;
  if (normalized === WEEK_STATUS.slot_opened) return WEEK_STATUS.slot_opened;
  if (normalized === WEEK_STATUS.closed) return WEEK_STATUS.closed;
  return WEEK_STATUS.generated;
}

export function normalizeShiftStatus(value?: string | null): ShiftStatus {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (normalized === SHIFT_STATUS.confirmed) return SHIFT_STATUS.confirmed;
  if (normalized === SHIFT_STATUS.change_requested) return SHIFT_STATUS.change_requested;
  if (normalized === SHIFT_STATUS.adjusted) return SHIFT_STATUS.adjusted;
  if (normalized === SHIFT_STATUS.finalized) return SHIFT_STATUS.finalized;
  if (normalized === SHIFT_STATUS.vacant_by_leave) return SHIFT_STATUS.vacant_by_leave;
  if (normalized === SHIFT_STATUS.cancelled_by_doctor_leave)
    return SHIFT_STATUS.cancelled_by_doctor_leave;
  if (normalized === SHIFT_STATUS.cancelled) return SHIFT_STATUS.cancelled;
  if (normalized === 'approved' || normalized === 'official') return SHIFT_STATUS.confirmed;
  if (normalized === 'rejected') return SHIFT_STATUS.cancelled;
  return SHIFT_STATUS.generated;
}

export function isWeekOpenForBooking(value?: string | null) {
  return BOOKING_VISIBLE_WEEK_STATUSES.has(normalizeWeekStatus(value));
}

export function isShiftVisibleForBooking(value?: string | null) {
  return BOOKING_VISIBLE_SHIFT_STATUSES.has(normalizeShiftStatus(value));
}

export function isScheduleVisibleForBooking(input: {
  shiftStatus?: string | null;
  weekStatus?: string | null;
  isArchived?: boolean | null;
}) {
  return (
    isShiftVisibleForBooking(input.shiftStatus) &&
    isWeekOpenForBooking(input.weekStatus) &&
    input.isArchived !== true
  );
}
