import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Filter, Plus, Search, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { adminApi, type ScheduleWorkflowStatus } from '@/services/api/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AdminSelect,
  AdminSelectContent,
  AdminSelectItem,
  AdminSelectTrigger,
  AdminSelectValue,
} from '@/components/admin/AdminSelect';

type ReviewStatusFilter = 'all' | 'pending' | 'approved' | 'rejected';
type OfficialStatusFilter = 'all' | 'official' | 'approved';

const PAGE_SIZE = 10;

function getCurrentWeekStartIso() {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

function toDateOnlyIso(raw: string) {
  return new Date(raw).toISOString().slice(0, 10);
}

function statusBadgeClass(status: string) {
  if (status === 'pending') return 'bg-amber-50 text-amber-700';
  if (status === 'approved' || status === 'official') return 'bg-emerald-50 text-emerald-700';
  if (status === 'rejected') return 'bg-red-50 text-red-700';
  return 'bg-slate-100 text-slate-700';
}

export default function DoctorShiftManagementPage() {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(getCurrentWeekStartIso());
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<ReviewStatusFilter>('all');
  const [officialStatusFilter, setOfficialStatusFilter] = useState<OfficialStatusFilter>('all');
  const [reviewPage, setReviewPage] = useState(1);
  const [officialPage, setOfficialPage] = useState(1);

  const [reviewDialog, setReviewDialog] = useState({
    open: false,
    bsMa: 0,
    date: '',
    session: '',
    targetStatus: 'approved' as 'approved' | 'rejected',
    adminNote: '',
  });

  const [officialDialogOpen, setOfficialDialogOpen] = useState(false);
  const [officialForm, setOfficialForm] = useState({
    originalKey: null as null | { bsMa: number; date: string; session: string },
    BS_MA: '',
    P_MA: '',
    N_NGAY: '',
    B_TEN: '',
    status: 'official' as ScheduleWorkflowStatus,
    note: '',
  });

  const [deleteDialog, setDeleteDialog] = useState({ open: false, bsMa: 0, date: '', session: '' });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setReviewPage(1);
      setOfficialPage(1);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setReviewPage(1);
    setOfficialPage(1);
  }, [weekStart, specialtyFilter, doctorFilter, roomFilter, sessionFilter, reviewStatusFilter, officialStatusFilter]);

  const { data: options } = useQuery({ queryKey: ['admin-schedule-options'], queryFn: () => adminApi.getScheduleManagementOptions() });
  const { data: cycle } = useQuery({ queryKey: ['admin-schedule-cycle-overview', weekStart], queryFn: () => adminApi.getScheduleCycleOverview(weekStart) });

  const commonParams = {
    weekStart,
    specialtyId: specialtyFilter === 'all' ? undefined : Number(specialtyFilter),
    doctorId: doctorFilter === 'all' ? undefined : Number(doctorFilter),
    roomId: roomFilter === 'all' ? undefined : Number(roomFilter),
    session: sessionFilter === 'all' ? undefined : sessionFilter,
    search: debouncedSearch || undefined,
  };

  const { data: reviews, isLoading: reviewLoading } = useQuery({
    queryKey: ['admin-schedule-registrations', commonParams, reviewStatusFilter, reviewPage],
    queryFn: () => adminApi.getScheduleRegistrations({ ...commonParams, status: reviewStatusFilter, page: reviewPage, limit: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const { data: official, isLoading: officialLoading } = useQuery({
    queryKey: ['admin-schedule-official', commonParams, officialStatusFilter, officialPage],
    queryFn: () => adminApi.getOfficialSchedules({ ...commonParams, status: officialStatusFilter, page: officialPage, limit: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });
  const registrationMutation = useMutation({
    mutationFn: (payload: { bsMa: number; date: string; session: string; status: 'approved' | 'rejected'; adminNote?: string }) =>
      adminApi.updateScheduleRegistrationStatus(payload.bsMa, payload.date, payload.session, {
        status: payload.status,
        adminNote: payload.adminNote,
      }),
    onSuccess: () => {
      toast.success('Cập nhật trạng thái đăng ký thành công');
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-official'] });
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-cycle-overview'] });
      setReviewDialog((prev) => ({ ...prev, open: false, adminNote: '' }));
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Không thể cập nhật trạng thái đăng ký';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const saveOfficialMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        BS_MA: Number(officialForm.BS_MA),
        P_MA: Number(officialForm.P_MA),
        N_NGAY: officialForm.N_NGAY,
        B_TEN: officialForm.B_TEN,
        status: officialForm.status,
        note: officialForm.note || undefined,
      };

      if (!payload.BS_MA || !payload.P_MA || !payload.N_NGAY || !payload.B_TEN) {
        throw new Error('Vui lòng nhập đầy đủ bác sĩ, phòng, ngày và buổi');
      }

      if (officialForm.originalKey) {
        return adminApi.updateOfficialSchedule(
          officialForm.originalKey.bsMa,
          officialForm.originalKey.date,
          officialForm.originalKey.session,
          payload,
        );
      }
      return adminApi.createOfficialSchedule(payload);
    },
    onSuccess: () => {
      toast.success(officialForm.originalKey ? 'Cập nhật ca trực thành công' : 'Thêm ca trực thành công');
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-official'] });
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-cycle-overview'] });
      setOfficialDialogOpen(false);
    },
    onError: (error: any) => {
      const backendMessage = error?.response?.data?.message;
      const fallbackMessage = error?.message || 'Không thể lưu ca trực';
      const message = backendMessage || fallbackMessage;
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const deleteOfficialMutation = useMutation({
    mutationFn: () => adminApi.deleteOfficialSchedule(deleteDialog.bsMa, deleteDialog.date, deleteDialog.session),
    onSuccess: () => {
      toast.success('Xóa ca trực thành công');
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-official'] });
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-cycle-overview'] });
      setDeleteDialog({ open: false, bsMa: 0, date: '', session: '' });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Không thể xóa ca trực';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => adminApi.finalizeScheduleWeek(weekStart, { generateSlots: true }),
    onSuccess: (data: any) => {
      const generated = data?.generated;
      const suffix = generated ? ` (${generated.totalSlots} slot)` : '';
      toast.success(`Chốt lịch tuần thành công${suffix}`);
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-cycle-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-official'] });
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-registrations'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Không thể chốt lịch tuần';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const generateSlotsMutation = useMutation({
    mutationFn: () => adminApi.generateSlotsFromOfficialSchedule(weekStart),
    onSuccess: (data: any) => {
      toast.success(`Sinh slot thành công: ${data?.totalSlots ?? 0} slot`);
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-cycle-overview'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Không thể sinh slot';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const selectedDoctor = useMemo(
    () => options?.doctors.find((doctor) => doctor.BS_MA === Number(officialForm.BS_MA)),
    [options?.doctors, officialForm.BS_MA],
  );

  const filteredRoomOptions = useMemo(() => {
    if (!selectedDoctor) return options?.rooms ?? [];
    return (options?.rooms ?? []).filter((room) => room.CK_MA === selectedDoctor.CK_MA);
  }, [options?.rooms, selectedDoctor]);
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý lịch trực bác sĩ</h1>
          <p className="mt-1 text-sm text-gray-500">Quản lý đăng ký tuần, duyệt lịch và chốt lịch chính thức để mở slot khám</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => generateSlotsMutation.mutate()} disabled={generateSlotsMutation.isPending}>Sinh slot</Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending}>
            <ShieldCheck className="mr-2 h-4 w-4" />Chốt lịch trực
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-gray-500">Trạng thái chu kỳ</p><p className="mt-1 text-lg font-semibold text-gray-900 capitalize">{cycle?.status || '-'}</p><p className="text-xs text-gray-500">{cycle?.weekStartDate} → {cycle?.weekEndDate}</p></div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-gray-500">Đăng ký chờ duyệt</p><p className="mt-1 text-lg font-semibold text-amber-700">{cycle?.summary.pending ?? 0}</p></div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-gray-500">Đăng ký đã duyệt</p><p className="mt-1 text-lg font-semibold text-emerald-700">{cycle?.summary.approved ?? 0}</p></div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-gray-500">Ca trực chính thức</p><p className="mt-1 text-lg font-semibold text-blue-700">{cycle?.summary.official ?? 0}</p></div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
          <div className="relative sm:col-span-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input placeholder="Tìm theo tên/mã bác sĩ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
          <AdminSelect value={specialtyFilter} onValueChange={setSpecialtyFilter}><AdminSelectTrigger><AdminSelectValue placeholder="Chuyên khoa" /></AdminSelectTrigger><AdminSelectContent><AdminSelectItem value="all">Tất cả chuyên khoa</AdminSelectItem>{(options?.specialties ?? []).map((item) => (<AdminSelectItem key={item.CK_MA} value={String(item.CK_MA)}>{item.CK_TEN}</AdminSelectItem>))}</AdminSelectContent></AdminSelect>
          <AdminSelect value={doctorFilter} onValueChange={setDoctorFilter}><AdminSelectTrigger><AdminSelectValue placeholder="Bác sĩ" /></AdminSelectTrigger><AdminSelectContent><AdminSelectItem value="all">Tất cả bác sĩ</AdminSelectItem>{(options?.doctors ?? []).map((item) => (<AdminSelectItem key={item.BS_MA} value={String(item.BS_MA)}>{item.BS_HO_TEN}</AdminSelectItem>))}</AdminSelectContent></AdminSelect>
          <AdminSelect value={roomFilter} onValueChange={setRoomFilter}><AdminSelectTrigger><AdminSelectValue placeholder="Phòng" /></AdminSelectTrigger><AdminSelectContent><AdminSelectItem value="all">Tất cả phòng</AdminSelectItem>{(options?.rooms ?? []).map((item) => (<AdminSelectItem key={item.P_MA} value={String(item.P_MA)}>{item.P_TEN}</AdminSelectItem>))}</AdminSelectContent></AdminSelect>
          <AdminSelect value={sessionFilter} onValueChange={setSessionFilter}><AdminSelectTrigger><div className="flex items-center gap-2"><Filter className="h-4 w-4 text-gray-400" /><AdminSelectValue placeholder="Buổi" /></div></AdminSelectTrigger><AdminSelectContent><AdminSelectItem value="all">Tất cả buổi</AdminSelectItem>{(options?.sessions ?? []).map((item) => (<AdminSelectItem key={item.B_TEN} value={item.B_TEN}>{item.B_TEN}</AdminSelectItem>))}</AdminSelectContent></AdminSelect>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">Danh sách đăng ký bác sĩ</h2><AdminSelect value={reviewStatusFilter} onValueChange={(value) => setReviewStatusFilter(value as ReviewStatusFilter)}><AdminSelectTrigger className="w-[220px]"><AdminSelectValue placeholder="Trạng thái duyệt" /></AdminSelectTrigger><AdminSelectContent><AdminSelectItem value="all">Tất cả trạng thái duyệt</AdminSelectItem><AdminSelectItem value="pending">Chờ duyệt</AdminSelectItem><AdminSelectItem value="approved">Đã duyệt</AdminSelectItem><AdminSelectItem value="rejected">Từ chối</AdminSelectItem></AdminSelectContent></AdminSelect></div>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <Table>
            <TableHeader><TableRow className="bg-gray-50/50 hover:bg-gray-50/50"><TableHead>Bác sĩ</TableHead><TableHead>Chuyên khoa</TableHead><TableHead>Phòng</TableHead><TableHead>Ngày</TableHead><TableHead>Buổi</TableHead><TableHead>Trạng thái</TableHead><TableHead>Ghi chú</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader>
            <TableBody>{reviewLoading ? (<TableRow><TableCell colSpan={8} className="py-10 text-center text-gray-500">Đang tải đăng ký...</TableCell></TableRow>) : (reviews?.items ?? []).length === 0 ? (<TableRow><TableCell colSpan={8} className="py-10 text-center text-gray-500">Không có đăng ký phù hợp</TableCell></TableRow>) : ((reviews?.items ?? []).map((item) => (
              <TableRow key={`${item.BS_MA}-${item.N_NGAY}-${item.B_TEN}`}>
                <TableCell className="font-medium text-gray-900">{item.doctor.BS_HO_TEN}</TableCell><TableCell>{item.doctor.CHUYEN_KHOA.CK_TEN}</TableCell><TableCell>{item.room.P_TEN}</TableCell><TableCell>{toDateOnlyIso(item.N_NGAY)}</TableCell><TableCell>{item.B_TEN}</TableCell>
                <TableCell><span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>{item.status}</span></TableCell>
                <TableCell className="max-w-[240px] truncate text-sm text-gray-600">{item.note || '-'}</TableCell>
                <TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => setReviewDialog({ open: true, bsMa: item.BS_MA, date: toDateOnlyIso(item.N_NGAY), session: item.B_TEN, targetStatus: 'approved', adminNote: '' })}><CheckCircle2 className="mr-1 h-4 w-4" /> Duyệt</Button><Button size="sm" variant="outline" className="h-8 border-red-200 text-red-700 hover:bg-red-50" onClick={() => setReviewDialog({ open: true, bsMa: item.BS_MA, date: toDateOnlyIso(item.N_NGAY), session: item.B_TEN, targetStatus: 'rejected', adminNote: '' })}><XCircle className="mr-1 h-4 w-4" /> Từ chối</Button></div></TableCell>
              </TableRow>
            )))}</TableBody>
          </Table>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-gray-900">Lịch trực chính thức</h2><div className="flex items-center gap-2"><AdminSelect value={officialStatusFilter} onValueChange={(value) => setOfficialStatusFilter(value as OfficialStatusFilter)}><AdminSelectTrigger className="w-[220px]"><AdminSelectValue placeholder="Trạng thái chính thức" /></AdminSelectTrigger><AdminSelectContent><AdminSelectItem value="all">Tất cả trạng thái</AdminSelectItem><AdminSelectItem value="official">Chính thức</AdminSelectItem><AdminSelectItem value="approved">Đã duyệt (chưa chốt)</AdminSelectItem></AdminSelectContent></AdminSelect><Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setOfficialForm({ originalKey: null, BS_MA: '', P_MA: '', N_NGAY: weekStart, B_TEN: options?.sessions?.[0]?.B_TEN || '', status: 'official', note: '' }); setOfficialDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Thêm ca trực</Button></div></div>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"><Table><TableHeader><TableRow className="bg-gray-50/50 hover:bg-gray-50/50"><TableHead>Bác sĩ</TableHead><TableHead>Chuyên khoa</TableHead><TableHead>Phòng</TableHead><TableHead>Ngày</TableHead><TableHead>Buổi</TableHead><TableHead>Slot</TableHead><TableHead>Trạng thái</TableHead><TableHead>Ghi chú</TableHead><TableHead className="text-right">Thao tác</TableHead></TableRow></TableHeader><TableBody>{officialLoading ? (<TableRow><TableCell colSpan={9} className="py-10 text-center text-gray-500">Đang tải lịch chính thức...</TableCell></TableRow>) : (official?.items ?? []).length === 0 ? (<TableRow><TableCell colSpan={9} className="py-10 text-center text-gray-500">Chưa có ca trực chính thức</TableCell></TableRow>) : ((official?.items ?? []).map((item) => (<TableRow key={`${item.BS_MA}-${item.N_NGAY}-${item.B_TEN}`}><TableCell className="font-medium text-gray-900">{item.doctor.BS_HO_TEN}</TableCell><TableCell>{item.doctor.CHUYEN_KHOA.CK_TEN}</TableCell><TableCell>{item.room.P_TEN}</TableCell><TableCell>{toDateOnlyIso(item.N_NGAY)}</TableCell><TableCell>{item.B_TEN}</TableCell><TableCell>{item.slotCount}</TableCell><TableCell><span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>{item.status}</span></TableCell><TableCell className="max-w-[220px] truncate text-sm text-gray-600">{item.note || '-'}</TableCell><TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => { setOfficialForm({ originalKey: { bsMa: item.BS_MA, date: toDateOnlyIso(item.N_NGAY), session: item.B_TEN }, BS_MA: String(item.BS_MA), P_MA: String(item.P_MA), N_NGAY: toDateOnlyIso(item.N_NGAY), B_TEN: item.B_TEN, status: item.status, note: item.note || '' }); setOfficialDialogOpen(true); }}>Sửa</Button><Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => setDeleteDialog({ open: true, bsMa: item.BS_MA, date: toDateOnlyIso(item.N_NGAY), session: item.B_TEN })}><Trash2 className="mr-1 h-4 w-4" /> Xóa</Button></div></TableCell></TableRow>)))}</TableBody></Table></div>
      </div>

      <Dialog open={reviewDialog.open} onOpenChange={(open) => setReviewDialog((prev) => ({ ...prev, open }))}><DialogContent><DialogHeader><DialogTitle>{reviewDialog.targetStatus === 'approved' ? 'Duyệt đăng ký lịch trực' : 'Từ chối đăng ký lịch trực'}</DialogTitle><DialogDescription>{reviewDialog.bsMa} - {reviewDialog.date} - {reviewDialog.session}</DialogDescription></DialogHeader><div className="space-y-2"><label className="text-sm font-medium text-gray-700">Ghi chú admin (tuỳ chọn)</label><Textarea value={reviewDialog.adminNote} onChange={(e) => setReviewDialog((prev) => ({ ...prev, adminNote: e.target.value }))} /></div><DialogFooter><Button variant="outline" onClick={() => setReviewDialog((prev) => ({ ...prev, open: false }))}>Hủy</Button><Button onClick={() => registrationMutation.mutate({ bsMa: reviewDialog.bsMa, date: reviewDialog.date, session: reviewDialog.session, status: reviewDialog.targetStatus, adminNote: reviewDialog.adminNote || undefined })} disabled={registrationMutation.isPending}>{registrationMutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={officialDialogOpen} onOpenChange={setOfficialDialogOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{officialForm.originalKey ? 'Cập nhật ca trực chính thức' : 'Thêm ca trực chính thức'}</DialogTitle><DialogDescription>Áp dụng ràng buộc 1 bác sĩ / 1 phòng / 1 buổi và cùng chuyên khoa.</DialogDescription></DialogHeader><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><div><label className="mb-1 block text-sm font-medium text-gray-700">Bác sĩ</label><AdminSelect value={officialForm.BS_MA} onValueChange={(value) => setOfficialForm((prev) => ({ ...prev, BS_MA: value, P_MA: '' }))}><AdminSelectTrigger><AdminSelectValue placeholder="Chọn bác sĩ" /></AdminSelectTrigger><AdminSelectContent>{(options?.doctors ?? []).map((doctor) => (<AdminSelectItem key={doctor.BS_MA} value={String(doctor.BS_MA)}>{doctor.BS_HO_TEN}</AdminSelectItem>))}</AdminSelectContent></AdminSelect></div><div><label className="mb-1 block text-sm font-medium text-gray-700">Phòng</label><AdminSelect value={officialForm.P_MA} onValueChange={(value) => setOfficialForm((prev) => ({ ...prev, P_MA: value }))}><AdminSelectTrigger><AdminSelectValue placeholder="Chọn phòng" /></AdminSelectTrigger><AdminSelectContent>{filteredRoomOptions.map((room) => (<AdminSelectItem key={room.P_MA} value={String(room.P_MA)}>{room.P_TEN}</AdminSelectItem>))}</AdminSelectContent></AdminSelect></div><div><label className="mb-1 block text-sm font-medium text-gray-700">Ngày</label><Input type="date" value={officialForm.N_NGAY} onChange={(e) => setOfficialForm((prev) => ({ ...prev, N_NGAY: e.target.value }))} /></div><div><label className="mb-1 block text-sm font-medium text-gray-700">Buổi</label><AdminSelect value={officialForm.B_TEN} onValueChange={(value) => setOfficialForm((prev) => ({ ...prev, B_TEN: value }))}><AdminSelectTrigger><AdminSelectValue placeholder="Chọn buổi" /></AdminSelectTrigger><AdminSelectContent>{(options?.sessions ?? []).map((session) => (<AdminSelectItem key={session.B_TEN} value={session.B_TEN}>{session.B_TEN}</AdminSelectItem>))}</AdminSelectContent></AdminSelect></div><div><label className="mb-1 block text-sm font-medium text-gray-700">Trạng thái</label><AdminSelect value={officialForm.status} onValueChange={(value) => setOfficialForm((prev) => ({ ...prev, status: value as ScheduleWorkflowStatus }))}><AdminSelectTrigger><AdminSelectValue placeholder="Trạng thái" /></AdminSelectTrigger><AdminSelectContent><AdminSelectItem value="official">official</AdminSelectItem><AdminSelectItem value="approved">approved</AdminSelectItem><AdminSelectItem value="pending">pending</AdminSelectItem><AdminSelectItem value="rejected">rejected</AdminSelectItem></AdminSelectContent></AdminSelect></div><div className="md:col-span-2"><label className="mb-1 block text-sm font-medium text-gray-700">Ghi chú</label><Textarea value={officialForm.note} onChange={(e) => setOfficialForm((prev) => ({ ...prev, note: e.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setOfficialDialogOpen(false)}>Hủy</Button><Button onClick={() => saveOfficialMutation.mutate()} disabled={saveOfficialMutation.isPending}>{saveOfficialMutation.isPending ? 'Đang lưu...' : 'Lưu ca trực'}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" /> Xác nhận xóa ca trực</DialogTitle><DialogDescription>{deleteDialog.bsMa} - {deleteDialog.date} - {deleteDialog.session}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteDialog((prev) => ({ ...prev, open: false }))}>Hủy</Button><Button variant="destructive" onClick={() => deleteOfficialMutation.mutate()} disabled={deleteOfficialMutation.isPending}>{deleteOfficialMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}</Button></DialogFooter></DialogContent></Dialog>

      <div className="flex items-center justify-between text-sm text-gray-600"><p>Đăng ký: trang {reviews?.meta.page || 1}/{reviews?.meta.totalPages || 1}</p><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => setReviewPage((p) => Math.max(1, p - 1))} disabled={(reviews?.meta.page || 1) <= 1}>Trước</Button><Button size="sm" variant="outline" onClick={() => setReviewPage((p) => Math.min(reviews?.meta.totalPages || p, p + 1))} disabled={(reviews?.meta.page || 1) >= (reviews?.meta.totalPages || 1)}>Sau</Button></div></div>
      <div className="flex items-center justify-between text-sm text-gray-600"><p>Lịch chính thức: trang {official?.meta.page || 1}/{official?.meta.totalPages || 1}</p><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => setOfficialPage((p) => Math.max(1, p - 1))} disabled={(official?.meta.page || 1) <= 1}>Trước</Button><Button size="sm" variant="outline" onClick={() => setOfficialPage((p) => Math.min(official?.meta.totalPages || p, p + 1))} disabled={(official?.meta.page || 1) >= (official?.meta.totalPages || 1)}>Sau</Button></div></div>
    </div>
  );
}

