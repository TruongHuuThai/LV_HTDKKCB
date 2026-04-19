import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, UserRound } from 'lucide-react';

import { doctorScheduleWorkflowApi } from '@/services/api/scheduleWorkflowApi';
import { doctorAppointmentsApi, type DoctorWorklistItem } from '@/services/api/doctorAppointmentsApi';
import { formatDateDdMmYyyy, formatDateDdMmYyyySlash, getSessionLabel, getWeekdayLabelFromDate } from '@/lib/scheduleDisplay';
import {
  buildTimetableCellMap,
  getNextWeekStartIso,
  getWeekDates,
  hasAnyTimetableData,
  shiftWeekStart,
  type ShiftCode,
  type TimetableCellData,
  type TimetableCellKey,
} from '@/lib/doctorScheduleTimetableMapper';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const DISPLAY_SHIFTS: ShiftCode[] = ['SANG', 'CHIEU'];

function formatTime(value?: string | null) {
  if (!value) return '--:--';
  const match = value.match(/(\d{2}:\d{2})/);
  return match?.[1] || value.slice(0, 5);
}

function isToday(date: string) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return date === today;
}

function getCellTitle(date: string, shift: ShiftCode) {
  return `${getWeekdayLabelFromDate(date)} - ${formatDateDdMmYyyy(date)} - ${getSessionLabel(shift)}`;
}

