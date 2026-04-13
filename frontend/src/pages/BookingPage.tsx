import { forwardRef, type ButtonHTMLAttributes, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  LoaderCircle,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSpecialties } from '@/hooks/useSpecialties';
import { canOpenPaymentUrl } from '@/lib/appointments';
import { logFrontendError } from '@/lib/frontendLogger';
import { getPatientFlowErrorMessage } from '@/lib/patientFlowError';
import { setLastPaymentContext } from '@/lib/patientPaymentFlow';
import { getPatientProfileFullName } from '@/lib/patientProfiles';
import { formatDateDdMmYyyy, getSessionLabel } from '@/lib/scheduleDisplay';
import { appointmentsApi } from '@/services/api/appointmentsApi';
import {
  bookingApi,
  type BookingDoctor,
  type BookingServiceTypeOption,
  type DoctorCatalogSortBy,
  type DoctorCatalogSortDirection,
} from '@/services/api/bookingApi';
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
  | 'paymentCheckout'
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
  'paymentCheckout',
  'result',
];

const STEP_LABELS: Record<FlowStep, string> = {
  profile: 'Hồ sơ',
  entry: 'Cách đặt',
  clinical: 'Lịch khám',
  insurance: 'Bảo hiểm',
  review: 'Xem lại',
  paymentMethod: 'Chọn thanh toán',
  paymentCheckout: 'Thanh toán',
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
  { value: 'QR_BANKING', label: 'QR Banking', note: 'Khuyến nghị cho chuyển khoản nhanh', available: true },
  { value: 'VNPAY', label: 'VNPAY', note: 'Thanh toán qua cổng VNPAY', available: true },
  { value: 'MOMO', label: 'MoMo', note: 'Sắp hỗ trợ', available: false },
];

const DOCTOR_CATALOG_PAGE_SIZE = 8;

const DOCTOR_SORT_OPTIONS: Array<{
  label: string;
  sortBy: DoctorCatalogSortBy;
  sortDirection: DoctorCatalogSortDirection;
}> = [
  { label: 'Tên A-Z', sortBy: 'name', sortDirection: 'asc' },
  { label: 'Tên Z-A', sortBy: 'name', sortDirection: 'desc' },
  { label: 'Chuyên khoa A-Z', sortBy: 'specialty', sortDirection: 'asc' },
  { label: 'Học hàm/chức danh', sortBy: 'degree', sortDirection: 'asc' },
];

type DoctorFilterKey = 'keyword' | 'specialty' | 'degree' | 'gender';
type DoctorFilterPanelKey = 'specialty' | 'degree' | 'gender' | 'sort';

type DoctorFilterOption = {
  value: string;
  label: string;
};

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

function getDoctorDisplayName(doctor: Pick<BookingDoctor, 'BS_HO_TEN' | 'BS_HOC_HAM'>) {
  return doctor.BS_HOC_HAM ? `${doctor.BS_HOC_HAM} ${doctor.BS_HO_TEN}` : doctor.BS_HO_TEN;
}

