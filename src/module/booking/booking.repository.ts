// src/modules/booking/booking.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BookingRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ✅ map TK_SDT -> BN_MA (không tin client)
  findActivePatientByPhone(TK_SDT: string) {
    return this.prisma.bENH_NHAN.findFirst({
      where: { TK_SDT, BN_DA_XOA: false },
      orderBy: { BN_MA: 'desc' },
      select: { BN_MA: true, TK_SDT: true },
    });
  }

  findDoctorSchedule(BS_MA: number, N_NGAY: Date, B_TEN: string) {
    return this.prisma.lICH_BSK.findUnique({
      where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY, B_TEN } },
      include: { PHONG: true, BAC_SI: true, BUOI: true },
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
      where: { BS_MA, N_NGAY, B_TEN, DK_TRANG_THAI: { not: 'HUY' } },
      select: { KG_MA: true, DK_MA: true },
    });
  }

  createBooking(data: {
    BN_MA: number;
    BS_MA: number;
    N_NGAY: Date;
    B_TEN: string;
    KG_MA: number;
    LHK_MA?: number;
  }) {
    return this.prisma.dANG_KY.create({
      data: {
        BN_MA: data.BN_MA,
        BS_MA: data.BS_MA,
        N_NGAY: data.N_NGAY,
        B_TEN: data.B_TEN,
        KG_MA: data.KG_MA,
        DK_TRANG_THAI: 'CHO_KHAM',
        LOAI_HINH_KHAM: data.LHK_MA
          ? { connect: { LHK_MA: data.LHK_MA } }
          : undefined,
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
      },
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
}
