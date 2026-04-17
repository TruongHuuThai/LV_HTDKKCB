import axiosClient from './axiosClient';
import { normalizePaymentStatus, type AppointmentStatusGroup, type PaymentStatus } from '@/lib/appointments';
import { downloadPdf } from './pdfApi';

export interface AppointmentListQuery {
  statusGroup?: AppointmentStatusGroup;
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  keyword?: string;
  profileId?: number;
}

export interface AppointmentListItem {
  appointmentId: number;
  DK_MA: number;
  BN_MA?: number;
  N_NGAY: string;
  B_TEN: string;
  KG_MA: number;
  KG_BAT_DAU?: string | null;
  KG_KET_THUC?: string | null;
  profile?: { BN_MA: number; fullName?: string } | null;
  doctor?: { BS_MA: number; BS_HO_TEN: string } | null;
  specialty?: { CK_MA?: number; CK_TEN?: string } | null;
  room?: { P_MA?: number; P_TEN?: string } | null;
  status?: string | null;
  statusGroup: AppointmentStatusGroup;
  paymentStatus: PaymentStatus;
  canCancel: boolean;
  canReschedule: boolean;
  canUpdatePreVisit: boolean;
  preVisitInfo?: {
    symptoms?: string | null;
    note?: string | null;
    updatedAt?: string | null;
  };
}

export interface AppointmentListResponse {
  items: AppointmentListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaymentStatusResponse {
  DK_MA: number;
  appointmentStatus: string;
  payment: null | {
    TT_MA: number;
    TT_TRANG_THAI: string;
    TT_TONG_TIEN?: number | string | null;
    TT_PHUONG_THUC?: string | null;
    TT_PHUONG_THUC_TT?: string | null;
    normalizedStatus: PaymentStatus;
    TT_MA_GIAO_DICH?: string | null;
    TT_THOI_GIAN?: string | null;
    expiresAt?: string | null;
    paymentUrl?: string | null;
  };
}

export interface CancelPolicyResponse {
  appointmentId: number;
  currentStatus: string;
  paymentStatus: PaymentStatus;
  canCancel: boolean;
  cutoffMinutes: number;
  cancelDeadlineAt: string | null;
  reasonIfBlocked: string | null;
}

export interface AppointmentDetailResponse {
  appointment: Record<string, unknown>;
  preVisit?: {
    symptoms?: string | null;
    note?: string | null;
    attachments?: Array<{
      attachmentId: number;
      fileName: string;
      mimeType?: string | null;
      sizeBytes?: number | null;
    }>;
    updatedAt?: string | null;
  };
  cancelPolicy?: CancelPolicyResponse;
  refund?: {
    paymentCount?: number;
    refundCount?: number;
    hasRefundPending?: boolean;
    hasRefundSuccess?: boolean;
    latestRefund?: Record<string, unknown> | null;
  };
  notifications?: Array<Record<string, unknown>>;
  waitlist?: Array<Record<string, unknown>>;
}

export interface ReschedulePayload {
  newDoctorId?: number;
  newDate: string;
  newShift: string;
  newSlotId: number;
  reason?: string;
  note?: string;
}

export interface CancelPayload {
  reason: string;
  note?: string;
  source?: string;
}

export const appointmentsApi = {
  listMy: async (params: AppointmentListQuery) => {
    const res = await axiosClient.get<AppointmentListResponse>('/appointments/my', { params });
    return {
      ...res.data,
      items: (res.data.items || []).map((item) => ({
        ...item,
        paymentStatus: normalizePaymentStatus(item.paymentStatus),
      })),
    };
  },

  getDetail: async (appointmentId: number) => {
    const res = await axiosClient.get<AppointmentDetailResponse>(`/appointments/${appointmentId}`);
    return res.data;
  },

  getPaymentStatus: async (appointmentId: number) => {
    const res = await axiosClient.get<PaymentStatusResponse>(`/appointments/${appointmentId}/payment-status`);
    const payload = res.data;
    return {
      ...payload,
      payment: payload.payment
        ? {
            ...payload.payment,
            normalizedStatus: normalizePaymentStatus(payload.payment.normalizedStatus || payload.payment.TT_TRANG_THAI),
          }
        : null,
    };
  },

  getCancelPolicy: async (appointmentId: number) => {
    const res = await axiosClient.get<CancelPolicyResponse>(`/appointments/${appointmentId}/cancel-policy`);
    return {
      ...res.data,
      paymentStatus: normalizePaymentStatus(res.data.paymentStatus),
    };
  },

  retryPayment: async (appointmentId: number) => {
    const res = await axiosClient.post<{
      DK_MA: number;
      payment_url?: string;
      payment?: {
        TT_MA?: number;
      };
    }>(
      `/appointments/${appointmentId}/payment-retry`,
    );
    return res.data;
  },

  cancel: async (appointmentId: number, payload: CancelPayload) => {
    const res = await axiosClient.post(`/appointments/${appointmentId}/cancel`, payload);
    return res.data as {
      message?: string;
      appointment?: { DK_MA: number; DK_TRANG_THAI?: string };
    };
  },

  reschedule: async (appointmentId: number, payload: ReschedulePayload) => {
    const res = await axiosClient.patch(`/appointments/${appointmentId}/reschedule`, payload);
    return res.data as {
      message?: string;
      appointment?: { DK_MA: number; DK_TRANG_THAI?: string };
    };
  },

  downloadConfirmationPdf: async (appointmentId: number) => {
    await downloadPdf(`/appointments/${appointmentId}/confirmation.pdf`, {
      fallbackFilename: `appointment-confirmation-${appointmentId}.pdf`,
    });
  },
};
