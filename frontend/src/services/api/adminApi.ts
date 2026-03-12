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

// ─── DASHBOARD INTERFACES ─────────────────────────────────────
export interface DashboardStats {
    totalPatients: number;
    totalDoctors: number;
    activeServices: number;
    newContacts: number;
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
    stats: DashboardStats;
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

    // ─── DASHBOARD ───────────────────────────────────────────────
    
    getDashboardSummary: async (): Promise<DashboardSummary> => {
        const res = await axiosClient.get<DashboardSummary>('/admin/dashboard/summary');
        return res.data;
    }
};