export default function DoctorWeeklyScheduleWorkflowPage() {
  const [weekStart, setWeekStart] = useState(getNextWeekStartIso());
  const [selectedCell, setSelectedCell] = useState<{ date: string; shift: ShiftCode } | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<DoctorWorklistItem | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const weekPickerRef = useRef<HTMLInputElement>(null);

  const schedulesQuery = useQuery({
    queryKey: ['doctor-weekly-schedule-timetable', weekStart],
    queryFn: () => doctorScheduleWorkflowApi.getWeeklySchedules(weekStart),
  });

  const worklistQuery = useQuery({
    queryKey: ['doctor-cell-worklist', selectedCell?.date, selectedCell?.shift],
    queryFn: () =>
      doctorAppointmentsApi.getWorklist({
        date: selectedCell!.date,
        shift: selectedCell!.shift,
        limit: 100,
      }),
    enabled: Boolean(selectedCell),
  });

  const quickInfoQuery = useQuery({
    queryKey: ['doctor-patient-quick-info', selectedPatient?.DK_MA],
    queryFn: () => doctorAppointmentsApi.getPreVisitInfo(selectedPatient!.DK_MA),
    enabled: Boolean(selectedPatient),
  });

  const weeklyItems = schedulesQuery.data?.items ?? [];
  const weekDates = useMemo(() => getWeekDates(weekStart, weeklyItems), [weekStart, weeklyItems]);
  const cellMap = useMemo(() => buildTimetableCellMap(weeklyItems), [weeklyItems]);
  const hasWeekData = hasAnyTimetableData(weeklyItems);

  const openWeekPicker = () => {
    const input = weekPickerRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.focus();
  };

  const handleExportWorklistPdf = async () => {
    if (!selectedCell) return;
    setExportError(null);
    setIsExportingPdf(true);
    try {
      await doctorAppointmentsApi.exportWorklistPdf({
        date: selectedCell.date,
        shift: selectedCell.shift,
      });
    } catch {
      setExportError('Không thể xuất file PDF cho ca này.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6 xl:p-8">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lịch làm việc bác sĩ</h1>
          <p className="text-sm text-slate-500">Bảng lịch khám theo tuần (Sáng / Chiều).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart((prev) => shiftWeekStart(prev, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="relative">
            <Input
              type="text"
              readOnly
              value={formatDateDdMmYyyySlash(weekStart)}
              onClick={openWeekPicker}
              className="w-[150px] cursor-pointer bg-white text-center"
            />
            <input
              ref={weekPickerRef}
              type="date"
              value={weekStart}
              onChange={(event) => setWeekStart(event.target.value)}
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => setWeekStart((prev) => shiftWeekStart(prev, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {schedulesQuery.isLoading ? (
        <Card className="rounded-xl border-slate-200">
          <CardContent className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={`doctor-table-skeleton-${idx}`} className="h-20 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : schedulesQuery.isError ? (
        <Card className="rounded-xl border-rose-200 bg-rose-50">
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm text-rose-700">
            <p>Không thể tải lịch khám tuần này.</p>
            <Button variant="outline" className="border-rose-200 bg-white text-rose-700" onClick={() => schedulesQuery.refetch()}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : !hasWeekData ? (
        <Card className="rounded-xl border-slate-200">
          <CardContent className="space-y-3 p-8 text-center">
            <p className="text-sm text-slate-500">Tuần này bạn chưa có lịch khám.</p>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => setWeekStart((prev) => shiftWeekStart(prev, -7))}>
                Xem tuần trước
              </Button>
              <Button variant="outline" onClick={() => setWeekStart((prev) => shiftWeekStart(prev, 7))}>
                Xem tuần sau
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Thứ / ngày</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Sáng</th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">Chiều</th>
                </tr>
              </thead>
              <tbody>
                {weekDates.map((date) => (
                  <tr
                    key={`row-${date}`}
                    className={cn('border-b border-slate-100 last:border-b-0', isToday(date) && 'bg-blue-50/40')}
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-slate-900">{getWeekdayLabelFromDate(date)}</p>
                      <p className="text-slate-500">{formatDateDdMmYyyy(date)}</p>
                    </td>

                    {DISPLAY_SHIFTS.map((shift) => {
                      const key: TimetableCellKey = `${date}__${shift}`;
                      const cell = cellMap.get(key);
                      const hasData = Boolean(cell?.hasData);

                      return (
                        <td key={key} className="px-4 py-3 align-top">
                          <CellButton
                            cell={cell}
                            hasData={hasData}
                            onClick={() => {
                              if (!hasData) return;
                              setExportError(null);
                              setSelectedCell({ date, shift });
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(selectedCell)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCell(null);
            setSelectedPatient(null);
            setExportError(null);
            setIsExportingPdf(false);
          }
        }}
      >
        <DialogContent className="bg-white sm:max-w-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <DialogTitle>Danh sách bệnh nhân</DialogTitle>
                <DialogDescription>{selectedCell ? getCellTitle(selectedCell.date, selectedCell.shift) : '-'}</DialogDescription>
              </div>
              <Button
                variant="outline"
                className="bg-white"
                onClick={handleExportWorklistPdf}
                disabled={isExportingPdf || !selectedCell}
              >
                {isExportingPdf ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
                Xuất PDF
              </Button>
            </div>
          </DialogHeader>

          {exportError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {exportError}
            </div>
          ) : null}

          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {worklistQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải danh sách bệnh nhân...
              </div>
            ) : worklistQuery.isError ? (
              <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <p>Không thể tải danh sách bệnh nhân của ca này.</p>
                <Button variant="outline" className="border-rose-200 bg-white text-rose-700" onClick={() => worklistQuery.refetch()}>
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Thử lại
                </Button>
              </div>
            ) : (worklistQuery.data?.items ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">Không có bệnh nhân trong ca này.</p>
            ) : (
              (worklistQuery.data?.items ?? []).map((item) => (
                <button
                  type="button"
                  key={item.DK_MA}
                  className="w-full rounded-lg border border-slate-200 p-3 text-left transition-colors hover:bg-slate-50"
                  onClick={() => setSelectedPatient(item)}
                >
                  <p className="font-medium text-slate-900">
                    {item.patientName} - {formatTime(item.KG_BAT_DAU)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Mã lịch hẹn: #{item.DK_MA} • Mã hồ sơ: #{item.BN_MA}
                  </p>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedPatient)}
        onOpenChange={(open) => {
          if (!open) setSelectedPatient(null);
        }}
      >
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4" />
              Thông tin bệnh nhân
            </DialogTitle>
            <DialogDescription>Xem nhanh thông tin hồ sơ trong ca khám.</DialogDescription>
          </DialogHeader>

          {!selectedPatient ? null : quickInfoQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ) : quickInfoQuery.isError ? (
            <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <p>Không thể tải thông tin nhanh bệnh nhân.</p>
              <Button variant="outline" className="border-rose-200 bg-white text-rose-700" onClick={() => quickInfoQuery.refetch()}>
                <RefreshCw className="mr-1 h-4 w-4" />
                Thử lại
              </Button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-slate-900">Họ tên:</span> {selectedPatient.patientName || '-'}
              </p>
              <p>
                <span className="font-medium text-slate-900">Ngày sinh:</span>{' '}
                {selectedPatient.patientDob ? formatDateDdMmYyyy(selectedPatient.patientDob) : '-'}
              </p>
              <p>
                <span className="font-medium text-slate-900">SĐT:</span> {selectedPatient.patientPhone || '-'}
              </p>
              <p>
                <span className="font-medium text-slate-900">Mã hồ sơ:</span> #{selectedPatient.BN_MA}
              </p>
              <p>
                <span className="font-medium text-slate-900">Triệu chứng:</span>{' '}
                {quickInfoQuery.data?.symptoms || selectedPatient.preVisitSymptoms || '-'}
              </p>
              <p>
                <span className="font-medium text-slate-900">Ghi chú:</span>{' '}
                {quickInfoQuery.data?.note || selectedPatient.preVisitNote || '-'}
              </p>
              <p>
                <span className="font-medium text-slate-900">Trạng thái lịch:</span> {selectedPatient.DK_TRANG_THAI || '-'}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CellButton({
  cell,
  hasData,
  onClick,
}: {
  cell?: TimetableCellData;
  hasData: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!hasData}
      onClick={onClick}
      className={cn(
        'min-h-[88px] w-full rounded-lg border px-3 py-2 text-left transition-colors',
        hasData
          ? 'cursor-pointer border-blue-200 bg-blue-50 hover:border-blue-300 hover:bg-blue-100'
          : 'cursor-default border-slate-200 bg-slate-100 text-slate-400',
      )}
    >
      {hasData && cell ? (
        <div className="space-y-1.5">
          {cell.rooms.map((room) => (
            <div key={`room-${room.roomId}`} className="rounded-md border border-blue-200/70 bg-white/80 px-2 py-1">
              <p className="text-xs font-medium text-slate-900">{room.roomName}</p>
              <p className="text-xs text-slate-700">{room.patientCount} bệnh nhân</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm">Trống</p>
      )}
    </button>
  );
}
