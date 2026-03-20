import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock3, Search, Stethoscope, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import PatientProfileSummaryCard from '@/components/patient/PatientProfileSummaryCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useAuthStore } from '@/store/useAuthStore';
import { usePatientProfilesStore } from '@/store/usePatientProfilesStore';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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

  const { data: specialties } = useSpecialties();
  const profilesQuery = useQuery({
    queryKey: ['patient-profiles'],
    queryFn: patientProfilesApi.listMine,
    enabled: Boolean(user?.TK_SDT),
  });
  const activeProfiles = (profilesQuery.data?.items ?? []).filter((item) => item.BN_DA_VO_HIEU !== true);
  const selectedProfile =
    activeProfiles.find((item) => item.BN_MA === selectedProfileId) || null;

  useEffect(() => {
    if (!user?.TK_SDT || activeProfiles.length !== 1) return;
    if (selectedProfileId !== activeProfiles[0].BN_MA) {
      setSelectedProfile(user.TK_SDT, activeProfiles[0].BN_MA);
    }
  }, [activeProfiles, selectedProfileId, setSelectedProfile, user?.TK_SDT]);

  const doctorsQuery = useQuery({
    queryKey: ['booking-doctors', specialtyId, selectedDate],
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
    return (doctorsQuery.data ?? []).filter((doctor) =>
      doctor.BS_HO_TEN.toLowerCase().includes(keyword),
    );
  }, [doctorSearch, doctorsQuery.data]);

  const selectedDoctor =
    (doctorsQuery.data ?? []).find((item) => item.BS_MA === selectedDoctorId) || null;

  useEffect(() => {
    if (!selectedDoctorId) return;
    const stillExists = (doctorsQuery.data ?? []).some((item) => item.BS_MA === selectedDoctorId);
    if (!stillExists) {
      setSelectedDoctorId(null);
      setSelectedSlotKey(null);
    }
  }, [doctorsQuery.data, selectedDoctorId]);

  const slotsQuery = useQuery({
    queryKey: ['booking-slots', selectedDoctorId, selectedDate],
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
      if (result.payment_url) {
        window.location.href = result.payment_url;
        return;
      }
      toast.success('Đặt lịch thành công');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Không thể tạo lịch khám';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const handleSubmit = () => {
    if (!selectedProfile) {
      toast.error('Vui lòng chọn hồ sơ bệnh nhân trước khi đặt lịch');
      return;
    }
    if (!selectedDoctor || !selectedSlot) {
      toast.error('Vui lòng chọn bác sĩ và khung giờ phù hợp');
      return;
    }

    createMutation.mutate({
      BN_MA: selectedProfile.BN_MA,
      BS_MA: selectedDoctor.BS_MA,
      N_NGAY: selectedDate,
      B_TEN: selectedSlot.B_TEN,
      KG_MA: selectedSlot.KG_MA,
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
                Hệ thống cần biết bạn đang thao tác dưới tài khoản nào và đang đặt lịch cho hồ sơ bệnh nhân nào.
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
          <h1 className="mt-3 text-3xl font-bold">Chọn hồ sơ bệnh nhân trước khi tiếp tục đặt lịch</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50/90">
            Mỗi lịch hẹn phải gắn với một hồ sơ bệnh nhân thuộc tài khoản {user.TK_SDT}. Sau khi chọn hồ sơ, bạn có thể lọc chuyên khoa, bác sĩ, ngày khám và khung giờ còn trống.
          </p>
        </section>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Bước 1. Chọn hồ sơ bệnh nhân</CardTitle>
            <CardDescription>
              {activeProfiles.length <= 1
                ? 'Tài khoản của bạn hiện có 1 hồ sơ hoạt động, hệ thống sẽ tự sử dụng hồ sơ này.'
                : 'Tài khoản có nhiều hồ sơ. Hãy chọn đúng người bệnh để tránh đặt lịch nhầm.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profilesQuery.isLoading ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">
                Đang tải hồ sơ bệnh nhân...
              </div>
            ) : activeProfiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                <p className="text-lg font-semibold text-slate-900">Chưa có hồ sơ bệnh nhân để đặt lịch</p>
                <p className="mt-2 text-sm text-slate-600">
                  Bạn cần tạo ít nhất một hồ sơ bệnh nhân trước khi có thể tiếp tục chọn bác sĩ và khung giờ.
                </p>
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
                          <p className="text-sm text-slate-500">
                            Mã hồ sơ #{profile.BN_MA} • {formatDateDdMmYyyy(profile.BN_NGAY_SINH)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedProfile ? (
              <PatientProfileSummaryCard profile={selectedProfile} mode="booking" compact />
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 2. Lọc chuyên khoa, bác sĩ và ngày khám</CardTitle>
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
                    <Input type="date" min={todayIso()} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} disabled={!selectedProfile} />
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
                <CardDescription>
                  Chỉ hiển thị các bác sĩ có lịch chính thức và còn khả năng nhận khám trong ngày đã chọn.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedProfile ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">
                    Vui lòng chọn hồ sơ bệnh nhân trước khi xem danh sách bác sĩ.
                  </div>
                ) : doctorsQuery.isLoading ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">
                    Đang tải danh sách bác sĩ...
                  </div>
                ) : filteredDoctors.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                    <p className="text-lg font-semibold text-slate-900">Không có bác sĩ phù hợp</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Hãy thử đổi chuyên khoa, ngày khám hoặc từ khóa tìm kiếm.
                    </p>
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
          </div>

          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 4. Chọn khung giờ</CardTitle>
                <CardDescription>
                  {selectedDoctor
                    ? `Lịch còn trống của ${selectedDoctor.BS_HO_TEN} trong ngày ${formatDateDdMmYyyy(selectedDate)}`
                    : 'Chọn bác sĩ để xem các buổi khám và slot còn trống.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedDoctor ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-900">{selectedDoctor.BS_HO_TEN}</p>
                    <p className="mt-1 text-sm text-slate-600">{selectedDoctor.CHUYEN_KHOA || 'Chưa xác định chuyên khoa'}</p>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">
                    Chưa chọn bác sĩ.
                  </div>
                )}

                {selectedDoctor ? (
                  slotsQuery.isLoading ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-slate-500">Đang tải slot...</div>
                  ) : (slotsQuery.data ?? []).length === 0 || allAvailableSlots.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                      <p className="font-semibold text-slate-900">Không có slot khả dụng</p>
                      <p className="mt-2 text-sm text-slate-600">
                        Bác sĩ chưa có slot mở bán hoặc các slot trong ngày đã được đặt hết.
                      </p>
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
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Bước 5. Xác nhận thông tin</CardTitle>
                <CardDescription>Kiểm tra kỹ hồ sơ bệnh nhân trước khi tạo lịch khám.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SummaryRow label="Đặt cho" value={selectedProfile ? getPatientProfileFullName(selectedProfile) : 'Chưa chọn'} />
                <SummaryRow label="Chuyên khoa" value={selectedDoctor?.CHUYEN_KHOA || 'Chưa chọn'} />
                <SummaryRow label="Bác sĩ" value={selectedDoctor?.BS_HO_TEN || 'Chưa chọn'} />
                <SummaryRow label="Ngày khám" value={selectedDate ? formatDateDdMmYyyy(selectedDate) : 'Chưa chọn'} />
                <SummaryRow label="Buổi" value={selectedSlot ? getSessionLabel(selectedSlot.B_TEN) : 'Chưa chọn'} />
                <SummaryRow label="Giờ khám" value={selectedSlot ? `${selectedSlot.KG_BAT_DAU.slice(11, 16)} - ${selectedSlot.KG_KET_THUC.slice(11, 16)}` : 'Chưa chọn'} />
                <SummaryRow label="Phòng" value={selectedSlot?.PHONG || 'Sẽ cập nhật theo lịch bác sĩ'} />
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  {selectedProfile
                    ? `Đang đặt lịch cho: ${getPatientProfileFullName(selectedProfile)}`
                    : 'Bạn cần chọn hồ sơ bệnh nhân trước khi tiếp tục.'}
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleSubmit} disabled={createMutation.isPending || !selectedProfile || !selectedDoctor || !selectedSlot}>
                  {createMutation.isPending ? 'Đang tạo lịch...' : 'Xác nhận và tiếp tục thanh toán'}
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
