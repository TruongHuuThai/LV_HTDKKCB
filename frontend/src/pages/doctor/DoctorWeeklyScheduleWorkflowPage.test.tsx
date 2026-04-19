import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DoctorWeeklyScheduleWorkflowPage from '@/pages/doctor/DoctorWeeklyScheduleWorkflowPage';

const getWeeklySchedulesMock = vi.fn();
const getWorklistMock = vi.fn();
const getPreVisitInfoMock = vi.fn();

vi.mock('@/services/api/scheduleWorkflowApi', () => ({
  doctorScheduleWorkflowApi: {
    getWeeklySchedules: (...args: unknown[]) => getWeeklySchedulesMock(...args),
  },
}));

vi.mock('@/services/api/doctorAppointmentsApi', () => ({
  doctorAppointmentsApi: {
    getWorklist: (...args: unknown[]) => getWorklistMock(...args),
    getPreVisitInfo: (...args: unknown[]) => getPreVisitInfoMock(...args),
    exportWorklistPdf: vi.fn(),
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
      <DoctorWeeklyScheduleWorkflowPage />
    </QueryClientProvider>,
  );
}

describe('DoctorWeeklyScheduleWorkflowPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows empty-week state', async () => {
    getWeeklySchedulesMock.mockResolvedValue({
      items: [],
      meta: { total: 0, page: 1, limit: 50, totalPages: 1, weekStart: '2026-04-20', workflowStatus: 'generated' },
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /xem/i }).length).toBeGreaterThan(1);
    });
  });

  it('opens patient list and quick info flow from timetable cell', async () => {
    getWeeklySchedulesMock.mockImplementation(async (weekStart: string) => ({
      items: [
        {
          BS_MA: 1,
          N_NGAY: weekStart,
          B_TEN: 'SANG',
          P_MA: 1,
          status: 'generated',
          source: 'template',
          note: null,
          confirmationAt: null,
          createdAt: null,
          updatedAt: null,
          slotCount: 8,
          slotMax: 10,
          bookingCount: 2,
          doctor: { BS_MA: 1, BS_HO_TEN: 'BS Test', CK_MA: 1, CHUYEN_KHOA: { CK_TEN: 'CK Test' } },
          room: { P_MA: 1, P_TEN: 'Room 1', CK_MA: 1, CHUYEN_KHOA: { CK_TEN: 'CK Test' } },
          template: null,
          latestException: null,
          weekStatus: 'generated',
          finalizedAt: null,
          slotOpenedAt: null,
        },
      ],
      meta: { total: 1, page: 1, limit: 50, totalPages: 1, weekStart, workflowStatus: 'generated' },
    }));

    getWorklistMock.mockResolvedValue({
      items: [
        {
          DK_MA: 11,
          BN_MA: 101,
          patientName: 'Patient A',
          patientDob: '1990-01-01',
          patientPhone: '0909123456',
          N_NGAY: '2026-04-20',
          B_TEN: 'SANG',
          KG_MA: 1,
          KG_BAT_DAU: '08:30:00',
          KG_KET_THUC: '09:00:00',
          DK_TRANG_THAI: 'CHO_KHAM',
          note: null,
          preVisitSymptoms: 'Sot nhe',
          preVisitNote: null,
          paymentStatus: 'paid',
          roomId: 1,
          roomName: 'Room 1',
        },
      ],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    getPreVisitInfoMock.mockResolvedValue({
      appointmentId: 11,
      patientId: 101,
      doctorId: 1,
      symptoms: 'Sot nhe',
      note: 'Theo doi 2 ngay',
      updatedAt: null,
      updatedBy: null,
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Room 1')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Room 1'));
    await waitFor(() => expect(screen.getByText(/Patient A/)).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Patient A/));
    await waitFor(() => expect(screen.getByText(/Theo doi 2 ngay/)).toBeInTheDocument());
  });

});
