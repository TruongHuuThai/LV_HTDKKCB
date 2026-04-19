import axiosClient from './axiosClient';
import { downloadPdf } from './pdfApi';
import type { ShiftStatus, WeekStatus } from '@/contracts/scheduleStatusContract';

export type TemplateStatus = 'active' | 'inactive';
export type WeekWorkflowStatus = WeekStatus;
export type WeeklyScheduleStatus = ShiftStatus;
export type WeeklyScheduleSource =
  | 'legacy_registration'
  | 'template'
  | 'admin_manual'
  | 'auto_rolling'
  | 'copied_1_month'
  | 'copied_2_months'
  | 'copied_3_months';
export type ExceptionRequestType = 'leave' | 'shift_change' | 'room_change' | 'other';
export type ExceptionRequestStatus = 'pending' | 'approved' | 'rejected';
export type SchedulePlanningOverwriteMode = 'skip' | 'overwrite' | 'only_empty';
export type ScheduleCopyRangeOption = 'ONE_MONTH' | 'TWO_MONTHS' | 'THREE_MONTHS';
export type ScheduleCopyConflictMode =
  | 'SKIP_EXISTING'
  | 'ARCHIVE_OLD_GENERATED'
  | 'ONLY_EMPTY';

export interface SchedulePlanningAssignment {
  date: string;
  session: string;
  roomId: number;
  doctorId: number;
}

export interface SchedulePlanningExistingItem {
  slotCount: number;
  slotCapacity: number;
  bookingCount: number;
  BS_MA: number;
  P_MA: number;
  N_NGAY: string;
  B_TEN: string;
  status: WeeklyScheduleStatus;
  weekStatus?: WeekWorkflowStatus;
  source: WeeklyScheduleSource;
  doctor: {
    BS_MA: number;
    BS_HO_TEN: string;
    CK_MA: number;
    CHUYEN_KHOA: { CK_TEN: string };
  };
  room: {
    P_MA: number;
    P_TEN: string;
    CK_MA: number;
    CHUYEN_KHOA: { CK_TEN: string };
  };
}

export interface SchedulePlanningExistingResponse {
  items: SchedulePlanningExistingItem[];
}

export interface SchedulePlanningDraftResponse {
  id: number;
  dateFrom: string;
  dateTo: string;
  specialtyId: number;
  assignments: SchedulePlanningAssignment[];
  updatedAt?: string | null;
}

export interface SchedulePlanningGenerateResponse {
  message: string;
  created: number;
  updated: number;
  skipped: number;
  conflicts: number;
  conflictItems: Array<{
    date: string;
    session: string;
    roomId: number;
    doctorId: number;
    reason: string;
  }>;
}

export interface ScheduleArchiveResponse {
  preview: boolean;
  dateFrom: string;
  dateTo: string;
  specialtyId: number | null;
  source: string;
  total: number;
  eligible: number;
  alreadyArchived: number;
  skippedWithBookings: number;
  skippedWithPendingRequests: number;
  archivedCount?: number;
}

export interface ScheduleRestoreArchivedResponse {
  preview: boolean;
  dateFrom: string;
  dateTo: string;
  specialtyId: number;
  totalArchived: number;
  eligible: number;
  skippedWithBookings: number;
  skippedWithPendingRequests: number;
  skippedWithConflicts: number;
  restoredCount?: number;
}

export interface ScheduleCopyWeekResponse {
  preview: boolean;
  sourceWeekStart: string;
  sourceWeekEnd: string;
  targetStart: string | null;
  targetEnd: string | null;
  totalSourceShifts: number;
  targetWeeks: number;
  totalPlanned: number;
  willCreate: number;
  willUpdate: number;
  skippedExisting: number;
  conflicts: number;
  lockedWeeks: number;
  skippedLocked: number;
}

export interface ScheduleWorkflowOptions {
  specialties: Array<{ CK_MA: number; CK_TEN: string }>;
  doctors: Array<{
    BS_MA: number;
    BS_HO_TEN: string;
    CK_MA: number;
    CHUYEN_KHOA: { CK_TEN: string };
  }>;
  rooms: Array<{
    P_MA: number;
    P_TEN: string;
    CK_MA: number;
    CHUYEN_KHOA: { CK_TEN: string };
  }>;
  sessions: Array<{
    B_TEN: string;
    B_GIO_BAT_DAU: string | null;
    B_GIO_KET_THUC: string | null;
  }>;
}

