import {
  APPOINTMENT_STATUS,
  canTransitionAppointmentStatus,
} from './appointments.status';

describe('appointment status transition', () => {
  it('allows CHO_KHAM -> DA_CHECKIN', () => {
    expect(
      canTransitionAppointmentStatus(
        APPOINTMENT_STATUS.CHO_KHAM,
        APPOINTMENT_STATUS.DA_CHECKIN,
      ),
    ).toBe(true);
  });

  it('allows DA_CHECKIN -> DA_KHAM', () => {
    expect(
      canTransitionAppointmentStatus(
        APPOINTMENT_STATUS.DA_CHECKIN,
        APPOINTMENT_STATUS.DA_KHAM,
      ),
    ).toBe(true);
  });

  it('allows CHO_KHAM -> NO_SHOW', () => {
    expect(
      canTransitionAppointmentStatus(
        APPOINTMENT_STATUS.CHO_KHAM,
        APPOINTMENT_STATUS.NO_SHOW,
      ),
    ).toBe(true);
  });

  it('blocks DA_KHAM -> CHO_KHAM', () => {
    expect(
      canTransitionAppointmentStatus(
        APPOINTMENT_STATUS.DA_KHAM,
        APPOINTMENT_STATUS.CHO_KHAM,
      ),
    ).toBe(false);
  });
});
