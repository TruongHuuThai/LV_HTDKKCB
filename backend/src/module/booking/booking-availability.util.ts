import {
  isScheduleVisibleForBooking,
  SHIFT_STATUS,
  WEEK_STATUS,
} from '../schedules/schedule-status';
import {
  BOOKING_AVAILABILITY_REASON,
  type BookingAvailabilityReasonCode,
} from './booking-availability.contract';

export function evaluateShiftAvailability(input: {
  shiftStatus?: string | null;
  weekStatus?: string | null;
  isArchived?: boolean | null;
  bookableSlots: number;
}) {
  const reasons: BookingAvailabilityReasonCode[] = [];

  if (input.isArchived === true) {
    reasons.push(BOOKING_AVAILABILITY_REASON.SHIFT_ARCHIVED);
  }
  if (!isScheduleVisibleForBooking(input)) {
    if (String(input.shiftStatus ?? '').trim().toLowerCase() !== SHIFT_STATUS.finalized) {
      reasons.push(BOOKING_AVAILABILITY_REASON.SHIFT_NOT_FINALIZED);
    }
    if (String(input.weekStatus ?? '').trim().toLowerCase() !== WEEK_STATUS.slot_opened) {
      reasons.push(BOOKING_AVAILABILITY_REASON.WEEK_NOT_SLOT_OPENED);
    }
  }
  if (input.bookableSlots <= 0) {
    reasons.push(BOOKING_AVAILABILITY_REASON.NO_BOOKABLE_SLOT);
  }

  return {
    available: reasons.length === 0,
    reasons: Array.from(new Set(reasons)),
  };
}

export function summarizeDoctorReasons(params: {
  doctorDeleted?: boolean;
  shiftsCount: number;
  shiftReasons: BookingAvailabilityReasonCode[][];
}) {
  if (params.doctorDeleted) {
    return [BOOKING_AVAILABILITY_REASON.DOCTOR_DELETED];
  }
  if (params.shiftsCount === 0) {
    return [BOOKING_AVAILABILITY_REASON.NO_SHIFT_ON_DATE];
  }
  const merged = new Set<BookingAvailabilityReasonCode>();
  params.shiftReasons.forEach((reasons) => {
    reasons.forEach((reason) => merged.add(reason));
  });
  return Array.from(merged);
}
