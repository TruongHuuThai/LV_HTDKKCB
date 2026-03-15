// src/services/api/adminApi.ts
import axiosClient from './axiosClient';

// Tạm thời định nghĩa types ở đây, có thể chuyển ra file types/ riêng sau
export interface AdminDoctor {
    BS_MA: number;
    BS_HO_TEN: string;
    BS_HOC_HAM: string | null;
    BS_ANH: string | null;
    BS_GIOI_THIEU: string | null;
    BS_KINH_NGHIEM: number | null;
    CK_MA: number;
    TRANG_THAI?: 'ACTIVE' | 'HIDDEN' | string;
    BS_SDT?: string | null;
    CHUYEN_KHOA?: {
        CK_TEN: string;
    };
    // ... other fields as needed
}

export type CreateDoctorInput = Omit<AdminDoctor, 'BS_MA'>;
export type UpdateDoctorInput = Partial<CreateDoctorInput>;

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

// ─── DASHBOARD INTERFACES ─────────────────────────────────────
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
    // ─── DOCTORS CRUD ─────────────────────────────────────────────
    
    getDoctors: async (params?: Record<string, unknown>): Promise<AdminDoctor[]> => {
        const res = await axiosClient.get<AdminDoctor[]>('/admin/doctors', { params });
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

    // ─── SERVICES CRUD ────────────────────────────────────────────
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

    // ─── DASHBOARD ───────────────────────────────────────────────
    
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
        const res = await axiosClient.get(`/admin/specialties`);
        return res.data;
    }
};
