import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eraser,
  FileClock,
  GripVertical,
  Layers3,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserMinus,
  WandSparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  adminScheduleWorkflowApi,
  type ScheduleArchiveResponse,
  type OfficialShiftFormContextSession,
  type ScheduleExceptionRequestItem,
  type ScheduleTemplateItem,
  type WeeklyScheduleItem,
} from '@/services/api/scheduleWorkflowApi';
import {
  formatDateDdMmYyyy,
  formatDateDdMmYyyySlash,
  getSessionLabel,
  getWeekdayLabel,
  getWeekdayLabelFromDate,
  toDateOnlyIso,
} from '@/lib/scheduleDisplay';
import {
  getExceptionStatusBadgeClass,
  getExceptionStatusLabel,
  getExceptionTypeLabel,
  getTemplateStatusBadgeClass,
  getTemplateStatusLabel,
  getWeekWorkflowStatusBadgeClass,
  getWeekWorkflowStatusLabel,
  getWeeklyScheduleSourceLabel,
  getWeeklyScheduleStatusBadgeClass,
  getWeeklyScheduleStatusLabel,
} from '@/lib/scheduleWorkflowDisplay';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AdminSelect,
  AdminSelectContent,
  AdminSelectItem,
  AdminSelectTrigger,
  AdminSelectValue,
} from '@/components/admin/AdminSelect';

type TemplateFormState = {
  id: number | null;
  BS_MA: string;
  CK_MA: string;
  P_MA: string;
  B_TEN: string;
  weekday: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  status: 'active' | 'inactive';
  note: string;
};

type ManualShiftFormState = {
  originalKey: null | { bsMa: number; date: string; session: string };
  BS_MA: string;
  P_MA: string;
  N_NGAY: string;
  B_TEN: string;
  status: 'approved' | 'official';
  note: string;
};

type TemplateBuilderSlot = {
  key: string;
  weekday: number;
  session: string;
  roomId: number;
};

type TemplateBuilderDoctorDragData = {
  type: 'doctor';
  doctorId: number;
  specialtyId: number;
  doctorName: string;
  specialtyName: string;
  assignedCount: number;
};

type TemplateBuilderSlotDropData = {
  type: 'slot';
  slotKey: string;
  weekday: number;
  session: string;
  roomId: number;
};

const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0];
const TEMPLATE_BUILDER_WEEKDAYS = [1, 2, 3, 4, 5, 6];

const EMPTY_TEMPLATE_FORM: TemplateFormState = {
  id: null,
  BS_MA: '',
  CK_MA: '',
  P_MA: '',
  B_TEN: '',
  weekday: '1',
  effectiveStartDate: '',
  effectiveEndDate: '',
  status: 'active',
  note: '',
};

const EMPTY_MANUAL_SHIFT_FORM: ManualShiftFormState = {
  originalKey: null,
  BS_MA: '',
  P_MA: '',
  N_NGAY: '',
  B_TEN: '',
  status: 'approved',
  note: '',
};

const templateBuilderSlotKey = (weekday: number, session: string, roomId: number) =>
  `${weekday}__${session}__${roomId}`;

