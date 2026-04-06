// src/module/payment/payment.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

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

    findWebhookEventByKey(eventKey: string) {
        return this.prisma.pAYMENT_WEBHOOK_EVENT.findUnique({
            where: { PWE_EVENT_KEY: eventKey },
        });
    }

    createWebhookEvent(data: {
        provider: string;
        eventKey: string;
        eventType?: string | null;
        reference?: string | null;
        signatureOk: boolean;
        payload: Prisma.InputJsonValue;
        status?: string;
    }) {
        return this.prisma.pAYMENT_WEBHOOK_EVENT.create({
            data: {
                PWE_PROVIDER: data.provider,
                PWE_EVENT_KEY: data.eventKey,
                PWE_EVENT_TYPE: data.eventType || null,
                PWE_REF: data.reference || null,
                PWE_SIGNATURE_OK: data.signatureOk,
                PWE_TRANG_THAI: data.status || 'RECEIVED',
                PWE_PAYLOAD: data.payload,
            },
        });
    }

    updateWebhookEventResult(
        eventId: number,
        status: 'PROCESSED' | 'FAILED' | 'IGNORED',
        error?: string | null,
    ) {
        return this.prisma.pAYMENT_WEBHOOK_EVENT.update({
            where: { PWE_MA: eventId },
            data: {
                PWE_TRANG_THAI: status,
                PWE_LOI: error || null,
                PWE_PROCESSED_AT: new Date(),
            },
        });
    }
}
