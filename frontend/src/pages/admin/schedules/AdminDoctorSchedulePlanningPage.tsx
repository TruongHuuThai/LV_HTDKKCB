import { useEffect, useMemo, useRef, useState } from 'react';
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
import { addDays, format, isAfter, parseISO, startOfWeek } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eraser,
  GripVertical,
  Save,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  UserMinus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  adminScheduleWorkflowApi,
  type ScheduleCopyWeekResponse,
  type ScheduleCopyConflictMode,
  type ScheduleCopyRangeOption,
  type SchedulePlanningAssignment,
  type SchedulePlanningOverwriteMode,
  type ScheduleRestoreArchivedResponse,
  type WeeklyScheduleStatus,
} from '@/services/api/scheduleWorkflowApi';
import { adminApi } from '@/services/api/adminApi';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatDateDdMmYyyySlash, getSessionLabel } from '@/lib/scheduleDisplay';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AdminSelect,
  AdminSelectContent,
  AdminSelectItem,
  AdminSelectTrigger,
  AdminSelectValue,
} from '@/components/admin/AdminSelect';

type Slot = {
  key: string;
  date: string;
  session: string;
  roomId: number;
  doctorId: number | null;
  status: WeeklyScheduleStatus | null;
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
  date: string;
  session: string;
  roomId: number;
  specialtyId: number | null;
  status: WeeklyScheduleStatus | null;
};

type DropCheckResult = { ok: boolean; reason?: string };
type SlotVisualState =
  | 'empty'
  | 'new_assignment'
  | 'existing_assignment'
  | 'replacement'
  | 'conflict'
  | 'booked_patient';

