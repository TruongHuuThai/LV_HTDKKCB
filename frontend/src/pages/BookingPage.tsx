
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  CreditCard,
  LoaderCircle,
  QrCode,
  Search,
  UserRound,
  Wallet,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import PatientProfileSummaryCard from '@/components/patient/PatientProfileSummaryCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSpecialties } from '@/hooks/useSpecialties';
import { canOpenPaymentUrl, getPaymentStatusLabel } from '@/lib/appointments';
import { logFrontendError } from '@/lib/frontendLogger';
import { getPatientFlowErrorMessage } from '@/lib/patientFlowError';
import { setLastPaymentContext } from '@/lib/patientPaymentFlow';
import { getPatientProfileFullName } from '@/lib/patientProfiles';
import { formatDateDdMmYyyy, getSessionLabel } from '@/lib/scheduleDisplay';
import { appointmentsApi } from '@/services/api/appointmentsApi';
import { bookingApi, type BookingDoctor } from '@/services/api/bookingApi';
import { patientProfilesApi } from '@/services/api/patientProfilesApi';
import { queryKeys } from '@/services/api/queryKeys';
import { useAuthStore } from '@/store/useAuthStore';
import { usePatientProfilesStore } from '@/store/usePatientProfilesStore';

type EntryMode = 'BY_DATE' | 'BY_DEPARTMENT' | 'BY_DOCTOR';
type FlowStep =
  | 'entry'
  | 'profile'
  | 'clinical'
  | 'insurance'
  | 'review'
  | 'paymentMethod'
  | 'paymentInfo'
  | 'result';

const STEPS: Array<{ key: FlowStep; label: string }> = [
  { key: 'entry', label: 'Cách đặt lịch' },
  { key: 'profile', label: 'Hồ sơ bệnh nhân' },
  { key: 'clinical', label: 'Thông tin khám' },
  { key: 'insurance', label: 'Bảo hiểm' },
  { key: 'review', label: 'Xem lại' },
  { key: 'paymentMethod', label: 'Phương thức thanh toán' },
  { key: 'paymentInfo', label: 'Thông tin thanh toán' },
  { key: 'result', label: 'Kết quả' },
];

const ENTRY_OPTIONS: Array<{ mode: EntryMode; title: string; description: string }> = [
  {
    mode: 'BY_DATE',
    title: 'Đặt lịch theo ngày khám trước',
    description:
      'Phù hợp khi bạn ưu tiên khám vào một ngày cụ thể rồi chọn chuyên khoa và bác sĩ phù hợp.',
  },
  {
    mode: 'BY_DEPARTMENT',
    title: 'Đặt lịch theo chuyên khoa trước',
    description:
      'Phù hợp khi bạn đã xác định chuyên khoa và muốn xem ngày, bác sĩ còn trống theo khoa.',
  },
  {
    mode: 'BY_DOCTOR',
    title: 'Đặt lịch theo bác sĩ trước',
    description:
      'Phù hợp khi bạn muốn khám với một bác sĩ cụ thể, hệ thống sẽ lọc ngày và slot hợp lệ.',
  },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'VNPAY', label: 'VNPAY', note: 'Hỗ trợ chuyển hướng thanh toán trực tuyến ngay.' },
  { value: 'MOMO', label: 'MoMo', note: 'Sắp hỗ trợ', disabled: true },
  { value: 'QR_BANKING', label: 'QR Banking', note: 'Sắp hỗ trợ', disabled: true },
];

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

function getClinicalOrder(mode: EntryMode | null) {
  if (mode === 'BY_DATE') return ['ngày khám', 'chuyên khoa', 'bác sĩ', 'khung giờ'] as const;
  if (mode === 'BY_DEPARTMENT') return ['chuyên khoa', 'ngày khám', 'bác sĩ', 'khung giờ'] as const;
  return ['bác sĩ', 'chuyên khoa', 'ngày khám', 'khung giờ'] as const;
}