function getInitials(value: string) {
  const compact = value.trim();
  if (!compact) return 'BS';
  const words = compact.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[words.length - 2][0] || ''}${words[words.length - 1][0] || ''}`.toUpperCase();
}

function getDoctorSearchableText(doctor: BookingDoctor) {
  return normalizeVietnameseText(
    [
      doctor.BS_HO_TEN,
      doctor.BS_HOC_HAM || '',
      doctor.CHUYEN_KHOA || '',
      doctor.CHUYEN_KHOA_DOI_TUONG_KHAM || '',
    ]
      .join(' ')
      .trim(),
  );
}

function buildDoctorSortValue(sortBy: DoctorCatalogSortBy, sortDirection: DoctorCatalogSortDirection) {
  return `${sortBy}:${sortDirection}`;
}

function parseDoctorSortValue(value: string): {
  sortBy: DoctorCatalogSortBy;
  sortDirection: DoctorCatalogSortDirection;
} {
  const [sortByRaw, sortDirectionRaw] = String(value || '').split(':');
  const sortBy: DoctorCatalogSortBy =
    sortByRaw === 'specialty' || sortByRaw === 'degree' ? sortByRaw : 'name';
  const sortDirection: DoctorCatalogSortDirection =
    sortDirectionRaw === 'desc' ? 'desc' : 'asc';
  return { sortBy, sortDirection };
}

function getClinicalOrder(mode: EntryMode | null): ClinicalSelectorKey[] {
  if (mode === 'BY_DATE') return ['date', 'specialty', 'doctor', 'slot'];
  if (mode === 'BY_DEPARTMENT') return ['specialty', 'date', 'doctor', 'slot'];
  return ['doctor', 'specialty', 'date', 'slot'];
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

function sectionTitleForSelector(key: ClinicalSelectorKey, mode?: EntryMode | null) {
  if (key === 'date') return 'Chọn ngày khám';
  if (key === 'specialty') return mode === 'BY_DOCTOR' ? 'Chọn loại hình khám' : 'Chọn chuyên khoa';
  if (key === 'doctor') return 'Chọn bác sĩ';
  return 'Chọn khung giờ';
}

function buildQrTransferContent(appointmentId?: number | null, paymentRef?: number | null) {
  if (!appointmentId || !paymentRef) return null;
  return `TT DK ${appointmentId} TT ${paymentRef}`;
}

function getPaymentMethodLabel(value?: string | null) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase();
  if (!normalized) return 'Chưa chọn';
  return PAYMENT_METHOD_OPTIONS.find((item) => item.value === normalized)?.label || normalized;
}

function toVndLabel(raw?: number | string | null) {
  const amount = Number(raw ?? 0);
  if (!Number.isFinite(amount)) return '--';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatCountdown(ms: number) {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function isLikelyQrImageUrl(url?: string | null) {
  if (!canOpenPaymentUrl(url)) return false;
  const value = String(url || '').toLowerCase();
  return value.includes('vietqr.io/image') || value.endsWith('.png') || value.includes('.png?');
}

function parseQrInfo(url?: string | null) {
  if (!canOpenPaymentUrl(url)) return null;
  try {
    const parsed = new URL(url as string);
    const marker = '/image/';
    const idx = parsed.pathname.indexOf(marker);
    let bankId = '';
    let accountNo = '';
    if (idx >= 0) {
      const slug = parsed.pathname.slice(idx + marker.length).split('/')[0];
      const [bank, account] = slug.split('-');
      bankId = decodeURIComponent(bank || '');
      accountNo = decodeURIComponent(account || '');
    }
    return {
      bankId: bankId || null,
      accountNo: accountNo || null,
      accountName: parsed.searchParams.get('accountName') || null,
      amount: parsed.searchParams.get('amount') || null,
      addInfo: parsed.searchParams.get('addInfo') || null,
    };
  } catch {
    return null;
  }
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
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorSearchDebounced, setDoctorSearchDebounced] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [selectedDoctorSnapshot, setSelectedDoctorSnapshot] = useState<BookingDoctor | null>(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);
  const [doctorCatalogSpecialtyFilter, setDoctorCatalogSpecialtyFilter] = useState<string>('all');
  const [doctorCatalogGenderFilter, setDoctorCatalogGenderFilter] = useState<string>('all');
  const [doctorCatalogDegreeFilter, setDoctorCatalogDegreeFilter] = useState<string>('all');
  const [doctorCatalogSortValue, setDoctorCatalogSortValue] = useState<string>(
    buildDoctorSortValue('name', 'asc'),
  );
  const [doctorCatalogPage, setDoctorCatalogPage] = useState<number>(1);
  const [activeDoctorFilterPanel, setActiveDoctorFilterPanel] = useState<DoctorFilterPanelKey | null>(null);
  const [clinicalSpecialtyPanelOpen, setClinicalSpecialtyPanelOpen] = useState(false);

  const [symptoms, setSymptoms] = useState('');
  const [preVisitNote, setPreVisitNote] = useState('');

  const [hasBHYT, setHasBHYT] = useState<boolean | null>(null);
  const [bhytType, setBhytType] = useState<string>('');
  const [hasPrivateInsurance, setHasPrivateInsurance] = useState<boolean | null>(null);
  const [privateInsuranceProvider, setPrivateInsuranceProvider] = useState<string>('');
  const [privateInsuranceSearch, setPrivateInsuranceSearch] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<string>('QR_BANKING');
  const [createdAppointmentId, setCreatedAppointmentId] = useState<number | null>(null);
  const [createdPaymentRef, setCreatedPaymentRef] = useState<number | null>(null);
  const [createdPaymentUrl, setCreatedPaymentUrl] = useState<string | null>(null);
  const [isValidatingSlotBeforePayment, setIsValidatingSlotBeforePayment] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [paymentSuccessDialogOpen, setPaymentSuccessDialogOpen] = useState(false);
  const [isSuccessTransitioning, setIsSuccessTransitioning] = useState(false);
  const queryClient = useQueryClient();
  const successHandledRef = useRef<string | null>(null);
  const successRedirectTimerRef = useRef<number | null>(null);

  const profilesQuery = useQuery({
    queryKey: queryKeys.patientProfiles.mine,
    queryFn: patientProfilesApi.listMine,
    enabled: Boolean(user?.TK_SDT),
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDoctorSearchDebounced(doctorSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [doctorSearch]);

  useEffect(() => {
    if (entryMode !== 'BY_DOCTOR') return;
    setDoctorCatalogPage(1);
  }, [
    doctorCatalogDegreeFilter,
    doctorCatalogGenderFilter,
    doctorCatalogSortValue,
    doctorCatalogSpecialtyFilter,
    doctorSearchDebounced,
    entryMode,
  ]);

  const activeProfiles = (profilesQuery.data?.items ?? []).filter((item) => item.BN_DA_VO_HIEU !== true);
  const selectedProfile = activeProfiles.find((item) => item.BN_MA === selectedProfileId) || null;

  useEffect(() => {
    if (!user?.TK_SDT || activeProfiles.length !== 1) return;
    if (selectedProfileId !== activeProfiles[0].BN_MA) {
      setSelectedProfile(user.TK_SDT, activeProfiles[0].BN_MA);
    }
  }, [activeProfiles, selectedProfileId, setSelectedProfile, user?.TK_SDT]);

  const doctorCatalogSort = useMemo(
    () => parseDoctorSortValue(doctorCatalogSortValue),
    [doctorCatalogSortValue],
  );
  const bookingDateMin = todayIso();
  const bookingDateMax = maxBookingDateIso();

  const availableDoctorsQuery = useQuery({
    queryKey: queryKeys.booking.doctors(specialtyId || 'all', selectedDate, doctorSearchDebounced),
    queryFn: () =>
      bookingApi.getAvailableDoctors({
        date: selectedDate || undefined,
        specialtyId: specialtyId ? Number(specialtyId) : undefined,
        q: doctorSearchDebounced || undefined,
      }),
    enabled: Boolean(selectedProfile && entryMode !== 'BY_DOCTOR'),
  });

  const doctorCatalogQuery = useQuery({
    queryKey: queryKeys.booking.doctorCatalog({
      q: doctorSearchDebounced,
      specialtyId: doctorCatalogSpecialtyFilter,
      degree: doctorCatalogDegreeFilter,
      gender: doctorCatalogGenderFilter,
      sortBy: doctorCatalogSort.sortBy,
      sortDirection: doctorCatalogSort.sortDirection,
      page: doctorCatalogPage,
      pageSize: DOCTOR_CATALOG_PAGE_SIZE,
    }),
    queryFn: () =>
      bookingApi.getDoctorCatalog({
        q: doctorSearchDebounced || undefined,
        specialtyId:
          doctorCatalogSpecialtyFilter !== 'all' ? Number(doctorCatalogSpecialtyFilter) : undefined,
        degree: doctorCatalogDegreeFilter !== 'all' ? doctorCatalogDegreeFilter : undefined,
        gender: doctorCatalogGenderFilter !== 'all' ? doctorCatalogGenderFilter : undefined,
        sortBy: doctorCatalogSort.sortBy,
        sortDirection: doctorCatalogSort.sortDirection,
        page: doctorCatalogPage,
        pageSize: DOCTOR_CATALOG_PAGE_SIZE,
      }),
    enabled: Boolean(selectedProfile && entryMode === 'BY_DOCTOR'),
  });

  useEffect(() => {
    if (entryMode !== 'BY_DOCTOR') return;
    const serverPage = doctorCatalogQuery.data?.page;
    if (!serverPage || serverPage === doctorCatalogPage) return;
    setDoctorCatalogPage(serverPage);
  }, [doctorCatalogPage, doctorCatalogQuery.data?.page, entryMode]);

  const serviceTypesQuery = useQuery({
    queryKey: queryKeys.booking.serviceTypes(specialtyId || ''),
    queryFn: () => bookingApi.getServiceTypesBySpecialty(Number(specialtyId)),
    enabled: Boolean(selectedProfile && specialtyId),
  });

  const doctorList = useMemo(() => {
    if (entryMode === 'BY_DOCTOR') return doctorCatalogQuery.data?.items ?? [];
    const keyword = normalizeVietnameseText(doctorSearchDebounced);
    if (!keyword) return availableDoctorsQuery.data ?? [];
    return (availableDoctorsQuery.data ?? []).filter((doctor) => getDoctorSearchableText(doctor).includes(keyword));
  }, [availableDoctorsQuery.data, doctorCatalogQuery.data?.items, doctorSearchDebounced, entryMode]);

  const selectedDoctor = useMemo(
    () =>
      doctorList.find((item) => item.BS_MA === selectedDoctorId) ||
      (selectedDoctorSnapshot?.BS_MA === selectedDoctorId ? selectedDoctorSnapshot : null),
    [doctorList, selectedDoctorId, selectedDoctorSnapshot],
  );

  const doctorBookableDatesQuery = useQuery({
    queryKey: queryKeys.booking.doctorBookableDates(
      selectedDoctorId,
      bookingDateMin,
      bookingDateMax,
    ),
    queryFn: () =>
      bookingApi.getDoctorBookableDates(selectedDoctorId!, {
        from: bookingDateMin,
        to: bookingDateMax,
      }),
    enabled: Boolean(selectedProfile && selectedDoctorId),
  });

  const doctorSelectableDates = useMemo(
    () => new Set(doctorBookableDatesQuery.data?.availableDates ?? []),
    [doctorBookableDatesQuery.data?.availableDates],
  );
  const doctorFullDates = useMemo(
    () => new Set(doctorBookableDatesQuery.data?.fullDates ?? []),
    [doctorBookableDatesQuery.data?.fullDates],
  );

  useEffect(() => {
    if (!selectedDoctorId) return;
    if (entryMode === 'BY_DOCTOR') return;
    const stillExists = doctorList.some((item) => item.BS_MA === selectedDoctorId);
    if (!stillExists) {
      setSelectedDoctorId(null);
      setSelectedDoctorSnapshot(null);
      setSelectedSlotKey(null);
    }
  }, [doctorList, entryMode, selectedDoctorId]);

  useEffect(() => {
    if (!selectedDoctorId) return;
    const availableDates = doctorBookableDatesQuery.data?.availableDates ?? [];
    if (availableDates.length === 0) {
      setSelectedSlotKey(null);
      return;
    }
    if (availableDates.includes(selectedDate)) return;
    setSelectedDate(availableDates[0]);
    setSelectedSlotKey(null);
  }, [doctorBookableDatesQuery.data?.availableDates, selectedDate, selectedDoctorId]);

  useEffect(() => {
    if (entryMode !== 'BY_DOCTOR' || !selectedDoctor) return;
    if (String(selectedDoctor.CK_MA) !== specialtyId) {
      setSpecialtyId(String(selectedDoctor.CK_MA));
      setSelectedServiceTypeId('');
      setSelectedSlotKey(null);
    }
  }, [entryMode, selectedDoctor, specialtyId]);

  const slotsQuery = useQuery({
    queryKey: queryKeys.booking.slots(selectedDoctorId, selectedDate, selectedProfile?.BN_MA || null),
    queryFn: () =>
      bookingApi.getDoctorSlotsForDay(selectedDoctorId!, selectedDate, selectedProfile?.BN_MA),
    enabled: Boolean(selectedDoctorId && selectedDate && selectedProfile),
    refetchInterval: step === 'clinical' && selectedDoctorId ? 15000 : false,
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

  const selectedSlot =
    allSlots.find((item) => item.key === selectedSlotKey && item.available && !item.alreadyBookedByProfile) ||
    null;
  const alreadyBookedSlots = useMemo(
    () => allSlots.filter((item) => Boolean(item.alreadyBookedByProfile)),
    [allSlots],
  );

  useEffect(() => {
    if (!selectedSlotKey) return;
    const matchedSlot = allSlots.find((item) => item.key === selectedSlotKey);
    const stillAvailable = Boolean(matchedSlot?.available) && !matchedSlot?.alreadyBookedByProfile;
    if (stillAvailable) return;
    setSelectedSlotKey(null);
    if (step === 'clinical') {
      toast.error(
        matchedSlot?.alreadyBookedByProfile
          ? 'Bạn đã có lịch khám ở khung giờ này. Vui lòng chọn khung giờ khác.'
          : 'Khung giờ bạn chọn vừa đầy chỗ. Vui lòng chọn khung giờ khác.',
      );
    }
  }, [allSlots, selectedSlotKey, step]);

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
    enabled: Boolean(createdAppointmentId) && (step === 'paymentCheckout' || step === 'result'),
    refetchInterval: step === 'paymentCheckout' && !isSuccessTransitioning ? 6000 : false,
  });

  useEffect(() => {
    const fallbackUrl = paymentStatusQuery.data?.payment?.paymentUrl;
    if (!canOpenPaymentUrl(fallbackUrl)) return;
    setCreatedPaymentUrl((current) => current || (fallbackUrl as string));
  }, [paymentStatusQuery.data?.payment?.paymentUrl]);

  useEffect(() => {
    if (step !== 'paymentCheckout') return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const openPaymentGateway = (url?: string | null, method?: string) => {
    if (!canOpenPaymentUrl(url)) {
      toast.error('Không có URL thanh toán hợp lệ.');
      return;
    }

    const targetMethod = String(method || paymentMethod).toUpperCase();
    if (targetMethod === 'QR_BANKING') {
      const nextTab = window.open(url as string, '_blank', 'noopener,noreferrer');
      if (!nextTab) {
        toast.error('Trình duyệt đang chặn tab mới. Vui lòng cho phép popup rồi thử lại.');
      }
      return;
    }

    window.location.assign(url as string);
  };

  const copyTransferContent = async (value?: string | null) => {
    if (!value) {
      toast.error('Chưa có nội dung chuyển khoản để sao chép.');
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Đã sao chép nội dung chuyển khoản.');
    } catch {
      toast.error('Không thể sao chép tự động. Vui lòng thử lại.');
    }
  };

  const createMutation = useMutation({
    mutationFn: bookingApi.createBooking,
    onSuccess: (result) => {
      if (successRedirectTimerRef.current) {
        window.clearTimeout(successRedirectTimerRef.current);
        successRedirectTimerRef.current = null;
      }
      successHandledRef.current = null;
      setPaymentSuccessDialogOpen(false);
      setIsSuccessTransitioning(false);

      const appointmentId = result.booking?.DK_MA;
      if (appointmentId) {
        setCreatedAppointmentId(appointmentId);
        setLastPaymentContext({ appointmentId, createdAt: new Date().toISOString() });
      }
      setCreatedPaymentRef(result.payment?.TT_MA || null);
      setCreatedPaymentUrl((result.payment_url as string) || null);
      setStep('paymentCheckout');
      toast.success('Đã tạo lịch hẹn. Vui lòng hoàn tất thanh toán để xác nhận.');
    },
    onError: (error) => {
      logFrontendError('booking-submit-v2', error, {
        selectedDoctorId,
        selectedDate,
        selectedSlotKey,
        entryMode,
      });
      const safeMessage = getPatientSafeErrorMessage(error, 'Không thể tạo lịch khám lúc này. Vui lòng thử lại.');
      const normalized = safeMessage.toLowerCase();
      const isAlreadyBookedConflict = normalized.includes('benh nhan da dang ky 1 lich trong khung gio nay');
      const isSlotConflict =
        normalized.includes('khung gio nay da du so luong benh nhan') ||
        normalized.includes('khung gio nay da co nguoi dat') ||
        normalized.includes('slot moi da het cho');
      if (isSlotConflict || isAlreadyBookedConflict) {
        setSelectedSlotKey(null);
        setStep('clinical');
        void slotsQuery.refetch();
        toast.error(
          isAlreadyBookedConflict
            ? 'Bạn đã có lịch khám ở khung giờ này. Vui lòng chọn khung giờ khác.'
            : 'Khung giờ bạn chọn vừa đầy chỗ. Vui lòng chọn khung giờ khác.',
        );
        return;
      }
      toast.error(safeMessage);
    },
  });

  const retryPaymentMutation = useMutation({
    mutationFn: (appointmentId: number) => appointmentsApi.retryPayment(appointmentId),
    onSuccess: (result) => {
      if (successRedirectTimerRef.current) {
        window.clearTimeout(successRedirectTimerRef.current);
        successRedirectTimerRef.current = null;
      }
      successHandledRef.current = null;
      setPaymentSuccessDialogOpen(false);
      setIsSuccessTransitioning(false);
      setCreatedPaymentRef(result.payment?.TT_MA || null);
      const nextUrl = (result.payment_url as string) || null;
      setCreatedPaymentUrl(nextUrl);
      toast.success('Đã tạo lại phiên thanh toán. Vui lòng tiếp tục thanh toán.');
    },
    onError: (error) => {
      toast.error(getPatientSafeErrorMessage(error, 'Không thể tạo lại link thanh toán.'));
    },
  });

  const selectedSpecialty = (specialties ?? []).find((item) => String(item.CK_MA) === specialtyId);
  const selectedServiceType = (serviceTypesQuery.data ?? []).find(
    (item) => String(item.LHK_MA) === selectedServiceTypeId,
  ) as BookingServiceTypeOption | undefined;
  const clinicalOrder = getClinicalOrder(entryMode);
  const currentStepIndex = FLOW_SEQUENCE.findIndex((item) => item === step);
  const currentStepLabel = STEP_LABELS[step];
  const currentGroup = getStepGroup(step);

  const canContinueProfile = Boolean(selectedProfile);
  const canContinueEntry = Boolean(selectedProfile && entryMode);
  const canContinueClinical = Boolean(
    selectedDate &&
      specialtyId &&
      selectedServiceType &&
      selectedDoctor &&
      selectedSlot,
  );
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
  const activeDoctorQuery = entryMode === 'BY_DOCTOR' ? doctorCatalogQuery : availableDoctorsQuery;
  const doctorCatalogFilters = doctorCatalogQuery.data?.filters;
  const doctorCatalogTotalPages = doctorCatalogQuery.data?.totalPages ?? 1;
  const doctorCatalogTotalItems = doctorCatalogQuery.data?.total ?? 0;
  const canFilterByGender = Boolean(doctorCatalogFilters?.genderSupported);
  const specialtyFilterOptions = useMemo<DoctorFilterOption[]>(
    () => [
      { value: 'all', label: 'Tất cả chuyên khoa' },
      ...(doctorCatalogFilters?.specialties ?? []).map((item) => ({
        value: String(item.CK_MA),
        label: item.CK_TEN,
      })),
    ],
    [doctorCatalogFilters?.specialties],
  );
  const degreeFilterOptions = useMemo<DoctorFilterOption[]>(
    () => [
      { value: 'all', label: 'Tất cả' },
      ...(doctorCatalogFilters?.degrees ?? []).map((value) => ({
        value,
        label: value,
      })),
    ],
    [doctorCatalogFilters?.degrees],
  );
  const genderFilterOptions = useMemo<DoctorFilterOption[]>(
    () =>
      canFilterByGender
        ? [
            { value: 'all', label: 'Tất cả' },
            { value: 'male', label: 'Nam' },
            { value: 'female', label: 'Nữ' },
          ]
        : [],
    [canFilterByGender],
  );
  const activeDoctorFilterChips = useMemo(
    () =>
      [
        doctorSearchDebounced
          ? {
              key: 'keyword' as DoctorFilterKey,
              label: `Từ khóa: ${doctorSearchDebounced}`,
            }
          : null,
        doctorCatalogSpecialtyFilter !== 'all'
          ? {
              key: 'specialty' as DoctorFilterKey,
              label:
                specialtyFilterOptions.find((item) => item.value === doctorCatalogSpecialtyFilter)?.label ||
                'Chuyên khoa',
            }
          : null,
        doctorCatalogDegreeFilter !== 'all'
          ? {
              key: 'degree' as DoctorFilterKey,
              label:
                degreeFilterOptions.find((item) => item.value === doctorCatalogDegreeFilter)?.label ||
                'Học hàm/chức danh',
            }
          : null,
        canFilterByGender && doctorCatalogGenderFilter !== 'all'
          ? {
              key: 'gender' as DoctorFilterKey,
              label:
                genderFilterOptions.find((item) => item.value === doctorCatalogGenderFilter)?.label ||
                'Giới tính',
            }
          : null,
      ].filter((item): item is { key: DoctorFilterKey; label: string } => Boolean(item)),
    [
      canFilterByGender,
      degreeFilterOptions,
      doctorCatalogDegreeFilter,
      doctorCatalogGenderFilter,
      doctorCatalogSpecialtyFilter,
      doctorSearchDebounced,
      genderFilterOptions,
      specialtyFilterOptions,
    ],
  );
  const specialtyFilterLabel =
    specialtyFilterOptions.find((item) => item.value === doctorCatalogSpecialtyFilter)?.label ||
    'Chuyên khoa';
  const degreeFilterLabel =
    degreeFilterOptions.find((item) => item.value === doctorCatalogDegreeFilter)?.label ||
    'Học hàm/chức danh';
  const genderFilterLabel =
    genderFilterOptions.find((item) => item.value === doctorCatalogGenderFilter)?.label || 'Giới tính';
  const sortFilterLabel =
    DOCTOR_SORT_OPTIONS.find(
      (item) => buildDoctorSortValue(item.sortBy, item.sortDirection) === doctorCatalogSortValue,
    )?.label || 'Thứ tự';
  const hasDoctorCatalogFiltersActive =
    doctorCatalogSpecialtyFilter !== 'all' ||
    doctorCatalogDegreeFilter !== 'all' ||
    (canFilterByGender && doctorCatalogGenderFilter !== 'all') ||
    Boolean(doctorSearchDebounced);

  const doctorBookableDatesError = doctorBookableDatesQuery.isError
    ? getPatientSafeErrorMessage(
        doctorBookableDatesQuery.error,
        'Khong tai duoc ngay kham kha dung cua bac si. Vui long thu lai.',
      )
    : null;
  const hasSelectedDoctor = Boolean(selectedDoctorId);
  const hasAnyBookableDateForDoctor =
    (doctorBookableDatesQuery.data?.availableDates?.length ?? 0) > 0;

  const doctorError = activeDoctorQuery.isError
    ? getPatientSafeErrorMessage(activeDoctorQuery.error, 'Không tải được danh sách bác sĩ. Vui lòng thử lại.')
    : null;
  const slotsError = slotsQuery.isError
    ? getPatientSafeErrorMessage(slotsQuery.error, 'Không tải được danh sách khung giờ. Vui lòng thử lại.')
    : null;
  const serviceTypesError = serviceTypesQuery.isError
    ? getPatientSafeErrorMessage(serviceTypesQuery.error, 'Không tải được danh sách loại hình khám.')
    : null;

  const paymentStatusRaw = paymentStatusQuery.data?.payment?.normalizedStatus || null;
  const paymentExpiresAtIso = paymentStatusQuery.data?.payment?.expiresAt || null;
  const paymentExpiresAt = paymentExpiresAtIso ? new Date(paymentExpiresAtIso).getTime() : null;
  const paymentRemainingMs = paymentExpiresAt ? paymentExpiresAt - nowMs : null;
  const paymentAmountRaw = paymentStatusQuery.data?.payment?.TT_TONG_TIEN ?? null;
  const paymentAmountLabel = paymentAmountRaw !== null ? toVndLabel(paymentAmountRaw) : null;
  const activePaymentMethod =
    String(paymentStatusQuery.data?.payment?.TT_PHUONG_THUC || paymentMethod || '')
      .trim()
      .toUpperCase() || 'QR_BANKING';
  const activePaymentRef = paymentStatusQuery.data?.payment?.TT_MA || createdPaymentRef || null;
  const qrInfo = useMemo(() => parseQrInfo(createdPaymentUrl), [createdPaymentUrl]);
  const transferContent =
    qrInfo?.addInfo || buildQrTransferContent(createdAppointmentId, activePaymentRef) || null;
  const paymentTransactionRef = paymentStatusQuery.data?.payment?.TT_MA_GIAO_DICH || null;
  const paymentPaidAtRaw = paymentStatusQuery.data?.payment?.TT_THOI_GIAN || null;
  const paymentPaidAtLabel = paymentPaidAtRaw
    ? new Date(paymentPaidAtRaw).toLocaleString('vi-VN', {
        hour12: false,
      })
    : null;
  const selectedSlotLabel = selectedSlot
    ? `${selectedSlot.KG_BAT_DAU.slice(11, 16)} - ${selectedSlot.KG_KET_THUC.slice(11, 16)}`
    : null;
  const selectedServiceTypeLabel = selectedServiceType?.LHK_TEN || null;
  const selectedServiceTypePriceLabel = selectedServiceType
    ? toVndLabel(selectedServiceType.LHK_GIA)
    : null;
  const summaryPaymentAmountLabel = paymentAmountLabel || selectedServiceTypePriceLabel;
  const selectedProfileName = selectedProfile ? getPatientProfileFullName(selectedProfile) : null;
  const paymentStatusUi:
    | 'pending'
    | 'checking'
    | 'paid'
    | 'failed'
    | 'expired'
    | 'error' = paymentStatusQuery.isError
    ? 'error'
    : paymentStatusRaw === 'paid'
    ? 'paid'
    : paymentStatusRaw === 'failed'
    ? 'failed'
    : paymentStatusRaw === 'expired' || Boolean(paymentRemainingMs !== null && paymentRemainingMs <= 0)
    ? 'expired'
    : paymentStatusQuery.isFetching || paymentStatusRaw === 'pending'
    ? 'checking'
    : 'pending';
  const paymentSuccessToken =
    paymentStatusRaw === 'paid' && createdAppointmentId
      ? `${createdAppointmentId}-${activePaymentRef || 0}-${
          paymentTransactionRef || ''
        }`
      : null;

  useEffect(() => {
    if (step !== 'paymentCheckout') return;
    if (!paymentSuccessToken) return;
    if (successHandledRef.current === paymentSuccessToken) return;

    successHandledRef.current = paymentSuccessToken;
    queueMicrotask(() => {
      setIsSuccessTransitioning(true);
      setPaymentSuccessDialogOpen(true);
    });

    if (createdAppointmentId && createdAppointmentId > 0) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.appointments.paymentStatus(createdAppointmentId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.appointments.detail(createdAppointmentId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.appointments.cancelPolicy(createdAppointmentId),
      });
    }
    void queryClient.invalidateQueries({ queryKey: ['appointments-my'] });

    if (successRedirectTimerRef.current) {
      window.clearTimeout(successRedirectTimerRef.current);
    }
    successRedirectTimerRef.current = window.setTimeout(() => {
      setPaymentSuccessDialogOpen(false);
      setIsSuccessTransitioning(false);
      setStep('result');
    }, 2000);
  }, [createdAppointmentId, paymentSuccessToken, queryClient, step]);

  useEffect(() => {
    return () => {
      if (successRedirectTimerRef.current) {
        window.clearTimeout(successRedirectTimerRef.current);
      }
    };
  }, []);

  const resetFlowFromBookingMethodChange = () => {
    setSpecialtyId('');
    setSelectedServiceTypeId('');
    setSelectedDoctorId(null);
    setSelectedDoctorSnapshot(null);
    setSelectedSlotKey(null);
    setDoctorSearch('');
    setDoctorSearchDebounced('');
    setDoctorCatalogSpecialtyFilter('all');
    setDoctorCatalogGenderFilter('all');
    setDoctorCatalogDegreeFilter('all');
    setDoctorCatalogSortValue(buildDoctorSortValue('name', 'asc'));
    setDoctorCatalogPage(1);
    setActiveDoctorFilterPanel(null);
    setSymptoms('');
    setPreVisitNote('');
    setHasBHYT(null);
    setBhytType('');
    setHasPrivateInsurance(null);
    setPrivateInsuranceProvider('');
    setPrivateInsuranceSearch('');
    setPaymentMethod('QR_BANKING');
    setCreatedAppointmentId(null);
    setCreatedPaymentRef(null);
    setCreatedPaymentUrl(null);
    setPaymentSuccessDialogOpen(false);
    setIsSuccessTransitioning(false);
    successHandledRef.current = null;
    if (successRedirectTimerRef.current) {
      window.clearTimeout(successRedirectTimerRef.current);
      successRedirectTimerRef.current = null;
    }
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
    if (specialtyId === value) return;
    setSpecialtyId(value);
    setSelectedServiceTypeId('');
    setSelectedDoctorId(null);
    setSelectedDoctorSnapshot(null);
    setSelectedSlotKey(null);
  };

  const handleChangeDoctor = (doctor: BookingDoctor) => {
    const isDoctorChanged = selectedDoctorId !== doctor.BS_MA;
    setSelectedDoctorId(doctor.BS_MA);
    setSelectedDoctorSnapshot(doctor);
    setSelectedSlotKey(null);
    if (entryMode === 'BY_DOCTOR') {
      if (isDoctorChanged) {
        setSelectedServiceTypeId('');
      }
      setSpecialtyId(String(doctor.CK_MA));
    }
  };

  const clearDoctorCatalogFilters = () => {
    setDoctorSearch('');
    setDoctorSearchDebounced('');
    setDoctorCatalogSpecialtyFilter('all');
    setDoctorCatalogGenderFilter('all');
    setDoctorCatalogDegreeFilter('all');
    setDoctorCatalogSortValue(buildDoctorSortValue('name', 'asc'));
    setDoctorCatalogPage(1);
    setActiveDoctorFilterPanel(null);
  };

  const removeDoctorFilterChip = (key: DoctorFilterKey) => {
    if (key === 'keyword') {
      setDoctorSearch('');
      setDoctorSearchDebounced('');
      return;
    }
    if (key === 'specialty') {
      setDoctorCatalogSpecialtyFilter('all');
      return;
    }
    if (key === 'degree') {
      setDoctorCatalogDegreeFilter('all');
      return;
    }
    if (key === 'gender') {
      setDoctorCatalogGenderFilter('all');
    }
  };

  const goBack = () => {
    if (step === 'entry') return setStep('profile');
    if (step === 'clinical') return setStep('entry');
    if (step === 'insurance') return setStep('clinical');
    if (step === 'review') return setStep('insurance');
    if (step === 'paymentMethod') return setStep('review');
    if (step === 'paymentCheckout') return setStep('paymentMethod');
    if (step === 'result') return setStep('paymentCheckout');
  };

  const findSlotByKey = (
    sessions:
      | Array<{
          B_TEN: string;
          PHONG?: string | null;
          slots: Array<{
            KG_MA: number;
            KG_BAT_DAU: string;
            KG_KET_THUC: string;
            available: boolean;
            availabilityStatus?: 'available' | 'full' | 'past' | 'already_booked';
            alreadyBookedByProfile?: boolean;
            existingBookingId?: number | null;
          }>;
        }>
      | undefined,
    key: string | null,
  ) => {
    if (!sessions || !key) return null;
    for (const session of sessions) {
      for (const slot of session.slots || []) {
        const slotKey = `${session.B_TEN}-${slot.KG_MA}`;
        if (slotKey === key) {
          return {
            ...slot,
            B_TEN: session.B_TEN,
            PHONG: session.PHONG,
            key: slotKey,
          };
        }
      }
    }
    return null;
  };

  const submitCreateBooking = async () => {
    if (!selectedProfile || !selectedDoctor || !selectedSlot || !selectedDate || !selectedServiceType) {
      toast.error('Vui lòng chọn đủ hồ sơ, ngày khám, loại hình khám, bác sĩ và khung giờ.');
      return;
    }

    if (!canContinueInsurance) {
      toast.error('Vui lòng hoàn tất thông tin bảo hiểm trước khi thanh toán.');
      return;
    }

    if (!selectedSlotKey) {
      toast.error('Vui lòng chọn khung giờ còn trống.');
      return;
    }

    setIsValidatingSlotBeforePayment(true);
    let latestSelectedSlot: {
      KG_MA: number;
      B_TEN: string;
      available: boolean;
      availabilityStatus?: 'available' | 'full' | 'past' | 'already_booked';
      alreadyBookedByProfile?: boolean;
      existingBookingId?: number | null;
    } | null = null;
    try {
      const latestSlotsResult = await slotsQuery.refetch();
      if (latestSlotsResult.isError) {
        toast.error('Không thể kiểm tra lại khung giờ hiện tại. Vui lòng thử lại.');
        return;
      }
      const matched = findSlotByKey(latestSlotsResult.data as any, selectedSlotKey);
      if (!matched || !matched.available) {
        setSelectedSlotKey(null);
        setStep('clinical');
        if (matched?.alreadyBookedByProfile || matched?.availabilityStatus === 'already_booked') {
          toast.error('Bạn đã có lịch khám trong khung giờ này. Vui lòng chọn khung giờ khác.');
        } else {
          toast.error('Khung giờ bạn chọn vừa đầy chỗ. Vui lòng chọn khung giờ khác.');
        }
        return;
      }
      latestSelectedSlot = matched;
    } finally {
      setIsValidatingSlotBeforePayment(false);
    }

    if (!latestSelectedSlot) return;

    createMutation.mutate({
      BN_MA: selectedProfile.BN_MA,
      BS_MA: selectedDoctor.BS_MA,
      N_NGAY: selectedDate,
      B_TEN: latestSelectedSlot.B_TEN,
      KG_MA: latestSelectedSlot.KG_MA,
      LHK_MA: selectedServiceType.LHK_MA,
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
    if (!selectedServiceType) guidance.push('Chọn loại hình khám để biết chi phí trước khi thanh toán.');
    if (!selectedDoctor) guidance.push('Chọn bác sĩ khám phù hợp.');
    if (!selectedSlot) guidance.push('Chọn khung giờ còn trống.');
    if (hasBHYT === null || hasPrivateInsurance === null) {
      guidance.push('Trả lời đầy đủ thông tin bảo hiểm.');
    }
    return guidance.slice(0, 3);
  }, [entryMode, hasBHYT, hasPrivateInsurance, selectedDoctor, selectedProfile, selectedServiceType, selectedSlot]);

  const summaryNextAction = useMemo(() => {
    if (step === 'profile') return selectedProfile ? 'Tiếp tục sang bước chọn cách đặt lịch.' : 'Chọn hồ sơ bệnh nhân để bắt đầu.';
    if (step === 'entry') return selectedProfile ? 'Chọn cách đặt lịch cho hồ sơ đã chọn.' : 'Quay lại chọn hồ sơ bệnh nhân trước.';
    if (step === 'clinical') return canContinueClinical ? 'Kiểm tra lại lịch đã chọn rồi tiếp tục.' : 'Hoàn tất chọn ngày, loại hình khám, bác sĩ và khung giờ.';
    if (step === 'insurance') return canContinueInsurance ? 'Bạn đã xong phần thông tin, có thể tiếp tục.' : 'Trả lời 2 câu hỏi bảo hiểm để tiếp tục.';
    if (step === 'review') return 'Xác nhận lại thông tin trước khi thanh toán.';
    if (step === 'paymentMethod') return 'Chọn phương thức thanh toán phù hợp rồi tạo mã thanh toán.';
    if (step === 'paymentCheckout') return 'Quét mã QR hoặc mở cổng thanh toán, sau đó kiểm tra trạng thái.';
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
                  Trình tự theo cách đặt hiện tại: {clinicalOrder.map((key) => sectionTitleForSelector(key, entryMode)).join(' -> ')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {clinicalOrder.map((selectorKey, index) => (
                  <SectionCard
                    key={selectorKey}
                    title={`${index + 1}. ${sectionTitleForSelector(selectorKey, entryMode)}`}
                    subtitle={selectorKey === 'slot' ? 'Chỉ hiển thị khung giờ còn trống.' : undefined}
                  >
                    {selectorKey === 'date' ? (
                      <div className="space-y-3">
                        <BookingCalendar
                          value={selectedDate}
                          min={bookingDateMin}
                          max={bookingDateMax}
                          onChange={handleChangeDate}
                          selectableDates={hasSelectedDoctor ? doctorSelectableDates : undefined}
                          fullDates={hasSelectedDoctor ? doctorFullDates : undefined}
                        />
                        {hasSelectedDoctor && doctorBookableDatesQuery.isLoading ? (
                          <StateCard
                            message="Đang tải ngày khám khả dụng theo lịch trực của bác sĩ..."
                            compact
                          />
                        ) : null}
                        {hasSelectedDoctor && doctorBookableDatesError ? (
                          <InlineError message={doctorBookableDatesError} />
                        ) : null}
                        {hasSelectedDoctor &&
                        !doctorBookableDatesQuery.isLoading &&
                        !doctorBookableDatesError &&
                        !hasAnyBookableDateForDoctor ? (
                          <StateCard
                            message="Bác sĩ chưa có ngày khả dụng để đặt khám trong khoảng 3 tháng tới."
                            dashed
                            compact
                          />
                        ) : null}
                        <p className="text-xs text-slate-500">
                          Hệ thống hỗ trợ đặt lịch tối đa 3 tháng tính từ hôm nay.
                        </p>
                      </div>
                    ) : null}

                    {selectorKey === 'specialty' ? (
                      <div className="space-y-3">
                        {entryMode === 'BY_DOCTOR' ? (
                          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                            <Label>Chuyên khoa</Label>
                            {selectedDoctor ? (
                              <>
                                <p className="text-sm font-medium text-slate-900">
                                  {selectedDoctor.CHUYEN_KHOA || selectedSpecialty?.CK_TEN || 'Chưa cập nhật chuyên khoa'}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Chuyên khoa được tự động đồng bộ theo bác sĩ bạn đã chọn.
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-slate-500">
                                Vui lòng chọn bác sĩ trước để hệ thống tự xác định chuyên khoa và tải loại hình khám.
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                            <Label>Chuyên khoa</Label>
                            <DropdownMenu
                              open={clinicalSpecialtyPanelOpen}
                              onOpenChange={setClinicalSpecialtyPanelOpen}
                            >
                              <DropdownMenuTrigger asChild>
                                <DoctorFilterTrigger
                                  label={selectedSpecialty?.CK_TEN || 'Chọn chuyên khoa'}
                                  active={clinicalSpecialtyPanelOpen}
                                  selected={Boolean(specialtyId)}
                                  className="h-11 w-full justify-between rounded-xl border-slate-300 px-3"
                                />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="start"
                                sideOffset={8}
                                collisionPadding={16}
                                className="z-[130] !w-[min(36rem,94vw)] rounded-2xl border border-[#E0ECFF] bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
                              >
                                <p className="mb-2 px-1 text-[13px] font-semibold text-slate-500">Danh mục chuyên khoa</p>
                                {(specialties ?? []).length === 0 ? (
                                  <p className="px-2 py-4 text-sm text-slate-500">Chưa có dữ liệu chuyên khoa khả dụng.</p>
                                ) : (
                                  <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#E0ECFF_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#E0ECFF] [&::-webkit-scrollbar-track]:bg-transparent">
                                    {(specialties ?? []).map((item) => {
                                      const optionValue = String(item.CK_MA);
                                      const isSelected = specialtyId === optionValue;
                                      return (
                                        <button
                                          key={item.CK_MA}
                                          type="button"
                                          onClick={() => {
                                            handleChangeSpecialty(optionValue);
                                            setClinicalSpecialtyPanelOpen(false);
                                          }}
                                          className={`flex w-full items-center gap-2 rounded-[10px] border bg-white px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-[#F5F9FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                            isSelected
                                              ? 'border-[#BBD3FF] bg-[#EAF2FF] text-blue-700'
                                              : 'border-transparent'
                                          }`}
                                          aria-pressed={isSelected}
                                        >
                                          <span
                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                                              isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                            }`}
                                          >
                                            <Stethoscope className="h-3.5 w-3.5" />
                                          </span>
                                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.CK_TEN}</span>
                                          {isSelected ? <CheckCircle2 className="h-4 w-4 text-blue-600" /> : null}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                <div className="mt-3 border-t border-[#F0F4FF] pt-2 text-xs text-blue-600">
                                  Chọn chuyên khoa để lọc nhanh bác sĩ
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}

                        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                          <Label>Loại hình khám</Label>
                          {!specialtyId ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {entryMode === 'BY_DOCTOR'
                                ? 'Vui lòng chọn bác sĩ trước để xem loại hình khám và chi phí.'
                                : 'Chọn chuyên khoa trước để xem loại hình khám và chi phí.'}
                            </p>
                          ) : serviceTypesQuery.isLoading ? (
                            <div className="mt-2">
                              <StateCard message="Đang tải loại hình khám..." compact />
                            </div>
                          ) : serviceTypesError ? (
                            <div className="mt-2">
                              <InlineError message={serviceTypesError} />
                            </div>
                          ) : (serviceTypesQuery.data ?? []).length === 0 ? (
                            <div className="mt-2">
                              <StateCard message="Chuyên khoa này chưa có loại hình khám khả dụng." compact dashed />
                            </div>
                          ) : (
                            <div className="mt-2 grid gap-2">
                              {(serviceTypesQuery.data ?? []).map((item) => {
                                const isSelected = selectedServiceTypeId === String(item.LHK_MA);
                                return (
                                  <button
                                    key={item.LHK_MA}
                                    type="button"
                                    onClick={() => setSelectedServiceTypeId(String(item.LHK_MA))}
                                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                                      isSelected
                                        ? 'border-blue-400 bg-blue-50'
                                        : 'border-slate-200 bg-white hover:border-blue-200'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm font-medium text-slate-900">{item.LHK_TEN}</p>
                                      <p className="text-sm font-semibold text-blue-700">{toVndLabel(item.LHK_GIA)}</p>
                                    </div>
                                    {item.LHK_MO_TA ? (
                                      <p className="mt-1 text-xs text-slate-500">{item.LHK_MO_TA}</p>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {selectorKey === 'doctor' ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <p className="text-sm font-medium text-slate-800">
                            Chọn bác sĩ phù hợp với nhu cầu khám của bạn.
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Xem thông tin chuyên khoa, đối tượng khám và chọn bác sĩ bạn muốn đồng hành.
                          </p>
                        </div>

                        <DoctorSearchBox
                          id="doctor-search"
                          label="Tìm bác sĩ"
                          value={doctorSearch}
                          placeholder="Nhập tên bác sĩ, học hàm/chức danh hoặc chuyên khoa"
                          onChange={setDoctorSearch}
                          onClear={() => setDoctorSearch('')}
                        />

                        {entryMode === 'BY_DOCTOR' ? (
                          <DoctorCompactFilterBar
                            specialtyLabel={specialtyFilterLabel}
                            degreeLabel={degreeFilterLabel}
                            genderLabel={genderFilterLabel}
                            sortLabel={sortFilterLabel}
                            specialtyValue={doctorCatalogSpecialtyFilter}
                            degreeValue={doctorCatalogDegreeFilter}
                            genderValue={doctorCatalogGenderFilter}
                            sortValue={doctorCatalogSortValue}
                            specialtyOptions={specialtyFilterOptions}
                            degreeOptions={degreeFilterOptions}
                            genderOptions={genderFilterOptions}
                            canFilterByGender={canFilterByGender}
                            activePanel={activeDoctorFilterPanel}
                            onPanelChange={setActiveDoctorFilterPanel}
                            onSpecialtyChange={setDoctorCatalogSpecialtyFilter}
                            onDegreeChange={setDoctorCatalogDegreeFilter}
                            onGenderChange={setDoctorCatalogGenderFilter}
                            onSortChange={setDoctorCatalogSortValue}
                            onReset={clearDoctorCatalogFilters}
                            hasActiveFilters={hasDoctorCatalogFiltersActive}
                          />
                        ) : null}

                        {entryMode === 'BY_DOCTOR' ? (
                          <ActiveDoctorFilters
                            chips={activeDoctorFilterChips}
                            onRemove={removeDoctorFilterChip}
                            onReset={clearDoctorCatalogFilters}
                          />
                        ) : null}

                        {doctorError ? (
                          <div className="space-y-2">
                            <InlineError message={doctorError} />
                            <div className="flex justify-end">
                              <Button type="button" variant="outline" size="sm" onClick={() => void activeDoctorQuery.refetch()}>
                                Thử tải lại
                              </Button>
                            </div>
                          </div>
                        ) : activeDoctorQuery.isLoading ? (
                          <DoctorCardSkeletonList count={entryMode === 'BY_DOCTOR' ? 4 : 3} />
                        ) : doctorList.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                            <p className="text-base font-semibold text-slate-900">Không tìm thấy bác sĩ phù hợp</p>
                            <p className="mt-2 text-sm text-slate-600">
                              Hãy thử đổi chuyên khoa hoặc điều chỉnh từ khóa tìm kiếm.
                            </p>
                            {entryMode === 'BY_DOCTOR' && hasDoctorCatalogFiltersActive ? (
                              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={clearDoctorCatalogFilters}>
                                Xóa bộ lọc và xem lại toàn bộ bác sĩ
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-sm font-medium text-slate-700">
                                {entryMode === 'BY_DOCTOR'
                                  ? `${doctorCatalogTotalItems} bác sĩ phù hợp`
                                  : `${doctorList.length} bác sĩ khả dụng`}
                              </p>
                              {entryMode === 'BY_DOCTOR' ? (
                                <p className="text-xs text-slate-500">
                                  Trang {doctorCatalogQuery.data?.page ?? doctorCatalogPage}/{doctorCatalogTotalPages}
                                </p>
                              ) : null}
                            </div>

                            <div className="grid max-h-[32rem] gap-3 overflow-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                              {doctorList.map((doctor) => {
                                const isSelected = selectedDoctorId === doctor.BS_MA;
                                const doctorName = getDoctorDisplayName(doctor);
                                const specialtyName = doctor.CHUYEN_KHOA || 'Chưa cập nhật chuyên khoa';
                                return (
                                  <button
                                    key={doctor.BS_MA}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => handleChangeDoctor(doctor)}
                                    className={`w-full rounded-2xl border-2 p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                      isSelected
                                        ? 'border-blue-400 bg-blue-50'
                                        : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 hover:shadow-sm'
                                    }`}
                                  >
                                    <div className="flex items-start gap-4">
                                      <Avatar className="h-16 w-16 border border-slate-200 md:h-20 md:w-20">
                                        <AvatarImage src={doctor.BS_ANH || ''} alt={doctorName} className="object-cover" />
                                        <AvatarFallback className="bg-blue-100 text-base font-semibold text-blue-700">
                                          {getInitials(doctor.BS_HO_TEN)}
                                        </AvatarFallback>
                                      </Avatar>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                          <p className="truncate text-base font-semibold text-slate-900">{doctorName}</p>
                                          {isSelected ? (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                              <CheckCircle2 className="h-3.5 w-3.5" /> Đã chọn bác sĩ
                                            </span>
                                          ) : null}
                                        </div>

                                        <p className="mt-1 text-sm font-medium text-slate-700">{specialtyName}</p>

                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {doctor.CHUYEN_KHOA_DOI_TUONG_KHAM ? (
                                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                                              {doctor.CHUYEN_KHOA_DOI_TUONG_KHAM}
                                            </span>
                                          ) : null}
                                          {!isSelected ? (
                                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
                                              Nhấn để chọn bác sĩ này
                                            </span>
                                          ) : null}
                                        </div>

                                        {doctor.CHUYEN_KHOA_MO_TA ? (
                                          <p className="mt-2 line-clamp-2 text-sm text-slate-600">{doctor.CHUYEN_KHOA_MO_TA}</p>
                                        ) : null}
                                      </div>
                                    </div>

                                    {isSelected ? (
                                      <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Bác sĩ đang được chọn
                                      </div>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>

                            {entryMode === 'BY_DOCTOR' && doctorCatalogTotalPages > 1 ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDoctorCatalogPage((prev) => Math.max(prev - 1, 1))}
                                  disabled={(doctorCatalogQuery.data?.page ?? doctorCatalogPage) <= 1}
                                >
                                  Trang trước
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDoctorCatalogPage((prev) => Math.min(prev + 1, doctorCatalogTotalPages))}
                                  disabled={(doctorCatalogQuery.data?.page ?? doctorCatalogPage) >= doctorCatalogTotalPages}
                                >
                                  Trang sau
                                </Button>
                              </div>
                            ) : null}
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
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                                <span className="h-2 w-2 rounded-full bg-amber-500" /> Đã đặt
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-slate-500">
                                <span className="h-2 w-2 rounded-full bg-slate-400" /> Đã đầy
                              </span>
                            </div>
                            {alreadyBookedSlots.length > 0 ? (
                              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                Bạn đã có lịch ở {alreadyBookedSlots.length} khung giờ trong chuyên khoa này. Các ô
                                “Đã đặt” sẽ không thể chọn lại.
                              </div>
                            ) : null}
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
                                    const isAlreadyBooked = Boolean(slot.alreadyBookedByProfile);
                                    const isUnavailable = !slot.available || isAlreadyBooked;
                                    return (
                                      <button
                                        key={key}
                                        type="button"
                                        disabled={isUnavailable}
                                        onClick={() => setSelectedSlotKey(key)}
                                        className={`rounded-lg border px-3 py-2 text-sm transition ${
                                          isAlreadyBooked
                                            ? 'cursor-not-allowed border-amber-200 bg-amber-50 text-amber-700'
                                            : !slot.available
                                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                                            : isSelected
                                            ? 'border-blue-600 bg-blue-600 font-medium text-white'
                                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                                        }`}
                                      >
                                        <p>{slot.KG_BAT_DAU.slice(11, 16)} - {slot.KG_KET_THUC.slice(11, 16)}</p>
                                        <p className="text-[11px] opacity-90">
                                          {isAlreadyBooked
                                            ? `Đã đặt${slot.existingBookingId ? ` #${slot.existingBookingId}` : ''}`
                                            : !slot.available
                                            ? 'Đầy'
                                            : isSelected
                                            ? 'Đang chọn'
                                            : 'Còn trống'}
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
                      ? 'Bạn cần chọn đủ ngày khám, chuyên khoa, loại hình khám, bác sĩ và khung giờ.'
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
                <CardDescription>Hệ thống sẽ tạo một màn thanh toán tập trung với QR, trạng thái và hướng dẫn đầy đủ.</CardDescription>
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
                  nextLabel={
                    isValidatingSlotBeforePayment
                      ? 'Đang kiểm tra khung giờ...'
                      : createMutation.isPending
                      ? 'Đang tạo mã thanh toán...'
                      : 'Tạo mã thanh toán'
                  }
                  onNext={submitCreateBooking}
                  nextDisabled={createMutation.isPending || isValidatingSlotBeforePayment}
                />
              </CardContent>
            </Card>
          ) : null}

          {step === 'paymentCheckout' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Thanh toán lịch khám</CardTitle>
                <CardDescription>Quét mã QR hoặc mở cổng thanh toán để xác nhận lịch hẹn.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentStatusQuery.isError ? (
                  <InlineError
                    message={getPatientSafeErrorMessage(
                      paymentStatusQuery.error,
                      'Không thể kiểm tra trạng thái thanh toán lúc này. Vui lòng thử lại.',
                    )}
                  />
                ) : null}

                <div className="grid items-start gap-4">
                  <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Thông tin thanh toán</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">{paymentAmountLabel || '--'}</p>
                        <p className="text-sm text-slate-600">
                          Mã lịch hẹn <strong>#{createdAppointmentId || '--'}</strong> · Mã thanh toán{' '}
                          <strong>{activePaymentRef || '--'}</strong>
                        </p>
                      </div>
                      <PaymentStatusBadge status={paymentStatusUi} />
                    </div>

                    <div className="mt-4 grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                      <div className="w-full max-w-[320px] rounded-2xl border border-blue-200 bg-white p-3 xl:max-w-none">
                        {activePaymentMethod === 'QR_BANKING' && isLikelyQrImageUrl(createdPaymentUrl) ? (
                          <img
                            src={createdPaymentUrl || ''}
                            alt="Mã QR thanh toán lịch khám"
                            className="mx-auto aspect-square w-full max-w-[280px] rounded-xl border border-slate-200 bg-white object-contain p-2"
                          />
                        ) : (
                          <div className="mx-auto flex aspect-square w-full max-w-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
                            <QrCode className="h-10 w-10 text-blue-600" />
                            <p className="mt-2 text-sm font-medium text-slate-800">Mã QR chưa sẵn sàng</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Bạn có thể mở cổng thanh toán để hoàn tất giao dịch.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                        <PaymentInfoRow label="Phương thức" value={getPaymentMethodLabel(activePaymentMethod)} />
                        <PaymentInfoRow label="Số tiền cần thanh toán" value={paymentAmountLabel || '--'} />
                        <PaymentInfoRow label="Ngân hàng nhận" value={qrInfo?.bankId || '--'} />
                        <PaymentInfoRow label="Số tài khoản nhận" value={qrInfo?.accountNo || '--'} />
                        <PaymentInfoRow label="Tên người nhận" value={qrInfo?.accountName || '--'} />
                        <PaymentInfoRow
                          label="Nội dung chuyển khoản"
                          value={transferContent || '--'}
                          valueClassName="font-mono text-[13px] leading-5"
                          action={
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => copyTransferContent(transferContent)}
                              disabled={!transferContent}
                            >
                              <Copy className="mr-1 h-3.5 w-3.5" /> Sao chép
                            </Button>
                          }
                        />
                        <PaymentInfoRow
                          label="Thời hạn thanh toán"
                          value={
                            paymentRemainingMs === null
                              ? '--'
                              : paymentRemainingMs > 0
                              ? `Còn ${formatCountdown(paymentRemainingMs)}`
                              : 'Đã hết hạn'
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid items-start gap-3 md:grid-cols-2">
                  <PaymentStatusCard status={paymentStatusUi} />
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">Việc cần làm</p>
                    <p className="mt-1">1. Mở QR hoặc cổng thanh toán.</p>
                    <p>2. Hoàn tất thanh toán đúng số tiền và nội dung chuyển khoản.</p>
                    <p>3. Nhấn “Kiểm tra trạng thái” hoặc chờ hệ thống cập nhật tự động.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        openPaymentGateway(createdPaymentUrl, activePaymentMethod);
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={
                        !canOpenPaymentUrl(createdPaymentUrl) ||
                        paymentStatusUi === 'expired' ||
                        isSuccessTransitioning
                      }
                    >
                      {activePaymentMethod === 'QR_BANKING' ? (
                        <QrCode className="mr-2 h-4 w-4" />
                      ) : (
                        <ExternalLink className="mr-2 h-4 w-4" />
                      )}
                      {activePaymentMethod === 'QR_BANKING' ? 'Mở / phóng to QR' : 'Mở cổng thanh toán'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => paymentStatusQuery.refetch()}
                      disabled={paymentStatusQuery.isFetching || paymentStatusUi === 'paid' || isSuccessTransitioning}
                    >
                      {paymentStatusQuery.isFetching ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Clock3 className="mr-2 h-4 w-4" />
                      )}
                      Kiểm tra trạng thái
                    </Button>
                    {createdAppointmentId &&
                    (paymentStatusUi === 'failed' || paymentStatusUi === 'expired' || paymentStatusUi === 'error') ? (
                      <Button
                        variant="outline"
                        onClick={() => retryPaymentMutation.mutate(createdAppointmentId)}
                        disabled={retryPaymentMutation.isPending || isSuccessTransitioning}
                      >
                        {retryPaymentMutation.isPending ? (
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CreditCard className="mr-2 h-4 w-4" />
                        )}
                        Thanh toán lại
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      onClick={() => paymentStatusQuery.refetch()}
                      disabled={paymentStatusQuery.isFetching || paymentStatusUi === 'paid' || isSuccessTransitioning}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Tôi đã thanh toán
                    </Button>
                    <Button
                      type="button"
                      variant={paymentStatusUi === 'paid' ? 'default' : 'outline'}
                      className={paymentStatusUi === 'paid' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      onClick={() => setStep('result')}
                      disabled={
                        paymentStatusUi === 'pending' || paymentStatusUi === 'checking' || isSuccessTransitioning
                      }
                    >
                      Đi tới kết quả
                    </Button>
                  </div>
                </div>

                <BookingActionBar
                  onBack={goBack}
                  nextLabel="Tôi sẽ kiểm tra lại sau"
                  onNext={() => setStep('result')}
                  nextVariant="outline"
                  nextDisabled={isSuccessTransitioning}
                />
              </CardContent>
            </Card>
          ) : null}

          {step === 'result' ? (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>{paymentStatusUi === 'paid' ? 'Đặt lịch thành công' : 'Kết quả thanh toán'}</CardTitle>
                <CardDescription>
                  {paymentStatusUi === 'paid'
                    ? 'Lịch hẹn của bạn đã được xác nhận. Bạn có thể lưu lại màn hình này để đối soát khi cần.'
                    : 'Hệ thống đã ghi nhận phiên thanh toán của bạn. Vui lòng kiểm tra trạng thái bên dưới.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentStatusUi === 'paid' ? (
                  <StatusBanner
                    tone="success"
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="Thanh toán thành công"
                    description="Lịch hẹn đã được xác nhận. Hệ thống sẽ giữ đầy đủ thông tin trong mục Lịch hẹn của tôi."
                  />
                ) : paymentStatusUi === 'failed' ? (
                  <StatusBanner
                    tone="error"
                    icon={<XCircle className="h-5 w-5" />}
                    title="Thanh toán chưa thành công"
                    description="Bạn có thể thử thanh toán lại hoặc kiểm tra lịch hẹn của mình."
                  />
                ) : paymentStatusUi === 'expired' ? (
                  <StatusBanner
                    tone="warning"
                    icon={<Clock3 className="h-5 w-5" />}
                    title="Mã thanh toán đã hết hạn"
                    description="Bạn cần tạo lại thanh toán để tiếp tục xác nhận lịch hẹn."
                  />
                ) : paymentStatusUi === 'error' ? (
                  <StatusBanner
                    tone="warning"
                    icon={<AlertCircle className="h-5 w-5" />}
                    title="Không thể kiểm tra trạng thái thanh toán"
                    description="Vui lòng thử kiểm tra lại sau hoặc liên hệ hỗ trợ nếu cần."
                  />
                ) : (
                  <StatusBanner
                    tone="warning"
                    icon={<LoaderCircle className="h-5 w-5 animate-spin" />}
                    title="Thanh toán đang xử lý"
                    description="Hệ thống đang cập nhật trạng thái thanh toán, vui lòng kiểm tra lại sau."
                  />
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <SuccessDataCard title="Thông tin lịch hẹn">
                    <SuccessDataRow label="Mã lịch hẹn" value={createdAppointmentId ? `#${createdAppointmentId}` : '--'} />
                    <SuccessDataRow label="Hồ sơ bệnh nhân" value={selectedProfileName || '--'} />
                    <SuccessDataRow label="Ngày khám" value={selectedDate ? formatDateDdMmYyyy(selectedDate) : '--'} />
                    <SuccessDataRow label="Khung giờ" value={selectedSlotLabel || '--'} />
                    <SuccessDataRow label="Chuyên khoa" value={selectedSpecialty?.CK_TEN || '--'} />
                    <SuccessDataRow label="Bác sĩ" value={selectedDoctor?.BS_HO_TEN || '--'} />
                    <SuccessDataRow label="Phòng khám" value={selectedSlot?.PHONG || '--'} />
                  </SuccessDataCard>

                  <SuccessDataCard title="Thông tin thanh toán">
                    <SuccessDataRow label="Trạng thái" value={getPaymentStatusMeta(paymentStatusUi).label} emphasize />
                    <SuccessDataRow label="Số tiền đã thanh toán" value={paymentAmountLabel || '--'} />
                    <SuccessDataRow label="Phương thức thanh toán" value={getPaymentMethodLabel(activePaymentMethod)} />
                    <SuccessDataRow label="Mã thanh toán" value={activePaymentRef ? String(activePaymentRef) : '--'} />
                    <SuccessDataRow label="Mã giao dịch" value={paymentTransactionRef || '--'} />
                    <SuccessDataRow label="Thời gian thanh toán" value={paymentPaidAtLabel || '--'} />
                    <SuccessDataRow label="Nội dung đối soát" value={transferContent || '--'} />
                  </SuccessDataCard>
                </div>

                {paymentStatusUi === 'paid' ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <p className="font-semibold">Bước tiếp theo dành cho bạn</p>
                    <ul className="mt-2 space-y-1">
                      <li>• Vui lòng đến trước giờ hẹn 10-15 phút để làm thủ tục.</li>
                      <li>• Mang theo CCCD và thẻ BHYT (nếu có).</li>
                      <li>• Bạn có thể xem lại toàn bộ thông tin trong mục “Lịch hẹn của tôi”.</li>
                    </ul>
                  </div>
                ) : null}

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
                  {paymentStatusUi !== 'paid' && createdAppointmentId ? (
                    <Button variant="outline" onClick={() => setStep('paymentCheckout')}>
                      Quay lại thanh toán
                    </Button>
                  ) : null}
                </div>
                {paymentStatusUi === 'paid' ? (
                  <p className="text-xs text-slate-500">
                    Gợi ý: Bạn có thể chụp màn hình trang này để lưu thông tin xác nhận nhanh.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {paymentStatusUi !== 'paid' ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => paymentStatusQuery.refetch()}
                      disabled={paymentStatusQuery.isFetching}
                    >
                      {paymentStatusQuery.isFetching ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Clock3 className="mr-2 h-4 w-4" />
                      )}
                      Kiểm tra lại trạng thái
                    </Button>
                  ) : null}
                  {paymentStatusUi !== 'paid' && createdAppointmentId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => retryPaymentMutation.mutate(createdAppointmentId)}
                      disabled={retryPaymentMutation.isPending}
                    >
                      {retryPaymentMutation.isPending ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 h-4 w-4" />
                      )}
                      Tạo lại thanh toán
                    </Button>
                  ) : null}
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
            selectedSlotLabel={selectedSlotLabel}
            selectedRoom={selectedSlot?.PHONG || null}
            hasBHYT={hasBHYT}
            bhytTypeLabel={bhytTypeLabel || null}
            hasPrivateInsurance={hasPrivateInsurance}
            privateInsuranceLabel={privateInsuranceLabel || null}
            paymentMethod={paymentMethod}
            currentPaymentAmount={paymentAmountLabel}
            createdAppointmentId={createdAppointmentId}
            createdPaymentRef={activePaymentRef}
            currentPaymentStatus={
              activePaymentRef ? getPaymentStatusMeta(paymentStatusUi).label : null
            }
            guidance={summaryGuidance}
            nextAction={summaryNextAction}
          />
        </aside>
      </div>

      <Dialog open={paymentSuccessDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-sm border-emerald-200 bg-white p-5 sm:max-w-sm"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-xl font-semibold text-slate-900">Thanh toán thành công</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              Đặt lịch của bạn đã được xác nhận. Hệ thống đang chuyển bạn đến trang hoàn tất đặt lịch.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
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
  currentPaymentAmount?: string | null;
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
    currentPaymentAmount,
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
          <SummaryLine icon={<Wallet className="h-4 w-4" />} label="Thanh toán" value={getPaymentMethodLabel(paymentMethod)} />
        ) : null}
        {currentPaymentAmount ? (
          <SummaryLine icon={<CreditCard className="h-4 w-4" />} label="Số tiền" value={currentPaymentAmount} />
        ) : null}

        {createdAppointmentId || createdPaymentRef || currentPaymentStatus ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-semibold">Trạng thái thanh toán</p>
            {currentPaymentStatus ? <p className="mt-1 font-medium">{currentPaymentStatus}</p> : null}
            <div className="mt-1 space-y-0.5 text-xs text-blue-800">
              {createdAppointmentId ? <p>Mã lịch hẹn: #{createdAppointmentId}</p> : null}
              {createdPaymentRef ? <p>Mã thanh toán: {createdPaymentRef}</p> : null}
            </div>
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

type PaymentUiStatus = 'pending' | 'checking' | 'paid' | 'failed' | 'expired' | 'error';

function getPaymentStatusMeta(status: PaymentUiStatus) {
  if (status === 'paid') {
    return {
      label: 'Thanh toán thành công',
      description: 'Lịch hẹn của bạn đã được xác nhận. Bạn có thể đi tới bước kết quả.',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      cardClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      icon: <CheckCircle2 className="h-5 w-5" />,
    };
  }
  if (status === 'failed') {
    return {
      label: 'Thanh toán thất bại',
      description: 'Giao dịch chưa thành công. Vui lòng tạo lại thanh toán và thử lại.',
      badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
      cardClass: 'border-rose-200 bg-rose-50 text-rose-800',
      icon: <XCircle className="h-5 w-5" />,
    };
  }
  if (status === 'expired') {
    return {
      label: 'Mã thanh toán đã hết hạn',
      description: 'Vui lòng nhấn “Thanh toán lại” để tạo mã mới.',
      badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
      cardClass: 'border-amber-200 bg-amber-50 text-amber-800',
      icon: <Clock3 className="h-5 w-5" />,
    };
  }
  if (status === 'error') {
    return {
      label: 'Không thể kiểm tra trạng thái',
      description: 'Vui lòng thử lại sau ít phút hoặc nhấn “Kiểm tra trạng thái”.',
      badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
      cardClass: 'border-slate-200 bg-slate-100 text-slate-800',
      icon: <AlertCircle className="h-5 w-5" />,
    };
  }
  if (status === 'checking') {
    return {
      label: 'Đang kiểm tra giao dịch',
      description: 'Hệ thống đang đối soát thanh toán của bạn, vui lòng chờ trong giây lát.',
      badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
      cardClass: 'border-blue-200 bg-blue-50 text-blue-800',
      icon: <LoaderCircle className="h-5 w-5 animate-spin" />,
    };
  }
  return {
    label: 'Đang chờ thanh toán',
    description: 'Vui lòng quét mã QR và chuyển khoản đúng nội dung để xác nhận lịch hẹn.',
    badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    cardClass: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    icon: <Clock3 className="h-5 w-5" />,
  };
}

function PaymentStatusBadge({ status }: { status: PaymentUiStatus }) {
  const meta = getPaymentStatusMeta(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
}

function PaymentStatusCard({ status }: { status: PaymentUiStatus }) {
  const meta = getPaymentStatusMeta(status);
  return (
    <div className={`rounded-2xl border p-3 ${meta.cardClass}`}>
      <div className="flex items-start gap-2">
        {meta.icon}
        <div>
          <p className="text-sm font-semibold">{meta.label}</p>
          <p className="text-xs leading-5">{meta.description}</p>
        </div>
      </div>
    </div>
  );
}

function PaymentInfoRow({
  label,
  value,
  action,
  valueClassName,
}: {
  label: string;
  value: string;
  action?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.08em] text-slate-500">{label}</p>
        {action || null}
      </div>
      <p className={`mt-1 min-w-0 whitespace-normal break-words text-sm font-medium text-slate-900 ${valueClassName || ''}`}>{value}</p>
    </div>
  );
}

function SuccessDataCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function SuccessDataRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`max-w-[70%] text-right ${emphasize ? 'font-semibold text-emerald-700' : 'font-medium text-slate-900'}`}>
        {value}
      </span>
    </div>
  );
}

type BookingCalendarDayStatus =
  | 'available'
  | 'selected'
  | 'today'
  | 'outsideRange'
  | 'outsideMonth'
  | 'unavailable'
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
  selectableDates?: Set<string>;
  holidayDates?: Set<string>;
  fullDates?: Set<string>;
}) {
  const {
    monthDate,
    selectedIso,
    minIso,
    maxIso,
    selectableDates,
    holidayDates,
    fullDates,
  } = params;
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
    else if (selectableDates && !selectableDates.has(iso)) status = 'unavailable';
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
  selectableDates,
  holidayDates,
  fullDates,
}: {
  value: string;
  min: string;
  max: string;
  onChange: (value: string) => void;
  selectableDates?: Set<string>;
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
        selectableDates,
        holidayDates,
        fullDates,
      }),
    [fullDates, holidayDates, max, min, selectableDates, value, visibleMonth],
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
              : cell.status === 'unavailable'
              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
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
        {selectableDates ? (
          <LegendDot className="border-slate-200 bg-slate-100" label="Bác sĩ không trực ngày này" />
        ) : null}
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

function DoctorSearchBox({
  id,
  label,
  value,
  placeholder,
  onChange,
  onClear,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-xl border-slate-300 bg-white pl-9 pr-10"
          placeholder={placeholder}
        />
        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Xóa từ khóa tìm kiếm"
          >
            <XCircle className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DoctorCompactFilterBar({
  specialtyLabel,
  degreeLabel,
  genderLabel,
  sortLabel,
  specialtyValue,
  degreeValue,
  genderValue,
  sortValue,
  specialtyOptions,
  degreeOptions,
  genderOptions,
  canFilterByGender,
  activePanel,
  onPanelChange,
  onSpecialtyChange,
  onDegreeChange,
  onGenderChange,
  onSortChange,
  onReset,
  hasActiveFilters,
}: {
  specialtyLabel: string;
  degreeLabel: string;
  genderLabel: string;
  sortLabel: string;
  specialtyValue: string;
  degreeValue: string;
  genderValue: string;
  sortValue: string;
  specialtyOptions: DoctorFilterOption[];
  degreeOptions: DoctorFilterOption[];
  genderOptions: DoctorFilterOption[];
  canFilterByGender: boolean;
  activePanel: DoctorFilterPanelKey | null;
  onPanelChange: (next: DoctorFilterPanelKey | null) => void;
  onSpecialtyChange: (value: string) => void;
  onDegreeChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
}) {
  const panelBaseClass =
    'z-[130] rounded-2xl border border-[#E0ECFF] bg-white p-3 shadow-[0_8px_24px_rgba(0,0,0,0.06)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1';
  const headerClass = 'mb-2 px-1 text-[13px] font-semibold text-slate-500';
  const listScrollClass =
    'max-h-[360px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#E0ECFF_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#E0ECFF] [&::-webkit-scrollbar-track]:bg-transparent';
  const optionBaseClass =
    'rounded-[10px] border border-transparent bg-white px-3 py-2.5 text-sm text-slate-700 transition hover:bg-[#F5F9FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <DropdownMenu
          open={activePanel === 'specialty'}
          onOpenChange={(open) => onPanelChange(open ? 'specialty' : null)}
        >
          <DropdownMenuTrigger asChild>
            <DoctorFilterTrigger
              label={specialtyValue !== 'all' ? specialtyLabel : 'Chuyên khoa'}
              active={activePanel === 'specialty'}
              selected={specialtyValue !== 'all'}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            collisionPadding={16}
            className={`!w-[min(36rem,94vw)] ${panelBaseClass}`}
          >
            <p className={headerClass}>Danh mục chuyên khoa</p>
            <div className={`grid gap-2 sm:grid-cols-2 ${listScrollClass}`}>
              {specialtyOptions.map((option) => {
                const isSelected = specialtyValue === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onSpecialtyChange(option.value);
                      onPanelChange(null);
                    }}
                    className={`flex items-center gap-2 text-left ${optionBaseClass} ${
                      isSelected
                        ? 'border-[#BBD3FF] bg-[#EAF2FF] text-blue-700'
                        : 'border-transparent'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                        isSelected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Stethoscope className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{option.label}</span>
                    {isSelected ? <CheckCircle2 className="h-4 w-4 text-blue-600" /> : null}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 border-t border-[#F0F4FF] pt-2 text-xs text-blue-600">
              Chọn chuyên khoa để lọc nhanh bác sĩ
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu
          open={activePanel === 'degree'}
          onOpenChange={(open) => onPanelChange(open ? 'degree' : null)}
        >
          <DropdownMenuTrigger asChild>
            <DoctorFilterTrigger
              label={degreeValue !== 'all' ? degreeLabel : 'Học hàm/chức danh'}
              active={activePanel === 'degree'}
              selected={degreeValue !== 'all'}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            collisionPadding={16}
            className={`!w-[min(24rem,92vw)] ${panelBaseClass}`}
          >
            <p className={headerClass}>Học hàm/chức danh</p>
            <div className={listScrollClass}>
              {degreeOptions.map((option) => {
                const isSelected = degreeValue === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onDegreeChange(option.value);
                      onPanelChange(null);
                    }}
                    className={`flex w-full items-center justify-between ${optionBaseClass} ${
                      isSelected ? 'border-[#BBD3FF] bg-[#EAF2FF] text-blue-700' : 'border-transparent'
                    }`}
                  >
                    {option.label}
                    {isSelected ? <CheckCircle2 className="h-4 w-4" /> : null}
                  </button>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {canFilterByGender ? (
          <DropdownMenu
            open={activePanel === 'gender'}
            onOpenChange={(open) => onPanelChange(open ? 'gender' : null)}
          >
            <DropdownMenuTrigger asChild>
              <DoctorFilterTrigger
                label={genderValue !== 'all' ? genderLabel : 'Giới tính'}
                active={activePanel === 'gender'}
                selected={genderValue !== 'all'}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={8}
              collisionPadding={16}
              className={`!w-[min(18rem,88vw)] ${panelBaseClass}`}
            >
              <p className={headerClass}>Giới tính</p>
              <div className={listScrollClass}>
                {genderOptions.map((option) => {
                  const isSelected = genderValue === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onGenderChange(option.value);
                        onPanelChange(null);
                      }}
                      className={`flex w-full items-center justify-between ${optionBaseClass} ${
                        isSelected ? 'border-[#BBD3FF] bg-[#EAF2FF] text-blue-700' : 'border-transparent'
                      }`}
                    >
                      {option.label}
                      {isSelected ? <CheckCircle2 className="h-4 w-4" /> : null}
                    </button>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <DropdownMenu
          open={activePanel === 'sort'}
          onOpenChange={(open) => onPanelChange(open ? 'sort' : null)}
        >
          <DropdownMenuTrigger asChild>
            <DoctorFilterTrigger
              label={sortLabel || 'Thứ tự'}
              active={activePanel === 'sort'}
              selected={sortValue !== buildDoctorSortValue('name', 'asc')}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            collisionPadding={16}
            className={`!w-[min(18rem,88vw)] ${panelBaseClass}`}
          >
            <p className={headerClass}>Thứ tự</p>
            <div className={listScrollClass}>
              {DOCTOR_SORT_OPTIONS.map((option) => {
                const value = buildDoctorSortValue(option.sortBy, option.sortDirection);
                const isSelected = sortValue === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      onSortChange(value);
                      onPanelChange(null);
                    }}
                    className={`flex w-full items-center justify-between ${optionBaseClass} ${
                      isSelected ? 'border-[#BBD3FF] bg-[#EAF2FF] text-blue-700' : 'border-transparent'
                    }`}
                  >
                    {option.label}
                    {isSelected ? <CheckCircle2 className="h-4 w-4" /> : null}
                  </button>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Danh sách bác sĩ đang hoạt động trong hệ thống.</p>
        {hasActiveFilters ? (
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            Xóa bộ lọc
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type DoctorFilterTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  active?: boolean;
  selected?: boolean;
};

const DoctorFilterTrigger = forwardRef<HTMLButtonElement, DoctorFilterTriggerProps>(
  ({ label, active, selected, className = '', ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        active || selected
          ? 'border-blue-300 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-slate-50'
      } ${className}`}
      {...props}
    >
      <span className="max-w-[180px] truncate">{label}</span>
      <ChevronDown className={`h-4 w-4 transition-transform ${active ? 'rotate-180' : ''}`} />
    </button>
  ),
);

DoctorFilterTrigger.displayName = 'DoctorFilterTrigger';

function ActiveDoctorFilters({
  chips,
  onRemove,
  onReset,
}: {
  chips: Array<{ key: DoctorFilterKey; label: string }>;
  onRemove: (key: DoctorFilterKey) => void;
  onReset: () => void;
}) {
  if (chips.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Đang lọc theo</p>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onReset}>
          Xóa bộ lọc
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={`${chip.key}-${chip.label}`}
            type="button"
            onClick={() => onRemove(chip.key)}
            className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {chip.label}
            <X className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

function DoctorCardSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={`doctor-skeleton-${idx}`} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-slate-200 md:h-20 md:w-20" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-200" />
              <div className="h-3 w-5/6 rounded bg-slate-200" />
              <div className="h-3 w-4/5 rounded bg-slate-200" />
            </div>
          </div>
        </div>
      ))}
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




