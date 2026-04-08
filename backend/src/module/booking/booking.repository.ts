// src/modules/booking/booking.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { combineDateAndTime } from './booking.utils';
import {
  isWeekOpenForBooking,
  SCHEDULE_STATUS_CONTRACT_VERSION,
  SHIFT_STATUS,
  WEEK_STATUS,
} from '../schedules/schedule-status';
import {
  BOOKING_AVAILABILITY_REASON,
  type BookingAvailabilityDebugDoctor,
  type BookingAvailabilityDebugResponse,
  type BookingAvailabilityReasonCode,
} from './booking-availability.contract';
import {
  evaluateShiftAvailability,
  summarizeDoctorReasons,
} from './booking-availability.util';

@Injectable()
export class BookingRepository {
  constructor(private readonly prisma: PrismaService) { }

  private toUtcDayRange(date: Date) {
    const start = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  private toUtcWeekMonday(date: Date) {
    const base = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const day = base.getUTCDay(); // 0=Sun, 1=Mon...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    base.setUTCDate(base.getUTCDate() + diffToMonday);
    return base;
  }

  private async isWeekSlotOpened(date: Date) {
    const monday = this.toUtcWeekMonday(date);
    const end = new Date(monday);
    end.setUTCDate(end.getUTCDate() + 1);
    const batch = await this.prisma.dOT_LICH_TUAN.findFirst({
      where: {
        DLT_TUAN_BAT_DAU: { gte: monday, lt: end },
      },
      select: { DLT_TRANG_THAI: true },
    });
    return isWeekOpenForBooking(batch?.DLT_TRANG_THAI);
  }

  // ✅ map TK_SDT -> BN_MA (không tin client)
  findOwnedPatientProfile(TK_SDT: string, BN_MA: number) {
    return this.prisma.bENH_NHAN.findFirst({
      where: { TK_SDT, BN_MA },
      select: {
        BN_MA: true,
        TK_SDT: true,
        BN_DA_VO_HIEU: true,
      },
    });
  }

  findPatientProfileById(BN_MA: number) {
    return this.prisma.bENH_NHAN.findUnique({
      where: { BN_MA },
      select: {
        BN_MA: true,
        TK_SDT: true,
        BN_DA_VO_HIEU: true,
      },
    });
  }

  async findDoctorSchedule(BS_MA: number, N_NGAY: Date, B_TEN: string) {
    const { start, end } = this.toUtcDayRange(N_NGAY);
    const slotOpenedByWeek = await this.isWeekSlotOpened(N_NGAY);
    return this.prisma.lICH_BSK.findFirst({
      where: {
        BS_MA,
        N_NGAY: { gte: start, lt: end },
        B_TEN,
        LBSK_IS_ARCHIVED: false,
        LBSK_TRANG_THAI: SHIFT_STATUS.finalized,
        ...(slotOpenedByWeek
          ? {}
          : {
              DOT_LICH_TUAN: {
                is: {
                  DLT_TRANG_THAI: WEEK_STATUS.slot_opened,
                },
              },
            }),
      },
      include: { PHONG: true, BAC_SI: true, BUOI: true, DOT_LICH_TUAN: true },
    });
  }

  listTimeSlotsByBuoi(B_TEN: string) {
    return this.prisma.kHUNG_GIO.findMany({
      where: { B_TEN },
      orderBy: { KG_BAT_DAU: 'asc' },
    });
  }

  listBookedSlots(BS_MA: number, N_NGAY: Date, B_TEN: string) {
    const { start, end } = this.toUtcDayRange(N_NGAY);
    return this.prisma.dANG_KY.findMany({
      where: {
        BS_MA,
        N_NGAY: { gte: start, lt: end },
        B_TEN,
        DK_TRANG_THAI: { notIn: ['HUY', 'HUY_BS_NGHI'] },
      },
      select: { KG_MA: true, DK_MA: true },
    });
  }

  countActiveBookingsForSlot(
    BS_MA: number,
    N_NGAY: Date,
    B_TEN: string,
    KG_MA: number,
    options?: { excludeDkMa?: number },
  ) {
    const { start, end } = this.toUtcDayRange(N_NGAY);
    return this.prisma.dANG_KY.count({
      where: {
        BS_MA,
        N_NGAY: { gte: start, lt: end },
        B_TEN,
        KG_MA,
        DK_TRANG_THAI: { notIn: ['HUY', 'HUY_BS_NGHI'] },
        ...(options?.excludeDkMa ? { DK_MA: { not: options.excludeDkMa } } : {}),
      },
    });
  }

  countPatientBookingsInSpecialtySlot(
    BN_MA: number,
    N_NGAY: Date,
    KG_MA: number,
    CK_MA: number,
    options?: { excludeDkMa?: number },
  ) {
    const { start, end } = this.toUtcDayRange(N_NGAY);
    return this.prisma.dANG_KY.count({
      where: {
        BN_MA,
        N_NGAY: { gte: start, lt: end },
        KG_MA,
        DK_TRANG_THAI: { notIn: ['HUY', 'HUY_BS_NGHI'] },
        ...(options?.excludeDkMa ? { DK_MA: { not: options.excludeDkMa } } : {}),
        LICH_BSK: {
          is: {
            BAC_SI: {
              CK_MA,
            },
          },
        },
      },
    });
  }

  getMaxSttForSlot(BS_MA: number, N_NGAY: Date, B_TEN: string, KG_MA: number) {
    const { start, end } = this.toUtcDayRange(N_NGAY);
    return this.prisma.dANG_KY.aggregate({
      where: {
        BS_MA,
        N_NGAY: { gte: start, lt: end },
        B_TEN,
        KG_MA,
        DK_TRANG_THAI: { notIn: ['HUY', 'HUY_BS_NGHI'] },
      },
      _max: { DK_STT: true },
    });
  }

  createBooking(data: {
    BN_MA: number;
    BS_MA: number;
    N_NGAY: Date;
    B_TEN: string;
    KG_MA: number;
    LHK_MA?: number;
    DK_STT?: number;
  }) {
    const payload: any = {
      BN_MA: data.BN_MA,
      BS_MA: data.BS_MA,
      N_NGAY: data.N_NGAY,
      B_TEN: data.B_TEN,
      KG_MA: data.KG_MA,
      DK_STT: data.DK_STT ?? null,
      DK_TRANG_THAI: 'CHO_KHAM',
      BENH_NHAN: { connect: { BN_MA: data.BN_MA } },
      KHUNG_GIO: { connect: { KG_MA: data.KG_MA } },
      LICH_BSK: {
        connect: {
          BS_MA_N_NGAY_B_TEN: {
            BS_MA: data.BS_MA,
            N_NGAY: data.N_NGAY,
            B_TEN: data.B_TEN,
          },
        },
      },
    };
    if (data.LHK_MA) {
      payload.LOAI_HINH_KHAM = { connect: { LHK_MA: data.LHK_MA } };
    }
    return this.prisma.dANG_KY.create({
      data: payload,
      include: {
        KHUNG_GIO: true,
        LOAI_HINH_KHAM: true,
        LICH_BSK: { include: { BAC_SI: true, PHONG: true } },
      },
    });
  }

  findBookingById(DK_MA: number) {
    return this.prisma.dANG_KY.findUnique({
      where: { DK_MA },
      include: {
        KHUNG_GIO: true,
        LOAI_HINH_KHAM: true,
        LICH_BSK: { include: { BAC_SI: true, PHONG: true, BUOI: true } },
      },
    });
  }

  cancelBooking(DK_MA: number, reason?: string) {
    return this.prisma.dANG_KY.update({
      where: { DK_MA },
      data: { DK_TRANG_THAI: 'HUY', DK_LY_DO_HUY: reason ?? null },
    });
  }

  listBookingsOfPatient(BN_MA: number) {
    return this.prisma.dANG_KY.findMany({
      where: { BN_MA },
      orderBy: { DK_THOI_GIAN_TAO: 'desc' },
      include: {
        KHUNG_GIO: true,
        LOAI_HINH_KHAM: true,
        LICH_BSK: { include: { BAC_SI: true, PHONG: true, BUOI: true } },
      },
    });
  }

  findTimeSlot(KG_MA: number) {
    return this.prisma.kHUNG_GIO.findUnique({ where: { KG_MA } });
  }

  private countReasonCodes(reasons: BookingAvailabilityReasonCode[]) {
    const map = new Map<BookingAvailabilityReasonCode, number>();
    reasons.forEach((reason) => {
      map.set(reason, (map.get(reason) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([reason, count]) => ({ reason, count }));
  }

  async debugAvailability(
    date: Date,
    specialtyId?: number,
    q?: string,
  ): Promise<BookingAvailabilityDebugResponse> {
    const dayRange = this.toUtcDayRange(date);
    const now = new Date();
    const keyword = String(q ?? '').trim();

    const candidateDoctors = await this.prisma.bAC_SI.findMany({
      where: {
        ...(specialtyId ? { CK_MA: specialtyId } : {}),
        ...(keyword
          ? {
              BS_HO_TEN: {
                contains: keyword,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      select: {
        BS_MA: true,
        BS_HO_TEN: true,
        CK_MA: true,
        BS_DA_XOA: true,
        CHUYEN_KHOA: { select: { CK_TEN: true } },
      },
      orderBy: { BS_MA: 'asc' },
    });

    const activeCandidates = candidateDoctors.filter((doctor) => doctor.BS_DA_XOA !== true);
    const activeDoctorIds = activeCandidates.map((item) => item.BS_MA);

    const schedules = activeDoctorIds.length
      ? await this.prisma.lICH_BSK.findMany({
          where: {
            BS_MA: { in: activeDoctorIds },
            N_NGAY: { gte: dayRange.start, lt: dayRange.end },
          },
          include: {
            BUOI: { include: { KHUNG_GIO: { orderBy: { KG_BAT_DAU: 'asc' } } } },
            DOT_LICH_TUAN: { select: { DLT_TRANG_THAI: true } },
          },
        })
      : [];

    const bookings = activeDoctorIds.length
      ? await this.prisma.dANG_KY.findMany({
          where: {
            BS_MA: { in: activeDoctorIds },
            N_NGAY: { gte: dayRange.start, lt: dayRange.end },
            DK_TRANG_THAI: { notIn: ['HUY', 'HUY_BS_NGHI'] },
          },
          select: { BS_MA: true, B_TEN: true, KG_MA: true },
        })
      : [];

    const bookingCountByKey = new Map<string, number>();
    bookings.forEach((booking) => {
      const key = `${booking.BS_MA}::${booking.B_TEN}::${booking.KG_MA}`;
      bookingCountByKey.set(key, (bookingCountByKey.get(key) ?? 0) + 1);
    });

    const schedulesByDoctor = new Map<number, (typeof schedules)[number][]>();
    schedules.forEach((item) => {
      const list = schedulesByDoctor.get(item.BS_MA) ?? [];
      list.push(item);
      schedulesByDoctor.set(item.BS_MA, list);
    });

    const doctors: BookingAvailabilityDebugDoctor[] = candidateDoctors.map((doctor) => {
      if (doctor.BS_DA_XOA === true) {
        return {
          doctorId: doctor.BS_MA,
          doctorName: doctor.BS_HO_TEN,
          specialtyId: doctor.CK_MA,
          specialtyName: doctor.CHUYEN_KHOA?.CK_TEN ?? null,
          available: false,
          reasons: [BOOKING_AVAILABILITY_REASON.DOCTOR_DELETED],
          shifts: [],
        };
      }

      const doctorSchedules = schedulesByDoctor.get(doctor.BS_MA) ?? [];
      const shifts = doctorSchedules.map((shift) => {
        let bookableSlots = 0;
        const totalSlots = shift.BUOI?.KHUNG_GIO?.length ?? 0;
        (shift.BUOI?.KHUNG_GIO ?? []).forEach((slot) => {
          const key = `${shift.BS_MA}::${shift.B_TEN}::${slot.KG_MA}`;
          const booked = bookingCountByKey.get(key) ?? 0;
          const capacity = slot.KG_SO_BN_TOI_DA ?? 5;
          const slotStart = combineDateAndTime(date, slot.KG_BAT_DAU);
          if (booked < capacity && slotStart.getTime() > now.getTime()) {
            bookableSlots += 1;
          }
        });
        const evaluated = evaluateShiftAvailability({
          shiftStatus: shift.LBSK_TRANG_THAI,
          weekStatus: shift.DOT_LICH_TUAN?.DLT_TRANG_THAI ?? null,
          isArchived: shift.LBSK_IS_ARCHIVED,
          bookableSlots,
        });

        return {
          session: shift.B_TEN,
          shiftStatus: shift.LBSK_TRANG_THAI ?? null,
          weekStatus: shift.DOT_LICH_TUAN?.DLT_TRANG_THAI ?? null,
          isArchived: Boolean(shift.LBSK_IS_ARCHIVED),
          totalSlots,
          bookableSlots,
          reasons: evaluated.reasons,
        };
      });

      const available = shifts.some((shift) => shift.reasons.length === 0);
      return {
        doctorId: doctor.BS_MA,
        doctorName: doctor.BS_HO_TEN,
        specialtyId: doctor.CK_MA,
        specialtyName: doctor.CHUYEN_KHOA?.CK_TEN ?? null,
        available,
        reasons: available
          ? []
          : summarizeDoctorReasons({
              shiftsCount: shifts.length,
              shiftReasons: shifts.map((shift) => shift.reasons),
            }),
        shifts,
      };
    });

    const availableDoctors = doctors.filter((doctor) => doctor.available);
    const unavailableDoctors = doctors.filter((doctor) => !doctor.available);
    const unavailableReasons = unavailableDoctors.flatMap((doctor) => doctor.reasons);
    const summaryReasons = unavailableReasons.length
      ? Array.from(new Set(unavailableReasons))
      : specialtyId && doctors.length === 0
        ? [BOOKING_AVAILABILITY_REASON.NO_DOCTOR_IN_SPECIALTY]
        : [];

    const inputDate = `${dayRange.start.getUTCFullYear()}-${String(
      dayRange.start.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(dayRange.start.getUTCDate()).padStart(2, '0')}`;

    return {
      contractVersion: SCHEDULE_STATUS_CONTRACT_VERSION,
      input: { date: inputDate, specialtyId: specialtyId ?? null },
      summary: {
        candidateDoctors: doctors.length,
        availableDoctors: availableDoctors.length,
        reasonCounts: this.countReasonCodes(unavailableReasons),
        reasons: summaryReasons,
      },
      doctors,
    };
  }

  async findAvailableDoctors(date?: Date, specialtyId?: number, q?: string) {
    const keyword = String(q ?? '').trim();
    if (!date) {
      return this.prisma.bAC_SI.findMany({
        where: {
          BS_DA_XOA: false,
          ...(specialtyId ? { CK_MA: specialtyId } : {}),
          ...(keyword
            ? {
                BS_HO_TEN: {
                  contains: keyword,
                  mode: 'insensitive',
                },
              }
            : {}),
        },
        include: {
          CHUYEN_KHOA: true,
        },
      });
    }

    const debug = await this.debugAvailability(date, specialtyId, keyword);
    const availableIds = new Set(
      debug.doctors.filter((item) => item.available).map((item) => item.doctorId),
    );
    if (availableIds.size === 0) return [];

    return this.prisma.bAC_SI.findMany({
      where: {
        BS_DA_XOA: false,
        BS_MA: { in: Array.from(availableIds) },
      },
      include: {
        CHUYEN_KHOA: true,
      },
      orderBy: { BS_MA: 'asc' },
    });
  }

  updatePreVisitInfo(
    DK_MA: number,
    data: {
      symptoms?: string | null;
      preVisitNote?: string | null;
      updatedBy?: string | null;
    },
  ) {
    return this.prisma.dANG_KY.update({
      where: { DK_MA },
      data: {
        DK_TRIEU_CHUNG: data.symptoms ?? null,
        DK_GHI_CHU_TIEN_KHAM: data.preVisitNote ?? null,
        DK_TIEN_KHAM_CAP_NHAT_LUC: new Date(),
        DK_TIEN_KHAM_CAP_NHAT_BOI: data.updatedBy ?? null,
      },
    });
  }

  createPreVisitAttachments(
    DK_MA: number,
    attachments: Array<{
      fileName: string;
      fileUrl?: string | null;
      mimeType?: string | null;
      sizeBytes?: number | null;
      createdBy?: string | null;
    }>,
  ) {
    if (attachments.length === 0) return Promise.resolve({ count: 0 });
    return this.prisma.pRE_VISIT_ATTACHMENT.createMany({
      data: attachments.map((item) => ({
        DK_MA,
        PVA_TEN_FILE: item.fileName,
        PVA_URL: item.fileUrl ?? null,
        PVA_LOAI_MIME: item.mimeType ?? null,
        PVA_KICH_THUOC: item.sizeBytes ?? null,
        PVA_TAO_BOI: item.createdBy ?? null,
      })),
    });
  }

  async listDoctorSchedulesForDate(BS_MA: number, N_NGAY: Date) {
    const { start, end } = this.toUtcDayRange(N_NGAY);
    const slotOpenedByWeek = await this.isWeekSlotOpened(N_NGAY);
    return this.prisma.lICH_BSK.findMany({
      where: {
        BS_MA,
        N_NGAY: { gte: start, lt: end },
        LBSK_IS_ARCHIVED: false,
        LBSK_TRANG_THAI: SHIFT_STATUS.finalized,
        ...(slotOpenedByWeek
          ? {}
          : {
              DOT_LICH_TUAN: {
                is: {
                  DLT_TRANG_THAI: WEEK_STATUS.slot_opened,
                },
              },
            }),
      },
      include: {
        BUOI: { include: { KHUNG_GIO: { orderBy: { KG_BAT_DAU: 'asc' } } } },
        PHONG: true,
        DOT_LICH_TUAN: true,
      }
    });
  }

  listBookedSlotsForDate(BS_MA: number, N_NGAY: Date) {
    const { start, end } = this.toUtcDayRange(N_NGAY);
    return this.prisma.dANG_KY.findMany({
      where: {
        BS_MA,
        N_NGAY: { gte: start, lt: end },
        DK_TRANG_THAI: { notIn: ['HUY', 'HUY_BS_NGHI'] },
      },
      select: { KG_MA: true, B_TEN: true },
    });
  }

  findLoaiHinhKham(LHK_MA: number) {
    return this.prisma.lOAI_HINH_KHAM?.findUnique({
      where: { LHK_MA },
      select: { LHK_GIA: true, LHK_TEN: true },
    });
  }
}
