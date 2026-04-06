import { mapAppointmentStatusToGroup } from './appointment-status-group.util';

describe('appointment status group mapping', () => {
  it('maps DA_KHAM to completed', () => {
    expect(mapAppointmentStatusToGroup('DA_KHAM')).toBe('completed');
  });

  it('maps HUY to canceled', () => {
    expect(mapAppointmentStatusToGroup('HUY')).toBe('canceled');
  });

  it('maps NO_SHOW to no_show', () => {
    expect(mapAppointmentStatusToGroup('NO_SHOW')).toBe('no_show');
  });

  it('maps CHO_KHAM to upcoming', () => {
    expect(mapAppointmentStatusToGroup('CHO_KHAM')).toBe('upcoming');
  });
});
