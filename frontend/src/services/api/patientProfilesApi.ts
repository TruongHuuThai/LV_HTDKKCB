import axiosClient from './axiosClient';

export interface PatientProfileUsageSummary {
  appointmentsCount: number;
  healthMetricsCount: number;
  clinicalDocumentCount: number;
  prescriptionCount: number;
  invoiceCount: number;
  hasRelatedData: boolean;
}

export interface PatientProfile {
  BN_MA: number;
  TK_SDT: string | null;
  AK_MA: number | null;
  BN_HO_CHU_LOT: string | null;
  BN_TEN: string | null;
  BN_NGAY_SINH: string | null;
  BN_LA_NAM: boolean | null;
  BN_SDT_DANG_KY: string | null;
  BN_EMAIL: string | null;
  BN_CCCD: string | null;
  BN_SO_BHYT: string | null;
  BN_QUOC_GIA: string | null;
  BN_DAN_TOC: string | null;
  BN_SO_DDCN: string | null;
  BN_DIA_CHI: string | null;
  BN_QUAN_HE_VOI_TK: string | null;
  BN_DA_VO_HIEU: boolean | null;
  BN_ANH: string | null;
  BN_MOI: boolean | null;
  fullName: string;
  canBook: boolean;
  location?: {
    AK_MA: number;
    AK_TEN: string;
    XA_PHUONG: {
      XP_MA: number;
      XP_TEN: string;
      TINH_TP: {
        TTP_MA: number;
        TTP_TEN: string;
      } | null;
    } | null;
  } | null;
  locationLabel?: string | null;
  relationshipLabel?: string;
  usage?: PatientProfileUsageSummary;
}

export interface PatientProfilesListResponse {
  items: PatientProfile[];
  meta: {
    total: number;
    active: number;
    disabled: number;
    limit: number;
    remainingSlots: number;
    accountPhone: string;
  };
}

export interface PatientProfileDetailResponse {
  profile: PatientProfile;
  summary: PatientProfileUsageSummary;
}

export interface UpsertPatientProfileInput {
  AK_MA?: number;
  BN_HO_CHU_LOT?: string;
  BN_TEN: string;
  BN_NGAY_SINH?: string;
  BN_LA_NAM?: boolean;
  BN_SDT_DANG_KY?: string;
  BN_EMAIL?: string;
  BN_CCCD?: string;
  BN_SO_BHYT?: string;
  BN_QUOC_GIA?: string;
  BN_DAN_TOC?: string;
  BN_SO_DDCN?: string;
  BN_MOI?: boolean;
  BN_DIA_CHI?: string;
  BN_QUAN_HE_VOI_TK?: string;
  BN_ANH?: string;
}

export interface PatientProfileLocationOption {
  TTP_MA: number;
  TTP_TEN: string;
  XA_PHUONG: Array<{
    XP_MA: number;
    XP_TEN: string;
    AP_KV: Array<{
      AK_MA: number;
      AK_TEN: string;
    }>;
  }>;
}

export interface PatientProfileAppointment {
  DK_MA: number;
  BN_MA: number;
  BS_MA: number;
  N_NGAY: string;
  B_TEN: string;
  DK_TRANG_THAI: string | null;
  DK_THOI_GIAN_TAO: string | null;
  KHUNG_GIO?: {
    KG_BAT_DAU: string;
    KG_KET_THUC: string;
  } | null;
  LICH_BSK?: {
    PHONG?: {
      P_TEN: string;
    } | null;
  } | null;
  PHIEU_KHAM_BENH?: {
    PKB_MA: number;
    PKB_KET_LUAN: string | null;
    PKB_TRIEU_CHUNG: string | null;
  } | null;
  THANH_TOAN?: Array<{
    TT_MA: number;
    TT_TRANG_THAI: string | null;
    TT_TONG_TIEN: number | string | null;
  }>;
  doctorName: string | null;
  specialtyName: string | null;
  roomName: string | null;
}

export interface PatientHealthMetric {
  CSSK_MA: number;
  CSSK_NGAY_DO: string | null;
  CSSK_CAN_NANG: number | string | null;
  CSSK_CHIEU_CAO: number | string | null;
  CSSK_HUYET_AP: string | null;
  CSSK_NHIP_TIM: number | null;
  CSSK_NHIET_DO: number | string | null;
  CSSK_DUONG_HUYET: number | string | null;
  CSSK_GHI_CHU: string | null;
}

