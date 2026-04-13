import axiosClient from './axiosClient';
import type {
  BookingAvailabilityReasonCode,
  ScheduleStatusContractVersion,
} from '@/contracts/scheduleStatusContract';

export interface BookingDoctor {
  BS_MA: number;
  BS_HO_TEN: string;
  BS_HOC_HAM: string | null;
  BS_ANH: string | null;
  CHUYEN_KHOA: string | null;
  CHUYEN_KHOA_MO_TA: string | null;
  CHUYEN_KHOA_DOI_TUONG_KHAM: string | null;
  CK_MA: number;
}

export type DoctorCatalogSortBy = 'name' | 'specialty' | 'degree';
export type DoctorCatalogSortDirection = 'asc' | 'desc';

export interface BookingDoctorCatalogResponse {
  items: BookingDoctor[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: {
    specialties: Array<{
      CK_MA: number;
      CK_TEN: string;
    }>;
    degrees: string[];
    genderSupported: boolean;
  };
}

export interface DoctorSlotSession {
  B_TEN: string;
  PHONG: string | null;
  slots: Array<{
    KG_MA: number;
    KG_BAT_DAU: string;
    KG_KET_THUC: string;
    available: boolean;
    availabilityStatus?: 'available' | 'full' | 'past' | 'already_booked';
    alreadyBookedByProfile?: boolean;
    existingBookingId?: number | null;
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
  hasBHYT?: boolean;
  bhytType?: string;
  hasPrivateInsurance?: boolean;
  privateInsuranceProvider?: string;
  paymentMethod?: string;
}

export interface BookingServiceTypeOption {
  LHK_MA: number;
  CK_MA: number;
  LHK_TEN: string;
  LHK_GIA: number | string;
  LHK_MO_TA?: string | null;
}

export interface BhyTypeOption {
  id: string;
  label: string;
  description?: string | null;
}

export interface PrivateInsuranceProviderOption {
  id: string;
  name: string;
}

export interface BookingAvailabilityDebugShift {
  session: string;
  shiftStatus: string | null;
  weekStatus: string | null;
  isArchived: boolean;
  totalSlots: number;
  bookableSlots: number;
  reasons: BookingAvailabilityReasonCode[];
}

export interface BookingAvailabilityDebugDoctor {
  doctorId: number;
  doctorName: string;
  specialtyId: number;
  specialtyName: string | null;
  available: boolean;
  reasons: BookingAvailabilityReasonCode[];
  shifts: BookingAvailabilityDebugShift[];
}

export interface BookingAvailabilityDebugResponse {
  contractVersion: ScheduleStatusContractVersion;
  input: { date: string; specialtyId: number | null };
  summary: {
    candidateDoctors: number;
    availableDoctors: number;
    reasonCounts: Array<{ reason: BookingAvailabilityReasonCode; count: number }>;
    reasons: BookingAvailabilityReasonCode[];
  };
  doctors: BookingAvailabilityDebugDoctor[];
}

export interface DoctorBookableDatesResponse {
  availableDates: string[];
  fullDates: string[];
}

export const bookingApi = {
  getAvailableDoctors: async (params?: {
    date?: string;
    specialtyId?: number;
    q?: string;
  }) => {
    const res = await axiosClient.get<BookingDoctor[]>('/booking/doctors', {
      params,
    });
    return res.data;
  },

  getDoctorSlotsForDay: async (doctorId: number, date: string, profileId?: number) => {
    const res = await axiosClient.get<DoctorSlotSession[]>(
      `/booking/doctors/${doctorId}/slots`,
      {
        params: {
          date,
          ...(profileId ? { BN_MA: profileId } : {}),
        },
      },
    );
    return res.data;
  },

  getDoctorBookableDates: async (
    doctorId: number,
    params?: {
      from?: string;
      to?: string;
    },
  ) => {
    const res = await axiosClient.get<DoctorBookableDatesResponse>(
      `/booking/doctors/${doctorId}/bookable-dates`,
      {
        params,
      },
    );
    return res.data;
  },

  getDoctorCatalog: async (params?: {
    q?: string;
    specialtyId?: number;
    degree?: string;
    gender?: string;
    sortBy?: DoctorCatalogSortBy;
    sortDirection?: DoctorCatalogSortDirection;
    page?: number;
    pageSize?: number;
  }) => {
    const res = await axiosClient.get<BookingDoctorCatalogResponse>('/booking/doctor-catalog', {
      params,
    });
    return res.data;
  },

  getAvailabilityDebug: async (params: { date: string; specialtyId?: number; q?: string }) => {
    const res = await axiosClient.get<BookingAvailabilityDebugResponse>(
      '/booking/debug-availability',
      { params },
    );
    return res.data;
  },

  createBooking: async (data: CreateBookingInput) => {
    const res = await axiosClient.post('/booking', data);
    return res.data as {
      booking: { DK_MA: number };
      payment?: { TT_MA?: number; TT_TRANG_THAI?: string };
      payment_url?: string;
    };
  },

  getServiceTypesBySpecialty: async (specialtyId: number) => {
    const res = await axiosClient.get<{ items: BookingServiceTypeOption[] }>('/booking/service-types', {
      params: { specialtyId },
    });
    return res.data.items;
  },

  getBHYTTypes: async (params: { profileId?: number; specialtyId?: number }) => {
    const res = await axiosClient.get<{ items: BhyTypeOption[] }>('/booking/insurance/bhyt-types', {
      params,
    });
    return res.data.items;
  },

  getPrivateInsuranceProviders: async (q?: string) => {
    const res = await axiosClient.get<{ items: PrivateInsuranceProviderOption[] }>(
      '/booking/insurance/private-providers',
      {
        params: q ? { q } : undefined,
      },
    );
    return res.data.items;
  },
};
