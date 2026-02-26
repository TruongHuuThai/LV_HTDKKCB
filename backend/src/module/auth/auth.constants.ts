// src/modules/auth/auth.constants.ts
export const ROLE = {
  ADMIN: 'ADMIN',
  BAC_SI: 'BAC_SI',
  BENH_NHAN: 'BENH_NHAN',
} as const;

export type RoleValue = (typeof ROLE)[keyof typeof ROLE];
