import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, Copy, Eraser, GripVertical, Search, UserMinus } from 'lucide-react';
import { toast } from 'sonner';

import {
  adminScheduleWorkflowApi,
  type TemplateStatus,
} from '@/services/api/scheduleWorkflowApi';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatDateDdMmYyyySlash, getSessionLabel, getWeekdayLabel } from '@/lib/scheduleDisplay';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AdminSelect,
  AdminSelectContent,
  AdminSelectItem,
  AdminSelectTrigger,
  AdminSelectValue,
} from '@/components/admin/AdminSelect';

type BuilderSlot = {
  key: string;
  weekday: number;
  session: string;
  roomId: number;
};

type DoctorDragData = {
  type: 'doctor';
  doctorId: number;
  specialtyId: number;
  doctorName: string;
  specialtyName: string;
  assignedCount: number;
};

type SlotDropData = {
  type: 'slot';
  slotKey: string;
  weekday: number;
  session: string;
  roomId: number;
};

const TEMPLATE_WEEKDAYS = [1, 2, 3, 4, 5, 6];

const slotKey = (weekday: number, session: string, roomId: number) =>
  `${weekday}__${session}__${roomId}`;

const getNextWeekStartIso = () => {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + 7);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(
    monday.getDate(),
  ).padStart(2, '0')}`;
};

function EmptyCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function CompactDoctorCard({
  id,
  specialtyId,
  name,
  specialtyName,
  assignedCount,
  active,
  disabled,
}: {
  id: number;
  specialtyId: number;
  name: string;
  specialtyName: string;
  assignedCount: number;
  active: boolean;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `template-page-doctor-${id}`,
    data: {
      type: 'doctor',
      doctorId: id,
      specialtyId,
      doctorName: name,
      specialtyName,
      assignedCount,
    } satisfies DoctorDragData,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={!active ? { transform: CSS.Translate.toString(transform) } : undefined}
      {...attributes}
      {...listeners}
      className={cn(
        'rounded-lg border p-3 text-sm shadow-sm transition-all',
        disabled && 'cursor-not-allowed opacity-60',
        !disabled && 'cursor-grab active:cursor-grabbing',
        active ? 'border-blue-300 bg-blue-50 opacity-45 ring-2 ring-blue-200' : 'border-slate-200 bg-white',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-slate-900">{name}</div>
        <GripVertical className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-1 text-xs text-slate-500">{specialtyName}</div>
      <div className="mt-2 inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
        {assignedCount} slot mẫu
      </div>
    </div>
  );
}

function TemplateSlotCard({
  slot,
  roomName,
  doctorName,
  hasConflict,
  canDrop,
  dropReason,
  dragging,
  onRemoveDoctor,
}: {
  slot: BuilderSlot;
  roomName: string;
  doctorName: string | null;
  hasConflict: boolean;
  canDrop: boolean;
  dropReason?: string;
  dragging: boolean;
  onRemoveDoctor: (slotKeyValue: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slot.key,
    data: {
      type: 'slot',
      slotKey: slot.key,
      weekday: slot.weekday,
      session: slot.session,
      roomId: slot.roomId,
    } satisfies SlotDropData,
  });

  const assigned = Boolean(doctorName);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-md border p-2 transition-all',
        hasConflict
          ? 'border-rose-300 bg-rose-50'
          : assigned
            ? 'border-emerald-300 bg-emerald-50'
            : 'border-dashed border-slate-300 bg-slate-50',
        dragging && canDrop && 'border-blue-300 bg-blue-50/70',
        dragging && !canDrop && 'border-rose-300 bg-rose-50/70',
        isOver && canDrop && 'scale-[1.01] border-blue-500 bg-blue-100 ring-2 ring-blue-500 shadow-sm',
        isOver && !canDrop && 'border-rose-500 bg-rose-100 ring-2 ring-rose-500',
      )}
    >
      <div className="text-[11px] text-slate-500">{roomName}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className={cn('text-sm', assigned ? 'font-medium text-slate-900' : 'text-slate-500')}>
          {doctorName || 'Kéo bác sĩ vào đây'}
        </div>
        {assigned ? (
          <button
            type="button"
            className="rounded p-1 text-slate-500 hover:bg-white hover:text-rose-600"
            onClick={() => onRemoveDoctor(slot.key)}
            title="Gỡ bác sĩ khỏi slot"
          >
            <UserMinus className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <div
        className={cn(
          'mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
          hasConflict
            ? 'bg-rose-100 text-rose-700'
            : assigned
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-600',
        )}
      >
        {hasConflict ? 'Trùng' : assigned ? 'Đã có mẫu' : 'Trống'}
      </div>
      {dragging ? (
        <div className={cn('mt-1 text-[10px] font-medium', canDrop ? 'text-blue-700' : 'text-rose-700')}>
          {canDrop ? 'Có thể thả vào slot này' : dropReason || 'Không thể thả vào slot này'}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminScheduleTemplateBuilderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const startPickerRef = useRef<HTMLInputElement>(null);
  const endPickerRef = useRef<HTMLInputElement>(null);

  const [specialtyId, setSpecialtyId] = useState('');
  const [effectiveStartDate, setEffectiveStartDate] = useState(getNextWeekStartIso());
  const [effectiveEndDate, setEffectiveEndDate] = useState('');
  const [status, setStatus] = useState<TemplateStatus>('active');
  const [note, setNote] = useState('');
  const [doctorKeyword, setDoctorKeyword] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const [assignments, setAssignments] = useState<Record<string, number | null>>({});
  const [activeDoctor, setActiveDoctor] = useState<number | null>(null);
  const [activeDoctorDragData, setActiveDoctorDragData] = useState<DoctorDragData | null>(null);
  const [activeDoctorWidth, setActiveDoctorWidth] = useState<number | null>(null);
  const [hoveredSlotKey, setHoveredSlotKey] = useState<string | null>(null);

  const { data: options } = useQuery({
    queryKey: ['admin-schedule-workflow-options'],
    queryFn: adminScheduleWorkflowApi.getOptions,
  });

  const { data: latestTemplates } = useQuery({
    queryKey: ['admin-template-builder-latest-page', specialtyId],
    enabled: Boolean(specialtyId),
    queryFn: () =>
      adminScheduleWorkflowApi.getTemplates({
        specialtyId: Number(specialtyId),
        status: 'active',
        page: 1,
        limit: 200,
      }),
  });

  const filteredDoctors = useMemo(() => {
    if (!specialtyId) return [];
    const doctors = (options?.doctors ?? []).filter((doctor) => doctor.CK_MA === Number(specialtyId));
    const keyword = doctorKeyword.trim().toLowerCase();
    if (!keyword) return doctors;
    return doctors.filter(
      (doctor) =>
        doctor.BS_HO_TEN.toLowerCase().includes(keyword) || String(doctor.BS_MA).includes(keyword),
    );
  }, [doctorKeyword, options?.doctors, specialtyId]);

  const filteredRooms = useMemo(() => {
    if (!specialtyId) return [];
    return (options?.rooms ?? []).filter((room) => room.CK_MA === Number(specialtyId));
  }, [options?.rooms, specialtyId]);

  const sessions = useMemo(() => {
    const all = options?.sessions ?? [];
    const morning = all.find((session) => getSessionLabel(session.B_TEN).toLowerCase().includes('sáng'));
    const afternoon = all.find((session) => getSessionLabel(session.B_TEN).toLowerCase().includes('chiều'));
    const primary = [morning, afternoon].filter(
      (
        session,
      ): session is {
        B_TEN: string;
        B_GIO_BAT_DAU: string | null;
        B_GIO_KET_THUC: string | null;
      } => Boolean(session),
    );
    if (primary.length > 0) return primary;
    return all.slice(0, 2);
  }, [options?.sessions]);

  const slots = useMemo(() => {
    const output: BuilderSlot[] = [];
    TEMPLATE_WEEKDAYS.forEach((weekday) => {
      sessions.forEach((session) => {
        filteredRooms.forEach((room) => {
          output.push({
            key: slotKey(weekday, session.B_TEN, room.P_MA),
            weekday,
            session: session.B_TEN,
            roomId: room.P_MA,
          });
        });
      });
    });
    return output;
  }, [filteredRooms, sessions]);

  const slotMap = useMemo(() => {
    const map = new Map<string, BuilderSlot>();
    slots.forEach((slot) => map.set(slot.key, slot));
    return map;
  }, [slots]);

  const doctorNameById = useMemo(
    () =>
      new Map(
        (options?.doctors ?? [])
          .filter((doctor) => doctor.CK_MA === Number(specialtyId))
          .map((doctor) => [doctor.BS_MA, doctor.BS_HO_TEN] as const),
      ),
    [options?.doctors, specialtyId],
  );

  const roomNameById = useMemo(
    () => new Map(filteredRooms.map((room) => [room.P_MA, room.P_TEN] as const)),
    [filteredRooms],
  );

  const assignedCountByDoctor = useMemo(() => {
    const map = new Map<number, number>();
    Object.values(assignments).forEach((doctorId) => {
      if (!doctorId) return;
      map.set(doctorId, (map.get(doctorId) ?? 0) + 1);
    });
    return map;
  }, [assignments]);

  const conflicts = useMemo(() => {
    const byDoctorAndShift = new Map<string, string[]>();
    Object.entries(assignments).forEach(([key, doctorId]) => {
      if (!doctorId) return;
      const slot = slotMap.get(key);
      if (!slot) return;
      const pair = `${slot.weekday}__${slot.session}__${doctorId}`;
      byDoctorAndShift.set(pair, [...(byDoctorAndShift.get(pair) ?? []), key]);
    });
    const output = new Set<string>();
    byDoctorAndShift.forEach((keys) => {
      if (keys.length <= 1) return;
      keys.forEach((key) => output.add(key));
    });
    return output;
  }, [assignments, slotMap]);

  const summary = useMemo(() => {
    const total = slots.length;
    const assigned = Object.values(assignments).filter(Boolean).length;
    return {
      doctors: filteredDoctors.length,
      total,
      assigned,
      empty: Math.max(total - assigned, 0),
      conflicts: conflicts.size,
      weekLabel: 'Thứ 2 - Thứ 7',
    };
  }, [assignments, conflicts.size, filteredDoctors.length, slots.length]);

  const selectedSpecialty = useMemo(
    () => (options?.specialties ?? []).find((item) => item.CK_MA === Number(specialtyId)) ?? null,
    [options?.specialties, specialtyId],
  );

  const validateDrop = (slot: BuilderSlot | undefined, doctorId: number): { ok: boolean; reason?: string } => {
    if (!slot) return { ok: false, reason: 'Không tìm thấy slot cần gán.' };
    if (!specialtyId) return { ok: false, reason: 'Vui lòng chọn chuyên khoa trước.' };
    const doctor = (options?.doctors ?? []).find((item) => item.BS_MA === doctorId);
    if (!doctor || doctor.CK_MA !== Number(specialtyId)) {
      return { ok: false, reason: 'Bác sĩ không thuộc chuyên khoa đã chọn.' };
    }
    const duplicate = Object.entries(assignments).find(([key, currentDoctorId]) => {
      if (key === slot.key || currentDoctorId !== doctorId) return false;
      const assignedSlot = slotMap.get(key);
      return assignedSlot?.weekday === slot.weekday && assignedSlot?.session === slot.session;
    });
    if (duplicate) {
      return { ok: false, reason: 'Bác sĩ đã được gán ở phòng khác trong cùng thứ và buổi.' };
    }
    return { ok: true };
  };

  const saveReason = useMemo(() => {
    if (!specialtyId) return 'Vui lòng chọn chuyên khoa để bắt đầu tạo mẫu.';
    if (!effectiveStartDate) return 'Vui lòng chọn ngày bắt đầu hiệu lực.';
    if (slots.length === 0) return 'Không có phòng hoặc buổi phù hợp để tạo timetable mẫu.';
    if (summary.assigned === 0) return 'Vui lòng kéo thả ít nhất một bác sĩ vào timetable mẫu.';
    if (summary.conflicts > 0) return 'Mẫu đang có xung đột bác sĩ trùng ca.';
    return null;
  }, [effectiveStartDate, slots.length, specialtyId, summary.assigned, summary.conflicts]);

  const resetAssignments = () => {
    setAssignments({});
    toast.success('Đã đặt lại mẫu tuần.');
  };

  const copyDay = (sourceDay: number, targetDays: number[]) => {
    setAssignments((prev) => {
      const next = { ...prev };
      const sourceSlots = slots.filter((slot) => slot.weekday === sourceDay);
      sourceSlots.forEach((sourceSlot) => {
        const doctorId = prev[sourceSlot.key];
        if (!doctorId) return;
        targetDays.forEach((targetDay) => {
          const targetKey = slotKey(targetDay, sourceSlot.session, sourceSlot.roomId);
          const targetSlot = slotMap.get(targetKey);
          const check = validateDrop(targetSlot, doctorId);
          if (check.ok) next[targetKey] = doctorId;
        });
      });
      return next;
    });
    toast.success(`Đã sao chép pattern từ ${getWeekdayLabel(sourceDay)}.`);
  };

  const clearByWeekday = (weekday: number) => {
    setAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (slotMap.get(key)?.weekday === weekday) next[key] = null;
      });
      return next;
    });
  };

  const clearBySession = (session: string) => {
    setAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (slotMap.get(key)?.session === session) next[key] = null;
      });
      return next;
    });
  };

  const applyLatestTemplate = () => {
    const items = latestTemplates?.items ?? [];
    if (items.length === 0) {
      toast.error('Chưa có mẫu đang hoạt động gần nhất để tải.');
      return;
    }
    const next: Record<string, number | null> = {};
    items.forEach((item) => {
      const key = slotKey(item.weekday, item.B_TEN, item.P_MA);
      if (!slotMap.has(key)) return;
      next[key] = item.BS_MA;
    });
    setAssignments(next);
    toast.success('Đã tải pattern từ mẫu gần nhất.');
  };

  const removeDoctorFromSlot = (slotKeyValue: string) => {
    setAssignments((prev) => ({ ...prev, [slotKeyValue]: null }));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (saveReason) throw new Error(saveReason);
      const records = Object.entries(assignments)
        .filter(([, doctorId]) => Boolean(doctorId))
        .map(([key, doctorId]) => {
          const slot = slotMap.get(key)!;
          return {
            BS_MA: Number(doctorId),
            CK_MA: Number(specialtyId),
            P_MA: slot.roomId,
            B_TEN: slot.session,
            weekday: slot.weekday,
            effectiveStartDate,
            effectiveEndDate: effectiveEndDate || null,
            status,
            note: note || undefined,
          };
        });
      const results = await Promise.allSettled(
        records.map((payload) => adminScheduleWorkflowApi.createTemplate(payload)),
      );
      const successCount = results.filter((item) => item.status === 'fulfilled').length;
      const failCount = results.length - successCount;
      if (successCount === 0) {
        const firstRejected = results.find((item) => item.status === 'rejected');
        throw new Error(
          (firstRejected as PromiseRejectedResult | undefined)?.reason?.response?.data?.message ||
            'Không thể lưu mẫu lịch.',
        );
      }
      return { successCount, failCount };
    },
    onSuccess: ({ successCount, failCount }) => {
      toast.success(
        failCount > 0
          ? `Đã lưu ${successCount} mẫu, ${failCount} mẫu chưa lưu được.`
          : `Đã lưu ${successCount} mẫu lịch.`,
      );
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-templates'] });
      queryClient.invalidateQueries({ queryKey: ['admin-schedule-workflow-overview'] });
      navigate('/admin/schedules');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, 'Không thể lưu mẫu lịch.'));
    },
  });

  const onDragStart = (event: DragStartEvent) => {
    const dragData = event.active.data.current as DoctorDragData | undefined;
    if (!dragData || dragData.type !== 'doctor') return;
    setActiveDoctor(dragData.doctorId);
    setActiveDoctorDragData(dragData);
    setActiveDoctorWidth(event.active.rect.current.initial?.width ?? null);
  };

  const onDragOver = (event: DragOverEvent) => {
    const dropData = event.over?.data.current as SlotDropData | undefined;
    if (!dropData || dropData.type !== 'slot') {
      setHoveredSlotKey(null);
      return;
    }
    setHoveredSlotKey(dropData.slotKey);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setHoveredSlotKey(null);
    setActiveDoctor(null);
    setActiveDoctorDragData(null);

    const dragData = event.active.data.current as DoctorDragData | undefined;
    const dropData = event.over?.data.current as SlotDropData | undefined;
    if (!dragData || dragData.type !== 'doctor') return;
    if (!dropData || dropData.type !== 'slot') return;

    const targetSlot = slotMap.get(dropData.slotKey);
    const check = validateDrop(targetSlot, dragData.doctorId);
    if (!check.ok) {
      toast.error(check.reason || 'Không thể thả vào slot này.');
      return;
    }

    const currentDoctorId = assignments[dropData.slotKey];
    if (currentDoctorId && currentDoctorId !== dragData.doctorId) {
      const ok = window.confirm('Slot này đã có bác sĩ. Bạn có muốn ghi đè không?');
      if (!ok) return;
    }

    setAssignments((prev) => ({ ...prev, [dropData.slotKey]: dragData.doctorId }));
    toast.success(`Đã gán ${dragData.doctorName} vào slot mẫu.`);
  };

  const onDragCancel = () => {
    setHoveredSlotKey(null);
    setActiveDoctor(null);
    setActiveDoctorDragData(null);
  };

  const openStartPicker = () => {
    const input = startPickerRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') return input.showPicker();
    input.focus();
  };

  const openEndPicker = () => {
    const input = endPickerRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') return input.showPicker();
    input.focus();
  };

  return (
    <div className="space-y-5 pb-28">
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tạo mẫu lịch tuần</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tạo mẫu lịch tuần chuẩn để hệ thống sinh lịch trực dài hạn.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/schedules')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Button>
          <Button variant="outline" onClick={() => setPreviewOpen((prev) => !prev)}>
            {previewOpen ? 'Ẩn xem trước' : 'Xem trước'}
          </Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || Boolean(saveReason)}>
            {createMutation.isPending ? 'Đang lưu...' : 'Lưu mẫu lịch'}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Chuyên khoa</label>
            <AdminSelect
              value={specialtyId}
              onValueChange={(value) => {
                setSpecialtyId(value);
                setAssignments({});
              }}
            >
              <AdminSelectTrigger>
                <AdminSelectValue placeholder="Chọn chuyên khoa" />
              </AdminSelectTrigger>
              <AdminSelectContent>
                {(options?.specialties ?? []).map((specialty) => (
                  <AdminSelectItem key={specialty.CK_MA} value={String(specialty.CK_MA)}>
                    {specialty.CK_TEN}
                  </AdminSelectItem>
                ))}
              </AdminSelectContent>
            </AdminSelect>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Từ ngày</label>
            <div className="relative">
              <Input
                type="text"
                readOnly
                value={effectiveStartDate ? formatDateDdMmYyyySlash(effectiveStartDate) : ''}
                onClick={openStartPicker}
                className="cursor-pointer"
                placeholder="dd/MM/yyyy"
              />
              <input
                ref={startPickerRef}
                type="date"
                value={effectiveStartDate}
                onChange={(e) => setEffectiveStartDate(e.target.value)}
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Đến ngày</label>
            <div className="relative">
              <Input
                type="text"
                readOnly
                value={effectiveEndDate ? formatDateDdMmYyyySlash(effectiveEndDate) : ''}
                onClick={openEndPicker}
                className="cursor-pointer"
                placeholder="dd/MM/yyyy"
              />
              <input
                ref={endPickerRef}
                type="date"
                value={effectiveEndDate}
                onChange={(e) => setEffectiveEndDate(e.target.value)}
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Trạng thái</label>
            <AdminSelect value={status} onValueChange={(value) => setStatus(value as TemplateStatus)}>
              <AdminSelectTrigger>
                <AdminSelectValue />
              </AdminSelectTrigger>
              <AdminSelectContent>
                <AdminSelectItem value="active">Đang hoạt động</AdminSelectItem>
                <AdminSelectItem value="inactive">Tạm dừng</AdminSelectItem>
              </AdminSelectContent>
            </AdminSelect>
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ghi chú</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú cho mẫu lịch" />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm">
        <div className="flex flex-wrap gap-2">
          <span className="rounded bg-white px-2 py-1">Số bác sĩ: {summary.doctors}</span>
          <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Đã gán: {summary.assigned}</span>
          <span className="rounded bg-slate-100 px-2 py-1">Còn trống: {summary.empty}</span>
          <span className="rounded bg-rose-50 px-2 py-1 text-rose-700">Trùng: {summary.conflicts}</span>
          <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">Tuần mẫu: {summary.weekLabel}</span>
        </div>
      </section>

      {previewOpen ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm">
          <p className="font-semibold">Xem trước trước khi lưu</p>
          <p className="mt-1">
            {selectedSpecialty?.CK_TEN || 'Chưa chọn chuyên khoa'} | Hiệu lực:{' '}
            {effectiveStartDate ? formatDateDdMmYyyySlash(effectiveStartDate) : '--'} đến{' '}
            {effectiveEndDate ? formatDateDdMmYyyySlash(effectiveEndDate) : 'Không giới hạn'}
          </p>
          <p className="mt-1">
            Tổng slot {summary.total}, đã gán {summary.assigned}, còn trống {summary.empty}, trùng {summary.conflicts}.
          </p>
        </section>
      ) : null}

      {!specialtyId ? (
        <EmptyCard
          title="Chọn chuyên khoa để bắt đầu tạo mẫu lịch tuần"
          description="Danh sách bác sĩ, phòng và timetable sẽ hiển thị sau khi chọn chuyên khoa."
        />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
            <div className="space-y-4">
              <section className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9"
                    value={doctorKeyword}
                    onChange={(event) => setDoctorKeyword(event.target.value)}
                    placeholder="Tìm bác sĩ"
                  />
                </div>

                {filteredDoctors.length === 0 ? (
                  <EmptyCard
                    title="Không có bác sĩ phù hợp"
                    description="Không tìm thấy bác sĩ theo chuyên khoa hoặc từ khóa đang chọn."
                  />
                ) : (
                  <div className="max-h-[58vh] space-y-2 overflow-auto pr-1">
                    {filteredDoctors.map((doctor) => (
                      <CompactDoctorCard
                        key={doctor.BS_MA}
                        id={doctor.BS_MA}
                        specialtyId={doctor.CK_MA}
                        name={doctor.BS_HO_TEN}
                        specialtyName={doctor.CHUYEN_KHOA.CK_TEN}
                        assignedCount={assignedCountByDoctor.get(doctor.BS_MA) ?? 0}
                        active={activeDoctor === doctor.BS_MA}
                        disabled={false}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-xl border bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">Sao chép mẫu</h3>
                <div className="mt-2 grid gap-2">
                  <Button variant="outline" onClick={() => copyDay(1, [3, 5])}>
                    Sao chép Thứ 2 sang Thứ 4, 6
                  </Button>
                  <Button variant="outline" onClick={() => copyDay(2, [4, 6])}>
                    Sao chép Thứ 3 sang Thứ 5, 7
                  </Button>
                  <Button variant="outline" onClick={() => copyDay(1, [2, 3, 4, 5, 6])}>
                    <Copy className="mr-2 h-4 w-4" />
                    Sao chép cả tuần
                  </Button>
                </div>

                <h3 className="mt-4 text-sm font-semibold text-slate-900">Dọn dữ liệu</h3>
                <div className="mt-2 grid gap-2">
                  <AdminSelect onValueChange={(value) => clearByWeekday(Number(value))}>
                    <AdminSelectTrigger>
                      <AdminSelectValue placeholder="Xóa theo ngày" />
                    </AdminSelectTrigger>
                    <AdminSelectContent>
                      {TEMPLATE_WEEKDAYS.map((weekday) => (
                        <AdminSelectItem key={weekday} value={String(weekday)}>
                          {getWeekdayLabel(weekday)}
                        </AdminSelectItem>
                      ))}
                    </AdminSelectContent>
                  </AdminSelect>

                  <AdminSelect onValueChange={clearBySession}>
                    <AdminSelectTrigger>
                      <AdminSelectValue placeholder="Xóa theo buổi" />
                    </AdminSelectTrigger>
                    <AdminSelectContent>
                      {sessions.map((session) => (
                        <AdminSelectItem key={session.B_TEN} value={session.B_TEN}>
                          {getSessionLabel(session.B_TEN)}
                        </AdminSelectItem>
                      ))}
                    </AdminSelectContent>
                  </AdminSelect>

                  <Button variant="outline" className="border-rose-200 text-rose-700" onClick={resetAssignments}>
                    <Eraser className="mr-2 h-4 w-4" />
                    Đặt lại toàn bộ
                  </Button>
                </div>

                <h3 className="mt-4 text-sm font-semibold text-slate-900">Gợi ý</h3>
                <div className="mt-2 grid gap-2">
                  <Button variant="outline" onClick={applyLatestTemplate}>
                    Tải mẫu gần nhất
                  </Button>
                </div>
              </section>
            </div>

            <section className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Mini timetable tuần mẫu</h2>
                  <p className="text-xs text-slate-500">Thứ 2 đến Thứ 7, theo buổi và phòng</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-slate-700">Trống</span>
                  <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-700">Đã có mẫu</span>
                  <span className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-rose-700">Trùng</span>
                </div>
              </div>

              {filteredRooms.length === 0 ? (
                <EmptyCard
                  title="Không có phòng phù hợp"
                  description="Kiểm tra cấu hình phòng thuộc chuyên khoa đã chọn."
                />
              ) : sessions.length === 0 ? (
                <EmptyCard title="Không có buổi khám" description="Cần cấu hình buổi khám trước khi tạo mẫu." />
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-[980px] border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-20 w-[140px] border border-slate-200 bg-slate-100 p-2 text-left text-xs font-semibold text-slate-700">
                          Buổi
                        </th>
                        {TEMPLATE_WEEKDAYS.map((weekday) => (
                          <th
                            key={weekday}
                            className="w-[210px] border border-slate-200 bg-slate-100 p-2 text-left text-xs font-semibold text-slate-700"
                          >
                            {getWeekdayLabel(weekday)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((session) => (
                        <tr key={session.B_TEN}>
                          <td className="sticky left-0 z-10 border border-slate-200 bg-white p-2 align-top">
                            <div className="text-sm font-semibold text-slate-700">{getSessionLabel(session.B_TEN)}</div>
                          </td>
                          {TEMPLATE_WEEKDAYS.map((weekday) => (
                            <td key={`${session.B_TEN}-${weekday}`} className="border border-slate-200 bg-white p-2 align-top">
                              <div className="space-y-2">
                                {filteredRooms.map((room) => {
                                  const key = slotKey(weekday, session.B_TEN, room.P_MA);
                                  const current = slotMap.get(key);
                                  if (!current) return null;
                                  const doctorId = assignments[key];
                                  const doctorName = doctorId ? doctorNameById.get(doctorId) || `BS #${doctorId}` : null;
                                  const dropCheck = activeDoctor != null ? validateDrop(current, activeDoctor) : { ok: true };
                                  return (
                                    <TemplateSlotCard
                                      key={key}
                                      slot={current}
                                      roomName={roomNameById.get(room.P_MA) || `Phòng ${room.P_MA}`}
                                      doctorName={doctorName}
                                      hasConflict={conflicts.has(key)}
                                      canDrop={dropCheck.ok}
                                      dropReason={dropCheck.reason}
                                      dragging={activeDoctor != null}
                                      onRemoveDoctor={removeDoctorFromSlot}
                                    />
                                  );
                                })}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <DragOverlay zIndex={1200}>
            {activeDoctor && activeDoctorDragData ? (
              <div
                className={cn(
                  'rounded-lg border border-blue-300 bg-white p-3 text-sm shadow-xl ring-1 ring-blue-200',
                  hoveredSlotKey && 'border-blue-500',
                )}
                style={activeDoctorWidth ? { width: activeDoctorWidth } : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-slate-900">
                    {activeDoctorDragData.doctorName || `BS #${activeDoctor}`}
                  </div>
                  <GripVertical className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-1 text-xs text-slate-500">{activeDoctorDragData.specialtyName}</div>
                <div className="mt-2 inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {activeDoctorDragData.assignedCount} slot mẫu
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <section className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded bg-slate-100 px-2 py-1">Đã gán {summary.assigned}/{summary.total} slot</span>
            <span className="rounded bg-slate-100 px-2 py-1">Còn trống {summary.empty}</span>
            <span className="rounded bg-rose-50 px-2 py-1 text-rose-700">Trùng {summary.conflicts}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/schedules')}>
              Hủy / Quay lại
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen((prev) => !prev)}>
              {previewOpen ? 'Ẩn xem trước' : 'Xem trước'}
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || Boolean(saveReason)}>
              {createMutation.isPending ? 'Đang lưu...' : 'Lưu mẫu lịch'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
