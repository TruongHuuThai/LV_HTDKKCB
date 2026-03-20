import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus2, FileText, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDateDdMmYyyy } from '@/lib/scheduleDisplay';
import {
  getPatientGenderLabel,
  getPatientProfileFullName,
  getPatientRelationshipLabel,
} from '@/lib/patientProfiles';
import { patientProfilesApi, type PatientProfile } from '@/services/api/patientProfilesApi';
import { useAuthStore } from '@/store/useAuthStore';
import { usePatientProfilesStore } from '@/store/usePatientProfilesStore';

export default function PatientProfilesPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const selectedProfileId = usePatientProfilesStore(
    (state) => state.selectedByAccount[user?.TK_SDT ?? ''],
  );
  const setSelectedProfile = usePatientProfilesStore((state) => state.setSelectedProfile);
  const clearSelectedProfile = usePatientProfilesStore((state) => state.clearSelectedProfile);
  const [pendingDelete, setPendingDelete] = useState<PatientProfile | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['patient-profiles'],
    queryFn: patientProfilesApi.listMine,
  });

  const removeMutation = useMutation({
    mutationFn: (profileId: number) => patientProfilesApi.remove(profileId),
    onSuccess: (result) => {
      toast.success(result.message);
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ['patient-profiles'] });
      if (pendingDelete && selectedProfileId === pendingDelete.BN_MA && user?.TK_SDT) {
        clearSelectedProfile(user.TK_SDT);
      }
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Không thể xử lý hồ sơ này';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const activeProfiles = useMemo(
    () => (data?.items ?? []).filter((item) => item.BN_DA_VO_HIEU !== true),
    [data?.items],
  );
  const disabledProfiles = useMemo(
    () => (data?.items ?? []).filter((item) => item.BN_DA_VO_HIEU === true),
    [data?.items],
  );

  useEffect(() => {
    if (!user?.TK_SDT || activeProfiles.length === 0) return;
    const selectedStillExists = activeProfiles.some((item) => item.BN_MA === selectedProfileId);
    if (!selectedStillExists) {
      setSelectedProfile(user.TK_SDT, activeProfiles[0].BN_MA);
    }
  }, [activeProfiles, selectedProfileId, setSelectedProfile, user?.TK_SDT]);

  const renderProfileCard = (profile: PatientProfile) => {
    const isSelected = selectedProfileId === profile.BN_MA;
    const fullName = getPatientProfileFullName(profile) || `Hồ sơ #${profile.BN_MA}`;

    return (
      <Card
        key={profile.BN_MA}
        className={`border transition-all ${
          isSelected ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 bg-white'
        } ${profile.BN_DA_VO_HIEU ? 'opacity-90' : ''}`}
      >
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 border border-slate-200">
              <AvatarImage src={profile.BN_ANH || ''} alt={fullName} className="object-cover" />
              <AvatarFallback className="bg-blue-100 text-blue-700">
                <UserRound className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl text-slate-900">{fullName}</CardTitle>
                {isSelected ? (
                  <span className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                    Đang chọn
                  </span>
                ) : null}
                {profile.BN_DA_VO_HIEU ? (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    Đã vô hiệu hóa
                  </span>
                ) : null}
              </div>
              <CardDescription className="mt-1 text-sm text-slate-600">
                Mã hồ sơ #{profile.BN_MA} • {getPatientRelationshipLabel(profile.BN_QUAN_HE_VOI_TK)}
              </CardDescription>
            </div>
          </div>
          <Button
            variant={isSelected ? 'default' : 'outline'}
            className={isSelected ? 'bg-blue-600 hover:bg-blue-700' : ''}
            onClick={() => user?.TK_SDT && setSelectedProfile(user.TK_SDT, profile.BN_MA)}
            disabled={profile.BN_DA_VO_HIEU === true}
          >
            {isSelected ? 'Đang sử dụng' : 'Chọn hồ sơ'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <InfoItem label="Ngày sinh" value={formatDateDdMmYyyy(profile.BN_NGAY_SINH)} />
            <InfoItem label="Giới tính" value={getPatientGenderLabel(profile.BN_LA_NAM)} />
            <InfoItem label="Số điện thoại" value={profile.BN_SDT_DANG_KY || 'Chưa cập nhật'} />
            <InfoItem label="CCCD" value={profile.BN_CCCD || 'Chưa cập nhật'} />
            <InfoItem label="BHYT" value={profile.BN_SO_BHYT || 'Chưa cập nhật'} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <InfoItem label="Lịch hẹn" value={`${profile.usage?.appointmentsCount ?? 0} lượt`} />
            <InfoItem
              label="Hồ sơ sức khỏe"
              value={`${profile.usage?.healthMetricsCount ?? 0} bản ghi`}
            />
            <InfoItem
              label="Cận lâm sàng"
              value={`${profile.usage?.clinicalDocumentCount ?? 0} chứng từ`}
            />
            <InfoItem label="Đơn thuốc" value={`${profile.usage?.prescriptionCount ?? 0} đơn`} />
            <InfoItem label="Hóa đơn" value={`${profile.usage?.invoiceCount ?? 0} hóa đơn`} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to={`/patient-profiles/${profile.BN_MA}`}>Xem hồ sơ</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to={`/patient-profiles/${profile.BN_MA}/edit`}>
                <Pencil className="mr-1 h-4 w-4" />
                Chỉnh sửa
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={profile.BN_DA_VO_HIEU === true}
            >
              <Link to="/booking">
                <CalendarPlus2 className="mr-1 h-4 w-4" />
                Đặt lịch khám
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to={`/patient-profiles/${profile.BN_MA}?tab=appointments`}>
                <FileText className="mr-1 h-4 w-4" />
                Dữ liệu y khoa
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => setPendingDelete(profile)}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              {profile.usage?.hasRelatedData ? 'Xóa / vô hiệu hóa' : 'Xóa hồ sơ'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-slate-900 via-blue-900 to-sky-700 p-6 text-white shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-100">
              Hồ sơ bệnh nhân của tôi
            </p>
            <h1 className="mt-3 text-3xl font-bold">Quản lý hồ sơ người bệnh theo từng thành viên</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50/90">
              Tài khoản {user?.TK_SDT} có thể quản lý tối đa 10 hồ sơ bệnh nhân. Mỗi lần đặt lịch
              hoặc xem dữ liệu y khoa, hệ thống sẽ làm việc trên hồ sơ bệnh nhân đang được chọn.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {data?.meta ? (
                <>
                  <MetricChip label="Tổng hồ sơ" value={String(data.meta.total)} />
                  <MetricChip label="Đang hoạt động" value={String(data.meta.active)} />
                  <MetricChip label="Còn có thể thêm" value={String(data.meta.remainingSlots)} />
                </>
              ) : null}
            </div>
          </section>

          {isLoading ? (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center text-slate-500">
                Đang tải danh sách hồ sơ bệnh nhân...
              </CardContent>
            </Card>
          ) : activeProfiles.length === 0 && disabledProfiles.length === 0 ? (
            <Card className="border-dashed border-slate-300 bg-slate-50">
              <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
                <div className="rounded-2xl bg-blue-100 p-4 text-blue-700">
                  <UserRound className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Chưa có hồ sơ bệnh nhân</h2>
                  <p className="mt-2 max-w-md text-sm text-slate-600">
                    Hãy tạo hồ sơ đầu tiên để bắt đầu đặt lịch khám, theo dõi lịch sử khám và xem
                    các dữ liệu y tế theo đúng người bệnh.
                  </p>
                </div>
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link to="/patient-profiles/create">
                    <Plus className="mr-1 h-4 w-4" />
                    Thêm hồ sơ
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">Hồ sơ đang hoạt động</h2>
                  <p className="text-sm text-slate-500">
                    Chọn hồ sơ để sử dụng cho đặt lịch và xem dữ liệu y khoa.
                  </p>
                </div>
                <div className="space-y-4">{activeProfiles.map(renderProfileCard)}</div>
              </section>

              {disabledProfiles.length > 0 ? (
                <section className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Hồ sơ đã vô hiệu hóa</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Các hồ sơ này được giữ lại để bảo toàn lịch sử khám, hóa đơn hoặc kết quả y tế.
                    </p>
                  </div>
                  <div className="space-y-4">{disabledProfiles.map(renderProfileCard)}</div>
                </section>
              ) : null}
            </>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Tạo hồ sơ mới</CardTitle>
              <CardDescription>
                Giới hạn hiện tại: {data?.meta.total ?? 0}/{data?.meta.limit ?? 10} hồ sơ
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Khi tài khoản đạt giới hạn 10 hồ sơ, hệ thống sẽ khóa thao tác tạo mới để tránh vượt
                quá phạm vi quản lý đã quy định.
              </p>
              {data?.meta.remainingSlots === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Tài khoản đã đạt giới hạn 10 hồ sơ. Vui lòng dùng các hồ sơ hiện có hoặc vô hiệu hóa
                  các hồ sơ không còn sử dụng.
                </div>
              ) : null}
              <Button
                asChild={Boolean(data?.meta.remainingSlots)}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!data?.meta.remainingSlots}
              >
                {data?.meta.remainingSlots ? (
                  <Link to="/patient-profiles/create">
                    <Plus className="mr-1 h-4 w-4" />
                    Thêm hồ sơ
                  </Link>
                ) : (
                  <span>
                    <Plus className="mr-1 inline h-4 w-4" />
                    Không thể thêm hồ sơ
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Đi nhanh</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to="/booking">Đặt lịch khám</Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to={selectedProfileId ? `/patient-profiles/${selectedProfileId}` : '/profile'}>
                  Xem hồ sơ đang chọn
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xử lý hồ sơ bệnh nhân</DialogTitle>
            <DialogDescription>
              Hồ sơ đã có dữ liệu liên quan sẽ được chuyển sang trạng thái vô hiệu hóa thay vì xóa
              vĩnh viễn.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">
              {pendingDelete ? getPatientProfileFullName(pendingDelete) : 'Hồ sơ bệnh nhân'}
            </p>
            <p className="mt-1">
              Nếu hồ sơ chưa có lịch sử khám, hóa đơn hoặc dữ liệu y khoa, hệ thống sẽ xóa hẳn hồ sơ
              này.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingDelete && removeMutation.mutate(pendingDelete.BN_MA)}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm">
      <span className="text-blue-100">{label}</span>
      <span className="ml-2 font-semibold text-white">{value}</span>
    </div>
  );
}
