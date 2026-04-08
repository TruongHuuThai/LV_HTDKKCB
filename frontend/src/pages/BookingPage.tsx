import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock3, LoaderCircle, Search, Stethoscope, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import PatientProfileSummaryCard from '@/components/patient/PatientProfileSummaryCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSpecialties } from '@/hooks/useSpecialties';
import { getPatientProfileFullName } from '@/lib/patientProfiles';
import { formatDateDdMmYyyy, getSessionLabel } from '@/lib/scheduleDisplay';
import { bookingApi } from '@/services/api/bookingApi';
import { patientProfilesApi } from '@/services/api/patientProfilesApi';
import { queryKeys } from '@/services/api/queryKeys';
import { useAuthStore } from '@/store/useAuthStore';
import { usePatientProfilesStore } from '@/store/usePatientProfilesStore';
import { canOpenPaymentUrl } from '@/lib/appointments';
import { getPatientFlowErrorMessage } from '@/lib/patientFlowError';
import { setLastPaymentContext } from '@/lib/patientPaymentFlow';
import { logFrontendError } from '@/lib/frontendLogger';
import {
  BOOKING_REASON_LABELS,
  pickTopBookingReason,
} from '@/lib/bookingAvailabilityDisplay';
import { SCHEDULE_STATUS_CONTRACT_VERSION } from '@/contracts/scheduleStatusContract';

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function maxBookingDateIso() {
  const max = new Date();
  max.setMonth(max.getMonth() + 3);
  const year = max.getFullYear();
  const month = String(max.getMonth() + 1).padStart(2, '0');
  const day = String(max.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeVietnameseText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase()
    .trim();
}

export default function BookingPage() {
  const user = useAuthStore((state) => state.user);
  const selectedProfileId = usePatientProfilesStore(
    (state) => state.selectedByAccount[user?.TK_SDT ?? ''],
  );
  const setSelectedProfile = usePatientProfilesStore((state) => state.setSelectedProfile);

  const [specialtyId, setSpecialtyId] = useState<string>('all');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [debouncedDoctorSearch, setDebouncedDoctorSearch] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [preVisitNote, setPreVisitNote] = useState('');
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);

  const { data: specialties } = useSpecialties();

  const profilesQuery = useQuery({
    queryKey: queryKeys.patientProfiles.mine,
    queryFn: patientProfilesApi.listMine,
    enabled: Boolean(user?.TK_SDT),
  });

  const activeProfiles = (profilesQuery.data?.items ?? []).filter((item) => item.BN_DA_VO_HIEU !== true);
  const selectedProfile = activeProfiles.find((item) => item.BN_MA === selectedProfileId) || null;

  useEffect(() => {
    if (!user?.TK_SDT || activeProfiles.length !== 1) return;
    if (selectedProfileId !== activeProfiles[0].BN_MA) {
      setSelectedProfile(user.TK_SDT, activeProfiles[0].BN_MA);
    }
  }, [activeProfiles, selectedProfileId, setSelectedProfile, user?.TK_SDT]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedDoctorSearch(doctorSearch.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [doctorSearch]);

  const doctorsQuery = useQuery({
    queryKey: queryKeys.booking.doctors(specialtyId, selectedDate, debouncedDoctorSearch),
    queryFn: () =>
      bookingApi.getAvailableDoctors({
        date: selectedDate.trim() ? selectedDate : undefined,
        specialtyId: specialtyId === 'all' ? undefined : Number(specialtyId),
        q: debouncedDoctorSearch || undefined,
      }),
    enabled: Boolean(user?.TK_SDT && selectedProfile),
  });

  const filteredDoctors = useMemo(() => {
    const keyword = normalizeVietnameseText(debouncedDoctorSearch);
    if (!keyword) return doctorsQuery.data ?? [];
    return (doctorsQuery.data ?? []).filter((doctor) =>
      normalizeVietnameseText(doctor.BS_HO_TEN).includes(keyword),
    );
  }, [debouncedDoctorSearch, doctorsQuery.data]);

  const availabilityDebugQuery = useQuery({
    queryKey: ['booking-debug-availability', specialtyId, selectedDate, debouncedDoctorSearch],
    queryFn: () =>
      bookingApi.getAvailabilityDebug({
        date: selectedDate,
        specialtyId: specialtyId === 'all' ? undefined : Number(specialtyId),
        q: debouncedDoctorSearch || undefined,
      }),
    enabled:
      Boolean(
        user?.TK_SDT &&
          selectedProfile &&
          selectedDate.trim() &&
          doctorsQuery.isSuccess,
      ) &&
      !debouncedDoctorSearch &&
      (doctorsQuery.data?.length ?? 0) === 0,
    retry: 1,
  });

  const bookingEmptyReasonMessage = useMemo(() => {
    const reason = pickTopBookingReason(availabilityDebugQuery.data?.summary.reasons);
    if (!reason) return null;
    return BOOKING_REASON_LABELS[reason];
  }, [availabilityDebugQuery.data?.summary.reasons]);

  const isStatusContractMismatch = useMemo(() => {
    if (!availabilityDebugQuery.data?.contractVersion) return false;
    return availabilityDebugQuery.data.contractVersion !== SCHEDULE_STATUS_CONTRACT_VERSION;
  }, [availabilityDebugQuery.data?.contractVersion]);

  const selectedDoctor = (doctorsQuery.data ?? []).find((item) => item.BS_MA === selectedDoctorId) || null;

  useEffect(() => {
    if (!selectedDoctorId) return;
    const stillExists = (doctorsQuery.data ?? []).some((item) => item.BS_MA === selectedDoctorId);
    if (!stillExists) {
      setSelectedDoctorId(null);
      setSelectedSlotKey(null);
    }
  }, [doctorsQuery.data, selectedDoctorId]);

  const slotsQuery = useQuery({
    queryKey: queryKeys.booking.slots(selectedDoctorId, selectedDate),
    queryFn: () => bookingApi.getDoctorSlotsForDay(selectedDoctorId!, selectedDate),
    enabled: Boolean(selectedDoctorId && selectedDate && selectedProfile),
  });

  useEffect(() => {
    setSelectedSlotKey(null);
  }, [selectedDoctorId, selectedDate]);

  const allAvailableSlots = useMemo(
    () =>
      (slotsQuery.data ?? []).flatMap((session) =>
        session.slots
          .filter((slot) => slot.available)
          .map((slot) => ({
            ...slot,
            B_TEN: session.B_TEN,
            PHONG: session.PHONG,
            key: `${session.B_TEN}-${slot.KG_MA}`,
          })),
      ),
    [slotsQuery.data],
  );

  const selectedSlot = allAvailableSlots.find((item) => item.key === selectedSlotKey) || null;

  const createMutation = useMutation({
    mutationFn: bookingApi.createBooking,
    onSuccess: (result) => {
      const appointmentId = result.booking?.DK_MA;
      if (appointmentId) {
        setLastPaymentContext({ appointmentId, createdAt: new Date().toISOString() });
      }

      if (canOpenPaymentUrl(result.payment_url)) {
        setRedirectingToPayment(true);
        window.location.assign(result.payment_url as string);
        return;
      }

      toast.success('Đặt lịch thành công. Bạn có thể thanh toán sau trong mục Lịch hẹn của tôi.');
      setRedirectingToPayment(false);
    },
    onError: (error) => {
      setRedirectingToPayment(false);
      logFrontendError('booking-submit', error, {
        selectedDoctorId,
        selectedDate,
        selectedSlotKey,
      });
      toast.error(getPatientFlowErrorMessage(error, 'Không thể tạo lịch khám.'));
    },
  });

  const handleSubmit = () => {
    if (!selectedProfile) {
      toast.error('Vui lòng chọn hồ sơ bệnh nhân trước khi đặt lịch.');
      return;
    }
    if (!selectedDate) {
      toast.error('Vui lòng chọn ngày khám.');
      return;
    }
    if (!selectedDoctor || !selectedSlot) {
      toast.error('Vui lòng chọn bác sĩ và khung giờ phù hợp.');
      return;
    }
    if (symptoms.length > 1000) {
      toast.error('Triệu chứng tối đa 1000 ký tự.');
      return;
    }
    if (preVisitNote.length > 2000) {
      toast.error('Ghi chú tối đa 2000 ký tự.');
      return;
    }

    createMutation.mutate({
      BN_MA: selectedProfile.BN_MA,
      BS_MA: selectedDoctor.BS_MA,
      N_NGAY: selectedDate,
      B_TEN: selectedSlot.B_TEN,
      KG_MA: selectedSlot.KG_MA,
      symptoms: symptoms.trim() || undefined,
      preVisitNote: preVisitNote.trim() || undefined,
    });
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="rounded-2xl bg-blue-600 p-4 text-white">
              <CalendarDays className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Đăng nhập để đặt lịch khám</h1>
              <p className="mt-2 text-sm text-slate-600">
                Hệ thống cần xác định tài khoản và hồ sơ bệnh nhân trước khi tạo lịch hẹn.
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild variant="outline">
                <Link to="/login">Đăng nhập</Link>
              </Button>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link to="/register">Tạo tài khoản</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-slate-900 via-blue-900 to-sky-700 p-6 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-100">Đặt lịch khám</p>
          <h1 className="mt-3 text-3xl font-bold">Chọn hồ sơ bệnh nhân và khung giờ phù hợp</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50/90">
            Sau khi xác nhận lịch hẹn, hệ thống sẽ chuyển bạn đến cổng thanh toán VNPAY/QR để hoàn tất bước thanh toán.
          </p>
        </section>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Bước 1. Chọn hồ sơ bệnh nhân</CardTitle>
            <CardDescription>
              {activeProfiles.length <= 1
                ? 'Tài khoản hiện có 1 hồ sơ hoạt động, hệ thống sẽ tự chọn hồ sơ này.'
                : 'Tài khoản có nhiều hồ sơ. Hãy chọn đúng người bệnh để tránh đặt lịch nhầm.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profilesQuery.isLoading ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">Đang tải hồ sơ bệnh nhân...</div>
            ) : activeProfiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                <p className="text-lg font-semibold text-slate-900">Chưa có hồ sơ bệnh nhân để đặt lịch</p>
                <p className="mt-2 text-sm text-slate-600">Bạn cần tạo ít nhất một hồ sơ trước khi đặt lịch.</p>
                <Button asChild className="mt-4 bg-blue-600 hover:bg-blue-700">
                  <Link to="/patient-profiles/create">Thêm hồ sơ</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activeProfiles.map((profile) => {
                  const isSelected = selectedProfile?.BN_MA === profile.BN_MA;
                  return (
                    <button
                      key={profile.BN_MA}
                      type="button"
                      onClick={() => setSelectedProfile(user.TK_SDT, profile.BN_MA)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? 'border-blue-300 bg-blue-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 border border-slate-200">
                          <AvatarImage src={profile.BN_ANH || ''} alt={getPatientProfileFullName(profile)} className="object-cover" />
                          <AvatarFallback className="bg-blue-100 text-blue-700">
                            <UserRound className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-slate-900">{getPatientProfileFullName(profile)}</p>
                          <p className="text-sm text-slate-500">Mã hồ sơ #{profile.BN_MA} · {formatDateDdMmYyyy(profile.BN_NGAY_SINH)}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedProfile ? <PatientProfileSummaryCard profile={selectedProfile} mode="booking" compact /> : null}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 2. Chọn bác sĩ, ngày khám</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Chuyên khoa</p>
                    <Select value={specialtyId} onValueChange={setSpecialtyId} disabled={!selectedProfile}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Chọn chuyên khoa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tất cả chuyên khoa</SelectItem>
                        {(specialties ?? []).map((item) => (
                          <SelectItem key={item.CK_MA} value={String(item.CK_MA)}>
                            {item.CK_TEN}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Ngày khám</p>
                    <Input
                      type="date"
                      min={todayIso()}
                      max={maxBookingDateIso()}
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                      disabled={!selectedProfile}
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Tìm bác sĩ</p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={doctorSearch}
                        onChange={(event) => setDoctorSearch(event.target.value)}
                        placeholder="Nhập tên bác sĩ"
                        className="pl-9"
                        disabled={!selectedProfile}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 3. Chọn bác sĩ</CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedProfile ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">Vui lòng chọn hồ sơ bệnh nhân trước.</div>
                ) : doctorsQuery.isLoading ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">Đang tải danh sách bác sĩ...</div>
                ) : doctorsQuery.isError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-8 text-center">
                    <p className="text-base font-semibold text-rose-700">Không tải được danh sách bác sĩ</p>
                    <p className="mt-2 text-sm text-rose-700/90">Vui lòng thử lại sau hoặc đổi ngày/chuyên khoa.</p>
                  </div>
                ) : filteredDoctors.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                    <p className="text-lg font-semibold text-slate-900">Không có bác sĩ phù hợp</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {debouncedDoctorSearch
                        ? `Không tìm thấy bác sĩ theo từ khóa "${debouncedDoctorSearch}".`
                        : bookingEmptyReasonMessage || 'Hãy đổi ngày hoặc bộ lọc chuyên khoa để thử lại.'}
                    </p>
                    {isStatusContractMismatch ? (
                      <p className="mt-2 text-xs text-amber-700">
                        Cảnh báo: phiên bản contract trạng thái FE/BE không khớp, vui lòng đồng bộ bản deploy.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {filteredDoctors.map((doctor) => (
                      <button
                        key={doctor.BS_MA}
                        type="button"
                        onClick={() => setSelectedDoctorId(doctor.BS_MA)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selectedDoctorId === doctor.BS_MA
                            ? 'border-blue-300 bg-blue-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-14 w-14 border border-slate-200">
                            <AvatarImage src={doctor.BS_ANH || ''} alt={doctor.BS_HO_TEN} className="object-cover" />
                            <AvatarFallback className="bg-blue-100 text-blue-700">
                              <Stethoscope className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {doctor.BS_HOC_HAM ? `${doctor.BS_HOC_HAM} ${doctor.BS_HO_TEN}` : doctor.BS_HO_TEN}
                            </p>
                            <p className="text-sm text-slate-500">{doctor.CHUYEN_KHOA || 'Chưa xác định chuyên khoa'}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 4. Triệu chứng và ghi chú</CardTitle>
                <CardDescription>
                  Thông tin tiền khám giúp bác sĩ nắm nhanh tình trạng trước buổi khám.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Triệu chứng (tối đa 1000 ký tự)</p>
                  <Textarea
                    value={symptoms}
                    onChange={(event) => setSymptoms(event.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Ví dụ: đau họng, sốt nhẹ 2 ngày..."
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Ghi chú thêm (tối đa 2000 ký tự)</p>
                  <Textarea
                    value={preVisitNote}
                    onChange={(event) => setPreVisitNote(event.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Thêm thông tin bệnh sử, thuốc đang dùng hoặc điều cần bác sĩ lưu ý."
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 5. Chọn khung giờ</CardTitle>
                <CardDescription>
                  {selectedDoctor
                    ? `Lịch còn trống của ${selectedDoctor.BS_HO_TEN} ngày ${formatDateDdMmYyyy(selectedDate)}`
                    : 'Chọn bác sĩ để xem khung giờ khả dụng.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedDoctor ? (
                  !selectedDate.trim() ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">
                      Vui lòng chọn ngày khám để xem khung giờ khả dụng.
                    </div>
                  ) : slotsQuery.isLoading ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">Đang tải slot...</div>
                  ) : slotsQuery.isError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-8 text-center">
                      <p className="text-base font-semibold text-rose-700">Không tải được khung giờ</p>
                      <p className="mt-2 text-sm text-rose-700/90">Vui lòng thử lại hoặc chọn bác sĩ khác.</p>
                    </div>
                  ) : (slotsQuery.data ?? []).length === 0 || allAvailableSlots.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                      <p className="font-semibold text-slate-900">Không có slot khả dụng</p>
                      <p className="mt-2 text-sm text-slate-600">Bạn có thể đổi ngày khám hoặc chọn bác sĩ khác.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {(slotsQuery.data ?? []).map((session) => {
                        const availableSlots = session.slots.filter((slot) => slot.available);
                        if (availableSlots.length === 0) return null;
                        return (
                          <div key={session.B_TEN} className="space-y-3 rounded-2xl border border-slate-200 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">{getSessionLabel(session.B_TEN)}</p>
                                <p className="text-sm text-slate-500">Phòng: {session.PHONG || 'Chưa cập nhật'}</p>
                              </div>
                              <Clock3 className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {availableSlots.map((slot) => {
                                const key = `${session.B_TEN}-${slot.KG_MA}`;
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    onClick={() => setSelectedSlotKey(key)}
                                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                                      selectedSlotKey === key
                                        ? 'border-blue-600 bg-blue-600 text-white'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50'
                                    }`}
                                  >
                                    {slot.KG_BAT_DAU.slice(11, 16)} - {slot.KG_KET_THUC.slice(11, 16)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">Chưa chọn bác sĩ.</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Xác nhận thông tin</CardTitle>
                <CardDescription>
                  Sau khi xác nhận, hệ thống sẽ điều hướng sang cổng thanh toán QR/VNPAY.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SummaryRow label="Đặt cho" value={selectedProfile ? getPatientProfileFullName(selectedProfile) : 'Chưa chọn'} />
                <SummaryRow label="Bác sĩ" value={selectedDoctor?.BS_HO_TEN || 'Chưa chọn'} />
                <SummaryRow label="Ngày khám" value={selectedDate ? formatDateDdMmYyyy(selectedDate) : 'Chưa chọn'} />
                <SummaryRow label="Buổi" value={selectedSlot ? getSessionLabel(selectedSlot.B_TEN) : 'Chưa chọn'} />
                <SummaryRow label="Giờ khám" value={selectedSlot ? `${selectedSlot.KG_BAT_DAU.slice(11, 16)} - ${selectedSlot.KG_KET_THUC.slice(11, 16)}` : 'Chưa chọn'} />

                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  Nếu thanh toán bị gián đoạn, bạn vẫn có thể vào mục "Lịch hẹn của tôi" để thử lại.
                </div>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || redirectingToPayment || !selectedProfile || !selectedDoctor || !selectedSlot}
                >
                  {createMutation.isPending || redirectingToPayment ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      {redirectingToPayment ? 'Đang chuyển đến cổng thanh toán...' : 'Đang tạo lịch...'}
                    </span>
                  ) : (
                    'Xác nhận và thanh toán'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}
