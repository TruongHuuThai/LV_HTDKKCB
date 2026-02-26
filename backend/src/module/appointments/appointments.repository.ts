import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AppointmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSchedule(bsMa: number, ngay: Date, buoi: string) {
    return this.prisma.lICH_BSK.findUnique({
      where: { BS_MA_N_NGAY_B_TEN: { BS_MA: bsMa, N_NGAY: ngay, B_TEN: buoi } },
      include: { PHONG: true, BAC_SI: true, BUOI: true },
    });
  }

  createDangKyTx(
    tx: Prisma.TransactionClient,
    data: Prisma.DANG_KYCreateInput,
  ) {
    return tx.dANG_KY.create({ data });
  }
}
