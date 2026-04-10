import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  CreditCard,
  LoaderCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Wallet,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { patientProfilesApi, type PatientProfile } from '@/services/api/patientProfilesApi';
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
type StepGroupKey = 'setup' | 'schedule' | 'insurance' | 'payment';
type StepStatus = 'done' | 'current' | 'upcoming';
type ClinicalSelectorKey = 'date' | 'specialty' | 'doctor' | 'slot';

const FLOW_SEQUENCE: FlowStep[] = [
  'profile',
  'entry',
  'clinical',
  'insurance',
  'review',
  'paymentMethod',
  'paymentInfo',
  'result',
];

const STEP_LABELS: Record<FlowStep, string> = {
  profile: 'Hồ sơ',
  entry: 'Cách đặt',
  clinical: 'Lịch khám',
  insurance: 'Bảo hiểm',
  review: 'Xem lại',
  paymentMethod: 'Thanh toán',
  paymentInfo: 'Theo dõi thanh toán',
  result: 'Hoàn tất',
};

const STEP_GROUPS: Array<{ key: StepGroupKey; label: string; description: string }> = [
  { key: 'setup', label: 'Khởi tạo', description: 'Chọn hồ sơ và cách đặt lịch phù hợp' },
  { key: 'schedule', label: 'Lịch khám', description: 'Ngày khám, bác sĩ và khung giờ' },
  { key: 'insurance', label: 'Thông tin', description: 'Bảo hiểm và xác nhận thông tin' },
  { key: 'payment', label: 'Thanh toán', description: 'Tạo thanh toán và hoàn tất' },
];

const ENTRY_OPTIONS: Array<{
  mode: EntryMode;
  title: string;
  description: string;
  hint: string;
}> = [
  {
    mode: 'BY_DATE',
    title: 'Theo ngày khám',
    description: 'Chọn ngày trước rồi lọc bác sĩ phù hợp.',
    hint: 'Phù hợp khi bạn cần khám vào một ngày cố định.',
  },
  {
    mode: 'BY_DEPARTMENT',
    title: 'Theo chuyên khoa',
    description: 'Chọn chuyên khoa trước để hệ thống gợi ý lịch.',
    hint: 'Phù hợp khi bạn đã biết mình cần khám khoa nào.',
  },
  {
    mode: 'BY_DOCTOR',
    title: 'Theo bác sĩ',
    description: 'Chọn bác sĩ trước rồi tìm ngày giờ còn trống.',
    hint: 'Phù hợp khi bạn muốn khám với bác sĩ cụ thể.',
  },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'VNPAY', label: 'VNPAY', note: 'Khả dụng ngay', available: true },
  { value: 'MOMO', label: 'MoMo', note: 'Sắp hỗ trợ', available: false },
  { value: 'QR_BANKING', label: 'QR Banking', note: 'Sắp hỗ trợ', available: false },
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

function getClinicalOrder(mode: EntryMode | null): ClinicalSelectorKey[] {
  if (mode === 'BY_DATE') return ['date', 'specialty', 'doctor', 'slot'];
  if (mode === 'BY_DEPARTMENT') return ['specialty', 'date', 'doctor', 'slot'];
  return ['doctor', 'date', 'specialty', 'slot'];
}

function getStepGroup(step: FlowStep): StepGroupKey {
  if (step === 'entry' || step === 'profile') return 'setup';
  if (step === 'clinical') return 'schedule';
  if (step === 'insurance' || step === 'review') return 'insurance';
  return 'payment';
}

function getStepStatus(currentStep: FlowStep, group: StepGroupKey): StepStatus {
  const currentGroup = STEP_GROUPS.findIndex((item) => item.key === getStepGroup(currentStep));
  const targetGroup = STEP_GROUPS.findIndex((item) => item.key === group);
  if (targetGroup < currentGroup) return 'done';
  if (targetGroup === currentGroup) return 'current';
  return 'upcoming';
}

function sectionTitleForSelector(key: ClinicalSelectorKey) {
  if (key === 'date') return 'Chọn ngày khám';
  if (key === 'specialty') return 'Chọn chuyên khoa';
  if (key === 'doctor') return 'Chọn bác sĩ';
  return 'Chọn khung giờ';
}

function getPatientSafeErrorMessage(error: unknown, fallback: string) {
  const raw = getPatientFlowErrorMessage(error, fallback);
  const normalized = raw.toLowerCase();
  if (
    normalized.includes('internal server error') ||
    normalized.includes('exception') ||
    normalized.includes('sql') ||
    normalized.includes('stack') ||
    normalized.includes('trace') ||
    normalized.includes('undefined')
  ) {
    return fallback;
  }
  return raw;
}

