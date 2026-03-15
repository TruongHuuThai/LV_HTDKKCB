export const SERVICE_TYPE_VALUES = [
  'CHAN_DOAN_HINH_ANH',
  'NOI_SOI',
  'THU_THUAT',
  'XET_NGHIEM',
  'THAM_DO_CHUC_NANG',
] as const;

export type ServiceTypeValue = (typeof SERVICE_TYPE_VALUES)[number];

export const SERVICE_TYPE_SET = new Set<string>(SERVICE_TYPE_VALUES);
