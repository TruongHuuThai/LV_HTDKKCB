// src/services/api/adminApi.ts
import axiosClient from './axiosClient';

// Táº¡m thá»i Ä‘á»‹nh nghÄ©a types á»Ÿ Ä‘Ă¢y, cĂ³ thá»ƒ chuyá»ƒn ra file types/ riĂªng sau
export interface AdminDoctor {
    BS_MA: number;
    BS_HO_TEN: string;
    BS_EMAIL: string | null;
    BS_SDT: string | null;
    BS_HOC_HAM: string | null;
    BS_ANH: string | null;
    CK_MA: number;
    BS_DA_XOA?: boolean | null;
    CHUYEN_KHOA?: {
        CK_MA: number;
        CK_TEN: string;
    };
}

export interface CreateDoctorInput {
    BS_HO_TEN: string;
    CK_MA: number;
    BS_SDT?: string;
    BS_EMAIL?: string;
    BS_HOC_HAM?: string;
    BS_ANH?: string;
}

export type UpdateDoctorInput = Partial<CreateDoctorInput>;

export type DoctorSortBy = 'code';
export type DoctorSortOrder = 'asc' | 'desc';

export interface DoctorListMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    sortBy: DoctorSortBy;
    sortOrder: DoctorSortOrder;
    search: string;
    specialtyId?: number | null;
    academicTitle?: string;
}

export interface DoctorListResponse {
    items: AdminDoctor[];
    meta: DoctorListMeta;
}

export interface AdminServiceItem {
    DVCLS_MA: number;
    DVCLS_TEN: string;
    DVCLS_LOAI: string | null;
    DVCLS_GIA_DV: number | string | null;
}

export interface CreateServiceInput {
    DVCLS_TEN: string;
    DVCLS_LOAI?: string;
    DVCLS_GIA_DV?: number;
}

export type UpdateServiceInput = Partial<CreateServiceInput>;

export type ServiceSortBy = 'code' | 'name' | 'price';
export type ServiceSortOrder = 'asc' | 'desc';

export interface ServiceListMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    sortBy: ServiceSortBy;
    sortOrder: ServiceSortOrder;
    search: string;
    minPrice?: number | null;
    maxPrice?: number | null;
    serviceType?: string;
}

export interface ServiceListResponse {
    items: AdminServiceItem[];
    meta: ServiceListMeta;
}

export interface AdminMedicineItem {
    T_MA: number;
    BD_MA: number | null;
    DVT_MA: number | null;
    NT_MA: number | null;
    NSX_MA: number | null;
    T_TEN_THUOC: string;
    T_DA_XOA: boolean | null;
    T_GIA_THUOC: number | string | null;
    T_HAN_SU_DUNG: string | null;
    BIET_DUOC?: {
        BD_MA: number;
        BD_TEN: string;
        BD_CONG_DUNG?: string | null;
        BD_HAM_LUONG?: string | null;
        BD_LIEU_DUNG?: string | null;
    } | null;
    DON_VI_TINH?: {
        DVT_MA: number;
        DVT_TEN: string;
    } | null;
    NHOM_THUOC?: {
        NT_MA: number;
        NT_TEN: string;
    } | null;
    NHA_SAN_XUAT?: {
        NSX_MA: number;
        NSX_TEN: string;
    } | null;
}

export interface CreateMedicineInput {
    T_TEN_THUOC: string;
    BD_MA?: number | null;
    DVT_MA?: number | null;
    NT_MA?: number | null;
    NSX_MA?: number | null;
    T_GIA_THUOC?: number;
    T_HAN_SU_DUNG?: string | null;
}

export type UpdateMedicineInput = Partial<CreateMedicineInput>;

export interface UpdateMedicineBrandInfoInput {
    BD_TEN?: string;
    BD_CONG_DUNG?: string;
    BD_HAM_LUONG?: string;
    BD_LIEU_DUNG?: string;
}

export type MedicineSortBy = 'code' | 'price';
export type MedicineSortOrder = 'asc' | 'desc';
export type MedicineExpirationStatus = 'all' | 'valid' | 'expiring' | 'expired';

export interface MedicineListMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    sortBy: MedicineSortBy;
    sortOrder: MedicineSortOrder;
    search: string;
    groupId: number | null;
    manufacturerId: number | null;
    minPrice: number | null;
    maxPrice: number | null;
    expirationStatus: MedicineExpirationStatus;
}