export interface PatientClinicalResult {
  documentId: number;
  createdAt: string | null;
  doctorName: string | null;
  specialtyName: string | null;
  appointment?: {
    N_NGAY: string;
    B_TEN: string;
  } | null;
  service?: {
    DVCLS_MA: number;
    DVCLS_TEN: string;
    DVCLS_LOAI: string | null;
  } | null;
  result?: {
    KQCLS_HINH_ANH: string | null;
    KQCLS_NHAN_XET: string | null;
    KQCLS_CHI_SO: unknown;
  } | null;
}

export interface PatientPrescription {
  DT_MA: number;
  DT_NGAY_TAO: string | null;
  DT_GHI_CHU: string | null;
  DT_SO_NGAY_SUNG: number | null;
  PHIEU_KHAM_BENH?: {
    DANG_KY?: {
      LICH_BSK?: {
        BAC_SI?: {
          BS_HO_TEN: string;
        } | null;
      } | null;
    } | null;
  } | null;
  CHI_TIET_DON_THUOC: Array<{
    T_MA: number;
    CTDT_SO_LUONG: number;
    CTDT_LIEU_DUNG: string | null;
    CTDT_CACH_DUNG: string | null;
    THUOC?: {
      T_TEN_THUOC: string;
      DON_VI_TINH?: {
        DVT_TEN: string;
      } | null;
    } | null;
  }>;
}

export interface PatientInvoice {
  TT_MA: number;
  TT_TONG_TIEN: number | string | null;
  TT_THUC_THU: number | string | null;
  TT_TRANG_THAI: string | null;
  TT_THOI_GIAN: string | null;
  TT_PHUONG_THUC: string | null;
  TT_PHUONG_THUC_TT: string | null;
  DANG_KY?: {
    N_NGAY: string;
    LICH_BSK?: {
      BAC_SI?: {
        BS_HO_TEN: string;
        CHUYEN_KHOA?: {
          CK_TEN: string;
        } | null;
      } | null;
    } | null;
  } | null;
}

export const patientProfilesApi = {
  getLocationOptions: async (): Promise<{ provinces: PatientProfileLocationOption[] }> => {
    const res = await axiosClient.get<{ provinces: PatientProfileLocationOption[] }>(
      '/patient-profiles/location-options',
    );
    return res.data;
  },

  listMine: async (): Promise<PatientProfilesListResponse> => {
    const res = await axiosClient.get<PatientProfilesListResponse>('/patient-profiles');
    return res.data;
  },

  getDetail: async (id: number): Promise<PatientProfileDetailResponse> => {
    const res = await axiosClient.get<PatientProfileDetailResponse>(
      `/patient-profiles/${id}`,
    );
    return res.data;
  },

  create: async (data: UpsertPatientProfileInput): Promise<PatientProfileDetailResponse> => {
    const res = await axiosClient.post<PatientProfileDetailResponse>(
      '/patient-profiles',
      data,
    );
    return res.data;
  },

  update: async (
    id: number,
    data: Partial<UpsertPatientProfileInput>,
  ): Promise<PatientProfileDetailResponse> => {
    const res = await axiosClient.put<PatientProfileDetailResponse>(
      `/patient-profiles/${id}`,
      data,
    );
    return res.data;
  },

  remove: async (id: number): Promise<{ action: 'deleted' | 'disabled'; message: string }> => {
    const res = await axiosClient.delete(`/patient-profiles/${id}`);
    return res.data;
  },

  getAppointments: async (id: number) => {
    const res = await axiosClient.get<{ items: PatientProfileAppointment[] }>(
      `/patient-profiles/${id}/appointments`,
    );
    return res.data;
  },

  getHealthMetrics: async (id: number) => {
    const res = await axiosClient.get<{ items: PatientHealthMetric[] }>(
      `/patient-profiles/${id}/health-metrics`,
    );
    return res.data;
  },

  getLabResults: async (id: number) => {
    const res = await axiosClient.get<{ items: PatientClinicalResult[] }>(
      `/patient-profiles/${id}/lab-results`,
    );
    return res.data;
  },

  getImagingResults: async (id: number) => {
    const res = await axiosClient.get<{ items: PatientClinicalResult[] }>(
      `/patient-profiles/${id}/imaging-results`,
    );
    return res.data;
  },

  getPrescriptions: async (id: number) => {
    const res = await axiosClient.get<{ items: PatientPrescription[] }>(
      `/patient-profiles/${id}/prescriptions`,
    );
    return res.data;
  },

  getInvoices: async (id: number) => {
    const res = await axiosClient.get<{ items: PatientInvoice[] }>(
      `/patient-profiles/${id}/invoices`,
    );
    return res.data;
  },
};
