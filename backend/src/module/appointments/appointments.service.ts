import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentsRepository } from './appointments.repository';
import { mapPrismaError } from '../../common/prisma/prisma-error.util';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: AppointmentsRepository,
  ) {}

  async book(payload: {
    BN_MA: number;
    BS_MA: number;
    N_NGAY: Date; // yyyy-mm-dd
    B_TEN: string; // "SANG"/"CHIEU"/...
    KG_MA: number;
    LHK_MA?: number;
  }) {
    try {
      const lich = await this.repo.findSchedule(
        payload.BS_MA,
        payload.N_NGAY,
        payload.B_TEN,
      );
      if (!lich)
        throw new NotFoundException('Bác sĩ không có lịch ở ngày/buổi này');

      return this.prisma.$transaction(async (tx) => {
        // DK_TRANG_THAI mặc định "CHO_KHAM" theo DB
        return this.repo.createDangKyTx(tx, {
          DK_TRANG_THAI: 'CHO_KHAM',
          BENH_NHAN: { connect: { BN_MA: payload.BN_MA } },
          KHUNG_GIO: { connect: { KG_MA: payload.KG_MA } },
          LOAI_HINH_KHAM: payload.LHK_MA
            ? { connect: { LHK_MA: payload.LHK_MA } }
            : undefined,
          LICH_BSK: {
            connect: {
              BS_MA_N_NGAY_B_TEN: {
                BS_MA: payload.BS_MA,
                N_NGAY: payload.N_NGAY,
                B_TEN: payload.B_TEN,
              },
            },
          },
        });
      });
    } catch (e: any) {
      // slot bị trùng -> Prisma P2002
      if (e?.code === 'P2002')
        throw new ConflictException('Khung giờ này đã có người đặt');
      mapPrismaError(e);
    }
  }
}
