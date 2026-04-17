export const CLINIC_PROFILE = {
  name: 'Can Tho University Medical Center',
  address: 'Khu II, Duong 3 Thang 2, Xuan Khanh, Ninh Kieu, Can Tho, Vietnam',
  hotline: '0867504590',
  workingHours: {
    morning: '07:30 - 11:30',
    afternoon: '13:00 - 16:30',
  },
  cancellationPolicyHours: 1,
  paymentMethods: ['QR_BANKING'],
  mandatorySafetyNotice:
    'day chi la goi y tu he thong, khong thay the duoc tu van tu bac si',
} as const;

export type ClinicProfile = typeof CLINIC_PROFILE;
