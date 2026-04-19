import { BadRequestException } from '@nestjs/common';

export const APPOINTMENT_STATUS = {
  CHO_THANH_TOAN: 'CHO_THANH_TOAN',
  CHO_KHAM: 'CHO_KHAM',
  DA_CHECKIN: 'DA_CHECKIN',
  DA_KHAM: 'DA_KHAM',
  HOAN_TAT: 'HOAN_TAT',
  HUY: 'HUY',
  HUY_BS_NGHI: 'HUY_BS_NGHI',
  NO_SHOW: 'NO_SHOW',
} as const;

export type AppointmentStatusValue =
  (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS];

const TRANSITIONS: Record<string, string[]> = {
  [APPOINTMENT_STATUS.CHO_THANH_TOAN]: [APPOINTMENT_STATUS.CHO_KHAM],
  [APPOINTMENT_STATUS.CHO_KHAM]: [
    APPOINTMENT_STATUS.DA_CHECKIN,
    APPOINTMENT_STATUS.NO_SHOW,
  ],
  [APPOINTMENT_STATUS.DA_CHECKIN]: [
    APPOINTMENT_STATUS.DA_KHAM,
    APPOINTMENT_STATUS.NO_SHOW,
  ],
  [APPOINTMENT_STATUS.DA_KHAM]: [APPOINTMENT_STATUS.HOAN_TAT],
};

export function canTransitionAppointmentStatus(from: string, to: string) {
  const allowed = TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function assertValidAppointmentStatusTransition(from: string, to: string) {
  if (!canTransitionAppointmentStatus(from, to)) {
    throw new BadRequestException(
      `Khong the chuyen trang thai tu ${from} sang ${to}`,
    );
  }
}

export function isAppointmentTerminalStatus(status?: string | null) {
  if (!status) return false;
  return ([
    APPOINTMENT_STATUS.HUY,
    APPOINTMENT_STATUS.HUY_BS_NGHI,
    APPOINTMENT_STATUS.DA_KHAM,
    APPOINTMENT_STATUS.HOAN_TAT,
    APPOINTMENT_STATUS.NO_SHOW,
  ] as string[]).includes(status);
}
