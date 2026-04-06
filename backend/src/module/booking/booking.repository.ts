// src/modules/booking/booking.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BookingRepository {
  constructor(private readonly prisma: PrismaService) { }

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

  findDoctorSchedule(BS_MA: number, N_NGAY: Date, B_TEN: string) {
    return this.prisma.lICH_BSK.findFirst({
      where: {
        BS_MA,
        N_NGAY,
        B_TEN,
        LBSK_IS_ARCHIVED: false,
        LBSK_TRANG_THAI: 'finalized',
        DOT_LICH_TUAN: {
          is: {
            DLT_TRANG_THAI: 'slot_opened',
          },
        },
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
    return this.prisma.dANG_KY.findMany({
      where: {
        BS_MA,
        N_NGAY,
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
    return this.prisma.dANG_KY.count({
      where: {
        BS_MA,
        N_NGAY,
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
    return this.prisma.dANG_KY.count({
      where: {
        BN_MA,
        N_NGAY,
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
    return this.prisma.dANG_KY.aggregate({
      where: {
        BS_MA,
        N_NGAY,
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

  findAvailableDoctors(date?: Date, specialtyId?: number) {
    return this.prisma.bAC_SI.findMany({
      where: {
        BS_DA_XOA: false,
        ...(specialtyId ? { CK_MA: specialtyId } : {}),
        ...(date
          ? {
              LICH_BSK: {
                some: {
                  N_NGAY: date,
                  LBSK_IS_ARCHIVED: false,
                  LBSK_TRANG_THAI: 'finalized',
                  DOT_LICH_TUAN: {
                    is: {
                      DLT_TRANG_THAI: 'slot_opened',
                    },
                  },
                },
              },
            }
          : {}),
      },
      include: {
        CHUYEN_KHOA: true,
        ...(date
          ? {
              LICH_BSK: {
                where: {
                  N_NGAY: date,
                  LBSK_IS_ARCHIVED: false,
                  LBSK_TRANG_THAI: 'finalized',
                },
                select: {
                  LBSK_TRANG_THAI: true,
                  DOT_LICH_TUAN: { select: { DLT_TRANG_THAI: true } },
                },
              },
            }
          : {}),
      }
    }).then((doctors: any[]) => {
      if (!date) return doctors;
      return doctors.filter((doctor) =>
        (doctor.LICH_BSK || []).some((schedule: any) => {
          return (
            schedule.LBSK_TRANG_THAI === 'finalized' &&
            schedule.DOT_LICH_TUAN?.DLT_TRANG_THAI === 'slot_opened'
          );
        }),
      );
    });
  }

  listDoctorSchedulesForDate(BS_MA: number, N_NGAY: Date) {
    return this.prisma.lICH_BSK.findMany({
      where: {
        BS_MA,
        N_NGAY,
        LBSK_IS_ARCHIVED: false,
        LBSK_TRANG_THAI: 'finalized',
        DOT_LICH_TUAN: {
          is: {
            DLT_TRANG_THAI: 'slot_opened',
          },
        },
      },
      include: {
        BUOI: { include: { KHUNG_GIO: { orderBy: { KG_BAT_DAU: 'asc' } } } },
        PHONG: true,
        DOT_LICH_TUAN: true,
      }
    });
  }

  listBookedSlotsForDate(BS_MA: number, N_NGAY: Date) {
    return this.prisma.dANG_KY.findMany({
      where: {
        BS_MA,
        N_NGAY,
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
