import axiosClient from './axiosClient';
import { downloadPdf } from './pdfApi';

export interface DoctorStatsQuery {
  fromDate?: string;
  toDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}

export interface DoctorStatsSummaryResponse {
  fromDate: string;
  toDate: string;
  totalAppointments: number;
  completedAppointments: number;
  canceledAppointments: number;
  noShowAppointments: number;
  totalCheckedIn: number;
  upcomingAppointments: number;
  todayAppointments: number;
  thisWeekAppointments: number;
  cancellationRate: number;
  noShowRate: number;
}

export interface DoctorStatsTrendItem {
  label: string;
  total: number;
  completed: number;
  canceled: number;
  noShow: number;
}

export interface DoctorStatsTrendsResponse {
  fromDate: string;
  toDate: string;
  groupBy: 'day' | 'week' | 'month';
  items: DoctorStatsTrendItem[];
}

export const doctorStatsApi = {
  getSummary: async (params?: DoctorStatsQuery) => {
    const res = await axiosClient.get<DoctorStatsSummaryResponse>('/doctor/stats/summary', {
      params,
    });
    return res.data;
  },

  getTrends: async (params?: DoctorStatsQuery) => {
    const res = await axiosClient.get<DoctorStatsTrendsResponse>('/doctor/stats/trends', {
      params,
    });
    return res.data;
  },

  downloadPdf: async (params?: DoctorStatsQuery) => {
    await downloadPdf('/doctor/stats/report.pdf', {
      params: params as Record<string, string | number | boolean | undefined> | undefined,
      fallbackFilename: 'doctor-stats-report.pdf',
    });
  },
};
