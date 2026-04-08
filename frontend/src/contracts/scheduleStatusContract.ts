export const SCHEDULE_STATUS_CONTRACT_VERSION = '2026-04-09.v2' as const;
export type ScheduleStatusContractVersion = typeof SCHEDULE_STATUS_CONTRACT_VERSION;

export const WEEK_STATUS = {
  generated: 'generated',
  finalized: 'finalized',
  slot_opened: 'slot_opened',
  closed: 'closed',
} as const;

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

export const BOOKING_AVAILABILITY_REASON = {
  NO_DOCTOR_IN_SPECIALTY: 'NO_DOCTOR_IN_SPECIALTY',
  NO_SHIFT_ON_DATE: 'NO_SHIFT_ON_DATE',
  SHIFT_ARCHIVED: 'SHIFT_ARCHIVED',
  SHIFT_NOT_FINALIZED: 'SHIFT_NOT_FINALIZED',
  WEEK_NOT_SLOT_OPENED: 'WEEK_NOT_SLOT_OPENED',
  NO_BOOKABLE_SLOT: 'NO_BOOKABLE_SLOT',
  DOCTOR_DELETED: 'DOCTOR_DELETED',
} as const;

export type BookingAvailabilityReasonCode =
  (typeof BOOKING_AVAILABILITY_REASON)[keyof typeof BOOKING_AVAILABILITY_REASON];
export const BOOKING_AVAILABILITY_REASON_VALUES = Object.values(
  BOOKING_AVAILABILITY_REASON,
) as BookingAvailabilityReasonCode[];
