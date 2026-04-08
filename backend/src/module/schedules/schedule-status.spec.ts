import {
  isScheduleVisibleForBooking,
  normalizeShiftStatus,
  normalizeWeekStatus,
  SHIFT_STATUS_VALUES,
  SHIFT_STATUS,
  WEEK_STATUS_VALUES,
  WEEK_STATUS,
} from './schedule-status';

describe('schedule-status', () => {
  it('keeps status values unique', () => {
    expect(new Set(WEEK_STATUS_VALUES).size).toBe(WEEK_STATUS_VALUES.length);
    expect(new Set(SHIFT_STATUS_VALUES).size).toBe(SHIFT_STATUS_VALUES.length);
  });

  it('normalizes known shift and week statuses', () => {
    expect(normalizeShiftStatus('finalized')).toBe(SHIFT_STATUS.finalized);
    expect(normalizeShiftStatus('OFFICIAL')).toBe(SHIFT_STATUS.confirmed);
    expect(normalizeWeekStatus('slot_opened')).toBe(WEEK_STATUS.slot_opened);
    expect(normalizeWeekStatus('unknown')).toBe(WEEK_STATUS.generated);
  });

  it('applies booking visibility rule exactly', () => {
    expect(
      isScheduleVisibleForBooking({
        shiftStatus: SHIFT_STATUS.finalized,
        weekStatus: WEEK_STATUS.slot_opened,
        isArchived: false,
      }),
    ).toBe(true);

    expect(
      isScheduleVisibleForBooking({
        shiftStatus: SHIFT_STATUS.generated,
        weekStatus: WEEK_STATUS.slot_opened,
        isArchived: false,
      }),
    ).toBe(false);

    expect(
      isScheduleVisibleForBooking({
        shiftStatus: SHIFT_STATUS.finalized,
        weekStatus: WEEK_STATUS.finalized,
        isArchived: false,
      }),
    ).toBe(false);

    expect(
      isScheduleVisibleForBooking({
        shiftStatus: SHIFT_STATUS.finalized,
        weekStatus: WEEK_STATUS.slot_opened,
        isArchived: true,
      }),
    ).toBe(false);
  });
});
