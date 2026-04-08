import { BOOKING_AVAILABILITY_REASON } from './booking-availability.contract';
import { SHIFT_STATUS, WEEK_STATUS } from '../schedules/schedule-status';
import {
  evaluateShiftAvailability,
  summarizeDoctorReasons,
} from './booking-availability.util';

describe('booking-availability.util', () => {
  it('returns available when shift finalized + week slot_opened + non-archived + has slots', () => {
    const result = evaluateShiftAvailability({
      shiftStatus: SHIFT_STATUS.finalized,
      weekStatus: WEEK_STATUS.slot_opened,
      isArchived: false,
      bookableSlots: 2,
    });
    expect(result.available).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('returns expected reasons for generated/finalized-week but no slot opened and no bookable slot', () => {
    const result = evaluateShiftAvailability({
      shiftStatus: SHIFT_STATUS.generated,
      weekStatus: WEEK_STATUS.finalized,
      isArchived: false,
      bookableSlots: 0,
    });
    expect(result.available).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        BOOKING_AVAILABILITY_REASON.SHIFT_NOT_FINALIZED,
        BOOKING_AVAILABILITY_REASON.WEEK_NOT_SLOT_OPENED,
        BOOKING_AVAILABILITY_REASON.NO_BOOKABLE_SLOT,
      ]),
    );
  });

  it('returns archived reason when shift is archived', () => {
    const result = evaluateShiftAvailability({
      shiftStatus: SHIFT_STATUS.finalized,
      weekStatus: WEEK_STATUS.slot_opened,
      isArchived: true,
      bookableSlots: 2,
    });
    expect(result.available).toBe(false);
    expect(result.reasons).toContain(BOOKING_AVAILABILITY_REASON.SHIFT_ARCHIVED);
  });

  it('summarizes no-shift reason when doctor has no shifts on date', () => {
    const reasons = summarizeDoctorReasons({
      shiftsCount: 0,
      shiftReasons: [],
    });
    expect(reasons).toEqual([BOOKING_AVAILABILITY_REASON.NO_SHIFT_ON_DATE]);
  });
});
