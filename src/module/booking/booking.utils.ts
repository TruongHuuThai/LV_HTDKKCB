// src/modules/booking/booking.utils.ts
export function parseDateOnly(yyyy_mm_dd: string): Date {
  // tránh lệch ngày do timezone, map về UTC midnight
  return new Date(`${yyyy_mm_dd}T00:00:00.000Z`);
}

export function combineDateAndTime(dateOnly: Date, time: Date): Date {
  const d = new Date(dateOnly);
  d.setUTCHours(
    time.getUTCHours(),
    time.getUTCMinutes(),
    time.getUTCSeconds(),
    0,
  );
  return d;
}
