import axiosClient from './axiosClient';
import { downloadPdf } from './pdfApi';

export interface DoctorWorklistQuery {
  date?: string;
  shift?: string;
  status?: string;
  roomId?: number;
  page?: number;
  limit?: number;
}

export interface DoctorWorklistItem {
  DK_MA: number;
  BN_MA: number;
  patientName: string;
  patientDob: string | null;
  patientPhone: string | null;
  N_NGAY: string;
  B_TEN: string;
  KG_MA: number;
  KG_BAT_DAU: string | null;
  KG_KET_THUC: string | null;
  DK_TRANG_THAI: string;
  note: string | null;
  preVisitSymptoms: string | null;
  preVisitNote: string | null;
  paymentStatus: string;
  roomId: number | null;
  roomName: string | null;
}

export interface DoctorWorklistResponse {
  items: DoctorWorklistItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DoctorPreVisitInfoResponse {
  appointmentId: number;
  patientId: number;
  doctorId: number;
  symptoms: string | null;
  note: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const doctorAppointmentsApi = {
  getWorklist: async (params: DoctorWorklistQuery): Promise<DoctorWorklistResponse> => {
    const normalizedLimit =
      typeof params.limit === 'number'
        ? Math.min(100, Math.max(1, Math.trunc(params.limit)))
        : undefined;
    const res = await axiosClient.get<DoctorWorklistResponse>('/doctor/appointments/worklist', {
      params: {
        ...params,
        limit: normalizedLimit,
      },
    });
    return res.data;
  },

  getPreVisitInfo: async (appointmentId: number): Promise<DoctorPreVisitInfoResponse> => {
    const res = await axiosClient.get<DoctorPreVisitInfoResponse>(
      `/doctor/appointments/${appointmentId}/pre-visit-info`,
    );
    return res.data;
  },

  exportWorklistPdf: async (params: DoctorWorklistQuery) => {
    await downloadPdf('/doctor/appointments/worklist/pdf', {
      params: params as Record<string, string | number | boolean | undefined>,
      fallbackFilename: 'doctor-worklist.pdf',
    });
  },
};
