import { evaluateCancelPolicy } from './cancel-policy.util';

describe('cancel policy util', () => {
  const appointmentStart = new Date('2026-04-10T09:00:00.000Z');

  it('allows owner cancel before cutoff', () => {
    const result = evaluateCancelPolicy({
      now: new Date('2026-04-10T06:00:00.000Z'),
      appointmentStartAt: appointmentStart,
      cutoffMinutes: 120,
      appointmentStatus: 'CHO_KHAM',
      isOwner: true,
      role: 'BENH_NHAN',
    });
    expect(result.canCancel).toBe(true);
  });

  it('blocks owner cancel after cutoff', () => {
    const result = evaluateCancelPolicy({
      now: new Date('2026-04-10T08:15:00.000Z'),
      appointmentStartAt: appointmentStart,
      cutoffMinutes: 120,
      appointmentStatus: 'CHO_KHAM',
      isOwner: true,
      role: 'BENH_NHAN',
    });
    expect(result.canCancel).toBe(false);
    expect(result.reasonIfBlocked).toBe('CUTOFF_EXCEEDED');
  });

  it('blocks terminal status', () => {
    const result = evaluateCancelPolicy({
      now: new Date('2026-04-10T06:00:00.000Z'),
      appointmentStartAt: appointmentStart,
      cutoffMinutes: 120,
      appointmentStatus: 'DA_KHAM',
      isOwner: true,
      role: 'BENH_NHAN',
    });
    expect(result.canCancel).toBe(false);
    expect(result.reasonIfBlocked).toBe('INVALID_STATUS');
  });
});