export interface ScheduleWeekOverview {
  weekStartDate: string;
  weekEndDate: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  adminReviewWindowEndAt: string;
  status: 'open' | 'locked' | 'finalized';
  workflowStatus: WeekWorkflowStatus;
  finalizedAt: string | null;
  slotGeneratedAt: string | null;
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    official: number;
    generated: number;
    confirmed: number;
    changeRequested: number;
    adjusted: number;
    finalized: number;
    cancelled: number;
    pendingExceptions: number;
    approvedExceptions: number;
    rejectedExceptions: number;
  };
  missingShifts?: {
    totalMissing: number;
    items: Array<{ date: string; weekday: number; session: string }>;
  };
}

export interface ScheduleTemplateItem {
  LBM_ID: number;
  BS_MA: number;
  CK_MA: number;
  P_MA: number;
  B_TEN: string;
  weekday: number;
  effectiveStartDate: string;
  effectiveEndDate: string | null;
  status: TemplateStatus;
  note: string | null;
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  doctor: {
    BS_MA: number;
    BS_HO_TEN: string;
    CK_MA: number;
    CHUYEN_KHOA: { CK_TEN: string };
  };
  specialty: { CK_MA: number; CK_TEN: string };
  room: { P_MA: number; P_TEN: string; CK_MA: number };
  session: {
    B_TEN: string;
    B_GIO_BAT_DAU: string | null;
    B_GIO_KET_THUC: string | null;
  };
}

export interface ScheduleTemplateListResponse {
  items: ScheduleTemplateItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface WeeklyScheduleItem {
  BS_MA: number;
  N_NGAY: string;
  B_TEN: string;
  P_MA: number;
  status: WeeklyScheduleStatus;
  source: WeeklyScheduleSource;
  note: string | null;
  confirmationAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  slotCount: number;
  slotMax?: number | null;
  bookingCount: number;
  doctor: {
    BS_MA: number;
    BS_HO_TEN: string;
    CK_MA: number;
    CHUYEN_KHOA: { CK_TEN: string };
  };
  room: {
    P_MA: number;
    P_TEN: string;
    CK_MA: number;
    CHUYEN_KHOA: { CK_TEN: string };
  };
  template: {
    LBM_ID: number;
    weekday: number;
    status: TemplateStatus;
    effectiveStartDate: string;
    effectiveEndDate: string | null;
  } | null;
  latestException: ScheduleExceptionRequestItem | null;
  weekStatus: WeekWorkflowStatus;
  finalizedAt: string | null;
  slotOpenedAt: string | null;
}

export interface WeeklyScheduleListResponse {
  items: WeeklyScheduleItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    weekStart: string;
    workflowStatus: WeekWorkflowStatus;
    finalizedAt: string | null;
    slotOpenedAt: string | null;
  };
}

export interface ScheduleExceptionRequestItem {
  id: number;
  type: ExceptionRequestType;
  status: ExceptionRequestStatus;
  reason: string;
  previousStatus: WeeklyScheduleStatus | null;
  createdAt: string | null;
  createdBy: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNote: string | null;
  affectedBookingCount: number;
  leaveApprovalMode: 'replacement' | 'cancel_with_bookings' | null;
  doctor: {
    BS_MA: number;
    BS_HO_TEN: string;
    CK_MA?: number;
    CHUYEN_KHOA?: { CK_TEN: string };
  };
  targetShift: {
    BS_MA: number;
    N_NGAY: string;
    B_TEN: string;
    status: WeeklyScheduleStatus | null;
    room: {
      P_MA: number;
      P_TEN: string;
      CK_MA: number;
    } | null;
  };
  requestedChange: {
    date: string | null;
    session: string | null;
    room: {
      P_MA: number;
      P_TEN: string;
      CK_MA: number;
    } | null;
    suggestedDoctor: {
      BS_MA: number;
      BS_HO_TEN: string;
    } | null;
  };
}

export interface ScheduleExceptionRequestListResponse {
  items: ScheduleExceptionRequestItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    weekStart: string;
  };
}