function getNextWeekStartIso() {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + 7);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(
    monday.getDate(),
  ).padStart(2, '0')}`;
}

function SummaryCard({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: number | string;
  tone?: 'slate' | 'amber' | 'emerald' | 'blue' | 'rose';
}) {
  const classes =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : tone === 'blue'
          ? 'border-blue-200 bg-blue-50 text-blue-900'
          : tone === 'rose'
            ? 'border-rose-200 bg-rose-50 text-rose-900'
            : 'border-slate-200 bg-slate-50 text-slate-900';

  return (
    <div className={cn('flex min-h-[108px] flex-col justify-between rounded-2xl border px-4 py-4 shadow-sm', classes)}>
      <p className="text-xs uppercase tracking-wide text-current/70">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

function ErrorState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-rose-900">{title}</p>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-rose-700">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

function EmptyCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function TemplateBuilderDoctorCard({
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
    id: `template-builder-doctor-${id}`,
    data: {
      type: 'doctor',
      doctorId: id,
      specialtyId,
      doctorName: name,
      specialtyName,
      assignedCount,
    } satisfies TemplateBuilderDoctorDragData,
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

function TemplateBuilderSlotCard({
  slot,
  roomName,
  doctorName,
  hasConflict,
  canDrop,
  dropReason,
  dragging,
  disabled,
  onRemoveDoctor,
}: {
  slot: TemplateBuilderSlot;
  roomName: string;
  doctorName: string | null;
  hasConflict: boolean;
  canDrop: boolean;
  dropReason?: string;
  dragging: boolean;
  disabled: boolean;
  onRemoveDoctor: (slotKeyValue: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: slot.key,
    disabled,
    data: {
      type: 'slot',
      slotKey: slot.key,
      weekday: slot.weekday,
      session: slot.session,
      roomId: slot.roomId,
    } satisfies TemplateBuilderSlotDropData,
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

function DataTableLoading({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-10">
        <div className="space-y-3">
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
      </TableCell>
    </TableRow>
  );
}

function PaginationBarFixed({
  page,
  pageSize,
  total,
  totalPages,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (total <= 0) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-600">
        Trang <span className="font-semibold text-slate-900">{page}</span> / {Math.max(totalPages, 1)}
        {' · '}
        <span>{total} bản ghi</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Hiển thị</span>
          <AdminSelect value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <AdminSelectTrigger className="h-9 w-[92px] bg-white">
              <AdminSelectValue />
            </AdminSelectTrigger>
            <AdminSelectContent>
              <AdminSelectItem value="10">10</AdminSelectItem>
              <AdminSelectItem value="20">20</AdminSelectItem>
              <AdminSelectItem value="50">50</AdminSelectItem>
            </AdminSelectContent>
          </AdminSelect>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Trước
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
          >
            Tiếp
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatExceptionTarget(item: ScheduleExceptionRequestItem) {
  return `${formatDateDdMmYyyy(item.targetShift.N_NGAY)} - ${getSessionLabel(item.targetShift.B_TEN)}`;
}

function PaginationBar({
  page,
  pageSize,
  total,
  totalPages,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (total <= 0) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-600">
        Trang <span className="font-semibold text-slate-900">{page}</span> /{' '}
        {Math.max(totalPages, 1)} · <span>{total} bản ghi</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Hiển thị</span>
          <AdminSelect value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <AdminSelectTrigger className="h-9 w-[92px] bg-white">
              <AdminSelectValue />
            </AdminSelectTrigger>
            <AdminSelectContent>
              <AdminSelectItem value="10">10</AdminSelectItem>
              <AdminSelectItem value="20">20</AdminSelectItem>
              <AdminSelectItem value="50">50</AdminSelectItem>
            </AdminSelectContent>
          </AdminSelect>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Trước
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
          >
            Tiếp
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatRequestedChange(item: ScheduleExceptionRequestItem) {
  const parts: string[] = [];
  if (item.requestedChange.date) parts.push(formatDateDdMmYyyy(item.requestedChange.date));
  if (item.requestedChange.session) parts.push(getSessionLabel(item.requestedChange.session));
  if (item.requestedChange.room) parts.push(item.requestedChange.room.P_TEN);
  if (item.requestedChange.suggestedDoctor) {
    parts.push(item.requestedChange.suggestedDoctor.BS_HO_TEN);
  }
  return parts.length > 0 ? parts.join(' | ') : '-';
}

function getLeaveApprovalLabel(item: ScheduleExceptionRequestItem) {
  if (item.type !== 'leave') return 'Duyệt';
  return item.leaveApprovalMode === 'cancel_with_bookings'
    ? 'Duyệt nghỉ và hủy lịch khám bị ảnh hưởng'
    : 'Duyệt nghỉ và chuyển ca sang chờ thay thế';
}

function getLeaveApprovalHint(item: ScheduleExceptionRequestItem) {
  if (item.type !== 'leave') return '';
  if (item.leaveApprovalMode === 'cancel_with_bookings') {
    return `Sẽ hủy ${item.affectedBookingCount} lịch hẹn bệnh nhân.`;
  }
  return 'Ca trực sẽ chuyển sang trạng thái chờ thay thế.';
}

export default function AdminScheduleWorkflowPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const templateBuilderSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const weekPickerRef = useRef<HTMLInputElement>(null);
  const manualShiftDatePickerRef = useRef<HTMLInputElement>(null);
  const templateStartPickerRef = useRef<HTMLInputElement>(null);
  const templateEndPickerRef = useRef<HTMLInputElement>(null);

  const [weekStart, setWeekStart] = useState(getNextWeekStartIso());
  const [search, setSearch] = useState('');
  const [templateStatusFilter, setTemplateStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    'active',
  );
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<string>('all');
  const [exceptionStatusFilter, setExceptionStatusFilter] = useState<string>('pending');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [generatedPage, setGeneratedPage] = useState(1);
  const [generatedPageSize, setGeneratedPageSize] = useState(20);

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateBuilderOpen, setTemplateBuilderOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(EMPTY_TEMPLATE_FORM);
  const [templateBuilderDoctorSearch, setTemplateBuilderDoctorSearch] = useState('');
  const [templateBuilderAssignments, setTemplateBuilderAssignments] = useState<
    Record<string, number | null>
  >({});
  const [templateBuilderActiveDoctor, setTemplateBuilderActiveDoctor] = useState<number | null>(null);
  const [templateBuilderActiveDoctorDragData, setTemplateBuilderActiveDoctorDragData] =
    useState<TemplateBuilderDoctorDragData | null>(null);
  const [templateBuilderActiveDoctorWidth, setTemplateBuilderActiveDoctorWidth] = useState<number | null>(
    null,
  );
  const [templateBuilderHoveredSlotKey, setTemplateBuilderHoveredSlotKey] = useState<string | null>(null);
  const [manualShiftDialogOpen, setManualShiftDialogOpen] = useState(false);
  const [manualShiftForm, setManualShiftForm] = useState<ManualShiftFormState>(
    EMPTY_MANUAL_SHIFT_FORM,
  );
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveForm, setArchiveForm] = useState({
    dateFrom: '',
    dateTo: '',
    specialtyId: 'all',
    source: 'all',
    reason: '',
  });
  const [archivePreview, setArchivePreview] = useState<ScheduleArchiveResponse | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [reviewDialog, setReviewDialog] = useState({
    open: false,
    requestId: 0,
    requestLabel: '',
    targetStatus: 'approved' as 'approved' | 'rejected',
    adminNote: '',
    approvalLabel: '',
    warning: '',
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    schedule: WeeklyScheduleItem | null;
  }>({ open: false, schedule: null });

  const commonFilterParams = useMemo(
    () => ({
      weekStart,
      specialtyId: specialtyFilter === 'all' ? undefined : Number(specialtyFilter),
      doctorId: doctorFilter === 'all' ? undefined : Number(doctorFilter),
      roomId: roomFilter === 'all' ? undefined : Number(roomFilter),
      search: search.trim() || undefined,
    }),
    [doctorFilter, roomFilter, search, specialtyFilter, weekStart],
  );

  const { data: options } = useQuery({
    queryKey: ['admin-schedule-workflow-options'],
    queryFn: adminScheduleWorkflowApi.getOptions,
  });

  const {
    data: weekOverview,
    isLoading: weekLoading,
    isError: weekOverviewError,
  } = useQuery({
    queryKey: ['admin-schedule-workflow-overview', weekStart],
    queryFn: () => adminScheduleWorkflowApi.getWeekOverview(weekStart),
  });

  const {
    data: templates,
    isLoading: templatesLoading,
    isError: templatesError,
  } = useQuery({
    queryKey: [
      'admin-schedule-templates',
      specialtyFilter,
      doctorFilter,
      roomFilter,
      templateStatusFilter,
      search,
    ],
    queryFn: () =>
      adminScheduleWorkflowApi.getTemplates({
        specialtyId: specialtyFilter === 'all' ? undefined : Number(specialtyFilter),
        doctorId: doctorFilter === 'all' ? undefined : Number(doctorFilter),
        roomId: roomFilter === 'all' ? undefined : Number(roomFilter),
        status: templateStatusFilter === 'all' ? undefined : templateStatusFilter,
        search: search.trim() || undefined,
        page: 1,
        limit: 100,
      }),
  });

  const {
    data: weeklySchedules,
    isLoading: schedulesLoading,
    isError: schedulesError,
    isFetching: schedulesFetching,
  } = useQuery({
    queryKey: [
      'admin-weekly-schedules',
      commonFilterParams,
      scheduleStatusFilter,
      sourceFilter,
      generatedPage,
      generatedPageSize,
    ],
    queryFn: () =>
      adminScheduleWorkflowApi.getWeeklySchedules({
        ...commonFilterParams,
        status: scheduleStatusFilter === 'all' ? undefined : scheduleStatusFilter,
        source: sourceFilter === 'all' ? undefined : sourceFilter,
        page: generatedPage,
        limit: generatedPageSize,
      }),
  });

  const { data: templateBuilderSuggestion } = useQuery({
    queryKey: ['admin-template-builder-latest', templateForm.CK_MA],
    enabled: templateBuilderOpen && Boolean(templateForm.CK_MA),
    queryFn: () =>
      adminScheduleWorkflowApi.getTemplates({
        specialtyId: Number(templateForm.CK_MA),
        status: 'active',
        page: 1,
        limit: 200,
      }),
  });

  const {
    data: exceptionRequests,
    isLoading: exceptionLoading,
    isError: exceptionError,
  } = useQuery({
    queryKey: ['admin-schedule-exceptions', commonFilterParams, exceptionStatusFilter],
    queryFn: () =>
      adminScheduleWorkflowApi.getExceptionRequests({
        weekStart,
        doctorId: doctorFilter === 'all' ? undefined : Number(doctorFilter),
        status: exceptionStatusFilter === 'all' ? undefined : exceptionStatusFilter,
        search: search.trim() || undefined,
        page: 1,
        limit: 200,
      }),
  });

  const filteredDoctorsForTemplate = useMemo(() => {
    if (!templateForm.CK_MA) return options?.doctors ?? [];
    return (options?.doctors ?? []).filter(
      (doctor) => doctor.CK_MA === Number(templateForm.CK_MA),
    );
  }, [options?.doctors, templateForm.CK_MA]);

  const filteredRoomsForTemplate = useMemo(() => {
    if (!templateForm.CK_MA) return options?.rooms ?? [];
    return (options?.rooms ?? []).filter((room) => room.CK_MA === Number(templateForm.CK_MA));
  }, [options?.rooms, templateForm.CK_MA]);

  const templateBuilderDoctors = useMemo(() => {
    const keyword = templateBuilderDoctorSearch.trim().toLowerCase();
    if (!keyword) return filteredDoctorsForTemplate;
    return filteredDoctorsForTemplate.filter(
      (doctor) =>
        doctor.BS_HO_TEN.toLowerCase().includes(keyword) || String(doctor.BS_MA).includes(keyword),
    );
  }, [filteredDoctorsForTemplate, templateBuilderDoctorSearch]);

  const templateBuilderSessions = useMemo(() => {
    const sessions = options?.sessions ?? [];
    const morning = sessions.find((session) => getSessionLabel(session.B_TEN).toLowerCase().includes('sáng'));
    const afternoon = sessions.find((session) =>
      getSessionLabel(session.B_TEN).toLowerCase().includes('chiều'),
    );
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
    return sessions.slice(0, 2);
  }, [options?.sessions]);

  const templateBuilderSlots = useMemo(() => {
    const slots: TemplateBuilderSlot[] = [];
    TEMPLATE_BUILDER_WEEKDAYS.forEach((weekday) => {
      templateBuilderSessions.forEach((session) => {
        filteredRoomsForTemplate.forEach((room) => {
          slots.push({
            key: templateBuilderSlotKey(weekday, session.B_TEN, room.P_MA),
            weekday,
            session: session.B_TEN,
            roomId: room.P_MA,
          });
        });
      });
    });
    return slots;
  }, [filteredRoomsForTemplate, templateBuilderSessions]);

  const templateBuilderSlotMap = useMemo(() => {
    const map = new Map<string, TemplateBuilderSlot>();
    templateBuilderSlots.forEach((slot) => map.set(slot.key, slot));
    return map;
  }, [templateBuilderSlots]);

  const templateBuilderDoctorNameById = useMemo(
    () =>
      new Map(
        filteredDoctorsForTemplate.map((doctor) => [doctor.BS_MA, doctor.BS_HO_TEN] as const),
      ),
    [filteredDoctorsForTemplate],
  );

  const templateBuilderRoomNameById = useMemo(
    () => new Map(filteredRoomsForTemplate.map((room) => [room.P_MA, room.P_TEN] as const)),
    [filteredRoomsForTemplate],
  );

  const templateBuilderAssignedCountByDoctor = useMemo(() => {
    const map = new Map<number, number>();
    Object.values(templateBuilderAssignments).forEach((doctorId) => {
      if (!doctorId) return;
      map.set(doctorId, (map.get(doctorId) ?? 0) + 1);
    });
    return map;
  }, [templateBuilderAssignments]);

  const templateBuilderConflicts = useMemo(() => {
    const byDoctorAndShift = new Map<string, string[]>();
    Object.entries(templateBuilderAssignments).forEach(([slotKey, doctorId]) => {
      if (!doctorId) return;
      const slot = templateBuilderSlotMap.get(slotKey);
      if (!slot) return;
      const key = `${slot.weekday}__${slot.session}__${doctorId}`;
      byDoctorAndShift.set(key, [...(byDoctorAndShift.get(key) ?? []), slotKey]);
    });

    const conflicts = new Set<string>();
    byDoctorAndShift.forEach((slotKeys) => {
      if (slotKeys.length <= 1) return;
      slotKeys.forEach((slotKey) => conflicts.add(slotKey));
    });
    return conflicts;
  }, [templateBuilderAssignments, templateBuilderSlotMap]);

  const templateBuilderSummary = useMemo(() => {
    const total = templateBuilderSlots.length;
    const assigned = Object.values(templateBuilderAssignments).filter(Boolean).length;
    const conflicts = templateBuilderConflicts.size;
    return {
      total,
      assigned,
      empty: Math.max(total - assigned, 0),
      conflicts,
    };
  }, [templateBuilderAssignments, templateBuilderConflicts.size, templateBuilderSlots.length]);

  const selectedTemplateSpecialty = useMemo(
    () => options?.specialties?.find((item) => item.CK_MA === Number(templateForm.CK_MA)) ?? null,
    [options?.specialties, templateForm.CK_MA],
  );

  const selectedTemplateDoctor = useMemo(
    () => filteredDoctorsForTemplate.find((item) => item.BS_MA === Number(templateForm.BS_MA)) ?? null,
    [filteredDoctorsForTemplate, templateForm.BS_MA],
  );

  const selectedTemplateRoom = useMemo(
    () => filteredRoomsForTemplate.find((item) => item.P_MA === Number(templateForm.P_MA)) ?? null,
    [filteredRoomsForTemplate, templateForm.P_MA],
  );

  const selectedManualRoom = useMemo(
    () => options?.rooms.find((room) => room.P_MA === Number(manualShiftForm.P_MA)) ?? null,
    [manualShiftForm.P_MA, options?.rooms],
  );

  const filteredDoctorsForManualShift = useMemo(() => {
    if (!selectedManualRoom) return options?.doctors ?? [];
    return (options?.doctors ?? []).filter((doctor) => doctor.CK_MA === selectedManualRoom.CK_MA);
  }, [options?.doctors, selectedManualRoom]);

  const shiftContextParams = useMemo(
    () => ({
      date: manualShiftForm.N_NGAY,
      roomId: manualShiftForm.P_MA ? Number(manualShiftForm.P_MA) : undefined,
      doctorId: manualShiftForm.BS_MA ? Number(manualShiftForm.BS_MA) : undefined,
      excludeBsMa: manualShiftForm.originalKey?.bsMa,
      excludeDate: manualShiftForm.originalKey?.date,
      excludeSession: manualShiftForm.originalKey?.session,
    }),
    [manualShiftForm],
  );

  const { data: shiftContext, isLoading: shiftContextLoading } = useQuery({
    queryKey: ['admin-shift-form-context', shiftContextParams],
    queryFn: () => adminScheduleWorkflowApi.getShiftFormContext(shiftContextParams),
    enabled: manualShiftDialogOpen && Boolean(manualShiftForm.N_NGAY),
    staleTime: 15_000,
  });

  const shiftContextMap = useMemo(() => {
    const map = new Map<string, OfficialShiftFormContextSession>();
    (shiftContext?.sessionContext ?? []).forEach((item) => {
      map.set(item.session, item);
    });
    return map;
  }, [shiftContext?.sessionContext]);

  const selectedSessionContext = useMemo(
    () => shiftContextMap.get(manualShiftForm.B_TEN),
    [manualShiftForm.B_TEN, shiftContextMap],
  );

  const templateItems = templates?.items ?? [];
  const weeklyItems = weeklySchedules?.items ?? [];
  const exceptionItems = exceptionRequests?.items ?? [];
  const weeklyMeta = weeklySchedules?.meta;

  useEffect(() => {
    setGeneratedPage(1);
  }, [
    weekStart,
    search,
    specialtyFilter,
    doctorFilter,
    roomFilter,
    scheduleStatusFilter,
    sourceFilter,
  ]);

  useEffect(() => {
    if (!weeklyMeta) return;
    const totalPages = Math.max(weeklyMeta.totalPages, 1);
    if (generatedPage > totalPages) {
      setGeneratedPage(totalPages);
    }
  }, [generatedPage, weeklyMeta]);

  const templateSaveReason = useMemo(() => {
    if (
      !templateForm.BS_MA ||
      !templateForm.CK_MA ||
      !templateForm.P_MA ||
      !templateForm.B_TEN ||
      !templateForm.effectiveStartDate
    ) {
      return 'Vui lòng nhập đầy đủ bác sĩ, chuyên khoa, phòng, buổi và ngày bắt đầu.';
    }
    return null;
  }, [templateForm]);

  const templateBuilderSaveReason = useMemo(() => {
    if (!templateForm.CK_MA) return 'Vui lòng chọn chuyên khoa để bắt đầu tạo mẫu.';
    if (!templateForm.effectiveStartDate) return 'Vui lòng chọn ngày bắt đầu hiệu lực.';
    if (templateBuilderSlots.length === 0)
      return 'Không có phòng hoặc buổi phù hợp để tạo timetable mẫu.';
    if (templateBuilderSummary.assigned === 0)
      return 'Vui lòng kéo thả ít nhất một bác sĩ vào timetable mẫu.';
    if (templateBuilderSummary.conflicts > 0)
      return 'Mẫu đang có xung đột bác sĩ trùng ca. Vui lòng xử lý trước khi lưu.';
    return null;
  }, [templateBuilderSlots.length, templateBuilderSummary.assigned, templateBuilderSummary.conflicts, templateForm.CK_MA, templateForm.effectiveStartDate]);

  const saveManualShiftReason = useMemo(() => {
    if (
      !manualShiftForm.BS_MA ||
      !manualShiftForm.P_MA ||
      !manualShiftForm.N_NGAY ||
      !manualShiftForm.B_TEN
    ) {
      return 'Vui lòng chọn đầy đủ bác sĩ, phòng, ngày và buổi.';
    }
    if (shiftContext?.doctorSpecialtyMatchesRoom === false) {
      return 'Bác sĩ không thuộc chuyên khoa của phòng đã chọn.';
    }
    if (selectedSessionContext && !selectedSessionContext.canSelect) {
      return selectedSessionContext.reasons[0] || 'Buổi này đang bị chiếm.';
    }
    return null;
  }, [manualShiftForm, selectedSessionContext, shiftContext?.doctorSpecialtyMatchesRoom]);

  const invalidateScheduleWorkflow = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-schedule-workflow-overview'] });
    queryClient.invalidateQueries({ queryKey: ['admin-schedule-templates'] });
    queryClient.invalidateQueries({ queryKey: ['admin-weekly-schedules'] });
    queryClient.invalidateQueries({ queryKey: ['admin-schedule-exceptions'] });
    queryClient.invalidateQueries({ queryKey: ['admin-shift-form-context'] });
  };

  const templateMutation = useMutation({
    mutationFn: async () => {
      if (templateSaveReason) throw new Error(templateSaveReason);

      const payload = {
        BS_MA: Number(templateForm.BS_MA),
        CK_MA: Number(templateForm.CK_MA),
        P_MA: Number(templateForm.P_MA),
        B_TEN: templateForm.B_TEN,
        weekday: Number(templateForm.weekday),
        effectiveStartDate: templateForm.effectiveStartDate,
        effectiveEndDate: templateForm.effectiveEndDate || null,
        status: templateForm.status,
        note: templateForm.note || undefined,
      };

      if (templateForm.id) {
        return adminScheduleWorkflowApi.updateTemplate(templateForm.id, payload);
      }
      return adminScheduleWorkflowApi.createTemplate(payload);
    },
    onSuccess: () => {
      toast.success(templateForm.id ? 'Đã cập nhật mẫu lịch' : 'Đã tạo mẫu lịch');
      setTemplateDialogOpen(false);
      setTemplateForm(EMPTY_TEMPLATE_FORM);
      invalidateScheduleWorkflow();
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message || error?.message || 'Không thể lưu mẫu lịch';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const toggleTemplateMutation = useMutation({
    mutationFn: (template: ScheduleTemplateItem) =>
      adminScheduleWorkflowApi.updateTemplate(template.LBM_ID, {
        status: template.status === 'active' ? 'inactive' : 'active',
      }),
    onSuccess: () => {
      toast.success('Đã cập nhật trạng thái mẫu lịch');
      invalidateScheduleWorkflow();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Không thể cập nhật mẫu lịch';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const validateTemplateBuilderDrop = (
    slot: TemplateBuilderSlot | undefined,
    doctorId: number,
  ): { ok: boolean; reason?: string } => {
    if (!slot) return { ok: false, reason: 'Không tìm thấy slot cần gán.' };
    if (!templateForm.CK_MA) return { ok: false, reason: 'Vui lòng chọn chuyên khoa trước.' };
    const targetDoctor = filteredDoctorsForTemplate.find((doctor) => doctor.BS_MA === doctorId);
    if (!targetDoctor) return { ok: false, reason: 'Bác sĩ không thuộc chuyên khoa đã chọn.' };

    const duplicate = Object.entries(templateBuilderAssignments).find(([slotKey, currentDoctorId]) => {
      if (slotKey === slot.key || currentDoctorId !== doctorId) return false;
      const assignedSlot = templateBuilderSlotMap.get(slotKey);
      return assignedSlot?.weekday === slot.weekday && assignedSlot?.session === slot.session;
    });
    if (duplicate) {
      return { ok: false, reason: 'Bác sĩ đã được gán ở phòng khác trong cùng thứ và buổi.' };
    }

    return { ok: true };
  };

  const copyTemplateBuilderDay = (sourceDay: number, targetDays: number[]) => {
    setTemplateBuilderAssignments((prev) => {
      const next = { ...prev };
      const sourceSlots = templateBuilderSlots.filter((slot) => slot.weekday === sourceDay);
      sourceSlots.forEach((sourceSlot) => {
        const doctorId = prev[sourceSlot.key];
        if (!doctorId) return;
        targetDays.forEach((targetDay) => {
          const targetKey = templateBuilderSlotKey(targetDay, sourceSlot.session, sourceSlot.roomId);
          const targetSlot = templateBuilderSlotMap.get(targetKey);
          const check = validateTemplateBuilderDrop(targetSlot, doctorId);
          if (check.ok) next[targetKey] = doctorId;
        });
      });
      return next;
    });
    toast.success(`Đã sao chép pattern từ ${getWeekdayLabel(sourceDay)}.`);
  };

  const copyTemplateBuilderWholeWeek = () => {
    copyTemplateBuilderDay(1, [2, 3, 4, 5, 6]);
  };

  const clearTemplateBuilderByWeekday = (weekday: number) => {
    setTemplateBuilderAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((slotKey) => {
        const slot = templateBuilderSlotMap.get(slotKey);
        if (slot?.weekday === weekday) next[slotKey] = null;
      });
      return next;
    });
  };

  const clearTemplateBuilderBySession = (session: string) => {
    setTemplateBuilderAssignments((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((slotKey) => {
        const slot = templateBuilderSlotMap.get(slotKey);
        if (slot?.session === session) next[slotKey] = null;
      });
      return next;
    });
  };

  const resetTemplateBuilderAssignments = () => {
    setTemplateBuilderAssignments({});
    toast.success('Đã đặt lại timetable mẫu.');
  };

  const applyLatestActiveTemplate = () => {
    const items = templateBuilderSuggestion?.items ?? [];
    if (items.length === 0) {
      toast.error('Chưa có mẫu gần nhất phù hợp để áp dụng.');
      return;
    }

    const next: Record<string, number | null> = {};
    items.forEach((item) => {
      const slotKey = templateBuilderSlotKey(item.weekday, item.B_TEN, item.P_MA);
      if (!templateBuilderSlotMap.has(slotKey)) return;
      next[slotKey] = item.BS_MA;
    });
    setTemplateBuilderAssignments(next);
    toast.success('Đã tải pattern từ mẫu đang hoạt động gần nhất.');
  };

  const removeDoctorFromTemplateBuilderSlot = (slotKeyValue: string) => {
    setTemplateBuilderAssignments((prev) => ({
      ...prev,
      [slotKeyValue]: null,
    }));
  };

  const templateBuilderMutation = useMutation({
    mutationFn: async () => {
      if (templateBuilderSaveReason) throw new Error(templateBuilderSaveReason);

      const records = Object.entries(templateBuilderAssignments)
        .filter(([, doctorId]) => Boolean(doctorId))
        .map(([slotKey, doctorId]) => {
          const slot = templateBuilderSlotMap.get(slotKey)!;
          return {
            BS_MA: Number(doctorId),
            CK_MA: Number(templateForm.CK_MA),
            P_MA: slot.roomId,
            B_TEN: slot.session,
            weekday: slot.weekday,
            effectiveStartDate: templateForm.effectiveStartDate,
            effectiveEndDate: templateForm.effectiveEndDate || null,
            status: templateForm.status,
            note: templateForm.note || undefined,
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
      setTemplateBuilderOpen(false);
      setTemplateBuilderAssignments({});
      setTemplateBuilderDoctorSearch('');
      invalidateScheduleWorkflow();
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message || error?.message || 'Không thể lưu mẫu lịch.';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => adminScheduleWorkflowApi.generateWeekFromTemplates(weekStart),
    onSuccess: (result) => {
      toast.success(
        `Da dong bo lich tu mau: tao ${result.created}, cap nhat ${result.updated}, huy ${result.cancelled}.`,
      );
      invalidateScheduleWorkflow();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Khong the sinh lich tu mau';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const manualShiftMutation = useMutation({
    mutationFn: async () => {
      if (saveManualShiftReason) throw new Error(saveManualShiftReason);

      const payload = {
        BS_MA: Number(manualShiftForm.BS_MA),
        P_MA: Number(manualShiftForm.P_MA),
        N_NGAY: manualShiftForm.N_NGAY,
        B_TEN: manualShiftForm.B_TEN,
        note: manualShiftForm.note || undefined,
        status: manualShiftForm.status,
      };

      if (manualShiftForm.originalKey) {
        return adminScheduleWorkflowApi.updateManualShift(
          manualShiftForm.originalKey.bsMa,
          manualShiftForm.originalKey.date,
          manualShiftForm.originalKey.session,
          payload,
        );
      }
      return adminScheduleWorkflowApi.createManualShift(payload);
    },
    onSuccess: () => {
      toast.success(manualShiftForm.originalKey ? 'Da cap nhat ca truc' : 'Da them ca truc');
      setManualShiftDialogOpen(false);
      setManualShiftForm(EMPTY_MANUAL_SHIFT_FORM);
      invalidateScheduleWorkflow();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || error?.message || 'Khong the luu ca truc';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: () => {
      const schedule = deleteDialog.schedule!;
      return adminScheduleWorkflowApi.deleteManualShift(
        schedule.BS_MA,
        toDateOnlyIso(schedule.N_NGAY),
        schedule.B_TEN,
      );
    },
    onSuccess: () => {
      toast.success('Da xoa ca truc trong tuan');
      setDeleteDialog({ open: false, schedule: null });
      invalidateScheduleWorkflow();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Khong the xoa ca truc';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const reviewExceptionMutation = useMutation({
    mutationFn: () =>
      adminScheduleWorkflowApi.reviewExceptionRequest(reviewDialog.requestId, {
        status: reviewDialog.targetStatus,
        adminNote: reviewDialog.adminNote || undefined,
      }),
    onSuccess: () => {
      toast.success('Da xu ly yeu cau dieu chinh');
      setReviewDialog({
        open: false,
        requestId: 0,
        requestLabel: '',
        targetStatus: 'approved',
        adminNote: '',
        approvalLabel: '',
        warning: '',
      });
      invalidateScheduleWorkflow();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Khong the xu ly yeu cau';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => adminScheduleWorkflowApi.finalizeWeek(weekStart),
    onSuccess: () => {
      toast.success('Da chot lich lam viec cua tuan');
      invalidateScheduleWorkflow();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Khong the chot lich tuan';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const openSlotsMutation = useMutation({
    mutationFn: () => adminScheduleWorkflowApi.openSlots(weekStart),
    onSuccess: (result: any) => {
      toast.success(`Da mo slot cho tuan nay (${result?.totalSlots ?? 0} slot)`);
      invalidateScheduleWorkflow();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Khong the mo slot cho tuan nay';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const openWeekPicker = () => {
    const input = weekPickerRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
  };

  const openManualShiftDatePicker = () => {
    const input = manualShiftDatePickerRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
  };

  const openTemplateStartPicker = () => {
    const input = templateStartPickerRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
  };

  const openTemplateEndPicker = () => {
    const input = templateEndPickerRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
  };

  const openTemplateDialog = (template?: ScheduleTemplateItem) => {
    if (!template) {
      setTemplateForm({ ...EMPTY_TEMPLATE_FORM, effectiveStartDate: weekStart });
      setTemplateDialogOpen(true);
      return;
    }

    setTemplateForm({
      id: template.LBM_ID,
      BS_MA: String(template.BS_MA),
      CK_MA: String(template.CK_MA),
      P_MA: String(template.P_MA),
      B_TEN: template.B_TEN,
      weekday: String(template.weekday),
      effectiveStartDate: template.effectiveStartDate,
      effectiveEndDate: template.effectiveEndDate || '',
      status: template.status,
      note: template.note || '',
    });
    setTemplateDialogOpen(true);
  };

  const onTemplateBuilderDragStart = (event: DragStartEvent) => {
    const dragData = event.active.data.current as TemplateBuilderDoctorDragData | undefined;
    if (!dragData || dragData.type !== 'doctor') return;
    setTemplateBuilderActiveDoctor(dragData.doctorId);
    setTemplateBuilderActiveDoctorDragData(dragData);
    const node = event.active.rect.current.initial;
    setTemplateBuilderActiveDoctorWidth(node?.width ?? null);
  };

  const onTemplateBuilderDragOver = (event: DragOverEvent) => {
    const dropData = event.over?.data.current as TemplateBuilderSlotDropData | undefined;
    if (!dropData || dropData.type !== 'slot') {
      setTemplateBuilderHoveredSlotKey(null);
      return;
    }
    setTemplateBuilderHoveredSlotKey(dropData.slotKey);
  };

  const onTemplateBuilderDragEnd = (event: DragEndEvent) => {
    setTemplateBuilderHoveredSlotKey(null);
    setTemplateBuilderActiveDoctor(null);
    setTemplateBuilderActiveDoctorDragData(null);

    const dragData = event.active.data.current as TemplateBuilderDoctorDragData | undefined;
    const dropData = event.over?.data.current as TemplateBuilderSlotDropData | undefined;
    if (!dragData || dragData.type !== 'doctor') return;
    if (!dropData || dropData.type !== 'slot') return;

    const targetSlot = templateBuilderSlotMap.get(dropData.slotKey);
    const check = validateTemplateBuilderDrop(targetSlot, dragData.doctorId);
    if (!check.ok) {
      toast.error(check.reason || 'Không thể thả vào slot này.');
      return;
    }

    const currentDoctorId = templateBuilderAssignments[dropData.slotKey];
    if (currentDoctorId && currentDoctorId !== dragData.doctorId) {
      const ok = window.confirm('Slot này đã có bác sĩ. Bạn có muốn ghi đè không?');
      if (!ok) return;
    }

    setTemplateBuilderAssignments((prev) => ({
      ...prev,
      [dropData.slotKey]: dragData.doctorId,
    }));
    toast.success(`Đã gán ${dragData.doctorName} vào slot mẫu.`);
  };

  const onTemplateBuilderDragCancel = () => {
    setTemplateBuilderHoveredSlotKey(null);
    setTemplateBuilderActiveDoctor(null);
    setTemplateBuilderActiveDoctorDragData(null);
  };

  const openManualShiftDialog = (schedule?: WeeklyScheduleItem) => {
    if (!schedule) {
      setManualShiftForm({ ...EMPTY_MANUAL_SHIFT_FORM, N_NGAY: weekStart });
      setManualShiftDialogOpen(true);
      return;
    }

    setManualShiftForm({
      originalKey: {
        bsMa: schedule.BS_MA,
        date: toDateOnlyIso(schedule.N_NGAY),
        session: schedule.B_TEN,
      },
      BS_MA: String(schedule.BS_MA),
      P_MA: String(schedule.P_MA),
      N_NGAY: toDateOnlyIso(schedule.N_NGAY),
      B_TEN: schedule.B_TEN,
      status: schedule.status === 'finalized' ? 'official' : 'approved',
      note: schedule.note || '',
    });
    setManualShiftDialogOpen(true);
  };

  const openArchiveDialog = () => {
    setArchivePreview(null);
    setArchiveDialogOpen(true);
    setArchiveForm((prev) => ({
      ...prev,
      dateFrom: prev.dateFrom || weekOverview?.weekStartDate || '',
      dateTo: prev.dateTo || weekOverview?.weekEndDate || '',
    }));
  };

  const runArchivePreview = async (confirm: boolean) => {
    if (!archiveForm.dateFrom || !archiveForm.dateTo) {
      toast.error('Vui lòng nhập đầy đủ khoảng ngày cần archive.');
      return;
    }
    setArchiveLoading(true);
    try {
      const result = await adminScheduleWorkflowApi.archiveSchedules({
        dateFrom: archiveForm.dateFrom,
        dateTo: archiveForm.dateTo,
        specialtyId:
          archiveForm.specialtyId === 'all'
            ? undefined
            : Number(archiveForm.specialtyId),
        source: archiveForm.source === 'all' ? undefined : archiveForm.source,
        reason: archiveForm.reason || undefined,
        confirm,
      });
      setArchivePreview(result);
      if (confirm) {
        toast.success(`Đã archive ${result.archivedCount ?? 0} ca trực.`);
        setArchiveDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: ['admin-weekly-schedules'] });
        queryClient.invalidateQueries({ queryKey: ['admin-schedule-workflow-overview'] });
      }
    } catch (error: any) {
      toast.error(error?.message || 'Không thể archive lịch trực.');
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Điều phối lịch bác sĩ</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Quản lý mẫu lịch dài hạn, theo dõi lịch tuần được sinh, xử lý ngoại lệ và chốt lịch
            trước khi mở lịch hẹn cho bệnh nhân.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            <WandSparkles className="mr-2 h-4 w-4" />
            {generateMutation.isPending ? 'Đang đồng bộ...' : 'Đồng bộ từ mẫu'}
          </Button>
          <Button
            variant="outline"
            onClick={() => openSlotsMutation.mutate()}
            disabled={openSlotsMutation.isPending}
          >
            <CalendarClock className="mr-2 h-4 w-4" />
            {openSlotsMutation.isPending ? 'Đang mở lịch hẹn...' : 'Mở lịch hẹn'}
          </Button>
          <Button onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            {finalizeMutation.isPending ? 'Đang chốt...' : 'Chốt lịch tuần'}
          </Button>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-7">
          <div className="xl:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Tuần làm việc</label>
            <div className="relative">
              <Input
                type="text"
                readOnly
                value={formatDateDdMmYyyySlash(weekStart)}
                onClick={openWeekPicker}
                className="cursor-pointer"
              />
              <input
                ref={weekPickerRef}
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0"
              />
            </div>
          </div>

          <div className="xl:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Tìm kiếm</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo bác sĩ, phòng, chuyên khoa..."
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Chuyên khoa</label>
            <AdminSelect value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <AdminSelectTrigger>
                <AdminSelectValue placeholder="Tất cả" />
              </AdminSelectTrigger>
              <AdminSelectContent>
                <AdminSelectItem value="all">Tất cả chuyên khoa</AdminSelectItem>
                {(options?.specialties ?? []).map((specialty) => (
                  <AdminSelectItem key={specialty.CK_MA} value={String(specialty.CK_MA)}>
                    {specialty.CK_TEN}
                  </AdminSelectItem>
                ))}
              </AdminSelectContent>
            </AdminSelect>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Bác sĩ</label>
            <AdminSelect value={doctorFilter} onValueChange={setDoctorFilter}>
              <AdminSelectTrigger>
                <AdminSelectValue placeholder="Tất cả" />
              </AdminSelectTrigger>
              <AdminSelectContent>
                <AdminSelectItem value="all">Tất cả bác sĩ</AdminSelectItem>
                {(options?.doctors ?? []).map((doctor) => (
                  <AdminSelectItem key={doctor.BS_MA} value={String(doctor.BS_MA)}>
                    {doctor.BS_HO_TEN}
                  </AdminSelectItem>
                ))}
              </AdminSelectContent>
            </AdminSelect>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phòng</label>
            <AdminSelect value={roomFilter} onValueChange={setRoomFilter}>
              <AdminSelectTrigger>
                <AdminSelectValue placeholder="Tất cả" />
              </AdminSelectTrigger>
              <AdminSelectContent>
                <AdminSelectItem value="all">Tất cả phòng</AdminSelectItem>
                {(options?.rooms ?? []).map((room) => (
                  <AdminSelectItem key={room.P_MA} value={String(room.P_MA)}>
                    {room.P_TEN}
                  </AdminSelectItem>
                ))}
              </AdminSelectContent>
            </AdminSelect>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard
          label="Trạng thái tuần"
          value={
            weekLoading
              ? '...'
              : weekOverviewError
                ? 'Lỗi tải'
                : getWeekWorkflowStatusLabel(weekOverview?.workflowStatus ?? 'generated')
          }
          tone="blue"
        />
        <SummaryCard label="Đã sinh" value={weekOverview?.summary.generated ?? 0} tone="blue" />
        <SummaryCard
          label="Đã xác nhận"
          value={weekOverview?.summary.confirmed ?? 0}
          tone="emerald"
        />
        <SummaryCard
          label="Cần điều chỉnh"
          value={weekOverview?.summary.changeRequested ?? 0}
          tone="rose"
        />
        <SummaryCard
          label="Đã điều chỉnh"
          value={weekOverview?.summary.adjusted ?? 0}
          tone="blue"
        />
        <SummaryCard
          label="Ngoại lệ cần xử lý"
          value={weekOverview?.summary.pendingExceptions ?? 0}
          tone="amber"
        />
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            icon={<Layers3 className="h-5 w-5 text-blue-600" />}
            title="Mẫu lịch dài hạn"
            description="Quản lý lịch chuẩn theo bác sĩ, phòng, chuyên khoa, thứ, buổi và khoảng hiệu lực để sinh lịch tuần."
          />
          <div className="flex flex-wrap items-center gap-2">
            <AdminSelect
              value={templateStatusFilter}
              onValueChange={(value) => setTemplateStatusFilter(value as 'all' | 'active' | 'inactive')}
            >
              <AdminSelectTrigger className="w-[180px]">
                <AdminSelectValue placeholder="Trạng thái mẫu" />
              </AdminSelectTrigger>
              <AdminSelectContent>
                <AdminSelectItem value="all">Tất cả mẫu</AdminSelectItem>
                <AdminSelectItem value="active">Đang hoạt động</AdminSelectItem>
                <AdminSelectItem value="inactive">Đã dừng</AdminSelectItem>
              </AdminSelectContent>
            </AdminSelect>
            <Button onClick={() => navigate('/admin/schedules/plan')}>
              <Plus className="mr-2 h-4 w-4" />
              Phân bổ lịch trực bác sĩ
            </Button>
            <Button variant="outline" onClick={() => navigate('/admin/schedules/templates/new')}>
              Thêm lịch mẫu
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70 hover:bg-gray-50/70">
                <TableHead>Bác sĩ</TableHead>
                <TableHead>Chuyên khoa</TableHead>
                <TableHead>Phòng</TableHead>
                <TableHead>Thứ / buổi</TableHead>
                <TableHead>Hiệu lực</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templatesLoading ? (
                <DataTableLoading colSpan={8} />
              ) : templatesError ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <ErrorState
                      title="Không thể tải mẫu lịch"
                      description="Dữ liệu mẫu lịch chưa được tải thành công. Hãy thử tải lại trang hoặc kiểm tra bộ lọc hiện tại."
                    />
                  </TableCell>
                </TableRow>
              ) : templateItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="p-0">
                    <EmptyState
                      title="Chưa có mẫu lịch phù hợp"
                      description="Hãy điều chỉnh bộ lọc hoặc tạo mẫu lịch dài hạn mới để hệ thống có cơ sở sinh lịch tuần."
                      action={
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => navigate('/admin/schedules/plan')}>
                            <Plus className="mr-2 h-4 w-4" />
                            Phân bổ lịch trực bác sĩ
                          </Button>
                          <Button variant="outline" onClick={() => navigate('/admin/schedules/templates/new')}>
                            Thêm lịch mẫu
                          </Button>
                        </div>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                templateItems.map((item) => (
                  <TableRow key={item.LBM_ID}>
                    <TableCell className="max-w-[220px] truncate font-medium text-gray-900" title={item.doctor.BS_HO_TEN}>
                      {item.doctor.BS_HO_TEN}
                    </TableCell>
                    <TableCell>{item.specialty.CK_TEN}</TableCell>
                    <TableCell>{item.room.P_TEN}</TableCell>
                    <TableCell>
                      {getWeekdayLabel(item.weekday)} - {getSessionLabel(item.B_TEN)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>{formatDateDdMmYyyy(item.effectiveStartDate)}</p>
                        <p>{item.effectiveEndDate ? formatDateDdMmYyyy(item.effectiveEndDate) : 'Không giới hạn'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex rounded-md border px-2.5 py-1 text-xs font-medium',
                          getTemplateStatusBadgeClass(item.status),
                        )}
                      >
                        {getTemplateStatusLabel(item.status)}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[220px] whitespace-normal text-sm leading-6 text-gray-600">
                      {item.note || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openTemplateDialog(item)}>
                          Sửa
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleTemplateMutation.mutate(item)}
                          disabled={toggleTemplateMutation.isPending}
                        >
                          {item.status === 'active' ? 'Dừng' : 'Kích hoạt'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            icon={<CalendarClock className="h-5 w-5 text-emerald-600" />}
            title="Lịch tuần được sinh"
            description="Lịch làm việc cụ thể theo ngày và buổi được sinh từ mẫu dài hạn hoặc điều chỉnh thủ công, dùng để điều phối trước khi chốt tuần."
          />
          <div className="flex flex-wrap items-center gap-2">
            <AdminSelect value={scheduleStatusFilter} onValueChange={setScheduleStatusFilter}>
              <AdminSelectTrigger className="w-[180px]">
                <AdminSelectValue placeholder="Trạng thái lịch" />
              </AdminSelectTrigger>
              <AdminSelectContent>
                <AdminSelectItem value="all">Tất cả trạng thái</AdminSelectItem>
                <AdminSelectItem value="generated">Đã sinh</AdminSelectItem>
                <AdminSelectItem value="confirmed">Đã xác nhận</AdminSelectItem>
                <AdminSelectItem value="change_requested">Cần điều chỉnh</AdminSelectItem>
                <AdminSelectItem value="adjusted">Đã điều chỉnh</AdminSelectItem>
                <AdminSelectItem value="finalized">Chính thức</AdminSelectItem>
                <AdminSelectItem value="vacant_by_leave">Ch? thay th?</AdminSelectItem>
                <AdminSelectItem value="cancelled_by_doctor_leave">Đã hủy do bác sĩ nghỉ</AdminSelectItem>
                <AdminSelectItem value="cancelled">Đã hủy</AdminSelectItem>
              </AdminSelectContent>
            </AdminSelect>
            <AdminSelect value={sourceFilter} onValueChange={setSourceFilter}>
              <AdminSelectTrigger className="w-[180px]">
                <AdminSelectValue placeholder="Nguồn lịch" />
              </AdminSelectTrigger>
              <AdminSelectContent>
                <AdminSelectItem value="all">Tất cả nguồn</AdminSelectItem>
                <AdminSelectItem value="template">Tuần mẫu</AdminSelectItem>
                <AdminSelectItem value="admin_manual">Điều chỉnh tay</AdminSelectItem>
                <AdminSelectItem value="auto_rolling">T? sinh rolling</AdminSelectItem>
                <AdminSelectItem value="copied_1_month">Sao chép 1 tháng</AdminSelectItem>
                <AdminSelectItem value="copied_2_months">Sao chép 2 tháng</AdminSelectItem>
                <AdminSelectItem value="copied_3_months">Sao chép 3 tháng</AdminSelectItem>
                <AdminSelectItem value="legacy_registration">Dữ liệu cũ</AdminSelectItem>
              </AdminSelectContent>
            </AdminSelect>
            <Button variant="outline" onClick={() => openManualShiftDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm / điều chỉnh ca
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span
            className={cn(
              'inline-flex rounded-full border px-3 py-1 font-medium',
              getWeekWorkflowStatusBadgeClass(weekOverview?.workflowStatus ?? 'generated'),
            )}
          >
            {getWeekWorkflowStatusLabel(weekOverview?.workflowStatus ?? 'generated')}
          </span>
          <span className="text-gray-500">
            Tuần {formatDateDdMmYyyy(weekOverview?.weekStartDate)} - {formatDateDdMmYyyy(weekOverview?.weekEndDate)}
          </span>
          {weekOverview?.missingShifts?.totalMissing ? (
            <span className="text-rose-600">
              Thiếu {weekOverview.missingShifts.totalMissing} khung ngày / buổi.
            </span>
          ) : null}
          {schedulesFetching && !schedulesLoading ? (
            <span className="text-blue-600">Đang cập nhật dữ liệu...</span>
          ) : null}
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70 hover:bg-gray-50/70">
                <TableHead>Bác sĩ</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Thứ</TableHead>
                <TableHead>Buổi</TableHead>
                <TableHead>Phòng</TableHead>
                <TableHead>Nguồn</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Slot tối đa</TableHead>
                <TableHead>Ngoại lệ mới nhất</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedulesLoading ? (
                <DataTableLoading colSpan={10} />
              ) : schedulesError ? (
                <TableRow>
                  <TableCell colSpan={10} className="p-0">
                    <ErrorState
                      title="Không thể tải lịch tuần"
                      description="Dữ liệu lịch tuần chưa được tải thành công. Hãy thử tải lại hoặc kiểm tra bộ lọc hiện tại."
                    />
                  </TableCell>
                </TableRow>
              ) : weeklyItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="p-0">
                    <EmptyState
                      title="Chưa có lịch tuần phù hợp"
                      description="Hãy đồng bộ từ mẫu để sinh lịch cho tuần này hoặc nới bộ lọc để xem nhiều bản ghi hơn."
                      action={
                        <Button
                          variant="outline"
                          onClick={() => generateMutation.mutate()}
                          disabled={generateMutation.isPending}
                        >
                          <WandSparkles className="mr-2 h-4 w-4" />
                          {generateMutation.isPending ? 'Đang đồng bộ...' : 'Đồng bộ từ mẫu'}
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                weeklyItems.map((item) => (
                  <TableRow key={`${item.BS_MA}-${item.N_NGAY}-${item.B_TEN}`}>
                    <TableCell className="max-w-[220px] truncate font-medium text-gray-900" title={item.doctor.BS_HO_TEN}>
                      {item.doctor.BS_HO_TEN}
                    </TableCell>
                    <TableCell>{formatDateDdMmYyyy(item.N_NGAY)}</TableCell>
                    <TableCell>{getWeekdayLabelFromDate(item.N_NGAY)}</TableCell>
                    <TableCell>{getSessionLabel(item.B_TEN)}</TableCell>
                    <TableCell>{item.room.P_TEN}</TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {getWeeklyScheduleSourceLabel(item.source)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex rounded-md border px-2.5 py-1 text-xs font-medium',
                          getWeeklyScheduleStatusBadgeClass(item.status),
                        )}
                      >
                        {getWeeklyScheduleStatusLabel(item.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{item.slotMax ?? 5}</TableCell>
                    <TableCell className="max-w-[240px] text-sm leading-6 text-gray-600">
                      {item.latestException ? (
                        <div className="space-y-1">
                          <p>
                            {getExceptionTypeLabel(item.latestException.type)} -{' '}
                            {getExceptionStatusLabel(item.latestException.status)}
                          </p>
                          <p className="truncate text-xs text-gray-500" title={item.latestException.reason}>
                            {item.latestException.reason}
                          </p>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openManualShiftDialog(item)}
                          disabled={item.status === 'cancelled_by_doctor_leave'}
                          title={
                            item.status === 'cancelled_by_doctor_leave'
                              ? 'Ca đã hủy do bác sĩ nghỉ, không thể thay thế.'
                              : undefined
                          }
                        >
                          Sửa
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteDialog({ open: true, schedule: item })}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Xóa
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <PaginationBar
            page={weeklyMeta?.page ?? generatedPage}
            pageSize={weeklyMeta?.limit ?? generatedPageSize}
            total={weeklyMeta?.total ?? 0}
            totalPages={weeklyMeta?.totalPages ?? 0}
            isLoading={schedulesLoading || schedulesFetching}
            onPageChange={(page) => setGeneratedPage(page)}
            onPageSizeChange={(size) => {
              setGeneratedPageSize(size);
              setGeneratedPage(1);
            }}
          />
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            icon={<FileClock className="h-5 w-5 text-amber-600" />}
            title="Yêu cầu ngoại lệ / thay đổi"
            description="Bác sĩ xác nhận lịch đã sinh hoặc gửi yêu cầu xin nghỉ, đổi ca, đổi phòng cho từng ca cụ thể."
          />
          <AdminSelect value={exceptionStatusFilter} onValueChange={setExceptionStatusFilter}>
            <AdminSelectTrigger className="w-[180px]">
              <AdminSelectValue placeholder="Trạng thái yêu cầu" />
            </AdminSelectTrigger>
            <AdminSelectContent>
              <AdminSelectItem value="all">Tất cả yêu cầu</AdminSelectItem>
              <AdminSelectItem value="pending">Chờ xử lý</AdminSelectItem>
              <AdminSelectItem value="approved">Đã duyệt</AdminSelectItem>
              <AdminSelectItem value="rejected">Từ chối</AdminSelectItem>
            </AdminSelectContent>
          </AdminSelect>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/70 hover:bg-gray-50/70">
                <TableHead>Bác sĩ</TableHead>
                <TableHead>Loại yêu cầu</TableHead>
                <TableHead>Ca mục tiêu</TableHead>
                <TableHead>Đề xuất thay đổi</TableHead>
                <TableHead>Lý do</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptionLoading ? (
                <DataTableLoading colSpan={7} />
              ) : exceptionError ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <ErrorState
                      title="Không thể tải yêu cầu ngoại lệ"
                      description="Danh sách yêu cầu thay đổi chưa được tải thành công. Hãy thử tải lại trang hoặc đổi bộ lọc."
                    />
                  </TableCell>
                </TableRow>
              ) : exceptionItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      title="Không có yêu cầu ngoại lệ phù hợp"
                      description="Tuần làm việc hiện không có yêu cầu cần xử lý theo bộ lọc đang chọn."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                exceptionItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="max-w-[220px] truncate font-medium text-gray-900" title={item.doctor.BS_HO_TEN}>
                      {item.doctor.BS_HO_TEN}
                    </TableCell>
                    <TableCell>{getExceptionTypeLabel(item.type)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p>{formatExceptionTarget(item)}</p>
                        {item.type === 'leave' ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={cn(
                                'inline-flex rounded-full border px-2 py-0.5 font-semibold',
                                item.leaveApprovalMode === 'cancel_with_bookings'
                                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                              )}
                            >
                              {item.leaveApprovalMode === 'cancel_with_bookings'
                                ? 'Sẽ hủy lịch khám bệnh nhân'
                                : 'Có thể duyệt nghỉ và thay thế'}
                            </span>
                            <span
                              className={cn(
                                'font-medium',
                                item.affectedBookingCount > 0 ? 'text-rose-700' : 'text-slate-500',
                              )}
                            >
                              Ảnh hưởng: {item.affectedBookingCount} lịch hẹn
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] whitespace-normal text-sm leading-6 text-gray-600">
                      {formatRequestedChange(item)}
                    </TableCell>
                    <TableCell className="max-w-[260px] whitespace-normal text-sm leading-6 text-gray-600">
                      {item.reason}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <span
                          className={cn(
                            'inline-flex rounded-md border px-2.5 py-1 text-xs font-medium',
                            getExceptionStatusBadgeClass(item.status),
                          )}
                        >
                          {getExceptionStatusLabel(item.status)}
                        </span>
                        {item.adminNote ? <p className="text-xs leading-5 text-gray-500">{item.adminNote}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setReviewDialog({
                                open: true,
                                requestId: item.id,
                                requestLabel: `${item.doctor.BS_HO_TEN} - ${formatExceptionTarget(item)}`,
                                targetStatus: 'approved',
                                adminNote: '',
                                approvalLabel: getLeaveApprovalLabel(item),
                                warning: getLeaveApprovalHint(item),
                              })
                            }
                          >
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() =>
                              setReviewDialog({
                                open: true,
                                requestId: item.id,
                                requestLabel: `${item.doctor.BS_HO_TEN} - ${formatExceptionTarget(item)}`,
                                targetStatus: 'rejected',
                                adminNote: '',
                                approvalLabel: '',
                                warning: '',
                              })
                            }
                          >
                            Từ chối
                          </Button>
                        </div>
                      ) : (
                        <div className="text-right text-xs text-gray-400">Đã xử lý</div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={templateBuilderOpen} onOpenChange={setTemplateBuilderOpen}>
        <DialogContent className="sm:max-w-[1200px] p-0 overflow-hidden bg-white shadow-2xl">
          <div className="flex max-h-[88vh] flex-col">
            <DialogHeader className="gap-2 border-b border-slate-200 bg-white px-6 py-4 text-left">
              <DialogTitle className="text-2xl font-semibold text-slate-900">Thêm lịch mẫu</DialogTitle>
              <DialogDescription className="max-w-3xl text-sm leading-6 text-slate-600">
                Tạo mẫu lịch tuần chuẩn để hệ thống sinh lịch trực dài hạn.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Chuyên khoa</label>
                    <AdminSelect
                      value={templateForm.CK_MA}
                      onValueChange={(value) => {
                        setTemplateForm((prev) => ({ ...prev, CK_MA: value }));
                        setTemplateBuilderAssignments({});
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
                        value={
                          templateForm.effectiveStartDate
                            ? formatDateDdMmYyyySlash(templateForm.effectiveStartDate)
                            : ''
                        }
                        onClick={openTemplateStartPicker}
                        className="cursor-pointer"
                        placeholder="dd/MM/yyyy"
                      />
                      <input
                        ref={templateStartPickerRef}
                        type="date"
                        value={templateForm.effectiveStartDate}
                        onChange={(e) =>
                          setTemplateForm((prev) => ({ ...prev, effectiveStartDate: e.target.value }))
                        }
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
                        value={
                          templateForm.effectiveEndDate ? formatDateDdMmYyyySlash(templateForm.effectiveEndDate) : ''
                        }
                        onClick={openTemplateEndPicker}
                        className="cursor-pointer"
                        placeholder="dd/MM/yyyy"
                      />
                      <input
                        ref={templateEndPickerRef}
                        type="date"
                        value={templateForm.effectiveEndDate}
                        onChange={(e) =>
                          setTemplateForm((prev) => ({ ...prev, effectiveEndDate: e.target.value }))
                        }
                        tabIndex={-1}
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Trạng thái</label>
                    <AdminSelect
                      value={templateForm.status}
                      onValueChange={(value) =>
                        setTemplateForm((prev) => ({ ...prev, status: value as 'active' | 'inactive' }))
                      }
                    >
                      <AdminSelectTrigger>
                        <AdminSelectValue placeholder="Chọn trạng thái" />
                      </AdminSelectTrigger>
                      <AdminSelectContent>
                        <AdminSelectItem value="active">Đang hoạt động</AdminSelectItem>
                        <AdminSelectItem value="inactive">Tạm dừng</AdminSelectItem>
                      </AdminSelectContent>
                    </AdminSelect>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ghi chú</label>
                    <Input
                      value={templateForm.note}
                      onChange={(e) => setTemplateForm((prev) => ({ ...prev, note: e.target.value }))}
                      placeholder="Ghi chú cho mẫu"
                    />
                  </div>
                </div>
              </section>

              {!templateForm.CK_MA ? (
                <EmptyState
                  title="Chọn chuyên khoa để bắt đầu tạo lịch mẫu"
                  description="Timetable mini chỉ tải danh sách bác sĩ và phòng sau khi bạn chọn chuyên khoa."
                />
              ) : (
                <DndContext
                  sensors={templateBuilderSensors}
                  onDragStart={onTemplateBuilderDragStart}
                  onDragOver={onTemplateBuilderDragOver}
                  onDragEnd={onTemplateBuilderDragEnd}
                  onDragCancel={onTemplateBuilderDragCancel}
                >
                  <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
                    <div className="space-y-4">
                      <section className="rounded-xl border bg-white p-4 shadow-sm">
                        <div className="relative mb-3">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input
                            className="pl-9"
                            value={templateBuilderDoctorSearch}
                            onChange={(event) => setTemplateBuilderDoctorSearch(event.target.value)}
                            placeholder="Tìm bác sĩ"
                          />
                        </div>

                        {templateBuilderDoctors.length === 0 ? (
                          <EmptyCard
                            title="Không có bác sĩ phù hợp"
                            description="Hãy kiểm tra lại chuyên khoa hoặc từ khóa tìm kiếm."
                          />
                        ) : (
                          <div className="max-h-[45vh] space-y-2 overflow-auto pr-1">
                            {templateBuilderDoctors.map((doctor) => (
                              <TemplateBuilderDoctorCard
                                key={doctor.BS_MA}
                                id={doctor.BS_MA}
                                specialtyId={doctor.CK_MA}
                                name={doctor.BS_HO_TEN}
                                specialtyName={doctor.CHUYEN_KHOA.CK_TEN}
                                assignedCount={templateBuilderAssignedCountByDoctor.get(doctor.BS_MA) ?? 0}
                                active={templateBuilderActiveDoctor === doctor.BS_MA}
                                disabled={false}
                              />
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="rounded-xl border bg-white p-4 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900">Thao tác nhanh</h3>
                        <div className="mt-3 grid gap-2">
                          <Button variant="outline" onClick={() => copyTemplateBuilderDay(1, [3, 5])}>
                            Sao chép Thứ 2 sang Thứ 4, 6
                          </Button>
                          <Button variant="outline" onClick={() => copyTemplateBuilderDay(2, [4, 6])}>
                            Sao chép Thứ 3 sang Thứ 5, 7
                          </Button>
                          <Button variant="outline" onClick={copyTemplateBuilderWholeWeek}>
                            <Copy className="mr-2 h-4 w-4" />
                            Sao chép cả tuần
                          </Button>
                          <AdminSelect
                            onValueChange={(value) => clearTemplateBuilderByWeekday(Number(value))}
                          >
                            <AdminSelectTrigger>
                              <AdminSelectValue placeholder="Xóa theo ngày" />
                            </AdminSelectTrigger>
                            <AdminSelectContent>
                              {TEMPLATE_BUILDER_WEEKDAYS.map((weekday) => (
                                <AdminSelectItem key={weekday} value={String(weekday)}>
                                  {getWeekdayLabel(weekday)}
                                </AdminSelectItem>
                              ))}
                            </AdminSelectContent>
                          </AdminSelect>
                          <AdminSelect onValueChange={clearTemplateBuilderBySession}>
                            <AdminSelectTrigger>
                              <AdminSelectValue placeholder="Xóa theo buổi" />
                            </AdminSelectTrigger>
                            <AdminSelectContent>
                              {templateBuilderSessions.map((session) => (
                                <AdminSelectItem key={session.B_TEN} value={session.B_TEN}>
                                  {getSessionLabel(session.B_TEN)}
                                </AdminSelectItem>
                              ))}
                            </AdminSelectContent>
                          </AdminSelect>
                          <Button variant="outline" onClick={applyLatestActiveTemplate}>
                            Lấy từ mẫu đang hoạt động gần nhất
                          </Button>
                          <Button variant="outline" onClick={resetTemplateBuilderAssignments}>
                            <Eraser className="mr-2 h-4 w-4" />
                            Đặt lại
                          </Button>
                        </div>
                      </section>
                    </div>

                    <section className="rounded-xl border bg-white p-4 shadow-sm">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">Mini timetable tuần mẫu</h3>
                          <p className="text-xs text-slate-500">Kéo thả bác sĩ vào các slot phòng theo thứ và buổi</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-slate-700">Trống</span>
                          <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-700">
                            Đã có mẫu
                          </span>
                          <span className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-rose-700">Trùng</span>
                        </div>
                      </div>

                      {filteredRoomsForTemplate.length === 0 ? (
                        <EmptyCard
                          title="Không có phòng phù hợp"
                          description="Vui lòng kiểm tra cấu hình phòng thuộc chuyên khoa đã chọn."
                        />
                      ) : templateBuilderSessions.length === 0 ? (
                        <EmptyCard title="Không có buổi khám" description="Vui lòng cấu hình buổi khám trước khi tạo mẫu." />
                      ) : (
                        <div className="overflow-auto">
                          <table className="min-w-[980px] border-separate border-spacing-0">
                            <thead>
                              <tr>
                                <th className="sticky left-0 z-20 w-[140px] border border-slate-200 bg-slate-100 p-2 text-left text-xs font-semibold text-slate-700">
                                  Buổi
                                </th>
                                {TEMPLATE_BUILDER_WEEKDAYS.map((weekday) => (
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
                              {templateBuilderSessions.map((session) => (
                                <tr key={session.B_TEN}>
                                  <td className="sticky left-0 z-10 border border-slate-200 bg-white p-2 align-top">
                                    <div className="text-sm font-semibold text-slate-700">
                                      {getSessionLabel(session.B_TEN)}
                                    </div>
                                  </td>
                                  {TEMPLATE_BUILDER_WEEKDAYS.map((weekday) => (
                                    <td
                                      key={`${session.B_TEN}-${weekday}`}
                                      className="border border-slate-200 bg-white p-2 align-top"
                                    >
                                      <div className="space-y-2">
                                        {filteredRoomsForTemplate.map((room) => {
                                          const key = templateBuilderSlotKey(weekday, session.B_TEN, room.P_MA);
                                          const slot = templateBuilderSlotMap.get(key);
                                          if (!slot) return null;
                                          const assignedDoctorId = templateBuilderAssignments[key];
                                          const doctorName = assignedDoctorId
                                            ? templateBuilderDoctorNameById.get(assignedDoctorId) ||
                                              `BS #${assignedDoctorId}`
                                            : null;
                                          const dropCheck =
                                            templateBuilderActiveDoctor != null
                                              ? validateTemplateBuilderDrop(slot, templateBuilderActiveDoctor)
                                              : { ok: true };

                                          return (
                                            <TemplateBuilderSlotCard
                                              key={key}
                                              slot={slot}
                                              roomName={
                                                templateBuilderRoomNameById.get(room.P_MA) || `Phòng ${room.P_MA}`
                                              }
                                              doctorName={doctorName}
                                              hasConflict={templateBuilderConflicts.has(key)}
                                              canDrop={dropCheck.ok}
                                              dropReason={dropCheck.reason}
                                              dragging={templateBuilderActiveDoctor != null}
                                              disabled={false}
                                              onRemoveDoctor={removeDoctorFromTemplateBuilderSlot}
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
                    {templateBuilderActiveDoctor && templateBuilderActiveDoctorDragData ? (
                      <div
                        className={cn(
                          'rounded-lg border border-blue-300 bg-white p-3 text-sm shadow-xl ring-1 ring-blue-200',
                          templateBuilderHoveredSlotKey && 'border-blue-500',
                        )}
                        style={templateBuilderActiveDoctorWidth ? { width: templateBuilderActiveDoctorWidth } : undefined}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-slate-900">
                            {templateBuilderActiveDoctorDragData.doctorName ||
                              `BS #${templateBuilderActiveDoctor}`}
                          </div>
                          <GripVertical className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{templateBuilderActiveDoctorDragData.specialtyName}</div>
                        <div className="mt-2 inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          {templateBuilderActiveDoctorDragData.assignedCount} slot mẫu
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded bg-white px-2 py-1">Tổng slot: {templateBuilderSummary.total}</span>
                  <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">
                    Đã gán: {templateBuilderSummary.assigned}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-1">Trống: {templateBuilderSummary.empty}</span>
                  <span className="rounded bg-rose-50 px-2 py-1 text-rose-700">
                    Xung đột: {templateBuilderSummary.conflicts}
                  </span>
                </div>
              </section>

              {templateBuilderSaveReason ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {templateBuilderSaveReason}
                </div>
              ) : null}
            </div>

            <DialogFooter className="!mx-0 !mb-0 border-t border-slate-200 bg-white px-6 py-4">
              <Button variant="outline" onClick={() => setTemplateBuilderOpen(false)}>
                Đóng
              </Button>
              <Button
                onClick={() => templateBuilderMutation.mutate()}
                disabled={templateBuilderMutation.isPending || Boolean(templateBuilderSaveReason)}
              >
                {templateBuilderMutation.isPending ? 'Đang lưu...' : 'Lưu mẫu lịch'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-white shadow-2xl">
          <div className="flex max-h-[85vh] flex-col">
            <DialogHeader className="gap-2 border-b border-slate-200 bg-white px-6 py-4 text-left">
              <DialogTitle className="text-2xl font-semibold text-slate-900">
                {templateForm.id ? 'Cập nhật mẫu lịch' : 'Thêm mẫu lịch'}
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                Mẫu lịch là cấu hình dài hạn để hệ thống tự sinh lịch tuần cho bác sĩ.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Thông tin mẫu lịch</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Chọn đầy đủ chuyên khoa, bác sĩ, phòng, buổi và khoảng hiệu lực để tạo mẫu.
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Chuyên khoa
                    </label>
                    <AdminSelect
                      value={templateForm.CK_MA}
                      onValueChange={(value) =>
                        setTemplateForm((prev) => ({ ...prev, CK_MA: value, BS_MA: '', P_MA: '' }))
                      }
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
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Bác sĩ
                    </label>
                    <AdminSelect
                      value={templateForm.BS_MA}
                      onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, BS_MA: value }))}
                    >
                      <AdminSelectTrigger>
                        <AdminSelectValue placeholder="Chọn bác sĩ" />
                      </AdminSelectTrigger>
                      <AdminSelectContent>
                        {filteredDoctorsForTemplate.map((doctor) => (
                          <AdminSelectItem key={doctor.BS_MA} value={String(doctor.BS_MA)}>
                            {doctor.BS_HO_TEN}
                          </AdminSelectItem>
                        ))}
                      </AdminSelectContent>
                    </AdminSelect>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Phòng
                    </label>
                    <AdminSelect
                      value={templateForm.P_MA}
                      onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, P_MA: value }))}
                    >
                      <AdminSelectTrigger>
                        <AdminSelectValue placeholder="Chọn phòng" />
                      </AdminSelectTrigger>
                      <AdminSelectContent>
                        {filteredRoomsForTemplate.map((room) => (
                          <AdminSelectItem key={room.P_MA} value={String(room.P_MA)}>
                            {room.P_TEN}
                          </AdminSelectItem>
                        ))}
                      </AdminSelectContent>
                    </AdminSelect>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Buổi
                    </label>
                    <AdminSelect
                      value={templateForm.B_TEN}
                      onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, B_TEN: value }))}
                    >
                      <AdminSelectTrigger>
                        <AdminSelectValue placeholder="Chọn buổi" />
                      </AdminSelectTrigger>
                      <AdminSelectContent>
                        {(options?.sessions ?? []).map((session) => (
                          <AdminSelectItem key={session.B_TEN} value={session.B_TEN}>
                            {getSessionLabel(session.B_TEN)}
                          </AdminSelectItem>
                        ))}
                      </AdminSelectContent>
                    </AdminSelect>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Thứ
                    </label>
                    <AdminSelect
                      value={templateForm.weekday}
                      onValueChange={(value) => setTemplateForm((prev) => ({ ...prev, weekday: value }))}
                    >
                      <AdminSelectTrigger>
                        <AdminSelectValue placeholder="Chọn thứ" />
                      </AdminSelectTrigger>
                      <AdminSelectContent>
                        {WEEKDAY_OPTIONS.map((weekday) => (
                          <AdminSelectItem key={weekday} value={String(weekday)}>
                            {getWeekdayLabel(weekday)}
                          </AdminSelectItem>
                        ))}
                      </AdminSelectContent>
                    </AdminSelect>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Trạng thái
                    </label>
                    <AdminSelect
                      value={templateForm.status}
                      onValueChange={(value) =>
                        setTemplateForm((prev) => ({ ...prev, status: value as 'active' | 'inactive' }))
                      }
                    >
                      <AdminSelectTrigger>
                        <AdminSelectValue placeholder="Chọn trạng thái" />
                      </AdminSelectTrigger>
                      <AdminSelectContent>
                        <AdminSelectItem value="active">Đang hoạt động</AdminSelectItem>
                        <AdminSelectItem value="inactive">Đã dừng</AdminSelectItem>
                      </AdminSelectContent>
                    </AdminSelect>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Bắt đầu
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        readOnly
                        value={
                          templateForm.effectiveStartDate
                            ? formatDateDdMmYyyySlash(templateForm.effectiveStartDate)
                            : ''
                        }
                        onClick={openTemplateStartPicker}
                        className="cursor-pointer"
                        placeholder="dd/MM/yyyy"
                      />
                      <input
                        ref={templateStartPickerRef}
                        type="date"
                        value={templateForm.effectiveStartDate}
                        onChange={(e) =>
                          setTemplateForm((prev) => ({ ...prev, effectiveStartDate: e.target.value }))
                        }
                        tabIndex={-1}
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Kết thúc
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        readOnly
                        value={templateForm.effectiveEndDate ? formatDateDdMmYyyySlash(templateForm.effectiveEndDate) : ''}
                        onClick={openTemplateEndPicker}
                        className="cursor-pointer"
                        placeholder="dd/MM/yyyy"
                      />
                      <input
                        ref={templateEndPickerRef}
                        type="date"
                        value={templateForm.effectiveEndDate}
                        onChange={(e) =>
                          setTemplateForm((prev) => ({ ...prev, effectiveEndDate: e.target.value }))
                        }
                        tabIndex={-1}
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-0"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Ghi chú
                    </label>
                    <Textarea
                      value={templateForm.note}
                      onChange={(e) => setTemplateForm((prev) => ({ ...prev, note: e.target.value }))}
                      placeholder="Nhập ghi chú cho mẫu lịch"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Tóm tắt mẫu lịch</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Kiểm tra nhanh thông tin cấu hình trước khi lưu.
                  </p>
                </div>

                {templateSaveReason ? (
                  <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                    Vui lòng chọn đầy đủ bác sĩ, chuyên khoa, phòng, buổi và ngày bắt đầu để hệ thống
                    kiểm tra mẫu lịch phù hợp.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <p className="text-xs font-semibold text-slate-500">Bác sĩ</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {selectedTemplateDoctor?.BS_HO_TEN || '-'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <p className="text-xs font-semibold text-slate-500">Chuyên khoa</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {selectedTemplateSpecialty?.CK_TEN || '-'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <p className="text-xs font-semibold text-slate-500">Phòng</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {selectedTemplateRoom?.P_TEN || '-'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <p className="text-xs font-semibold text-slate-500">Buổi</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {templateForm.B_TEN ? getSessionLabel(templateForm.B_TEN) : '-'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <p className="text-xs font-semibold text-slate-500">Thứ</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {templateForm.weekday ? getWeekdayLabel(Number(templateForm.weekday)) : '-'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <p className="text-xs font-semibold text-slate-500">Hiệu lực</p>
                      <p className="mt-1 font-medium text-slate-900">
                        {formatDateDdMmYyyySlash(templateForm.effectiveStartDate)}
                        {templateForm.effectiveEndDate
                          ? ` \u2013 ${formatDateDdMmYyyySlash(templateForm.effectiveEndDate)}`
                          : ' \u2013 Không giới hạn'}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {templateSaveReason ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {templateSaveReason}
                </div>
              ) : null}
            </div>

            <DialogFooter className="!mx-0 !mb-0 border-t border-slate-200 bg-white px-6 py-4">
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                Đóng
              </Button>
              <Button onClick={() => templateMutation.mutate()} disabled={templateMutation.isPending}>
                {templateMutation.isPending ? 'Đang lưu...' : 'Lưu mẫu lịch'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Archive lịch trực cũ</DialogTitle>
            <DialogDescription>
              Lưu trữ lịch trực cũ theo khoảng ngày, không xóa cứng dữ liệu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Từ ngày</label>
                  <Input
                    type="date"
                    value={archiveForm.dateFrom}
                    onChange={(e) =>
                      setArchiveForm((prev) => ({ ...prev, dateFrom: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Đến ngày</label>
                  <Input
                    type="date"
                    value={archiveForm.dateTo}
                    onChange={(e) =>
                      setArchiveForm((prev) => ({ ...prev, dateTo: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Chuyên khoa</label>
                  <AdminSelect
                    value={archiveForm.specialtyId}
                    onValueChange={(value) =>
                      setArchiveForm((prev) => ({ ...prev, specialtyId: value }))
                    }
                  >
                    <AdminSelectTrigger>
                      <AdminSelectValue placeholder="Chọn chuyên khoa" />
                    </AdminSelectTrigger>
                    <AdminSelectContent>
                      <AdminSelectItem value="all">Tất cả</AdminSelectItem>
                      {(options?.specialties ?? []).map((item) => (
                        <AdminSelectItem key={item.CK_MA} value={String(item.CK_MA)}>
                          {item.CK_TEN}
                        </AdminSelectItem>
                      ))}
                    </AdminSelectContent>
                  </AdminSelect>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nguồn lịch</label>
                  <AdminSelect
                    value={archiveForm.source}
                    onValueChange={(value) =>
                      setArchiveForm((prev) => ({ ...prev, source: value }))
                    }
                  >
                    <AdminSelectTrigger>
                      <AdminSelectValue placeholder="Chọn nguồn" />
                    </AdminSelectTrigger>
                    <AdminSelectContent>
                      <AdminSelectItem value="all">Tất cả</AdminSelectItem>
                      <AdminSelectItem value="template">Tuần mẫu</AdminSelectItem>
                      <AdminSelectItem value="auto_rolling">T? sinh rolling</AdminSelectItem>
                      <AdminSelectItem value="copied_1_month">Sao chép 1 tháng</AdminSelectItem>
                      <AdminSelectItem value="copied_2_months">Sao chép 2 tháng</AdminSelectItem>
                      <AdminSelectItem value="copied_3_months">Sao chép 3 tháng</AdminSelectItem>
                      <AdminSelectItem value="admin_manual">Điều chỉnh tay</AdminSelectItem>
                      <AdminSelectItem value="legacy_registration">Dữ liệu cũ</AdminSelectItem>
                    </AdminSelectContent>
                  </AdminSelect>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">L? do</label>
                  <Textarea
                    value={archiveForm.reason}
                    onChange={(e) =>
                      setArchiveForm((prev) => ({ ...prev, reason: e.target.value }))
                    }
                    placeholder="Ví dụ: Dọn lịch cũ để thay thế lịch chuẩn"
                  />
                </div>
              </div>
            </section>

            {archivePreview ? (
              <section className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>Tổng ca xét: <span className="font-semibold">{archivePreview.total}</span></div>
                  <div>Đủ điều kiện: <span className="font-semibold">{archivePreview.eligible}</span></div>
                  <div>?? archive: <span className="font-semibold">{archivePreview.alreadyArchived}</span></div>
                  <div>Vướng lịch hẹn: <span className="font-semibold">{archivePreview.skippedWithBookings}</span></div>
                  <div>Đang có yêu cầu: <span className="font-semibold">{archivePreview.skippedWithPendingRequests}</span></div>
                </div>
              </section>
            ) : null}

            {archiveLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                ?ang x? l?...
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>
              Đóng
            </Button>
            <Button variant="secondary" onClick={() => runArchivePreview(false)} disabled={archiveLoading}>
              Xem trước
            </Button>
            <Button
              variant="destructive"
              onClick={() => runArchivePreview(true)}
              disabled={archiveLoading || !archivePreview}
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog><Dialog open={manualShiftDialogOpen} onOpenChange={setManualShiftDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader className="gap-2">
            <DialogTitle className="text-xl font-semibold text-slate-900">
              {manualShiftForm.originalKey ? 'Cập nhật ca trong tuần' : 'Thêm ca trong tuần'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              Dùng để bổ sung hoặc điều chỉnh ca trực đã sinh, đảm bảo dữ liệu phù hợp trước khi
              chốt lịch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Thông tin ca trực</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Điền đầy đủ ngày, phòng, buổi và bác sĩ để kiểm tra khả năng bố trí.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ngày</label>
                  <div className="relative">
                    <Input
                      type="text"
                      readOnly
                      value={formatDateDdMmYyyySlash(manualShiftForm.N_NGAY)}
                      onClick={openManualShiftDatePicker}
                      className="cursor-pointer"
                      placeholder="dd/MM/yyyy"
                    />
                    <input
                      ref={manualShiftDatePickerRef}
                      type="date"
                      value={manualShiftForm.N_NGAY}
                      onChange={(e) =>
                        setManualShiftForm((prev) => ({ ...prev, N_NGAY: e.target.value }))
                      }
                      tabIndex={-1}
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-0"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Phòng</label>
                  <AdminSelect
                    value={manualShiftForm.P_MA}
                    onValueChange={(value) =>
                      setManualShiftForm((prev) => ({ ...prev, P_MA: value, BS_MA: '', B_TEN: '' }))
                    }
                  >
                    <AdminSelectTrigger>
                      <AdminSelectValue placeholder="Chọn phòng" />
                    </AdminSelectTrigger>
                    <AdminSelectContent>
                      {(options?.rooms ?? []).map((room) => (
                        <AdminSelectItem key={room.P_MA} value={String(room.P_MA)}>
                          {room.P_TEN}
                        </AdminSelectItem>
                      ))}
                    </AdminSelectContent>
                  </AdminSelect>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Buổi</label>
                  <AdminSelect
                    value={manualShiftForm.B_TEN}
                    onValueChange={(value) =>
                      setManualShiftForm((prev) => ({ ...prev, B_TEN: value }))
                    }
                  >
                    <AdminSelectTrigger>
                      <AdminSelectValue placeholder="Chọn buổi" />
                    </AdminSelectTrigger>
                    <AdminSelectContent>
                      {(options?.sessions ?? []).map((session) => {
                        const ctx = shiftContextMap.get(session.B_TEN);
                        return (
                          <AdminSelectItem
                            key={session.B_TEN}
                            value={session.B_TEN}
                            disabled={Boolean(ctx && !ctx.canSelect)}
                          >
                            {getSessionLabel(session.B_TEN)}
                          </AdminSelectItem>
                        );
                      })}
                    </AdminSelectContent>
                  </AdminSelect>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Bác sĩ
                  </label>
                  <AdminSelect
                    value={manualShiftForm.BS_MA}
                    onValueChange={(value) =>
                      setManualShiftForm((prev) => ({ ...prev, BS_MA: value }))
                    }
                  >
                    <AdminSelectTrigger>
                      <AdminSelectValue placeholder="Chọn bác sĩ" />
                    </AdminSelectTrigger>
                    <AdminSelectContent>
                      {filteredDoctorsForManualShift.map((doctor) => (
                        <AdminSelectItem key={doctor.BS_MA} value={String(doctor.BS_MA)}>
                          {doctor.BS_HO_TEN}
                        </AdminSelectItem>
                      ))}
                    </AdminSelectContent>
                  </AdminSelect>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Trạng thái
                  </label>
                  <AdminSelect
                    value={manualShiftForm.status}
                    onValueChange={(value) =>
                      setManualShiftForm((prev) => ({
                        ...prev,
                        status: value as 'approved' | 'official',
                      }))
                    }
                  >
                    <AdminSelectTrigger>
                      <AdminSelectValue placeholder="Chọn trạng thái" />
                    </AdminSelectTrigger>
                    <AdminSelectContent>
                      <AdminSelectItem value="approved">Đã duyệt</AdminSelectItem>
                      <AdminSelectItem value="official">Chính thức</AdminSelectItem>
                    </AdminSelectContent>
                  </AdminSelect>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Ghi chú
                  </label>
                  <Textarea
                    value={manualShiftForm.note}
                    onChange={(e) =>
                      setManualShiftForm((prev) => ({ ...prev, note: e.target.value }))
                    }
                    placeholder="Nhập ghi chú cho ca trực"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Kiểm tra khả năng bố trí</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Đánh giá nhanh tình trạng từng buổi trong ngày dựa trên dữ liệu hiện tại.
                  </p>
                </div>
                {shiftContextLoading ? (
                  <span className="text-xs font-medium text-slate-500">
                    Đang tải kiểm tra...
                  </span>
                ) : null}
              </div>

              {!manualShiftForm.BS_MA ||
              !manualShiftForm.P_MA ||
              !manualShiftForm.N_NGAY ||
              !manualShiftForm.B_TEN ? (
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  Vui lòng chọn đầy đủ bác sĩ, phòng, ngày và buổi để kiểm tra khả năng bố trí.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {(options?.sessions ?? []).map((session) => {
                    const ctx = shiftContextMap.get(session.B_TEN);
                    const blocked = Boolean(ctx && !ctx.canSelect);
                    return (
                      <div
                        key={session.B_TEN}
                        className="rounded-xl border border-slate-200 bg-white p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900">
                            {getSessionLabel(session.B_TEN)}
                          </p>
                          <span
                            className={cn(
                              'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                              blocked
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                            )}
                          >
                            {blocked ? 'Đang bị chiếm' : 'Có thể bố trí'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-600">
                          {ctx?.reasons[0] ||
                            (ctx?.room.occupied || ctx?.doctor.occupied
                              ? 'Phòng hoặc bác sĩ đã có ca trùng trong buổi này.'
                              : 'Ca này hiện chưa phát hiện xung đột.')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {saveManualShiftReason ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {saveManualShiftReason}
                </div>
              ) : null}
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualShiftDialogOpen(false)}>
              Đóng
            </Button>
            <Button
              onClick={() => manualShiftMutation.mutate()}
              disabled={manualShiftMutation.isPending || shiftContextLoading}
            >
              {manualShiftMutation.isPending ? 'Đang lưu...' : 'Lưu ca trực'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reviewDialog.open}
        onOpenChange={(open) => setReviewDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.targetStatus === 'approved'
                ? reviewDialog.approvalLabel || 'Duyệt yêu cầu'
                : 'Từ chối yêu cầu'}
            </DialogTitle>
            <DialogDescription>{reviewDialog.requestLabel}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Ghi chu admin</label>
            <Textarea
              value={reviewDialog.adminNote}
              onChange={(e) => setReviewDialog((prev) => ({ ...prev, adminNote: e.target.value }))}
            />
            {reviewDialog.warning ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {reviewDialog.warning}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog((prev) => ({ ...prev, open: false }))}>
              Dong
            </Button>
            <Button
              onClick={() => reviewExceptionMutation.mutate()}
              disabled={reviewExceptionMutation.isPending}
            >
              {reviewExceptionMutation.isPending
                ? '?ang x? l?...'
                : reviewDialog.targetStatus === 'approved'
                  ? reviewDialog.approvalLabel || 'Duyệt yêu cầu'
                  : 'Từ chối yêu cầu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Xoa ca truc trong tuan
            </DialogTitle>
            <DialogDescription>
              {deleteDialog.schedule
                ? `${deleteDialog.schedule.doctor.BS_HO_TEN} - ${formatDateDdMmYyyy(deleteDialog.schedule.N_NGAY)} - ${getSessionLabel(deleteDialog.schedule.B_TEN)}`
                : '-'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, schedule: null })}>
              Dong
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteShiftMutation.mutate()}
              disabled={deleteShiftMutation.isPending}
            >
              {deleteShiftMutation.isPending ? 'Dang xoa...' : 'Xac nhan xoa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
