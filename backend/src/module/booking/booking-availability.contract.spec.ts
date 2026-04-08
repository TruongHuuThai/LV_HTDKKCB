import { BOOKING_AVAILABILITY_REASON, BOOKING_AVAILABILITY_REASON_VALUES } from './booking-availability.contract';

describe('booking-availability.contract', () => {
  it('keeps reason values unique and exhaustive', () => {
    const values = BOOKING_AVAILABILITY_REASON_VALUES;
    const unique = new Set(values);

    expect(values.length).toBe(unique.size);
    expect(values.sort()).toEqual(Object.values(BOOKING_AVAILABILITY_REASON).sort());
  });
});
