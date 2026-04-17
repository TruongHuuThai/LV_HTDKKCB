import axiosClient from './axiosClient';

export type PatientNotificationType =
  | 'reminder'
  | 'reschedule'
  | 'doctor_unavailable'
  | 'cancellation'
  | 'waitlist'
  | 'payment_success'
  | 'payment_failed'
  | 'payment_timeout'
  | 'payment_pending'
  | 'system_admin'
  | 'system_auto';

export interface PatientNotificationItem {
  TB_MA: number;
  TK_SDT?: string | null;
  TB_BATCH_MA?: number | null;
  TB_TIEU_DE?: string | null;
  TB_LOAI?: string | null;
  TB_NOI_DUNG?: string | null;
  TB_TRANG_THAI?: string | null;
  TB_THOI_GIAN?: string | null;
}

export interface NotificationListQuery {
  type?: PatientNotificationType;
  isRead?: 'true' | 'false';
  page?: number;
  limit?: number;
}

export interface NotificationListResponse {
  items: PatientNotificationItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type AdminBulkNotificationType =
  | 'rescheduled'
  | 'canceled_session'
  | 'doctor_changed'
  | 'room_changed'
  | 'doctor_unavailable'
  | 'system_admin'
  | 'system_auto'
  | 'custom';

export type AdminNotificationTargetGroup =
  | 'ALL_USERS'
  | 'PATIENTS'
  | 'DOCTORS'
  | 'BY_SPECIALTY'
  | 'ADVANCED_FILTER';

export type AdminNotificationRecipientScope = 'PATIENTS' | 'DOCTORS' | 'ALL_USERS';

export interface AdminBulkNotificationFilters {
  specialtyIds?: number[];
  doctorIds?: number[];
  appointmentIds?: number[];
  specificDate?: string;
  fromDate?: string;
  toDate?: string;
  scheduleId?: number;
  slotId?: number;
  appointmentStatuses?: string[];
  recipientScope?: AdminNotificationRecipientScope;
}

export interface AdminBulkNotificationPayload {
  type: AdminBulkNotificationType;
  message: string;
  title?: string;
  targetGroup?: AdminNotificationTargetGroup;
  filters?: AdminBulkNotificationFilters;
  quickPreset?: string;

  // Legacy fields kept for compatibility with existing backend filters.
  appointmentIds?: number[];
  doctorId?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  scheduleId?: number;
  slotId?: number;
  specialtyId?: number;
}

export interface AdminBulkNotificationPreviewResponse {
  targetGroup?: AdminNotificationTargetGroup;
  recipientScope?: AdminNotificationRecipientScope;
  scopeSummary?: string;
  filterSummary?: string[];
  warnings?: string[];
  emptyReason?: string | null;
  totalRecipients: number;
  previewRecipients?: Array<{
    appointmentId: number | null;
    phone: string;
    patientName?: string;
    doctorName?: string | null;
    roomName?: string | null;
    date?: string;
    shift?: string;
    role?: 'BENH_NHAN' | 'BAC_SI' | 'USER';
  }>;
  sampleRecipients: Array<{
    appointmentId: number | null;
    phone: string;
    patientName?: string;
    doctorName?: string | null;
    roomName?: string | null;
    date?: string;
    shift?: string;
    role?: 'BENH_NHAN' | 'BAC_SI' | 'USER';
  }>;
}

export interface AdminBulkBatchItem {
  TBB_MA: number;
  TBB_LOAI: string;
  TBB_TIEU_DE?: string | null;
  TBB_NOI_DUNG: string;
  TBB_TONG_NGUOI_NHAN: number;
  TBB_DA_XU_LY: number;
  TBB_THANH_CONG: number;
  TBB_THAT_BAI: number;
  TBB_TRANG_THAI: string;
  TBB_THOI_GIAN_TAO: string;
  TBB_NGUOI_TAO?: string | null;
}

export interface AdminBulkBatchListResponse {
  items: AdminBulkBatchItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminBulkBatchListQuery {
  type?: AdminBulkNotificationType;
  actorId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export const notificationsApi = {
  listMine: async (params: NotificationListQuery) => {
    const query: Record<string, string | number> = {};
    if (Number.isFinite(params.page) && Number(params.page) > 0) {
      query.page = Number(params.page);
    }
    if (Number.isFinite(params.limit) && Number(params.limit) > 0) {
      query.limit = Number(params.limit);
    }
    if (params.type) {
      query.type = params.type;
    }
    if (params.isRead === 'true' || params.isRead === 'false') {
      query.isRead = params.isRead;
    }
    const res = await axiosClient.get<NotificationListResponse>('/notifications', { params: query });
    return res.data;
  },

  markRead: async (notificationId: number) => {
    const res = await axiosClient.patch(`/notifications/${notificationId}/read`);
    return res.data as { message?: string };
  },

  markAllRead: async () => {
    const res = await axiosClient.patch('/notifications/read-all');
    return res.data as { message?: string; updatedCount?: number };
  },

  previewBulkByAdmin: async (payload: AdminBulkNotificationPayload) => {
    const res = await axiosClient.post<AdminBulkNotificationPreviewResponse>(
      '/admin/notifications/bulk/preview',
      payload,
    );
    return res.data;
  },

  createBulkByAdmin: async (payload: AdminBulkNotificationPayload) => {
    const res = await axiosClient.post('/admin/notifications/bulk', payload);
    return res.data as {
      message?: string;
      batchId?: number;
      duplicatedRequest?: boolean;
      totalRecipients?: number;
      status?: string;
      targetGroup?: AdminNotificationTargetGroup;
      warnings?: string[];
    };
  },

  listBulkBatchesByAdmin: async (params: AdminBulkBatchListQuery) => {
    const res = await axiosClient.get<AdminBulkBatchListResponse>('/admin/notifications/bulk', {
      params,
    });
    return res.data;
  },

  getBulkBatchDetailByAdmin: async (batchId: number) => {
    const res = await axiosClient.get(`/admin/notifications/bulk/${batchId}`);
    return res.data as {
      batch: AdminBulkBatchItem;
      summary?: Record<string, number>;
      recipients?: Array<Record<string, unknown>>;
    };
  },
};
