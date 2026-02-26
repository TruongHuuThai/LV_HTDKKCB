// src/module/payment/payment.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymentRepository {
    constructor(private readonly prisma: PrismaService) { }

    createPayment(data: {
        DK_MA: number;
        TT_TONG_TIEN: number;
        TT_TIEN_KHAM: number;
        TT_LOAI: string;
        TT_PHUONG_THUC: string;
    }) {
        return this.prisma.tHANH_TOAN.create({
            data: {
                DK_MA: data.DK_MA,
                TT_TONG_TIEN: data.TT_TONG_TIEN,
                TT_TIEN_KHAM: data.TT_TIEN_KHAM,
                TT_THUC_THU: data.TT_TONG_TIEN,
                TT_LOAI: data.TT_LOAI,
                TT_PHUONG_THUC: data.TT_PHUONG_THUC,
                TT_TRANG_THAI: 'CHUA_THANH_TOAN',
            },
        });
    }

    findPaymentByTtMa(TT_MA: number) {
        return this.prisma.tHANH_TOAN.findUnique({ where: { TT_MA } });
    }

    updatePaymentStatus(
        TT_MA: number,
        status: string,
        ma_giao_dich?: string,
        phuong_thuc_tt?: string,
    ) {
        return this.prisma.tHANH_TOAN.update({
            where: { TT_MA },
            data: {
                TT_TRANG_THAI: status,
                TT_MA_GIAO_DICH: ma_giao_dich,
                TT_PHUONG_THUC_TT: phuong_thuc_tt,
                TT_THOI_GIAN: new Date(),
            },
        });
    }

    findPaymentByDkMa(DK_MA: number) {
        return this.prisma.tHANH_TOAN.findFirst({
            where: { DK_MA },
            orderBy: { TT_THOI_GIAN: 'desc' },
            include: {
                DANG_KY: {
                    include: {
                        BENH_NHAN: true,
                        LICH_BSK: { include: { BAC_SI: true } },
                        KHUNG_GIO: true,
                    },
                },
            },
        });
    }
}
