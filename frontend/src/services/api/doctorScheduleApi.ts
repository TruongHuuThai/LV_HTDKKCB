import axiosClient from './axiosClient';
import type {
  OfficialShiftFormContextResponse,
  ScheduleCycleOverview,
  ScheduleOfficialShiftsResponse,
  ScheduleRegistrationsResponse,
} from './adminApi';

export interface DoctorScheduleOwner {
  BS_MA: number;
  BS_HO_TEN: string;
  CK_MA: number;
  CHUYEN_KHOA: {
    CK_TEN: string;
  };
}

export interface DoctorScheduleCycleOverview extends ScheduleCycleOverview {
  doctor: DoctorScheduleOwner;
  canRegister: boolean;
  canManageRegistrations: boolean;
}

export interface DoctorScheduleRegistrationOptions {
  weekStartDate: string;
  weekEndDate: string;
  doctor: DoctorScheduleOwner;
  rooms: Array<{
    P_MA: number;
    P_TEN: string;
    CK_MA: number;
    CHUYEN_KHOA: {
      CK_TEN: string;
    };
  }>;
  sessions: Array<{
    B_TEN: string;
    B_GIO_BAT_DAU: string | null;
    B_GIO_KET_THUC: string | null;
  }>;
  allowedDates: Array<{
    date: string;
    weekday: number;
  }>;
}

export interface DoctorScheduleRegistrationInput {
  N_NGAY: string;
  B_TEN: string;
  P_MA: number;
  LBSK_GHI_CHU?: string;
}

export const doctorScheduleApi = {
  getRegistrationCycle: async (): Promise<DoctorScheduleCycleOverview> => {
    const res = await axiosClient.get<DoctorScheduleCycleOverview>(
      '/schedules/registration-cycle',
    );
    return res.data;
  },

  getRegistrationOptions: async (): Promise<DoctorScheduleRegistrationOptions> => {
    const res = await axiosClient.get<DoctorScheduleRegistrationOptions>(
      '/schedules/registration-options',
    );
    return res.data;
  },

  getMyRegistrations: async (weekStart?: string): Promise<ScheduleRegistrationsResponse> => {
    const res = await axiosClient.get<ScheduleRegistrationsResponse>(
      '/schedules/my-registrations',
      { params: { weekStart } },
    );
    return res.data;
  },

  getMyOfficialShifts: async (
    weekStart?: string,
  ): Promise<ScheduleOfficialShiftsResponse> => {
    const res = await axiosClient.get<ScheduleOfficialShiftsResponse>(
      '/schedules/my-official-shifts',
      { params: { weekStart } },
    );
    return res.data;
  },

  getDayContext: async (params: {
    date: string;
    roomId?: number;
    excludeDate?: string;
    excludeSession?: string;
  }): Promise<OfficialShiftFormContextResponse> => {
    const res = await axiosClient.get<OfficialShiftFormContextResponse>(
      '/schedules/day-context',
      { params },
    );
    return res.data;
  },

  createRegistration: async (data: DoctorScheduleRegistrationInput) => {
    const res = await axiosClient.post('/schedules/registrations', data);
    return res.data;
  },

  updateRegistration: async (
    date: string,
    session: string,
    data: DoctorScheduleRegistrationInput,
  ) => {
    const res = await axiosClient.put(
      `/schedules/registrations/${encodeURIComponent(date)}/${encodeURIComponent(session)}`,
      data,
    );
    return res.data;
  },

  cancelRegistration: async (date: string, session: string) => {
    const res = await axiosClient.delete(
      `/schedules/registrations/${encodeURIComponent(date)}/${encodeURIComponent(session)}`,
    );
    return res.data;
  },
};
