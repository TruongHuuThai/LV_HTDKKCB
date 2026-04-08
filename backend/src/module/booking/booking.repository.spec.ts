import { BookingRepository } from './booking.repository';
import { BOOKING_AVAILABILITY_REASON } from './booking-availability.contract';
import { SHIFT_STATUS, WEEK_STATUS } from '../schedules/schedule-status';

describe('BookingRepository debugAvailability', () => {
  const prisma = {
    bAC_SI: { findMany: jest.fn() },
    lICH_BSK: { findMany: jest.fn() },
    dANG_KY: { findMany: jest.fn() },
  } as any;

  const repository = new BookingRepository(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns NO_DOCTOR_IN_SPECIALTY when specialty has no doctors', async () => {
    prisma.bAC_SI.findMany.mockResolvedValueOnce([]);

    const result = await repository.debugAvailability(new Date('2099-01-01T00:00:00.000Z'), 21);

    expect(result.summary.reasons).toEqual([BOOKING_AVAILABILITY_REASON.NO_DOCTOR_IN_SPECIALTY]);
    expect(result.summary.availableDoctors).toBe(0);
  });

  it('returns SHIFT_NOT_FINALIZED when only generated shifts exist', async () => {
    prisma.bAC_SI.findMany.mockResolvedValueOnce([
      {
        BS_MA: 12,
        BS_HO_TEN: 'Bac si A',
        CK_MA: 21,
        BS_DA_XOA: false,
        CHUYEN_KHOA: { CK_TEN: 'Noi' },
      },
    ]);
    prisma.lICH_BSK.findMany.mockResolvedValueOnce([
      {
        BS_MA: 12,
        B_TEN: 'SANG',
        LBSK_TRANG_THAI: SHIFT_STATUS.generated,
        LBSK_IS_ARCHIVED: false,
        BUOI: {
          KHUNG_GIO: [
            {
              KG_MA: 1,
              KG_SO_BN_TOI_DA: 5,
              KG_BAT_DAU: new Date('2099-01-01T08:00:00.000Z'),
            },
          ],
        },
        DOT_LICH_TUAN: { DLT_TRANG_THAI: WEEK_STATUS.slot_opened },
      },
    ]);
    prisma.dANG_KY.findMany.mockResolvedValueOnce([]);

    const result = await repository.debugAvailability(new Date('2099-01-01T00:00:00.000Z'), 21);

    expect(result.summary.availableDoctors).toBe(0);
    expect(result.summary.reasons).toContain(BOOKING_AVAILABILITY_REASON.SHIFT_NOT_FINALIZED);
  });

  it('findAvailableDoctors keeps same visibility logic as debugAvailability', async () => {
    prisma.bAC_SI.findMany
      .mockResolvedValueOnce([
        {
          BS_MA: 12,
          BS_HO_TEN: 'Bac si A',
          CK_MA: 21,
          BS_DA_XOA: false,
          CHUYEN_KHOA: { CK_TEN: 'Noi' },
        },
      ])
      .mockResolvedValueOnce([
        {
          BS_MA: 12,
          BS_HO_TEN: 'Bac si A',
          CK_MA: 21,
          BS_DA_XOA: false,
          CHUYEN_KHOA: { CK_TEN: 'Noi' },
        },
      ]);

    prisma.lICH_BSK.findMany.mockResolvedValueOnce([
      {
        BS_MA: 12,
        B_TEN: 'SANG',
        LBSK_TRANG_THAI: SHIFT_STATUS.finalized,
        LBSK_IS_ARCHIVED: false,
        BUOI: {
          KHUNG_GIO: [
            {
              KG_MA: 1,
              KG_SO_BN_TOI_DA: 5,
              KG_BAT_DAU: new Date('2099-01-01T08:00:00.000Z'),
            },
          ],
        },
        DOT_LICH_TUAN: { DLT_TRANG_THAI: WEEK_STATUS.slot_opened },
      },
    ]);
    prisma.dANG_KY.findMany.mockResolvedValueOnce([]);

    const doctors = await repository.findAvailableDoctors(new Date('2099-01-01T00:00:00.000Z'), 21);

    expect(doctors).toHaveLength(1);
    expect(doctors[0].BS_MA).toBe(12);
  });
});
