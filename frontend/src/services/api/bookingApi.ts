import axiosClient from './axiosClient';

export interface BookingDoctor {
  BS_MA: number;
  BS_HO_TEN: string;
  BS_HOC_HAM: string | null;
  BS_ANH: string | null;
  CHUYEN_KHOA: string | null;
  CK_MA: number;
}

export interface DoctorSlotSession {
  B_TEN: string;
  PHONG: string | null;
  slots: Array<{
    KG_MA: number;
    KG_BAT_DAU: string;
    KG_KET_THUC: string;
    available: boolean;
  }>;
}

export interface CreateBookingInput {
  BN_MA: number;
  BS_MA: number;
  N_NGAY: string;
  B_TEN: string;
  KG_MA: number;
  LHK_MA?: number;
  symptoms?: string;
  preVisitNote?: string;
}

export const bookingApi = {
  getAvailableDoctors: async (params?: {
    date?: string;
    specialtyId?: number;
  }) => {
    const res = await axiosClient.get<BookingDoctor[]>('/booking/doctors', {
      params,
    });
    return res.data;
  },

  getDoctorSlotsForDay: async (doctorId: number, date: string) => {
    const res = await axiosClient.get<DoctorSlotSession[]>(
      `/booking/doctors/${doctorId}/slots`,
      {
        params: { date },
      },
    );
    return res.data;
  },

  createBooking: async (data: CreateBookingInput) => {
    const res = await axiosClient.post('/booking', data);
    return res.data as {
      booking: { DK_MA: number };
      payment_url?: string;
    };
  },
};
