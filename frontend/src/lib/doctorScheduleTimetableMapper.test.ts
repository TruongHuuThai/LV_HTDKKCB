import { describe, expect, it } from 'vitest';
import { buildTimetableCellMap, getWeekDates, hasAnyTimetableData } from '@/lib/doctorScheduleTimetableMapper';
import type { WeeklyScheduleItem } from '@/services/api/scheduleWorkflowApi';

function createItem(partial: Partial<WeeklyScheduleItem>): WeeklyScheduleItem {
  return {
    BS_MA: 1,
    N_NGAY: '2026-04-20',
    B_TEN: 'SANG',
    P_MA: 1,
    status: 'generated',
    source: 'template',
    note: null,
    confirmationAt: null,
    createdAt: null,
    updatedAt: null,
    slotCount: 8,
    slotMax: 10,
    bookingCount: 0,
    doctor: { BS_MA: 1, BS_HO_TEN: 'BS Test', CK_MA: 1, CHUYEN_KHOA: { CK_TEN: 'Nội tổng quát' } },
    room: { P_MA: 1, P_TEN: 'Phòng 1', CK_MA: 1, CHUYEN_KHOA: { CK_TEN: 'Nội tổng quát' } },
    template: null,
    latestException: null,
    weekStatus: 'generated',
    finalizedAt: null,
    slotOpenedAt: null,
    ...partial,
  };
}

describe('doctorScheduleTimetableMapper', () => {
  it('groups schedules by date + shift and room with patient count', () => {
    const items: WeeklyScheduleItem[] = [
      createItem({ N_NGAY: '2026-04-20', B_TEN: 'SANG', room: { P_MA: 1, P_TEN: 'Phòng 1', CK_MA: 1, CHUYEN_KHOA: { CK_TEN: 'Nội tổng quát' } }, bookingCount: 2 }),
      createItem({ N_NGAY: '2026-04-20', B_TEN: 'SANG', room: { P_MA: 2, P_TEN: 'Phòng 2', CK_MA: 1, CHUYEN_KHOA: { CK_TEN: 'Nội tổng quát' } }, bookingCount: 3 }),
      createItem({ N_NGAY: '2026-04-20', B_TEN: 'CHIEU', room: { P_MA: 1, P_TEN: 'Phòng 1', CK_MA: 1, CHUYEN_KHOA: { CK_TEN: 'Nội tổng quát' } }, bookingCount: 1 }),
    ];

    const cellMap = buildTimetableCellMap(items);
    const morning = cellMap.get('2026-04-20__SANG');
    const afternoon = cellMap.get('2026-04-20__CHIEU');

    expect(morning?.rooms).toHaveLength(2);
    expect(morning?.totalPatients).toBe(5);
    expect(afternoon?.totalPatients).toBe(1);
  });

  it('detects empty week and week dates shape', () => {
    const empty: WeeklyScheduleItem[] = [];
    expect(hasAnyTimetableData(empty)).toBe(false);

    const dates = getWeekDates('2026-04-20', empty);
    expect(dates).toHaveLength(6);
    expect(dates[0]).toBe('2026-04-20');
  });
});
