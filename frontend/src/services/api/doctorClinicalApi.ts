import axiosClient from './axiosClient';
import { downloadPdf } from './pdfApi';

export interface DoctorClinicalCatalogQuery {
  keyword?: string;
  limit?: number;
}

export interface DoctorClinicalServiceCatalogItem {
  DVCLS_MA: number;
  DVCLS_TEN: string;
  DVCLS_LOAI?: string | null;
  DVCLS_GIA_DV?: number | null;
}

export interface DoctorMedicineCatalogItem {
  T_MA: number;
  T_TEN_THUOC: string;
  T_GIA_THUOC?: number | null;
  DON_VI_TINH?: { DVT_TEN: string } | null;
}

export interface DoctorExamWorkflowResponse {
  appointment: {
    id: number;
    status: string;
    date: string;
    shift: string;
    slot: { id: number; start: string; end: string };
  };
  patient: { id: number; name: string; phone: string | null };
  doctor: { id: number; name: string | null; specialty: string | null; room: string | null };
  encounter: {
    id: number;
    symptoms: string | null;
    conclusion: string | null;
    clinicalNotes: string | null;
  } | null;
  orders: Array<{
    orderId: number;
    serviceId: number;
    serviceName: string | null;
    serviceType: string | null;
    price: number;
    isCompleted: boolean;
    status: string;
    result: {
      summary: string | null;
      imageUrl: string | null;
      payload: Record<string, unknown> | null;
    } | null;
  }>;
  prescriptions: Array<{
    prescriptionId: number;
    note: string | null;
    days: number | null;
    createdAt: string | null;
    items: Array<{
      medicineId: number;
      medicineName: string | null;
      quantity: number;
      dosage: string | null;
      usage: string | null;
    }>;
  }>;
  billing: {
    latest: any;
    normalizedStatus: string;
  };
  workflow: {
    clinicalStatus: string;
    financialStatus: string;
    hasPendingOrders: boolean;
    canFinishClinical: boolean;
  };
}

export const doctorClinicalApi = {
  getClinicalServiceCatalog: async (params?: DoctorClinicalCatalogQuery) => {
    const res = await axiosClient.get<{ items: DoctorClinicalServiceCatalogItem[] }>(
      '/doctor/appointments/catalog/clinical-services',
      { params },
    );
    return res.data;
  },

  getMedicineCatalog: async (params?: DoctorClinicalCatalogQuery) => {
    const res = await axiosClient.get<{ items: DoctorMedicineCatalogItem[] }>(
      '/doctor/appointments/catalog/medicines',
      { params },
    );
    return res.data;
  },

  startExam: async (appointmentId: number, note?: string) => {
    const res = await axiosClient.patch<DoctorExamWorkflowResponse>(
      `/doctor/appointments/${appointmentId}/start-exam`,
      { note },
    );
    return res.data;
  },

  getExamWorkflow: async (appointmentId: number) => {
    const res = await axiosClient.get<DoctorExamWorkflowResponse>(
      `/doctor/appointments/${appointmentId}/exam-workflow`,
    );
    return res.data;
  },

  updateClinicalNote: async (
    appointmentId: number,
    payload: {
      symptoms?: string;
      clinicalNotes?: string;
      diagnosisPreliminary?: string;
      diagnosisFinal?: string;
      conclusion?: string;
      treatmentPlan?: string;
    },
  ) => {
    const res = await axiosClient.patch<DoctorExamWorkflowResponse>(
      `/doctor/appointments/${appointmentId}/clinical-note`,
      payload,
    );
    return res.data;
  },

  createOrders: async (
    appointmentId: number,
    items: Array<{ serviceId: number; note?: string }>,
  ) => {
    const res = await axiosClient.post<DoctorExamWorkflowResponse>(
      `/doctor/appointments/${appointmentId}/orders`,
      { items },
    );
    return res.data;
  },

  downloadOrderPdf: async (appointmentId: number, orderId: number) => {
    await downloadPdf(`/doctor/appointments/${appointmentId}/orders/${orderId}/pdf`, {
      fallbackFilename: `chi-dinh-can-lam-sang-${appointmentId}-${orderId}.pdf`,
    });
  },

  previewOrderPdf: async (appointmentId: number, orderId: number) => {
    const res = await axiosClient.get<BlobPart>(
      `/doctor/appointments/${appointmentId}/orders/${orderId}/pdf`,
      { responseType: 'blob' },
    );
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const objectUrl = window.URL.createObjectURL(blob);
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
  },

  printOrderPdf: async (appointmentId: number, orderId: number) => {
    const res = await axiosClient.get<BlobPart>(
      `/doctor/appointments/${appointmentId}/orders/${orderId}/pdf`,
      { responseType: 'blob' },
    );
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const objectUrl = window.URL.createObjectURL(blob);
    const printWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer');
    if (printWindow) {
      const triggerPrint = () => printWindow.print();
      printWindow.addEventListener('load', triggerPrint, { once: true });
      setTimeout(triggerPrint, 800);
    }
  },

  updateOrderResult: async (
    appointmentId: number,
    orderId: number,
    serviceId: number,
    payload: {
      resultSummary?: string;
      resultPayload?: Record<string, unknown>;
      imageUrl?: string;
    },
  ) => {
    const res = await axiosClient.patch<DoctorExamWorkflowResponse>(
      `/doctor/appointments/${appointmentId}/orders/${orderId}/services/${serviceId}/result`,
      payload,
    );
    return res.data;
  },

  createPrescription: async (
    appointmentId: number,
    payload: {
      items: Array<{
        medicineId: number;
        quantity: number;
        dosage?: string;
        usage?: string;
      }>;
      note?: string;
      days?: number;
    },
  ) => {
    const res = await axiosClient.post<DoctorExamWorkflowResponse>(
      `/doctor/appointments/${appointmentId}/prescriptions`,
      payload,
    );
    return res.data;
  },

  finishClinical: async (appointmentId: number, allowIncompleteOrders = false) => {
    const res = await axiosClient.patch<DoctorExamWorkflowResponse>(
      `/doctor/appointments/${appointmentId}/finish-clinical`,
      { allowIncompleteOrders },
    );
    return res.data;
  },

  generateBilling: async (appointmentId: number, paymentMethod = 'QR_BANKING') => {
    const res = await axiosClient.post<DoctorExamWorkflowResponse>(
      `/doctor/appointments/${appointmentId}/billing/generate`,
      { paymentMethod },
    );
    return res.data;
  },

  markPaymentPaid: async (
    appointmentId: number,
    paymentId: number,
    payload?: { transactionCode?: string; paymentGateway?: string },
  ) => {
    const res = await axiosClient.patch<DoctorExamWorkflowResponse>(
      `/doctor/appointments/${appointmentId}/billing/${paymentId}/mark-paid`,
      payload || {},
    );
    return res.data;
  },

  completeEncounter: async (appointmentId: number, note?: string) => {
    const res = await axiosClient.patch<DoctorExamWorkflowResponse>(
      `/doctor/appointments/${appointmentId}/complete`,
      { note },
    );
    return res.data;
  },

  completeExam: async (
    appointmentId: number,
    payload?: { allowIncompleteOrders?: boolean; note?: string },
  ) => {
    const res = await axiosClient.patch<DoctorExamWorkflowResponse>(
      `/doctor/appointments/${appointmentId}/complete-exam`,
      payload || {},
    );
    return res.data;
  },
};
