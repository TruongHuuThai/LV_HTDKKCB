import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  appointmentsApi,
  type AppointmentListQuery,
  type CancelPayload,
  type ReschedulePayload,
} from '@/services/api/appointmentsApi';
import { queryKeys } from '@/services/api/queryKeys';

export function useMyAppointments(query: AppointmentListQuery) {
  return useQuery({
    queryKey: queryKeys.appointments.my(query),
    queryFn: () => appointmentsApi.listMy(query),
  });
}

export function useAppointmentDetail(appointmentId: number) {
  return useQuery({
    queryKey: queryKeys.appointments.detail(appointmentId),
    queryFn: () => appointmentsApi.getDetail(appointmentId),
    enabled: Number.isFinite(appointmentId) && appointmentId > 0,
  });
}

export function useAppointmentPaymentStatus(appointmentId: number) {
  return useQuery({
    queryKey: queryKeys.appointments.paymentStatus(appointmentId),
    queryFn: () => appointmentsApi.getPaymentStatus(appointmentId),
    enabled: Number.isFinite(appointmentId) && appointmentId > 0,
  });
}

export function useAppointmentCancelPolicy(appointmentId: number) {
  return useQuery({
    queryKey: queryKeys.appointments.cancelPolicy(appointmentId),
    queryFn: () => appointmentsApi.getCancelPolicy(appointmentId),
    enabled: Number.isFinite(appointmentId) && appointmentId > 0,
  });
}

export function useRetryPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: number) => appointmentsApi.retryPayment(appointmentId),
    onSuccess: (_, appointmentId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments.paymentStatus(appointmentId) });
      void queryClient.invalidateQueries({ queryKey: ['appointments-my'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments.detail(appointmentId) });
    },
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ appointmentId, payload }: { appointmentId: number; payload: CancelPayload }) =>
      appointmentsApi.cancel(appointmentId, payload),
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments-my'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments.detail(vars.appointmentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments.cancelPolicy(vars.appointmentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments.paymentStatus(vars.appointmentId) });
    },
  });
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ appointmentId, payload }: { appointmentId: number; payload: ReschedulePayload }) =>
      appointmentsApi.reschedule(appointmentId, payload),
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments-my'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments.detail(vars.appointmentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments.cancelPolicy(vars.appointmentId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments.paymentStatus(vars.appointmentId) });
    },
  });
}
