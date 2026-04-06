export type AppointmentStatusGroup =
  | 'upcoming'
  | 'completed'
  | 'canceled'
  | 'no_show';

export function mapAppointmentStatusToGroup(status?: string | null): AppointmentStatusGroup {
  const value = (status || '').toUpperCase();
  if (value === 'DA_KHAM') return 'completed';
  if (value === 'NO_SHOW') return 'no_show';
  if (value === 'HUY' || value === 'HUY_BS_NGHI') return 'canceled';
  return 'upcoming';
}