export interface MedicineListResponse {
    items: AdminMedicineItem[];
    meta: MedicineListMeta;
}

export interface MedicineFilterOptions {
    groups: Array<{ NT_MA: number; NT_TEN: string }>;
    manufacturers: Array<{ NSX_MA: number; NSX_TEN: string }>;
    units: Array<{ DVT_MA: number; DVT_TEN: string }>;
    brands: Array<{ BD_MA: number; BD_TEN: string }>;
}

export interface AdminSpecialtyItem {
    CK_MA: number;
    CK_TEN: string;
    CK_MO_TA: string | null;
    CK_DOI_TUONG_KHAM: string | null;
}

export interface CreateSpecialtyInput {
    CK_TEN: string;
    CK_MO_TA?: string;
    CK_DOI_TUONG_KHAM?: string;
}

export type UpdateSpecialtyInput = Partial<CreateSpecialtyInput>;

export type SpecialtySortBy = 'code' | 'name';
export type SpecialtySortOrder = 'asc' | 'desc';

export interface SpecialtyListMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    sortBy: SpecialtySortBy;
    sortOrder: SpecialtySortOrder;
    search: string;
}

export interface SpecialtyListResponse {
    items: AdminSpecialtyItem[];
    meta: SpecialtyListMeta;
}

export interface AdminRoomItem {
    P_MA: number;
    CK_MA: number;
    P_TEN: string;
    P_VI_TRI: string | null;
    CHUYEN_KHOA?: {
        CK_MA: number;
        CK_TEN: string;
    };
}

export interface CreateRoomInput {
    CK_MA: number;
    P_TEN: string;
    P_VI_TRI?: string;
}

export type UpdateRoomInput = Partial<CreateRoomInput>;

export type RoomSortBy = 'code' | 'name';
export type RoomSortOrder = 'asc' | 'desc';

export interface RoomListMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    sortBy: RoomSortBy;
    sortOrder: RoomSortOrder;
    search: string;
    specialtyId: number | null;
}

export interface RoomListResponse {
    items: AdminRoomItem[];
    meta: RoomListMeta;
}

export interface AdminPatient {
    BN_MA: number;
    TK_SDT: string | null;
    AK_MA: number | null;
    BN_LA_NAM: boolean | null;
    BN_HO_CHU_LOT: string | null;
    BN_TEN: string | null;
    BN_EMAIL: string | null;
    BN_CCCD: string | null;
    BN_QUOC_GIA: string | null;
    BN_DAN_TOC: string | null;
    BN_SO_DDCN: string | null;
    BN_MOI: boolean | null;
    BN_SDT_DANG_KY: string | null;
    BN_ANH: string | null;
}

export interface CreatePatientInput {
    TK_SDT?: string;
    BN_HO_CHU_LOT?: string;
    BN_TEN: string;
    BN_LA_NAM?: boolean;
    BN_SDT_DANG_KY?: string;
    BN_EMAIL?: string;
    BN_CCCD?: string;
    BN_QUOC_GIA?: string;
    BN_DAN_TOC?: string;
    BN_SO_DDCN?: string;
    BN_MOI?: boolean;
    BN_ANH?: string;
}

export type UpdatePatientInput = Partial<CreatePatientInput>;

export type PatientSortBy = 'code' | 'name';
export type PatientSortOrder = 'asc' | 'desc';

export interface PatientListMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    sortBy: PatientSortBy;
    sortOrder: PatientSortOrder;
    search: string;
    gender: 'all' | 'male' | 'female';
    nationality: string;
    ethnicity: string;
    patientType: 'all' | 'new' | 'returning';
    accountPhone: string;
}

export interface PatientListResponse {
    items: AdminPatient[];
    meta: PatientListMeta;
}

export interface PatientFilterOptions {
    nationalities: string[];
    ethnicities: string[];
}

export interface AdminAccount {
    TK_SDT: string;
    TK_PASS_MASKED: string | null;
    TK_VAI_TRO: 'ADMIN' | 'BAC_SI' | 'BENH_NHAN' | null;
    TK_DA_XOA: boolean | null;
    TK_NGAY_TAO: string | null;
    TK_NGAY_CAP_NHAT: string | null;
    doctorName: string | null;
    primaryPatientName: string | null;
    managedPatientCount: number;
    managedPatientLimitReached: boolean;
}

