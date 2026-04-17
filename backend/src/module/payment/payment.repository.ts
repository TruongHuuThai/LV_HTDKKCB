// src/module/payment/payment.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PaymentRepository {
    private thongBaoHasBatchColumn: boolean | null = null;

    constructor(private readonly prisma: PrismaService) { }

    private async hasThongBaoBatchColumn() {
        if (this.thongBaoHasBatchColumn !== null) return this.thongBaoHasBatchColumn;
        try {
            const rows = await this.prisma.getClient().$queryRawUnsafe<Array<{ exists: boolean }>>(
                `SELECT EXISTS (
                   SELECT 1
                   FROM information_schema.columns
                   WHERE table_schema = 'public'
                     AND table_name = 'THONG_BAO'
                     AND column_name = 'TB_BATCH_MA'
                 ) AS "exists"`,
            );
            this.thongBaoHasBatchColumn = Boolean(rows?.[0]?.exists);
        } catch {
            this.thongBaoHasBatchColumn = false;
        }
        return this.thongBaoHasBatchColumn;
    }

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

    getPaymentNotificationContext(TT_MA: number) {
        return this.prisma.tHANH_TOAN.findUnique({
            where: { TT_MA },
            include: {
                DANG_KY: {
                    include: {
                        BENH_NHAN: true,
                        LICH_BSK: {
                            include: {
                                BAC_SI: true,
                            },
                        },
                        KHUNG_GIO: true,
                    },
                },
            },
        });
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

    confirmAppointmentAfterPayment(DK_MA: number) {
        return this.prisma.dANG_KY.updateMany({
            where: {
                DK_MA,
                DK_TRANG_THAI: 'CHO_THANH_TOAN',
            },
            data: {
                DK_TRANG_THAI: 'CHO_KHAM',
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

    async createNotificationIfAbsent(input: {
        phone?: string | null;
        type: string;
        title: string;
        content: string;
        dedupeKey: string;
        at?: Date;
        batchId?: number | null;
    }) {
        const phone = String(input.phone || '').trim();
        if (!phone) return null;
        const hasBatchColumn = await this.hasThongBaoBatchColumn();
        if (hasBatchColumn) {
            const exists = await this.prisma.tHONG_BAO.findFirst({
                where: {
                    TK_SDT: phone,
                    TB_LOAI: input.type,
                    TB_NOI_DUNG: { contains: input.dedupeKey },
                },
            });
            if (exists) return exists;

            return this.prisma.tHONG_BAO.create({
                data: {
                    TK_SDT: phone,
                    TB_BATCH_MA: input.batchId || null,
                    TB_TIEU_DE: input.title,
                    TB_LOAI: input.type,
                    TB_NOI_DUNG: `${input.content} ${input.dedupeKey}`.trim(),
                    TB_TRANG_THAI: 'UNREAD',
                    TB_THOI_GIAN: input.at || new Date(),
                },
            });
        }

        const legacyExists = await this.prisma
            .getClient()
            .$queryRawUnsafe<Array<{ TB_MA: number }>>(
                `SELECT "TB_MA"
                 FROM "THONG_BAO"
                 WHERE "TK_SDT" = $1
                   AND "TB_LOAI" = $2
                   AND "TB_NOI_DUNG" ILIKE '%' || $3 || '%'
                 ORDER BY "TB_MA" DESC
                 LIMIT 1`,
                phone,
                input.type,
                input.dedupeKey,
            );
        if (legacyExists.length > 0) {
            return {
                TB_MA: legacyExists[0].TB_MA,
                TK_SDT: phone,
                TB_TIEU_DE: input.title,
                TB_LOAI: input.type,
                TB_NOI_DUNG: `${input.content} ${input.dedupeKey}`.trim(),
                TB_TRANG_THAI: 'UNREAD',
                TB_THOI_GIAN: input.at || new Date(),
            } as any;
        }

        const inserted = await this.prisma
            .getClient()
            .$queryRawUnsafe<Array<any>>(
                `INSERT INTO "THONG_BAO" (
                   "TK_SDT",
                   "TB_TIEU_DE",
                   "TB_LOAI",
                   "TB_NOI_DUNG",
                   "TB_TRANG_THAI",
                   "TB_THOI_GIAN"
                 ) VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING "TB_MA", "TK_SDT", "TB_TIEU_DE", "TB_LOAI", "TB_NOI_DUNG", "TB_TRANG_THAI", "TB_THOI_GIAN"`,
                phone,
                input.title,
                input.type,
                `${input.content} ${input.dedupeKey}`.trim(),
                'UNREAD',
                input.at || new Date(),
            );
        return inserted[0] || null;
    }
}
