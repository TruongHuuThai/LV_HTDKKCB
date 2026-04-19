import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { bookingApi } from '@/services/api/bookingApi';
import {
  useAppointmentDetail,
  useAppointmentPaymentStatus,
  useRescheduleAppointment,
  useRetryPayment,
} from '@/hooks/usePatientAppointments';
import { queryKeys } from '@/services/api/queryKeys';
import { appointmentsApi } from '@/services/api/appointmentsApi';
import {
  canOpenPaymentUrl,
  getAppointmentStatusLabel,
  getPaymentStatusLabel,
  getPaymentStatusTone,
  isRetryPaymentAllowed,
} from '@/lib/appointments';
import { getPatientFlowErrorMessage } from '@/lib/patientFlowError';
import { setLastPaymentContext } from '@/lib/patientPaymentFlow';
import { logFrontendError } from '@/lib/frontendLogger';

function toneClass(tone: string) {
  if (tone === 'success') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (tone === 'danger') return 'bg-red-100 text-red-700 border-red-200';
  if (tone === 'warning') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function getTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function canShowRescheduleSection(status?: string | null) {
  const normalized = String(status || '').toUpperCase();
  if (!normalized) return false;
  return !['DA_KHAM', 'HOAN_TAT', 'HUY', 'HUY_BS_NGHI', 'NO_SHOW'].includes(normalized);
}

function normalizeVietnamese(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parseClinicalSections(note?: string | null) {
  const lines = String(note || '')
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let clinicalNote = '';
  let diagnosisPreliminary = '';
  let diagnosisConfirmed = '';
  let treatmentPlan = '';

  for (const line of lines) {
    const normalized = normalizeVietnamese(line);
    const [_, rawValue = ''] = line.split(/:(.+)/, 2);
    const value = rawValue.trim() || line;

    if (normalized.startsWith('lam sang:')) {
      clinicalNote = value;
      continue;
    }
    if (normalized.startsWith('chan doan so bo:')) {
      diagnosisPreliminary = value;
      continue;
    }
    if (normalized.startsWith('chan doan xac dinh:')) {
      diagnosisConfirmed = value;
      continue;
    }
    if (normalized.startsWith('huong xu tri:') || normalized.startsWith('huong dieu tri:')) {
      treatmentPlan = value;
      continue;
    }
  }

  return { clinicalNote, diagnosisPreliminary, diagnosisConfirmed, treatmentPlan };
}

export default function AppointmentDetailPage() {
  const params = useParams<{ id: string }>();
  const appointmentId = Number.parseInt(params.id || '', 10) || 0;
  const [searchParams] = useSearchParams();
  const backToListHref = useMemo(() => {
    const keepKeys = ['statusGroup', 'page', 'keyword', 'profileId', 'fromDate', 'toDate'];
    const next = new URLSearchParams();
    keepKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value) next.set(key, value);
    });
    return `/appointments/my${next.toString() ? `?${next.toString()}` : ''}`;
  }, [searchParams]);

  const detailQuery = useAppointmentDetail(appointmentId);
  const paymentStatusQuery = useAppointmentPaymentStatus(appointmentId);

  const retryMutation = useRetryPayment();
  const rescheduleMutation = useRescheduleAppointment();

  const appointment = detailQuery.data?.appointment as Record<string, any> | undefined;
  const paymentStatus = paymentStatusQuery.data?.payment?.normalizedStatus || 'unpaid';
  const parsedClinicalSections = useMemo(
    () => parseClinicalSections(detailQuery.data?.preVisit?.note || ''),
    [detailQuery.data?.preVisit?.note],
  );

  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState(getTodayIso());
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);

  const doctorsQuery = useQuery({
    queryKey: queryKeys.booking.doctors('all', rescheduleDate, ''),
    queryFn: () => bookingApi.getAvailableDoctors({ date: rescheduleDate }),
    enabled: Boolean(rescheduleDate && appointmentId),
  });

  useEffect(() => {
    if (appointment?.BS_MA && !selectedDoctorId) {
      setSelectedDoctorId(Number(appointment.BS_MA));
    }
  }, [appointment?.BS_MA, selectedDoctorId]);

  const slotsQuery = useQuery({
    queryKey: queryKeys.booking.slots(selectedDoctorId, rescheduleDate),
    queryFn: () => bookingApi.getDoctorSlotsForDay(selectedDoctorId!, rescheduleDate),
    enabled: Boolean(selectedDoctorId && rescheduleDate),
  });

  const availableSlots = useMemo(
    () =>
      (slotsQuery.data || []).flatMap((session) =>
        session.slots
          .filter((slot) => slot.available)
          .map((slot) => ({
            ...slot,
            B_TEN: session.B_TEN,
            key: `${session.B_TEN}-${slot.KG_MA}`,
          })),
      ),
    [slotsQuery.data],
  );

  const selectedSlot = availableSlots.find((slot) => slot.key === selectedSlotKey) || null;

  const handleRetryPayment = () => {
    retryMutation.mutate(appointmentId, {
      onSuccess: (result) => {
        setLastPaymentContext({ appointmentId, createdAt: new Date().toISOString() });
        if (canOpenPaymentUrl(result.payment_url)) {
          window.location.assign(result.payment_url as string);
          return;
        }
        toast.success('Đã tạo yêu cầu thanh toán lại.');
      },
      onError: (error) => {
        logFrontendError('appointment-detail-retry-payment', error, { appointmentId });
        toast.error(getPatientFlowErrorMessage(error, 'Không thể thanh toán lại.'));
      },
    });
  };

  const handleReschedule = () => {
    if (!selectedSlot) {
      toast.error('Vui lòng chọn slot mới trước khi đổi lịch.');
      return;
    }
    rescheduleMutation.mutate(
      {
        appointmentId,
        payload: {
          newDoctorId: selectedDoctorId || undefined,
          newDate: rescheduleDate,
          newShift: selectedSlot.B_TEN,
          newSlotId: selectedSlot.KG_MA,
          reason: rescheduleReason || undefined,
        },
      },
      {
        onSuccess: (result) => {
          toast.success(result.message || 'Đổi lịch thành công.');
        },
        onError: (error) => {
          logFrontendError('appointment-detail-reschedule', error, { appointmentId });
          toast.error(getPatientFlowErrorMessage(error, 'Không thể đổi lịch hẹn này.'));
        },
      },
    );
  };

  if (!appointmentId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="py-10 text-center">Mã lịch hẹn không hợp lệ.</CardContent>
        </Card>
      </div>
    );
  }

  if (detailQuery.isLoading) {
    return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 text-slate-600">Đang tải chi tiết lịch hẹn...</div>;
  }

  if (detailQuery.isError || !appointment) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="space-y-3 py-8 text-red-700">
            <p>{getPatientFlowErrorMessage(detailQuery.error, 'Không thể tải chi tiết lịch hẹn.')}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => detailQuery.refetch()}>Thử lại</Button>
              <Button asChild variant="outline"><Link to={backToListHref}>Quay về danh sách</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const action = searchParams.get('action');
  const canReschedule = canShowRescheduleSection(appointment.DK_TRANG_THAI);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Button asChild variant="outline" size="sm">
          <Link to={backToListHref}>Quay về danh sách lịch hẹn</Link>
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Chi tiết lịch hẹn #{appointment.DK_MA}</CardTitle>
            <CardDescription>
              Theo dõi trạng thái lịch, thanh toán và các mốc thay đổi quan trọng.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Bác sĩ" value={appointment.LICH_BSK?.BAC_SI?.BS_HO_TEN || 'Chưa có dữ liệu'} />
              <InfoRow label="Chuyên khoa" value={appointment.LICH_BSK?.BAC_SI?.CHUYEN_KHOA?.CK_TEN || 'Chưa có dữ liệu'} />
              <InfoRow label="Ngày khám" value={String(appointment.N_NGAY || '').slice(0, 10)} />
              <InfoRow label="Buổi" value={appointment.B_TEN || 'Chưa có dữ liệu'} />
              <InfoRow label="Giờ khám" value={`${String(appointment.KHUNG_GIO?.KG_BAT_DAU || '').slice(11, 16)} - ${String(appointment.KHUNG_GIO?.KG_KET_THUC || '').slice(11, 16)}`} />
              <InfoRow label="Phòng" value={appointment.LICH_BSK?.PHONG?.P_TEN || 'Chưa có dữ liệu'} />
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="mb-2 font-medium text-slate-900">Thông tin tiền khám</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Triệu chứng</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {detailQuery.data?.preVisit?.symptoms || 'Chưa cập nhật'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Ghi chú</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {parsedClinicalSections.clinicalNote || detailQuery.data?.preVisit?.note || 'Chưa cập nhật'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Chẩn đoán sơ bộ</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {parsedClinicalSections.diagnosisPreliminary || 'Chưa cập nhật'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Chẩn đoán xác định</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {parsedClinicalSections.diagnosisConfirmed || 'Chưa cập nhật'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:col-span-2 lg:col-span-1">
                  <p className="text-xs text-slate-500">Hướng điều trị</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {parsedClinicalSections.treatmentPlan || 'Chưa cập nhật'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="mb-2 font-medium text-slate-900">Timeline thông báo gần nhất</p>
              {(detailQuery.data?.notifications || []).length === 0 ? (
                <p className="text-slate-500">Chưa có thông báo gần đây.</p>
              ) : (
                <ul className="space-y-2">
                  {(detailQuery.data?.notifications || []).map((item: any) => (
                    <li key={item.TB_MA || `${item.TB_THOI_GIAN}-${item.TB_LOAI}`} className="rounded-lg bg-slate-50 p-3">
                      <p className="font-medium text-slate-900">{item.TB_TIEU_DE || 'Thông báo'}</p>
                      <p className="text-slate-600">{item.TB_NOI_DUNG}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.TB_THOI_GIAN}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Trạng thái</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {getAppointmentStatusLabel(appointment.DK_TRANG_THAI)}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneClass(getPaymentStatusTone(paymentStatus))}`}>
                  {getPaymentStatusLabel(paymentStatus)}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    void (async () => {
                      try {
                        await appointmentsApi.downloadConfirmationPdf(appointmentId);
                      } catch (error) {
                        logFrontendError('appointment-detail-download-confirmation', error, {
                          appointmentId,
                        });
                        toast.error('Không thể tải phiếu xác nhận lúc này.');
                      }
                    })();
                  }}
                >
                  In xác nhận PDF
                </Button>

                {isRetryPaymentAllowed(paymentStatus) ? (
                  <Button onClick={handleRetryPayment} disabled={retryMutation.isPending}>
                    {retryMutation.isPending ? 'Đang tạo thanh toán lại...' : 'Thanh toán lại'}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {canReschedule ? (
            <Card className={`border-slate-200 ${action === 'reschedule' ? 'ring-2 ring-blue-200' : ''}`}>
              <CardHeader>
                <CardTitle>Đổi lịch khám</CardTitle>
                <CardDescription>
                  Chọn bác sĩ, ngày và slot mới. Hệ thống sẽ kiểm tra tính hợp lệ trước khi cập nhật.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input type="date" value={rescheduleDate} min={getTodayIso()} onChange={(event) => setRescheduleDate(event.target.value)} />
                <Select
                  value={selectedDoctorId ? String(selectedDoctorId) : undefined}
                  onValueChange={(value) => {
                    setSelectedDoctorId(Number(value));
                    setSelectedSlotKey(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn bác sĩ" />
                  </SelectTrigger>
                  <SelectContent>
                    {(doctorsQuery.data || []).map((doctor) => (
                      <SelectItem key={doctor.BS_MA} value={String(doctor.BS_MA)}>
                        {doctor.BS_HO_TEN}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedSlotKey || undefined}
                  onValueChange={setSelectedSlotKey}
                  disabled={!selectedDoctorId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn slot mới" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map((slot) => (
                      <SelectItem key={slot.key} value={slot.key}>
                        {slot.B_TEN} · {slot.KG_BAT_DAU.slice(11, 16)} - {slot.KG_KET_THUC.slice(11, 16)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Textarea
                  placeholder="Lý do đổi lịch (không bắt buộc)"
                  value={rescheduleReason}
                  onChange={(event) => setRescheduleReason(event.target.value)}
                  rows={3}
                />

                <Button onClick={handleReschedule} disabled={rescheduleMutation.isPending || !selectedSlot}>
                  {rescheduleMutation.isPending ? 'Đang đổi lịch...' : 'Xác nhận đổi lịch'}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium text-slate-900">{value || '—'}</p>
    </div>
  );
}