export interface OfficialShiftFormContextSession {
  session: string;
  room: {
    status: 'empty' | 'pending' | 'approved' | 'official' | 'rejected';
    occupied: boolean;
    doctor: { BS_MA: number; BS_HO_TEN: string } | null;
    note: string | null;
  };
  doctor: {
    status: 'empty' | 'pending' | 'approved' | 'official' | 'rejected';
    occupied: boolean;
    room: { P_MA: number; P_TEN: string } | null;
    note: string | null;
  };
  canSelect: boolean;
  reasons: string[];
}

export interface OfficialShiftFormContextResponse {
  date: string;
  room: {
    P_MA: number;
    P_TEN: string;
    CK_MA: number;
    CHUYEN_KHOA: { CK_TEN: string };
  } | null;
  doctor: {
    BS_MA: number;
    BS_HO_TEN: string;
    CK_MA: number;
    CHUYEN_KHOA: { CK_TEN: string };
  } | null;
  doctorSpecialtyMatchesRoom: boolean | null;
  sessionContext: OfficialShiftFormContextSession[];
  availableSessions: string[];
  hasAnyAvailableSession: boolean;
}

export interface DoctorWeekOverview extends ScheduleWeekOverview {
  doctor: {
    BS_MA: number;
    BS_HO_TEN: string;
    CK_MA: number;
    CHUYEN_KHOA: { CK_TEN: string };
  };
  canConfirm: boolean;
  canRequestChanges: boolean;
}