export default function BookingPage() {
  const user = useAuthStore((state) => state.user);
  const selectedProfileId = usePatientProfilesStore(
    (state) => state.selectedByAccount[user?.TK_SDT ?? ''],
  );
  const setSelectedProfile = usePatientProfilesStore((state) => state.setSelectedProfile);
  const { data: specialties } = useSpecialties();

  const [step, setStep] = useState<FlowStep>('profile');
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
      toast.error(getPatientSafeErrorMessage(error, 'Không thể tạo lịch khám lúc này. Vui lòng thử lại.'));
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
      toast.error(getPatientSafeErrorMessage(error, 'Không thể tạo lại link thanh toán.'));
    },
  });

  const selectedSpecialty = (specialties ?? []).find((item) => String(item.CK_MA) === specialtyId);
  const clinicalOrder = getClinicalOrder(entryMode);
  const currentStepIndex = FLOW_SEQUENCE.findIndex((item) => item === step);
  const currentStepLabel = STEP_LABELS[step];
  const currentGroup = getStepGroup(step);

  const canContinueProfile = Boolean(selectedProfile);
  const canContinueEntry = Boolean(selectedProfile && entryMode);
  const canContinueClinical = Boolean(selectedDate && specialtyId && selectedDoctor && selectedSlot);
  const canContinueInsurance =
    hasBHYT !== null &&
    hasPrivateInsurance !== null &&
    (!hasBHYT || Boolean(bhytType)) &&
    (!hasPrivateInsurance || Boolean(privateInsuranceProvider));

  const bhytTypeLabel = (bhytTypesQuery.data ?? []).find((item) => item.id === bhytType)?.label || bhytType;
  const privateInsuranceLabel =
    (privateProvidersQuery.data ?? []).find((item) => item.id === privateInsuranceProvider)?.name ||
    privateInsuranceProvider;
  const availableProviders = privateProvidersQuery.data ?? [];

  const doctorError = doctorsQuery.isError
    ? getPatientSafeErrorMessage(doctorsQuery.error, 'Không tải được danh sách bác sĩ. Vui lòng thử lại.')
    : null;
  const slotsError = slotsQuery.isError
    ? getPatientSafeErrorMessage(slotsQuery.error, 'Không tải được danh sách khung giờ. Vui lòng thử lại.')
    : null;

  const resetFlowFromBookingMethodChange = () => {
    setSpecialtyId('');
    setSelectedDoctorId(null);
    setSelectedSlotKey(null);
    setSymptoms('');
    setPreVisitNote('');
    setHasBHYT(null);
    setBhytType('');
    setHasPrivateInsurance(null);
    setPrivateInsuranceProvider('');
    setPrivateInsuranceSearch('');
    setPaymentMethod('VNPAY');
    setCreatedAppointmentId(null);
    setCreatedPaymentRef(null);
    setCreatedPaymentUrl(null);
  };

  const resetFlowFromProfileChange = () => {
    setEntryMode(null);
    setSelectedDate(todayIso());
    resetFlowFromBookingMethodChange();
  };

  const handleSelectEntryMode = (mode: EntryMode) => {
    if (entryMode === mode) return;
    setEntryMode(mode);
    resetFlowFromBookingMethodChange();
  };

  const handleProfileSelect = (profileId: number) => {
    if (!user?.TK_SDT) return;
    const isChanged = selectedProfile?.BN_MA !== profileId;
    if (!isChanged) return;
    setSelectedProfile(user.TK_SDT, profileId);
    resetFlowFromProfileChange();
  };

  const handleChangeDate = (value: string) => {
    setSelectedDate(value);
    setSelectedSlotKey(null);
  };

  const handleChangeSpecialty = (value: string) => {
    setSpecialtyId(value);
    setSelectedDoctorId(null);
    setSelectedSlotKey(null);
  };

  const handleChangeDoctor = (doctor: BookingDoctor) => {
    setSelectedDoctorId(doctor.BS_MA);
    setSelectedSlotKey(null);
    if (entryMode === 'BY_DOCTOR') {
      setSpecialtyId(String(doctor.CK_MA));
    }
  };

  const goBack = () => {
    if (step === 'entry') return setStep('profile');
    if (step === 'clinical') return setStep('entry');
    if (step === 'insurance') return setStep('clinical');
    if (step === 'review') return setStep('insurance');
    if (step === 'paymentMethod') return setStep('review');
    if (step === 'paymentInfo') return setStep('paymentMethod');
    if (step === 'result') return setStep('paymentInfo');
  };

  const submitCreateBooking = () => {
    if (!selectedProfile || !selectedDoctor || !selectedSlot || !selectedDate) {
      toast.error('Vui lòng chọn đủ hồ sơ, ngày khám, bác sĩ và khung giờ.');
      return;
    }

    if (!canContinueInsurance) {
      toast.error('Vui lòng hoàn tất thông tin bảo hiểm trước khi thanh toán.');
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

  const summaryGuidance = useMemo(() => {
    const guidance: string[] = [];
    if (!selectedProfile) return ['Chọn hồ sơ bệnh nhân để tiếp tục.'];
    if (!entryMode) return ['Chọn cách đặt lịch phù hợp với nhu cầu của bạn.'];
    if (!selectedDoctor) guidance.push('Chọn bác sĩ khám phù hợp.');
    if (!selectedSlot) guidance.push('Chọn khung giờ còn trống.');
    if (hasBHYT === null || hasPrivateInsurance === null) {
      guidance.push('Trả lời đầy đủ thông tin bảo hiểm.');
    }
    return guidance.slice(0, 3);
  }, [entryMode, hasBHYT, hasPrivateInsurance, selectedDoctor, selectedProfile, selectedSlot]);

  const summaryNextAction = useMemo(() => {
    if (step === 'profile') return selectedProfile ? 'Tiếp tục sang bước chọn cách đặt lịch.' : 'Chọn hồ sơ bệnh nhân để bắt đầu.';
    if (step === 'entry') return selectedProfile ? 'Chọn cách đặt lịch cho hồ sơ đã chọn.' : 'Quay lại chọn hồ sơ bệnh nhân trước.';
    if (step === 'clinical') return canContinueClinical ? 'Kiểm tra lại lịch đã chọn rồi tiếp tục.' : 'Hoàn tất chọn ngày, bác sĩ và khung giờ.';
    if (step === 'insurance') return canContinueInsurance ? 'Bạn đã xong phần thông tin, có thể tiếp tục.' : 'Trả lời 2 câu hỏi bảo hiểm để tiếp tục.';
    if (step === 'review') return 'Xác nhận lại thông tin trước khi thanh toán.';
    if (step === 'paymentMethod') return 'Chọn phương thức thanh toán khả dụng để tạo giao dịch.';
    if (step === 'paymentInfo') return 'Hoàn tất thanh toán rồi kiểm tra trạng thái.';
    return 'Xem kết quả và quản lý lịch hẹn của bạn.';
  }, [canContinueClinical, canContinueInsurance, selectedProfile, step]);

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 font-sans sm:px-6 lg:px-8">
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
    <div className="mx-auto max-w-[1360px] px-4 py-6 font-sans sm:px-6 lg:px-8">
      <section className="mb-4 rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-700 px-5 py-4 text-white sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">Đặt khám trực tuyến</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Đặt lịch khám nhanh, rõ ràng, ít thao tác</h1>
            <p className="mt-1 text-sm text-cyan-50/90">Bạn luôn thấy rõ đang ở bước nào và cần làm gì tiếp theo.</p>
          </div>
          <span className="inline-flex items-center rounded-full border border-cyan-200/40 bg-cyan-100/10 px-3 py-1 text-xs font-medium text-cyan-100">
            {STEP_GROUPS.find((item) => item.key === currentGroup)?.label}
          </span>
        </div>
      </section>

      <BookingGroupStepper currentStep={step} />

      <div className="mt-4 grid gap-6 xl:grid-cols-[200px_minmax(0,1fr)_340px]">
        <ProgressSidebar currentStep={step} />

        <main className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Cụm bước: {STEP_GROUPS.find((item) => item.key === currentGroup)?.label}
              </p>
              <p className="text-base font-semibold text-slate-900">
                {currentStepLabel} ({currentStepIndex + 1}/{FLOW_SEQUENCE.length})
              </p>
            </div>
            {step !== 'profile' ? (
              <Button variant="outline" onClick={goBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Quay lại
              </Button>
            ) : null}
          </div>

          {step === 'entry' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 2. Chọn cách bắt đầu đặt lịch</CardTitle>
                <CardDescription>
                  {selectedProfile
                    ? `Đang đặt cho ${getPatientProfileFullName(selectedProfile)}. Hãy chọn cách bắt đầu thuận tiện nhất.`
                    : 'Hãy quay lại chọn hồ sơ bệnh nhân trước khi chọn cách đặt.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-3">
                  {ENTRY_OPTIONS.map((item) => {
                    const isSelected = entryMode === item.mode;
                    return (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => handleSelectEntryMode(item.mode)}
                        className={`rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          isSelected
                            ? 'border-blue-400 bg-blue-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-base font-semibold text-slate-900">{item.title}</p>
                          {isSelected ? <CheckCircle2 className="h-5 w-5 text-blue-600" /> : null}
                        </div>
                        <p className="mt-2 text-sm text-slate-700">{item.description}</p>
                        <p className="mt-2 text-xs text-slate-500">{item.hint}</p>
                      </button>
                    );
                  })}
                </div>
                <BookingActionBar
                  nextLabel="Tiếp tục"
                  onNext={() => setStep('clinical')}
                  nextDisabled={!canContinueEntry}
                  helperText={
                    !selectedProfile
                      ? 'Bạn cần chọn hồ sơ bệnh nhân trước.'
                      : !entryMode
                      ? 'Vui lòng chọn một cách đặt để tiếp tục.'
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          ) : null}

          {step === 'profile' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 1. Chọn hồ sơ bệnh nhân</CardTitle>
                <CardDescription>Hồ sơ đã chọn sẽ được dùng cho toàn bộ luồng đặt lịch và thanh toán.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {profilesQuery.isLoading ? (
                  <StateCard message="Đang tải hồ sơ bệnh nhân..." />
                ) : profilesQuery.isError ? (
                    <InlineError
                    message={getPatientSafeErrorMessage(
                      profilesQuery.error,
                      'Không tải được danh sách hồ sơ. Vui lòng thử lại.',
                    )}
                  />
                ) : activeProfiles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                    <p className="text-lg font-semibold text-slate-900">Bạn chưa có hồ sơ bệnh nhân</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Vui lòng tạo hồ sơ trước khi tiếp tục đặt lịch.
                    </p>
                    <Button asChild className="mt-4 bg-blue-600 hover:bg-blue-700">
                      <Link to="/patient-profiles/create">Tạo hồ sơ mới</Link>
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
                          onClick={() => handleProfileSelect(profile.BN_MA)}
                          className={`rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                            isSelected
                              ? 'border-blue-400 bg-blue-50 shadow-sm'
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
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                {getPatientProfileFullName(profile)}
                              </p>
                              <p className="text-sm text-slate-500">Mã hồ sơ #{profile.BN_MA}</p>
                            </div>
                          </div>
                          {isSelected ? (
                            <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Đang sử dụng hồ sơ này
                            </p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}

                <BookingActionBar
                  nextLabel="Tiếp tục"
                  onNext={() => setStep('entry')}
                  nextDisabled={!canContinueProfile}
                  helperText={!canContinueProfile ? 'Chọn một hồ sơ để tiếp tục.' : undefined}
                />
              </CardContent>
            </Card>
          ) : null}
          {step === 'clinical' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Chọn lịch khám</CardTitle>
                <CardDescription>
                  Trình tự theo cách đặt hiện tại: {clinicalOrder.map(sectionTitleForSelector).join(' -> ')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {clinicalOrder.map((selectorKey, index) => (
                  <SectionCard
                    key={selectorKey}
                    title={`${index + 1}. ${sectionTitleForSelector(selectorKey)}`}
                    subtitle={selectorKey === 'slot' ? 'Chỉ hiển thị khung giờ còn trống.' : undefined}
                  >
                    {selectorKey === 'date' ? (
                      <div className="space-y-3">
                        <BookingCalendar
                          value={selectedDate}
                          min={todayIso()}
                          max={maxBookingDateIso()}
                          onChange={handleChangeDate}
                        />
                        <p className="text-xs text-slate-500">
                          Hệ thống hỗ trợ đặt lịch tối đa 3 tháng tính từ hôm nay.
                        </p>
                      </div>
                    ) : null}

                    {selectorKey === 'specialty' ? (
                      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                        <Label>Chuyên khoa</Label>
                        <Select
                          value={specialtyId || ''}
                          onValueChange={handleChangeSpecialty}
                          disabled={entryMode === 'BY_DOCTOR' && Boolean(selectedDoctor)}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Chọn chuyên khoa" />
                          </SelectTrigger>
                          <SelectContent className="z-[120] bg-white">
                            {(specialties ?? []).map((item) => (
                              <SelectItem key={item.CK_MA} value={String(item.CK_MA)}>
                                {item.CK_TEN}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {entryMode === 'BY_DOCTOR' && selectedDoctor ? (
                          <p className="text-xs text-slate-500">
                            Chuyên khoa được tự động đồng bộ theo bác sĩ bạn đã chọn.
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {selectorKey === 'doctor' ? (
                      <div className="space-y-3">
                        <Label htmlFor="doctor-search">Tìm bác sĩ</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            id="doctor-search"
                            value={doctorSearch}
                            onChange={(event) => setDoctorSearch(event.target.value)}
                            className="pl-9"
                            placeholder="Nhập tên bác sĩ"
                          />
                        </div>

                        {doctorError ? <InlineError message={doctorError} /> : null}

                        {doctorsQuery.isLoading ? (
                          <StateCard message="Đang tải danh sách bác sĩ..." />
                        ) : doctorList.length === 0 ? (
                          <StateCard message="Không có bác sĩ phù hợp với điều kiện đã chọn." dashed />
                        ) : (
                          <div className="grid max-h-72 gap-3 overflow-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                            {doctorList.map((doctor) => {
                              const isSelected = selectedDoctorId === doctor.BS_MA;
                              return (
                                <button
                                  key={doctor.BS_MA}
                                  type="button"
                                  onClick={() => handleChangeDoctor(doctor)}
                                  className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                    isSelected
                                      ? 'border-blue-400 bg-blue-50'
                                      : 'border-slate-200 bg-white hover:border-blue-200'
                                  }`}
                                >
                                  <p className="font-semibold text-slate-900">
                                    {doctor.BS_HOC_HAM
                                      ? `${doctor.BS_HOC_HAM} ${doctor.BS_HO_TEN}`
                                      : doctor.BS_HO_TEN}
                                  </p>
                                  <p className="text-sm text-slate-500">
                                    {doctor.CHUYEN_KHOA || 'Chưa cập nhật chuyên khoa'}
                                  </p>
                                  {isSelected ? (
                                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Đã chọn bác sĩ
                                    </p>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {selectorKey === 'slot' ? (
                      <div className="space-y-3">
                        {!selectedDoctor ? (
                          <StateCard message="Bạn hãy chọn bác sĩ trước để xem khung giờ còn trống." dashed />
                        ) : slotsQuery.isLoading ? (
                          <StateCard message="Đang tải khung giờ..." />
                        ) : slotsError ? (
                          <InlineError message={slotsError} />
                        ) : (slotsQuery.data ?? []).length === 0 ? (
                          <StateCard message="Bác sĩ không có lịch trong ngày đã chọn." dashed />
                        ) : (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Còn trống
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-blue-700">
                                <span className="h-2 w-2 rounded-full bg-blue-500" /> Đang chọn
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-500">
                                <span className="h-2 w-2 rounded-full bg-slate-400" /> Đã đầy
                              </span>
                            </div>
                            {(slotsQuery.data ?? []).map((session) => (
                              <div key={`${session.B_TEN}-${session.PHONG || 'NA'}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-slate-900">
                                      {getSessionLabel(session.B_TEN)}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                      Phòng khám: {session.PHONG || 'Chưa cập nhật'}
                                    </p>
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
                                        className={`rounded-lg border px-3 py-2 text-sm transition ${
                                          !slot.available
                                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                            : isSelected
                                            ? 'border-blue-600 bg-blue-600 font-medium text-white'
                                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                                        }`}
                                      >
                                        <p>{slot.KG_BAT_DAU.slice(11, 16)} - {slot.KG_KET_THUC.slice(11, 16)}</p>
                                        <p className="text-[11px] opacity-90">
                                          {!slot.available ? 'Đầy' : isSelected ? 'Đang chọn' : 'Còn trống'}
                                        </p>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </SectionCard>
                ))}

                <SectionCard title="Thông tin bổ sung cho bác sĩ">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="symptoms">Triệu chứng (không bắt buộc)</Label>
                      <Textarea
                        id="symptoms"
                        value={symptoms}
                        onChange={(event) => setSymptoms(event.target.value)}
                        maxLength={1000}
                        placeholder="Ví dụ: đau họng, sốt nhẹ, ho kéo dài 3 ngày..."
                      />
                      <p className="text-xs text-slate-500">{symptoms.length}/1000 ký tự</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pre-visit-note">Ghi chú thêm (không bắt buộc)</Label>
                      <Textarea
                        id="pre-visit-note"
                        value={preVisitNote}
                        onChange={(event) => setPreVisitNote(event.target.value)}
                        maxLength={2000}
                        placeholder="Thông tin thêm cần lưu ý trước khi khám."
                      />
                      <p className="text-xs text-slate-500">{preVisitNote.length}/2000 ký tự</p>
                    </div>
                  </div>
                </SectionCard>

                <BookingActionBar
                  onBack={goBack}
                  nextLabel="Tiếp tục"
                  onNext={() => setStep('insurance')}
                  nextDisabled={!canContinueClinical}
                  helperText={
                    !canContinueClinical
                      ? 'Bạn cần chọn đủ ngày khám, chuyên khoa, bác sĩ và khung giờ.'
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          ) : null}

          {step === 'insurance' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Thông tin bảo hiểm</CardTitle>
                <CardDescription>Vui lòng trả lời đầy đủ để hệ thống tính đúng quyền lợi và thanh toán.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SectionCard title="1. Bạn có bảo hiểm y tế (BHYT) không?">
                  <ChoiceToggle
                    value={hasBHYT}
                    onChange={(value) => {
                      setHasBHYT(value);
                      if (!value) setBhytType('');
                    }}
                  />
                  {hasBHYT ? (
                    <div className="mt-4 space-y-2">
                      <Label>Chọn loại BHYT</Label>
                      {bhytTypesQuery.isLoading ? (
                        <StateCard message="Đang tải danh sách loại BHYT..." compact />
                      ) : bhytTypesQuery.isError ? (
                        <InlineError
                          message={getPatientSafeErrorMessage(
                            bhytTypesQuery.error,
                            'Không tải được danh sách loại BHYT.',
                          )}
                        />
                      ) : (
                        <div className="relative z-20 max-h-64 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                          {(bhytTypesQuery.data ?? []).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setBhytType(item.id)}
                              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                                bhytType === item.id
                                  ? 'border-blue-400 bg-blue-50'
                                  : 'border-slate-200 bg-white hover:border-blue-200'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </SectionCard>

                <SectionCard title="2. Bạn có bảo hiểm tư nhân không?">
                  <ChoiceToggle
                    value={hasPrivateInsurance}
                    onChange={(value) => {
                      setHasPrivateInsurance(value);
                      if (!value) {
                        setPrivateInsuranceProvider('');
                        setPrivateInsuranceSearch('');
                      }
                    }}
                  />
                  {hasPrivateInsurance ? (
                    <div className="mt-4 space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="private-insurance-search">Tìm công ty bảo hiểm</Label>
                        <Input
                          id="private-insurance-search"
                          value={privateInsuranceSearch}
                          onChange={(event) => setPrivateInsuranceSearch(event.target.value)}
                          placeholder="Nhập tên công ty bảo hiểm"
                        />
                      </div>
                      {privateProvidersQuery.isLoading ? (
                        <StateCard message="Đang tải danh sách công ty..." compact />
                      ) : privateProvidersQuery.isError ? (
                        <InlineError
                          message={getPatientSafeErrorMessage(
                            privateProvidersQuery.error,
                            'Không tải được danh sách công ty bảo hiểm.',
                          )}
                        />
                      ) : availableProviders.length === 0 ? (
                        <StateCard message="Không tìm thấy công ty phù hợp." compact dashed />
                      ) : (
                        <div className="relative z-20 max-h-64 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                          {availableProviders.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setPrivateInsuranceProvider(item.id)}
                              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                                privateInsuranceProvider === item.id
                                  ? 'border-blue-400 bg-blue-50'
                                  : 'border-slate-200 bg-white hover:border-blue-200'
                              }`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </SectionCard>

                <BookingActionBar
                  onBack={goBack}
                  nextLabel="Tiếp tục"
                  onNext={() => setStep('review')}
                  nextDisabled={!canContinueInsurance}
                  helperText={
                    !canContinueInsurance
                      ? 'Vui lòng trả lời đầy đủ các câu hỏi bảo hiểm để tiếp tục.'
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          ) : null}
          {step === 'review' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Xem lại thông tin</CardTitle>
                <CardDescription>Kiểm tra lại thông tin trước khi chuyển sang bước thanh toán.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ReviewBlock
                  title="Cách đặt"
                  rows={[
                    ['Phương thức', ENTRY_OPTIONS.find((item) => item.mode === entryMode)?.title || '--'],
                  ]}
                />
                <ReviewBlock
                  title="Hồ sơ bệnh nhân"
                  rows={[
                    ['Họ tên', selectedProfile ? getPatientProfileFullName(selectedProfile) : '--'],
                    ['Mã hồ sơ', selectedProfile ? `#${selectedProfile.BN_MA}` : '--'],
                  ]}
                />
                <ReviewBlock
                  title="Lịch khám"
                  rows={[
                    ['Ngày khám', selectedDate ? formatDateDdMmYyyy(selectedDate) : '--'],
                    ['Chuyên khoa', selectedSpecialty?.CK_TEN || '--'],
                    ['Bác sĩ', selectedDoctor?.BS_HO_TEN || '--'],
                    [
                      'Khung giờ',
                      selectedSlot
                        ? `${selectedSlot.KG_BAT_DAU.slice(11, 16)} - ${selectedSlot.KG_KET_THUC.slice(11, 16)}`
                        : '--',
                    ],
                    ['Phòng khám', selectedSlot?.PHONG || '--'],
                  ]}
                />
                <ReviewBlock
                  title="Bảo hiểm"
                  rows={[
                    ['BHYT', hasBHYT ? `Có - ${bhytTypeLabel || 'Đã chọn'}` : 'Không'],
                    [
                      'Bảo hiểm tư nhân',
                      hasPrivateInsurance ? `Có - ${privateInsuranceLabel || 'Đã chọn'}` : 'Không',
                    ],
                  ]}
                />
                <BookingActionBar
                  onBack={goBack}
                  nextLabel="Tiếp tục thanh toán"
                  onNext={() => setStep('paymentMethod')}
                />
              </CardContent>
            </Card>
          ) : null}

          {step === 'paymentMethod' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Chọn phương thức thanh toán</CardTitle>
                <CardDescription>Hiện tại hệ thống hỗ trợ thanh toán trực tuyến qua VNPAY.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {PAYMENT_METHOD_OPTIONS.map((item) => {
                  const isSelected = paymentMethod === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      disabled={!item.available}
                      onClick={() => setPaymentMethod(item.value)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        !item.available
                          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                          : isSelected
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-slate-200 bg-white hover:border-blue-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{item.label}</p>
                        {item.available ? (
                          isSelected ? (
                            <CheckCircle2 className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Circle className="h-5 w-5 text-slate-300" />
                          )
                        ) : (
                          <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-500">
                            Coming soon
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm">{item.note}</p>
                    </button>
                  );
                })}

                <BookingActionBar
                  onBack={goBack}
                  nextLabel={createMutation.isPending ? 'Đang tạo thanh toán...' : 'Xác nhận và tạo thanh toán'}
                  onNext={submitCreateBooking}
                  nextDisabled={createMutation.isPending}
                />
              </CardContent>
            </Card>
          ) : null}

          {step === 'paymentInfo' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Theo dõi thanh toán</CardTitle>
                <CardDescription>Hoàn tất thanh toán để xác nhận lịch hẹn.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Mã lịch hẹn</p>
                  <p className="text-xl font-semibold text-slate-900">#{createdAppointmentId || '--'}</p>
                  <p className="mt-3 text-sm text-slate-500">Mã tham chiếu thanh toán</p>
                  <p className="text-lg font-semibold text-slate-900">{createdPaymentRef || '--'}</p>
                  <p className="mt-3 text-sm text-slate-500">Trạng thái thanh toán</p>
                  <span className="mt-1 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                    {paymentStatusQuery.data?.payment
                      ? getPaymentStatusLabel(paymentStatusQuery.data.payment.normalizedStatus)
                      : 'Chưa thanh toán'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      if (!canOpenPaymentUrl(createdPaymentUrl)) {
                        toast.error('Không có URL thanh toán hợp lệ.');
                        return;
                      }
                      window.location.assign(createdPaymentUrl as string);
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={!canOpenPaymentUrl(createdPaymentUrl)}
                  >
                    <Wallet className="mr-2 h-4 w-4" /> Mở thanh toán
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => paymentStatusQuery.refetch()}
                    disabled={paymentStatusQuery.isFetching}
                  >
                    {paymentStatusQuery.isFetching ? (
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Clock3 className="mr-2 h-4 w-4" />
                    )}
                    Kiểm tra trạng thái
                  </Button>
                  {createdAppointmentId ? (
                    <Button
                      variant="outline"
                      onClick={() => retryPaymentMutation.mutate(createdAppointmentId)}
                      disabled={retryPaymentMutation.isPending}
                    >
                      {retryPaymentMutation.isPending ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 h-4 w-4" />
                      )}
                      Thanh toán lại
                    </Button>
                  ) : null}
                </div>

                <BookingActionBar
                  onBack={goBack}
                  nextLabel="Đi tới kết quả"
                  onNext={() => setStep('result')}
                  nextVariant="outline"
                />
              </CardContent>
            </Card>
          ) : null}

          {step === 'result' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Hoàn tất</CardTitle>
                <CardDescription>Kết quả xử lý thanh toán và lịch hẹn của bạn.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {resultTone === 'success' ? (
                  <StatusBanner
                    tone="success"
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="Thanh toán thành công"
                    description="Lịch hẹn đã được xác nhận."
                  />
                ) : resultTone === 'failed' ? (
                  <StatusBanner
                    tone="error"
                    icon={<XCircle className="h-5 w-5" />}
                    title="Thanh toán chưa thành công"
                    description="Bạn có thể thử thanh toán lại hoặc kiểm tra lịch hẹn của mình."
                  />
                ) : (
                  <StatusBanner
                    tone="warning"
                    icon={<LoaderCircle className="h-5 w-5 animate-spin" />}
                    title="Thanh toán đang xử lý"
                    description="Hệ thống đang cập nhật trạng thái thanh toán, vui lòng kiểm tra lại sau."
                  />
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <p>
                    Mã lịch hẹn: <strong>#{createdAppointmentId || '--'}</strong>
                  </p>
                  <p>
                    Trạng thái hiện tại:{' '}
                    <strong>
                      {paymentStatusQuery.data?.payment
                        ? getPaymentStatusLabel(paymentStatusQuery.data.payment.normalizedStatus)
                        : 'Chưa có dữ liệu'}
                    </strong>
                  </p>
                  <p>
                    Bác sĩ: <strong>{selectedDoctor?.BS_HO_TEN || '--'}</strong>
                  </p>
                  <p>
                    Khung giờ:{' '}
                    <strong>
                      {selectedSlot
                        ? `${selectedSlot.KG_BAT_DAU.slice(11, 16)} - ${selectedSlot.KG_KET_THUC.slice(11, 16)}`
                        : '--'}
                    </strong>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild className="bg-blue-600 hover:bg-blue-700">
                    <Link to="/appointments/my">Xem lịch hẹn của tôi</Link>
                  </Button>
                  {createdAppointmentId ? (
                    <Button asChild variant="outline">
                      <Link to={`/appointments/${createdAppointmentId}`}>Xem chi tiết lịch hẹn</Link>
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => setStep('profile')}>
                    Đặt lịch mới
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </main>

        <aside className="order-last xl:order-none">
          <SummaryPanel
            selectedProfile={selectedProfile}
            entryMode={entryMode}
            selectedDate={selectedDate}
            selectedSpecialty={selectedSpecialty?.CK_TEN || null}
            selectedDoctor={selectedDoctor?.BS_HO_TEN || null}
            selectedSlotLabel={
              selectedSlot
                ? `${selectedSlot.KG_BAT_DAU.slice(11, 16)} - ${selectedSlot.KG_KET_THUC.slice(11, 16)}`
                : null
            }
            selectedRoom={selectedSlot?.PHONG || null}
            hasBHYT={hasBHYT}
            bhytTypeLabel={bhytTypeLabel || null}
            hasPrivateInsurance={hasPrivateInsurance}
            privateInsuranceLabel={privateInsuranceLabel || null}
            paymentMethod={paymentMethod}
            createdAppointmentId={createdAppointmentId}
            createdPaymentRef={createdPaymentRef}
            currentPaymentStatus={
              paymentStatusQuery.data?.payment
                ? getPaymentStatusLabel(paymentStatusQuery.data.payment.normalizedStatus)
                : null
            }
            guidance={summaryGuidance}
            nextAction={summaryNextAction}
          />
        </aside>
      </div>
    </div>
  );
}

function BookingGroupStepper({ currentStep }: { currentStep: FlowStep }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Tiến trình đặt khám</p>
          <p className="text-xs text-slate-500">4 cụm thao tác</p>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          {STEP_GROUPS.map((group, index) => {
            const status = getStepStatus(currentStep, group.key);
            return (
              <div
                key={group.key}
                className={`rounded-xl border px-3 py-3 text-sm ${
                  status === 'done'
                    ? 'border-emerald-200 bg-emerald-50'
                    : status === 'current'
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{index + 1}. {group.label}</p>
                  {status === 'done' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : status === 'current' ? (
                    <Circle className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-300" />
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">{group.description}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressSidebar({ currentStep }: { currentStep: FlowStep }) {
  return (
    <aside className="hidden xl:block">
      <Card className="sticky top-24 border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">Điều hướng nhanh</CardTitle>
          <CardDescription>Bạn đang ở bước: {STEP_LABELS[currentStep]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {FLOW_SEQUENCE.map((step, index) => {
            const currentIndex = FLOW_SEQUENCE.findIndex((item) => item === currentStep);
            const done = index < currentIndex;
            const active = index === currentIndex;
            return (
              <div key={step} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : active ? (
                  <Circle className="h-4 w-4 text-blue-600" />
                ) : (
                  <Circle className="h-4 w-4 text-slate-300" />
                )}
                <span className={active ? 'font-semibold text-slate-900' : 'text-slate-600'}>
                  {STEP_LABELS[step]}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </aside>
  );
}
function SummaryPanel(props: {
  selectedProfile: PatientProfile | null;
  entryMode: EntryMode | null;
  selectedDate: string;
  selectedSpecialty: string | null;
  selectedDoctor: string | null;
  selectedSlotLabel: string | null;
  selectedRoom: string | null;
  hasBHYT: boolean | null;
  bhytTypeLabel: string | null;
  hasPrivateInsurance: boolean | null;
  privateInsuranceLabel: string | null;
  paymentMethod: string;
  createdAppointmentId: number | null;
  createdPaymentRef: number | null;
  currentPaymentStatus: string | null;
  guidance: string[];
  nextAction: string;
}) {
  const {
    selectedProfile,
    entryMode,
    selectedDate,
    selectedSpecialty,
    selectedDoctor,
    selectedSlotLabel,
    selectedRoom,
    hasBHYT,
    bhytTypeLabel,
    hasPrivateInsurance,
    privateInsuranceLabel,
    paymentMethod,
    createdAppointmentId,
    createdPaymentRef,
    currentPaymentStatus,
    guidance,
    nextAction,
  } = props;

  const entryLabel = ENTRY_OPTIONS.find((item) => item.mode === entryMode)?.title || null;

  return (
    <Card className="xl:sticky xl:top-24 border-slate-200">
      <CardHeader>
        <CardTitle className="text-base">Tóm tắt lựa chọn</CardTitle>
        <CardDescription>Thông tin bạn đã chọn và việc cần làm tiếp theo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
            <Sparkles className="h-3.5 w-3.5" /> Việc cần làm ngay
          </p>
          <p className="mt-1 text-sm font-medium leading-5 text-cyan-900">{nextAction}</p>
          {guidance.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-cyan-800">
              {guidance.slice(0, 2).map((item) => (
                <li key={item} className="break-words">
                  • {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hồ sơ đã chọn</p>
          {selectedProfile ? (
            <div className="mt-2 flex items-center gap-3">
              <Avatar className="h-10 w-10 border border-slate-200">
                <AvatarImage src={selectedProfile.BN_ANH || ''} alt={getPatientProfileFullName(selectedProfile)} />
                <AvatarFallback className="bg-blue-100 text-blue-700">
                  <UserRound className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{getPatientProfileFullName(selectedProfile)}</p>
                <p className="text-xs text-slate-500">Mã hồ sơ #{selectedProfile.BN_MA}</p>
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
              Chưa chọn hồ sơ. Vui lòng chọn hồ sơ ở bước hiện tại.
            </div>
          )}
        </div>

        {entryLabel ? <SummaryLine icon={<ChevronRight className="h-4 w-4" />} label="Cách đặt" value={entryLabel} /> : null}
        {selectedDate ? (
          <SummaryLine icon={<CalendarDays className="h-4 w-4" />} label="Ngày khám" value={formatDateDdMmYyyy(selectedDate)} />
        ) : null}
        {selectedSpecialty ? (
          <SummaryLine icon={<Stethoscope className="h-4 w-4" />} label="Chuyên khoa" value={selectedSpecialty} />
        ) : null}
        {selectedDoctor ? (
          <SummaryLine icon={<UserRound className="h-4 w-4" />} label="Bác sĩ" value={selectedDoctor} />
        ) : null}
        {selectedSlotLabel ? (
          <SummaryLine icon={<Clock3 className="h-4 w-4" />} label="Khung giờ" value={selectedSlotLabel} />
        ) : null}
        {selectedRoom ? (
          <SummaryLine icon={<ChevronRight className="h-4 w-4" />} label="Phòng khám" value={selectedRoom} />
        ) : null}
        {hasBHYT !== null ? (
          <SummaryLine
            icon={<ShieldCheck className="h-4 w-4" />}
            label="BHYT"
            value={hasBHYT ? `Có${bhytTypeLabel ? ` - ${bhytTypeLabel}` : ''}` : 'Không'}
          />
        ) : null}
        {hasPrivateInsurance !== null ? (
          <SummaryLine
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Bảo hiểm tư nhân"
            value={hasPrivateInsurance ? `Có${privateInsuranceLabel ? ` - ${privateInsuranceLabel}` : ''}` : 'Không'}
          />
        ) : null}
        {paymentMethod ? (
          <SummaryLine icon={<Wallet className="h-4 w-4" />} label="Thanh toán" value={paymentMethod} />
        ) : null}

        {createdAppointmentId || createdPaymentRef || currentPaymentStatus ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
            <p className="font-medium text-blue-900">Thông tin thanh toán</p>
            {createdAppointmentId ? <p className="text-blue-800">Mã lịch hẹn: #{createdAppointmentId}</p> : null}
            {createdPaymentRef ? <p className="text-blue-800">Mã thanh toán: {createdPaymentRef}</p> : null}
            {currentPaymentStatus ? <p className="text-blue-800">Trạng thái: {currentPaymentStatus}</p> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-slate-500">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500">{label}</p>
        <p className="break-words font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}

type BookingCalendarDayStatus =
  | 'available'
  | 'selected'
  | 'today'
  | 'outsideRange'
  | 'outsideMonth'
  | 'holiday'
  | 'full';

type BookingCalendarDay = {
  iso: string;
  day: number;
  inCurrentMonth: boolean;
  status: BookingCalendarDayStatus;
};

function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isoFromDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthTitle(date: Date) {
  return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function buildMonthMatrix(params: {
  monthDate: Date;
  selectedIso: string;
  minIso: string;
  maxIso: string;
  holidayDates?: Set<string>;
  fullDates?: Set<string>;
}) {
  const { monthDate, selectedIso, minIso, maxIso, holidayDates, fullDates } = params;
  const first = startOfMonth(monthDate);
  const startOffset = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startOffset);
  const today = todayIso();

  const cells: BookingCalendarDay[] = [];
  for (let i = 0; i < 42; i += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + i);
    const iso = isoFromDate(current);
    const inCurrentMonth = isSameMonth(current, monthDate);

    let status: BookingCalendarDayStatus = 'available';
    if (!inCurrentMonth) status = 'outsideMonth';
    else if (iso < minIso || iso > maxIso) status = 'outsideRange';
    else if (holidayDates?.has(iso)) status = 'holiday';
    else if (fullDates?.has(iso)) status = 'full';
    else if (iso === selectedIso) status = 'selected';
    else if (iso === today) status = 'today';

    cells.push({
      iso,
      day: current.getDate(),
      inCurrentMonth,
      status,
    });
  }
  return cells;
}

function BookingCalendar({
  value,
  min,
  max,
  onChange,
  holidayDates,
  fullDates,
}: {
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
  holidayDates?: Set<string>;
  fullDates?: Set<string>;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parseIsoDate(value)));

  const cells = useMemo(
    () =>
      buildMonthMatrix({
        monthDate: visibleMonth,
        selectedIso: value,
        minIso: min,
        maxIso: max,
        holidayDates,
        fullDates,
      }),
    [fullDates, holidayDates, max, min, value, visibleMonth],
  );

  const minMonth = startOfMonth(parseIsoDate(min));
  const maxMonth = startOfMonth(parseIsoDate(max));
  const canGoPrev = visibleMonth > minMonth;
  const canGoNext = visibleMonth < maxMonth;

  const goPrev = () => {
    if (!canGoPrev) return;
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const goNext = () => {
    if (!canGoNext) return;
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const goToday = () => {
    const today = todayIso();
    if (today < min || today > max) return;
    setVisibleMonth(startOfMonth(parseIsoDate(today)));
    onChange(today);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">Lịch tháng</p>
          <p className="text-xs text-slate-500">Vui lòng chọn ngày có thể đặt khám.</p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <Button type="button" variant="ghost" size="icon" onClick={goPrev} disabled={!canGoPrev} aria-label="Tháng trước">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-[148px] text-center text-sm font-medium capitalize text-slate-900">{monthTitle(visibleMonth)}</p>
          <Button type="button" variant="ghost" size="icon" onClick={goNext} disabled={!canGoNext} aria-label="Tháng sau">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-2 flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={goToday}>
          Hôm nay
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold uppercase text-slate-500">
        {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day) => (
          <div key={day} className="py-1">{day}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {cells.map((cell) => {
          const selectable = cell.status === 'available' || cell.status === 'today' || cell.status === 'selected';
          const className =
            cell.status === 'selected'
              ? 'border-blue-200 bg-blue-50 text-blue-800'
              : cell.status === 'today'
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : cell.status === 'holiday'
              ? 'border-rose-200 bg-rose-50 text-rose-600'
              : cell.status === 'full'
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : cell.status === 'outsideRange'
              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
              : cell.status === 'outsideMonth'
              ? 'cursor-not-allowed border-transparent bg-transparent text-slate-300'
              : 'border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700';

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => (selectable ? onChange(cell.iso) : undefined)}
              disabled={!selectable}
              className={`relative h-11 rounded-lg border text-sm transition ${className}`}
              aria-label={`Ngày ${parseIsoDate(cell.iso).toLocaleDateString('vi-VN')}`}
            >
              {cell.day}
              {cell.status === 'today' ? <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-600" /> : null}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-slate-700">
        Ngày đã chọn: <span className="font-semibold">{formatDateDdMmYyyy(value)}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
        <LegendDot className="border-blue-600 bg-blue-600" label="Ngày có thể chọn" />
        <LegendDot className="border-blue-200 bg-blue-50" label="Ngày đã chọn" />
        <LegendDot className="border-blue-300 bg-blue-50" label="Hôm nay" />
        <LegendDot className="border-slate-200 bg-slate-100" label="Ngoài phạm vi đặt khám" />
        <LegendDot className="border-rose-200 bg-rose-50" label="Ngày nghỉ / lễ / tết" />
        <LegendDot className="border-amber-200 bg-amber-50" label="Đã đầy lịch" />
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded border ${className}`} />
      {label}
    </span>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <div className="mb-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function StateCard({ message, dashed, compact }: { message: string; dashed?: boolean; compact?: boolean }) {
  return (
    <div
      className={`rounded-2xl bg-slate-50 px-4 text-center text-slate-600 ${
        dashed ? 'border border-dashed border-slate-300' : 'border border-slate-200'
      } ${compact ? 'py-4 text-sm' : 'py-8'}`}
    >
      {message}
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4" />
        <p>{message}</p>
      </div>
    </div>
  );
}

function ChoiceToggle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 p-1">
      <Button
        type="button"
        variant={value === true ? 'default' : 'ghost'}
        className={value === true ? 'bg-blue-600 hover:bg-blue-700' : ''}
        onClick={() => onChange(true)}
      >
        Có
      </Button>
      <Button
        type="button"
        variant={value === false ? 'default' : 'ghost'}
        className={value === false ? 'bg-blue-600 hover:bg-blue-700' : ''}
        onClick={() => onChange(false)}
      >
        Không
      </Button>
    </div>
  );
}

function BookingActionBar({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  helperText,
  nextVariant,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  helperText?: string;
  nextVariant?: 'default' | 'outline';
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {helperText ? <p className="text-sm text-rose-600">{helperText}</p> : <p className="text-sm text-slate-500">Bạn có thể quay lại để chỉnh sửa bất kỳ lúc nào.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack}>
              Quay lại
            </Button>
          ) : null}
          <Button
            type="button"
            variant={nextVariant || 'default'}
            className={nextVariant === 'outline' ? '' : 'bg-blue-600 hover:bg-blue-700'}
            onClick={onNext}
            disabled={nextDisabled}
          >
            {nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReviewBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</h3>
      <div className="mt-2 space-y-2">
        {rows.map(([label, value]) => (
          <div key={`${title}-${label}`} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="max-w-[70%] text-right font-medium text-slate-900">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusBanner({
  tone,
  icon,
  title,
  description,
}: {
  tone: 'success' | 'error' | 'warning';
  icon: ReactNode;
  title: string;
  description: string;
}) {
  const className =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tone === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : 'border-amber-200 bg-amber-50 text-amber-800';

  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm">{description}</p>
        </div>
      </div>
    </div>
  );
}