export interface CreateAccountInput {
    TK_SDT: string;
    TK_PASS: string;
    TK_VAI_TRO: 'ADMIN' | 'BAC_SI' | 'BENH_NHAN';
}

export interface UpdateAccountInput {
    TK_PASS?: string;
    TK_VAI_TRO?: 'ADMIN' | 'BAC_SI' | 'BENH_NHAN';
    TK_DA_XOA?: boolean;
}

export interface AccountListMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    search: string;
    role: string;
    deletedStatus: string;
}

export interface AccountListResponse {
    items: AdminAccount[];
    meta: AccountListMeta;
}

export interface AdminAccountDetail {
    TK_SDT: string;
    TK_PASS: string;
    TK_VAI_TRO: 'ADMIN' | 'BAC_SI' | 'BENH_NHAN' | null;
    TK_DA_XOA: boolean | null;
    TK_NGAY_TAO: string | null;
    TK_NGAY_CAP_NHAT: string | null;
}

export type ScheduleWorkflowStatus = 'pending' | 'approved' | 'rejected' | 'official';

export interface ScheduleManagementOptions {
    specialties: Array<{ CK_MA: number; CK_TEN: string }>;
    doctors: Array<{ BS_MA: number; BS_HO_TEN: string; CK_MA: number; CHUYEN_KHOA: { CK_TEN: string } }>;
    rooms: Array<{ P_MA: number; P_TEN: string; CK_MA: number; CHUYEN_KHOA: { CK_TEN: string } }>;
    sessions: Array<{ B_TEN: string; B_GIO_BAT_DAU: string | null; B_GIO_KET_THUC: string | null }>;
}

export interface ScheduleCycleOverview {
    weekStartDate: string;
    weekEndDate: string;
    registrationOpenAt: string;
    registrationCloseAt: string;
    adminReviewWindowEndAt: string;
    status: 'open' | 'locked' | 'finalized';
    finalizedAt: string | null;
    slotGeneratedAt: string | null;
    summary: {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        official: number;
    };
    missingShifts?: {
        totalMissing: number;
        items: Array<{
            date: string;
            weekday: number;
            session: string;
        }>;
    };
}

export interface ScheduleRegistrationItem {
    BS_MA: number;
    N_NGAY: string;
    B_TEN: string;
    P_MA: number;
    status: ScheduleWorkflowStatus;
    note: string | null;
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
    submittedAt: string | null;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
}

export interface ScheduleOfficialShiftItem extends ScheduleRegistrationItem {
    slotCount: number;
}

export interface ScheduleListMeta {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    weekStart: string;
}

export interface ScheduleRegistrationsResponse {
    items: ScheduleRegistrationItem[];
    meta: ScheduleListMeta;
}

export interface ScheduleOfficialShiftsResponse {
    items: ScheduleOfficialShiftItem[];
    meta: ScheduleListMeta;
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

// â”€â”€â”€ DASHBOARD INTERFACES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface DailyOperationsStats {
    totalPatientsToday: number;
    pendingVisitsToday: number;
    completedVisitsToday: number;
    canceledVisitsToday: number;
    doctorsOnDutyToday: number;
}

export interface FinancialStats {
    todayRevenue: number;
}

export interface TopDoctor {
    id: number;
    name: string;
    specialty: string;
    avatar: string | null;
    visits: number;
}

export interface ExpiringMedicine {
    id: number;
    name: string;
    expiryDate: string;
}

export interface RecentActivity {
    id: number;
    patientName: string;
    action: string;
    createdAt: string;
}

export interface ChartDataPoint {
    name: string;
    visits: number;
}

export interface DashboardSummary {
    dailyOperations: DailyOperationsStats;
    financials: FinancialStats;
    topDoctors: TopDoctor[];
    expiringMedicines: ExpiringMedicine[];
    recentActivities: RecentActivity[];
    chartData: ChartDataPoint[];
}