const toMonday = (dateIso?: string) =>
  format(startOfWeek(dateIso ? parseISO(dateIso) : new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

const weekRange = (weekStart: string) => ({
  dateFrom: weekStart,
  dateTo: format(addDays(parseISO(weekStart), 5), 'yyyy-MM-dd'),
});

const workingWeekBounds = (dateIso: string) => {
  const monday = startOfWeek(parseISO(dateIso), { weekStartsOn: 1 });
  return {
    monday: format(monday, 'yyyy-MM-dd'),
    saturday: format(addDays(monday, 5), 'yyyy-MM-dd'),
  };
};

const isSameWorkingWeek = (dateA: string, dateB: string) =>
  workingWeekBounds(dateA).monday === workingWeekBounds(dateB).monday;

const rangeDates = (dateFrom: string, dateTo: string) => {
  if (!dateFrom || !dateTo) return [] as string[];
  const start = parseISO(dateFrom);
  const end = parseISO(dateTo);
  if (isAfter(start, end)) return [];

  const output: string[] = [];
  for (let cursor = start; !isAfter(cursor, end); cursor = addDays(cursor, 1)) {
    if (cursor.getDay() !== 0) {
      output.push(format(cursor, 'yyyy-MM-dd'));
    }
  }
  return output;
};

const slotKey = (date: string, session: string, roomId: number) => `${date}__${session}__${roomId}`;

const isBookedStatus = (status: WeeklyScheduleStatus | null) =>
  status === 'confirmed' || status === 'finalized' || status === 'adjusted' || status === 'change_requested';

const weekdayLabel = (dateIso: string) => {
  const day = new Date(`${dateIso}T00:00:00`).getDay();
  switch (day) {
    case 1:
      return 'Thứ 2';
    case 2:
      return 'Thứ 3';
    case 3:
      return 'Thứ 4';
    case 4:
      return 'Thứ 5';
    case 5:
      return 'Thứ 6';
    case 6:
      return 'Thứ 7';
    default:
      return 'Chủ nhật';
  }
};

const SLOT_VISUAL_META: Record<
  SlotVisualState,
  { label: string; cellClass: string; badgeClass: string; legendClass: string }
> = {
  empty: {
    label: 'Trống',
    cellClass: 'border-slate-300 border-dashed bg-slate-50',
    badgeClass: 'bg-slate-100 text-slate-700',
    legendClass: 'border-slate-300 bg-slate-50 text-slate-700',
  },
  new_assignment: {
    label: 'Mới phân công',
    cellClass: 'border-emerald-300 bg-emerald-50',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    legendClass: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  },
  existing_assignment: {
    label: 'Lịch đã chốt',
    cellClass: 'border-blue-300 bg-blue-50',
    badgeClass: 'bg-blue-100 text-blue-800',
    legendClass: 'border-blue-300 bg-blue-50 text-blue-700',
  },
  replacement: {
    label: 'Cần thay thế',
    cellClass: 'border-amber-300 bg-amber-50',
    badgeClass: 'bg-amber-100 text-amber-800',
    legendClass: 'border-amber-300 bg-amber-50 text-amber-700',
  },
  conflict: {
    label: 'Xung đột',
    cellClass: 'border-rose-300 bg-rose-50',
    badgeClass: 'bg-rose-100 text-rose-800',
    legendClass: 'border-rose-300 bg-rose-50 text-rose-700',
  },
  booked_patient: {
    label: 'Đã có lịch bệnh nhân',
    cellClass: 'border-indigo-300 bg-indigo-50',
    badgeClass: 'bg-indigo-100 text-indigo-800',
    legendClass: 'border-indigo-300 bg-indigo-50 text-indigo-700',
  },
};

const SLOT_LEGEND_ORDER: SlotVisualState[] = [
  'empty',
  'new_assignment',
  'existing_assignment',
  'replacement',
  'conflict',
  'booked_patient',
];

function resolveSlotVisualState({
  slot,
  conflict,
  baselineDoctorId,
}: {
  slot: Slot;
  conflict: boolean;
  baselineDoctorId: number | null;
}): SlotVisualState {
  const replacementNeeded = slot.status === 'vacant_by_leave' || slot.status === 'cancelled_by_doctor_leave';
  const booked = isBookedStatus(slot.status);
  const isAssigned = slot.doctorId !== null;
  const isExistingAssignment =
    isAssigned && baselineDoctorId !== null && baselineDoctorId === slot.doctorId;
  const isNewAssignment = isAssigned && !isExistingAssignment;

  if (conflict) return 'conflict';
  if (replacementNeeded) return 'replacement';
  if (booked) return 'booked_patient';
  if (isNewAssignment) return 'new_assignment';
  if (isExistingAssignment) return 'existing_assignment';
  return 'empty';
}

function EmptyCard({ title, description }: { title: string; description: string }) {
  return (
    <div className='rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center'>
      <p className='text-sm font-medium text-slate-700'>{title}</p>
      <p className='mt-2 text-xs text-slate-500'>{description}</p>
    </div>
  );
}

function DoctorCard({
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
    id: `doctor-${id}`,
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
      <div className='flex items-start justify-between gap-2'>
        <div className='font-medium text-slate-900'>{name}</div>
        <GripVertical className='h-4 w-4 text-slate-400' />
      </div>
      <div className='mt-1 text-xs text-slate-500'>{specialtyName}</div>
      <div className='mt-2 inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700'>
        {assignedCount} ca trực
      </div>
    </div>
  );
}

function PlanningCell({
  slot,
  roomName,
  doctorName,
  baselineDoctorId,
  conflict,
  disabled,
  canDropWhenDragging,
  specialtyId,
  onRemoveDoctor,
  dropReason,
  dragging,
}: {
  slot: Slot;
  roomName: string;
  doctorName: string | null;
  baselineDoctorId: number | null;
  conflict: boolean;
  disabled: boolean;
  canDropWhenDragging: boolean;
  specialtyId: number | null;
  onRemoveDoctor: (slotKeyValue: string) => void;
  dropReason?: string;
  dragging: boolean;
}) {
  const blockedByLeave = slot.status === 'cancelled_by_doctor_leave';
  const assigned = slot.doctorId !== null;
  const visualState = resolveSlotVisualState({ slot, conflict, baselineDoctorId });
  const visualMeta = SLOT_VISUAL_META[visualState];

  const { setNodeRef, isOver } = useDroppable({
    id: slot.key,
    disabled: disabled || blockedByLeave,
    data: {
      type: 'slot',
      slotKey: slot.key,
      date: slot.date,
      session: slot.session,
      roomId: slot.roomId,
      specialtyId,
      status: slot.status,
    } satisfies SlotDropData,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-md border p-2 transition-all',
        visualMeta.cellClass,
        blockedByLeave && 'opacity-70',
        dragging && !blockedByLeave && canDropWhenDragging && 'border-blue-300 bg-blue-50/70',
        dragging && !blockedByLeave && !canDropWhenDragging && 'border-rose-300 bg-rose-50/70',
        isOver &&
          !blockedByLeave &&
          canDropWhenDragging &&
          'scale-[1.01] border-blue-500 bg-blue-100 ring-2 ring-blue-500 shadow-sm',
        isOver &&
          !blockedByLeave &&
          !canDropWhenDragging &&
          'border-rose-500 bg-rose-100 ring-2 ring-rose-500',
      )}
    >
      <div className='text-[11px] text-slate-500'>{roomName}</div>
      <div className='mt-1 flex items-center justify-between gap-2'>
        <div className='text-sm font-medium text-slate-900'>{doctorName || 'Kéo bác sĩ vào đây'}</div>
        {assigned && !blockedByLeave ? (
          <button
            type='button'
            className='rounded p-1 text-slate-500 hover:bg-white hover:text-rose-600'
            onClick={() => onRemoveDoctor(slot.key)}
            title='Gỡ bác sĩ khỏi ô'
          >
            <UserMinus className='h-3.5 w-3.5' />
          </button>
        ) : null}
      </div>
      <div
        className={cn(
          'mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
          visualMeta.badgeClass,
        )}
      >
        {visualMeta.label}
      </div>
      {dragging && !blockedByLeave ? (
        <div
          className={cn(
            'mt-1 text-[10px] font-medium',
            canDropWhenDragging ? 'text-blue-700' : 'text-rose-700',
          )}
        >
          {canDropWhenDragging ? 'Có thể thả vào ô này' : dropReason || 'Không thể thả vào ô này'}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminDoctorSchedulePlanningPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const dateFromPickerRef = useRef<HTMLInputElement>(null);
  const dateToPickerRef = useRef<HTMLInputElement>(null);

  const [range, setRange] = useState(weekRange(toMonday()));
  const [specialtyId, setSpecialtyId] = useState('');
  const [sessionView, setSessionView] = useState('all');
  const [search, setSearch] = useState('');
  const [activeDoctor, setActiveDoctor] = useState<number | null>(null);
  const [activeDoctorDragData, setActiveDoctorDragData] = useState<DoctorDragData | null>(null);
  const [activeDoctorWidth, setActiveDoctorWidth] = useState<number | null>(null);
  const [hoveredSlotKey, setHoveredSlotKey] = useState<string | null>(null);

  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [baseSlots, setBaseSlots] = useState<Record<string, Slot>>({});
  const [overwriteMode, setOverwriteMode] = useState<SchedulePlanningOverwriteMode>('overwrite');

  const [previewOpen, setPreviewOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyRange, setCopyRange] = useState<ScheduleCopyRangeOption>('ONE_MONTH');
  const [copyMode, setCopyMode] = useState<ScheduleCopyConflictMode>('SKIP_EXISTING');
  const [copyPreview, setCopyPreview] = useState<ScheduleCopyWeekResponse | null>(null);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [restoreArchivedOpen, setRestoreArchivedOpen] = useState(false);
  const [restoreArchivedPreview, setRestoreArchivedPreview] =
    useState<ScheduleRestoreArchivedResponse | null>(null);

  const hasDateRange = !!range.dateFrom && !!range.dateTo;
  const isDateRangeValid = hasDateRange && !isAfter(parseISO(range.dateFrom), parseISO(range.dateTo));
  const hasSpecialty = specialtyId !== '';
  const isFilterReady = hasSpecialty && isDateRangeValid;
  const boardDates = useMemo(() => rangeDates(range.dateFrom, range.dateTo), [range.dateFrom, range.dateTo]);

  const hasSundayInRange = useMemo(() => {
    if (!hasDateRange || !isDateRangeValid) return false;
    const start = parseISO(range.dateFrom);
    const end = parseISO(range.dateTo);
    for (let cursor = start; !isAfter(cursor, end); cursor = addDays(cursor, 1)) {
      if (cursor.getDay() === 0) return true;
    }
    return false;
  }, [hasDateRange, isDateRangeValid, range.dateFrom, range.dateTo]);

  const warning = useMemo(() => {
    if (!range.dateFrom && !range.dateTo) return 'Vui lòng chọn Từ ngày và Đến ngày.';
    if (!range.dateFrom) return 'Vui lòng chọn Từ ngày.';
    if (!range.dateTo) return 'Vui lòng chọn Đến ngày.';
    if (!isDateRangeValid) return 'Đến ngày phải lớn hơn hoặc bằng Từ ngày.';
    if (!hasSpecialty) return 'Vui lòng chọn Chuyên khoa để tải dữ liệu phân công.';
    return '';
  }, [hasSpecialty, isDateRangeValid, range.dateFrom, range.dateTo]);

  const sundayNotice = useMemo(() => {
    if (!hasDateRange || !isDateRangeValid) return '';
    if (boardDates.length === 0) {
      return 'Khoảng ngày đã chọn rơi vào Chủ nhật. Hệ thống không phân công lịch trực vào Chủ nhật.';
    }
    if (hasSundayInRange) {
      return 'Hệ thống không phân công lịch trực vào Chủ nhật. Các ngày Chủ nhật sẽ tự động được bỏ qua.';
    }
    return '';
  }, [boardDates.length, hasDateRange, hasSundayInRange, isDateRangeValid]);

  const weekStart = useMemo(() => {
    if (!range.dateFrom) return toMonday();
    return toMonday(range.dateFrom);
  }, [range.dateFrom]);

  const specialtiesQuery = useQuery({
    queryKey: ['plan-specialties'],
    queryFn: () => adminApi.getSpecialties(),
  });

  const optionsQuery = useQuery({
    queryKey: ['plan-options', specialtyId],
    enabled: isFilterReady,
    queryFn: adminScheduleWorkflowApi.getOptions,
  });

  const allSessions = useMemo(() => optionsQuery.data?.sessions ?? [], [optionsQuery.data?.sessions]);
  const visibleSessions = useMemo(() => {
    if (sessionView === 'all') return allSessions;
    return allSessions.filter((session) => session.B_TEN === sessionView);
  }, [allSessions, sessionView]);

  const rooms = useMemo(() => {
    const allRooms = optionsQuery.data?.rooms ?? [];
    if (!hasSpecialty) return [];
    return allRooms.filter((room) => room.CK_MA === Number(specialtyId));
  }, [optionsQuery.data?.rooms, specialtyId, hasSpecialty]);

  const doctors = useMemo(() => {
    const allDoctors = optionsQuery.data?.doctors ?? [];
    if (!hasSpecialty) return [];

    const specialtyDoctors = allDoctors.filter((doctor) => doctor.CK_MA === Number(specialtyId));
    const keyword = search.trim().toLowerCase();
    if (!keyword) return specialtyDoctors;

    return specialtyDoctors.filter(
      (doctor) =>
        doctor.BS_HO_TEN.toLowerCase().includes(keyword) ||
        String(doctor.BS_MA).includes(keyword),
    );
  }, [optionsQuery.data?.doctors, specialtyId, search, hasSpecialty]);

  const planningQuery = useQuery({
    queryKey: ['plan-existing', range.dateFrom, range.dateTo, specialtyId],
    enabled: isFilterReady,
    queryFn: () =>
      adminScheduleWorkflowApi.getPlanningExisting({
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        specialtyId: Number(specialtyId),
      }),
  });

  useEffect(() => {
    if (!isFilterReady) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlots({});
      setBaseSlots({});
      setActiveDoctor(null);
      setActiveDoctorDragData(null);
      setActiveDoctorWidth(null);
      setHoveredSlotKey(null);
      setCopyPreview(null);
      setRestoreArchivedPreview(null);
      return;
    }

    setSlots({});
    setBaseSlots({});
  }, [isFilterReady, range.dateFrom, range.dateTo, specialtyId]);

  useEffect(() => {
    if (!planningQuery.data || !isFilterReady) return;

    const next: Record<string, Slot> = {};
    for (const date of boardDates) {
      for (const session of allSessions) {
        for (const room of rooms) {
          const k = slotKey(date, session.B_TEN, room.P_MA);
          next[k] = {
            key: k,
            date,
            session: session.B_TEN,
            roomId: room.P_MA,
            doctorId: null,
            status: null,
          };
        }
      }
    }

    for (const item of planningQuery.data.items) {
      const k = slotKey(item.N_NGAY, item.B_TEN, item.P_MA);
      if (!next[k]) continue;
      next[k] = {
        ...next[k],
        doctorId: item.BS_MA,
        status: item.status,
      };
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlots(next);
    setBaseSlots(next);
  }, [planningQuery.data, boardDates, allSessions, rooms, isFilterReady]);

  const doctorNameById = useMemo(
    () => new Map((optionsQuery.data?.doctors ?? []).map((doctor) => [doctor.BS_MA, doctor.BS_HO_TEN] as const)),
    [optionsQuery.data?.doctors],
  );

  const roomNameById = useMemo(
    () => new Map((optionsQuery.data?.rooms ?? []).map((room) => [room.P_MA, room.P_TEN] as const)),
    [optionsQuery.data?.rooms],
  );

  const doctorSpecialtyById = useMemo(
    () => new Map((optionsQuery.data?.doctors ?? []).map((doctor) => [doctor.BS_MA, doctor.CK_MA] as const)),
    [optionsQuery.data?.doctors],
  );

  const conflicts = useMemo(() => {
    const byDoctorAndSession = new Map<string, string[]>();

    Object.values(slots).forEach((slot) => {
      if (!slot.doctorId) return;
      const k = `${slot.date}__${slot.session}__${slot.doctorId}`;
      byDoctorAndSession.set(k, [...(byDoctorAndSession.get(k) ?? []), slot.key]);
    });

    const output = new Set<string>();
    byDoctorAndSession.forEach((keys) => {
      if (keys.length <= 1) return;
      keys.forEach((item) => output.add(item));
    });

    return output;
  }, [slots]);

  const assignedByDoctor = useMemo(() => {
    const map = new Map<number, number>();
    Object.values(slots).forEach((slot) => {
      if (!slot.doctorId) return;
      map.set(slot.doctorId, (map.get(slot.doctorId) ?? 0) + 1);
    });
    return map;
  }, [slots]);

  const assignments = useMemo<SchedulePlanningAssignment[]>(
    () =>
      Object.values(slots)
        .filter((slot) => slot.doctorId != null)
        .map((slot) => ({
          date: slot.date,
          session: slot.session,
          roomId: slot.roomId,
          doctorId: slot.doctorId!,
        })),
    [slots],
  );

  const summary = useMemo(() => {
    const allSlots = Object.values(slots);
    let willCreate = 0;
    let willUpdate = 0;
    let newAssigned = 0;
    let existingAssigned = 0;

    allSlots.forEach((slot) => {
      const baseline = baseSlots[slot.key];
      if (!baseline) return;

      if (slot.doctorId) {
        if (baseline.doctorId && baseline.doctorId === slot.doctorId) {
          existingAssigned += 1;
        } else {
          newAssigned += 1;
        }
      }

      if (!baseline.doctorId && slot.doctorId) {
        willCreate += 1;
      }
      if (baseline.doctorId && slot.doctorId && baseline.doctorId !== slot.doctorId) {
        willUpdate += 1;
      }
    });

    return {
      doctors: doctors.length,
      total: allSlots.length,
      assigned: assignments.length,
      empty: allSlots.length - assignments.length,
      newAssigned,
      existingAssigned,
      conflicts: conflicts.size,
      willCreate,
      willUpdate,
    };
  }, [slots, baseSlots, doctors.length, assignments.length, conflicts.size]);

  const canUseBoard = isFilterReady && !planningQuery.isLoading && !planningQuery.isError;
  const hasPlanningData = isFilterReady && Object.keys(slots).length > 0;
  const canCreate = isFilterReady && assignments.length > 0 && conflicts.size === 0;

  const validateDrop = (targetSlot: Slot, doctorId: number): DropCheckResult => {
    if (!canUseBoard) {
      return { ok: false, reason: 'Bảng phân công đang khóa.' };
    }

    if (targetSlot.status === 'cancelled_by_doctor_leave') {
      return { ok: false, reason: 'Ca này không cho phép thay thế do bác sĩ nghỉ.' };
    }

    if (
      overwriteMode === 'only_empty' &&
      targetSlot.doctorId !== null &&
      targetSlot.doctorId !== doctorId
    ) {
      return { ok: false, reason: 'Chế độ "Chỉ ô trống" không cho ghi đè ô đã có bác sĩ.' };
    }

    if (isBookedStatus(targetSlot.status) && targetSlot.doctorId && targetSlot.doctorId !== doctorId) {
      return { ok: false, reason: 'Ca này đã có lịch bệnh nhân, không thể đổi bác sĩ trực tiếp.' };
    }

    const doctorSpecialty = doctorSpecialtyById.get(doctorId);
    if (!doctorSpecialty || doctorSpecialty !== Number(specialtyId)) {
      return { ok: false, reason: 'Bác sĩ không thuộc chuyên khoa đang chọn.' };
    }

    const duplicateSlot = Object.values(slots).find(
      (slot) =>
        slot.key !== targetSlot.key &&
        slot.date === targetSlot.date &&
        slot.session === targetSlot.session &&
        slot.doctorId === doctorId,
    );

    if (duplicateSlot) {
      return { ok: false, reason: 'Bác sĩ đã được phân công ở phòng khác trong cùng ngày và buổi.' };
    }

    return { ok: true };
  };

  const saveDraftMutation = useMutation({
    mutationFn: () =>
      adminScheduleWorkflowApi.createPlanningDraft({
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        specialtyId: Number(specialtyId),
        assignments,
      }),
    onSuccess: () => toast.success('Đã lưu nháp bảng phân công.'),
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'Không thể lưu nháp.')),
  });

  const createScheduleMutation = useMutation({
    mutationFn: () =>
      adminScheduleWorkflowApi.generatePlanningSchedules({
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        specialtyId: Number(specialtyId),
        assignments,
        overwriteMode,
        status: 'approved',
      }),
    onSuccess: (result) => {
      toast.success(`Đã tạo ${result.created}, cập nhật ${result.updated}.`);
      queryClient.invalidateQueries({ queryKey: ['plan-existing'] });
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'Không thể tạo lịch.')),
  });

  const copyWeekMutation = useMutation({
    mutationFn: (confirm: boolean) =>
      adminScheduleWorkflowApi.copyWeekToFutureMonths({
        sourceWeekStart: weekStart,
        specialtyId: Number(specialtyId),
        copyRangeOption: copyRange,
        conflictMode: copyMode,
        confirm,
      }),
    onSuccess: (result) => {
      if (result.preview) {
        setCopyPreview(result);
        return;
      }

      toast.success('Đã sao chép lịch sang các tuần sau.');
      setCopyOpen(false);
      setCopyPreview(null);
      queryClient.invalidateQueries({ queryKey: ['plan-existing'] });
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'Không thể sao chép lịch.')),
  });

  const archiveMutation = useMutation({
    mutationFn: (confirm: boolean) =>
      adminScheduleWorkflowApi.archiveSchedules({
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        specialtyId: hasSpecialty ? Number(specialtyId) : undefined,
        reason: archiveReason || undefined,
        confirm,
      }),
    onSuccess: (result) => {
      if (result.preview) {
        toast.message(`Xem trước: ${result.total}/${result.eligible} ca có thể lưu trữ.`);
        return;
      }

      toast.success(`Đã lưu trữ ${result.archivedCount ?? 0} lịch.`);
      setArchiveOpen(false);
      queryClient.invalidateQueries({ queryKey: ['plan-existing'] });
    },
    onError: (error: unknown) => toast.error(getApiErrorMessage(error, 'Không thể lưu trữ lịch.')),
  });

  const restoreArchivedMutation = useMutation({
    mutationFn: (confirm: boolean) =>
      adminScheduleWorkflowApi.restoreArchivedSchedules({
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        specialtyId: Number(specialtyId),
        confirm,
      }),
    onSuccess: (result) => {
      if (result.preview) {
        setRestoreArchivedPreview(result);
        toast.message(`Xem trước: có thể tái sử dụng ${result.eligible}/${result.totalArchived} lịch.`);
        return;
      }

      toast.success(`Đã tái sử dụng ${result.restoredCount ?? 0} lịch đã lưu trữ.`);
      setRestoreArchivedOpen(false);
      setRestoreArchivedPreview(null);
      queryClient.invalidateQueries({ queryKey: ['plan-existing'] });
    },
    onError: (error: unknown) =>
      toast.error(getApiErrorMessage(error, 'Không thể tái sử dụng lịch đã lưu trữ.')),
  });

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
  };

  const openDateFromPicker = () => openDatePicker(dateFromPickerRef.current);
  const openDateToPicker = () => openDatePicker(dateToPickerRef.current);

  const updateDateFrom = (dateFrom: string) => {
    setRange((prev) => {
      const nextDateTo = !prev.dateTo && dateFrom ? dateFrom : prev.dateTo;
      if (!dateFrom || !nextDateTo) {
        return {
          ...prev,
          dateFrom,
          dateTo: nextDateTo,
        };
      }

      const notSameWeek = !isSameWorkingWeek(dateFrom, nextDateTo);
      const fromAfterTo = isAfter(parseISO(dateFrom), parseISO(nextDateTo));
      if (notSameWeek || fromAfterTo) {
        return {
          ...prev,
          dateFrom,
          dateTo: workingWeekBounds(dateFrom).saturday,
        };
      }

      return {
        ...prev,
        dateFrom,
        dateTo: nextDateTo,
      };
    });
  };

  const updateDateTo = (dateTo: string) => {
    setRange((prev) => {
      const nextDateFrom = !prev.dateFrom && dateTo ? dateTo : prev.dateFrom;
      if (!dateTo || !nextDateFrom) {
        return {
          ...prev,
          dateTo,
          dateFrom: nextDateFrom,
        };
      }

      const notSameWeek = !isSameWorkingWeek(nextDateFrom, dateTo);
      const toBeforeFrom = isAfter(parseISO(nextDateFrom), parseISO(dateTo));
      if (notSameWeek || toBeforeFrom) {
        return {
          ...prev,
          dateTo,
          dateFrom: workingWeekBounds(dateTo).monday,
        };
      }

      return {
        ...prev,
        dateTo,
        dateFrom: nextDateFrom,
      };
    });
  };

  const shiftWeek = (direction: number) => {
    const nextWeekStart = format(addDays(parseISO(weekStart), direction * 7), 'yyyy-MM-dd');
    setRange(weekRange(nextWeekStart));
  };

  const copyDay = (sourceDay: number, targetDays: number[]) => {
    if (!hasPlanningData) return;

    const dateByDay = new Map(boardDates.map((date) => [new Date(`${date}T00:00:00`).getDay() || 7, date] as const));

    setSlots((prev) => {
      const next = { ...prev };

      Object.values(prev)
        .filter(
          (slot) =>
            (new Date(`${slot.date}T00:00:00`).getDay() || 7) === sourceDay &&
            slot.doctorId &&
            slot.status !== 'cancelled_by_doctor_leave',
        )
        .forEach((slot) => {
          targetDays.forEach((targetDay) => {
            const targetDate = dateByDay.get(targetDay);
            if (!targetDate) return;
            const targetKey = slotKey(targetDate, slot.session, slot.roomId);
            if (!next[targetKey] || next[targetKey].status === 'cancelled_by_doctor_leave') return;
            next[targetKey] = { ...next[targetKey], doctorId: slot.doctorId };
          });
        });

      return next;
    });
  };

  const resetAssignments = () => setSlots(baseSlots);

  const clearAssignmentsByDate = (date: string) => {
    setSlots((prev) => {
      const next = { ...prev };
      Object.values(next).forEach((slot) => {
        if (slot.date === date && slot.status !== 'cancelled_by_doctor_leave') {
          slot.doctorId = null;
        }
      });
      return next;
    });
  };

  const removeDoctorFromSlot = (slotKeyValue: string) => {
    setSlots((prev) => {
      const current = prev[slotKeyValue];
      if (!current || current.status === 'cancelled_by_doctor_leave') return prev;
      return {
        ...prev,
        [slotKeyValue]: {
          ...current,
          doctorId: null,
        },
      };
    });
  };

  const suggestAssignments = () => {
    if (!hasPlanningData || doctors.length === 0) return;

    let cursor = 0;
    setSlots((prev) => {
      const next = { ...prev };
      const busy = new Set<string>();

      Object.values(next).forEach((slot) => {
        if (!slot.doctorId) return;
        busy.add(`${slot.date}__${slot.session}__${slot.doctorId}`);
      });

      Object.values(next)
        .filter((slot) => !slot.doctorId && slot.status !== 'cancelled_by_doctor_leave')
        .forEach((slot) => {
          for (let i = 0; i < doctors.length; i += 1) {
            const doctor = doctors[(cursor + i) % doctors.length];
            const doctorKey = `${slot.date}__${slot.session}__${doctor.BS_MA}`;
            if (busy.has(doctorKey)) continue;

            slot.doctorId = doctor.BS_MA;
            busy.add(doctorKey);
            cursor += 1;
            break;
          }
        });

      return next;
    });

    toast.success('Đã đề xuất phân công tự động.');
  };

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DoctorDragData | undefined;
    if (!data || data.type !== 'doctor') return;
    setActiveDoctor(data.doctorId);
    setActiveDoctorDragData(data);
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
    setActiveDoctor(null);
    setActiveDoctorDragData(null);
    setActiveDoctorWidth(null);
    setHoveredSlotKey(null);

    if (!canUseBoard) return;

    const dragData = event.active.data.current as DoctorDragData | undefined;
    const dropData = event.over?.data.current as SlotDropData | undefined;

    if (!dragData || dragData.type !== 'doctor') return;
    if (!dropData || dropData.type !== 'slot') return;

    const targetSlot = slots[dropData.slotKey];
    if (!targetSlot) return;
    const dropCheck = validateDrop(targetSlot, dragData.doctorId);
    if (!dropCheck.ok) {
      toast.error(dropCheck.reason || 'Không thể thả vào ô này.');
      return;
    }

    if (targetSlot.doctorId === dragData.doctorId) return;

    setSlots((prev) => ({
      ...prev,
      [targetSlot.key]: {
        ...targetSlot,
        doctorId: dragData.doctorId,
      },
    }));
    toast.success(
      `Đã gán ${dragData.doctorName} vào ${roomNameById.get(targetSlot.roomId) || `Phòng ${targetSlot.roomId}`}.`,
    );
  };

  const onDragCancel = () => {
    setActiveDoctor(null);
    setActiveDoctorDragData(null);
    setActiveDoctorWidth(null);
    setHoveredSlotKey(null);
  };

  return (
    <div className='space-y-4'>
      <section className='rounded-xl border bg-white p-5 shadow-sm'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-semibold text-slate-900'>Phân công lịch trực bác sĩ</h1>
            <p className='mt-1 text-sm text-slate-600'>
              Kéo thả bác sĩ theo ngày, buổi và phòng. Chỉ hiển thị khi đã chọn đủ bộ lọc.
            </p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button variant='outline' onClick={() => navigate(-1)}>
              <ArrowLeft className='mr-2 h-4 w-4' />
              Quay lại
            </Button>
            <Button
              variant='outline'
              onClick={() => saveDraftMutation.mutate()}
              disabled={!canCreate || saveDraftMutation.isPending}
            >
              <Save className='mr-2 h-4 w-4' />
              Lưu nháp
            </Button>
            <Button variant='outline' onClick={() => setPreviewOpen(true)} disabled={!hasPlanningData}>
              Xem trước
            </Button>
            <Button onClick={() => createScheduleMutation.mutate()} disabled={!canCreate || createScheduleMutation.isPending}>
              Tạo lịch trực
            </Button>
          </div>
        </div>
      </section>

      <section className='rounded-xl border bg-white p-4 shadow-sm'>
        <div className='grid gap-3 md:grid-cols-5'>
          <div>
            <label className='text-xs text-slate-600'>Từ ngày</label>
            <div className='relative'>
              <Input
                type='text'
                readOnly
                value={range.dateFrom ? formatDateDdMmYyyySlash(range.dateFrom) : ''}
                onClick={openDateFromPicker}
                placeholder='dd/MM/yyyy'
                className='cursor-pointer'
              />
              <input
                ref={dateFromPickerRef}
                type='date'
                value={range.dateFrom}
                onChange={(event) => updateDateFrom(event.target.value)}
                tabIndex={-1}
                aria-hidden
                className='pointer-events-none absolute inset-0 opacity-0'
              />
            </div>
          </div>
          <div>
            <label className='text-xs text-slate-600'>Đến ngày</label>
            <div className='relative'>
              <Input
                type='text'
                readOnly
                value={range.dateTo ? formatDateDdMmYyyySlash(range.dateTo) : ''}
                onClick={openDateToPicker}
                placeholder='dd/MM/yyyy'
                className='cursor-pointer'
              />
              <input
                ref={dateToPickerRef}
                type='date'
                value={range.dateTo}
                onChange={(event) => updateDateTo(event.target.value)}
                tabIndex={-1}
                aria-hidden
                className='pointer-events-none absolute inset-0 opacity-0'
              />
            </div>
          </div>
          <div>
            <label className='text-xs text-slate-600'>Chuyên khoa</label>
            <AdminSelect value={specialtyId} onValueChange={setSpecialtyId}>
              <AdminSelectTrigger>
                <AdminSelectValue placeholder='Chọn chuyên khoa' />
              </AdminSelectTrigger>
              <AdminSelectContent>
                {(specialtiesQuery.data ?? []).map((specialty) => (
                  <AdminSelectItem key={specialty.CK_MA} value={String(specialty.CK_MA)}>
                    {specialty.CK_TEN}
                  </AdminSelectItem>
                ))}
              </AdminSelectContent>
            </AdminSelect>
          </div>
          <div>
            <label className='text-xs text-slate-600'>Buổi đang xem</label>
            <AdminSelect value={sessionView} onValueChange={setSessionView} disabled={!isFilterReady || allSessions.length === 0}>
              <AdminSelectTrigger>
                <AdminSelectValue placeholder='Tất cả' />
              </AdminSelectTrigger>
              <AdminSelectContent>
                <AdminSelectItem value='all'>Tất cả</AdminSelectItem>
                {allSessions.map((session) => (
                  <AdminSelectItem key={session.B_TEN} value={session.B_TEN}>
                    {getSessionLabel(session.B_TEN)}
                  </AdminSelectItem>
                ))}
              </AdminSelectContent>
            </AdminSelect>
          </div>
          <div>
            <label className='text-xs text-slate-600'>Chế độ tạo</label>
            <AdminSelect value={overwriteMode} onValueChange={(value) => setOverwriteMode(value as SchedulePlanningOverwriteMode)}>
              <AdminSelectTrigger>
                <AdminSelectValue />
              </AdminSelectTrigger>
              <AdminSelectContent>
                <AdminSelectItem value='overwrite'>Ghi đè</AdminSelectItem>
                <AdminSelectItem value='skip'>Bỏ qua ô đã có lịch</AdminSelectItem>
                <AdminSelectItem value='only_empty'>Chỉ ô trống</AdminSelectItem>
              </AdminSelectContent>
            </AdminSelect>
          </div>
        </div>

        {warning ? (
          <div className='mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700'>
            <AlertTriangle className='mr-1 inline h-4 w-4' />
            {warning}
          </div>
        ) : null}
        {!warning && sundayNotice ? (
          <div className='mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700'>
            <AlertTriangle className='mr-1 inline h-4 w-4' />
            {sundayNotice}
          </div>
        ) : null}
      </section>

      <section className='rounded-xl border bg-white p-4 shadow-sm'>
        <div className='flex flex-wrap gap-2 text-sm'>
          <span className='rounded bg-slate-100 px-2 py-1'>Bác sĩ: {isFilterReady ? summary.doctors : 0}</span>
          <span className='rounded bg-slate-100 px-2 py-1'>Đã gán: {isFilterReady ? summary.assigned : 0}</span>
          <span className='rounded bg-emerald-50 px-2 py-1 text-emerald-700'>Mới phân công: {isFilterReady ? summary.newAssigned : 0}</span>
          <span className='rounded bg-blue-50 px-2 py-1 text-blue-700'>Lịch đã chốt: {isFilterReady ? summary.existingAssigned : 0}</span>
          <span className='rounded bg-slate-100 px-2 py-1'>Trống: {isFilterReady ? summary.empty : 0}</span>
          <span className='rounded bg-rose-50 px-2 py-1 text-rose-700'>Xung đột: {isFilterReady ? summary.conflicts : 0}</span>
          <span className='rounded bg-slate-100 px-2 py-1'>Sẽ tạo: {isFilterReady ? summary.willCreate : 0}</span>
          <span className='rounded bg-slate-100 px-2 py-1'>Sẽ cập nhật: {isFilterReady ? summary.willUpdate : 0}</span>
        </div>
      </section>

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className='grid gap-4 xl:grid-cols-[340px_1fr]'>
          <div className='space-y-4 xl:sticky xl:top-4 xl:self-start'>
            <section className='rounded-xl border bg-white p-4 shadow-sm'>
              <div className='relative mb-3'>
                <Search className='absolute left-3 top-2.5 h-4 w-4 text-slate-400' />
                <Input
                  className='pl-9'
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='Tìm bác sĩ'
                  disabled={!isFilterReady}
                />
              </div>

              {!isFilterReady ? (
                <EmptyCard
                  title='Chưa có dữ liệu bác sĩ'
                  description='Hãy chọn Chuyên khoa và khoảng thời gian hợp lệ để tải danh sách bác sĩ.'
                />
              ) : optionsQuery.isLoading ? (
                <p className='text-sm text-slate-500'>Đang tải danh sách bác sĩ...</p>
              ) : doctors.length === 0 ? (
                <EmptyCard
                  title='Không có bác sĩ phù hợp'
                  description='Không tìm thấy bác sĩ theo chuyên khoa đã chọn hoặc từ khóa tìm kiếm hiện tại.'
                />
              ) : (
                <div className='max-h-[50vh] space-y-2 overflow-auto pr-1'>
                  {doctors.map((doctor) => (
                    <DoctorCard
                      key={doctor.BS_MA}
                      id={doctor.BS_MA}
                      specialtyId={doctor.CK_MA}
                      name={doctor.BS_HO_TEN}
                      specialtyName={doctor.CHUYEN_KHOA.CK_TEN}
                      assignedCount={assignedByDoctor.get(doctor.BS_MA) ?? 0}
                      active={activeDoctor === doctor.BS_MA}
                      disabled={!canUseBoard}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className='rounded-xl border bg-white p-4 shadow-sm'>
              <h3 className='text-sm font-semibold text-slate-900'>Thao tác nhanh</h3>
              <div className='mt-3 grid gap-2'>
                <Button variant='outline' onClick={() => copyDay(1, [3, 5])} disabled={!hasPlanningData}>
                  Sao chép Thứ 2 sang Thứ 4, 6
                </Button>
                <Button variant='outline' onClick={() => copyDay(2, [4, 6])} disabled={!hasPlanningData}>
                  Sao chép Thứ 3 sang Thứ 5, 7
                </Button>
                <Button variant='outline' onClick={() => setCopyOpen(true)} disabled={!hasPlanningData}>
                  <Copy className='mr-2 h-4 w-4' />
                  Sao chép 1/2/3 tháng
                </Button>
                <AdminSelect onValueChange={(date) => clearAssignmentsByDate(date)} disabled={!hasPlanningData}>
                  <AdminSelectTrigger>
                    <AdminSelectValue placeholder='Xóa phân công theo ngày' />
                  </AdminSelectTrigger>
                  <AdminSelectContent>
                    {boardDates.map((date) => (
                      <AdminSelectItem key={date} value={date}>
                        {format(parseISO(date), 'dd/MM/yyyy')}
                      </AdminSelectItem>
                    ))}
                  </AdminSelectContent>
                </AdminSelect>
                <Button variant='outline' onClick={resetAssignments} disabled={!hasPlanningData}>
                  <Eraser className='mr-2 h-4 w-4' />
                  Đặt lại
                </Button>
                <Button variant='outline' onClick={suggestAssignments} disabled={!hasPlanningData}>
                  <Sparkles className='mr-2 h-4 w-4' />
                  Tự động đề xuất
                </Button>
                <Button variant='outline' onClick={() => setArchiveOpen(true)} disabled={!isFilterReady}>
                  <Trash2 className='mr-2 h-4 w-4' />
                  Lưu trữ lịch cũ
                </Button>
                <Button
                  variant='outline'
                  onClick={() => {
                    setRestoreArchivedPreview(null);
                    setRestoreArchivedOpen(true);
                  }}
                  disabled={!isFilterReady}
                >
                  <Undo2 className='mr-2 h-4 w-4' />
                  Tái sử dụng lịch lưu trữ
                </Button>
              </div>
            </section>
          </div>

          <section className='rounded-xl border bg-white p-4 shadow-sm'>
            <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
              <div>
                <h2 className='text-sm font-semibold text-slate-900'>Bảng phân công</h2>
                <p className='text-xs text-slate-500'>Theo ngày, buổi và phòng</p>
              </div>
              <div className='flex items-center gap-2'>
                <Button size='icon' variant='outline' onClick={() => shiftWeek(-1)}>
                  <ChevronLeft className='h-4 w-4' />
                </Button>
                <div className='min-w-[170px] rounded border bg-slate-50 px-3 py-2 text-center text-sm'>
                  Tuần bắt đầu {format(parseISO(weekStart), 'dd/MM/yyyy')}
                </div>
                <Button size='icon' variant='outline' onClick={() => shiftWeek(1)}>
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
            </div>

            {!isFilterReady ? (
              <EmptyCard
                title='Chọn khoảng thời gian và chuyên khoa để bắt đầu phân công.'
                description='Sau khi chọn đủ bộ lọc, hệ thống sẽ tải danh sách bác sĩ và bảng phân công.'
              />
            ) : optionsQuery.isLoading || planningQuery.isLoading ? (
              <p className='rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500'>
                Đang tải dữ liệu phân công...
              </p>
            ) : optionsQuery.isError || planningQuery.isError ? (
              <p className='rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700'>
                Không thể tải dữ liệu phân công. Vui lòng thử lại.
              </p>
            ) : rooms.length === 0 ? (
              <EmptyCard
                title='Không có phòng phù hợp cho chuyên khoa đã chọn.'
                description='Kiểm tra cấu hình phòng thuộc chuyên khoa trước khi phân công.'
              />
            ) : allSessions.length === 0 ? (
              <EmptyCard
                title='Không có dữ liệu buổi khám.'
                description='Cần cấu hình danh mục buổi để hiển thị bảng phân công.'
              />
            ) : visibleSessions.length === 0 ? (
              <EmptyCard
                title='Không có buổi theo bộ lọc đang xem.'
                description='Hãy chọn lại trường "Buổi đang xem".'
              />
            ) : (
              <>
                <div className='mb-3 flex flex-wrap gap-2 text-xs'>
                  {SLOT_LEGEND_ORDER.map((state) => (
                    <span
                      key={state}
                      className={cn(
                        'rounded-full border px-2 py-1',
                        SLOT_VISUAL_META[state].legendClass,
                      )}
                    >
                      {SLOT_VISUAL_META[state].label}
                    </span>
                  ))}
                </div>
                <div className='overflow-auto'>
                  <table className='min-w-[980px] border-separate border-spacing-0'>
                    <thead>
                      <tr>
                        <th className='sticky left-0 z-20 w-[150px] border border-slate-200 bg-slate-100 p-2 text-left text-xs font-semibold text-slate-700'>
                          Buổi
                        </th>
                        {boardDates.map((date) => (
                          <th
                            key={date}
                            className='w-[260px] border border-slate-200 bg-slate-100 p-2 text-left text-xs font-semibold text-slate-700'
                          >
                            <div>{weekdayLabel(date)}</div>
                            <div className='text-[11px] font-medium text-slate-500'>
                              {format(parseISO(date), 'dd/MM/yyyy')}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSessions.map((session) => (
                        <tr key={session.B_TEN}>
                          <td className='sticky left-0 z-10 border border-slate-200 bg-white p-2 align-top'>
                            <div className='text-sm font-semibold text-slate-700'>
                              {getSessionLabel(session.B_TEN)}
                            </div>
                          </td>
                          {boardDates.map((date) => (
                            <td
                              key={`${session.B_TEN}-${date}`}
                              className='border border-slate-200 bg-white p-2 align-top'
                            >
                              <div className='space-y-2'>
                                {rooms.map((room) => {
                                  const currentSlot = slots[slotKey(date, session.B_TEN, room.P_MA)];
                                  if (!currentSlot) return null;
                                  const dropCheck =
                                    activeDoctor != null ? validateDrop(currentSlot, activeDoctor) : { ok: true };
                                  const dragging = activeDoctor != null;

                                  return (
                                    <PlanningCell
                                      key={currentSlot.key}
                                      slot={currentSlot}
                                      roomName={roomNameById.get(room.P_MA) || `Phòng ${room.P_MA}`}
                                      doctorName={
                                        currentSlot.doctorId
                                          ? doctorNameById.get(currentSlot.doctorId) || `BS #${currentSlot.doctorId}`
                                          : null
                                      }
                                      baselineDoctorId={baseSlots[currentSlot.key]?.doctorId ?? null}
                                      conflict={conflicts.has(currentSlot.key)}
                                      disabled={!canUseBoard}
                                      canDropWhenDragging={dropCheck.ok}
                                      dropReason={dropCheck.reason}
                                      dragging={dragging}
                                      specialtyId={hasSpecialty ? Number(specialtyId) : null}
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
              </>
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
              <div className='flex items-start justify-between gap-2'>
                <div className='font-medium text-slate-900'>
                  {activeDoctorDragData.doctorName || `BS #${activeDoctor}`}
                </div>
                <GripVertical className='h-4 w-4 text-slate-400' />
              </div>
              <div className='mt-1 text-xs text-slate-500'>{activeDoctorDragData.specialtyName}</div>
              <div className='mt-2 inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700'>
                {activeDoctorDragData.assignedCount} ca trực
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xem trước</DialogTitle>
            <DialogDescription>
              Tổng ô {summary.total}, đã gán {summary.assigned}, xung đột {summary.conflicts}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setPreviewOpen(false)}>
              Đóng
            </Button>
            <Button
              disabled={!canCreate || createScheduleMutation.isPending}
              onClick={() => {
                setPreviewOpen(false);
                createScheduleMutation.mutate();
              }}
            >
              Tạo lịch trực
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className='bg-white'>
          <DialogHeader>
            <DialogTitle>Sao chép tuần</DialogTitle>
            <DialogDescription>Tuần nguồn {format(parseISO(weekStart), 'dd/MM/yyyy')}</DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <AdminSelect value={copyRange} onValueChange={(value) => setCopyRange(value as ScheduleCopyRangeOption)}>
              <AdminSelectTrigger className='bg-white'>
                <AdminSelectValue />
              </AdminSelectTrigger>
              <AdminSelectContent>
                <AdminSelectItem value='ONE_MONTH'>1 tháng</AdminSelectItem>
                <AdminSelectItem value='TWO_MONTHS'>2 tháng</AdminSelectItem>
                <AdminSelectItem value='THREE_MONTHS'>3 tháng</AdminSelectItem>
              </AdminSelectContent>
            </AdminSelect>
            <AdminSelect value={copyMode} onValueChange={(value) => setCopyMode(value as ScheduleCopyConflictMode)}>
              <AdminSelectTrigger className='bg-white'>
                <AdminSelectValue />
              </AdminSelectTrigger>
              <AdminSelectContent>
                <AdminSelectItem value='SKIP_EXISTING'>Bỏ qua lịch đã có</AdminSelectItem>
                <AdminSelectItem value='ARCHIVE_OLD_GENERATED'>Lưu trữ lịch cũ đã tạo</AdminSelectItem>
                <AdminSelectItem value='ONLY_EMPTY'>Chỉ ô trống</AdminSelectItem>
              </AdminSelectContent>
            </AdminSelect>

            {copyPreview ? (
              <div className='rounded border bg-slate-50 p-2 text-sm'>
                Sẽ tạo {copyPreview.willCreate}, cập nhật {copyPreview.willUpdate}, xung đột {copyPreview.conflicts}
              </div>
            ) : null}
          </div>

          <DialogFooter className='bg-white'>
            <Button
              variant='outline'
              onClick={() => {
                setCopyOpen(false);
                setCopyPreview(null);
              }}
            >
              Hủy
            </Button>
            <Button variant='outline' disabled={!hasPlanningData || copyWeekMutation.isPending} onClick={() => copyWeekMutation.mutate(false)}>
              Xem trước
            </Button>
            <Button disabled={!hasPlanningData || copyWeekMutation.isPending} onClick={() => copyWeekMutation.mutate(true)}>
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className='bg-white'>
          <DialogHeader>
            <DialogTitle>Lưu trữ lịch cũ</DialogTitle>
            <DialogDescription>Không xóa cứng dữ liệu.</DialogDescription>
          </DialogHeader>
          <Input
            value={archiveReason}
            onChange={(event) => setArchiveReason(event.target.value)}
            placeholder='Lý do lưu trữ'
          />
          <DialogFooter className='bg-white'>
            <Button variant='outline' onClick={() => setArchiveOpen(false)}>
              Hủy
            </Button>
            <Button variant='outline' disabled={!isFilterReady || archiveMutation.isPending} onClick={() => archiveMutation.mutate(false)}>
              Xem trước
            </Button>
            <Button disabled={!isFilterReady || archiveMutation.isPending} onClick={() => archiveMutation.mutate(true)}>
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={restoreArchivedOpen}
        onOpenChange={(open) => {
          setRestoreArchivedOpen(open);
          if (!open) setRestoreArchivedPreview(null);
        }}
      >
        <DialogContent className='bg-white'>
          <DialogHeader>
            <DialogTitle>Tái sử dụng lịch đã lưu trữ</DialogTitle>
            <DialogDescription>
              Khôi phục lịch archive trong khoảng {formatDateDdMmYyyySlash(range.dateFrom)} -{' '}
              {formatDateDdMmYyyySlash(range.dateTo)} của chuyên khoa đang chọn.
            </DialogDescription>
          </DialogHeader>

          {restoreArchivedPreview ? (
            <div className='rounded border bg-slate-50 p-3 text-sm'>
              <div>Tổng lịch archive trong khoảng: {restoreArchivedPreview.totalArchived}</div>
              <div>Có thể tái sử dụng: {restoreArchivedPreview.eligible}</div>
              <div>Bị bỏ qua do đã có lịch hẹn: {restoreArchivedPreview.skippedWithBookings}</div>
              <div>Bị bỏ qua do còn yêu cầu chờ duyệt: {restoreArchivedPreview.skippedWithPendingRequests}</div>
              <div>Bị bỏ qua do xung đột phòng/bác sĩ: {restoreArchivedPreview.skippedWithConflicts}</div>
            </div>
          ) : (
            <p className='text-sm text-slate-600'>
              Nhấn &quot;Xem trước&quot; để kiểm tra số ca archive có thể tái sử dụng trước khi xác nhận.
            </p>
          )}

          <DialogFooter className='bg-white'>
            <Button
              variant='outline'
              onClick={() => {
                setRestoreArchivedOpen(false);
                setRestoreArchivedPreview(null);
              }}
            >
              Hủy
            </Button>
            <Button
              variant='outline'
              disabled={!isFilterReady || restoreArchivedMutation.isPending}
              onClick={() => restoreArchivedMutation.mutate(false)}
            >
              Xem trước
            </Button>
            <Button
              disabled={!isFilterReady || restoreArchivedMutation.isPending}
              onClick={() => restoreArchivedMutation.mutate(true)}
            >
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
