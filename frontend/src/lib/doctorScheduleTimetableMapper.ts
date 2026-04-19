import type { WeeklyScheduleItem } from '@/services/api/scheduleWorkflowApi';
import { toDateOnlyIso } from '@/lib/scheduleDisplay';

export type ShiftCode = 'SANG' | 'CHIEU';
export type TimetableCellKey = `${string}__${ShiftCode}`;

export interface TimetableRoomSummary {
  roomId: number;
  roomName: string;
  patientCount: number;
  scheduleCount: number;
}

export interface TimetableCellData {
  date: string;
  shift: ShiftCode;
  hasData: boolean;
  totalPatients: number;
  totalSchedules: number;
  rooms: TimetableRoomSummary[];
}

const DISPLAY_SHIFTS: ShiftCode[] = ['SANG', 'CHIEU'];

function normalizeShift(value: string): ShiftCode | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'SANG') return 'SANG';
  if (normalized === 'CHIEU') return 'CHIEU';
  return null;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function getNextWeekStartIso(fromDate = new Date()) {
  const monday = new Date(fromDate);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(fromDate.getDate() - ((fromDate.getDay() + 6) % 7) + 7);
  return toIsoDate(monday);
}

export function shiftWeekStart(weekStart: string, deltaDays: number) {
  const date = new Date(`${weekStart}T00:00:00`);
  date.setDate(date.getDate() + deltaDays);
  return toIsoDate(date);
}

export function getWeekDates(weekStart: string, items: WeeklyScheduleItem[]) {
  const base = new Date(`${weekStart}T00:00:00`);
  const dates = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return toIsoDate(date);
  });

  const hasSundaySchedule = items.some((item) => {
    const day = new Date(`${toDateOnlyIso(item.N_NGAY)}T00:00:00`).getDay();
    return day === 0 && Boolean(normalizeShift(item.B_TEN));
  });

  if (hasSundaySchedule) {
    const sunday = new Date(base);
    sunday.setDate(base.getDate() + 6);
    const sundayIso = toIsoDate(sunday);
    if (!dates.includes(sundayIso)) dates.push(sundayIso);
  }

  return dates;
}

export function buildTimetableCellMap(items: WeeklyScheduleItem[]) {
  const cellMap = new Map<TimetableCellKey, TimetableCellData>();

  for (const item of items) {
    const shift = normalizeShift(item.B_TEN);
    if (!shift) continue;
    const date = toDateOnlyIso(item.N_NGAY);
    if (!date) continue;
    const cellKey: TimetableCellKey = `${date}__${shift}`;

    const currentCell = cellMap.get(cellKey) || {
      date,
      shift,
      hasData: true,
      totalPatients: 0,
      totalSchedules: 0,
      rooms: [],
    };

    currentCell.totalPatients += item.bookingCount ?? 0;
    currentCell.totalSchedules += 1;

    const room = currentCell.rooms.find((entry) => entry.roomId === item.room.P_MA);
    if (!room) {
      currentCell.rooms.push({
        roomId: item.room.P_MA,
        roomName: item.room.P_TEN,
        patientCount: item.bookingCount ?? 0,
        scheduleCount: 1,
      });
    } else {
      room.patientCount += item.bookingCount ?? 0;
      room.scheduleCount += 1;
    }

    currentCell.rooms.sort((a, b) => a.roomName.localeCompare(b.roomName));
    cellMap.set(cellKey, currentCell);
  }

  return cellMap;
}

export function hasAnyTimetableData(items: WeeklyScheduleItem[]) {
  return items.some((item) => Boolean(normalizeShift(item.B_TEN)));
}
