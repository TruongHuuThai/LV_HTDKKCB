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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function maxBookingDateIso() {
  const now = new Date();
  const max = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  max.setUTCMonth(max.getUTCMonth() + 3);
  return max.toISOString().slice(0, 10);
}

export default function BookingPage() {
  const user = useAuthStore((state) => state.user);
  const selectedProfileId = usePatientProfilesStore(
    (state) => state.selectedByAccount[user?.TK_SDT ?? ''],
  );
  const setSelectedProfile = usePatientProfilesStore((state) => state.setSelectedProfile);

  const [specialtyId, setSpecialtyId] = useState<string>('all');
  const [doctorSearch, setDoctorSearch] = useState('');
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

  const doctorsQuery = useQuery({
    queryKey: queryKeys.booking.doctors(specialtyId, selectedDate),
    queryFn: () =>
      bookingApi.getAvailableDoctors({
        date: selectedDate || undefined,
        specialtyId: specialtyId === 'all' ? undefined : Number(specialtyId),
      }),
    enabled: Boolean(user?.TK_SDT && selectedProfile),
  });

  const filteredDoctors = useMemo(() => {
    const keyword = doctorSearch.trim().toLowerCase();
    if (!keyword) return doctorsQuery.data ?? [];
    return (doctorsQuery.data ?? []).filter((doctor) => doctor.BS_HO_TEN.toLowerCase().includes(keyword));
  }, [doctorSearch, doctorsQuery.data]);

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

      toast.success('Ð?t l?ch thành công. B?n có th? thanh toán sau trong m?c L?ch h?n c?a tôi.');
      setRedirectingToPayment(false);
    },
    onError: (error) => {
      setRedirectingToPayment(false);
      logFrontendError('booking-submit', error, {
        selectedDoctorId,
        selectedDate,
        selectedSlotKey,
      });
      toast.error(getPatientFlowErrorMessage(error, 'Không th? t?o l?ch khám.'));
    },
  });

  const handleSubmit = () => {
    if (!selectedProfile) {
      toast.error('Vui l?ng ch?n h? sõ b?nh nhân trý?c khi ð?t l?ch.');
      return;
    }
    if (!selectedDoctor || !selectedSlot) {
      toast.error('Vui l?ng ch?n bác s? và khung gi? phù h?p.');
      return;
    }
    if (symptoms.length > 1000) {
      toast.error('Tri?u ch?ng t?i ða 1000 k? t?.');
      return;
    }
    if (preVisitNote.length > 2000) {
      toast.error('Ghi chú t?i ða 2000 k? t?.');
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
              <h1 className="text-2xl font-bold text-slate-900">Ðãng nh?p ð? ð?t l?ch khám</h1>
              <p className="mt-2 text-sm text-slate-600">
                H? th?ng c?n xác ð?nh tài kho?n và h? sõ b?nh nhân trý?c khi t?o l?ch h?n.
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild variant="outline">
                <Link to="/login">Ðãng nh?p</Link>
              </Button>
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link to="/register">T?o tài kho?n</Link>
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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-100">Ð?t l?ch khám</p>
          <h1 className="mt-3 text-3xl font-bold">Ch?n h? sõ b?nh nhân và khung gi? phù h?p</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50/90">
            Sau khi xác nh?n l?ch h?n, h? th?ng s? chuy?n b?n ð?n c?ng thanh toán VNPAY/QR ð? hoàn t?t bý?c thanh toán.
          </p>
        </section>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Bý?c 1. Ch?n h? sõ b?nh nhân</CardTitle>
            <CardDescription>
              {activeProfiles.length <= 1
                ? 'Tài kho?n hi?n có 1 h? sõ ho?t ð?ng, h? th?ng s? t? ch?n h? sõ này.'
                : 'Tài kho?n có nhi?u h? sõ. H?y ch?n ðúng ngý?i b?nh ð? tránh ð?t l?ch nh?m.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profilesQuery.isLoading ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">Ðang t?i h? sõ b?nh nhân...</div>
            ) : activeProfiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                <p className="text-lg font-semibold text-slate-900">Chýa có h? sõ b?nh nhân ð? ð?t l?ch</p>
                <p className="mt-2 text-sm text-slate-600">B?n c?n t?o ít nh?t m?t h? sõ trý?c khi ð?t l?ch.</p>
                <Button asChild className="mt-4 bg-blue-600 hover:bg-blue-700">
                  <Link to="/patient-profiles/create">Thêm h? sõ</Link>
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
                          <p className="text-sm text-slate-500">M? h? sõ #{profile.BN_MA} · {formatDateDdMmYyyy(profile.BN_NGAY_SINH)}</p>
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
                <CardTitle>Bý?c 2. Ch?n bác s?, ngày khám</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">Chuyên khoa</p>
                    <Select value={specialtyId} onValueChange={setSpecialtyId} disabled={!selectedProfile}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Ch?n chuyên khoa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">T?t c? chuyên khoa</SelectItem>
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
                    <p className="text-sm font-medium text-slate-700">T?m bác s?</p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={doctorSearch}
                        onChange={(event) => setDoctorSearch(event.target.value)}
                        placeholder="Nh?p tên bác s?"
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
                <CardTitle>Bý?c 3. Ch?n bác s?</CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedProfile ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">Vui l?ng ch?n h? sõ b?nh nhân trý?c.</div>
                ) : doctorsQuery.isLoading ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">Ðang t?i danh sách bác s?...</div>
                ) : filteredDoctors.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                    <p className="text-lg font-semibold text-slate-900">Không có bác s? phù h?p</p>
                    <p className="mt-2 text-sm text-slate-600">H?y ð?i ngày ho?c b? l?c chuyên khoa ð? th? l?i.</p>
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
                            <p className="text-sm text-slate-500">{doctor.CHUYEN_KHOA || 'Chýa xác ð?nh chuyên khoa'}</p>
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
                <CardTitle>Bý?c 4. Tri?u ch?ng và ghi chú</CardTitle>
                <CardDescription>
                  Thông tin ti?n khám giúp bác s? n?m nhanh t?nh tr?ng trý?c bu?i khám.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Tri?u ch?ng (t?i ða 1000 k? t?)</p>
                  <Textarea
                    value={symptoms}
                    onChange={(event) => setSymptoms(event.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder="Ví d?: ðau h?ng, s?t nh? 2 ngày..."
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Ghi chú thêm (t?i ða 2000 k? t?)</p>
                  <Textarea
                    value={preVisitNote}
                    onChange={(event) => setPreVisitNote(event.target.value)}
                    rows={4}
                    maxLength={2000}
                    placeholder="Thêm thông tin b?nh s?, thu?c ðang dùng ho?c ði?u c?n bác s? lýu ?."
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bý?c 5. Ch?n khung gi?</CardTitle>
                <CardDescription>
                  {selectedDoctor
                    ? `L?ch c?n tr?ng c?a ${selectedDoctor.BS_HO_TEN} ngày ${formatDateDdMmYyyy(selectedDate)}`
                    : 'Ch?n bác s? ð? xem khung gi? kh? d?ng.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedDoctor ? (
                  slotsQuery.isLoading ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">Ðang t?i slot...</div>
                  ) : (slotsQuery.data ?? []).length === 0 || allAvailableSlots.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                      <p className="font-semibold text-slate-900">Không có slot kh? d?ng</p>
                      <p className="mt-2 text-sm text-slate-600">B?n có th? ð?i ngày khám ho?c ch?n bác s? khác.</p>
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
                                <p className="text-sm text-slate-500">Ph?ng: {session.PHONG || 'Chýa c?p nh?t'}</p>
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
                  <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">Chýa ch?n bác s?.</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Xác nh?n thông tin</CardTitle>
                <CardDescription>
                  Sau khi xác nh?n, h? th?ng s? ði?u hý?ng sang c?ng thanh toán QR/VNPAY.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SummaryRow label="Ð?t cho" value={selectedProfile ? getPatientProfileFullName(selectedProfile) : 'Chýa ch?n'} />
                <SummaryRow label="Bác s?" value={selectedDoctor?.BS_HO_TEN || 'Chýa ch?n'} />
                <SummaryRow label="Ngày khám" value={selectedDate ? formatDateDdMmYyyy(selectedDate) : 'Chýa ch?n'} />
                <SummaryRow label="Bu?i" value={selectedSlot ? getSessionLabel(selectedSlot.B_TEN) : 'Chýa ch?n'} />
                <SummaryRow label="Gi? khám" value={selectedSlot ? `${selectedSlot.KG_BAT_DAU.slice(11, 16)} - ${selectedSlot.KG_KET_THUC.slice(11, 16)}` : 'Chýa ch?n'} />

                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  N?u thanh toán b? gián ðo?n, b?n v?n có th? vào m?c "L?ch h?n c?a tôi" ð? th? l?i.
                </div>

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || redirectingToPayment || !selectedProfile || !selectedDoctor || !selectedSlot}
                >
                  {createMutation.isPending || redirectingToPayment ? (
                    <span className="inline-flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      {redirectingToPayment ? 'Ðang chuy?n ð?n c?ng thanh toán...' : 'Ðang t?o l?ch...'}
                    </span>
                  ) : (
                    'Xác nh?n và thanh toán'
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
