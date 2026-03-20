import { useEffect, useMemo, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PatientProfileSummaryCard from '@/components/patient/PatientProfileSummaryCard';
import { formatCurrencyVnd, getPatientGenderLabel, getPatientRelationshipLabel } from '@/lib/patientProfiles';
import { formatDateDdMmYyyy, getSessionLabel } from '@/lib/scheduleDisplay';
import { patientProfilesApi } from '@/services/api/patientProfilesApi';
import { useAuthStore } from '@/store/useAuthStore';
import { usePatientProfilesStore } from '@/store/usePatientProfilesStore';

const TABS = [
  { key: 'info', label: 'Thông tin hồ sơ' },
  { key: 'appointments', label: 'Phiếu khám / lịch sử khám' },
  { key: 'health', label: 'Hồ sơ sức khỏe' },
  { key: 'lab', label: 'Kết quả cận lâm sàng' },
  { key: 'imaging', label: 'Hình ảnh chụp' },
  { key: 'prescriptions', label: 'Đơn thuốc' },
  { key: 'invoices', label: 'Hóa đơn' },
] as const;

export default function PatientProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const profileId = Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo(
    () =>
      TABS.some((item) => item.key === searchParams.get('tab'))
        ? (searchParams.get('tab') as (typeof TABS)[number]['key'])
        : 'info',
    [searchParams],
  );
  const user = useAuthStore((state) => state.user);
  const setSelectedProfile = usePatientProfilesStore((state) => state.setSelectedProfile);

  const detailQuery = useQuery({
    queryKey: ['patient-profile', profileId],
    queryFn: () => patientProfilesApi.getDetail(profileId),
    enabled: Number.isFinite(profileId),
  });

  useEffect(() => {
    if (!user?.TK_SDT || !Number.isFinite(profileId)) return;
    setSelectedProfile(user.TK_SDT, profileId);
  }, [profileId, setSelectedProfile, user?.TK_SDT]);

  const appointmentsQuery = useQuery({
    queryKey: ['patient-profile', profileId, 'appointments'],
    queryFn: () => patientProfilesApi.getAppointments(profileId),
    enabled: activeTab === 'appointments',
  });
  const healthMetricsQuery = useQuery({
    queryKey: ['patient-profile', profileId, 'health'],
    queryFn: () => patientProfilesApi.getHealthMetrics(profileId),
    enabled: activeTab === 'health',
  });
  const labResultsQuery = useQuery({
    queryKey: ['patient-profile', profileId, 'lab'],
    queryFn: () => patientProfilesApi.getLabResults(profileId),
    enabled: activeTab === 'lab',
  });
  const imagingResultsQuery = useQuery({
    queryKey: ['patient-profile', profileId, 'imaging'],
    queryFn: () => patientProfilesApi.getImagingResults(profileId),
    enabled: activeTab === 'imaging',
  });
  const prescriptionsQuery = useQuery({
    queryKey: ['patient-profile', profileId, 'prescriptions'],
    queryFn: () => patientProfilesApi.getPrescriptions(profileId),
    enabled: activeTab === 'prescriptions',
  });
  const invoicesQuery = useQuery({
    queryKey: ['patient-profile', profileId, 'invoices'],
    queryFn: () => patientProfilesApi.getInvoices(profileId),
    enabled: activeTab === 'invoices',
  });

  if (detailQuery.isLoading || !detailQuery.data?.profile) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Card><CardContent className="py-14 text-center text-slate-500">Đang tải chi tiết hồ sơ bệnh nhân...</CardContent></Card>
      </div>
    );
  }

  const { profile, summary } = detailQuery.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">Chi tiết hồ sơ người bệnh</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Theo dõi dữ liệu theo đúng bệnh nhân</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/profile">Quay lại danh sách hồ sơ</Link></Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700" disabled={!profile.canBook}><Link to="/booking">Đặt lịch khám</Link></Button>
          </div>
        </div>

        <PatientProfileSummaryCard profile={profile} mode="viewing" changeHref="/profile" />

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSearchParams({ tab: tab.key })}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'info' ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader><CardTitle>Thông tin hồ sơ người bệnh</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <InfoRow label="Họ và tên" value={profile.fullName} />
                <InfoRow label="Mối quan hệ" value={getPatientRelationshipLabel(profile.BN_QUAN_HE_VOI_TK)} />
                <InfoRow label="Ngày sinh" value={formatDateDdMmYyyy(profile.BN_NGAY_SINH)} />
                <InfoRow label="Giới tính" value={getPatientGenderLabel(profile.BN_LA_NAM)} />
                <InfoRow label="Số điện thoại" value={profile.BN_SDT_DANG_KY || 'Chưa cập nhật'} />
                <InfoRow label="Email" value={profile.BN_EMAIL || 'Chưa cập nhật'} />
                <InfoRow label="CCCD" value={profile.BN_CCCD || 'Chưa cập nhật'} />
                <InfoRow label="BHYT" value={profile.BN_SO_BHYT || 'Chưa cập nhật'} />
                <InfoRow label="Quốc gia" value={profile.BN_QUOC_GIA || 'Chưa cập nhật'} />
                <InfoRow label="Dân tộc" value={profile.BN_DAN_TOC || 'Chưa cập nhật'} />
                <InfoRow label="Số định danh" value={profile.BN_SO_DDCN || 'Chưa cập nhật'} />
                <InfoRow label="Loại hồ sơ" value={profile.BN_MOI === false ? 'Bệnh nhân cũ' : 'Bệnh nhân mới'} />
                <InfoRow
                  label="Khu vực đã chọn"
                  value={profile.locationLabel || profile.BN_DIA_CHI || 'Chưa cập nhật'}
                  className="md:col-span-2"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Tóm tắt dữ liệu</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <SummaryRow label="Lịch hẹn / phiếu khám" value={`${summary.appointmentsCount} lượt`} />
                <SummaryRow label="Hồ sơ sức khỏe" value={`${summary.healthMetricsCount} bản ghi`} />
                <SummaryRow label="Cận lâm sàng" value={`${summary.clinicalDocumentCount} chứng từ`} />
                <SummaryRow label="Đơn thuốc" value={`${summary.prescriptionCount} đơn`} />
                <SummaryRow label="Hóa đơn" value={`${summary.invoiceCount} hóa đơn`} />
              </CardContent>
            </Card>
          </div>
        ) : null}

        {activeTab === 'appointments' ? (
          <DataPanel isLoading={appointmentsQuery.isLoading} isEmpty={(appointmentsQuery.data?.items?.length ?? 0) === 0} emptyTitle="Chưa có lịch sử khám" emptyDescription="Khi hồ sơ này phát sinh đăng ký khám, các phiếu khám và lịch sử đến khám sẽ hiển thị tại đây.">
            <div className="grid gap-4">
              {appointmentsQuery.data?.items.map((item) => (
                <Card key={item.DK_MA}>
                  <CardContent className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{item.doctorName || 'Chưa xác định bác sĩ'}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.specialtyName || 'Chưa xác định chuyên khoa'} • {formatDateDdMmYyyy(item.N_NGAY)} • {getSessionLabel(item.B_TEN)}</p>
                      <p className="mt-2 text-sm text-slate-600">Khung giờ: {item.KHUNG_GIO?.KG_BAT_DAU?.slice(11, 16) || '--:--'} - {item.KHUNG_GIO?.KG_KET_THUC?.slice(11, 16) || '--:--'}</p>
                      <p className="mt-2 text-sm text-slate-600">Phòng: {item.roomName || 'Chưa có thông tin'}</p>
                      {item.PHIEU_KHAM_BENH?.PKB_KET_LUAN ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">Kết luận: {item.PHIEU_KHAM_BENH.PKB_KET_LUAN}</p> : null}
                    </div>
                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <SummaryRow label="Trạng thái lịch" value={item.DK_TRANG_THAI || 'Chưa cập nhật'} />
                      <SummaryRow label="Thanh toán" value={item.THANH_TOAN?.[0]?.TT_TRANG_THAI || 'Chưa có'} />
                      <SummaryRow label="Tổng tiền" value={formatCurrencyVnd(item.THANH_TOAN?.[0]?.TT_TONG_TIEN)} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DataPanel>
        ) : null}

        {activeTab === 'health' ? (
          <DataPanel isLoading={healthMetricsQuery.isLoading} isEmpty={(healthMetricsQuery.data?.items?.length ?? 0) === 0} emptyTitle="Chưa có hồ sơ sức khỏe" emptyDescription="Các chỉ số sức khỏe được bác sĩ hoặc điều dưỡng ghi nhận sẽ hiển thị tại đây.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {healthMetricsQuery.data?.items.map((item) => (
                <Card key={item.CSSK_MA}>
                  <CardHeader><CardTitle className="text-base">Lần ghi nhận {formatDateDdMmYyyy(item.CSSK_NGAY_DO)}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <SummaryRow label="Cân nặng" value={item.CSSK_CAN_NANG ? `${item.CSSK_CAN_NANG} kg` : 'Chưa có'} />
                    <SummaryRow label="Chiều cao" value={item.CSSK_CHIEU_CAO ? `${item.CSSK_CHIEU_CAO} cm` : 'Chưa có'} />
                    <SummaryRow label="Huyết áp" value={item.CSSK_HUYET_AP || 'Chưa có'} />
                    <SummaryRow label="Nhịp tim" value={item.CSSK_NHIP_TIM ? `${item.CSSK_NHIP_TIM} bpm` : 'Chưa có'} />
                    <SummaryRow label="Nhiệt độ" value={item.CSSK_NHIET_DO ? `${item.CSSK_NHIET_DO} °C` : 'Chưa có'} />
                    <SummaryRow label="Đường huyết" value={item.CSSK_DUONG_HUYET ? `${item.CSSK_DUONG_HUYET}` : 'Chưa có'} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </DataPanel>
        ) : null}

        {activeTab === 'lab' ? <ClinicalResultsPanel isLoading={labResultsQuery.isLoading} items={labResultsQuery.data?.items ?? []} emptyTitle="Chưa có kết quả cận lâm sàng" emptyDescription="Kết quả xét nghiệm và các dữ liệu cận lâm sàng sẽ xuất hiện tại đây theo từng hồ sơ bệnh nhân." /> : null}
        {activeTab === 'imaging' ? <ClinicalResultsPanel isLoading={imagingResultsQuery.isLoading} items={imagingResultsQuery.data?.items ?? []} emptyTitle="Chưa có hình ảnh chụp" emptyDescription="Kết quả siêu âm, X-quang, CT, MRI hoặc hình ảnh chẩn đoán khác sẽ hiển thị tại đây." /> : null}

        {activeTab === 'prescriptions' ? (
          <DataPanel isLoading={prescriptionsQuery.isLoading} isEmpty={(prescriptionsQuery.data?.items?.length ?? 0) === 0} emptyTitle="Chưa có đơn thuốc" emptyDescription="Các đơn thuốc đã kê theo hồ sơ bệnh nhân sẽ hiển thị trong mục này.">
            <div className="space-y-4">
              {prescriptionsQuery.data?.items.map((item) => (
                <Card key={item.DT_MA}>
                  <CardHeader><CardTitle className="text-base">Đơn thuốc #{item.DT_MA} • {formatDateDdMmYyyy(item.DT_NGAY_TAO)}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <SummaryRow label="Bác sĩ kê đơn" value={item.PHIEU_KHAM_BENH?.DANG_KY?.LICH_BSK?.BAC_SI?.BS_HO_TEN || 'Chưa xác định'} />
                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      {item.CHI_TIET_DON_THUOC.map((medicine) => (
                        <div key={`${item.DT_MA}-${medicine.T_MA}`} className="border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                          <p className="font-medium text-slate-900">{medicine.THUOC?.T_TEN_THUOC || `Thuốc #${medicine.T_MA}`}</p>
                          <p className="text-sm text-slate-600">Số lượng: {medicine.CTDT_SO_LUONG} {medicine.THUOC?.DON_VI_TINH?.DVT_TEN || ''}</p>
                          <p className="text-sm text-slate-600">Liều dùng: {medicine.CTDT_LIEU_DUNG || 'Chưa cập nhật'}</p>
                          <p className="text-sm text-slate-600">Cách dùng: {medicine.CTDT_CACH_DUNG || 'Chưa cập nhật'}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DataPanel>
        ) : null}

        {activeTab === 'invoices' ? (
          <DataPanel isLoading={invoicesQuery.isLoading} isEmpty={(invoicesQuery.data?.items?.length ?? 0) === 0} emptyTitle="Chưa có hóa đơn" emptyDescription="Hóa đơn gắn với hồ sơ bệnh nhân sẽ hiển thị tại đây sau khi phát sinh thanh toán.">
            <div className="grid gap-4 md:grid-cols-2">
              {invoicesQuery.data?.items.map((item) => (
                <Card key={item.TT_MA}>
                  <CardHeader><CardTitle className="text-base">Hóa đơn #{item.TT_MA}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <SummaryRow label="Ngày thanh toán" value={formatDateDdMmYyyy(item.TT_THOI_GIAN)} />
                    <SummaryRow label="Trạng thái" value={item.TT_TRANG_THAI || 'Chưa cập nhật'} />
                    <SummaryRow label="Phương thức" value={item.TT_PHUONG_THUC_TT || item.TT_PHUONG_THUC || 'Chưa cập nhật'} />
                    <SummaryRow label="Tổng tiền" value={formatCurrencyVnd(item.TT_TONG_TIEN)} />
                    <SummaryRow label="Thực thu" value={formatCurrencyVnd(item.TT_THUC_THU)} />
                    <SummaryRow label="Bác sĩ" value={item.DANG_KY?.LICH_BSK?.BAC_SI?.BS_HO_TEN || 'Chưa cập nhật'} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </DataPanel>
        ) : null}
      </div>
    </div>
  );
}

function DataPanel({ isLoading, isEmpty, emptyTitle, emptyDescription, children }: { isLoading: boolean; isEmpty: boolean; emptyTitle: string; emptyDescription: string; children: ReactNode; }) {
  if (isLoading) return <Card><CardContent className="py-14 text-center text-slate-500">Đang tải dữ liệu...</CardContent></Card>;
  if (isEmpty) return <Card className="border-dashed border-slate-300 bg-slate-50"><CardContent className="py-14 text-center"><h3 className="text-lg font-semibold text-slate-900">{emptyTitle}</h3><p className="mt-2 text-sm text-slate-600">{emptyDescription}</p></CardContent></Card>;
  return <>{children}</>;
}

function ClinicalResultsPanel({ isLoading, items, emptyTitle, emptyDescription }: { isLoading: boolean; items: Array<any>; emptyTitle: string; emptyDescription: string; }) {
  return (
    <DataPanel isLoading={isLoading} isEmpty={items.length === 0} emptyTitle={emptyTitle} emptyDescription={emptyDescription}>
      <div className="grid gap-4">
        {items.map((item) => (
          <Card key={`${item.documentId}-${item.service?.DVCLS_MA || 'service'}`}>
            <CardContent className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div>
                <p className="text-lg font-semibold text-slate-900">{item.service?.DVCLS_TEN || 'Kết quả cận lâm sàng'}</p>
                <p className="mt-1 text-sm text-slate-600">{item.service?.DVCLS_LOAI || 'Chưa phân loại'} • {formatDateDdMmYyyy(item.createdAt)}</p>
                <p className="mt-2 text-sm text-slate-600">Bác sĩ: {item.doctorName || 'Chưa cập nhật'}</p>
                <p className="mt-2 text-sm text-slate-600">Nhận xét: {item.result?.KQCLS_NHAN_XET || 'Chưa có nhận xét'}</p>
                {item.result?.KQCLS_HINH_ANH ? <Button asChild variant="outline" size="sm" className="mt-3"><a href={item.result.KQCLS_HINH_ANH} target="_blank" rel="noreferrer">Xem hình ảnh</a></Button> : null}
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <SummaryRow label="Mã chứng từ" value={`#${item.documentId}`} />
                <SummaryRow label="Ngày khám" value={formatDateDdMmYyyy(item.appointment?.N_NGAY)} />
                <SummaryRow label="Buổi khám" value={getSessionLabel(item.appointment?.B_TEN)} />
                <SummaryRow label="Chuyên khoa" value={item.specialtyName || 'Chưa cập nhật'} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DataPanel>
  );
}

function InfoRow({ label, value, className }: { label: string; value: string; className?: string; }) {
  return <div className={`rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 ${className || ''}`}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-sm font-medium text-slate-900">{value}</p></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 text-sm"><span className="text-slate-500">{label}</span><span className="text-right font-medium text-slate-900">{value}</span></div>;
}