export const adminScheduleWorkflowApi = {
  getOptions: async (): Promise<ScheduleWorkflowOptions> => {
    const res = await axiosClient.get<ScheduleWorkflowOptions>(
      '/admin/schedule-management/options',
    );
    return res.data;
  },

  getPlanningExisting: async (params: {
    dateFrom: string;
    dateTo: string;
    specialtyId?: number;
  }): Promise<SchedulePlanningExistingResponse> => {
    const res = await axiosClient.get<SchedulePlanningExistingResponse>(
      '/admin/schedule-management/planning/existing',
      { params },
    );
    return res.data;
  },

  createPlanningDraft: async (data: {
    dateFrom: string;
    dateTo: string;
    specialtyId: number;
    assignments: SchedulePlanningAssignment[];
  }): Promise<SchedulePlanningDraftResponse> => {
    const res = await axiosClient.post<SchedulePlanningDraftResponse>(
      '/admin/schedule-management/planning/drafts',
      data,
    );
    return res.data;
  },

  updatePlanningDraft: async (
    id: number,
    data: {
      dateFrom: string;
      dateTo: string;
      specialtyId: number;
      assignments: SchedulePlanningAssignment[];
    },
  ): Promise<SchedulePlanningDraftResponse> => {
    const res = await axiosClient.put<SchedulePlanningDraftResponse>(
      `/admin/schedule-management/planning/drafts/${id}`,
      data,
    );
    return res.data;
  },

  getPlanningDraft: async (id: number): Promise<SchedulePlanningDraftResponse> => {
    const res = await axiosClient.get<SchedulePlanningDraftResponse>(
      `/admin/schedule-management/planning/drafts/${id}`,
    );
    return res.data;
  },

  getLatestPlanningDraft: async (params?: {
    specialtyId?: number;
  }): Promise<SchedulePlanningDraftResponse> => {
    const res = await axiosClient.get<SchedulePlanningDraftResponse>(
      '/admin/schedule-management/planning/drafts',
      { params },
    );
    return res.data;
  },

  generatePlanningSchedules: async (data: {
    dateFrom: string;
    dateTo: string;
    specialtyId: number;
    assignments: SchedulePlanningAssignment[];
    overwriteMode?: SchedulePlanningOverwriteMode;
    status?: 'approved' | 'official';
  }): Promise<SchedulePlanningGenerateResponse> => {
    const res = await axiosClient.post<SchedulePlanningGenerateResponse>(
      '/admin/schedule-management/planning/generate',
      data,
    );
    return res.data;
  },

  archiveSchedules: async (data: {
    dateFrom: string;
    dateTo: string;
    specialtyId?: number;
    source?: string;
    reason?: string;
    confirm?: boolean;
  }): Promise<ScheduleArchiveResponse> => {
    const res = await axiosClient.post<ScheduleArchiveResponse>(
      '/admin/schedule-management/archive',
      data,
    );
    return res.data;
  },

  restoreArchivedSchedules: async (data: {
    dateFrom: string;
    dateTo: string;
    specialtyId: number;
    confirm?: boolean;
  }): Promise<ScheduleRestoreArchivedResponse> => {
    const res = await axiosClient.post<ScheduleRestoreArchivedResponse>(
      '/admin/schedule-management/archive/restore',
      data,
    );
    return res.data;
  },

  copyWeekToFutureMonths: async (data: {
    sourceWeekStart: string;
    specialtyId: number;
    copyRangeOption: ScheduleCopyRangeOption;
    conflictMode: ScheduleCopyConflictMode;
    confirm?: boolean;
  }): Promise<ScheduleCopyWeekResponse> => {
    const res = await axiosClient.post<ScheduleCopyWeekResponse>(
      '/admin/schedule-management/copy-week',
      data,
    );
    return res.data;
  },

  getWeekOverview: async (weekStart?: string): Promise<ScheduleWeekOverview> => {
    const res = await axiosClient.get<ScheduleWeekOverview>(
      '/admin/schedule-management/cycle-overview',
      { params: { weekStart } },
    );
    return res.data;
  },

  getTemplates: async (params?: {
    page?: number;
    limit?: number;
    doctorId?: number;
    specialtyId?: number;
    roomId?: number;
    status?: string;
    search?: string;
  }): Promise<ScheduleTemplateListResponse> => {
    const res = await axiosClient.get<ScheduleTemplateListResponse>(
      '/admin/schedule-management/templates',
      { params },
    );
    return res.data;
  },

  createTemplate: async (data: {
    BS_MA: number;
    CK_MA: number;
    P_MA: number;
    B_TEN: string;
    weekday: number;
    effectiveStartDate: string;
    effectiveEndDate?: string | null;
    status?: TemplateStatus;
    note?: string;
  }) => {
    const res = await axiosClient.post('/admin/schedule-management/templates', data);
    return res.data;
  },

  updateTemplate: async (
    id: number,
    data: {
      BS_MA?: number;
      CK_MA?: number;
      P_MA?: number;
      B_TEN?: string;
      weekday?: number;
      effectiveStartDate?: string;
      effectiveEndDate?: string | null;
      status?: TemplateStatus;
      note?: string | null;
    },
  ) => {
    const res = await axiosClient.put(
      `/admin/schedule-management/templates/${id}`,
      data,
    );
    return res.data;
  },

  generateWeekFromTemplates: async (weekStart: string) => {
    const res = await axiosClient.post(
      `/admin/schedule-management/cycles/${encodeURIComponent(weekStart)}/generate-from-templates`,
    );
    return res.data as {
      weekStart: string;
      created: number;
      updated: number;
      cancelled: number;
      skipped: number;
      locked: boolean;
    };
  },

  getWeeklySchedules: async (params?: {
    weekStart?: string;
    page?: number;
    limit?: number;
    specialtyId?: number;
    doctorId?: number;
    roomId?: number;
    status?: string;
    session?: string;
    weekday?: number;
    date?: string;
    search?: string;
    source?: string;
  }): Promise<WeeklyScheduleListResponse> => {
    const res = await axiosClient.get<WeeklyScheduleListResponse>(
      '/admin/schedule-management/weekly-shifts',
      { params },
    );
    return res.data;
  },

  getExceptionRequests: async (params?: {
    weekStart?: string;
    page?: number;
    limit?: number;
    doctorId?: number;
    status?: string;
    search?: string;
  }): Promise<ScheduleExceptionRequestListResponse> => {
    const res = await axiosClient.get<ScheduleExceptionRequestListResponse>(
      '/admin/schedule-management/exception-requests',
      { params },
    );
    return res.data;
  },

  reviewExceptionRequest: async (
    id: number,
    data: { status: 'approved' | 'rejected'; adminNote?: string },
  ) => {
    const res = await axiosClient.put(
      `/admin/schedule-management/exception-requests/${id}/review`,
      data,
    );
    return res.data;
  },

  getShiftFormContext: async (params: {
    date: string;
    roomId?: number;
    doctorId?: number;
    excludeBsMa?: number;
    excludeDate?: string;
    excludeSession?: string;
  }): Promise<OfficialShiftFormContextResponse> => {
    const res = await axiosClient.get<OfficialShiftFormContextResponse>(
      '/admin/schedule-management/form-context',
      { params },
    );
    return res.data;
  },

  createManualShift: async (data: {
    BS_MA: number;
    P_MA: number;
    N_NGAY: string;
    B_TEN: string;
    note?: string;
    status?: 'approved' | 'official';
  }) => {
    const res = await axiosClient.post(
      '/admin/schedule-management/official-shifts',
      data,
    );
    return res.data;
  },

  updateManualShift: async (
    bsMa: number,
    date: string,
    session: string,
    data: {
      BS_MA?: number;
      P_MA?: number;
      N_NGAY?: string;
      B_TEN?: string;
      note?: string;
      status?: 'approved' | 'official';
    },
  ) => {
    const res = await axiosClient.put(
      `/admin/schedule-management/official-shifts/${bsMa}/${encodeURIComponent(date)}/${encodeURIComponent(session)}`,
      data,
    );
    return res.data;
  },

  deleteManualShift: async (bsMa: number, date: string, session: string) => {
    await axiosClient.delete(
      `/admin/schedule-management/official-shifts/${bsMa}/${encodeURIComponent(date)}/${encodeURIComponent(session)}`,
    );
  },

  finalizeWeek: async (
    weekStart: string,
    data?: { forceRefinalize?: boolean; generateSlots?: boolean; forceRegenerate?: boolean },
  ) => {
    const res = await axiosClient.post(
      `/admin/schedule-management/cycles/${encodeURIComponent(weekStart)}/finalize`,
      data,
    );
    return res.data;
  },

  openSlots: async (
    weekStart: string,
    data?: { forceRegenerate?: boolean },
  ) => {
    const res = await axiosClient.post(
      `/admin/schedule-management/cycles/${encodeURIComponent(weekStart)}/generate-slots`,
      data,
    );
    return res.data;
  },

  downloadWeeklySchedulesPdf: async (params?: {
    weekStart?: string;
    specialtyId?: number | string;
    doctorId?: number | string;
    roomId?: number | string;
    status?: string;
    session?: string;
    weekday?: number | string;
    date?: string;
    search?: string;
    source?: string;
  }) => {
    await downloadPdf('/admin/schedule-management/weekly-shifts/pdf', {
      params: params as Record<string, string | number | boolean | undefined>,
      fallbackFilename: 'admin-weekly-schedule.pdf',
    });
  },
};

