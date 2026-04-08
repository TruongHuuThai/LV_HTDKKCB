import { SCHEDULE_STATUS_CONTRACT_VERSION } from '../schedules/schedule-status';

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

export type BookingAvailabilityDebugShift = {
  session: string;
  shiftStatus: string | null;
  weekStatus: string | null;
  isArchived: boolean;
  totalSlots: number;
  bookableSlots: number;
  reasons: BookingAvailabilityReasonCode[];
};

export type BookingAvailabilityDebugDoctor = {
  doctorId: number;
  doctorName: string;
  specialtyId: number;
  specialtyName: string | null;
  available: boolean;
  reasons: BookingAvailabilityReasonCode[];
  shifts: BookingAvailabilityDebugShift[];
};

export type BookingAvailabilityDebugResponse = {
  contractVersion: typeof SCHEDULE_STATUS_CONTRACT_VERSION;
  input: {
    date: string;
    specialtyId: number | null;
  };
  summary: {
    candidateDoctors: number;
    availableDoctors: number;
    reasonCounts: Array<{ reason: BookingAvailabilityReasonCode; count: number }>;
    reasons: BookingAvailabilityReasonCode[];
  };
  doctors: BookingAvailabilityDebugDoctor[];
};
