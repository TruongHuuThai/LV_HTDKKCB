import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DoctorClinicalWorkflowPage from '@/pages/doctor/DoctorClinicalWorkflowPage';

const getWorklistMock = vi.fn();
const getWorkflowMock = vi.fn();
const getServiceCatalogMock = vi.fn();
const getMedicineCatalogMock = vi.fn();
const completeExamMock = vi.fn();

vi.mock('@/services/api/doctorAppointmentsApi', () => ({
  doctorAppointmentsApi: {
    getWorklist: (...args: unknown[]) => getWorklistMock(...args),
  },
}));

vi.mock('@/services/api/doctorClinicalApi', () => ({
  doctorClinicalApi: {
    getExamWorkflow: (...args: unknown[]) => getWorkflowMock(...args),
    getClinicalServiceCatalog: (...args: unknown[]) => getServiceCatalogMock(...args),
    getMedicineCatalog: (...args: unknown[]) => getMedicineCatalogMock(...args),
    startExam: vi.fn(),
    updateClinicalNote: vi.fn(),
    createOrders: vi.fn(),
    updateOrderResult: vi.fn(),
    createPrescription: vi.fn(),
    completeExam: (...args: unknown[]) => completeExamMock(...args),
    previewOrderPdf: vi.fn(),
    downloadOrderPdf: vi.fn(),
    printOrderPdf: vi.fn(),
  },
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <DoctorClinicalWorkflowPage />
    </QueryClientProvider>,
  );
}

describe('DoctorClinicalWorkflowPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getServiceCatalogMock.mockResolvedValue({ items: [] });
    getMedicineCatalogMock.mockResolvedValue({ items: [] });
  });

  it('renders order pdf actions after loading workflow', async () => {
    getWorklistMock.mockResolvedValue({
      items: [
        {
          DK_MA: 26,
          BN_MA: 17,
          patientName: 'Nguyen Van A',
          patientDob: '1990-01-01',
          patientPhone: '0909000000',
          N_NGAY: '2026-05-11',
          B_TEN: 'SANG',
          KG_MA: 1,
          KG_BAT_DAU: '08:00:00',
          KG_KET_THUC: '08:30:00',
          DK_TRANG_THAI: 'DA_CHECKIN',
          note: null,
          preVisitSymptoms: null,
          preVisitNote: null,
          paymentStatus: 'unpaid',
          roomId: 2,
          roomName: 'Phong 2',
        },
      ],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    getWorkflowMock.mockResolvedValue({
      appointment: { id: 26, status: 'DA_CHECKIN', date: '2026-05-11', shift: 'SANG', slot: { id: 1, start: '08:00', end: '08:30' } },
      patient: { id: 17, name: 'Nguyen Van A', phone: '0909000000' },
      doctor: { id: 1, name: 'BS 1', specialty: 'Co xuong khop', room: 'Phong 2' },
      encounter: { id: 10, symptoms: 'Sot', conclusion: 'Can theo doi', clinicalNotes: 'Ghi chu' },
      orders: [
        {
          orderId: 501,
          serviceId: 22,
          serviceName: 'Xet nghiem mau',
          serviceType: 'XET_NGHIEM',
          quantity: 1,
          price: 200000,
          lineTotal: 200000,
          isCompleted: false,
          status: 'MOI_TAO',
          pdfUrl: '/doctor/appointments/26/orders/501/pdf',
          result: null,
        },
      ],
      prescriptions: [],
      billing: { latest: null, normalizedStatus: 'CHUA_LAP_HOA_DON' },
      workflow: {
        clinicalStatus: 'DANG_KHAM',
        financialStatus: 'CHUA_LAP_HOA_DON',
        hasPendingOrders: true,
        canFinishClinical: false,
      },
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /tiếp tục khám/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /tiếp tục khám/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /xem pdf/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /tải pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /in phiếu/i })).toBeInTheDocument();
  });

  it('opens confirm modal and calls complete exam', async () => {
    completeExamMock.mockResolvedValue({});
    getWorklistMock.mockResolvedValue({
      items: [
        {
          DK_MA: 26,
          BN_MA: 17,
          patientName: 'Nguyen Van A',
          patientDob: '1990-01-01',
          patientPhone: '0909000000',
          N_NGAY: '2026-05-11',
          B_TEN: 'SANG',
          KG_MA: 1,
          KG_BAT_DAU: '08:00:00',
          KG_KET_THUC: '08:30:00',
          DK_TRANG_THAI: 'DA_CHECKIN',
          note: null,
          preVisitSymptoms: null,
          preVisitNote: null,
          paymentStatus: 'unpaid',
          roomId: 2,
          roomName: 'Phong 2',
        },
      ],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    getWorkflowMock.mockResolvedValue({
      appointment: { id: 26, status: 'DA_CHECKIN', date: '2026-05-11', shift: 'SANG', slot: { id: 1, start: '08:00', end: '08:30' } },
      patient: { id: 17, name: 'Nguyen Van A', phone: '0909000000' },
      doctor: { id: 1, name: 'BS 1', specialty: 'Co xuong khop', room: 'Phong 2' },
      encounter: { id: 10, symptoms: 'Sot', conclusion: 'On dinh, dieu tri ngoai tru', clinicalNotes: 'Ghi chu' },
      orders: [],
      prescriptions: [],
      billing: { latest: null, normalizedStatus: 'CHUA_LAP_HOA_DON' },
      workflow: {
        clinicalStatus: 'DANG_KHAM',
        financialStatus: 'CHUA_LAP_HOA_DON',
        hasPendingOrders: false,
        canFinishClinical: true,
      },
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /tiếp tục khám/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /tiếp tục khám/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^xác nhận khám hoàn tất$/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^xác nhận khám hoàn tất$/i }));
    await waitFor(() => expect(screen.getByText(/xác nhận hoàn tất ca khám/i)).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /^xác nhận khám hoàn tất$/i })[0]);
    await waitFor(() => expect(completeExamMock).toHaveBeenCalledTimes(1));
    expect(completeExamMock).toHaveBeenCalledWith(26, { allowIncompleteOrders: false });
  });
});
