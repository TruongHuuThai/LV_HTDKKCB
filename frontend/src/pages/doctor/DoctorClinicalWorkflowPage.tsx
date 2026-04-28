import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, FileDown, FileSearch, Loader2, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { doctorAppointmentsApi } from '@/services/api/doctorAppointmentsApi';
import { doctorClinicalApi, type DoctorExamWorkflowResponse } from '@/services/api/doctorClinicalApi';
import { formatDateDdMmYyyy } from '@/lib/scheduleDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

function calculateAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function formatIndicatorValue(value: number | null | undefined, suffix: string, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Chưa cập nhật';
  return `${Number(value).toFixed(digits)} ${suffix}`.trim();
}

function StatusBadge({
  label,
  tone = 'slate',
}: {
  label: string;
  tone?: 'slate' | 'blue' | 'amber' | 'green' | 'rose';
}) {
  const className =
    tone === 'green'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : tone === 'blue'
          ? 'bg-blue-50 text-blue-700 border-blue-200'
          : tone === 'rose'
            ? 'bg-rose-50 text-rose-700 border-rose-200'
            : 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', className)}>
      {label}
    </span>
  );
}

function mapClinicalLabel(status: string) {
  if (status === 'CHO_KHAM') return { label: 'Chờ khám', tone: 'slate' as const };
  if (status === 'DANG_KHAM') return { label: 'Đang khám', tone: 'blue' as const };
  if (status === 'CHO_KET_QUA') return { label: 'Chờ kết quả cận lâm sàng', tone: 'amber' as const };
  if (status === 'KET_THUC_CHUYEN_MON') return { label: 'Đã kết thúc chuyên môn', tone: 'green' as const };
  if (status === 'HOAN_TAT') return { label: 'Đã hoàn tất hồ sơ', tone: 'green' as const };
  return { label: status || 'Khác', tone: 'slate' as const };
}

function mapFinancialLabel(status: string) {
  if (status === 'DA_THANH_TOAN') return { label: 'Đã thanh toán', tone: 'green' as const };
  if (status === 'CHO_THANH_TOAN') return { label: 'Chờ thanh toán', tone: 'amber' as const };
  if (status === 'CHUA_LAP_HOA_DON') return { label: 'Chưa có hóa đơn', tone: 'slate' as const };
  if (status === 'THAT_BAI') return { label: 'Thanh toán thất bại', tone: 'rose' as const };
  return { label: status || 'Khác', tone: 'slate' as const };
}

