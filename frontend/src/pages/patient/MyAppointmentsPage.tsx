import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CreditCard, RotateCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMyAppointments } from '@/hooks/usePatientAppointments';
import { appointmentsApi, type AppointmentListQuery } from '@/services/api/appointmentsApi';
import { queryKeys } from '@/services/api/queryKeys';
import {
  getAppointmentStatusLabel,
  getPaymentStatusLabel,
  getPaymentStatusTone,
  getStatusGroupLabel,
  type AppointmentStatusGroup,
} from '@/lib/appointments';
import { getPatientFlowErrorMessage } from '@/lib/patientFlowError';
import { setLastPaymentContext } from '@/lib/patientPaymentFlow';
import { canOpenPaymentUrl } from '@/lib/appointments';
import { logFrontendError } from '@/lib/frontendLogger';

const statusGroups: AppointmentStatusGroup[] = ['upcoming', 'completed', 'canceled', 'no_show'];

function toneClass(tone: string) {
  if (tone === 'success') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (tone === 'danger') return 'bg-red-100 text-red-700 border-red-200';
  if (tone === 'warning') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

export default function MyAppointmentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const currentGroup = (searchParams.get('statusGroup') as AppointmentStatusGroup) || 'upcoming';
  const page = Number.parseInt(searchParams.get('page') || '1', 10) || 1;
  const keyword = searchParams.get('keyword') || '';

  const params: AppointmentListQuery = useMemo(
    () => ({ statusGroup: currentGroup, page, limit: 10, keyword: keyword || undefined }),
    [currentGroup, page, keyword],
  );

  const listQuery = useMyAppointments(params);

  const retryMutation = useMutation({
    mutationFn: (appointmentId: number) => appointmentsApi.retryPayment(appointmentId),
    onSuccess: (result, appointmentId) => {
      setLastPaymentContext({ appointmentId, createdAt: new Date().toISOString() });
      if (canOpenPaymentUrl(result.payment_url)) {
        window.location.assign(result.payment_url as string);
        return;
      }
      toast.success('Ð? t?o yêu c?u thanh toán l?i.');
      void queryClient.invalidateQueries({ queryKey: ['appointments-my'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments.paymentStatus(appointmentId) });
    },
    onError: (error) => {
      logFrontendError('my-appointments-retry-payment', error);
      toast.error(getPatientFlowErrorMessage(error, 'Không th? thanh toán l?i lúc này.'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (appointmentId: number) => appointmentsApi.cancel(appointmentId, { reason: 'B?nh nhân ch? ð?ng h?y', source: 'WEB' }),
    onSuccess: () => {
      toast.success('Ð? h?y l?ch h?n.');
      void queryClient.invalidateQueries({ queryKey: ['appointments-my'] });
    },
    onError: (error) => {
      logFrontendError('my-appointments-cancel', error);
      toast.error(getPatientFlowErrorMessage(error, 'Không th? h?y l?ch h?n.'));
    },
  });

  const updateSearchParam = (next: Partial<{ statusGroup: string; page: string; keyword: string }>) => {
    const merged = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (!value) merged.delete(key);
      else merged.set(key, value);
    });
    setSearchParams(merged);
  };

  const items = listQuery.data?.items || [];
  const meta = listQuery.data?.meta;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>L?ch h?n c?a tôi</CardTitle>
          <CardDescription>
            Theo d?i tr?ng thái khám và thanh toán. B?n có th? thanh toán l?i, ð?i l?ch ho?c h?y l?ch theo chính sách h? th?ng.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {statusGroups.map((group) => (
              <Button
                key={group}
                size="sm"
                variant={group === currentGroup ? 'default' : 'outline'}
                onClick={() => updateSearchParam({ statusGroup: group, page: '1' })}
              >
                {getStatusGroupLabel(group)}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="T?m theo m? l?ch h?n, bác s?..."
              value={keyword}
              onChange={(event) => updateSearchParam({ keyword: event.target.value, page: '1' })}
            />
            <Select
              value={String(page)}
              onValueChange={(value) => updateSearchParam({ page: value })}
            >
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Trang" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: Math.max(meta?.totalPages || 1, 1) }).map((_, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    Trang {idx + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {listQuery.isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">Ðang t?i l?ch h?n...</div>
          ) : listQuery.isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              {getPatientFlowErrorMessage(listQuery.error, 'Không th? t?i danh sách l?ch h?n.')}
              <Button variant="outline" className="ml-3" onClick={() => listQuery.refetch()}>
                Th? l?i
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <CalendarDays className="mx-auto mb-3 h-8 w-8 text-slate-400" />
              <p className="text-lg font-semibold text-slate-900">B?n chýa có l?ch h?n ? nhóm này</p>
              <p className="mt-2 text-sm text-slate-600">H?y t?o l?ch m?i ð? b?t ð?u theo d?i t?i ðây.</p>
              <Button asChild className="mt-4">
                <Link to="/booking">Ð?t l?ch ngay</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <article key={item.appointmentId} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-500">M? l?ch h?n #{item.appointmentId}</p>
                      <h3 className="text-lg font-semibold text-slate-900">{item.doctor?.BS_HO_TEN || 'Bác s? chýa xác ð?nh'}</h3>
                      <p className="text-sm text-slate-600">{item.specialty?.CK_TEN || 'Chýa có chuyên khoa'} · {item.room?.P_TEN || 'Chýa có ph?ng'}</p>
                      <p className="text-sm text-slate-600">
                        {item.N_NGAY?.slice(0, 10)} · {item.KG_BAT_DAU?.slice(11, 16) || '--:--'} - {item.KG_KET_THUC?.slice(11, 16) || '--:--'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {getAppointmentStatusLabel(item.status)}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneClass(getPaymentStatusTone(item.paymentStatus))}`}>
                        {getPaymentStatusLabel(item.paymentStatus)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/appointments/${item.appointmentId}`}>Xem chi ti?t</Link>
                    </Button>

                    {item.canReschedule ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/appointments/${item.appointmentId}?action=reschedule`}>Ð?i l?ch</Link>
                      </Button>
                    ) : null}

                    {item.canCancel ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancelMutation.mutate(item.appointmentId)}
                        disabled={cancelMutation.isPending}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        H?y l?ch
                      </Button>
                    ) : null}

                    {(item.paymentStatus === 'unpaid' || item.paymentStatus === 'failed' || item.paymentStatus === 'expired') ? (
                      <Button
                        size="sm"
                        onClick={() => retryMutation.mutate(item.appointmentId)}
                        disabled={retryMutation.isPending}
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        Thanh toán l?i
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}

          {meta ? (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-600">
              <p>
                Hi?n th? {(meta.page - 1) * meta.limit + 1} - {(meta.page - 1) * meta.limit + items.length} / {meta.total}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateSearchParam({ page: String(Math.max(1, page - 1)) })}
                  disabled={page <= 1}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Trang trý?c
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateSearchParam({ page: String(Math.min(meta.totalPages, page + 1)) })}
                  disabled={page >= meta.totalPages}
                >
                  Trang sau
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