export const doctorScheduleWorkflowApi = {
  getWeekOverview: async (weekStart?: string): Promise<DoctorWeekOverview> => {
    const res = await axiosClient.get<DoctorWeekOverview>('/schedules/weekly-overview', {
      params: { weekStart },
    });
    return res.data;
  },

  getWeeklySchedules: async (weekStart?: string): Promise<WeeklyScheduleListResponse> => {
    const res = await axiosClient.get<WeeklyScheduleListResponse>(
      '/schedules/weekly-schedules',
      { params: { weekStart } },
    );
    return res.data;
  },

  getExceptionRequests: async (
    weekStart?: string,
  ): Promise<ScheduleExceptionRequestListResponse> => {
    const res = await axiosClient.get<ScheduleExceptionRequestListResponse>(
      '/schedules/exception-requests',
      { params: { weekStart } },
    );
    return res.data;
  },

  confirmWeek: async (weekStart: string) => {
    const res = await axiosClient.post(
      `/schedules/weeks/${encodeURIComponent(weekStart)}/confirm`,
    );
    return res.data as {
      message: string;
      weekStart: string;
      confirmedCount: number;
      acknowledgedAdjustedCount: number;
    };
  },

  confirmShift: async (date: string, session: string) => {
    const res = await axiosClient.post(
      `/schedules/shifts/${encodeURIComponent(date)}/${encodeURIComponent(session)}/confirm`,
    );
    return res.data;
  },

  createExceptionRequest: async (data: {
    targetDate: string;
    targetSession: string;
    type: ExceptionRequestType;
    reason: string;
    requestedDate?: string | null;
    requestedSession?: string | null;
    requestedRoomId?: number | null;
    suggestedDoctorId?: number | null;
  }) => {
    const res = await axiosClient.post('/schedules/exception-requests', data);
    return res.data;
  },

  downloadWeeklySchedulePdf: async (weekStart?: string) => {
    await downloadPdf('/schedules/weekly-schedules/pdf', {
      params: { weekStart },
      fallbackFilename: 'doctor-weekly-schedule.pdf',
    });
  },
};
