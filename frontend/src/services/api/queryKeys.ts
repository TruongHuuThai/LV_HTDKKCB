export const queryKeys = {
  booking: {
    doctors: (specialtyId: string, date: string) => ['booking-doctors', specialtyId, date] as const,
    slots: (doctorId: number | null, date: string) => ['booking-slots', doctorId, date] as const,
  },
  patientProfiles: {
    mine: ['patient-profiles'] as const,
  },
  appointments: {
    my: (params: unknown) => ['appointments-my', params] as const,
    detail: (appointmentId: number) => ['appointment-detail', appointmentId] as const,
    paymentStatus: (appointmentId: number) => ['appointment-payment-status', appointmentId] as const,
    cancelPolicy: (appointmentId: number) => ['appointment-cancel-policy', appointmentId] as const,
  },
} as const;