export default function DoctorClinicalWorkflowPage() {
  const queryClient = useQueryClient();
  const [workDate, setWorkDate] = useState(todayIso());
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [orderResultSummaryByKey, setOrderResultSummaryByKey] = useState<Record<string, string>>({});

  const [clinicalForm, setClinicalForm] = useState({
    symptoms: '',
    clinicalNotes: '',
    diagnosisPreliminary: '',
    diagnosisFinal: '',
    conclusion: '',
    treatmentPlan: '',
  });

  const createEmptyPrescriptionItem = () => ({
    medicineId: null as number | null,
    quantity: 1,
    dosage: '',
    usage: '',
  });
  const [prescriptionItems, setPrescriptionItems] = useState([createEmptyPrescriptionItem()]);
  const [prescriptionForm, setPrescriptionForm] = useState({
    note: '',
    days: 0,
  });

  const getErrorMessage = (error: unknown, fallback: string) => {
    const message = (error as any)?.response?.data?.message;
    if (Array.isArray(message)) return message[0] || fallback;
    if (typeof message === 'string' && message.trim()) return message;
    return fallback;
  };

  const worklistQuery = useQuery({
    queryKey: ['doctor-clinical-worklist', workDate],
    queryFn: () =>
      doctorAppointmentsApi.getWorklist({
        date: workDate,
        limit: 100,
      }),
  });

  const workflowQuery = useQuery({
    queryKey: ['doctor-clinical-workflow', selectedAppointmentId],
    queryFn: () => doctorClinicalApi.getExamWorkflow(selectedAppointmentId!),
    enabled: Boolean(selectedAppointmentId),
  });

  const serviceCatalogQuery = useQuery({
    queryKey: ['doctor-clinical-service-catalog'],
    queryFn: () => doctorClinicalApi.getClinicalServiceCatalog({ limit: 100 }),
  });

  const medicineCatalogQuery = useQuery({
    queryKey: ['doctor-medicine-catalog'],
    queryFn: () => doctorClinicalApi.getMedicineCatalog({ limit: 100 }),
  });

  const refreshWorkflow = async () => {
    await queryClient.invalidateQueries({ queryKey: ['doctor-clinical-workflow', selectedAppointmentId] });
    await queryClient.invalidateQueries({ queryKey: ['doctor-clinical-worklist', workDate] });
  };

  const startExamMutation = useMutation({
    mutationFn: (appointmentId: number) => doctorClinicalApi.startExam(appointmentId),
    onSuccess: async (_, appointmentId) => {
      toast.success('Đã bắt đầu khám.');
      setSelectedAppointmentId(appointmentId);
      await refreshWorkflow();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể bắt đầu khám.')),
  });

  const updateClinicalMutation = useMutation({
    mutationFn: () => doctorClinicalApi.updateClinicalNote(selectedAppointmentId!, { ...clinicalForm }),
    onSuccess: async () => {
      toast.success('Đã cập nhật phiếu khám.');
      await refreshWorkflow();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể cập nhật phiếu khám.')),
  });

  const createOrderMutation = useMutation({
    mutationFn: () =>
      doctorClinicalApi.createOrders(
        selectedAppointmentId!,
        selectedServiceIds.map((serviceId) => ({ serviceId })),
      ),
    onSuccess: async (res: any) => {
      toast.success('Đã tạo chỉ định cận lâm sàng và sinh PDF.');
      setSelectedServiceIds([]);
      await refreshWorkflow();
      const createdOrderId = res?.orderPdf?.orderId;
      if (createdOrderId) {
        toast.message(`Phiếu #${createdOrderId} đã sẵn sàng để xem/tải/in.`);
      }
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể tạo chỉ định.')),
  });

  const updateOrderResultMutation = useMutation({
    mutationFn: (input: { orderId: number; serviceId: number; key: string }) =>
      doctorClinicalApi.updateOrderResult(selectedAppointmentId!, input.orderId, input.serviceId, {
        resultSummary: orderResultSummaryByKey[input.key] || undefined,
      }),
    onSuccess: async (_, input) => {
      toast.success('Đã cập nhật kết quả cận lâm sàng.');
      setOrderResultSummaryByKey((prev) => ({ ...prev, [input.key]: '' }));
      await refreshWorkflow();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể cập nhật kết quả cận lâm sàng.')),
  });

  const createPrescriptionMutation = useMutation({
    mutationFn: () =>
      doctorClinicalApi.createPrescription(selectedAppointmentId!, {
        items: prescriptionItems
          .filter((item) => Boolean(item.medicineId))
          .map((item) => ({
            medicineId: item.medicineId as number,
            quantity: item.quantity,
            dosage: item.dosage || undefined,
            usage: item.usage || undefined,
          })),
        note: prescriptionForm.note || undefined,
        days: prescriptionForm.days > 0 ? prescriptionForm.days : undefined,
      }),
    onSuccess: async () => {
      toast.success('Đã lập đơn thuốc.');
      setPrescriptionItems([createEmptyPrescriptionItem()]);
      setPrescriptionForm({
        note: '',
        days: 0,
      });
      await refreshWorkflow();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể lập đơn thuốc.')),
  });

  const completeExamMutation = useMutation({
    mutationFn: () => doctorClinicalApi.completeExam(selectedAppointmentId!, { allowIncompleteOrders: false }),
    onSuccess: async () => {
      toast.success('Đã xác nhận khám hoàn tất. Hệ thống đã tự xử lý thông báo cho bệnh nhân.');
      setConfirmCompleteOpen(false);
      await refreshWorkflow();
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Không thể xác nhận khám hoàn tất.')),
  });

  const selectedWorkflow = workflowQuery.data as DoctorExamWorkflowResponse | undefined;

  useEffect(() => {
    if (!selectedWorkflow?.encounter) return;
    setClinicalForm((prev) => ({
      ...prev,
      symptoms: selectedWorkflow.encounter?.symptoms || prev.symptoms,
      clinicalNotes: selectedWorkflow.encounter?.clinicalNotes || prev.clinicalNotes,
      conclusion: selectedWorkflow.encounter?.conclusion || prev.conclusion,
    }));
  }, [selectedWorkflow?.encounter]);

  const worklistItems = worklistQuery.data?.items ?? [];
  const activeItems = useMemo(
    () =>
      worklistItems.filter((item) =>
        ['CHO_KHAM', 'DA_CHECKIN', 'DA_KHAM', 'HOAN_TAT'].includes(item.DK_TRANG_THAI || ''),
      ),
    [worklistItems],
  );

  const groupedOrders = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const order of selectedWorkflow?.orders || []) {
      if (!map.has(order.orderId)) map.set(order.orderId, []);
      map.get(order.orderId)!.push(order);
    }
    return Array.from(map.entries()).map(([orderId, services]) => ({ orderId, services }));
  }, [selectedWorkflow?.orders]);

  const canConfirmComplete =
    Boolean(selectedWorkflow?.encounter?.conclusion?.trim()) &&
    selectedWorkflow?.workflow.clinicalStatus !== 'HOAN_TAT';
  const hasValidPrescriptionItems = useMemo(
    () => prescriptionItems.some((item) => Boolean(item.medicineId)),
    [prescriptionItems],
  );

  const clinicalTag = mapClinicalLabel(selectedWorkflow?.workflow.clinicalStatus || '');
  const financialTag = mapFinancialLabel(selectedWorkflow?.workflow.financialStatus || '');
  const patientAge = calculateAge(selectedWorkflow?.patient?.dateOfBirth || null);

  const updatePrescriptionItem = (
    index: number,
    patch: Partial<{ medicineId: number | null; quantity: number; dosage: string; usage: string }>,
  ) => {
    setPrescriptionItems((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  };

  const addPrescriptionItem = () => {
    setPrescriptionItems((prev) => [...prev, createEmptyPrescriptionItem()]);
  };

  const removePrescriptionItem = (index: number) => {
    setPrescriptionItems((prev) => (prev.length === 1 ? prev : prev.filter((_, itemIndex) => itemIndex !== index)));
  };

  return (
    <div className="space-y-4 p-4 md:p-6 xl:p-8">
      <section className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">Khám bệnh cho bệnh nhân</h1>
        <p className="text-sm text-slate-500">
          Quy trình tối giản: bắt đầu khám, cập nhật phiếu khám, chỉ định cận lâm sàng (nếu cần), kê đơn và xác nhận khám hoàn tất.
        </p>
      </section>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Danh sách chờ khám theo ngày</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="work-date">Ngày làm việc</Label>
              <Input
                id="work-date"
                type="date"
                value={workDate}
                onChange={(event) => setWorkDate(event.target.value)}
                className="w-[180px] bg-white"
              />
            </div>
            <Button variant="outline" onClick={() => worklistQuery.refetch()}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Tải lại
            </Button>
          </div>

          {worklistQuery.isLoading ? (
            <p className="text-sm text-slate-500">Đang tải danh sách bệnh nhân...</p>
          ) : worklistQuery.isError ? (
            <p className="text-sm text-rose-700">Không thể tải worklist bác sĩ.</p>
          ) : activeItems.length === 0 ? (
            <p className="text-sm text-slate-500">Không có ca khám phù hợp trong ngày.</p>
          ) : (
            <div className="grid gap-2">
              {activeItems.map((item) => {
                const isStarted = item.DK_TRANG_THAI !== 'CHO_KHAM';
                const isCompleted = item.DK_TRANG_THAI === 'HOAN_TAT';
                return (
                  <div
                    key={item.DK_MA}
                    className={cn(
                      'flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3',
                      selectedAppointmentId === item.DK_MA ? 'border-blue-300 bg-blue-50' : 'border-slate-200',
                    )}
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">
                        {item.patientName} - {item.KG_BAT_DAU?.slice(0, 5) || '--:--'}
                      </p>
                      <p className="text-xs text-slate-600">
                        #{item.DK_MA} • {formatDateDdMmYyyy(item.N_NGAY)} • {item.roomName || 'Chưa có phòng'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge label={item.DK_TRANG_THAI || 'N/A'} tone="blue" />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (isCompleted) return;
                          setSelectedAppointmentId(item.DK_MA);
                          if (!isStarted) {
                            startExamMutation.mutate(item.DK_MA);
                          }
                        }}
                        disabled={startExamMutation.isPending || isCompleted}
                      >
                        {isCompleted ? 'Đã hoàn tất' : isStarted ? 'Tiếp tục khám' : 'Bắt đầu khám'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedAppointmentId ? null : workflowQuery.isLoading ? (
        <Card className="border-slate-200">
          <CardContent className="py-6 text-sm text-slate-500">Đang tải workflow khám bệnh...</CardContent>
        </Card>
      ) : workflowQuery.isError || !selectedWorkflow ? (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-6 text-sm text-rose-700">Không thể tải chi tiết luồng khám.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border-slate-200 xl:col-span-2">
            <CardContent className="flex flex-wrap items-center gap-3 py-4">
              <span className="text-sm text-slate-700">
                Bệnh nhân: <strong>{selectedWorkflow.patient.name || `#${selectedWorkflow.patient.id}`}</strong>
              </span>
              <span className="text-sm text-slate-600">Lịch hẹn: #{selectedWorkflow.appointment.id}</span>
              <StatusBadge label={clinicalTag.label} tone={clinicalTag.tone} />
              <StatusBadge label={financialTag.label} tone={financialTag.tone} />
              <StatusBadge label={`Trạng thái lịch: ${selectedWorkflow.appointment.status}`} tone="slate" />
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">1. Phiếu khám lâm sàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={clinicalForm.symptoms}
                onChange={(event) => setClinicalForm((prev) => ({ ...prev, symptoms: event.target.value }))}
                placeholder="Triệu chứng chính của bệnh nhân"
              />
              <Textarea
                value={clinicalForm.clinicalNotes}
                onChange={(event) => setClinicalForm((prev) => ({ ...prev, clinicalNotes: event.target.value }))}
                placeholder="Ghi nhận lâm sàng"
              />
              <Textarea
                value={clinicalForm.diagnosisPreliminary}
                onChange={(event) =>
                  setClinicalForm((prev) => ({ ...prev, diagnosisPreliminary: event.target.value }))
                }
                placeholder="Chẩn đoán sơ bộ"
              />
              <Textarea
                value={clinicalForm.diagnosisFinal}
                onChange={(event) => setClinicalForm((prev) => ({ ...prev, diagnosisFinal: event.target.value }))}
                placeholder="Chẩn đoán xác định"
              />
              <Textarea
                value={clinicalForm.conclusion}
                onChange={(event) => setClinicalForm((prev) => ({ ...prev, conclusion: event.target.value }))}
                placeholder="Kết luận"
              />
              <Textarea
                value={clinicalForm.treatmentPlan}
                onChange={(event) => setClinicalForm((prev) => ({ ...prev, treatmentPlan: event.target.value }))}
                placeholder="Hướng xử trí"
              />
              <Button onClick={() => updateClinicalMutation.mutate()} disabled={updateClinicalMutation.isPending}>
                Cập nhật phiếu khám
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">2. Chỉ định cận lâm sàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
                {(serviceCatalogQuery.data?.items || []).map((item) => {
                  const checked = selectedServiceIds.includes(item.DVCLS_MA);
                  return (
                    <label key={item.DVCLS_MA} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setSelectedServiceIds((prev) => {
                            if (event.target.checked) return [...prev, item.DVCLS_MA];
                            return prev.filter((id) => id !== item.DVCLS_MA);
                          });
                        }}
                      />
                      <span>
                        <span className="font-medium text-slate-900">{item.DVCLS_TEN}</span>
                        <span className="ml-2 text-xs text-slate-500">#{item.DVCLS_MA}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <Button
                onClick={() => createOrderMutation.mutate()}
                disabled={selectedServiceIds.length === 0 || createOrderMutation.isPending}
              >
                Tạo chỉ định
              </Button>

              <div className="space-y-2">
                {groupedOrders.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa có chỉ định cận lâm sàng.</p>
                ) : (
                  groupedOrders.map((group) => (
                    <div key={group.orderId} className="rounded-lg border border-slate-200 p-2">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">Phiếu #{group.orderId}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => doctorClinicalApi.previewOrderPdf(selectedAppointmentId!, group.orderId)}
                          >
                            <FileSearch className="mr-1 h-4 w-4" /> Xem PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => doctorClinicalApi.downloadOrderPdf(selectedAppointmentId!, group.orderId)}
                          >
                            <FileDown className="mr-1 h-4 w-4" /> Tải PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => doctorClinicalApi.printOrderPdf(selectedAppointmentId!, group.orderId)}
                          >
                            <Printer className="mr-1 h-4 w-4" /> In phiếu
                          </Button>
                        </div>
                      </div>

                      {group.services.map((order) => {
                        const orderKey = `${order.orderId}-${order.serviceId}`;
                        return (
                          <div key={orderKey} className="mb-2 rounded-md border border-slate-100 bg-slate-50 p-2">
                            <p className="text-sm font-medium text-slate-900">{order.serviceName || `DV ${order.serviceId}`}</p>
                            <p className="text-xs text-slate-600">
                              Trạng thái: {order.status} • Giá: {Number(order.price || 0).toLocaleString('vi-VN')} VND
                            </p>
                            {order.status !== 'DA_CO_KET_QUA' ? (
                              <div className="mt-2 space-y-2">
                                <Textarea
                                  value={orderResultSummaryByKey[orderKey] || ''}
                                  onChange={(event) =>
                                    setOrderResultSummaryByKey((prev) => ({ ...prev, [orderKey]: event.target.value }))
                                  }
                                  placeholder="Nhập tóm tắt kết quả"
                                />
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    updateOrderResultMutation.mutate({
                                      orderId: order.orderId,
                                      serviceId: order.serviceId,
                                      key: orderKey,
                                    })
                                  }
                                  disabled={updateOrderResultMutation.isPending}
                                >
                                  Cập nhật kết quả
                                </Button>
                              </div>
                            ) : (
                              <p className="mt-1 text-xs text-emerald-700">
                                Kết quả: {order.result?.summary || 'Đã có kết quả'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">3. Đơn thuốc</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {prescriptionItems.map((item, index) => (
                <div key={`prescription-item-${index}`} className="space-y-2 rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800">Thuốc {index + 1}</p>
                    {index > 0 ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removePrescriptionItem(index)}
                        title="Xóa dòng thuốc"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    value={item.medicineId || ''}
                    onChange={(event) =>
                      updatePrescriptionItem(index, { medicineId: Number(event.target.value) || null })
                    }
                  >
                    <option value="">Chọn thuốc</option>
                    {(medicineCatalogQuery.data?.items || []).map((medicine) => (
                      <option key={medicine.T_MA} value={medicine.T_MA}>
                        {medicine.T_TEN_THUOC}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) =>
                      updatePrescriptionItem(index, {
                        quantity: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                    placeholder="Số lượng"
                  />
                  <Input
                    value={item.dosage}
                    onChange={(event) => updatePrescriptionItem(index, { dosage: event.target.value })}
                    placeholder="Liều dùng"
                  />
                  <Input
                    value={item.usage}
                    onChange={(event) => updatePrescriptionItem(index, { usage: event.target.value })}
                    placeholder="Cách dùng"
                  />
                </div>
              ))}
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={addPrescriptionItem}>
                  <ArrowDown className="mr-1 h-4 w-4" />
                  Thêm dòng thuốc
                </Button>
              </div>
              <Textarea
                value={prescriptionForm.note}
                onChange={(event) => setPrescriptionForm((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Ghi chú đơn thuốc"
              />
              <Button
                onClick={() => createPrescriptionMutation.mutate()}
                disabled={!hasValidPrescriptionItems || createPrescriptionMutation.isPending}
              >
                Lập đơn thuốc
              </Button>
              <p className="text-xs text-slate-600">Đã có {selectedWorkflow.prescriptions.length} đơn thuốc.</p>
              {selectedWorkflow.prescriptions.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">Đơn thuốc đã tạo</p>
                  {selectedWorkflow.prescriptions.map((prescription) => (
                    <div
                      key={prescription.prescriptionId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white p-2"
                    >
                      <p className="text-sm text-slate-700">
                        Đơn #{prescription.prescriptionId}
                        {prescription.createdAt
                          ? ` • ${formatDateDdMmYyyy(prescription.createdAt)}`
                          : ''}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            doctorClinicalApi.previewPrescriptionPdf(
                              selectedAppointmentId!,
                              prescription.prescriptionId,
                            )
                          }
                        >
                          <FileSearch className="mr-1 h-4 w-4" /> Xem PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            doctorClinicalApi.downloadPrescriptionPdf(
                              selectedAppointmentId!,
                              prescription.prescriptionId,
                            )
                          }
                        >
                          <FileDown className="mr-1 h-4 w-4" /> Tải PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            doctorClinicalApi.printPrescriptionPdf(
                              selectedAppointmentId!,
                              prescription.prescriptionId,
                            )
                          }
                        >
                          <Printer className="mr-1 h-4 w-4" /> In đơn
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Chỉ số sức khỏe</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">Ngày đo gần nhất</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedWorkflow.healthIndicators?.measuredAt
                      ? formatDateDdMmYyyy(selectedWorkflow.healthIndicators.measuredAt)
                      : 'Chưa cập nhật'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">Tuổi / Giới tính</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {patientAge !== null ? `${patientAge} tuổi` : 'Chưa rõ tuổi'} •{' '}
                    {selectedWorkflow.patient.gender === 'NAM'
                      ? 'Nam'
                      : selectedWorkflow.patient.gender === 'NU'
                        ? 'Nữ'
                        : 'Chưa cập nhật'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">Cân nặng</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatIndicatorValue(selectedWorkflow.healthIndicators?.weightKg, 'kg')}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">Chiều cao</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatIndicatorValue(selectedWorkflow.healthIndicators?.heightCm, 'cm')}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">BMI</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatIndicatorValue(selectedWorkflow.healthIndicators?.bmi, '', 1)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">Huyết áp</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedWorkflow.healthIndicators?.bloodPressure || 'Chưa cập nhật'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">Nhịp tim</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatIndicatorValue(selectedWorkflow.healthIndicators?.heartRateBpm, 'bpm', 0)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">Nhiệt độ</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatIndicatorValue(selectedWorkflow.healthIndicators?.bodyTemperatureC, '°C')}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 sm:col-span-2">
                  <p className="text-xs text-slate-500">Đường huyết</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatIndicatorValue(selectedWorkflow.healthIndicators?.bloodGlucoseMmolL, 'mmol/L')}
                  </p>
                </div>
              </div>
              {selectedWorkflow.healthIndicators?.note ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-xs text-slate-500">Ghi chú chỉ số</p>
                  <p className="text-sm text-slate-800">{selectedWorkflow.healthIndicators.note}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/50 xl:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">4. Xác nhận khám hoàn tất</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-slate-700">
                Khi xác nhận, hệ thống sẽ kết thúc ca khám và tự động gửi thông báo kết quả cho bệnh nhân.
                Nếu có chi phí dịch vụ chưa thanh toán, hệ thống sẽ gửi thêm thông báo thanh toán.
              </p>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setConfirmCompleteOpen(true)}
                disabled={!canConfirmComplete || completeExamMutation.isPending}
              >
                {completeExamMutation.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                Xác nhận khám hoàn tất
              </Button>
              {!canConfirmComplete ? (
                <p className="text-xs text-amber-700">
                  Cần có kết luận phiếu khám trước khi xác nhận hoàn tất ca khám.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
        <DialogContent className="bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Xác nhận hoàn tất ca khám</DialogTitle>
            <DialogDescription>
              Thao tác này sẽ kết thúc ca khám, gửi thông báo kết quả khám cho bệnh nhân, và nếu có phí dịch vụ chưa thanh toán thì sẽ gửi thêm thông báo thanh toán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCompleteOpen(false)}>
              Hủy
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => completeExamMutation.mutate()}
              disabled={completeExamMutation.isPending}
            >
              {completeExamMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Xác nhận khám hoàn tất
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