export default function BookingPage() {
  const user = useAuthStore((state) => state.user);
  const selectedProfileId = usePatientProfilesStore(
    (state) => state.selectedByAccount[user?.TK_SDT ?? ''],
  );
  const setSelectedProfile = usePatientProfilesStore((state) => state.setSelectedProfile);
  const { data: specialties } = useSpecialties();

  const [step, setStep] = useState<FlowStep>('entry');
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);

  const [specialtyId, setSpecialtyId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorSearchDebounced, setDoctorSearchDebounced] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);

  const [symptoms, setSymptoms] = useState('');
  const [preVisitNote, setPreVisitNote] = useState('');

  const [hasBHYT, setHasBHYT] = useState<boolean | null>(null);
  const [bhytType, setBhytType] = useState<string>('');
  const [hasPrivateInsurance, setHasPrivateInsurance] = useState<boolean | null>(null);
  const [privateInsuranceProvider, setPrivateInsuranceProvider] = useState<string>('');
  const [privateInsuranceSearch, setPrivateInsuranceSearch] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<string>('VNPAY');
  const [createdAppointmentId, setCreatedAppointmentId] = useState<number | null>(null);
  const [createdPaymentRef, setCreatedPaymentRef] = useState<number | null>(null);
  const [createdPaymentUrl, setCreatedPaymentUrl] = useState<string | null>(null);
  const [resultTone, setResultTone] = useState<'success' | 'failed' | 'pending'>('pending');

  const profilesQuery = useQuery({
    queryKey: queryKeys.patientProfiles.mine,
    queryFn: patientProfilesApi.listMine,
    enabled: Boolean(user?.TK_SDT),
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDoctorSearchDebounced(doctorSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [doctorSearch]);

  const activeProfiles = (profilesQuery.data?.items ?? []).filter((item) => item.BN_DA_VO_HIEU !== true);
  const selectedProfile = activeProfiles.find((item) => item.BN_MA === selectedProfileId) || null;

  useEffect(() => {
    if (!user?.TK_SDT || activeProfiles.length !== 1) return;
    if (selectedProfileId !== activeProfiles[0].BN_MA) {
      setSelectedProfile(user.TK_SDT, activeProfiles[0].BN_MA);
    }
  }, [activeProfiles, selectedProfileId, setSelectedProfile, user?.TK_SDT]);

  const doctorsQuery = useQuery({
    queryKey: queryKeys.booking.doctors(specialtyId || 'all', selectedDate, doctorSearchDebounced),
    queryFn: () =>
      bookingApi.getAvailableDoctors({
        date: selectedDate || undefined,
        specialtyId: specialtyId ? Number(specialtyId) : undefined,
        q: doctorSearchDebounced || undefined,
      }),
    enabled: Boolean(selectedProfile),
  });

  const doctorList = useMemo(() => {
    const keyword = normalizeVietnameseText(doctorSearchDebounced);
    if (!keyword) return doctorsQuery.data ?? [];
    return (doctorsQuery.data ?? []).filter((doctor) =>
      normalizeVietnameseText(doctor.BS_HO_TEN).includes(keyword),
    );
  }, [doctorSearchDebounced, doctorsQuery.data]);

  const selectedDoctor = useMemo(
    () => doctorList.find((item) => item.BS_MA === selectedDoctorId) || null,
    [doctorList, selectedDoctorId],
  );

  useEffect(() => {
    if (!selectedDoctorId) return;
    const stillExists = doctorList.some((item) => item.BS_MA === selectedDoctorId);
    if (!stillExists) {
      setSelectedDoctorId(null);
      setSelectedSlotKey(null);
    }
  }, [doctorList, selectedDoctorId]);

  useEffect(() => {
    if (entryMode !== 'BY_DOCTOR' || !selectedDoctor) return;
    if (String(selectedDoctor.CK_MA) !== specialtyId) {
      setSpecialtyId(String(selectedDoctor.CK_MA));
      setSelectedSlotKey(null);
    }
  }, [entryMode, selectedDoctor, specialtyId]);

  const slotsQuery = useQuery({
    queryKey: queryKeys.booking.slots(selectedDoctorId, selectedDate),
    queryFn: () => bookingApi.getDoctorSlotsForDay(selectedDoctorId!, selectedDate),
    enabled: Boolean(selectedDoctorId && selectedDate && selectedProfile),
  });

  const allSlots = useMemo(
    () =>
      (slotsQuery.data ?? []).flatMap((session) =>
        session.slots.map((slot) => ({
          ...slot,
          B_TEN: session.B_TEN,
          PHONG: session.PHONG,
          key: `${session.B_TEN}-${slot.KG_MA}`,
        })),
      ),
    [slotsQuery.data],
  );

  const selectedSlot = allSlots.find((item) => item.key === selectedSlotKey && item.available) || null;

  const bhytTypesQuery = useQuery({
    queryKey: ['booking-bhyt-types', selectedProfile?.BN_MA, specialtyId],
    queryFn: () =>
      bookingApi.getBHYTTypes({
        profileId: selectedProfile?.BN_MA,
        specialtyId: specialtyId ? Number(specialtyId) : undefined,
      }),
    enabled: Boolean(selectedProfile?.BN_MA && specialtyId),
  });

  const privateProvidersQuery = useQuery({
    queryKey: ['booking-private-providers', privateInsuranceSearch],
    queryFn: () => bookingApi.getPrivateInsuranceProviders(privateInsuranceSearch || undefined),
    enabled: hasPrivateInsurance === true,
  });

  const paymentStatusQuery = useQuery({
    queryKey: queryKeys.appointments.paymentStatus(createdAppointmentId || 0),
    queryFn: () => appointmentsApi.getPaymentStatus(createdAppointmentId!),
    enabled: Boolean(createdAppointmentId) && (step === 'paymentInfo' || step === 'result'),
    refetchInterval: step === 'paymentInfo' ? 7000 : false,
  });

  useEffect(() => {
    const status = paymentStatusQuery.data?.payment?.normalizedStatus;
    if (!status) return;
    if (status === 'paid') {
      setResultTone('success');
      setStep('result');
      return;
    }
    if (status === 'failed' || status === 'expired') {
      setResultTone('failed');
    } else {
      setResultTone('pending');
    }
  }, [paymentStatusQuery.data?.payment?.normalizedStatus]);

  const createMutation = useMutation({
    mutationFn: bookingApi.createBooking,
    onSuccess: (result) => {
      const appointmentId = result.booking?.DK_MA;
      if (appointmentId) {
        setCreatedAppointmentId(appointmentId);
        setLastPaymentContext({ appointmentId, createdAt: new Date().toISOString() });
      }
      setCreatedPaymentRef(result.payment?.TT_MA || null);
      setCreatedPaymentUrl((result.payment_url as string) || null);
      setStep('paymentInfo');
      toast.success('Đã tạo lịch hẹn. Vui lòng hoàn tất thanh toán để xác nhận.');
    },
    onError: (error) => {
      logFrontendError('booking-submit-v2', error, {
        selectedDoctorId,
        selectedDate,
        selectedSlotKey,
        entryMode,
      });
      toast.error(getPatientFlowErrorMessage(error, 'Không thể tạo lịch khám.'));
    },
  });

  const retryPaymentMutation = useMutation({
    mutationFn: (appointmentId: number) => appointmentsApi.retryPayment(appointmentId),
    onSuccess: (result) => {
      const nextUrl = (result.payment_url as string) || null;
      setCreatedPaymentUrl(nextUrl);
      if (canOpenPaymentUrl(nextUrl)) {
        window.location.assign(nextUrl as string);
      }
    },
    onError: (error) => {
      toast.error(getPatientFlowErrorMessage(error, 'Không thể tạo lại link thanh toán.'));
    },
  });

  const selectedSpecialty = (specialties ?? []).find((item) => String(item.CK_MA) === specialtyId);
  const currentStepIndex = STEPS.findIndex((item) => item.key === step);
  const clinicalOrder = getClinicalOrder(entryMode);

  const canContinueProfile = Boolean(selectedProfile);
  const canContinueClinical = Boolean(selectedDate && specialtyId && selectedDoctor && selectedSlot);
  const canContinueInsurance =
    hasBHYT !== null &&
    hasPrivateInsurance !== null &&
    (!hasBHYT || Boolean(bhytType)) &&
    (!hasPrivateInsurance || Boolean(privateInsuranceProvider));

  const resetClinicalDownstream = () => {
    setSelectedDoctorId(null);
    setSelectedSlotKey(null);
  };

  const handleSelectEntryMode = (mode: EntryMode) => {
    setEntryMode(mode);
    setSpecialtyId('');
    setSelectedDoctorId(null);
    setSelectedSlotKey(null);
    setHasBHYT(null);
    setBhytType('');
    setHasPrivateInsurance(null);
    setPrivateInsuranceProvider('');
    setPaymentMethod('VNPAY');
    setCreatedAppointmentId(null);
    setCreatedPaymentRef(null);
    setCreatedPaymentUrl(null);
    setStep('profile');
  };

  const handleProfileSelect = (profileId: number) => {
    if (!user?.TK_SDT) return;
    setSelectedProfile(user.TK_SDT, profileId);
    setSpecialtyId('');
    setSelectedDoctorId(null);
    setSelectedSlotKey(null);
    setHasBHYT(null);
    setBhytType('');
    setHasPrivateInsurance(null);
    setPrivateInsuranceProvider('');
  };

  const handleChangeDate = (value: string) => {
    setSelectedDate(value);
    setSelectedSlotKey(null);
  };

  const handleChangeSpecialty = (value: string) => {
    setSpecialtyId(value);
    resetClinicalDownstream();
  };

  const handleChangeDoctor = (doctor: BookingDoctor) => {
    setSelectedDoctorId(doctor.BS_MA);
    setSelectedSlotKey(null);
    if (entryMode === 'BY_DOCTOR') {
      setSpecialtyId(String(doctor.CK_MA));
    }
  };

  const submitCreateBooking = () => {
    if (!selectedProfile || !selectedDoctor || !selectedSlot || !selectedDate) {
      toast.error('Vui lòng chọn đủ hồ sơ, ngày khám, bác sĩ và khung giờ.');
      return;
    }

    if (!canContinueInsurance) {
      toast.error('Vui lòng hoàn tất thông tin bảo hiểm bắt buộc trước khi thanh toán.');
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
      hasBHYT: hasBHYT ?? false,
      bhytType: hasBHYT ? bhytType : undefined,
      hasPrivateInsurance: hasPrivateInsurance ?? false,
      privateInsuranceProvider: hasPrivateInsurance ? privateInsuranceProvider : undefined,
      paymentMethod,
    });
  };

  const goBack = () => {
    if (step === 'profile') return setStep('entry');
    if (step === 'clinical') return setStep('profile');
    if (step === 'insurance') return setStep('clinical');
    if (step === 'review') return setStep('insurance');
    if (step === 'paymentMethod') return setStep('review');
    if (step === 'paymentInfo') return setStep('paymentMethod');
    if (step === 'result') return setStep('paymentInfo');
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <Card className="border-blue-100 bg-blue-50">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="rounded-2xl bg-blue-600 p-4 text-white">
              <CalendarDays className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Đăng nhập để đặt lịch khám</h1>
            <p className="max-w-xl text-sm text-slate-600">
              Hệ thống cần xác định tài khoản trước khi tạo lịch hẹn và thanh toán.
            </p>
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
      <section className="mb-6 rounded-3xl border border-blue-100 bg-gradient-to-br from-slate-900 via-blue-900 to-sky-700 p-6 text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-100">Đặt khám trực tuyến</p>
        <h1 className="mt-3 text-3xl font-bold">Luồng đặt khám mới cho web</h1>
        <p className="mt-2 text-sm text-blue-50/90">
          Hỗ trợ theo ngày, theo chuyên khoa hoặc theo bác sĩ và hội tụ về một quy trình thanh toán thống nhất.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <Card className="h-fit border-slate-200 xl:sticky xl:top-24">
          <CardHeader>
            <CardTitle className="text-base">Tiến trình đặt lịch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {STEPS.map((item, index) => {
              const isDone = index < currentStepIndex;
              const isActive = index === currentStepIndex;
              return (
                <div key={item.key} className="flex items-center gap-3 text-sm">
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : isActive ? (
                    <Circle className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300" />
                  )}
                  <span className={isActive ? 'font-semibold text-slate-900' : 'text-slate-600'}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {step !== 'entry' ? (
            <Button variant="ghost" className="px-0 text-slate-600" onClick={goBack}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại
            </Button>
          ) : null}

          {step === 'entry' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 1. Chọn cách bắt đầu đặt lịch</CardTitle>
                <CardDescription>
                  Chọn một cách bắt đầu phù hợp, hệ thống vẫn đưa bạn về một luồng thanh toán chung.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                {ENTRY_OPTIONS.map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => handleSelectEntryMode(item.mode)}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {step === 'profile' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 2. Chọn hồ sơ bệnh nhân</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {profilesQuery.isLoading ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">
                    Đang tải hồ sơ bệnh nhân...
                  </div>
                ) : activeProfiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                    <p className="text-lg font-semibold text-slate-900">Chưa có hồ sơ bệnh nhân</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Bạn cần tạo hồ sơ trước khi tiếp tục đặt lịch.
                    </p>
                    <Button asChild className="mt-4 bg-blue-600 hover:bg-blue-700">
                      <Link to="/patient-profiles/create">Thêm hồ sơ mới</Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {activeProfiles.map((profile) => {
                        const isSelected = selectedProfile?.BN_MA === profile.BN_MA;
                        return (
                          <button
                            key={profile.BN_MA}
                            type="button"
                            onClick={() => handleProfileSelect(profile.BN_MA)}
                            className={`rounded-2xl border p-4 text-left transition ${
                              isSelected
                                ? 'border-blue-300 bg-blue-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-12 w-12 border border-slate-200">
                                <AvatarImage
                                  src={profile.BN_ANH || ''}
                                  alt={getPatientProfileFullName(profile)}
                                  className="object-cover"
                                />
                                <AvatarFallback className="bg-blue-100 text-blue-700">
                                  <UserRound className="h-5 w-5" />
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-semibold text-slate-900">{getPatientProfileFullName(profile)}</p>
                                <p className="text-sm text-slate-500">Mã hồ sơ #{profile.BN_MA}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={() => setStep('clinical')}
                        disabled={!canContinueProfile}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Tiếp tục
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {step === 'clinical' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 3. Chọn thông tin khám</CardTitle>
                <CardDescription>
                  Thứ tự hiện tại theo cách bắt đầu: <strong>{clinicalOrder.join(' -> ')}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Ngày khám</Label>
                    <Input
                      type="date"
                      min={todayIso()}
                      max={maxBookingDateIso()}
                      value={selectedDate}
                      onChange={(e) => handleChangeDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Chuyên khoa</Label>
                    <Select
                      value={specialtyId || ''}
                      onValueChange={handleChangeSpecialty}
                      disabled={entryMode === 'BY_DOCTOR' && Boolean(selectedDoctor)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn chuyên khoa" />
                      </SelectTrigger>
                      <SelectContent>
                        {(specialties ?? []).map((item) => (
                          <SelectItem key={item.CK_MA} value={String(item.CK_MA)}>
                            {item.CK_TEN}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Tìm bác sĩ</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={doctorSearch}
                      onChange={(e) => setDoctorSearch(e.target.value)}
                      className="pl-9"
                      placeholder="Nhập tên bác sĩ"
                    />
                  </div>

                  {doctorsQuery.isLoading ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">
                      Đang tải danh sách bác sĩ...
                    </div>
                  ) : doctorList.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-slate-600">
                      Không có bác sĩ phù hợp điều kiện đã chọn.
                    </div>
                  ) : (
                    <div className="grid max-h-64 gap-3 overflow-auto rounded-2xl border border-slate-200 p-3">
                      {doctorList.map((doctor) => (
                        <button
                          key={doctor.BS_MA}
                          type="button"
                          onClick={() => handleChangeDoctor(doctor)}
                          className={`rounded-xl border p-3 text-left transition ${
                            selectedDoctorId === doctor.BS_MA
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-slate-200 bg-white hover:border-blue-200'
                          }`}
                        >
                          <p className="font-semibold text-slate-900">
                            {doctor.BS_HOC_HAM ? `${doctor.BS_HOC_HAM} ${doctor.BS_HO_TEN}` : doctor.BS_HO_TEN}
                          </p>
                          <p className="text-sm text-slate-500">{doctor.CHUYEN_KHOA || 'Chưa cập nhật chuyên khoa'}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Khung giờ khám</Label>
                  {!selectedDoctor ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">
                      Chọn bác sĩ để xem slot còn trống.
                    </div>
                  ) : slotsQuery.isLoading ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">
                      Đang tải slot khám...
                    </div>
                  ) : (slotsQuery.data ?? []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-slate-600">
                      Bác sĩ không có lịch trong ngày đã chọn.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(slotsQuery.data ?? []).map((session) => (
                        <div key={`${session.B_TEN}-${session.PHONG || 'NA'}`} className="rounded-2xl border border-slate-200 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">{getSessionLabel(session.B_TEN)}</p>
                              <p className="text-sm text-slate-500">Phòng: {session.PHONG || 'Chưa cập nhật'}</p>
                            </div>
                            <Clock3 className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                            {session.slots.map((slot) => {
                              const key = `${session.B_TEN}-${slot.KG_MA}`;
                              const isSelected = selectedSlotKey === key;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  disabled={!slot.available}
                                  onClick={() => setSelectedSlotKey(key)}
                                  className={`rounded-lg border px-3 py-2 text-sm ${
                                    !slot.available
                                      ? 'cursor-not-allowed border-slate-100 bg-slate-100 text-slate-400'
                                      : isSelected
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
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Triệu chứng</Label>
                  <Textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    maxLength={1000}
                    placeholder="Mô tả ngắn triệu chứng (không bắt buộc)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ghi chú thêm</Label>
                  <Textarea
                    value={preVisitNote}
                    onChange={(e) => setPreVisitNote(e.target.value)}
                    maxLength={2000}
                    placeholder="Thông tin bổ sung cho bác sĩ (không bắt buộc)"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => setStep('insurance')}
                    disabled={!canContinueClinical}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Tiếp tục
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 'insurance' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 4. Chọn thông tin bảo hiểm (bắt buộc)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">Bảo hiểm y tế</p>
                  <div className="flex gap-2">
                    <Button type="button" variant={hasBHYT === true ? 'default' : 'outline'} onClick={() => { setHasBHYT(true); setBhytType(''); }}>Có</Button>
                    <Button type="button" variant={hasBHYT === false ? 'default' : 'outline'} onClick={() => { setHasBHYT(false); setBhytType(''); }}>Không</Button>
                  </div>
                  {hasBHYT ? (
                    <div className="space-y-2">
                      <Label>Loại BHYT</Label>
                      <Select value={bhytType} onValueChange={setBhytType}>
                        <SelectTrigger><SelectValue placeholder="Chọn loại BHYT" /></SelectTrigger>
                        <SelectContent>
                          {(bhytTypesQuery.data ?? []).map((item) => (
                            <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">Bảo hiểm tư nhân</p>
                  <div className="flex gap-2">
                    <Button type="button" variant={hasPrivateInsurance === true ? 'default' : 'outline'} onClick={() => { setHasPrivateInsurance(true); setPrivateInsuranceProvider(''); }}>Có</Button>
                    <Button type="button" variant={hasPrivateInsurance === false ? 'default' : 'outline'} onClick={() => { setHasPrivateInsurance(false); setPrivateInsuranceProvider(''); }}>Không</Button>
                  </div>
                  {hasPrivateInsurance ? (
                    <div className="space-y-2">
                      <Label>Công ty bảo hiểm</Label>
                      <Input value={privateInsuranceSearch} onChange={(e) => setPrivateInsuranceSearch(e.target.value)} placeholder="Tìm công ty bảo hiểm..." />
                      <Select value={privateInsuranceProvider} onValueChange={setPrivateInsuranceProvider}>
                        <SelectTrigger><SelectValue placeholder="Chọn công ty bảo hiểm" /></SelectTrigger>
                        <SelectContent>
                          {(privateProvidersQuery.data ?? []).map((item) => (
                            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>

                {!canContinueInsurance ? <p className="text-sm text-rose-600">Vui lòng hoàn tất cả trường bảo hiểm bắt buộc trước khi tiếp tục.</p> : null}

                <div className="flex justify-end">
                  <Button onClick={() => setStep('review')} disabled={!canContinueInsurance} className="bg-blue-600 hover:bg-blue-700">Tiếp tục</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 'review' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 5. Xem lại thông tin đặt khám</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ReviewRow label="Cách đặt lịch" value={ENTRY_OPTIONS.find((item) => item.mode === entryMode)?.title || 'Chưa chọn'} />
                <ReviewRow label="Hồ sơ" value={selectedProfile ? getPatientProfileFullName(selectedProfile) : 'Chưa chọn'} />
                <ReviewRow label="Ngày khám" value={selectedDate ? formatDateDdMmYyyy(selectedDate) : 'Chưa chọn'} />
                <ReviewRow label="Chuyên khoa" value={selectedSpecialty?.CK_TEN || 'Chưa chọn'} />
                <ReviewRow label="Bác sĩ" value={selectedDoctor?.BS_HO_TEN || 'Chưa chọn'} />
                <ReviewRow label="Khung giờ" value={selectedSlot ? `${selectedSlot.KG_BAT_DAU.slice(11, 16)} - ${selectedSlot.KG_KET_THUC.slice(11, 16)} (${selectedSlot.PHONG || 'chưa rõ phòng'})` : 'Chưa chọn'} />
                <ReviewRow label="BHYT" value={hasBHYT ? `Có - ${(bhytTypesQuery.data ?? []).find((item) => item.id === bhytType)?.label || bhytType}` : 'Không'} />
                <ReviewRow label="Bảo hiểm tư nhân" value={hasPrivateInsurance ? `Có - ${(privateProvidersQuery.data ?? []).find((item) => item.id === privateInsuranceProvider)?.name || privateInsuranceProvider}` : 'Không'} />
                <div className="flex justify-end">
                  <Button onClick={() => setStep('paymentMethod')} className="bg-blue-600 hover:bg-blue-700">Tiếp tục thanh toán</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 'paymentMethod' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 6. Chọn phương thức thanh toán</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {PAYMENT_METHOD_OPTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => setPaymentMethod(item.value)}
                    className={`w-full rounded-2xl border p-4 text-left ${
                      item.disabled
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                        : paymentMethod === item.value
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-200'
                    }`}
                  >
                    <p className="font-semibold">{item.label}</p>
                    <p className="text-sm text-slate-500">{item.note}</p>
                  </button>
                ))}

                <div className="flex justify-end">
                  <Button onClick={submitCreateBooking} disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                    {createMutation.isPending ? (
                      <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />Đang tạo lịch...</span>
                    ) : (
                      'Xác nhận và tạo thanh toán'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 'paymentInfo' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 7. Thông tin thanh toán</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Mã lịch hẹn</p>
                  <p className="text-xl font-semibold text-slate-900">#{createdAppointmentId || '---'}</p>
                  <p className="mt-3 text-sm text-slate-500">Mã tham chiếu thanh toán</p>
                  <p className="text-lg font-semibold text-slate-900">{createdPaymentRef || '---'}</p>
                  <p className="mt-3 text-sm text-slate-500">Trạng thái thanh toán</p>
                  <span className="mt-1 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                    {paymentStatusQuery.data?.payment
                      ? getPaymentStatusLabel(paymentStatusQuery.data.payment.normalizedStatus)
                      : 'Chưa thanh toán'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => {
                    if (!canOpenPaymentUrl(createdPaymentUrl)) {
                      toast.error('Không có URL thanh toán hợp lệ.');
                      return;
                    }
                    window.location.assign(createdPaymentUrl as string);
                  }} className="bg-blue-600 hover:bg-blue-700" disabled={!canOpenPaymentUrl(createdPaymentUrl)}>
                    <Wallet className="mr-2 h-4 w-4" /> Mở cổng thanh toán
                  </Button>
                  <Button variant="outline" onClick={() => paymentStatusQuery.refetch()} disabled={paymentStatusQuery.isFetching}>
                    {paymentStatusQuery.isFetching ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                    Kiểm tra trạng thái
                  </Button>
                  {createdAppointmentId ? (
                    <Button variant="outline" onClick={() => retryPaymentMutation.mutate(createdAppointmentId)} disabled={retryPaymentMutation.isPending}>
                      {retryPaymentMutation.isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                      Thanh toán lại
                    </Button>
                  ) : null}
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setStep('result')} variant="outline">Đi tới màn kết quả</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 'result' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 8. Kết quả đặt lịch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {resultTone === 'success' ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700"><div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" />Thanh toán thành công, lịch hẹn đã xác nhận.</div></div>
                ) : resultTone === 'failed' ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700"><div className="flex items-center gap-2 font-semibold"><XCircle className="h-5 w-5" />Thanh toán chưa thành công. Vui lòng thử lại.</div></div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-700"><div className="flex items-center gap-2 font-semibold"><LoaderCircle className="h-5 w-5 animate-spin" />Thanh toán đang chờ xử lý.</div></div>
                )}

                <div className="space-y-1 text-sm text-slate-600">
                  <p>Mã lịch hẹn: <strong>#{createdAppointmentId || '---'}</strong></p>
                  <p>Trạng thái hiện tại: <strong>{paymentStatusQuery.data?.payment ? getPaymentStatusLabel(paymentStatusQuery.data.payment.normalizedStatus) : 'Chưa có dữ liệu'}</strong></p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild className="bg-blue-600 hover:bg-blue-700"><Link to="/appointments/my">Xem lịch hẹn của tôi</Link></Button>
                  {createdAppointmentId ? (
                    <Button asChild variant="outline"><Link to={`/appointments/${createdAppointmentId}`}>Xem chi tiết lịch hẹn</Link></Button>
                  ) : null}
                  <Button variant="outline" onClick={() => setStep('entry')}>Đặt lịch mới</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card className="border-slate-200">
            <CardHeader><CardTitle className="text-base">Tóm tắt lựa chọn</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <SummaryRow label="Cách bắt đầu" value={ENTRY_OPTIONS.find((item) => item.mode === entryMode)?.title || 'Chưa chọn'} />
              <SummaryRow label="Hồ sơ" value={selectedProfile ? getPatientProfileFullName(selectedProfile) : 'Chưa chọn'} />
              <SummaryRow label="Ngày" value={selectedDate ? formatDateDdMmYyyy(selectedDate) : 'Chưa chọn'} />
              <SummaryRow label="Chuyên khoa" value={selectedSpecialty?.CK_TEN || 'Chưa chọn'} />
              <SummaryRow label="Bác sĩ" value={selectedDoctor?.BS_HO_TEN || 'Chưa chọn'} />
              <SummaryRow label="Giờ khám" value={selectedSlot ? `${selectedSlot.KG_BAT_DAU.slice(11, 16)} - ${selectedSlot.KG_KET_THUC.slice(11, 16)}` : 'Chưa chọn'} />
              <SummaryRow label="Phòng" value={selectedSlot?.PHONG || 'Chưa chọn'} />
              <SummaryRow label="BHYT" value={hasBHYT === null ? 'Chưa chọn' : hasBHYT ? 'Có' : 'Không'} />
              <SummaryRow label="Bảo hiểm tư nhân" value={hasPrivateInsurance === null ? 'Chưa chọn' : hasPrivateInsurance ? 'Có' : 'Không'} />
              <SummaryRow label="PT thanh toán" value={paymentMethod || 'Chưa chọn'} />
            </CardContent>
          </Card>

          {selectedProfile ? <PatientProfileSummaryCard profile={selectedProfile} mode="booking" compact /> : null}
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}