export const adminApi = {
    // â”€â”€â”€ DOCTORS CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    
    getDoctors: async (params?: {
        search?: string;
        page?: number;
        limit?: number;
        sortBy?: DoctorSortBy;
        sortOrder?: DoctorSortOrder;
        specialtyId?: number;
        academicTitle?: string;
    }): Promise<DoctorListResponse> => {
        const res = await axiosClient.get<DoctorListResponse>('/admin/doctors', { params });
        return res.data;
    },

    getDoctorAcademicTitles: async (): Promise<string[]> => {
        const res = await axiosClient.get<string[]>('/admin/doctors/academic-titles');
        return res.data;
    },

    getDoctorById: async (id: number): Promise<AdminDoctor> => {
        const res = await axiosClient.get<AdminDoctor>(`/admin/doctors/${id}`);
        return res.data;
    },

    createDoctor: async (data: CreateDoctorInput): Promise<AdminDoctor> => {
        const res = await axiosClient.post<AdminDoctor>('/admin/doctors', data);
        return res.data;
    },

    updateDoctor: async (id: number, data: UpdateDoctorInput): Promise<AdminDoctor> => {
        const res = await axiosClient.put<AdminDoctor>(`/admin/doctors/${id}`, data);
        return res.data;
    },

    deleteDoctor: async (id: number): Promise<void> => {
        await axiosClient.delete(`/admin/doctors/${id}`);
    },

    getPatients: async (params?: {
        search?: string;
        page?: number;
        limit?: number;
        sortBy?: PatientSortBy;
        sortOrder?: PatientSortOrder;
        gender?: 'all' | 'male' | 'female';
        nationality?: string;
        ethnicity?: string;
        patientType?: 'all' | 'new' | 'returning';
        accountPhone?: string;
    }): Promise<PatientListResponse> => {
        const res = await axiosClient.get<PatientListResponse>('/admin/patients', { params });
        return res.data;
    },

    getPatientFilterOptions: async (): Promise<PatientFilterOptions> => {
        const res = await axiosClient.get<PatientFilterOptions>('/admin/patients/filter-options');
        return res.data;
    },

    getPatientById: async (id: number): Promise<AdminPatient> => {
        const res = await axiosClient.get<AdminPatient>(`/admin/patients/${id}`);
        return res.data;
    },

    createPatient: async (data: CreatePatientInput): Promise<AdminPatient> => {
        const res = await axiosClient.post<AdminPatient>('/admin/patients', data);
        return res.data;
    },

    updatePatient: async (id: number, data: UpdatePatientInput): Promise<AdminPatient> => {
        const res = await axiosClient.put<AdminPatient>(`/admin/patients/${id}`, data);
        return res.data;
    },

    deletePatient: async (id: number): Promise<void> => {
        await axiosClient.delete(`/admin/patients/${id}`);
    },

    getAccounts: async (params?: {
        search?: string;
        page?: number;
        limit?: number;
        role?: string;
        deletedStatus?: 'all' | 'active' | 'deleted';
    }): Promise<AccountListResponse> => {
        const res = await axiosClient.get<AccountListResponse>('/admin/accounts', { params });
        return res.data;
    },

    getAccountById: async (id: string): Promise<AdminAccountDetail> => {
        const res = await axiosClient.get<AdminAccountDetail>(`/admin/accounts/${encodeURIComponent(id)}`);
        return res.data;
    },

    createAccount: async (data: CreateAccountInput): Promise<AdminAccount> => {
        const res = await axiosClient.post<AdminAccount>('/admin/accounts', data);
        return res.data;
    },

    updateAccount: async (id: string, data: UpdateAccountInput): Promise<AdminAccount> => {
        const res = await axiosClient.put<AdminAccount>(`/admin/accounts/${encodeURIComponent(id)}`, data);
        return res.data;
    },

    deleteAccount: async (id: string): Promise<void> => {
        await axiosClient.delete(`/admin/accounts/${encodeURIComponent(id)}`);
    },

    getScheduleManagementOptions: async (): Promise<ScheduleManagementOptions> => {
        const res = await axiosClient.get<ScheduleManagementOptions>('/admin/schedule-management/options');
        return res.data;
    },

    getScheduleCycleOverview: async (weekStart?: string): Promise<ScheduleCycleOverview> => {
        const res = await axiosClient.get<ScheduleCycleOverview>('/admin/schedule-management/cycle-overview', {
            params: { weekStart },
        });
        return res.data;
    },

    getScheduleRegistrations: async (params?: {
        weekStart?: string;
        page?: number;
        limit?: number;
        specialtyId?: number;
        doctorId?: number;
        roomId?: number;
        status?: string;
        session?: string;
        date?: string;
        search?: string;
    }): Promise<ScheduleRegistrationsResponse> => {
        const res = await axiosClient.get<ScheduleRegistrationsResponse>('/admin/schedule-management/registrations', { params });
        return res.data;
    },

    updateScheduleRegistrationStatus: async (
        bsMa: number,
        date: string,
        session: string,
        data: { status: 'approved' | 'rejected'; adminNote?: string },
    ) => {
        const res = await axiosClient.put(
            `/admin/schedule-management/registrations/${bsMa}/${encodeURIComponent(date)}/${encodeURIComponent(session)}/status`,
            data,
        );
        return res.data;
    },

    getOfficialSchedules: async (params?: {
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
    }): Promise<ScheduleOfficialShiftsResponse> => {
        const res = await axiosClient.get<ScheduleOfficialShiftsResponse>('/admin/schedule-management/official-shifts', { params });
        return res.data;
    },

    getOfficialShiftFormContext: async (params: {
        date: string;
        roomId?: number;
        doctorId?: number;
        excludeBsMa?: number;
        excludeDate?: string;
        excludeSession?: string;
    }): Promise<OfficialShiftFormContextResponse> => {
        const res = await axiosClient.get<OfficialShiftFormContextResponse>('/admin/schedule-management/form-context', { params });
        return res.data;
    },

    createOfficialSchedule: async (data: {
        BS_MA: number;
        P_MA: number;
        N_NGAY: string;
        B_TEN: string;
        note?: string;
        status?: 'approved' | 'official';
    }) => {
        const res = await axiosClient.post('/admin/schedule-management/official-shifts', data);
        return res.data;
    },

    updateOfficialSchedule: async (
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

    deleteOfficialSchedule: async (bsMa: number, date: string, session: string): Promise<void> => {
        await axiosClient.delete(
            `/admin/schedule-management/official-shifts/${bsMa}/${encodeURIComponent(date)}/${encodeURIComponent(session)}`,
        );
    },

    finalizeScheduleWeek: async (
        weekStart: string,
        data?: { forceRefinalize?: boolean; generateSlots?: boolean; forceRegenerate?: boolean },
    ) => {
        const res = await axiosClient.post(`/admin/schedule-management/cycles/${encodeURIComponent(weekStart)}/finalize`, data);
        return res.data;
    },

    generateSlotsFromOfficialSchedule: async (
        weekStart: string,
        data?: { forceRegenerate?: boolean },
    ) => {
        const res = await axiosClient.post(
            `/admin/schedule-management/cycles/${encodeURIComponent(weekStart)}/generate-slots`,
            data,
        );
        return res.data;
    },

    // â”€â”€â”€ SERVICES CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    getServices: async (params?: {
        search?: string;
        page?: number;
        limit?: number;
        sortBy?: ServiceSortBy;
        sortOrder?: ServiceSortOrder;
        minPrice?: number;
        maxPrice?: number;
        serviceType?: string;
    }): Promise<ServiceListResponse> => {
        const res = await axiosClient.get<ServiceListResponse>('/admin/services', { params });
        return res.data;
    },

    getServiceById: async (id: number): Promise<AdminServiceItem> => {
        const res = await axiosClient.get<AdminServiceItem>(`/admin/services/${id}`);
        return res.data;
    },

    createService: async (data: CreateServiceInput): Promise<AdminServiceItem> => {
        const res = await axiosClient.post<AdminServiceItem>('/admin/services', data);
        return res.data;
    },

    updateService: async (id: number, data: UpdateServiceInput): Promise<AdminServiceItem> => {
        const res = await axiosClient.put<AdminServiceItem>(`/admin/services/${id}`, data);
        return res.data;
    },

    deleteService: async (id: number): Promise<void> => {
        await axiosClient.delete(`/admin/services/${id}`);
    },

    getMedicines: async (params?: {
        search?: string;
        page?: number;
        limit?: number;
        sortBy?: MedicineSortBy;
        sortOrder?: MedicineSortOrder;
        groupId?: number;
        manufacturerId?: number;
        minPrice?: number;
        maxPrice?: number;
        expirationStatus?: MedicineExpirationStatus;
    }): Promise<MedicineListResponse> => {
        const res = await axiosClient.get<MedicineListResponse>('/admin/medicines', { params });
        return res.data;
    },

    getMedicineFilterOptions: async (): Promise<MedicineFilterOptions> => {
        const res = await axiosClient.get<MedicineFilterOptions>('/admin/medicines/filter-options');
        return res.data;
    },

    getMedicineById: async (id: number): Promise<AdminMedicineItem> => {
        const res = await axiosClient.get<AdminMedicineItem>(`/admin/medicines/${id}`);
        return res.data;
    },

    createMedicine: async (data: CreateMedicineInput): Promise<AdminMedicineItem> => {
        const res = await axiosClient.post<AdminMedicineItem>('/admin/medicines', data);
        return res.data;
    },

    updateMedicine: async (id: number, data: UpdateMedicineInput): Promise<AdminMedicineItem> => {
        const res = await axiosClient.put<AdminMedicineItem>(`/admin/medicines/${id}`, data);
        return res.data;
    },

    updateMedicineBrandInfo: async (
        id: number,
        data: UpdateMedicineBrandInfoInput,
    ): Promise<AdminMedicineItem> => {
        const res = await axiosClient.put<AdminMedicineItem>(`/admin/medicines/${id}/brand-info`, data);
        return res.data;
    },

    deleteMedicine: async (id: number): Promise<void> => {
        await axiosClient.delete(`/admin/medicines/${id}`);
    },

    // â”€â”€â”€ SPECIALTIES CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    getSpecialtiesList: async (params?: {
        search?: string;
        page?: number;
        limit?: number;
        sortBy?: SpecialtySortBy;
        sortOrder?: SpecialtySortOrder;
    }): Promise<SpecialtyListResponse> => {
        const res = await axiosClient.get<SpecialtyListResponse>('/admin/specialties', { params });
        return res.data;
    },

    getSpecialtyById: async (id: number): Promise<AdminSpecialtyItem> => {
        const res = await axiosClient.get<AdminSpecialtyItem>(`/admin/specialties/${id}`);
        return res.data;
    },

    createSpecialty: async (data: CreateSpecialtyInput): Promise<AdminSpecialtyItem> => {
        const res = await axiosClient.post<AdminSpecialtyItem>('/admin/specialties', data);
        return res.data;
    },

    updateSpecialty: async (id: number, data: UpdateSpecialtyInput): Promise<AdminSpecialtyItem> => {
        const res = await axiosClient.put<AdminSpecialtyItem>(`/admin/specialties/${id}`, data);
        return res.data;
    },

    deleteSpecialty: async (id: number): Promise<void> => {
        await axiosClient.delete(`/admin/specialties/${id}`);
    },

    getRooms: async (params?: {
        search?: string;
        page?: number;
        limit?: number;
        sortBy?: RoomSortBy;
        sortOrder?: RoomSortOrder;
        specialtyId?: number;
    }): Promise<RoomListResponse> => {
        const res = await axiosClient.get<RoomListResponse>('/admin/rooms', { params });
        return res.data;
    },

    getRoomById: async (id: number): Promise<AdminRoomItem> => {
        const res = await axiosClient.get<AdminRoomItem>(`/admin/rooms/${id}`);
        return res.data;
    },

    createRoom: async (data: CreateRoomInput): Promise<AdminRoomItem> => {
        const res = await axiosClient.post<AdminRoomItem>('/admin/rooms', data);
        return res.data;
    },

    updateRoom: async (id: number, data: UpdateRoomInput): Promise<AdminRoomItem> => {
        const res = await axiosClient.put<AdminRoomItem>(`/admin/rooms/${id}`, data);
        return res.data;
    },

    deleteRoom: async (id: number): Promise<void> => {
        await axiosClient.delete(`/admin/rooms/${id}`);
    },

    // â”€â”€â”€ DASHBOARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    
    getDashboardSummary: async (): Promise<DashboardSummary> => {
        const res = await axiosClient.get<DashboardSummary>('/admin/dashboard/summary');
        return res.data;
    },

    getChartData: async (year: string, month: string) => {
        const res = await axiosClient.get(`/admin/dashboard/chart-data`, { params: { year, month } });
        return res.data;
    },

    getDashboardVisits: async (year: string, month: string, specialtyId?: string) => {
        const res = await axiosClient.get(`/admin/dashboard/visits`, { params: { year, month, specialtyId } });
        return res.data;
    },

    getDashboardTimeSlots: async (year: string, month: string) => {
        const res = await axiosClient.get(`/admin/dashboard/time-slots`, { params: { year, month } });
        return res.data;
    },

    getDashboardRevenue: async (year: string, month: string) => {
        const res = await axiosClient.get(`/admin/dashboard/revenue`, { params: { year, month } });
        return res.data;
    },

    getSpecialties: async () => {
        const res = await axiosClient.get<Pick<AdminSpecialtyItem, 'CK_MA' | 'CK_TEN'>[]>(`/admin/specialties`);
        return res.data;
    }
};


