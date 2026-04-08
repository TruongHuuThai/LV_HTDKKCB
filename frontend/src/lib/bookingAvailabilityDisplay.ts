import {
  BOOKING_AVAILABILITY_REASON,
  type BookingAvailabilityReasonCode,
} from '@/contracts/scheduleStatusContract';

export const BOOKING_REASON_PRIORITY = [
  BOOKING_AVAILABILITY_REASON.NO_DOCTOR_IN_SPECIALTY,
  BOOKING_AVAILABILITY_REASON.NO_SHIFT_ON_DATE,
  BOOKING_AVAILABILITY_REASON.WEEK_NOT_SLOT_OPENED,
  BOOKING_AVAILABILITY_REASON.SHIFT_NOT_FINALIZED,
  BOOKING_AVAILABILITY_REASON.SHIFT_ARCHIVED,
  BOOKING_AVAILABILITY_REASON.NO_BOOKABLE_SLOT,
  BOOKING_AVAILABILITY_REASON.DOCTOR_DELETED,
] as const satisfies readonly BookingAvailabilityReasonCode[];

type MissingPriorityReason = Exclude<
  BookingAvailabilityReasonCode,
  (typeof BOOKING_REASON_PRIORITY)[number]
>;
const _BOOKING_REASON_PRIORITY_EXHAUSTIVE: MissingPriorityReason extends never ? true : never =
  true;

export const BOOKING_REASON_LABELS: Record<BookingAvailabilityReasonCode, string> = {
  NO_DOCTOR_IN_SPECIALTY: 'Chuyên khoa đang chọn chưa có bác sĩ hoạt động.',
  NO_SHIFT_ON_DATE: 'Ngày này chưa có lịch trực.',
  WEEK_NOT_SLOT_OPENED: 'Tuần này chưa mở slot đặt lịch.',
  SHIFT_NOT_FINALIZED: 'Lịch trực ngày này chưa được chốt.',
  SHIFT_ARCHIVED: 'Lịch trực đã được lưu trữ.',
  NO_BOOKABLE_SLOT: 'Không còn khung giờ có thể đặt.',
  DOCTOR_DELETED: 'Một số bác sĩ không còn hoạt động.',
};

export function pickTopBookingReason(
  reasons: BookingAvailabilityReasonCode[] | null | undefined,
): BookingAvailabilityReasonCode | null {
  if (!reasons || reasons.length === 0) return null;
  const set = new Set(reasons);
  return BOOKING_REASON_PRIORITY.find((reason) => set.has(reason)) ?? reasons[0];
}
