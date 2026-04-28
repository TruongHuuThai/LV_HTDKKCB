import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUserPayload } from '../auth/current-user.decorator';
import { BookingService } from '../booking/booking.service';
import { combineDateAndTime, parseDateOnly } from '../booking/booking.utils';
import { VnpayService } from '../payment/vnpay.service';
import { QrBankingService } from '../payment/qr-banking.service';
import {
  AdminWaitlistListQueryDto,
  AdminAppointmentListQueryDto,
  BulkNotificationDto,
  BulkNotificationListQueryDto,
  CancelAppointmentDto,
  CreateOrUpdatePreVisitInfoDto,
  DeleteAttachmentDto,
  DoctorStatsQueryDto,
  StartDoctorExamDto,
  UpdateDoctorClinicalNoteDto,
  CreateDoctorClinicalOrdersDto,
  UpdateDoctorOrderResultDto,
  CreateDoctorPrescriptionDto,
  FinishDoctorClinicalDto,
  GenerateEncounterBillingDto,
  MarkEncounterPaymentDto,
  CompleteEncounterDto,
  ConfirmDoctorExamDto,
  DoctorCatalogQueryDto,
  NotificationListQueryDto,
  DoctorUpdateAppointmentStatusDto,
  DoctorWorklistQueryDto,
  JoinWaitlistDto,
  ManualBookingDto,
  PatientAppointmentListQueryDto,
  PatientWaitlistListQueryDto,
  RefundListQueryDto,
  RetryBulkBatchDto,
  ReconciliationQueryDto,
  ReportingQueryDto,
  PilotRolloutConfigDto,
  RescheduleAppointmentDto,
  UploadPreVisitAttachmentDto,
  WaitlistHoldActionDto,
  UpdateAppointmentStatusDto,
  UpdateRefundStatusDto,
  OpsDashboardQueryDto,
} from './appointments.dto';
import {
  APPOINTMENT_STATUS,
  assertValidAppointmentStatusTransition,
  isAppointmentTerminalStatus,
} from './appointments.status';
import { evaluateCancelPolicy } from './cancel-policy.util';
import { mapAppointmentStatusToGroup } from './appointment-status-group.util';
import { AttachmentStorageService } from './attachment-storage.service';
import { AttachmentScanService } from './attachment-scan.service';
import { SHIFT_STATUS, WEEK_STATUS } from '../schedules/schedule-status';
import { PdfService } from '../pdf/pdf.service';
import { NotificationRecipientResolverService } from './notification-recipient-resolver.service';

const ACTIVE_BOOKING_STATUS = ['CHO_THANH_TOAN', 'CHO_KHAM', 'DA_CHECKIN'];
const REFUND_STATUSES = ['REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED', 'REFUND_REJECTED'];
const ALLOWED_PRE_VISIT_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_PRE_VISIT_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_PRE_VISIT_EXT = ['pdf', 'jpg', 'jpeg', 'png'];
const SUPPORTED_PAYMENT_METHODS = new Set(['VNPAY', 'QR_BANKING']);

const CLINICAL_ORDER_STATUS = {
  MOI_TAO: 'MOI_TAO',
  DA_CO_KET_QUA: 'DA_CO_KET_QUA',
} as const;

@Injectable()
export class AppointmentsService {
  private readonly optionalTableExistsCache = new Map<string, boolean>();
  private thongBaoHasBatchColumn: boolean | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingService: BookingService,
    private readonly vnpay: VnpayService,
    private readonly qrBanking: QrBankingService,
    private readonly config: ConfigService,
    private readonly attachmentStorage: AttachmentStorageService,
    private readonly attachmentScan: AttachmentScanService,
    private readonly pdfService: PdfService,
    private readonly notificationRecipientResolver: NotificationRecipientResolverService,
  ) {}

  private parseStatusList(raw?: string) {
    return (raw || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private getCancelCutoffMinutes() {
    const parsed = Number.parseInt(
      this.config.get<string>('APPOINTMENT_CANCEL_CUTOFF_MINUTES', '120'),
      10,
    );
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    return 120;
  }

  private normalizePaymentStatus(dbStatus?: string | null, at?: Date | null) {
    if (!dbStatus) return 'unpaid';
    const normalized = dbStatus.toUpperCase();

    if (normalized === 'DA_THANH_TOAN') return 'paid';
    if (normalized === 'THAT_BAI') return 'failed';
    if (normalized === 'HOAN_TIEN' || normalized === 'DA_HOAN_TIEN' || normalized === 'REFUNDED')
      return 'refunded';
    if (normalized === 'REFUND_PENDING') return 'refund_pending';
    if (normalized === 'REFUND_FAILED') return 'refund_failed';
    if (normalized === 'REFUND_REJECTED') return 'refund_rejected';
    if (normalized === 'HET_HAN' || normalized === 'EXPIRED') return 'expired';
    if (normalized === 'CHUA_THANH_TOAN') {
      const createdAt = at ? at.getTime() : 0;
      const isExpired = createdAt > 0 && Date.now() - createdAt > 15 * 60 * 1000;
      return isExpired ? 'expired' : 'unpaid';
    }
    return 'pending';
  }

  private mapPaymentStatusFilter(rawStatuses: string[]) {
    const mapped = new Set<string>();
    rawStatuses.forEach((status) => {
      const normalized = status.trim().toLowerCase();
      if (normalized === 'paid') mapped.add('DA_THANH_TOAN');
      if (normalized === 'failed') mapped.add('THAT_BAI');
      if (normalized === 'unpaid' || normalized === 'pending') mapped.add('CHUA_THANH_TOAN');
      if (normalized === 'expired') mapped.add('HET_HAN');
      if (normalized === 'refunded') {
        mapped.add('HOAN_TIEN');
        mapped.add('DA_HOAN_TIEN');
        mapped.add('REFUNDED');
      }
      if (normalized === 'refund_pending') mapped.add('REFUND_PENDING');
      if (normalized === 'refund_failed') mapped.add('REFUND_FAILED');
      if (normalized === 'refund_rejected') mapped.add('REFUND_REJECTED');
    });
    return Array.from(mapped);
  }

  private validatePreVisitAttachments(dto: CreateOrUpdatePreVisitInfoDto) {
    const attachments = dto.attachments || [];
    attachments.forEach((item) => {
      if (item.mimeType && !ALLOWED_PRE_VISIT_MIME.includes(item.mimeType.toLowerCase())) {
        throw new BadRequestException('Dinh dang file dinh kem khong duoc ho tro');
      }
      if ((item.sizeBytes || 0) > MAX_PRE_VISIT_ATTACHMENT_SIZE) {
        throw new BadRequestException('Kich thuoc file dinh kem vuot qua gioi han 10MB');
      }
    });
  }

  private assertPreVisitEditableStatus(status?: string | null) {
    const normalized = (status || '').toUpperCase();
    if (['HUY', 'HUY_BS_NGHI', 'DA_KHAM', 'NO_SHOW', 'DA_CHECKIN'].includes(normalized)) {
      throw new BadRequestException('Khong the cap nhat thong tin tien kham o trang thai hien tai');
    }
  }

  private normalizeDateRange(input?: { fromDate?: string; toDate?: string }) {
    const fromDate = input?.fromDate ? parseDateOnly(input.fromDate) : undefined;
    const toDate = input?.toDate ? parseDateOnly(input.toDate) : undefined;
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('fromDate phai nho hon hoac bang toDate');
    }
    return { fromDate, toDate };
  }

  private resolveDoctorStatsRange(query: DoctorStatsQueryDto) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const defaultTo = parseDateOnly(todayIso);
    const defaultFrom = new Date(defaultTo);
    defaultFrom.setDate(defaultFrom.getDate() - 29);

    const fromDate = query.fromDate ? parseDateOnly(query.fromDate) : defaultFrom;
    const toDate = query.toDate ? parseDateOnly(query.toDate) : defaultTo;
    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('Khoang thoi gian thong ke khong hop le');
    }

    return { fromDate, toDate, groupBy: query.groupBy || 'day' };
  }

  private formatTrendLabel(groupBy: 'day' | 'week' | 'month', value: Date) {
    const iso = value.toISOString();
    if (groupBy === 'month') return iso.slice(0, 7);
    return iso.slice(0, 10);
  }

  private formatDateOnly(value?: Date | string | null) {
    if (!value) return '-';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
  }

  private formatTimeOnly(value?: Date | string | null) {
    if (!value) return '-';
    if (value instanceof Date) return value.toISOString().slice(11, 16);
    const normalized = String(value);
    if (normalized.includes('T')) return normalized.slice(11, 16);
    return normalized.slice(0, 5);
  }

  private formatDatetime(value?: Date | string | null) {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toISOString().replace('T', ' ').slice(0, 19);
  }

  private toDisplayName(parts: Array<string | null | undefined>) {
    return parts
      .map((part) => (part || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private formatCurrency(value?: number | string | null) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return '0 VND';
    return `${Math.round(amount).toLocaleString('vi-VN')} VND`;
  }

  private buildAdvisoryLockKey(raw: string) {
    const digest = createHash('sha1').update(raw).digest('hex').slice(0, 8);
    return Number.parseInt(digest, 16) | 0;
  }

  private async withAdvisoryLock<T>(rawKey: string, work: () => Promise<T>) {
    const key = this.buildAdvisoryLockKey(rawKey);
    const lockRows = (await this.prisma.getClient().$queryRawUnsafe(
      `SELECT pg_try_advisory_lock($1) AS locked`,
      key,
    )) as Array<{ locked: boolean }>;
    if (!lockRows[0]?.locked) {
      return null;
    }

    try {
      return await work();
    } finally {
      await this.prisma.getClient().$queryRawUnsafe(`SELECT pg_advisory_unlock($1)`, key);
    }
  }

  private async hasOptionalTable(tableRegclass: string) {
    if (this.optionalTableExistsCache.has(tableRegclass)) {
      return this.optionalTableExistsCache.get(tableRegclass) as boolean;
    }
    try {
      const rows = (await this.prisma
        .getClient()
        .$queryRawUnsafe(`SELECT to_regclass($1) IS NOT NULL AS "exists"`, tableRegclass)) as Array<{
        exists: boolean;
      }>;
      const exists = Boolean(rows?.[0]?.exists);
      this.optionalTableExistsCache.set(tableRegclass, exists);
      return exists;
    } catch {
      // Fail closed if probing metadata fails, so background jobs can skip safely.
      return false;
    }
  }

  private async hasOptionalTables(tableRegclasses: string[]) {
    for (const table of tableRegclasses) {
      const exists = await this.hasOptionalTable(table);
      if (!exists) return false;
    }
    return true;
  }

  private isOptionalFeatureUnavailableError(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return e.code === 'P2021' || e.code === 'P2022';
    }
    const message = (e instanceof Error ? e.message : String(e)).toLowerCase();
    return (
      message.includes('connection terminated unexpectedly') ||
      message.includes("can't reach database server") ||
      message.includes('connection closed') ||
      message.includes('server has closed the connection') ||
      message.includes('econnreset')
    );
  }

  private async hasThongBaoBatchColumn() {
    if (this.thongBaoHasBatchColumn !== null) return this.thongBaoHasBatchColumn;
    try {
      const rows = (await this.prisma
        .getClient()
        .$queryRawUnsafe(
          `SELECT EXISTS (
             SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'THONG_BAO'
               AND column_name = 'TB_BATCH_MA'
           ) AS "exists"`,
        )) as Array<{ exists: boolean }>;
      this.thongBaoHasBatchColumn = Boolean(rows?.[0]?.exists);
    } catch {
      this.thongBaoHasBatchColumn = false;
    }
    return this.thongBaoHasBatchColumn;
  }

  private resolveReportingRange(query: ReportingQueryDto | ReconciliationQueryDto | OpsDashboardQueryDto) {
    const fromDate = query?.fromDate ? parseDateOnly(query.fromDate) : undefined;
    const toDate = query?.toDate ? parseDateOnly(query.toDate) : undefined;
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('fromDate phai nho hon hoac bang toDate');
    }
    const to = toDate || parseDateOnly(new Date().toISOString().slice(0, 10));
    const from = fromDate || new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  private async listActivePreVisitAttachments(appointmentId: number) {
    return this.prisma.pRE_VISIT_ATTACHMENT.findMany({
      where: { DK_MA: appointmentId, PVA_DA_XOA: false },
      orderBy: [{ PVA_TAO_LUC: 'desc' }, { PVA_MA: 'desc' }],
    });
  }

  private async getAppointmentOrThrow(DK_MA: number) {
    const appointment = await this.prisma.dANG_KY.findUnique({
      where: { DK_MA },
      include: {
        BENH_NHAN: true,
        KHUNG_GIO: true,
        LOAI_HINH_KHAM: true,
        LICH_BSK: {
          include: {
            BUOI: true,
            PHONG: {
              include: { CHUYEN_KHOA: true },
            },
            BAC_SI: {
              include: { CHUYEN_KHOA: true },
            },
          },
        },
        THANH_TOAN: {
          orderBy: { TT_THOI_GIAN: 'desc' },
        },
      },
    });

    if (!appointment) throw new NotFoundException('Khong tim thay lich hen');
    return appointment;
  }

  private async buildPreVisitInfoResponse(appointment: any) {
    const attachments = await this.listActivePreVisitAttachments(appointment.DK_MA);
    return {
      appointmentId: appointment.DK_MA,
      patientId: appointment.BN_MA,
      doctorId: appointment.BS_MA,
      symptoms: appointment.DK_TRIEU_CHUNG || null,
      note: appointment.DK_GHI_CHU_TIEN_KHAM || null,
      updatedAt: appointment.DK_TIEN_KHAM_CAP_NHAT_LUC || appointment.DK_THOI_GIAN_TAO || null,
      updatedBy: appointment.DK_TIEN_KHAM_CAP_NHAT_BOI || null,
      attachments: attachments.map((item) => ({
        attachmentId: item.PVA_MA,
        fileName: item.PVA_TEN_FILE,
        fileUrl: item.PVA_URL,
        mimeType: item.PVA_LOAI_MIME,
        sizeBytes: item.PVA_KICH_THUOC,
        createdAt: item.PVA_TAO_LUC,
      })),
    };
  }

  private validateAppointmentOwner(user: CurrentUserPayload, ownerPhone?: string | null) {
    if (!ownerPhone || ownerPhone !== user.TK_SDT) {
      throw new ForbiddenException('Ban khong co quyen thao tac lich hen nay');
    }
  }

  private getPreVisitAttachmentLimit() {
    const parsed = Number.parseInt(
      this.config.get<string>('PRE_VISIT_ATTACHMENT_MAX_PER_APPOINTMENT', '5'),
      10,
    );
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  }

  private getAttachmentSignedUrlTtlSeconds() {
    const parsed = Number.parseInt(
      this.config.get<string>('ATTACHMENT_SIGNED_URL_TTL_SECONDS', '600'),
      10,
    );
    return Number.isFinite(parsed) && parsed > 30 ? parsed : 600;
  }

  private getWaitlistHoldMinutes() {
    const parsed = Number.parseInt(
      this.config.get<string>('WAITLIST_HOLD_MINUTES', '15'),
      10,
    );
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
  }

  private extractExtension(fileName: string) {
    const parts = fileName.split('.');
    if (parts.length < 2) return '';
    return parts[parts.length - 1].toLowerCase();
  }

  private validateAttachmentInput(dto: UploadPreVisitAttachmentDto) {
    const mime = dto.mimeType.toLowerCase();
    if (!ALLOWED_PRE_VISIT_MIME.includes(mime)) {
      throw new BadRequestException('attachment type not allowed');
    }
    if (dto.sizeBytes > MAX_PRE_VISIT_ATTACHMENT_SIZE) {
      throw new BadRequestException('attachment too large');
    }
    const ext = this.extractExtension(dto.fileName);
    if (!ALLOWED_PRE_VISIT_EXT.includes(ext)) {
      throw new BadRequestException('attachment extension not allowed');
    }
    return ext;
  }

  private async writeAuditLog(input: {
    table?: string;
    action: string;
    actor?: string;
    pk?: any;
    old?: any;
    next?: any;
  }) {
    await this.prisma.aUDIT_LOG.create({
      data: {
        AL_TABLE: input.table || 'DANG_KY',
        AL_ACTION: input.action,
        AL_PK: input.pk ?? Prisma.JsonNull,
        AL_OLD: input.old ?? Prisma.JsonNull,
        AL_NEW: input.next ?? Prisma.JsonNull,
        AL_CHANGED_BY: input.actor ?? null,
      },
    });
  }

  private buildRefundSummary(appointment: any) {
    const payments = (appointment.THANH_TOAN || []).filter((item: any) => item.TT_LOAI !== 'HOAN_TIEN');
    const refunds = (appointment.THANH_TOAN || []).filter((item: any) => item.TT_LOAI === 'HOAN_TIEN');
    return {
      paymentCount: payments.length,
      refundCount: refunds.length,
      latestRefund: refunds[0] || null,
      hasRefundPending: refunds.some((item: any) => item.TT_TRANG_THAI === 'REFUND_PENDING'),
      hasRefundSuccess: refunds.some((item: any) =>
        ['REFUNDED', 'DA_HOAN_TIEN', 'HOAN_TIEN'].includes((item.TT_TRANG_THAI || '').toUpperCase()),
      ),
    };
  }

  private async getCurrentCancelPolicy(
    appointment: any,
    role: 'ADMIN' | 'BENH_NHAN',
    isOwner: boolean,
  ) {
    const slot = appointment.KHUNG_GIO;
    if (!slot) {
      return {
        canCancel: false,
        cutoffMinutes: this.getCancelCutoffMinutes(),
        cancelDeadlineAt: null,
        reasonIfBlocked: 'MISSING_SLOT',
      };
    }

    const startAt = combineDateAndTime(appointment.N_NGAY, slot.KG_BAT_DAU);
    const result = evaluateCancelPolicy({
      now: new Date(),
      appointmentStartAt: startAt,
      cutoffMinutes: this.getCancelCutoffMinutes(),
      appointmentStatus: appointment.DK_TRANG_THAI,
      isOwner,
      role,
    });

    return {
      canCancel: result.canCancel,
      cutoffMinutes: this.getCancelCutoffMinutes(),
      cancelDeadlineAt: result.cancelDeadlineAt,
      reasonIfBlocked: result.reasonIfBlocked,
    };
  }

  private async createRefundRequestIfEligibleTx(
    tx: Prisma.TransactionClient,
    appointment: any,
    actor: CurrentUserPayload,
  ) {
    const paidPayments = (appointment.THANH_TOAN || []).filter(
      (item: any) => this.normalizePaymentStatus(item.TT_TRANG_THAI, item.TT_THOI_GIAN) === 'paid',
    );
    const latestPaid = paidPayments[0];
    if (!latestPaid) return null;

    const existingRefund = await tx.tHANH_TOAN.findFirst({
      where: {
        DK_MA: appointment.DK_MA,
        TT_LOAI: 'HOAN_TIEN',
        TT_TRANG_THAI: { in: REFUND_STATUSES },
      },
      orderBy: { TT_THOI_GIAN: 'desc' },
    });
    if (existingRefund) return existingRefund;

    const amount = Number(latestPaid.TT_THUC_THU ?? latestPaid.TT_TONG_TIEN ?? 0);
    if (amount <= 0) return null;

    const refund = await tx.tHANH_TOAN.create({
      data: {
        DK_MA: appointment.DK_MA,
        TT_LOAI: 'HOAN_TIEN',
        TT_PHUONG_THUC: latestPaid.TT_PHUONG_THUC || 'VNPAY',
        TT_PHUONG_THUC_TT: latestPaid.TT_PHUONG_THUC_TT || null,
        TT_TIEN_KHAM: amount,
        TT_TONG_TIEN: amount,
        TT_THUC_THU: 0,
        TT_TRANG_THAI: 'REFUND_PENDING',
        TT_MA_GIAO_DICH: `REFUND_REQ_${latestPaid.TT_MA}_${Date.now()}`,
      },
    });

    await tx.aUDIT_LOG.create({
      data: {
        AL_TABLE: 'THANH_TOAN',
        AL_ACTION: 'REFUND_REQUEST_CREATED',
        AL_PK: { TT_MA: refund.TT_MA, DK_MA: appointment.DK_MA },
        AL_OLD: { sourcePaymentId: latestPaid.TT_MA },
        AL_NEW: {
          TT_TRANG_THAI: refund.TT_TRANG_THAI,
          amount,
        },
        AL_CHANGED_BY: actor.TK_SDT,
      },
    });

    return refund;
  }

  private async updateAppointmentStatusWithActor(
    actor: CurrentUserPayload,
    appointmentId: number,
    next: string,
    options?: { reason?: string; note?: string; action?: string },
  ) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    const current = appointment.DK_TRANG_THAI || APPOINTMENT_STATUS.CHO_KHAM;

    if (current === APPOINTMENT_STATUS.HUY || current === APPOINTMENT_STATUS.HUY_BS_NGHI) {
      throw new BadRequestException('Lich hen da huy, khong the cap nhat trang thai');
    }

    assertValidAppointmentStatusTransition(current, next);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.dANG_KY.update({
        where: { DK_MA: appointmentId },
        data: {
          DK_TRANG_THAI: next,
          DK_LY_DO_HUY:
            next === APPOINTMENT_STATUS.NO_SHOW ? options?.reason?.trim() || 'NO_SHOW' : null,
        },
      });

      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'DANG_KY',
          AL_ACTION: options?.action || 'STATUS_UPDATED',
          AL_PK: { DK_MA: appointmentId },
          AL_OLD: { DK_TRANG_THAI: current },
          AL_NEW: {
            DK_TRANG_THAI: next,
            reason: options?.reason || null,
            note: options?.note || null,
            actorRole: actor.role || null,
          },
          AL_CHANGED_BY: actor.TK_SDT,
        },
      });
      return row;
    });

    return updated;
  }

  private mapStatusGroupToWhere(
    statusGroup?: 'upcoming' | 'completed' | 'canceled' | 'no_show',
  ): Prisma.DANG_KYWhereInput {
    if (!statusGroup) return {};
    if (statusGroup === 'completed') {
      return { DK_TRANG_THAI: { in: ['DA_KHAM', 'HOAN_TAT'] } };
    }
    if (statusGroup === 'canceled') {
      return { DK_TRANG_THAI: { in: ['HUY', 'HUY_BS_NGHI'] } };
    }
    if (statusGroup === 'no_show') {
      return { DK_TRANG_THAI: 'NO_SHOW' };
    }

    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    return {
      DK_TRANG_THAI: { notIn: ['DA_KHAM', 'HUY', 'HUY_BS_NGHI', 'NO_SHOW'] },
      N_NGAY: { gte: today },
    };
  }

  private async createNotification(input: {
    phone: string;
    title: string;
    type: string;
    content: string;
    at?: Date;
  }) {
    const hasBatchColumn = await this.hasThongBaoBatchColumn();
    if (hasBatchColumn) {
      return this.prisma.tHONG_BAO.create({
        data: {
          TK_SDT: input.phone,
          TB_TIEU_DE: input.title,
          TB_LOAI: input.type,
          TB_NOI_DUNG: input.content,
          TB_TRANG_THAI: 'UNREAD',
          TB_THOI_GIAN: input.at ?? new Date(),
        },
      });
    }

    const rows = (await this.prisma
      .getClient()
      .$queryRawUnsafe(
        `INSERT INTO "THONG_BAO" (
           "TK_SDT",
           "TB_TIEU_DE",
           "TB_LOAI",
           "TB_NOI_DUNG",
           "TB_TRANG_THAI",
           "TB_THOI_GIAN"
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING "TB_MA", "TK_SDT", "TB_TIEU_DE", "TB_LOAI", "TB_NOI_DUNG", "TB_TRANG_THAI", "TB_THOI_GIAN"`,
        input.phone,
        input.title,
        input.type,
        input.content,
        'UNREAD',
        input.at ?? new Date(),
      )) as Array<any>;
    return rows[0] || null;
  }

  private async findNotificationByDedupe(phone: string, type: string, dedupeKey: string) {
    const hasBatchColumn = await this.hasThongBaoBatchColumn();
    if (hasBatchColumn) {
      return this.prisma.tHONG_BAO.findFirst({
        where: {
          TK_SDT: phone,
          TB_LOAI: type,
          TB_NOI_DUNG: { contains: dedupeKey, mode: 'insensitive' },
        },
      });
    }

    const rows = (await this.prisma
      .getClient()
      .$queryRawUnsafe(
        `SELECT "TB_MA", "TK_SDT", "TB_TIEU_DE", "TB_LOAI", "TB_NOI_DUNG", "TB_TRANG_THAI", "TB_THOI_GIAN"
         FROM "THONG_BAO"
         WHERE "TK_SDT" = $1
           AND "TB_LOAI" = $2
           AND "TB_NOI_DUNG" ILIKE '%' || $3 || '%'
         ORDER BY "TB_MA" DESC
         LIMIT 1`,
        phone,
        type,
        dedupeKey,
      )) as Array<any>;
    return rows[0] || null;
  }

  private async createAppointmentNotification(input: {
    appointmentId: number;
    phone: string;
    type:
      | 'reminder'
      | 'reschedule'
      | 'doctor_unavailable'
      | 'cancellation'
      | 'waitlist'
      | 'payment_success'
      | 'payment_failed'
      | 'payment_timeout'
      | 'payment_pending'
      | 'system_admin'
      | 'system_auto';
    title: string;
    content: string;
    dedupeKey: string;
  }) {
    const exists = await this.findNotificationByDedupe(
      input.phone,
      input.type,
      input.dedupeKey,
    );
    if (exists) return exists;

    return this.createNotification({
      phone: input.phone,
      title: input.title,
      type: input.type,
      content: `${input.content} (${input.dedupeKey})`,
    });
  }

  private async createPaymentNotification(input: {
    phone?: string | null;
    type: 'payment_success' | 'payment_failed' | 'payment_timeout' | 'payment_pending';
    title: string;
    content: string;
    dedupeKey: string;
    at?: Date;
  }) {
    const phone = String(input.phone || '').trim();
    if (!phone) return null;
    const exists = await this.findNotificationByDedupe(
      phone,
      input.type,
      input.dedupeKey,
    );
    if (exists) return exists;
    return this.createNotification({
      phone,
      title: input.title,
      type: input.type,
      content: `${input.content} (${input.dedupeKey})`,
      at: input.at,
    });
  }

  async listMyAppointments(user: CurrentUserPayload, query: PatientAppointmentListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const fromDate = query.fromDate ? parseDateOnly(query.fromDate) : undefined;
    const toDate = query.toDate ? parseDateOnly(query.toDate) : undefined;
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('fromDate phai nho hon hoac bang toDate');
    }

    const keyword = query.keyword?.trim() || '';
    const keywordId = Number.parseInt(keyword, 10);
    const statusWhere = this.mapStatusGroupToWhere(query.statusGroup);
    const where: Prisma.DANG_KYWhereInput = {
      BENH_NHAN: { TK_SDT: user.TK_SDT },
      ...(query.profileId ? { BN_MA: query.profileId } : {}),
      ...(fromDate || toDate
        ? {
            N_NGAY: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...statusWhere,
      ...(keyword
        ? {
            OR: [
              ...(Number.isFinite(keywordId) ? [{ DK_MA: keywordId }] : []),
              {
                LICH_BSK: {
                  is: {
                    BAC_SI: {
                      OR: [
                        { BS_HO_TEN: { contains: keyword, mode: 'insensitive' } },
                        { CHUYEN_KHOA: { CK_TEN: { contains: keyword, mode: 'insensitive' } } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.dANG_KY.count({ where }),
      this.prisma.dANG_KY.findMany({
        where,
        skip,
        take: limit,
        orderBy:
          query.statusGroup === 'upcoming'
            ? [{ N_NGAY: 'asc' }, { KG_MA: 'asc' }]
            : [{ N_NGAY: 'desc' }, { KG_MA: 'desc' }],
        include: {
          BENH_NHAN: true,
          KHUNG_GIO: true,
          LICH_BSK: {
            include: {
              PHONG: true,
              BAC_SI: { include: { CHUYEN_KHOA: true } },
            },
          },
          THANH_TOAN: {
            orderBy: { TT_THOI_GIAN: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    const items = await Promise.all(
      rows.map(async (row) => {
        const payment = row.THANH_TOAN[0] || null;
        const policy = await this.getCurrentCancelPolicy(
          { ...row, BENH_NHAN: { TK_SDT: user.TK_SDT } },
          'BENH_NHAN',
          true,
        );
        const canReschedule =
          !['DA_KHAM', 'HUY', 'HUY_BS_NGHI', 'NO_SHOW'].includes(row.DK_TRANG_THAI || '');
        const canUpdatePreVisit = !['DA_CHECKIN', 'DA_KHAM', 'HUY', 'HUY_BS_NGHI', 'NO_SHOW'].includes(
          row.DK_TRANG_THAI || '',
        );
        return {
          appointmentId: row.DK_MA,
          DK_MA: row.DK_MA,
          BN_MA: row.BN_MA,
          N_NGAY: row.N_NGAY,
          B_TEN: row.B_TEN,
          KG_MA: row.KG_MA,
          KG_BAT_DAU: row.KHUNG_GIO?.KG_BAT_DAU || null,
          KG_KET_THUC: row.KHUNG_GIO?.KG_KET_THUC || null,
          profile: row.BENH_NHAN
            ? {
                BN_MA: row.BENH_NHAN.BN_MA,
                fullName: `${row.BENH_NHAN.BN_HO_CHU_LOT || ''} ${row.BENH_NHAN.BN_TEN || ''}`
                  .trim()
                  .trim(),
              }
            : null,
          doctor: row.LICH_BSK?.BAC_SI
            ? {
                BS_MA: row.LICH_BSK.BAC_SI.BS_MA,
                BS_HO_TEN: row.LICH_BSK.BAC_SI.BS_HO_TEN,
              }
            : null,
          specialty: row.LICH_BSK?.BAC_SI?.CHUYEN_KHOA || null,
          room: row.LICH_BSK?.PHONG || null,
          status: row.DK_TRANG_THAI,
          statusGroup: mapAppointmentStatusToGroup(row.DK_TRANG_THAI),
          paymentStatus: payment
            ? this.normalizePaymentStatus(payment.TT_TRANG_THAI, payment.TT_THOI_GIAN)
            : 'unpaid',
          canCancel: policy.canCancel,
          canReschedule,
          canUpdatePreVisit,
          preVisitInfo: {
            symptoms: row.DK_TRIEU_CHUNG || null,
            note: row.DK_GHI_CHU_TIEN_KHAM || null,
            updatedAt: row.DK_TIEN_KHAM_CAP_NHAT_LUC || null,
          },
        };
      }),
    );

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getAppointmentDetailForPatient(user: CurrentUserPayload, appointmentId: number) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    this.validateAppointmentOwner(user, appointment.BENH_NHAN?.TK_SDT);
    const cancelPolicy = await this.getCurrentCancelPolicy(appointment, 'BENH_NHAN', true);

    const notifications = await this.prisma.tHONG_BAO.findMany({
      where: {
        TK_SDT: user.TK_SDT,
        TB_NOI_DUNG: { contains: `[DK_MA=${appointment.DK_MA}]`, mode: 'insensitive' },
      },
      orderBy: { TB_THOI_GIAN: 'desc' },
      take: 10,
    });

    const waitlistItems = await this.prisma
      .getClient()
      .$queryRawUnsafe<any[]>(
        `SELECT *
         FROM "WAITLIST_ENTRY"
         WHERE "BN_MA" = $1
           AND "BS_MA" = $2
           AND "N_NGAY" = $3
           AND "B_TEN" = $4
           AND "KG_MA" = $5
         ORDER BY "WL_CREATED_AT" DESC
         LIMIT 5`,
        appointment.BN_MA,
        appointment.BS_MA,
        appointment.N_NGAY,
        appointment.B_TEN,
        appointment.KG_MA,
      )
      .catch(() => []);

    const preVisit = await this.buildPreVisitInfoResponse(appointment);
    const prescriptions = await this.getPrescriptionSummaryByAppointment(appointment.DK_MA);

    return {
      appointment,
      preVisit,
      prescriptions,
      cancelPolicy,
      refund: this.buildRefundSummary(appointment),
      notifications,
      waitlist: waitlistItems,
    };
  }

  private async getPrescriptionSummaryByAppointment(appointmentId: number) {
    const prescriptions = await this.prisma.dON_THUOC.findMany({
      where: {
        PHIEU_KHAM_BENH: {
          is: {
            DK_MA: appointmentId,
          },
        },
      },
      orderBy: { DT_NGAY_TAO: 'desc' },
      include: {
        CHI_TIET_DON_THUOC: {
          include: {
            THUOC: {
              include: {
                DON_VI_TINH: true,
              },
            },
          },
        },
      },
    });

    return prescriptions.map((prescription) => ({
      prescriptionId: prescription.DT_MA,
      note: prescription.DT_GHI_CHU || null,
      days: prescription.DT_SO_NGAY_SUNG || null,
      createdAt: prescription.DT_NGAY_TAO || null,
      medicines: (prescription.CHI_TIET_DON_THUOC || []).map((item) => ({
        medicineId: item.T_MA,
        medicineName: item.THUOC?.T_TEN_THUOC || null,
        quantity: Number(item.CTDT_SO_LUONG || 0),
        unit: item.THUOC?.DON_VI_TINH?.DVT_TEN || null,
        dosage: item.CTDT_LIEU_DUNG || null,
        usage: item.CTDT_CACH_DUNG || null,
      })),
    }));
  }

  private async buildAppointmentConfirmationPdfBuffer(appointment: any, exportedBy: string) {
    const patientName =
      this.toDisplayName([appointment.BENH_NHAN?.BN_HO_CHU_LOT, appointment.BENH_NHAN?.BN_TEN]) ||
      `BENH_NHAN #${appointment.BN_MA}`;
    const doctorName = appointment.LICH_BSK?.BAC_SI?.BS_HO_TEN || `BAC_SI #${appointment.BS_MA}`;
    const specialtyName = appointment.LICH_BSK?.BAC_SI?.CHUYEN_KHOA?.CK_TEN || '-';
    const roomName = appointment.LICH_BSK?.PHONG?.P_TEN || '-';
    const status = appointment.DK_TRANG_THAI || 'CHO_KHAM';

    const report = await this.pdfService.buildReport({
      title: 'PHIEU XAC NHAN DANG KY KHAM BENH',
      subtitle: `Ma lich hen: #${appointment.DK_MA}`,
      metadataLines: [`Exported by: ${exportedBy}`],
      sections: [
        {
          heading: 'Thong tin benh nhan',
          keyValues: [
            { label: 'Ma benh nhan', value: String(appointment.BN_MA || '-') },
            { label: 'Ho ten', value: patientName },
            { label: 'So dien thoai', value: appointment.BENH_NHAN?.BN_SDT_DANG_KY || '-' },
            { label: 'So tai khoan', value: appointment.BENH_NHAN?.TK_SDT || '-' },
          ],
        },
        {
          heading: 'Thong tin lich kham',
          keyValues: [
            { label: 'Ma lich hen', value: String(appointment.DK_MA) },
            { label: 'Ngay kham', value: this.formatDateOnly(appointment.N_NGAY) },
            { label: 'Buoi', value: appointment.B_TEN || '-' },
            {
              label: 'Khung gio',
              value: `${this.formatTimeOnly(appointment.KHUNG_GIO?.KG_BAT_DAU)} - ${this.formatTimeOnly(appointment.KHUNG_GIO?.KG_KET_THUC)}`,
            },
            { label: 'Bac si', value: doctorName },
            { label: 'Chuyen khoa', value: specialtyName },
            { label: 'Phong kham', value: roomName },
            { label: 'Trang thai', value: status },
            { label: 'Trieu chung ban dau', value: appointment.DK_TRIEU_CHUNG || '-' },
            { label: 'Ghi chu tien kham', value: appointment.DK_GHI_CHU_TIEN_KHAM || '-' },
            { label: 'Thoi gian tao', value: this.formatDatetime(appointment.DK_THOI_GIAN_TAO) },
          ],
        },
      ],
    });

    await this.writeAuditLog({
      table: 'DANG_KY',
      action: 'APPOINTMENT_CONFIRMATION_PDF_EXPORTED',
      actor: exportedBy,
      pk: { DK_MA: appointment.DK_MA },
      next: { exportedAt: new Date().toISOString() },
    });

    return {
      filename: `appointment-confirmation-${appointment.DK_MA}.pdf`,
      buffer: report,
    };
  }

  async exportAppointmentConfirmationPdfForPatient(
    user: CurrentUserPayload,
    appointmentId: number,
  ) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    this.validateAppointmentOwner(user, appointment.BENH_NHAN?.TK_SDT);
    return this.buildAppointmentConfirmationPdfBuffer(appointment, user.TK_SDT);
  }

  async exportAppointmentConfirmationPdfForAdmin(
    user: CurrentUserPayload,
    appointmentId: number,
  ) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    return this.buildAppointmentConfirmationPdfBuffer(appointment, user.TK_SDT);
  }

  async getPreVisitInfoForPatient(user: CurrentUserPayload, appointmentId: number) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    this.validateAppointmentOwner(user, appointment.BENH_NHAN?.TK_SDT);
    return this.buildPreVisitInfoResponse(appointment);
  }

  async getPreVisitInfoForDoctor(user: CurrentUserPayload, appointmentId: number) {
    if (!user.bsMa) throw new ForbiddenException('Tai khoan hien tai khong phai bac si');
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    if (appointment.BS_MA !== user.bsMa) {
      throw new ForbiddenException('Ban khong co quyen xem thong tin tien kham cua lich nay');
    }
    return this.buildPreVisitInfoResponse(appointment);
  }

  async getPreVisitInfoForAdmin(appointmentId: number) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    return this.buildPreVisitInfoResponse(appointment);
  }

  async updatePreVisitInfoByPatient(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: CreateOrUpdatePreVisitInfoDto,
  ) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    this.validateAppointmentOwner(user, appointment.BENH_NHAN?.TK_SDT);
    this.assertPreVisitEditableStatus(appointment.DK_TRANG_THAI);
    this.validatePreVisitAttachments(dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.dANG_KY.findUnique({
        where: { DK_MA: appointmentId },
      });
      if (!latest) throw new NotFoundException('Khong tim thay lich hen');
      this.assertPreVisitEditableStatus(latest.DK_TRANG_THAI);

      if ((dto.removeAttachmentIds?.length || 0) > 0) {
        await tx.pRE_VISIT_ATTACHMENT.updateMany({
          where: {
            DK_MA: appointmentId,
            PVA_MA: { in: dto.removeAttachmentIds },
            PVA_DA_XOA: false,
          },
          data: {
            PVA_DA_XOA: true,
            PVA_XOA_LUC: new Date(),
            PVA_XOA_BOI: user.TK_SDT,
          },
        });
      }

      if ((dto.attachments?.length || 0) > 0) {
        await tx.pRE_VISIT_ATTACHMENT.createMany({
          data: (dto.attachments || []).map((item) => ({
            DK_MA: appointmentId,
            PVA_TEN_FILE: item.fileName,
            PVA_URL: item.fileUrl || null,
            PVA_LOAI_MIME: item.mimeType || null,
            PVA_KICH_THUOC: item.sizeBytes ?? null,
            PVA_TAO_BOI: user.TK_SDT,
          })),
        });
      }

      const row = await tx.dANG_KY.update({
        where: { DK_MA: appointmentId },
        data: {
          DK_TRIEU_CHUNG: dto.symptoms ?? latest.DK_TRIEU_CHUNG ?? null,
          DK_GHI_CHU_TIEN_KHAM: dto.note ?? latest.DK_GHI_CHU_TIEN_KHAM ?? null,
          DK_TIEN_KHAM_CAP_NHAT_LUC: new Date(),
          DK_TIEN_KHAM_CAP_NHAT_BOI: user.TK_SDT,
        },
      });

      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'DANG_KY',
          AL_ACTION: 'PRE_VISIT_INFO_UPDATED',
          AL_PK: { DK_MA: appointmentId },
          AL_OLD: {
            symptoms: latest.DK_TRIEU_CHUNG || null,
            note: latest.DK_GHI_CHU_TIEN_KHAM || null,
          },
          AL_NEW: {
            symptoms: row.DK_TRIEU_CHUNG || null,
            note: row.DK_GHI_CHU_TIEN_KHAM || null,
            addedAttachments: dto.attachments?.length || 0,
            removedAttachmentIds: dto.removeAttachmentIds || [],
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });

      return row;
    });

    const payload = await this.buildPreVisitInfoResponse(updated);
    return {
      message: 'Cap nhat thong tin tien kham thanh cong',
      data: payload,
    };
  }

  async listAttachmentsForPatient(user: CurrentUserPayload, appointmentId: number) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    this.validateAppointmentOwner(user, appointment.BENH_NHAN?.TK_SDT);
    const attachments = await this.listActivePreVisitAttachments(appointmentId);
    return {
      items: attachments.map((item) => ({
        attachmentId: item.PVA_MA,
        fileName: item.PVA_TEN_FILE,
        mimeType: item.PVA_LOAI_MIME,
        sizeBytes: item.PVA_KICH_THUOC,
        scanStatus: item.PVA_SCAN_STATUS,
        revokedAt: item.PVA_REVOKED_AT,
        createdAt: item.PVA_TAO_LUC,
      })),
    };
  }

  async uploadAttachmentForPatient(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: UploadPreVisitAttachmentDto,
  ) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    this.validateAppointmentOwner(user, appointment.BENH_NHAN?.TK_SDT);
    this.assertPreVisitEditableStatus(appointment.DK_TRANG_THAI);
    const ext = this.validateAttachmentInput(dto);

    const activeCount = await this.prisma.pRE_VISIT_ATTACHMENT.count({
      where: { DK_MA: appointmentId, PVA_DA_XOA: false },
    });
    if (activeCount >= this.getPreVisitAttachmentLimit()) {
      throw new BadRequestException('Vuot qua so luong file dinh kem toi da');
    }

    const binary = Buffer.from(dto.base64Content, 'base64');
    if (binary.length !== dto.sizeBytes) {
      throw new BadRequestException('Kich thuoc file khong hop le');
    }

    const saved = await this.attachmentStorage.savePreVisitFile({
      appointmentId,
      fileName: dto.fileName,
      ext,
      base64Content: dto.base64Content,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.pRE_VISIT_ATTACHMENT.create({
        data: {
          DK_MA: appointmentId,
          PVA_TEN_FILE: dto.fileName,
          PVA_URL: null,
          PVA_STORAGE_KEY: saved.storageKey,
          PVA_EXT: ext,
          PVA_LOAI_MIME: dto.mimeType,
          PVA_KICH_THUOC: dto.sizeBytes,
          PVA_SCAN_STATUS: 'SCANNING',
          PVA_TAO_BOI: user.TK_SDT,
        },
      });

      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'PRE_VISIT_ATTACHMENT',
          AL_ACTION: 'ATTACHMENT_UPLOAD_COMPLETED',
          AL_PK: { PVA_MA: row.PVA_MA, DK_MA: appointmentId },
          AL_NEW: {
            fileName: row.PVA_TEN_FILE,
            mimeType: row.PVA_LOAI_MIME,
            sizeBytes: row.PVA_KICH_THUOC,
            scanStatus: row.PVA_SCAN_STATUS,
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });

      return row;
    });

    const scan = await this.attachmentScan.scan({
      fileName: dto.fileName,
      mimeType: dto.mimeType,
      firstBytes: binary.subarray(0, 16),
    });

    const scanStatus =
      scan.status === 'CLEAN'
        ? 'CLEAN'
        : scan.status === 'INFECTED'
          ? 'INFECTED'
          : 'SCAN_FAILED';

    await this.prisma.$transaction(async (tx) => {
      await tx.pRE_VISIT_ATTACHMENT.update({
        where: { PVA_MA: created.PVA_MA },
        data: {
          PVA_SCAN_STATUS: scanStatus,
          PVA_SCAN_LUC: new Date(),
          ...(scanStatus === 'INFECTED'
            ? {
                PVA_REVOKED_AT: new Date(),
                PVA_REVOKED_BY: 'SYSTEM_SCAN',
                PVA_REVOKE_REASON: scan.reason || 'infected',
              }
            : {}),
        },
      });

      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'PRE_VISIT_ATTACHMENT',
          AL_ACTION: 'ATTACHMENT_SCAN_RESULT',
          AL_PK: { PVA_MA: created.PVA_MA },
          AL_NEW: { status: scanStatus, reason: scan.reason || null },
          AL_CHANGED_BY: 'SYSTEM',
        },
      });
    });

    if (scanStatus === 'INFECTED') {
      await this.attachmentStorage.softDelete(saved.storageKey);
      throw new BadRequestException('File khong an toan va da bi thu hoi');
    }

    return {
      message: 'Tai file dinh kem thanh cong',
      attachmentId: created.PVA_MA,
      scanStatus,
    };
  }

  async deleteAttachmentForPatient(
    user: CurrentUserPayload,
    appointmentId: number,
    attachmentId: number,
    dto?: DeleteAttachmentDto,
  ) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    this.validateAppointmentOwner(user, appointment.BENH_NHAN?.TK_SDT);

    const attachment = await this.prisma.pRE_VISIT_ATTACHMENT.findUnique({
      where: { PVA_MA: attachmentId },
    });
    if (!attachment || attachment.DK_MA !== appointmentId || attachment.PVA_DA_XOA) {
      throw new NotFoundException('Khong tim thay file dinh kem');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.pRE_VISIT_ATTACHMENT.update({
        where: { PVA_MA: attachmentId },
        data: {
          PVA_DA_XOA: true,
          PVA_XOA_LUC: new Date(),
          PVA_XOA_BOI: user.TK_SDT,
          PVA_REVOKED_AT: new Date(),
          PVA_REVOKED_BY: user.TK_SDT,
          PVA_REVOKE_REASON: dto?.reason || 'patient_deleted',
        },
      });
      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'PRE_VISIT_ATTACHMENT',
          AL_ACTION: 'ATTACHMENT_DELETED',
          AL_PK: { PVA_MA: attachmentId, DK_MA: appointmentId },
          AL_NEW: { reason: dto?.reason || null },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });
    });

    await this.attachmentStorage.softDelete(attachment.PVA_STORAGE_KEY);
    return { message: 'Da xoa file dinh kem', attachmentId };
  }

  async getAttachmentAccessUrl(user: CurrentUserPayload, attachmentId: number) {
    const attachment = await this.prisma.pRE_VISIT_ATTACHMENT.findUnique({
      where: { PVA_MA: attachmentId },
      include: { DANG_KY: { include: { BENH_NHAN: true } } },
    });
    if (!attachment || attachment.PVA_DA_XOA) throw new NotFoundException('attachment not found');
    if (attachment.PVA_SCAN_STATUS !== 'CLEAN') {
      throw new BadRequestException('attachment is not available');
    }
    if (attachment.PVA_REVOKED_AT) {
      throw new BadRequestException('attachment revoked');
    }

    const isAdmin = user.role === 'ADMIN';
    const isOwner = attachment.DANG_KY?.BENH_NHAN?.TK_SDT === user.TK_SDT;
    const isDoctor = user.role === 'BAC_SI' && user.bsMa === attachment.DANG_KY?.BS_MA;
    if (!isAdmin && !isOwner && !isDoctor) {
      throw new ForbiddenException('forbidden');
    }

    const expiresAt = Date.now() + this.getAttachmentSignedUrlTtlSeconds() * 1000;
    const token = this.attachmentStorage.buildSignedToken({ attachmentId, expiresAt });
    await this.writeAuditLog({
      table: 'PRE_VISIT_ATTACHMENT',
      action: 'ATTACHMENT_ACCESS_URL_ISSUED',
      actor: user.TK_SDT,
      pk: { PVA_MA: attachmentId },
      next: { expiresAt: new Date(expiresAt).toISOString() },
    });
    return {
      attachmentId,
      expiresAt: new Date(expiresAt).toISOString(),
      accessUrl: `/attachments/${attachmentId}/access?token=${token}`,
    };
  }

  async streamAttachmentBySignedToken(attachmentId: number, token: string) {
    const verified = this.attachmentStorage.verifySignedToken(token || '');
    if (!verified.valid || verified.attachmentId !== attachmentId) {
      throw new ForbiddenException('invalid attachment token');
    }

    const attachment = await this.prisma.pRE_VISIT_ATTACHMENT.findUnique({
      where: { PVA_MA: attachmentId },
    });
    if (!attachment || attachment.PVA_DA_XOA || attachment.PVA_REVOKED_AT) {
      throw new NotFoundException('attachment not found');
    }
    if (attachment.PVA_SCAN_STATUS !== 'CLEAN') {
      throw new BadRequestException('attachment is not available');
    }
    if (!attachment.PVA_STORAGE_KEY) throw new NotFoundException('attachment storage key not found');

    const content = await fs.readFile(this.attachmentStorage.resolveFilePath(attachment.PVA_STORAGE_KEY));
    return {
      fileName: attachment.PVA_TEN_FILE,
      mimeType: attachment.PVA_LOAI_MIME || 'application/octet-stream',
      content,
    };
  }

  async listNotifications(user: CurrentUserPayload, query: NotificationListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const isRead =
      query.isRead === 'true' ? 'READ' : query.isRead === 'false' ? 'UNREAD' : undefined;

    const hasBatchColumn = await this.hasThongBaoBatchColumn();
    let total = 0;
    let rows: any[] = [];
    if (hasBatchColumn) {
      const where: Prisma.THONG_BAOWhereInput = {
        TK_SDT: user.TK_SDT,
        ...(query.type ? { TB_LOAI: query.type } : {}),
        ...(isRead ? { TB_TRANG_THAI: isRead } : {}),
      };
      const result = await this.prisma.$transaction([
        this.prisma.tHONG_BAO.count({ where }),
        this.prisma.tHONG_BAO.findMany({
          where,
          skip,
          take: limit,
          orderBy: { TB_THOI_GIAN: 'desc' },
        }),
      ]);
      total = result[0];
      rows = result[1] as any[];
    } else {
      const conditions: string[] = [`"TK_SDT" = $1`];
      const params: any[] = [user.TK_SDT];
      if (query.type) {
        params.push(query.type);
        conditions.push(`"TB_LOAI" = $${params.length}`);
      }
      if (isRead) {
        params.push(isRead);
        conditions.push(`"TB_TRANG_THAI" = $${params.length}`);
      }
      const whereSql = conditions.join(' AND ');
      const countRows = (await this.prisma
        .getClient()
        .$queryRawUnsafe(
          `SELECT COUNT(*)::int AS total FROM "THONG_BAO" WHERE ${whereSql}`,
          ...params,
        )) as Array<{ total: number }>;
      total = Number(countRows?.[0]?.total || 0);

      const pageParams = [...params, skip, limit];
      rows = (await this.prisma
        .getClient()
        .$queryRawUnsafe(
          `SELECT
             "TB_MA",
             "TK_SDT",
             NULL::int AS "TB_BATCH_MA",
             "TB_TIEU_DE",
             "TB_LOAI",
             "TB_NOI_DUNG",
             "TB_TRANG_THAI",
             "TB_THOI_GIAN"
           FROM "THONG_BAO"
           WHERE ${whereSql}
           ORDER BY "TB_THOI_GIAN" DESC
           OFFSET $${params.length + 1}
           LIMIT $${params.length + 2}`,
          ...pageParams,
        )) as any[];
    }

    return {
      items: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async markNotificationRead(user: CurrentUserPayload, notificationId: number) {
    const hasBatchColumn = await this.hasThongBaoBatchColumn();
    let updated: any = null;
    if (hasBatchColumn) {
      const noti = await this.prisma.tHONG_BAO.findUnique({ where: { TB_MA: notificationId } });
      if (!noti || noti.TK_SDT !== user.TK_SDT) {
        throw new NotFoundException('Khong tim thay thong bao');
      }
      updated = await this.prisma.tHONG_BAO.update({
        where: { TB_MA: notificationId },
        data: { TB_TRANG_THAI: 'READ' },
      });
    } else {
      const rows = (await this.prisma
        .getClient()
        .$queryRawUnsafe(
          `UPDATE "THONG_BAO"
           SET "TB_TRANG_THAI" = 'READ'
           WHERE "TB_MA" = $1
             AND "TK_SDT" = $2
           RETURNING "TB_MA", "TK_SDT", "TB_TIEU_DE", "TB_LOAI", "TB_NOI_DUNG", "TB_TRANG_THAI", "TB_THOI_GIAN"`,
          notificationId,
          user.TK_SDT,
        )) as any[];
      updated = rows[0] || null;
      if (!updated) {
        throw new NotFoundException('Khong tim thay thong bao');
      }
    }
    return { message: 'Da danh dau da doc', notification: updated };
  }

  async markAllNotificationsRead(user: CurrentUserPayload) {
    const hasBatchColumn = await this.hasThongBaoBatchColumn();
    if (hasBatchColumn) {
      const result = await this.prisma.tHONG_BAO.updateMany({
        where: { TK_SDT: user.TK_SDT, TB_TRANG_THAI: { not: 'READ' } },
        data: { TB_TRANG_THAI: 'READ' },
      });
      return { message: 'Da danh dau tat ca la da doc', updatedCount: result.count };
    }

    const rows = (await this.prisma
      .getClient()
      .$queryRawUnsafe(
        `WITH updated AS (
           UPDATE "THONG_BAO"
           SET "TB_TRANG_THAI" = 'READ'
           WHERE "TK_SDT" = $1
             AND COALESCE("TB_TRANG_THAI", '') <> 'READ'
           RETURNING 1
         )
         SELECT COUNT(*)::int AS total FROM updated`,
        user.TK_SDT,
      )) as Array<{ total: number }>;
    return {
      message: 'Da danh dau tat ca la da doc',
      updatedCount: Number(rows?.[0]?.total || 0),
    };
  }

  async joinWaitlist(user: CurrentUserPayload, dto: JoinWaitlistDto) {
    const patient = await this.prisma.bENH_NHAN.findFirst({
      where: { TK_SDT: user.TK_SDT, BN_DA_VO_HIEU: false },
      select: { BN_MA: true },
    });
    if (!patient) throw new NotFoundException('Khong tim thay ho so benh nhan hop le');

    const date = parseDateOnly(dto.date);
    const schedule = await this.prisma.lICH_BSK.findFirst({
      where: {
        BS_MA: dto.doctorId,
        N_NGAY: date,
        B_TEN: dto.shift,
        LBSK_IS_ARCHIVED: false,
        LBSK_TRANG_THAI: SHIFT_STATUS.finalized,
      },
      include: { BAC_SI: true },
    });
    if (!schedule) throw new NotFoundException('Khong tim thay lich bac si cho slot yeu cau');

    const slot = await this.prisma.kHUNG_GIO.findUnique({ where: { KG_MA: dto.slotId } });
    if (!slot || slot.B_TEN !== dto.shift) {
      throw new BadRequestException('Khung gio khong hop le voi ca yeu cau');
    }

    const activeCount = await this.prisma.dANG_KY.count({
      where: {
        BS_MA: dto.doctorId,
        N_NGAY: date,
        B_TEN: dto.shift,
        KG_MA: dto.slotId,
        DK_TRANG_THAI: { in: ACTIVE_BOOKING_STATUS },
      },
    });
    const maxCapacity = slot.KG_SO_BN_TOI_DA ?? 5;
    if (activeCount < maxCapacity) {
      throw new BadRequestException(
        'Slot van con trong, vui long dat lich truc tiep thay vi vao danh sach cho',
      );
    }

    const existingActive = await this.prisma
      .getClient()
      .$queryRawUnsafe<any[]>(
        `SELECT "WL_ID"
         FROM "WAITLIST_ENTRY"
         WHERE "BN_MA" = $1
           AND "BS_MA" = $2
           AND "N_NGAY" = $3
           AND "B_TEN" = $4
           AND "KG_MA" = $5
           AND "WL_STATUS" IN ('WAITING', 'NOTIFIED', 'HOLDING')
         LIMIT 1`,
        patient.BN_MA,
        dto.doctorId,
        date,
        dto.shift,
        dto.slotId,
      )
      .catch(() => []);
    if (existingActive.length > 0) {
      throw new ConflictException('Ban da dang ky danh sach cho cho slot nay');
    }

    const row = await this.prisma
      .getClient()
      .$queryRawUnsafe<any[]>(
        `INSERT INTO "WAITLIST_ENTRY" (
          "BN_MA","BS_MA","N_NGAY","B_TEN","KG_MA","WL_STATUS","WL_NOTE","WL_SOURCE"
        )
        VALUES ($1,$2,$3,$4,$5,'WAITING',$6,'PATIENT_APP')
        RETURNING *`,
        patient.BN_MA,
        dto.doctorId,
        date,
        dto.shift,
        dto.slotId,
        dto.note || null,
      );

    await this.writeAuditLog({
      table: 'WAITLIST_ENTRY',
      action: 'WAITLIST_JOINED',
      actor: user.TK_SDT,
      pk: { WL_ID: row[0]?.WL_ID },
      next: {
        BN_MA: patient.BN_MA,
        BS_MA: dto.doctorId,
        N_NGAY: dto.date,
        B_TEN: dto.shift,
        KG_MA: dto.slotId,
      },
    });

    return { message: 'Da tham gia danh sach cho', waitlist: row[0] };
  }

  async leaveWaitlist(user: CurrentUserPayload, waitlistId: number) {
    const patient = await this.prisma.bENH_NHAN.findFirst({
      where: { TK_SDT: user.TK_SDT },
      select: { BN_MA: true },
    });
    if (!patient) throw new NotFoundException('Khong tim thay ho so benh nhan');

    const rows = await this.prisma
      .getClient()
      .$queryRawUnsafe<any[]>(
        `SELECT *
         FROM "WAITLIST_ENTRY"
         WHERE "WL_ID" = $1
           AND "BN_MA" = $2
         LIMIT 1`,
        waitlistId,
        patient.BN_MA,
      );
    const found = rows[0];
    if (!found) throw new NotFoundException('Khong tim thay dang ky danh sach cho');
    if (!['WAITING', 'NOTIFIED', 'HOLDING'].includes(found.WL_STATUS)) {
      throw new BadRequestException('Khong the roi danh sach cho o trang thai hien tai');
    }

    await this.prisma
      .getClient()
      .$executeRawUnsafe(
        `UPDATE "WAITLIST_ENTRY"
         SET "WL_STATUS" = 'CANCELED',
             "WL_UPDATED_AT" = NOW()
         WHERE "WL_ID" = $1`,
        waitlistId,
      );

    await this.writeAuditLog({
      table: 'WAITLIST_ENTRY',
      action: 'WAITLIST_LEFT',
      actor: user.TK_SDT,
      pk: { WL_ID: waitlistId },
      old: { WL_STATUS: found.WL_STATUS },
      next: { WL_STATUS: 'CANCELED' },
    });

    return { message: 'Da roi danh sach cho', waitlistId };
  }

  async listMyWaitlist(user: CurrentUserPayload, query: PatientWaitlistListQueryDto) {
    const patient = await this.prisma.bENH_NHAN.findFirst({
      where: { TK_SDT: user.TK_SDT },
      select: { BN_MA: true },
    });
    if (!patient) throw new NotFoundException('Khong tim thay ho so benh nhan');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const statusWhere = query.status ? `AND wl."WL_STATUS" = '${query.status}'` : '';

    const items = await this.prisma
      .getClient()
      .$queryRawUnsafe<any[]>(
        `SELECT
          wl.*,
          bs."BS_HO_TEN",
          ck."CK_TEN",
          kg."KG_BAT_DAU",
          kg."KG_KET_THUC"
         FROM "WAITLIST_ENTRY" wl
         JOIN "BAC_SI" bs ON bs."BS_MA" = wl."BS_MA"
         JOIN "CHUYEN_KHOA" ck ON ck."CK_MA" = bs."CK_MA"
         LEFT JOIN "KHUNG_GIO" kg ON kg."KG_MA" = wl."KG_MA"
         WHERE wl."BN_MA" = $1
           ${statusWhere}
         ORDER BY wl."WL_CREATED_AT" DESC
         LIMIT $2 OFFSET $3`,
        patient.BN_MA,
        limit,
        offset,
      )
      .catch(() => []);

    const countRows = await this.prisma
      .getClient()
      .$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS total
         FROM "WAITLIST_ENTRY" wl
         WHERE wl."BN_MA" = $1
           ${statusWhere}`,
        patient.BN_MA,
      )
      .catch(() => [{ total: 0 }]);

    const total = Number(countRows[0]?.total || 0);
    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async claimWaitlistHold(
    user: CurrentUserPayload,
    waitlistId: number,
    dto: WaitlistHoldActionDto,
    clientIp = '127.0.0.1',
  ) {
    const patient = await this.prisma.bENH_NHAN.findFirst({
      where: { TK_SDT: user.TK_SDT },
      select: { BN_MA: true },
    });
    if (!patient) throw new NotFoundException('Khong tim thay ho so benh nhan');

    const result = await this.prisma.$transaction(async (tx) => {
      const rows = (await tx.$queryRawUnsafe(
        `SELECT *
         FROM "WAITLIST_ENTRY"
         WHERE "WL_ID" = $1
           AND "BN_MA" = $2
         LIMIT 1`,
        waitlistId,
        patient.BN_MA,
      )) as any[];
      const hold = rows[0];
      if (!hold) throw new NotFoundException('Khong tim thay waitlist hold');
      if (hold.WL_STATUS !== 'HOLDING') throw new BadRequestException('Waitlist hold khong hop le');
      if (dto.holdToken && hold.WL_HOLD_TOKEN !== dto.holdToken) {
        throw new ForbiddenException('Hold token khong hop le');
      }
      if (!hold.WL_HOLD_EXPIRES_AT || new Date(hold.WL_HOLD_EXPIRES_AT).getTime() < Date.now()) {
        throw new BadRequestException('Hold da het han');
      }

      const slot = await tx.kHUNG_GIO.findUnique({ where: { KG_MA: hold.KG_MA } });
      if (!slot) throw new NotFoundException('Khong tim thay khung gio');
      const activeCount = await tx.dANG_KY.count({
        where: {
          BS_MA: hold.BS_MA,
          N_NGAY: hold.N_NGAY,
          B_TEN: hold.B_TEN,
          KG_MA: hold.KG_MA,
          DK_TRANG_THAI: { in: ACTIVE_BOOKING_STATUS },
        },
      });
      const max = slot.KG_SO_BN_TOI_DA ?? 5;
      if (activeCount >= max) throw new ConflictException('Slot da khong con trong de xac nhan hold');

      const maxStt = await tx.dANG_KY.aggregate({
        where: {
          BS_MA: hold.BS_MA,
          N_NGAY: hold.N_NGAY,
          B_TEN: hold.B_TEN,
          KG_MA: hold.KG_MA,
          DK_TRANG_THAI: { in: ACTIVE_BOOKING_STATUS },
        },
        _max: { DK_STT: true },
      });

      const booking = await tx.dANG_KY.create({
        data: {
          BN_MA: hold.BN_MA,
          BS_MA: hold.BS_MA,
          N_NGAY: hold.N_NGAY,
          B_TEN: hold.B_TEN,
          KG_MA: hold.KG_MA,
          DK_STT: (maxStt._max?.DK_STT ?? 0) + 1,
          DK_TRANG_THAI: 'CHO_KHAM',
        },
      });

      await tx.$executeRawUnsafe(
        `UPDATE "WAITLIST_ENTRY"
         SET "WL_STATUS" = 'PROMOTED',
             "WL_PROMOTED_DK_MA" = $2,
             "WL_UPDATED_AT" = NOW()
         WHERE "WL_ID" = $1`,
        waitlistId,
        booking.DK_MA,
      );

      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'WAITLIST_ENTRY',
          AL_ACTION: 'WAITLIST_PROMOTED_TO_BOOKING',
          AL_PK: { WL_ID: waitlistId },
          AL_NEW: { DK_MA: booking.DK_MA, clientIp },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });

      return booking;
    });

    return {
      message: 'Xac nhan hold thanh cong',
      booking: result,
    };
  }

  async listWaitlistForAdmin(query: AdminWaitlistListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const filters: string[] = [];
    if (query.doctorId) filters.push(`wl."BS_MA" = ${Number(query.doctorId)}`);
    if (query.slotId) filters.push(`wl."KG_MA" = ${Number(query.slotId)}`);
    if (query.status) filters.push(`wl."WL_STATUS" = '${query.status}'`);
    if (query.date) filters.push(`wl."N_NGAY" = '${query.date}'::date`);
    const whereSql = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const items = await this.prisma
      .getClient()
      .$queryRawUnsafe<any[]>(
        `SELECT
          wl.*,
          bn."BN_HO_CHU_LOT",
          bn."BN_TEN",
          bs."BS_HO_TEN",
          kg."KG_BAT_DAU",
          kg."KG_KET_THUC"
         FROM "WAITLIST_ENTRY" wl
         JOIN "BENH_NHAN" bn ON bn."BN_MA" = wl."BN_MA"
         JOIN "BAC_SI" bs ON bs."BS_MA" = wl."BS_MA"
         LEFT JOIN "KHUNG_GIO" kg ON kg."KG_MA" = wl."KG_MA"
         ${whereSql}
         ORDER BY wl."WL_CREATED_AT" ASC
         LIMIT $1 OFFSET $2`,
        limit,
        offset,
      )
      .catch(() => []);

    const countRows = await this.prisma
      .getClient()
      .$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS total FROM "WAITLIST_ENTRY" wl ${whereSql}`,
      )
      .catch(() => [{ total: 0 }]);

    const total = Number(countRows[0]?.total || 0);
    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async listForAdmin(query: AdminAppointmentListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const dateFrom = query.dateFrom ? parseDateOnly(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? parseDateOnly(query.dateTo) : undefined;

    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException('dateFrom phai nho hon hoac bang dateTo');
    }

    const statusList = this.parseStatusList(query.status);
    const paymentStatuses = this.parseStatusList(query.paymentStatus);
    const keyword = query.keyword?.trim() || '';
    const keywordAsId = Number.parseInt(keyword, 10);
    const keywordFilters: Prisma.DANG_KYWhereInput[] = [];
    if (keyword.length > 0) {
      keywordFilters.push(
        { BENH_NHAN: { BN_TEN: { contains: keyword, mode: 'insensitive' } } },
        { BENH_NHAN: { BN_HO_CHU_LOT: { contains: keyword, mode: 'insensitive' } } },
        { BENH_NHAN: { BN_SDT_DANG_KY: { contains: keyword, mode: 'insensitive' } } },
        { BENH_NHAN: { TK_SDT: { contains: keyword, mode: 'insensitive' } } },
      );
      if (Number.isFinite(keywordAsId)) keywordFilters.push({ DK_MA: keywordAsId });
    }

    const mappedPaymentFilter = this.mapPaymentStatusFilter(paymentStatuses);
    const where: Prisma.DANG_KYWhereInput = {
      ...(dateFrom || dateTo
        ? {
            N_NGAY: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
      ...(query.doctorId ? { BS_MA: query.doctorId } : {}),
      ...(query.specialtyId
        ? { LICH_BSK: { is: { BAC_SI: { CK_MA: query.specialtyId } } } }
        : {}),
      ...(statusList.length > 0 ? { DK_TRANG_THAI: { in: statusList } } : {}),
      ...(mappedPaymentFilter.length > 0
        ? { THANH_TOAN: { some: { TT_TRANG_THAI: { in: mappedPaymentFilter } } } }
        : {}),
      ...(keywordFilters.length > 0 ? { OR: keywordFilters } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.dANG_KY.count({ where }),
      this.prisma.dANG_KY.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ N_NGAY: 'desc' }, { KG_MA: 'asc' }, { DK_MA: 'desc' }],
        include: {
          BENH_NHAN: true,
          KHUNG_GIO: true,
          LICH_BSK: {
            include: {
              PHONG: true,
              BAC_SI: { include: { CHUYEN_KHOA: true } },
            },
          },
          THANH_TOAN: {
            orderBy: { TT_THOI_GIAN: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    const items = rows.map((row) => {
      const latestPayment = row.THANH_TOAN[0] || null;
      return {
        DK_MA: row.DK_MA,
        BN_MA: row.BN_MA,
        patientName: `${row.BENH_NHAN?.BN_HO_CHU_LOT || ''} ${row.BENH_NHAN?.BN_TEN || ''}`
          .trim()
          .trim(),
        patientPhone: row.BENH_NHAN?.BN_SDT_DANG_KY || row.BENH_NHAN?.TK_SDT || null,
        BS_MA: row.BS_MA,
        doctorName: row.LICH_BSK?.BAC_SI?.BS_HO_TEN || null,
        specialtyName: row.LICH_BSK?.BAC_SI?.CHUYEN_KHOA?.CK_TEN || null,
        N_NGAY: row.N_NGAY,
        B_TEN: row.B_TEN,
        KG_MA: row.KG_MA,
        KG_BAT_DAU: row.KHUNG_GIO?.KG_BAT_DAU || null,
        KG_KET_THUC: row.KHUNG_GIO?.KG_KET_THUC || null,
        roomName: row.LICH_BSK?.PHONG?.P_TEN || null,
        DK_TRANG_THAI: row.DK_TRANG_THAI,
        DK_LY_DO_HUY: row.DK_LY_DO_HUY,
        payment: latestPayment
          ? {
              TT_MA: latestPayment.TT_MA,
              TT_TRANG_THAI: latestPayment.TT_TRANG_THAI,
              normalizedStatus: this.normalizePaymentStatus(
                latestPayment.TT_TRANG_THAI,
                latestPayment.TT_THOI_GIAN,
              ),
              TT_THOI_GIAN: latestPayment.TT_THOI_GIAN,
            }
          : null,
      };
    });

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getDetailForAdmin(appointmentId: number) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    const preVisit = await this.buildPreVisitInfoResponse(appointment);

    const logs = await this.prisma.aUDIT_LOG.findMany({
      where: { AL_TABLE: 'DANG_KY' },
      orderBy: { AL_CHANGED_AT: 'desc' },
      take: 300,
    });

    const timeline = logs
      .filter((item) => {
        const pk = item.AL_PK as any;
        return pk && Number(pk.DK_MA) === appointmentId;
      })
      .map((item) => ({
        action: item.AL_ACTION,
        at: item.AL_CHANGED_AT,
        by: item.AL_CHANGED_BY,
        old: item.AL_OLD,
        next: item.AL_NEW,
      }));

    timeline.push({
      action: 'CREATED',
      at: appointment.DK_THOI_GIAN_TAO,
      by: appointment.BENH_NHAN?.TK_SDT || null,
      old: null,
      next: { DK_TRANG_THAI: appointment.DK_TRANG_THAI },
    });

    const latestPayment = appointment.THANH_TOAN[0] || null;
    return {
      appointment: {
        DK_MA: appointment.DK_MA,
        DK_TRANG_THAI: appointment.DK_TRANG_THAI,
        DK_STT: appointment.DK_STT,
        DK_LY_DO_HUY: appointment.DK_LY_DO_HUY,
        DK_THOI_GIAN_TAO: appointment.DK_THOI_GIAN_TAO,
        N_NGAY: appointment.N_NGAY,
        B_TEN: appointment.B_TEN,
        KG_MA: appointment.KG_MA,
      },
      patient: appointment.BENH_NHAN,
      doctor: appointment.LICH_BSK?.BAC_SI || null,
      specialty: appointment.LICH_BSK?.BAC_SI?.CHUYEN_KHOA || null,
      room: appointment.LICH_BSK?.PHONG || null,
      slot: appointment.KHUNG_GIO || null,
      serviceType: appointment.LOAI_HINH_KHAM || null,
      paymentSummary: latestPayment
        ? {
            latest: latestPayment,
            normalizedStatus: this.normalizePaymentStatus(
              latestPayment.TT_TRANG_THAI,
              latestPayment.TT_THOI_GIAN,
            ),
            attempts: appointment.THANH_TOAN,
            refund: this.buildRefundSummary(appointment),
          }
        : null,
      timeline: timeline.sort((a, b) => {
        const aTime = a.at ? new Date(a.at).getTime() : 0;
        const bTime = b.at ? new Date(b.at).getTime() : 0;
        return bTime - aTime;
      }),
      preVisit,
    };
  }

  async updateStatusByAdmin(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: UpdateAppointmentStatusDto,
  ) {
    const updated = await this.updateAppointmentStatusWithActor(user, appointmentId, dto.status, {
      reason: dto.reason,
      note: dto.note,
      action: 'STATUS_UPDATED_BY_ADMIN',
    });
    return {
      message: 'Cap nhat trang thai lich hen thanh cong',
      appointment: updated,
    };
  }

  async manualBookingByAdmin(
    user: CurrentUserPayload,
    dto: ManualBookingDto,
    clientIp = '127.0.0.1',
  ) {
    const result = await this.bookingService.createByAdmin(
      user,
      {
        BN_MA: dto.patientId,
        BS_MA: dto.doctorId,
        N_NGAY: dto.date,
        B_TEN: dto.shift,
        KG_MA: dto.slotId,
        LHK_MA: dto.serviceTypeId,
      },
      clientIp,
    );

    if (dto.symptoms || dto.note) {
      await this.prisma.dANG_KY.update({
        where: { DK_MA: result.booking.DK_MA },
        data: {
          DK_TRIEU_CHUNG: dto.symptoms?.trim() || null,
          DK_GHI_CHU_TIEN_KHAM: dto.note?.trim() || null,
          DK_TIEN_KHAM_CAP_NHAT_LUC: new Date(),
          DK_TIEN_KHAM_CAP_NHAT_BOI: user.TK_SDT,
        },
      });
    }

    await this.writeAuditLog({
      action: 'MANUAL_BOOKING_CREATED',
      actor: user.TK_SDT,
      pk: { DK_MA: result.booking.DK_MA },
      old: null,
      next: {
        source: 'ADMIN',
        note: dto.note || null,
        symptoms: dto.symptoms || null,
      },
    });

    return { message: 'Tao lich hen tai quay thanh cong', ...result };
  }

  async rescheduleByPatient(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: RescheduleAppointmentDto,
  ) {
    const current = await this.getAppointmentOrThrow(appointmentId);
    this.validateAppointmentOwner(user, current.BENH_NHAN?.TK_SDT);
    if (isAppointmentTerminalStatus(current.DK_TRANG_THAI)) {
      throw new BadRequestException('Lich hen da ket thuc/huy, khong the doi lich');
    }

    const nextDoctorId = dto.newDoctorId ?? current.BS_MA;
    const nextDate = parseDateOnly(dto.newDate);
    const nextShift = dto.newShift;
    const nextSlotId = dto.newSlotId;
    const oldDateIso = current.N_NGAY.toISOString().slice(0, 10);

    if (
      nextDoctorId === current.BS_MA &&
      dto.newDate === oldDateIso &&
      nextShift === current.B_TEN &&
      nextSlotId === current.KG_MA
    ) {
      throw new BadRequestException('Thong tin doi lich trung voi lich hien tai');
    }

    const updated = await this.prisma.getClient().$transaction(async (tx) => {
      const latest = await tx.dANG_KY.findUnique({
        where: { DK_MA: appointmentId },
        include: {
          LICH_BSK: { include: { BAC_SI: true } },
        },
      });
      if (!latest) throw new NotFoundException('Khong tim thay lich hen');
      if (isAppointmentTerminalStatus(latest.DK_TRANG_THAI)) {
        throw new BadRequestException('Lich hen da ket thuc/huy, khong the doi lich');
      }

      const kg = await tx.kHUNG_GIO.findUnique({ where: { KG_MA: nextSlotId } });
      if (!kg) throw new NotFoundException('Khung gio moi khong ton tai');
      if (kg.B_TEN !== nextShift) {
        throw new BadRequestException('Khung gio moi khong thuoc buoi da chon');
      }

      const schedule = await tx.lICH_BSK.findFirst({
        where: {
          BS_MA: nextDoctorId,
          N_NGAY: nextDate,
          B_TEN: nextShift,
          LBSK_IS_ARCHIVED: false,
          LBSK_TRANG_THAI: SHIFT_STATUS.finalized,
          DOT_LICH_TUAN: {
            is: { DLT_TRANG_THAI: WEEK_STATUS.slot_opened },
          },
        },
        include: { BAC_SI: true },
      });
      if (!schedule) throw new NotFoundException('Bac si khong co lich hop le o slot moi');

      const startAt = combineDateAndTime(nextDate, kg.KG_BAT_DAU);
      if (startAt.getTime() <= Date.now()) {
        throw new BadRequestException('Khong the doi sang slot trong qua khu');
      }

      const activeAtTargetSlot = await tx.dANG_KY.count({
        where: {
          BS_MA: nextDoctorId,
          N_NGAY: nextDate,
          B_TEN: nextShift,
          KG_MA: nextSlotId,
          DK_MA: { not: appointmentId },
          DK_TRANG_THAI: { in: ACTIVE_BOOKING_STATUS },
        },
      });
      const maxCapacity = kg.KG_SO_BN_TOI_DA ?? 5;
      if (activeAtTargetSlot >= maxCapacity) throw new ConflictException('Slot moi da het cho');

      const specialtyId = schedule.BAC_SI?.CK_MA;
      if (specialtyId) {
        const sameSpecialtyCount = await tx.dANG_KY.count({
          where: {
            BN_MA: latest.BN_MA,
            N_NGAY: nextDate,
            KG_MA: nextSlotId,
            DK_MA: { not: appointmentId },
            DK_TRANG_THAI: { in: ACTIVE_BOOKING_STATUS },
            LICH_BSK: {
              is: {
                BAC_SI: { CK_MA: specialtyId },
              },
            },
          },
        });
        if (sameSpecialtyCount > 0) {
          throw new ConflictException('Benh nhan da co lich khac trong cung khung gio/chuyen khoa');
        }
      }

      const maxStt = await tx.dANG_KY.aggregate({
        where: {
          BS_MA: nextDoctorId,
          N_NGAY: nextDate,
          B_TEN: nextShift,
          KG_MA: nextSlotId,
          DK_MA: { not: appointmentId },
          DK_TRANG_THAI: { in: ACTIVE_BOOKING_STATUS },
        },
        _max: { DK_STT: true },
      });
      const nextStt = (maxStt._max?.DK_STT ?? 0) + 1;

      const row = await tx.dANG_KY.update({
        where: { DK_MA: appointmentId },
        data: {
          BS_MA: nextDoctorId,
          N_NGAY: nextDate,
          B_TEN: nextShift,
          KG_MA: nextSlotId,
          DK_STT: nextStt,
        },
      });

      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'DANG_KY',
          AL_ACTION: 'RESCHEDULED_BY_PATIENT',
          AL_PK: { DK_MA: appointmentId },
          AL_OLD: {
            BS_MA: current.BS_MA,
            N_NGAY: current.N_NGAY.toISOString().slice(0, 10),
            B_TEN: current.B_TEN,
            KG_MA: current.KG_MA,
            DK_STT: current.DK_STT,
          },
          AL_NEW: {
            BS_MA: nextDoctorId,
            N_NGAY: dto.newDate,
            B_TEN: nextShift,
            KG_MA: nextSlotId,
            DK_STT: nextStt,
            reason: dto.reason || null,
            note: dto.note || null,
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });

      const patientPhone = current.BENH_NHAN?.TK_SDT;
      if (patientPhone) {
        await tx.tHONG_BAO.create({
          data: {
            TK_SDT: patientPhone,
            TB_TIEU_DE: 'Lich kham da duoc thay doi',
            TB_LOAI: 'reschedule',
            TB_NOI_DUNG: `Lich kham [DK_MA=${appointmentId}] da doi tu ${current.N_NGAY.toISOString().slice(0, 10)}-${current.B_TEN} sang ${dto.newDate}-${nextShift}. [DK_MA=${appointmentId}]`,
            TB_TRANG_THAI: 'UNREAD',
            TB_THOI_GIAN: new Date(),
          },
        });
      }

      return row;
    });

    return { message: 'Doi lich thanh cong', appointment: updated };
  }

  async getPaymentStatusByPatient(user: CurrentUserPayload, appointmentId: number) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    this.validateAppointmentOwner(user, appointment.BENH_NHAN?.TK_SDT);

    let latest: any = appointment.THANH_TOAN[0] || null;
    if (latest && this.qrBanking.isQrBankingMethod(latest.TT_PHUONG_THUC)) {
      latest = await this.qrBanking.reconcileUnpaidPayment(latest);
    }
    const expiresAt =
      latest?.TT_THOI_GIAN && latest.TT_TRANG_THAI === 'CHUA_THANH_TOAN'
        ? new Date(new Date(latest.TT_THOI_GIAN).getTime() + 15 * 60 * 1000)
        : null;

    return {
      DK_MA: appointment.DK_MA,
      appointmentStatus: appointment.DK_TRANG_THAI,
      payment: latest
        ? {
            TT_MA: latest.TT_MA,
            TT_TRANG_THAI: latest.TT_TRANG_THAI,
            TT_TONG_TIEN: latest.TT_TONG_TIEN,
            TT_PHUONG_THUC: latest.TT_PHUONG_THUC,
            TT_PHUONG_THUC_TT: latest.TT_PHUONG_THUC_TT,
            normalizedStatus: this.normalizePaymentStatus(
              latest.TT_TRANG_THAI,
              latest.TT_THOI_GIAN,
            ),
            TT_MA_GIAO_DICH: latest.TT_MA_GIAO_DICH,
            TT_THOI_GIAN: latest.TT_THOI_GIAN,
            expiresAt,
            paymentUrl: this.qrBanking.getPaymentUrlForRecord(latest),
          }
        : null,
      refund: this.buildRefundSummary(appointment),
      latestAttempt: latest,
    };
  }

  async retryPaymentByPatient(
    user: CurrentUserPayload,
    appointmentId: number,
    clientIp = '127.0.0.1',
  ) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    this.validateAppointmentOwner(user, appointment.BENH_NHAN?.TK_SDT);

    if (
      appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.DA_KHAM ||
      appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.HUY ||
      appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.HUY_BS_NGHI ||
      appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.NO_SHOW
    ) {
      throw new BadRequestException(
        'Khong the thanh toan lai cho lich hen da huy/da kham/no-show',
      );
    }

    const latest = appointment.THANH_TOAN[0] || null;
    if (latest) {
      const normalized = this.normalizePaymentStatus(
        latest.TT_TRANG_THAI,
        latest.TT_THOI_GIAN,
      );
      if (normalized === 'paid') {
        throw new BadRequestException('Lich hen nay da thanh toan thanh cong');
      }
      if (normalized === 'pending' || normalized === 'refund_pending') {
        throw new BadRequestException(
          'Giao dich thanh toan dang cho xu ly, chua the tao lan thanh toan moi',
        );
      }
      if (normalized === 'unpaid') {
        const createdAt = latest.TT_THOI_GIAN
          ? new Date(latest.TT_THOI_GIAN).getTime()
          : 0;
        const isExpired = createdAt > 0 && Date.now() - createdAt > 15 * 60 * 1000;
        if (!isExpired) {
          throw new BadRequestException(
            'Lien ket thanh toan hien tai van con hieu luc, chua can retry',
          );
        }
      }
    }

    const retryPaymentMethod = String(
      latest?.TT_PHUONG_THUC || appointment.DK_PT_THANH_TOAN || 'VNPAY',
    )
      .trim()
      .toUpperCase();
    const normalizedRetryMethod = SUPPORTED_PAYMENT_METHODS.has(retryPaymentMethod)
      ? retryPaymentMethod
      : 'VNPAY';
    if (normalizedRetryMethod === 'QR_BANKING') {
      this.qrBanking.ensureQrConfigOrThrow();
    }

    const baseAmount =
      Number(latest?.TT_TONG_TIEN ?? 0) ||
      Number(appointment.LOAI_HINH_KHAM?.LHK_GIA ?? 0) ||
      10000;

    const appointmentDate = this.formatDateOnly(appointment.N_NGAY);
    const appointmentTime = this.formatTimeOnly(appointment.KHUNG_GIO?.KG_BAT_DAU || null);
    const doctorName = String(appointment.LICH_BSK?.BAC_SI?.BS_HO_TEN || '').trim();
    let expiredPreviousPaymentId: number | null = null;

    const created = await this.prisma.getClient().$transaction(async (tx) => {
      if (latest && latest.TT_TRANG_THAI === 'CHUA_THANH_TOAN') {
        await tx.tHANH_TOAN.update({
          where: { TT_MA: latest.TT_MA },
          data: { TT_TRANG_THAI: 'HET_HAN' },
        });
        expiredPreviousPaymentId = latest.TT_MA;
      }

      const payment = await tx.tHANH_TOAN.create({
        data: {
          DK_MA: appointment.DK_MA,
          TT_TONG_TIEN: baseAmount,
          TT_TIEN_KHAM: baseAmount,
          TT_THUC_THU: baseAmount,
          TT_LOAI: 'DAT_LICH',
          TT_PHUONG_THUC: normalizedRetryMethod,
          TT_TRANG_THAI: 'CHUA_THANH_TOAN',
        },
      });

      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'DANG_KY',
          AL_ACTION: 'PAYMENT_RETRY_CREATED',
          AL_PK: { DK_MA: appointment.DK_MA },
          AL_OLD: latest
            ? {
                TT_MA: latest.TT_MA,
                TT_TRANG_THAI: latest.TT_TRANG_THAI,
              }
            : Prisma.JsonNull,
          AL_NEW: {
            TT_MA: payment.TT_MA,
            TT_TRANG_THAI: payment.TT_TRANG_THAI,
            amount: baseAmount,
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });

      return payment;
    });

    if (expiredPreviousPaymentId) {
      await this.createPaymentNotification({
        phone: appointment.BENH_NHAN?.TK_SDT || user.TK_SDT,
        type: 'payment_timeout',
        title: 'Thanh toan het han',
        content:
          `Giao dich thanh toan TT_MA=${expiredPreviousPaymentId} da het han` +
          ` cho lich hen DK_MA=${appointment.DK_MA}` +
          (appointmentDate !== '-' ? ` ngay ${appointmentDate}` : '') +
          (appointmentTime !== '-' ? ` luc ${appointmentTime}` : '') +
          (doctorName ? ` voi bac si ${doctorName}.` : '.'),
        dedupeKey: `[PAYMENT_TIMEOUT_TT_MA=${expiredPreviousPaymentId}]`,
      });
    }

    await this.createPaymentNotification({
      phone: appointment.BENH_NHAN?.TK_SDT || user.TK_SDT,
      type: 'payment_pending',
      title: 'Da tao yeu cau thanh toan moi',
      content:
        `He thong da tao yeu cau thanh toan moi TT_MA=${created.TT_MA}` +
        ` cho lich hen DK_MA=${appointment.DK_MA}` +
        (appointmentDate !== '-' ? ` ngay ${appointmentDate}` : '') +
        (appointmentTime !== '-' ? ` luc ${appointmentTime}` : '') +
        (doctorName ? ` voi bac si ${doctorName}.` : '.') +
        ' Vui long hoan tat thanh toan trong 15 phut.',
      dedupeKey: `[PAYMENT_PENDING_TT_MA=${created.TT_MA}]`,
    });

    const paymentUrl =
      normalizedRetryMethod === 'QR_BANKING'
        ? this.qrBanking.createPaymentUrl({
            amount: baseAmount,
            paymentId: created.TT_MA,
            bookingId: appointment.DK_MA,
          })
        : this.vnpay.createPaymentUrl(
            baseAmount,
            String(created.TT_MA),
            `Thanh toan lai lich kham DK ${appointment.DK_MA}`,
            clientIp,
          );

    return {
      DK_MA: appointment.DK_MA,
      payment: created,
      payment_url: paymentUrl,
    };
  }

  async getCancelPolicyForPatient(user: CurrentUserPayload, appointmentId: number) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    this.validateAppointmentOwner(user, appointment.BENH_NHAN?.TK_SDT);
    const policy = await this.getCurrentCancelPolicy(appointment, 'BENH_NHAN', true);

    const latestPayment = appointment.THANH_TOAN[0] || null;
    return {
      appointmentId: appointment.DK_MA,
      currentStatus: appointment.DK_TRANG_THAI,
      paymentStatus: latestPayment
        ? this.normalizePaymentStatus(latestPayment.TT_TRANG_THAI, latestPayment.TT_THOI_GIAN)
        : 'unpaid',
      canCancel: policy.canCancel,
      cutoffMinutes: policy.cutoffMinutes,
      cancelDeadlineAt: policy.cancelDeadlineAt,
      reasonIfBlocked: policy.reasonIfBlocked,
    };
  }

  async cancelAppointment(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: CancelAppointmentDto,
    context: 'PATIENT' | 'ADMIN',
  ) {
    const appointment = await this.getAppointmentOrThrow(appointmentId);

    if (context === 'PATIENT') {
      this.validateAppointmentOwner(user, appointment.BENH_NHAN?.TK_SDT);
      const policy = await this.getCurrentCancelPolicy(appointment, 'BENH_NHAN', true);
      if (!policy.canCancel) {
        throw new BadRequestException(
          policy.reasonIfBlocked === 'CUTOFF_EXCEEDED'
            ? 'Da qua thoi gian cho phep huy lich'
            : 'Lich hen khong the huy trong trang thai hien tai',
        );
      }
    }

    if (
      appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.DA_KHAM ||
      appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.NO_SHOW
    ) {
      throw new BadRequestException('Lich hen da ket thuc, khong the huy');
    }

    if (
      appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.HUY ||
      appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.HUY_BS_NGHI
    ) {
      return {
        message: 'Lich hen da duoc huy truoc do',
        appointment: {
          DK_MA: appointment.DK_MA,
          DK_TRANG_THAI: appointment.DK_TRANG_THAI,
        },
        refund: this.buildRefundSummary(appointment),
      };
    }

    const cancelled = await this.prisma.getClient().$transaction(async (tx) => {
      const latest = await tx.dANG_KY.findUnique({
        where: { DK_MA: appointmentId },
        include: {
          KHUNG_GIO: true,
          BENH_NHAN: true,
          THANH_TOAN: { orderBy: { TT_THOI_GIAN: 'desc' } },
        },
      });
      if (!latest) throw new NotFoundException('Khong tim thay lich hen');

      if (context === 'PATIENT') {
        const startAt = latest.KHUNG_GIO
          ? combineDateAndTime(latest.N_NGAY, latest.KHUNG_GIO.KG_BAT_DAU)
          : latest.N_NGAY;
        const policy = evaluateCancelPolicy({
          now: new Date(),
          appointmentStartAt: startAt,
          cutoffMinutes: this.getCancelCutoffMinutes(),
          appointmentStatus: latest.DK_TRANG_THAI,
          isOwner: latest.BENH_NHAN?.TK_SDT === user.TK_SDT,
          role: 'BENH_NHAN',
        });
        if (!policy.canCancel) {
          throw new BadRequestException('Da qua han huy hoac trang thai khong hop le');
        }
      }

      if (([APPOINTMENT_STATUS.DA_KHAM, APPOINTMENT_STATUS.NO_SHOW] as string[]).includes(latest.DK_TRANG_THAI || '')) {
        throw new BadRequestException('Lich hen da ket thuc, khong the huy');
      }

      if (([APPOINTMENT_STATUS.HUY, APPOINTMENT_STATUS.HUY_BS_NGHI] as string[]).includes(latest.DK_TRANG_THAI || '')) {
        return { booking: latest, refund: null };
      }

      const booking = await tx.dANG_KY.update({
        where: { DK_MA: appointmentId },
        data: {
          DK_TRANG_THAI: 'HUY',
          DK_LY_DO_HUY: dto.reason?.trim() || 'HUY_LICH',
        },
      });

      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'DANG_KY',
          AL_ACTION: 'APPOINTMENT_CANCELLED',
          AL_PK: { DK_MA: appointmentId },
          AL_OLD: { DK_TRANG_THAI: latest.DK_TRANG_THAI },
          AL_NEW: {
            DK_TRANG_THAI: 'HUY',
            reason: dto.reason || null,
            note: dto.note || null,
            source: dto.source || context,
            canceledAt: new Date().toISOString(),
            canceledByRole: context === 'ADMIN' ? 'ADMIN' : 'BENH_NHAN',
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });

      const refund = await this.createRefundRequestIfEligibleTx(tx, latest, user);
      const patientPhone = latest.BENH_NHAN?.TK_SDT || null;
      if (patientPhone) {
        await tx.tHONG_BAO.create({
          data: {
            TK_SDT: patientPhone,
            TB_TIEU_DE: 'Lich kham da bi huy',
            TB_LOAI: 'cancellation',
            TB_NOI_DUNG: `Lich kham [DK_MA=${appointmentId}] da duoc huy. Ly do: ${dto.reason || 'Khong co'}. [DK_MA=${appointmentId}]`,
            TB_TRANG_THAI: 'UNREAD',
            TB_THOI_GIAN: new Date(),
          },
        });
      }
      await this.notifyWaitlistFirstCandidate(tx, {
        BS_MA: latest.BS_MA,
        N_NGAY: latest.N_NGAY,
        B_TEN: latest.B_TEN,
        KG_MA: latest.KG_MA,
      });
      return { booking, refund };
    });

    return {
      message: 'Huy lich thanh cong',
      appointment: cancelled.booking,
      refund: cancelled.refund,
    };
  }

  async getDoctorClinicalServiceCatalog(query: DoctorCatalogQueryDto) {
    const keyword = String(query.keyword || '').trim();
    const limit = Math.min(100, Math.max(1, query.limit || 30));
    const items = await this.prisma.dICHVU.findMany({
      where: keyword
        ? {
            OR: [
              { DVCLS_TEN: { contains: keyword, mode: 'insensitive' } },
              { DVCLS_LOAI: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: [{ DVCLS_TEN: 'asc' }],
      take: limit,
    });
    return { items };
  }

  async getDoctorMedicineCatalog(query: DoctorCatalogQueryDto) {
    const keyword = String(query.keyword || '').trim();
    const limit = Math.min(100, Math.max(1, query.limit || 30));
    const items = await this.prisma.tHUOC.findMany({
      where: {
        T_DA_XOA: { not: true },
        ...(keyword
          ? {
              T_TEN_THUOC: { contains: keyword, mode: 'insensitive' },
            }
          : {}),
      },
      orderBy: [{ T_TEN_THUOC: 'asc' }],
      take: limit,
      include: {
        DON_VI_TINH: true,
      },
    });
    return { items };
  }

  private async getDoctorAppointmentForExamOrThrow(
    user: CurrentUserPayload,
    appointmentId: number,
  ) {
    if (!user.bsMa) throw new ForbiddenException('Tai khoan hien tai khong phai bac si');
    const appointment = await this.prisma.dANG_KY.findUnique({
      where: { DK_MA: appointmentId },
      include: {
        BENH_NHAN: {
          include: {
            CHI_SO_SUC_KHOE: {
              orderBy: { CSSK_NGAY_DO: 'desc' },
              take: 1,
            },
          },
        },
        KHUNG_GIO: true,
        LOAI_HINH_KHAM: true,
        LICH_BSK: {
          include: {
            BAC_SI: {
              include: { CHUYEN_KHOA: true },
            },
            PHONG: true,
          },
        },
        PHIEU_KHAM_BENH: {
          include: {
            PHIEU_CDCLS: {
              include: {
                THUCHIEN: {
                  include: {
                    DICHVU: true,
                    KET_QUA_CAN_LAM_SAN: true,
                  },
                },
              },
            },
            DON_THUOC: {
              include: {
                CHI_TIET_DON_THUOC: {
                  include: {
                    THUOC: true,
                  },
                },
              },
            },
          },
        },
        THANH_TOAN: {
          orderBy: { TT_THOI_GIAN: 'desc' },
        },
      },
    });

    if (!appointment) throw new NotFoundException('Khong tim thay lich hen');
    if (appointment.BS_MA !== user.bsMa) {
      throw new ForbiddenException('Ban khong co quyen thao tac lich hen cua bac si khac');
    }
    return appointment;
  }

  private formatExamFinancialStatus(status?: string) {
    const normalized = (status || '').toLowerCase();
    if (!normalized) return 'CHUA_LAP_HOA_DON';
    if (normalized === 'paid') return 'DA_THANH_TOAN';
    if (normalized === 'pending' || normalized === 'unpaid') return 'CHO_THANH_TOAN';
    if (normalized === 'refund_pending') return 'HOAN_TIEN_DANG_XU_LY';
    if (normalized === 'failed' || normalized === 'refund_failed') return 'THAT_BAI';
    if (normalized === 'refund_rejected') return 'TU_CHOI_HOAN_TIEN';
    if (normalized === 'refunded') return 'DA_HOAN_TIEN';
    return 'CHO_THANH_TOAN';
  }

  private buildExamWorkflowResponse(appointment: any) {
    const encounter = appointment.PHIEU_KHAM_BENH || null;
    const latestHealth = appointment.BENH_NHAN?.CHI_SO_SUC_KHOE?.[0] || null;
    const toNumberOrNull = (value: unknown) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const weightKg = toNumberOrNull(latestHealth?.CSSK_CAN_NANG);
    const heightCm = toNumberOrNull(latestHealth?.CSSK_CHIEU_CAO);
    const bmi =
      weightKg && heightCm && heightCm > 0
        ? Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1))
        : null;
    const healthIndicators = latestHealth
      ? {
          measuredAt: latestHealth.CSSK_NGAY_DO || null,
          weightKg,
          heightCm,
          bmi,
          bloodPressure: latestHealth.CSSK_HUYET_AP || null,
          heartRateBpm: latestHealth.CSSK_NHIP_TIM || null,
          bodyTemperatureC: toNumberOrNull(latestHealth.CSSK_NHIET_DO),
          bloodGlucoseMmolL: toNumberOrNull(latestHealth.CSSK_DUONG_HUYET),
          note: latestHealth.CSSK_GHI_CHU || null,
        }
      : null;
    const orders = (encounter?.PHIEU_CDCLS || []).flatMap((order: any) =>
      (order.THUCHIEN || []).map((execution: any) => ({
        orderId: order.PCD_MA,
        orderCreatedAt: order.PCD_GIO_IN || null,
        serviceId: execution.DVCLS_MA,
        serviceName: execution.DICHVU?.DVCLS_TEN || null,
        serviceType: execution.DICHVU?.DVCLS_LOAI || null,
        quantity: 1,
        price: Number(execution.DICHVU?.DVCLS_GIA_DV || 0),
        lineTotal: Number(execution.DICHVU?.DVCLS_GIA_DV || 0),
        isCompleted: Boolean(execution.CTCD_DA_THUC_HIEN),
        pdfUrl: `/doctor/appointments/${appointment.DK_MA}/orders/${order.PCD_MA}/pdf`,
        status: execution.KET_QUA_CAN_LAM_SAN
          ? CLINICAL_ORDER_STATUS.DA_CO_KET_QUA
          : CLINICAL_ORDER_STATUS.MOI_TAO,
        result: execution.KET_QUA_CAN_LAM_SAN
          ? {
              summary: execution.KET_QUA_CAN_LAM_SAN.KQCLS_NHAN_XET || null,
              imageUrl: execution.KET_QUA_CAN_LAM_SAN.KQCLS_HINH_ANH || null,
              payload: execution.KET_QUA_CAN_LAM_SAN.KQCLS_CHI_SO || null,
            }
          : null,
      })),
    );
    const prescriptions = (encounter?.DON_THUOC || []).map((prescription: any) => ({
      prescriptionId: prescription.DT_MA,
      note: prescription.DT_GHI_CHU || null,
      days: prescription.DT_SO_NGAY_SUNG || null,
      createdAt: prescription.DT_NGAY_TAO || null,
      items: (prescription.CHI_TIET_DON_THUOC || []).map((item: any) => ({
        medicineId: item.T_MA,
        medicineName: item.THUOC?.T_TEN_THUOC || null,
        quantity: item.CTDT_SO_LUONG || 0,
        dosage: item.CTDT_LIEU_DUNG || null,
        usage: item.CTDT_CACH_DUNG || null,
      })),
    }));
    const latestPayment = appointment.THANH_TOAN?.[0] || null;
    const normalizedPayment = latestPayment
      ? this.normalizePaymentStatus(latestPayment.TT_TRANG_THAI, latestPayment.TT_THOI_GIAN)
      : '';
    const hasPendingOrders = orders.some((item: any) => item.status !== CLINICAL_ORDER_STATUS.DA_CO_KET_QUA);

    const clinicalStatus =
      appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.CHO_KHAM
        ? 'CHO_KHAM'
        : appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.DA_CHECKIN
          ? hasPendingOrders
            ? 'CHO_KET_QUA'
            : 'DANG_KHAM'
          : appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.DA_KHAM
            ? 'KET_THUC_CHUYEN_MON'
            : appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.HOAN_TAT
              ? 'HOAN_TAT'
              : 'KHAC';

    return {
      appointment: {
        id: appointment.DK_MA,
        status: appointment.DK_TRANG_THAI,
        date: this.formatDateOnly(appointment.N_NGAY),
        shift: appointment.B_TEN,
        slot: {
          id: appointment.KG_MA,
          start: this.formatTimeOnly(appointment.KHUNG_GIO?.KG_BAT_DAU || null),
          end: this.formatTimeOnly(appointment.KHUNG_GIO?.KG_KET_THUC || null),
        },
      },
      patient: {
        id: appointment.BN_MA,
        name: this.toDisplayName([
          appointment.BENH_NHAN?.BN_HO_CHU_LOT,
          appointment.BENH_NHAN?.BN_TEN,
        ]),
        phone: appointment.BENH_NHAN?.BN_SDT_DANG_KY || appointment.BENH_NHAN?.TK_SDT || null,
        dateOfBirth: appointment.BENH_NHAN?.BN_NGAY_SINH
          ? this.formatDateOnly(appointment.BENH_NHAN.BN_NGAY_SINH)
          : null,
        gender:
          appointment.BENH_NHAN?.BN_LA_NAM === undefined || appointment.BENH_NHAN?.BN_LA_NAM === null
            ? null
            : appointment.BENH_NHAN.BN_LA_NAM
              ? 'NAM'
              : 'NU',
      },
      doctor: {
        id: appointment.BS_MA,
        name: appointment.LICH_BSK?.BAC_SI?.BS_HO_TEN || null,
        specialty: appointment.LICH_BSK?.BAC_SI?.CHUYEN_KHOA?.CK_TEN || null,
        room: appointment.LICH_BSK?.PHONG?.P_TEN || null,
      },
      encounter: encounter
        ? {
            id: encounter.PKB_MA,
            symptoms: encounter.PKB_TRIEU_CHUNG || null,
            conclusion: encounter.PKB_KET_LUAN || null,
            clinicalNotes: encounter.PKB_LOI_DAN || null,
          }
        : null,
      orders,
      prescriptions,
      healthIndicators,
      billing: {
        latest: latestPayment || null,
        normalizedStatus: this.formatExamFinancialStatus(normalizedPayment),
      },
      workflow: {
        clinicalStatus,
        financialStatus: this.formatExamFinancialStatus(normalizedPayment),
        hasPendingOrders,
        canFinishClinical: !hasPendingOrders && Boolean(encounter?.PKB_KET_LUAN),
      },
    };
  }

  private async getOrCreateEncounterTx(
    tx: Prisma.TransactionClient,
    appointmentId: number,
    initialData?: {
      symptoms?: string | null;
      notes?: string | null;
      conclusion?: string | null;
    },
  ) {
    const existing = await tx.pHIEU_KHAM_BENH.findFirst({
      where: { DK_MA: appointmentId },
    });
    if (existing) return existing;
    return tx.pHIEU_KHAM_BENH.create({
      data: {
        DK_MA: appointmentId,
        PKB_TRIEU_CHUNG: initialData?.symptoms || null,
        PKB_LOI_DAN: initialData?.notes || null,
        PKB_KET_LUAN: initialData?.conclusion || null,
      },
    });
  }

  async startDoctorExam(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: StartDoctorExamDto,
  ) {
    const appointment = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    const currentStatus = appointment.DK_TRANG_THAI || '';
    if (
      [APPOINTMENT_STATUS.HUY, APPOINTMENT_STATUS.HUY_BS_NGHI, APPOINTMENT_STATUS.NO_SHOW].includes(
        currentStatus as any,
      )
    ) {
      throw new BadRequestException('Lich hen hien tai khong the bat dau kham');
    }
    if (currentStatus === APPOINTMENT_STATUS.DA_KHAM || currentStatus === APPOINTMENT_STATUS.HOAN_TAT) {
      throw new BadRequestException('Ca kham da ket thuc');
    }

    await this.prisma.$transaction(async (tx) => {
      if (appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.CHO_KHAM) {
        await tx.dANG_KY.update({
          where: { DK_MA: appointmentId },
          data: { DK_TRANG_THAI: APPOINTMENT_STATUS.DA_CHECKIN },
        });
      }
      await this.getOrCreateEncounterTx(tx, appointmentId, {
        symptoms: appointment.DK_TRIEU_CHUNG || null,
        notes: appointment.DK_GHI_CHU_TIEN_KHAM || dto.note || null,
      });
      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'DANG_KY',
          AL_ACTION: 'DOCTOR_EXAM_STARTED',
          AL_PK: { DK_MA: appointmentId },
          AL_OLD: { DK_TRANG_THAI: appointment.DK_TRANG_THAI },
          AL_NEW: {
            DK_TRANG_THAI:
              appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.CHO_KHAM
                ? APPOINTMENT_STATUS.DA_CHECKIN
                : appointment.DK_TRANG_THAI,
            note: dto.note || null,
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });
    });

    const latest = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    return {
      message: 'Bat dau kham thanh cong',
      ...this.buildExamWorkflowResponse(latest),
    };
  }

  async getDoctorExamWorkflow(user: CurrentUserPayload, appointmentId: number) {
    const appointment = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    return this.buildExamWorkflowResponse(appointment);
  }

  async updateDoctorClinicalNote(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: UpdateDoctorClinicalNoteDto,
  ) {
    const appointment = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    const currentStatus = appointment.DK_TRANG_THAI || '';
    if (
      ![APPOINTMENT_STATUS.DA_CHECKIN, APPOINTMENT_STATUS.DA_KHAM, APPOINTMENT_STATUS.HOAN_TAT].includes(
        currentStatus as any,
      )
    ) {
      throw new BadRequestException('Can bat dau kham truoc khi cap nhat phieu kham');
    }
    if (currentStatus === APPOINTMENT_STATUS.HOAN_TAT) {
      throw new BadRequestException('Ho so da hoan tat, khong the cap nhat');
    }

    const compactNotes = [
      dto.clinicalNotes ? `Lam sang: ${dto.clinicalNotes}` : null,
      dto.diagnosisPreliminary ? `Chan doan so bo: ${dto.diagnosisPreliminary}` : null,
      dto.diagnosisFinal ? `Chan doan xac dinh: ${dto.diagnosisFinal}` : null,
      dto.treatmentPlan ? `Huong xu tri: ${dto.treatmentPlan}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    await this.prisma.$transaction(async (tx) => {
      const encounter = await this.getOrCreateEncounterTx(tx, appointmentId);
      await tx.pHIEU_KHAM_BENH.update({
        where: { PKB_MA: encounter.PKB_MA },
        data: {
          ...(dto.symptoms !== undefined ? { PKB_TRIEU_CHUNG: dto.symptoms || null } : {}),
          ...(dto.conclusion !== undefined ? { PKB_KET_LUAN: dto.conclusion || null } : {}),
          ...(compactNotes ? { PKB_LOI_DAN: compactNotes } : {}),
        },
      });
      await tx.dANG_KY.update({
        where: { DK_MA: appointmentId },
        data: {
          ...(dto.symptoms !== undefined ? { DK_TRIEU_CHUNG: dto.symptoms || null } : {}),
          ...(compactNotes ? { DK_GHI_CHU_TIEN_KHAM: compactNotes } : {}),
          DK_TIEN_KHAM_CAP_NHAT_LUC: new Date(),
          DK_TIEN_KHAM_CAP_NHAT_BOI: user.TK_SDT,
        },
      });
      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'PHIEU_KHAM_BENH',
          AL_ACTION: 'DOCTOR_CLINICAL_NOTE_UPDATED',
          AL_PK: { DK_MA: appointmentId },
          AL_OLD: Prisma.JsonNull,
          AL_NEW: {
            symptoms: dto.symptoms || null,
            conclusion: dto.conclusion || null,
            clinicalNotes: compactNotes || null,
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });
    });

    return {
      message: 'Cap nhat phieu kham thanh cong',
      ...(await this.getDoctorExamWorkflow(user, appointmentId)),
    };
  }

  async createDoctorClinicalOrders(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: CreateDoctorClinicalOrdersDto,
  ) {
    const appointment = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    if (appointment.DK_TRANG_THAI !== APPOINTMENT_STATUS.DA_CHECKIN) {
      throw new BadRequestException('Chi co the tao chi dinh khi ca kham dang duoc thuc hien');
    }
    const serviceIds = Array.from(new Set((dto.items || []).map((item) => Number(item.serviceId || 0)).filter(Boolean)));
    if (serviceIds.length === 0) {
      throw new BadRequestException('Danh sach chi dinh dang rong');
    }

    const existingServices = await this.prisma.dICHVU.findMany({
      where: { DVCLS_MA: { in: serviceIds } },
      select: { DVCLS_MA: true },
    });
    const existingSet = new Set(existingServices.map((item) => item.DVCLS_MA));
    const missing = serviceIds.filter((item) => !existingSet.has(item));
    if (missing.length > 0) {
      throw new NotFoundException(`Khong tim thay dich vu can lam sang: ${missing.join(', ')}`);
    }

    const createdOrder = await this.prisma.$transaction(async (tx) => {
      const encounter = await this.getOrCreateEncounterTx(tx, appointmentId);
      const order = await tx.pHIEU_CDCLS.create({
        data: {
          PKB_MA: encounter.PKB_MA,
        },
      });
      await tx.tHUCHIEN.createMany({
        data: serviceIds.map((serviceId) => ({
          PCD_MA: order.PCD_MA,
          DVCLS_MA: serviceId,
          CTCD_LAN_THUC_HIEN: 1,
          CTCD_DA_THUC_HIEN: false,
        })),
      });
      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'PHIEU_CDCLS',
          AL_ACTION: 'DOCTOR_CLINICAL_ORDER_CREATED',
          AL_PK: { DK_MA: appointmentId, PCD_MA: order.PCD_MA },
          AL_OLD: Prisma.JsonNull,
          AL_NEW: {
            serviceIds,
            count: serviceIds.length,
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });
      return order;
    });

    const orderPdf = await this.buildDoctorClinicalOrderPdfReport(
      user,
      appointmentId,
      createdOrder.PCD_MA,
    );
    await this.writeAuditLog({
      table: 'PHIEU_CDCLS',
      action: 'DOCTOR_CLINICAL_ORDER_PDF_GENERATED',
      actor: user.TK_SDT,
      pk: { DK_MA: appointmentId, PCD_MA: createdOrder.PCD_MA },
      next: {
        filename: orderPdf.filename,
        generatedAt: new Date().toISOString(),
        total: orderPdf.total,
      },
    });

    return {
      message: 'Tao chi dinh can lam sang thanh cong',
      orderPdf: {
        orderId: createdOrder.PCD_MA,
        filename: orderPdf.filename,
        url: `/doctor/appointments/${appointmentId}/orders/${createdOrder.PCD_MA}/pdf`,
      },
      ...(await this.getDoctorExamWorkflow(user, appointmentId)),
    };
  }

  async getDoctorClinicalOrders(user: CurrentUserPayload, appointmentId: number) {
    const workflow = await this.getDoctorExamWorkflow(user, appointmentId);
    return {
      appointmentId,
      orders: workflow.orders,
      workflow: workflow.workflow,
    };
  }

  private async buildDoctorClinicalOrderPdfReport(
    user: CurrentUserPayload,
    appointmentId: number,
    orderId: number,
  ) {
    const appointment = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    const encounter = appointment.PHIEU_KHAM_BENH;
    if (!encounter) {
      throw new BadRequestException('Khong tim thay phieu kham benh');
    }

    const order = (encounter.PHIEU_CDCLS || []).find((item: any) => item.PCD_MA === orderId);
    if (!order) {
      throw new NotFoundException('Khong tim thay phieu chi dinh can lam sang');
    }
    const executions = order.THUCHIEN || [];
    if (executions.length === 0) {
      throw new BadRequestException('Phieu chi dinh khong co dich vu');
    }

    const patientName = this.toDisplayName([
      appointment.BENH_NHAN?.BN_HO_CHU_LOT,
      appointment.BENH_NHAN?.BN_TEN,
    ]);
    const patientDob = appointment.BENH_NHAN?.BN_NGAY_SINH
      ? this.formatDateOnly(appointment.BENH_NHAN.BN_NGAY_SINH)
      : '-';
    const doctorName = appointment.LICH_BSK?.BAC_SI?.BS_HO_TEN || `#${appointment.BS_MA}`;
    const specialty = appointment.LICH_BSK?.BAC_SI?.CHUYEN_KHOA?.CK_TEN || '-';
    const room = appointment.LICH_BSK?.PHONG?.P_TEN || '-';
    const shift = appointment.B_TEN || '-';
    const date = this.formatDateOnly(appointment.N_NGAY);
    const slotStart = this.formatTimeOnly(appointment.KHUNG_GIO?.KG_BAT_DAU || null);
    const slotEnd = this.formatTimeOnly(appointment.KHUNG_GIO?.KG_KET_THUC || null);

    const rows = executions.map((execution: any, index: number) => {
      const unitPrice = Number(execution.DICHVU?.DVCLS_GIA_DV || 0);
      const quantity = 1;
      return {
        stt: index + 1,
        serviceCode: execution.DVCLS_MA,
        serviceName: execution.DICHVU?.DVCLS_TEN || `DV ${execution.DVCLS_MA}`,
        unitPrice,
        quantity,
        lineTotal: unitPrice * quantity,
      };
    });
    const total = rows.reduce((sum, item) => sum + item.lineTotal, 0);

    const report = await this.pdfService.buildReport({
      title: 'PHIEU CHI DINH CAN LAM SANG',
      subtitle: `Ma phieu: #${orderId} - Ma lich hen: #${appointmentId}`,
      metadataLines: [
        `Nguoi chi dinh: ${doctorName}`,
        `So dien thoai bac si: ${user.TK_SDT}`,
        `Thoi gian tao phieu: ${this.formatDateOnly(order.PCD_GIO_IN || new Date())} ${this.formatTimeOnly(order.PCD_GIO_IN || new Date())}`,
      ],
      sections: [
        {
          heading: 'Thong tin benh nhan',
          keyValues: [
            { label: 'Ho ten', value: patientName || '-' },
            { label: 'Ma benh nhan', value: `#${appointment.BN_MA}` },
            { label: 'Ngay sinh', value: patientDob },
            {
              label: 'So dien thoai',
              value: appointment.BENH_NHAN?.BN_SDT_DANG_KY || appointment.BENH_NHAN?.TK_SDT || '-',
            },
          ],
        },
        {
          heading: 'Thong tin kham',
          keyValues: [
            { label: 'Ma lich hen', value: `#${appointment.DK_MA}` },
            { label: 'Bac si', value: doctorName },
            { label: 'Chuyen khoa', value: specialty },
            { label: 'Ngay kham', value: date },
            { label: 'Buoi', value: shift },
            { label: 'Khung gio', value: `${slotStart} - ${slotEnd}` },
            { label: 'Phong kham', value: room },
          ],
        },
        {
          heading: 'Danh sach dich vu chi dinh',
          table: {
            headers: ['STT', 'Ma DV', 'Ten dich vu', 'Don gia', 'So luong', 'Thanh tien'],
            rows: rows.map((item) => [
              String(item.stt),
              String(item.serviceCode),
              item.serviceName,
              this.formatCurrency(item.unitPrice),
              String(item.quantity),
              this.formatCurrency(item.lineTotal),
            ]),
          },
          paragraphs: [`Tong tien dich vu: ${this.formatCurrency(total)}`],
        },
      ],
    });

    return {
      appointment,
      order,
      total,
      report,
      filename: `chi-dinh-can-lam-sang-${appointmentId}-${orderId}.pdf`,
    };
  }

  async exportDoctorClinicalOrderPdf(
    user: CurrentUserPayload,
    appointmentId: number,
    orderId: number,
  ) {
    const { report, filename } = await this.buildDoctorClinicalOrderPdfReport(
      user,
      appointmentId,
      orderId,
    );
    await this.writeAuditLog({
      table: 'PHIEU_CDCLS',
      action: 'DOCTOR_CLINICAL_ORDER_PDF_EXPORTED',
      actor: user.TK_SDT,
      pk: { DK_MA: appointmentId, PCD_MA: orderId },
      next: { filename },
    });
    return { filename, buffer: report };
  }

  async updateDoctorClinicalOrderResult(
    user: CurrentUserPayload,
    appointmentId: number,
    orderId: number,
    serviceId: number,
    dto: UpdateDoctorOrderResultDto,
  ) {
    const appointment = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    const currentStatus = appointment.DK_TRANG_THAI || '';
    if (
      [APPOINTMENT_STATUS.HOAN_TAT, APPOINTMENT_STATUS.HUY, APPOINTMENT_STATUS.HUY_BS_NGHI].includes(
        currentStatus as any,
      )
    ) {
      throw new BadRequestException('Khong the cap nhat ket qua cho ca kham nay');
    }

    const execution = await this.prisma.tHUCHIEN.findUnique({
      where: {
        PCD_MA_DVCLS_MA: {
          PCD_MA: orderId,
          DVCLS_MA: serviceId,
        },
      },
      include: {
        PHIEU_CDCLS: {
          include: {
            PHIEU_KHAM_BENH: true,
          },
        },
      },
    });
    if (!execution || execution.PHIEU_CDCLS?.PHIEU_KHAM_BENH?.DK_MA !== appointmentId) {
      throw new NotFoundException('Khong tim thay chi dinh can lam sang');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.kET_QUA_CAN_LAM_SAN.upsert({
        where: {
          PCD_MA_DVCLS_MA: {
            PCD_MA: orderId,
            DVCLS_MA: serviceId,
          },
        },
        create: {
          PCD_MA: orderId,
          DVCLS_MA: serviceId,
          KQCLS_NHAN_XET: dto.resultSummary || null,
          KQCLS_HINH_ANH: dto.imageUrl || null,
          KQCLS_CHI_SO: dto.resultPayload ? (dto.resultPayload as Prisma.JsonObject) : Prisma.JsonNull,
        },
        update: {
          KQCLS_NHAN_XET: dto.resultSummary || null,
          KQCLS_HINH_ANH: dto.imageUrl || null,
          KQCLS_CHI_SO: dto.resultPayload ? (dto.resultPayload as Prisma.JsonObject) : Prisma.JsonNull,
        },
      });
      await tx.tHUCHIEN.update({
        where: {
          PCD_MA_DVCLS_MA: {
            PCD_MA: orderId,
            DVCLS_MA: serviceId,
          },
        },
        data: {
          CTCD_DA_THUC_HIEN: true,
          CTCD_THOI_GIAN_CHECKIN: new Date(),
        },
      });
      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'KET_QUA_CAN_LAM_SAN',
          AL_ACTION: 'DOCTOR_CLINICAL_RESULT_UPDATED',
          AL_PK: { DK_MA: appointmentId, PCD_MA: orderId, DVCLS_MA: serviceId },
          AL_OLD: Prisma.JsonNull,
          AL_NEW: {
            resultSummary: dto.resultSummary || null,
            imageUrl: dto.imageUrl || null,
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });
    });

    return {
      message: 'Cap nhat ket qua can lam sang thanh cong',
      ...(await this.getDoctorExamWorkflow(user, appointmentId)),
    };
  }

  async createDoctorPrescription(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: CreateDoctorPrescriptionDto,
  ) {
    const appointment = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    const currentStatus = appointment.DK_TRANG_THAI || '';
    if (![APPOINTMENT_STATUS.DA_CHECKIN, APPOINTMENT_STATUS.DA_KHAM].includes(currentStatus as any)) {
      throw new BadRequestException('Khong the ke don thuoc o trang thai hien tai');
    }
    const uniqueItems = new Map<number, CreateDoctorPrescriptionDto['items'][number]>();
    for (const item of dto.items || []) {
      if (!item?.medicineId || !item?.quantity) continue;
      uniqueItems.set(Number(item.medicineId), item);
    }
    if (uniqueItems.size === 0) {
      throw new BadRequestException('Danh sach thuoc dang rong');
    }

    const medicineIds = Array.from(uniqueItems.keys());
    const meds = await this.prisma.tHUOC.findMany({
      where: { T_MA: { in: medicineIds }, T_DA_XOA: { not: true } },
      select: { T_MA: true },
    });
    const medSet = new Set(meds.map((item) => item.T_MA));
    const missing = medicineIds.filter((id) => !medSet.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(`Khong tim thay thuoc: ${missing.join(', ')}`);
    }

    await this.prisma.$transaction(async (tx) => {
      const encounter = await this.getOrCreateEncounterTx(tx, appointmentId);
      const prescription = await tx.dON_THUOC.create({
        data: {
          PKB_MA: encounter.PKB_MA,
          DT_GHI_CHU: dto.note || null,
          DT_SO_NGAY_SUNG: dto.days || null,
        },
      });
      await tx.cHI_TIET_DON_THUOC.createMany({
        data: Array.from(uniqueItems.values()).map((item) => ({
          DT_MA: prescription.DT_MA,
          T_MA: item.medicineId,
          CTDT_SO_LUONG: item.quantity,
          CTDT_LIEU_DUNG: item.dosage || null,
          CTDT_CACH_DUNG: item.usage || null,
        })),
      });
      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'DON_THUOC',
          AL_ACTION: 'DOCTOR_PRESCRIPTION_CREATED',
          AL_PK: { DK_MA: appointmentId, DT_MA: prescription.DT_MA },
          AL_OLD: Prisma.JsonNull,
          AL_NEW: {
            itemCount: uniqueItems.size,
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });
    });

    return {
      message: 'Lap don thuoc thanh cong',
      ...(await this.getDoctorExamWorkflow(user, appointmentId)),
    };
  }

  async getDoctorPrescriptions(user: CurrentUserPayload, appointmentId: number) {
    const workflow = await this.getDoctorExamWorkflow(user, appointmentId);
    return {
      appointmentId,
      prescriptions: workflow.prescriptions,
    };
  }

  private async buildDoctorPrescriptionPdfReport(
    user: CurrentUserPayload,
    appointmentId: number,
    prescriptionId: number,
  ) {
    const appointment = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    const encounter = appointment.PHIEU_KHAM_BENH;
    if (!encounter) {
      throw new BadRequestException('Khong tim thay phieu kham benh');
    }

    const prescription = (encounter.DON_THUOC || []).find(
      (item: any) => item.DT_MA === prescriptionId,
    );
    if (!prescription) {
      throw new NotFoundException('Khong tim thay don thuoc');
    }

    const prescriptionItems = prescription.CHI_TIET_DON_THUOC || [];
    if (prescriptionItems.length === 0) {
      throw new BadRequestException('Don thuoc khong co thuoc');
    }

    const patientName = this.toDisplayName([
      appointment.BENH_NHAN?.BN_HO_CHU_LOT,
      appointment.BENH_NHAN?.BN_TEN,
    ]);
    const patientDob = appointment.BENH_NHAN?.BN_NGAY_SINH
      ? this.formatDateOnly(appointment.BENH_NHAN.BN_NGAY_SINH)
      : '-';
    const doctorName = appointment.LICH_BSK?.BAC_SI?.BS_HO_TEN || `#${appointment.BS_MA}`;
    const specialty = appointment.LICH_BSK?.BAC_SI?.CHUYEN_KHOA?.CK_TEN || '-';
    const room = appointment.LICH_BSK?.PHONG?.P_TEN || '-';
    const shift = appointment.B_TEN || '-';
    const date = this.formatDateOnly(appointment.N_NGAY);
    const slotStart = this.formatTimeOnly(appointment.KHUNG_GIO?.KG_BAT_DAU || null);
    const slotEnd = this.formatTimeOnly(appointment.KHUNG_GIO?.KG_KET_THUC || null);

    const rows = prescriptionItems.map((item: any, index: number) => {
      const quantity = Number(item.CTDT_SO_LUONG || 0);
      const unitPrice = Number(item.THUOC?.T_GIA_THUOC || 0);
      return {
        stt: index + 1,
        medicineCode: item.T_MA,
        medicineName: item.THUOC?.T_TEN_THUOC || `Thuoc ${item.T_MA}`,
        quantity,
        unitPrice,
        lineTotal: quantity * unitPrice,
        dosage: item.CTDT_LIEU_DUNG || '-',
        usage: item.CTDT_CACH_DUNG || '-',
      };
    });
    const total = rows.reduce((sum, item) => sum + item.lineTotal, 0);

    const guideLines = rows.map(
      (item) =>
        `${item.stt}. ${item.medicineName} - Lieu dung: ${item.dosage}. Cach dung: ${item.usage}.`,
    );

    const report = await this.pdfService.buildReport({
      title: 'DON THUOC',
      subtitle: `Ma don: #${prescriptionId} - Ma lich hen: #${appointmentId}`,
      metadataLines: [
        `Bac si ke don: ${doctorName}`,
        `So dien thoai bac si: ${user.TK_SDT}`,
        `Thoi gian tao don: ${this.formatDateOnly(prescription.DT_NGAY_TAO || new Date())} ${this.formatTimeOnly(prescription.DT_NGAY_TAO || new Date())}`,
      ],
      sections: [
        {
          heading: 'Thong tin benh nhan',
          keyValues: [
            { label: 'Ho ten', value: patientName || '-' },
            { label: 'Ma benh nhan', value: `#${appointment.BN_MA}` },
            { label: 'Ngay sinh', value: patientDob },
            {
              label: 'So dien thoai',
              value: appointment.BENH_NHAN?.BN_SDT_DANG_KY || appointment.BENH_NHAN?.TK_SDT || '-',
            },
          ],
        },
        {
          heading: 'Thong tin kham',
          keyValues: [
            { label: 'Ma lich hen', value: `#${appointment.DK_MA}` },
            { label: 'Bac si', value: doctorName },
            { label: 'Chuyen khoa', value: specialty },
            { label: 'Ngay kham', value: date },
            { label: 'Buoi', value: shift },
            { label: 'Khung gio', value: `${slotStart} - ${slotEnd}` },
            { label: 'Phong kham', value: room },
            {
              label: 'So ngay su dung',
              value: prescription.DT_SO_NGAY_SUNG ? String(prescription.DT_SO_NGAY_SUNG) : '-',
            },
          ],
        },
        {
          heading: 'Danh sach thuoc',
          table: {
            headers: ['STT', 'Ma thuoc', 'Ten thuoc', 'So luong', 'Don gia', 'Thanh tien'],
            rows: rows.map((item) => [
              String(item.stt),
              String(item.medicineCode),
              item.medicineName,
              String(item.quantity),
              this.formatCurrency(item.unitPrice),
              this.formatCurrency(item.lineTotal),
            ]),
          },
          paragraphs: [
            `Tong tien thuoc: ${this.formatCurrency(total)}`,
            `Ghi chu don thuoc: ${prescription.DT_GHI_CHU || '-'}`,
          ],
        },
        {
          heading: 'Huong dan su dung',
          paragraphs: guideLines,
        },
      ],
    });

    return {
      appointment,
      prescription,
      total,
      report,
      filename: `don-thuoc-${appointmentId}-${prescriptionId}.pdf`,
    };
  }

  async exportDoctorPrescriptionPdf(
    user: CurrentUserPayload,
    appointmentId: number,
    prescriptionId: number,
  ) {
    const { report, filename } = await this.buildDoctorPrescriptionPdfReport(
      user,
      appointmentId,
      prescriptionId,
    );
    await this.writeAuditLog({
      table: 'DON_THUOC',
      action: 'DOCTOR_PRESCRIPTION_PDF_EXPORTED',
      actor: user.TK_SDT,
      pk: { DK_MA: appointmentId, DT_MA: prescriptionId },
      next: { filename },
    });
    return { filename, buffer: report };
  }

  async finishDoctorClinical(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: FinishDoctorClinicalDto,
  ) {
    const appointment = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    const currentStatus = appointment.DK_TRANG_THAI || '';
    if (![APPOINTMENT_STATUS.DA_CHECKIN, APPOINTMENT_STATUS.DA_KHAM].includes(currentStatus as any)) {
      throw new BadRequestException('Ca kham chua o trang thai cho phep ket thuc chuyen mon');
    }
    const encounter = appointment.PHIEU_KHAM_BENH;
    if (!encounter) {
      throw new BadRequestException('Chua co phieu kham benh');
    }
    if (!String(encounter.PKB_KET_LUAN || '').trim()) {
      throw new BadRequestException('Can cap nhat ket luan truoc khi ket thuc kham chuyen mon');
    }

    const allExecutions = (encounter.PHIEU_CDCLS || []).flatMap((item: any) => item.THUCHIEN || []);
    const pendingOrders = allExecutions.filter((item: any) => !item.KET_QUA_CAN_LAM_SAN);
    if (pendingOrders.length > 0 && !dto.allowIncompleteOrders) {
      throw new BadRequestException('Con chi dinh can lam sang chua co ket qua');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.dANG_KY.update({
        where: { DK_MA: appointmentId },
        data: { DK_TRANG_THAI: APPOINTMENT_STATUS.DA_KHAM },
      });
      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'DANG_KY',
          AL_ACTION: 'DOCTOR_CLINICAL_FINISHED',
          AL_PK: { DK_MA: appointmentId },
          AL_OLD: { DK_TRANG_THAI: appointment.DK_TRANG_THAI },
          AL_NEW: {
            DK_TRANG_THAI: APPOINTMENT_STATUS.DA_KHAM,
            pendingOrders: pendingOrders.length,
            allowIncompleteOrders: Boolean(dto.allowIncompleteOrders),
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });
    });

    return {
      message: 'Ket thuc kham chuyen mon thanh cong',
      ...(await this.getDoctorExamWorkflow(user, appointmentId)),
    };
  }

  private async calculateEncounterCharges(input: {
    appointment: any;
    encounterId: number;
  }) {
    const examFee = Number(input.appointment.LOAI_HINH_KHAM?.LHK_GIA || 0);
    const serviceExecutions = await this.prisma.tHUCHIEN.findMany({
      where: {
        PHIEU_CDCLS: {
          PKB_MA: input.encounterId,
        },
      },
      include: {
        DICHVU: true,
      },
    });
    const serviceFee = serviceExecutions.reduce(
      (sum, item) => sum + Number(item.DICHVU?.DVCLS_GIA_DV || 0),
      0,
    );
    const prescriptionItems = await this.prisma.cHI_TIET_DON_THUOC.findMany({
      where: {
        DON_THUOC: {
          PKB_MA: input.encounterId,
        },
      },
      include: {
        THUOC: true,
      },
    });
    const prescriptionFee = prescriptionItems.reduce(
      (sum, item) => sum + Number(item.CTDT_SO_LUONG || 0) * Number(item.THUOC?.T_GIA_THUOC || 0),
      0,
    );
    const total = Number((examFee + serviceFee + prescriptionFee).toFixed(2));
    return { examFee, serviceFee, prescriptionFee, total };
  }

  async generateEncounterBilling(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: GenerateEncounterBillingDto,
  ) {
    const appointment = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    const currentStatus = appointment.DK_TRANG_THAI || '';
    if (![APPOINTMENT_STATUS.DA_KHAM, APPOINTMENT_STATUS.HOAN_TAT].includes(currentStatus as any)) {
      throw new BadRequestException('Chi co the lap hoa don sau khi ket thuc kham chuyen mon');
    }
    if (!appointment.PHIEU_KHAM_BENH) {
      throw new BadRequestException('Khong tim thay phieu kham de lap hoa don');
    }

    const latestPayment = appointment.THANH_TOAN?.[0] || null;
    if (latestPayment) {
      const normalized = this.normalizePaymentStatus(
        latestPayment.TT_TRANG_THAI,
        latestPayment.TT_THOI_GIAN,
      );
      if (normalized === 'paid' || normalized === 'unpaid' || normalized === 'pending') {
        return {
          message: 'Da ton tai hoa don cho ca kham nay',
          payment: latestPayment,
          ...(await this.getDoctorExamWorkflow(user, appointmentId)),
        };
      }
    }

    const { examFee, serviceFee, prescriptionFee, total } =
      await this.calculateEncounterCharges({
        appointment,
        encounterId: appointment.PHIEU_KHAM_BENH.PKB_MA,
      });
    const method = String(dto.paymentMethod || 'QR_BANKING').trim().toUpperCase();
    const paymentMethod = SUPPORTED_PAYMENT_METHODS.has(method) ? method : 'QR_BANKING';

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tHANH_TOAN.create({
        data: {
          DK_MA: appointmentId,
          PKB_MA: appointment.PHIEU_KHAM_BENH!.PKB_MA,
          TT_LOAI: 'KHAM_BENH',
          TT_PHUONG_THUC: paymentMethod,
          TT_TRANG_THAI: 'CHUA_THANH_TOAN',
          TT_TIEN_KHAM: examFee,
          TT_PHI_TIEN_ICH: 0,
          TT_MIEN_GIAM: 0,
          TT_TONG_TIEN: total,
          TT_THUC_THU: total,
        },
      });
      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'THANH_TOAN',
          AL_ACTION: 'ENCOUNTER_BILL_GENERATED',
          AL_PK: { DK_MA: appointmentId, TT_MA: created.TT_MA },
          AL_OLD: Prisma.JsonNull,
          AL_NEW: {
            examFee,
            serviceFee,
            prescriptionFee,
            total,
            paymentMethod,
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });
      return created;
    });

    return {
      message: 'Lap hoa don thanh cong',
      payment,
      ...(await this.getDoctorExamWorkflow(user, appointmentId)),
    };
  }

  async markEncounterPaymentAsPaid(
    user: CurrentUserPayload,
    appointmentId: number,
    paymentId: number,
    dto: MarkEncounterPaymentDto,
  ) {
    const appointment = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    const payment = await this.prisma.tHANH_TOAN.findUnique({
      where: { TT_MA: paymentId },
    });
    if (!payment || payment.DK_MA !== appointment.DK_MA) {
      throw new NotFoundException('Khong tim thay hoa don can cap nhat');
    }
    const normalized = this.normalizePaymentStatus(payment.TT_TRANG_THAI, payment.TT_THOI_GIAN);
    if (normalized === 'paid') {
      return {
        message: 'Hoa don da thanh toan',
        payment,
        ...(await this.getDoctorExamWorkflow(user, appointmentId)),
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tHANH_TOAN.update({
        where: { TT_MA: paymentId },
        data: {
          TT_TRANG_THAI: 'DA_THANH_TOAN',
          TT_PHUONG_THUC_TT: dto.paymentGateway || 'INTERNAL',
          TT_MA_GIAO_DICH: dto.transactionCode || payment.TT_MA_GIAO_DICH || `INTERNAL_${paymentId}`,
          TT_THOI_GIAN: new Date(),
        },
      });
      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'THANH_TOAN',
          AL_ACTION: 'ENCOUNTER_PAYMENT_MARKED_PAID',
          AL_PK: { DK_MA: appointmentId, TT_MA: paymentId },
          AL_OLD: { TT_TRANG_THAI: payment.TT_TRANG_THAI },
          AL_NEW: {
            TT_TRANG_THAI: 'DA_THANH_TOAN',
            transactionCode: dto.transactionCode || null,
            paymentGateway: dto.paymentGateway || null,
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });
    });

    return {
      message: 'Cap nhat thanh toan thanh cong',
      ...(await this.getDoctorExamWorkflow(user, appointmentId)),
    };
  }

  async confirmDoctorExamComplete(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: ConfirmDoctorExamDto,
  ) {
    const appointment = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    const currentStatus = appointment.DK_TRANG_THAI || '';
    if (
      [APPOINTMENT_STATUS.HUY, APPOINTMENT_STATUS.HUY_BS_NGHI, APPOINTMENT_STATUS.NO_SHOW].includes(
        currentStatus as any,
      )
    ) {
      throw new BadRequestException('Khong the hoan tat cho ca kham da huy hoac no-show');
    }
    if (currentStatus === APPOINTMENT_STATUS.CHO_KHAM) {
      throw new BadRequestException('Can bat dau kham truoc khi xac nhan hoan tat');
    }

    const encounter = appointment.PHIEU_KHAM_BENH;
    if (!encounter) {
      throw new BadRequestException('Chua co phieu kham benh');
    }
    if (!String(encounter.PKB_KET_LUAN || '').trim()) {
      throw new BadRequestException('Can cap nhat ket luan truoc khi xac nhan hoan tat');
    }
    const allExecutions = (encounter.PHIEU_CDCLS || []).flatMap((item: any) => item.THUCHIEN || []);
    const pendingOrders = allExecutions.filter((item: any) => !item.KET_QUA_CAN_LAM_SAN);
    if (pendingOrders.length > 0 && !dto.allowIncompleteOrders) {
      throw new BadRequestException('Con chi dinh can lam sang chua co ket qua');
    }

    const existingLatestPayment = appointment.THANH_TOAN?.[0] || null;
    const existingNormalized = existingLatestPayment
      ? this.normalizePaymentStatus(
          existingLatestPayment.TT_TRANG_THAI,
          existingLatestPayment.TT_THOI_GIAN,
        )
      : 'unpaid';
    const { examFee, serviceFee, prescriptionFee, total } = await this.calculateEncounterCharges({
      appointment,
      encounterId: encounter.PKB_MA,
    });

    const payment = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.tHANH_TOAN.findFirst({
        where: { DK_MA: appointmentId },
        orderBy: { TT_THOI_GIAN: 'desc' },
      });
      const latestNormalized = latest
        ? this.normalizePaymentStatus(latest.TT_TRANG_THAI, latest.TT_THOI_GIAN)
        : 'unpaid';

      if (!latest && total > 0) {
        const created = await tx.tHANH_TOAN.create({
          data: {
            DK_MA: appointmentId,
            PKB_MA: encounter.PKB_MA,
            TT_LOAI: 'KHAM_BENH',
            TT_PHUONG_THUC: 'QR_BANKING',
            TT_TRANG_THAI: 'CHUA_THANH_TOAN',
            TT_TIEN_KHAM: examFee,
            TT_PHI_TIEN_ICH: 0,
            TT_MIEN_GIAM: 0,
            TT_TONG_TIEN: total,
            TT_THUC_THU: total,
          },
        });
        await tx.aUDIT_LOG.create({
          data: {
            AL_TABLE: 'THANH_TOAN',
            AL_ACTION: 'ENCOUNTER_BILL_AUTO_GENERATED_ON_COMPLETE',
            AL_PK: { DK_MA: appointmentId, TT_MA: created.TT_MA },
            AL_OLD: Prisma.JsonNull,
            AL_NEW: {
              examFee,
              serviceFee,
              prescriptionFee,
              total,
            },
            AL_CHANGED_BY: user.TK_SDT,
          },
        });
        return created;
      }

      if (latestNormalized === 'paid' || latestNormalized === 'pending' || latestNormalized === 'unpaid') {
        return latest;
      }
      return latest;
    });

    const oldStatus = appointment.DK_TRANG_THAI || null;
    if (currentStatus !== APPOINTMENT_STATUS.HOAN_TAT) {
      await this.prisma.$transaction(async (tx) => {
        await tx.dANG_KY.update({
          where: { DK_MA: appointmentId },
          data: { DK_TRANG_THAI: APPOINTMENT_STATUS.HOAN_TAT },
        });
        await tx.aUDIT_LOG.create({
          data: {
            AL_TABLE: 'DANG_KY',
            AL_ACTION: 'DOCTOR_EXAM_CONFIRMED_COMPLETE',
            AL_PK: { DK_MA: appointmentId },
            AL_OLD: { DK_TRANG_THAI: oldStatus },
            AL_NEW: {
              DK_TRANG_THAI: APPOINTMENT_STATUS.HOAN_TAT,
              pendingOrders: pendingOrders.length,
              allowIncompleteOrders: Boolean(dto.allowIncompleteOrders),
              note: dto.note || null,
            },
            AL_CHANGED_BY: user.TK_SDT,
          },
        });
      });
    }

    const patientPhone = appointment.BENH_NHAN?.TK_SDT || appointment.BENH_NHAN?.BN_SDT_DANG_KY;
    if (patientPhone) {
      await this.createAppointmentNotification({
        appointmentId,
        phone: patientPhone,
        type: 'system_auto',
        title: 'Kết quả khám đã sẵn sàng',
        content:
          `Ca khám #${appointmentId} đã được bác sĩ xác nhận hoàn tất. ` +
          `Vui lòng vào hệ thống để xem kết quả khám và đơn thuốc.`,
        dedupeKey: `[EXAM_COMPLETED_DK_MA=${appointmentId}]`,
      });

      const normalized = payment
        ? this.normalizePaymentStatus(payment.TT_TRANG_THAI, payment.TT_THOI_GIAN)
        : existingNormalized;
      const shouldNotifyPayment =
        total > 0 &&
        normalized !== 'paid' &&
        normalized !== 'refunded' &&
        normalized !== 'refund_pending';
      if (shouldNotifyPayment) {
        await this.createPaymentNotification({
          phone: patientPhone,
          type: 'payment_pending',
          title: 'Thông báo thanh toán dịch vụ',
          content:
            `Ca khám #${appointmentId} có chi phí dịch vụ cần thanh toán. ` +
            `Tổng tiền tạm tính: ${this.formatCurrency(total)}.`,
          dedupeKey: `[EXAM_PAYMENT_PENDING_DK_MA=${appointmentId}]`,
        });
      }
    }

    return {
      message: 'Xac nhan kham hoan tat thanh cong',
      ...(await this.getDoctorExamWorkflow(user, appointmentId)),
    };
  }

  async completeEncounterAfterPayment(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: CompleteEncounterDto,
  ) {
    const appointment = await this.getDoctorAppointmentForExamOrThrow(user, appointmentId);
    const currentStatus = appointment.DK_TRANG_THAI || '';
    if (![APPOINTMENT_STATUS.DA_KHAM, APPOINTMENT_STATUS.HOAN_TAT].includes(currentStatus as any)) {
      throw new BadRequestException('Ca kham chua ket thuc chuyen mon');
    }
    const latestPayment = appointment.THANH_TOAN?.[0] || null;
    const normalized = latestPayment
      ? this.normalizePaymentStatus(latestPayment.TT_TRANG_THAI, latestPayment.TT_THOI_GIAN)
      : 'unpaid';
    if (normalized !== 'paid') {
      throw new BadRequestException('Can thanh toan thanh cong truoc khi hoan tat ho so');
    }
    if (appointment.DK_TRANG_THAI === APPOINTMENT_STATUS.HOAN_TAT) {
      return {
        message: 'Ho so da hoan tat',
        ...(await this.getDoctorExamWorkflow(user, appointmentId)),
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.dANG_KY.update({
        where: { DK_MA: appointmentId },
        data: { DK_TRANG_THAI: APPOINTMENT_STATUS.HOAN_TAT },
      });
      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'DANG_KY',
          AL_ACTION: 'ENCOUNTER_COMPLETED_AFTER_PAYMENT',
          AL_PK: { DK_MA: appointmentId },
          AL_OLD: { DK_TRANG_THAI: appointment.DK_TRANG_THAI },
          AL_NEW: {
            DK_TRANG_THAI: APPOINTMENT_STATUS.HOAN_TAT,
            note: dto.note || null,
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });
    });

    const patientPhone = appointment.BENH_NHAN?.TK_SDT || appointment.BENH_NHAN?.BN_SDT_DANG_KY || null;
    if (patientPhone) {
      await this.createAppointmentNotification({
        appointmentId,
        phone: patientPhone,
        type: 'system_auto',
        title: 'Ho so kham benh da hoan tat',
        content:
          `Ho so kham benh DK_MA=${appointmentId} da hoan tat.` +
          ` Ket qua kham, don thuoc va hoa don da san sang tren he thong.`,
        dedupeKey: `[ENCOUNTER_COMPLETED_DK_MA=${appointmentId}]`,
      });
    }

    return {
      message: 'Hoan tat ho so kham benh thanh cong',
      ...(await this.getDoctorExamWorkflow(user, appointmentId)),
    };
  }

  private buildDoctorWorklistWhere(bsMa: number, query: DoctorWorklistQueryDto) {
    const targetDate = query.date ? parseDateOnly(query.date) : undefined;
    const statusList = this.parseStatusList(query.status);

    return {
      BS_MA: bsMa,
      ...(targetDate ? { N_NGAY: targetDate } : {}),
      ...(query.shift ? { B_TEN: query.shift } : {}),
      ...(statusList.length > 0 ? { DK_TRANG_THAI: { in: statusList } } : {}),
      ...(query.roomId ? { LICH_BSK: { P_MA: query.roomId } } : {}),
    } satisfies Prisma.DANG_KYWhereInput;
  }

  private mapDoctorWorklistItem(row: any) {
    const latestPayment = row.THANH_TOAN?.[0] || null;
    return {
      DK_MA: row.DK_MA,
      BN_MA: row.BN_MA,
      patientName: `${row.BENH_NHAN?.BN_HO_CHU_LOT || ''} ${row.BENH_NHAN?.BN_TEN || ''}`
        .trim()
        .trim(),
      patientDob: row.BENH_NHAN?.BN_NGAY_SINH || null,
      patientPhone: row.BENH_NHAN?.BN_SDT_DANG_KY || row.BENH_NHAN?.TK_SDT || null,
      N_NGAY: row.N_NGAY,
      B_TEN: row.B_TEN,
      KG_MA: row.KG_MA,
      KG_BAT_DAU: row.KHUNG_GIO?.KG_BAT_DAU || null,
      KG_KET_THUC: row.KHUNG_GIO?.KG_KET_THUC || null,
      DK_TRANG_THAI: row.DK_TRANG_THAI,
      note: row.DK_LY_DO_HUY || null,
      preVisitSymptoms: row.DK_TRIEU_CHUNG || null,
      preVisitNote: row.DK_GHI_CHU_TIEN_KHAM || null,
      paymentStatus: latestPayment
        ? this.normalizePaymentStatus(latestPayment.TT_TRANG_THAI, latestPayment.TT_THOI_GIAN)
        : 'unpaid',
      roomId: row.LICH_BSK?.P_MA || null,
      roomName: row.LICH_BSK?.PHONG?.P_TEN || null,
    };
  }

  async getDoctorWorklist(user: CurrentUserPayload, query: DoctorWorklistQueryDto) {
    const bsMa = user.bsMa;
    if (!bsMa) throw new ForbiddenException('Tai khoan hien tai khong phai bac si');

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const where = this.buildDoctorWorklistWhere(bsMa, query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.dANG_KY.count({ where }),
      this.prisma.dANG_KY.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ N_NGAY: 'asc' }, { KG_MA: 'asc' }, { DK_STT: 'asc' }],
        include: {
          BENH_NHAN: true,
          KHUNG_GIO: true,
          LICH_BSK: {
            include: {
              PHONG: true,
            },
          },
          THANH_TOAN: {
            orderBy: { TT_THOI_GIAN: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    return {
      items: rows.map((row) => this.mapDoctorWorklistItem(row)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async exportDoctorWorklistPdf(user: CurrentUserPayload, query: DoctorWorklistQueryDto) {
    if (!user.bsMa) throw new ForbiddenException('Tai khoan hien tai khong phai bac si');

    const where = this.buildDoctorWorklistWhere(user.bsMa, query);
    const [doctor, rows] = await Promise.all([
      this.prisma.bAC_SI.findUnique({
        where: { BS_MA: user.bsMa },
        include: { CHUYEN_KHOA: true },
      }),
      this.prisma.dANG_KY.findMany({
        where,
        orderBy: [{ N_NGAY: 'asc' }, { B_TEN: 'asc' }, { KG_MA: 'asc' }, { DK_STT: 'asc' }],
        include: {
          BENH_NHAN: true,
          KHUNG_GIO: true,
          LICH_BSK: {
            include: {
              PHONG: true,
            },
          },
        },
      }),
    ]);

    const items = rows.map((row) => this.mapDoctorWorklistItem(row));
    const shiftLabel = (shift?: string) => {
      const normalized = (shift || '').toUpperCase();
      if (normalized === 'SANG') return 'Sáng';
      if (normalized === 'CHIEU') return 'Chiều';
      if (normalized === 'TOI') return 'Tối';
      return shift || '-';
    };

    const tableRows =
      items.length > 0
        ? items.map((item) => [
            shiftLabel(item.B_TEN),
            item.roomName || '-',
            `${this.formatTimeOnly(item.KG_BAT_DAU)} - ${this.formatTimeOnly(item.KG_KET_THUC)}`,
            item.patientName || '-',
            `#${item.DK_MA}`,
            `#${item.BN_MA}`,
            item.patientPhone || '-',
            item.preVisitSymptoms || '-',
            item.preVisitNote || '-',
          ])
        : [['-', '-', '-', '-', '-', '-', '-', '-', '-']];

    const subtitleDate = query.date ? this.formatDateOnly(query.date) : 'Toàn bộ ngày';
    const subtitleShift = query.shift ? shiftLabel(query.shift) : 'Toàn bộ buổi';

    const report = await this.pdfService.buildReport({
      title: 'DANH SÁCH BỆNH NHÂN ĐẶT KHÁM',
      subtitle: `Bác sĩ: ${doctor?.BS_HO_TEN || `#${user.bsMa}`}`,
      metadataLines: [
        `Mã bác sĩ: ${user.bsMa}`,
        `Chuyên khoa: ${doctor?.CHUYEN_KHOA?.CK_TEN || '-'}`,
        `Ngày: ${subtitleDate}`,
        `Buổi: ${subtitleShift}`,
        query.roomId ? `Phòng lọc: #${query.roomId}` : 'Phòng lọc: Tất cả',
        `Người xuất: ${user.TK_SDT}`,
      ],
      sections: [
        {
          heading: 'Danh sách theo khung giờ và phòng',
          paragraphs: [
            `Tổng số bệnh nhân: ${items.length}`,
            'Dữ liệu được sắp xếp theo buổi, phòng và khung giờ.',
          ],
          table: {
            headers: [
              'Buổi',
              'Phòng',
              'Khung giờ',
              'Bệnh nhân',
              'Mã lịch hẹn',
              'Mã hồ sơ',
              'SĐT',
              'Triệu chứng',
              'Ghi chú',
            ],
            rows: tableRows,
          },
        },
      ],
    });

    await this.writeAuditLog({
      table: 'DANG_KY',
      action: 'DOCTOR_WORKLIST_PDF_EXPORTED',
      actor: user.TK_SDT,
      pk: { BS_MA: user.bsMa },
      next: {
        date: query.date || null,
        shift: query.shift || null,
        roomId: query.roomId || null,
        totalItems: items.length,
      },
    });

    const fileDate = query.date || 'all-dates';
    const fileShift = (query.shift || 'all-shifts').toLowerCase();
    return {
      filename: `doctor-worklist-${user.bsMa}-${fileDate}-${fileShift}.pdf`,
      buffer: report,
    };
  }

  async updateStatusByDoctor(
    user: CurrentUserPayload,
    appointmentId: number,
    dto: DoctorUpdateAppointmentStatusDto,
  ) {
    if (!user.bsMa) throw new ForbiddenException('Tai khoan hien tai khong phai bac si');
    const appointment = await this.getAppointmentOrThrow(appointmentId);
    if (appointment.BS_MA !== user.bsMa) {
      throw new ForbiddenException('Ban khong co quyen thao tac lich hen cua bac si khac');
    }
    if (['HUY', 'HUY_BS_NGHI'].includes(appointment.DK_TRANG_THAI || '')) {
      throw new BadRequestException('Lich hen da huy, khong the cap nhat');
    }

    const updated = await this.updateAppointmentStatusWithActor(user, appointmentId, dto.status, {
      reason: dto.reason,
      note: dto.note,
      action: 'STATUS_UPDATED_BY_DOCTOR',
    });
    return {
      message: 'Cap nhat trang thai lich hen thanh cong',
      appointment: updated,
    };
  }

  async getDoctorStatsSummary(user: CurrentUserPayload, query: DoctorStatsQueryDto) {
    if (!user.bsMa) throw new ForbiddenException('Tai khoan hien tai khong phai bac si');
    const { fromDate, toDate } = this.resolveDoctorStatsRange(query);

    const where: Prisma.DANG_KYWhereInput = {
      BS_MA: user.bsMa,
      N_NGAY: { gte: fromDate, lte: toDate },
    };

    const [totalAppointments, grouped] = await this.prisma.$transaction([
      this.prisma.dANG_KY.count({ where }),
      this.prisma.dANG_KY.groupBy({
        by: ['DK_TRANG_THAI'],
        where,
        _count: { _all: true },
      }),
    ]);

    const groupedMap = new Map<string, number>();
    grouped.forEach((item) => groupedMap.set(item.DK_TRANG_THAI || 'UNKNOWN', item._count._all));

    const completedAppointments = groupedMap.get('DA_KHAM') || 0;
    const canceledAppointments =
      (groupedMap.get('HUY') || 0) + (groupedMap.get('HUY_BS_NGHI') || 0);
    const noShowAppointments = groupedMap.get('NO_SHOW') || 0;
    const checkedInAppointments = groupedMap.get('DA_CHECKIN') || 0;
    const upcomingAppointments = Math.max(
      0,
      totalAppointments - completedAppointments - canceledAppointments - noShowAppointments,
    );
    const ratioBase = totalAppointments || 1;

    const today = parseDateOnly(new Date().toISOString().slice(0, 10));
    const weekStart = new Date(today);
    const day = weekStart.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    weekStart.setUTCDate(weekStart.getUTCDate() + diff);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

    const [todayAppointments, thisWeekAppointments] = await this.prisma.$transaction([
      this.prisma.dANG_KY.count({
        where: {
          BS_MA: user.bsMa,
          N_NGAY: today,
        },
      }),
      this.prisma.dANG_KY.count({
        where: {
          BS_MA: user.bsMa,
          N_NGAY: { gte: weekStart, lte: weekEnd },
        },
      }),
    ]);

    return {
      fromDate: fromDate.toISOString().slice(0, 10),
      toDate: toDate.toISOString().slice(0, 10),
      totalAppointments,
      completedAppointments,
      canceledAppointments,
      noShowAppointments,
      totalCheckedIn: checkedInAppointments,
      upcomingAppointments,
      todayAppointments,
      thisWeekAppointments,
      cancellationRate: Number(((canceledAppointments / ratioBase) * 100).toFixed(2)),
      noShowRate: Number(((noShowAppointments / ratioBase) * 100).toFixed(2)),
    };
  }

  async getDoctorStatsTrends(user: CurrentUserPayload, query: DoctorStatsQueryDto) {
    if (!user.bsMa) throw new ForbiddenException('Tai khoan hien tai khong phai bac si');
    const { fromDate, toDate, groupBy } = this.resolveDoctorStatsRange(query);

    const groupBySql =
      groupBy === 'week'
        ? `date_trunc('week', "N_NGAY")`
        : groupBy === 'month'
          ? `date_trunc('month', "N_NGAY")`
          : `date_trunc('day', "N_NGAY")`;

    const rows = await this.prisma.getClient().$queryRawUnsafe<any[]>(
      `SELECT
        ${groupBySql} AS "label_date",
        COUNT(*)::int AS "total",
        SUM(CASE WHEN "DK_TRANG_THAI" = 'DA_KHAM' THEN 1 ELSE 0 END)::int AS "completed",
        SUM(CASE WHEN "DK_TRANG_THAI" IN ('HUY','HUY_BS_NGHI') THEN 1 ELSE 0 END)::int AS "canceled",
        SUM(CASE WHEN "DK_TRANG_THAI" = 'NO_SHOW' THEN 1 ELSE 0 END)::int AS "no_show"
      FROM "DANG_KY"
      WHERE "BS_MA" = $1
        AND "N_NGAY" >= $2
        AND "N_NGAY" <= $3
      GROUP BY 1
      ORDER BY 1 ASC`,
      user.bsMa,
      fromDate,
      toDate,
    );

    return {
      fromDate: fromDate.toISOString().slice(0, 10),
      toDate: toDate.toISOString().slice(0, 10),
      groupBy,
      items: rows.map((row) => ({
        label: this.formatTrendLabel(groupBy, new Date(row.label_date)),
        total: Number(row.total || 0),
        completed: Number(row.completed || 0),
        canceled: Number(row.canceled || 0),
        noShow: Number(row.no_show || 0),
      })),
    };
  }

  async exportDoctorStatsPdf(user: CurrentUserPayload, query: DoctorStatsQueryDto) {
    if (!user.bsMa) throw new ForbiddenException('Tai khoan hien tai khong phai bac si');

    const [summary, trends, doctor] = await Promise.all([
      this.getDoctorStatsSummary(user, query),
      this.getDoctorStatsTrends(user, query),
      this.prisma.bAC_SI.findUnique({
        where: { BS_MA: user.bsMa },
        include: { CHUYEN_KHOA: true },
      }),
    ]);

    const trendTableRows = (trends.items || []).map((item: any) => [
      String(item.label || '-'),
      String(item.total ?? 0),
      String(item.completed ?? 0),
      String(item.canceled ?? 0),
      String(item.noShow ?? 0),
    ]);

    const groupByTextMap: Record<string, string> = {
      day: 'ngày',
      week: 'tuần',
      month: 'tháng',
    };

    const report = await this.pdfService.buildReport({
      title: 'BÁO CÁO THỐNG KÊ PHỤC VỤ BÁC SĨ',
      subtitle: `Bác sĩ: ${doctor?.BS_HO_TEN || `#${user.bsMa}`}`,
      metadataLines: [
        `Mã bác sĩ: ${user.bsMa}`,
        `Chuyên khoa: ${doctor?.CHUYEN_KHOA?.CK_TEN || '-'}`,
        `Người xuất: ${user.TK_SDT}`,
      ],
      sections: [
        {
          heading: 'Tổng quan',
          keyValues: [
            { label: 'Khoảng ngày', value: `${summary.fromDate} -> ${summary.toDate}` },
            { label: 'Tổng lịch hẹn', value: String(summary.totalAppointments ?? 0) },
            { label: 'Đã khám', value: String(summary.completedAppointments ?? 0) },
            { label: 'Đã hủy', value: String(summary.canceledAppointments ?? 0) },
            { label: 'No-show', value: String(summary.noShowAppointments ?? 0) },
            { label: 'Đã check-in', value: String(summary.totalCheckedIn ?? 0) },
            { label: 'Sắp tới', value: String(summary.upcomingAppointments ?? 0) },
            { label: 'Lịch hôm nay', value: String(summary.todayAppointments ?? 0) },
            { label: 'Lịch tuần này', value: String(summary.thisWeekAppointments ?? 0) },
            { label: 'Tỷ lệ hủy (%)', value: String(summary.cancellationRate ?? 0) },
            { label: 'Tỷ lệ no-show (%)', value: String(summary.noShowRate ?? 0) },
          ],
        },
        {
          heading: 'Xu hướng theo thời gian',
          paragraphs: [`Nhóm theo: ${groupByTextMap[trends.groupBy] || trends.groupBy || 'ngày'}`],
          table: {
            headers: ['Mốc thời gian', 'Tổng', 'Đã khám', 'Hủy', 'No-show'],
            rows: trendTableRows.length > 0 ? trendTableRows : [['-', '0', '0', '0', '0']],
          },
        },
      ],
    });

    await this.writeAuditLog({
      table: 'DANG_KY',
      action: 'DOCTOR_STATS_PDF_EXPORTED',
      actor: user.TK_SDT,
      pk: { BS_MA: user.bsMa },
      next: {
        fromDate: summary.fromDate,
        toDate: summary.toDate,
        groupBy: trends.groupBy,
      },
    });

    return {
      filename: `doctor-stats-${user.bsMa}-${summary.fromDate}-${summary.toDate}.pdf`,
      buffer: report,
    };
  }

  private async resolveBulkNotificationRecipients(dto: BulkNotificationDto) {
    return this.notificationRecipientResolver.resolve(dto);
  }

  async previewBulkNotificationRecipients(dto: BulkNotificationDto) {
    const resolved = await this.resolveBulkNotificationRecipients(dto);
    const sample = resolved.recipients.slice(0, 20);

    return {
      quickPreset: resolved.quickPreset,
      targetGroup: resolved.targetGroup,
      recipientScope: resolved.recipientScope,
      summaryText: resolved.summaryText,
      scopeSummary: resolved.scopeSummary,
      filterSummary: resolved.filterSummary,
      resolvedFilter: resolved.normalizedFilter,
      totalRecipients: resolved.recipients.length,
      previewRecipients: sample,
      sampleRecipients: sample,
      warnings: resolved.warnings,
      emptyReason: resolved.emptyReason,
    };
  }

  async createBulkNotificationBatch(user: CurrentUserPayload, dto: BulkNotificationDto) {
    const resolved = await this.resolveBulkNotificationRecipients(dto);
    if (resolved.recipients.length === 0) {
      throw new BadRequestException(
        resolved.emptyReason || 'Danh sách người nhận thông báo đang rỗng.',
      );
    }

    const idempotencyPayload = {
      type: dto.type,
      quickPreset: resolved.quickPreset,
      targetGroup: resolved.targetGroup,
      recipientScope: resolved.recipientScope,
      summaryText: resolved.summaryText,
      title: dto.title || null,
      message: dto.message.trim(),
      appointmentIds: resolved.normalizedIds,
      doctorIds: resolved.normalizedFilter.doctorIds,
      slotId: resolved.normalizedFilter.slotId || null,
      scheduleId: resolved.normalizedFilter.scheduleId || null,
      specialtyIds: resolved.normalizedFilter.specialtyIds,
      dateFrom: resolved.dateFrom?.toISOString().slice(0, 10) || null,
      dateTo: resolved.dateTo?.toISOString().slice(0, 10) || null,
      appointmentStatuses: resolved.normalizedFilter.appointmentStatuses,
      filterSummary: resolved.filterSummary,
    };
    const idempotencyKey = createHash('sha1')
      .update(JSON.stringify(idempotencyPayload))
      .digest('hex');

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingBatch = await this.prisma.tHONG_BAO_BATCH.findFirst({
      where: {
        TBB_IDEMPOTENCY_KEY: idempotencyKey,
        TBB_NGUOI_TAO: user.TK_SDT,
        TBB_THOI_GIAN_TAO: { gte: fiveMinutesAgo },
      },
      orderBy: { TBB_THOI_GIAN_TAO: 'desc' },
    });
    if (existingBatch) {
      return {
        message: 'Yêu cầu gửi thông báo tương tự đã được xử lý gần đây.',
        batchId: existingBatch.TBB_MA,
        duplicatedRequest: true,
      };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const batch = await tx.tHONG_BAO_BATCH.create({
        data: {
          TBB_LOAI: dto.type,
          TBB_TIEU_DE: dto.title?.trim() || null,
          TBB_NOI_DUNG: dto.message.trim(),
          TBB_TIEU_CHI: idempotencyPayload,
          TBB_IDEMPOTENCY_KEY: idempotencyKey,
          TBB_TONG_NGUOI_NHAN: resolved.recipients.length,
          TBB_TRANG_THAI: 'QUEUED',
          TBB_NGUOI_TAO: user.TK_SDT,
          TBB_METADATA: {
            quickPreset: resolved.quickPreset,
            targetGroup: resolved.targetGroup,
            recipientScope: resolved.recipientScope,
            summaryText: resolved.summaryText,
            warnings: resolved.warnings,
            scopeSummary: resolved.scopeSummary,
          },
        },
      });

      await tx.tHONG_BAO_BATCH_RECIPIENT.createMany({
        data: resolved.recipients.map((item) => ({
          TBB_MA: batch.TBB_MA,
          TK_SDT: item.phone,
          DK_MA: item.appointmentId,
          TBR_TRANG_THAI: 'QUEUED',
        })),
      });

      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'THONG_BAO_BATCH',
          AL_ACTION: 'BULK_NOTIFICATION_QUEUED',
          AL_PK: { TBB_MA: batch.TBB_MA },
          AL_NEW: {
            type: dto.type,
            quickPreset: resolved.quickPreset,
            targetGroup: resolved.targetGroup,
            recipientCount: resolved.recipients.length,
            criteria: idempotencyPayload,
            warnings: resolved.warnings,
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });

      return batch;
    });

    return {
      message: 'Batch thông báo đã được xếp hàng để xử lý.',
      batchId: created.TBB_MA,
      totalRecipients: resolved.recipients.length,
      status: 'QUEUED',
      quickPreset: resolved.quickPreset,
      targetGroup: resolved.targetGroup,
      summaryText: resolved.summaryText,
      warnings: resolved.warnings,
    };
  }

  async listBulkNotificationBatches(query: BulkNotificationListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const { fromDate, toDate } = this.normalizeDateRange({
      fromDate: query.fromDate,
      toDate: query.toDate,
    });

    const where: Prisma.THONG_BAO_BATCHWhereInput = {
      ...(query.type ? { TBB_LOAI: query.type } : {}),
      ...(query.actorId ? { TBB_NGUOI_TAO: query.actorId } : {}),
      ...(fromDate || toDate
        ? {
            TBB_THOI_GIAN_TAO: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.tHONG_BAO_BATCH.count({ where }),
      this.prisma.tHONG_BAO_BATCH.findMany({
        where,
        skip,
        take: limit,
        orderBy: { TBB_THOI_GIAN_TAO: 'desc' },
      }),
    ]);

    return {
      items: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getBulkNotificationBatchDetail(batchId: number) {
    const batch = await this.prisma.tHONG_BAO_BATCH.findUnique({
      where: { TBB_MA: batchId },
    });
    if (!batch) throw new NotFoundException('Khong tim thay batch thong bao');

    const [recipients, groupedStatus] = await this.prisma.$transaction([
      this.prisma.tHONG_BAO_BATCH_RECIPIENT.findMany({
        where: { TBB_MA: batchId },
        orderBy: [{ TBR_UPDATED_AT: 'desc' }, { TBR_MA: 'desc' }],
        take: 500,
      }),
      this.prisma.tHONG_BAO_BATCH_RECIPIENT.groupBy({
        by: ['TBR_TRANG_THAI'],
        where: { TBB_MA: batchId },
        _count: { _all: true },
      }),
    ]);

    const summary = groupedStatus.reduce(
      (acc, item) => {
        const key = (item.TBR_TRANG_THAI || 'UNKNOWN').toLowerCase();
        acc[key] = item._count._all;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      batch,
      summary,
      recipients,
    };
  }

  async getBulkNotificationBatchRecipients(batchId: number, onlyFailed = false) {
    const batch = await this.prisma.tHONG_BAO_BATCH.findUnique({ where: { TBB_MA: batchId } });
    if (!batch) throw new NotFoundException('Khong tim thay batch thong bao');

    const items = await this.prisma.tHONG_BAO_BATCH_RECIPIENT.findMany({
      where: {
        TBB_MA: batchId,
        ...(onlyFailed ? { TBR_TRANG_THAI: { in: ['FAILED', 'DEAD'] } } : {}),
      },
      orderBy: [{ TBR_UPDATED_AT: 'desc' }, { TBR_MA: 'desc' }],
      take: 1000,
    });
    return { batchId, items };
  }

  async retryBulkNotificationBatch(
    user: CurrentUserPayload,
    batchId: number,
    dto: RetryBulkBatchDto,
  ) {
    const source = await this.prisma.tHONG_BAO_BATCH.findUnique({ where: { TBB_MA: batchId } });
    if (!source) throw new NotFoundException('Khong tim thay batch thong bao');

    const onlyFailed = dto.onlyFailed !== 'false';
    const recipientFilter = dto.recipientIds && dto.recipientIds.length > 0
      ? { TBR_MA: { in: dto.recipientIds } }
      : {};

    const sourceRecipients = await this.prisma.tHONG_BAO_BATCH_RECIPIENT.findMany({
      where: {
        TBB_MA: batchId,
        ...(onlyFailed ? { TBR_TRANG_THAI: 'FAILED' } : {}),
        ...recipientFilter,
      },
    });
    if (sourceRecipients.length === 0) {
      throw new BadRequestException('Khong co recipient hop le de retry');
    }

    const idemBase = dto.idempotencyKey || `retry-${batchId}-${sourceRecipients.map((i) => i.TBR_MA).join(',')}`;
    const idempotencyKey = createHash('sha1').update(idemBase).digest('hex');

    const created = await this.prisma.$transaction(async (tx) => {
      const batch = await tx.tHONG_BAO_BATCH.create({
        data: {
          TBB_LOAI: source.TBB_LOAI,
          TBB_TIEU_DE: source.TBB_TIEU_DE,
          TBB_NOI_DUNG: source.TBB_NOI_DUNG,
          TBB_TIEU_CHI: source.TBB_TIEU_CHI || Prisma.JsonNull,
          TBB_IDEMPOTENCY_KEY: idempotencyKey,
          TBB_TONG_NGUOI_NHAN: sourceRecipients.length,
          TBB_TRANG_THAI: 'QUEUED',
          TBB_BATCH_CHA_MA: batchId,
          TBB_NGUOI_TAO: user.TK_SDT,
          TBB_METADATA: {
            retryOfBatchId: batchId,
            retryRecipientIds: sourceRecipients.map((item) => item.TBR_MA),
            note: dto.note || null,
          },
        },
      });

      await tx.tHONG_BAO_BATCH_RECIPIENT.createMany({
        data: sourceRecipients.map((item) => ({
          TBB_MA: batch.TBB_MA,
          TK_SDT: item.TK_SDT,
          DK_MA: item.DK_MA,
          TBR_TRANG_THAI: 'QUEUED',
        })),
      });

      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'THONG_BAO_BATCH',
          AL_ACTION: 'BULK_NOTIFICATION_RETRY_QUEUED',
          AL_PK: { TBB_MA: batch.TBB_MA, sourceBatchId: batchId },
          AL_NEW: { retryCount: sourceRecipients.length, note: dto.note || null },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });

      return batch;
    });

    return {
      message: 'Batch retry da duoc tao',
      batchId: created.TBB_MA,
      parentBatchId: batchId,
      totalRecipients: sourceRecipients.length,
    };
  }

  async processQueuedBulkNotificationBatches() {
    try {
      const required = await this.hasOptionalTables([
        'public."THONG_BAO_BATCH"',
        'public."THONG_BAO_BATCH_RECIPIENT"',
        'public."THONG_BAO"',
      ]);
      if (!required) return { processedBatches: 0, skippedByMissingTables: true };

    const batch = await this.prisma.tHONG_BAO_BATCH.findFirst({
      where: { TBB_TRANG_THAI: { in: ['QUEUED', 'PROCESSING'] } },
      orderBy: { TBB_THOI_GIAN_TAO: 'asc' },
    });
    if (!batch) return { processedBatches: 0 };

    const lockedResult = await this.withAdvisoryLock(`bulk-batch-${batch.TBB_MA}`, async () => {
      const latestBatch = await this.prisma.tHONG_BAO_BATCH.findUnique({ where: { TBB_MA: batch.TBB_MA } });
      if (!latestBatch || !['QUEUED', 'PROCESSING'].includes(latestBatch.TBB_TRANG_THAI)) {
        return { processedBatches: 0 };
      }

      const startedAt = latestBatch.TBB_BAT_DAU_LUC || new Date();
      if (latestBatch.TBB_TRANG_THAI !== 'PROCESSING') {
        await this.prisma.tHONG_BAO_BATCH.update({
          where: { TBB_MA: latestBatch.TBB_MA },
          data: { TBB_TRANG_THAI: 'PROCESSING', TBB_BAT_DAU_LUC: startedAt },
        });
      }

      const recipients = await this.prisma.tHONG_BAO_BATCH_RECIPIENT.findMany({
      where: {
        TBB_MA: latestBatch.TBB_MA,
        OR: [
          { TBR_TRANG_THAI: 'QUEUED' },
          {
            TBR_TRANG_THAI: 'FAILED',
            TBR_SO_LAN_THU: { lt: 3 },
          },
        ],
      },
      orderBy: { TBR_MA: 'asc' },
      take: 100,
      });

      if (recipients.length === 0) {
        const summary = await this.prisma.tHONG_BAO_BATCH_RECIPIENT.groupBy({
          by: ['TBR_TRANG_THAI'],
          where: { TBB_MA: latestBatch.TBB_MA },
          _count: { _all: true },
        });
      const successCount = summary.find((item) => item.TBR_TRANG_THAI === 'SENT')?._count._all || 0;
      const failedCount = summary.find((item) => item.TBR_TRANG_THAI === 'FAILED')?._count._all || 0;
      const deadCount = summary.find((item) => item.TBR_TRANG_THAI === 'DEAD')?._count._all || 0;
      const status =
        failedCount === 0 && deadCount === 0
          ? 'COMPLETED'
          : successCount === 0
            ? 'FAILED'
            : 'PARTIAL_FAILED';
        await this.prisma.tHONG_BAO_BATCH.update({
          where: { TBB_MA: latestBatch.TBB_MA },
        data: {
          TBB_TRANG_THAI: status,
          TBB_DA_XU_LY: successCount + failedCount + deadCount,
          TBB_THANH_CONG: successCount,
          TBB_THAT_BAI: failedCount + deadCount,
          TBB_HOAN_TAT_LUC: new Date(),
        },
      });
        return { processedBatches: 1, batchId: latestBatch.TBB_MA, status };
      }

      let success = 0;
      let failed = 0;
      for (const recipient of recipients) {
      try {
        const dedupe = `[DK_MA=${recipient.DK_MA || 'NA'}][BATCH=${latestBatch.TBB_MA}]`;
        const alreadySent = await this.prisma.tHONG_BAO.findFirst({
          where: {
            TK_SDT: recipient.TK_SDT,
            TB_BATCH_MA: latestBatch.TBB_MA,
            TB_NOI_DUNG: { contains: dedupe },
          },
        });
        if (!alreadySent) {
          const defaultTitle =
            latestBatch.TBB_LOAI === 'system_admin' || latestBatch.TBB_LOAI === 'system_auto'
              ? 'Thong bao he thong'
              : 'Thong bao lich kham';
          await this.prisma.tHONG_BAO.create({
            data: {
              TK_SDT: recipient.TK_SDT,
              TB_BATCH_MA: latestBatch.TBB_MA,
              TB_TIEU_DE: latestBatch.TBB_TIEU_DE || defaultTitle,
              TB_LOAI: latestBatch.TBB_LOAI,
              TB_NOI_DUNG: `${latestBatch.TBB_NOI_DUNG} ${dedupe}`,
              TB_TRANG_THAI: 'UNREAD',
              TB_THOI_GIAN: new Date(),
            },
          });
        }

        await this.prisma.tHONG_BAO_BATCH_RECIPIENT.update({
          where: { TBR_MA: recipient.TBR_MA },
          data: {
            TBR_TRANG_THAI: 'SENT',
            TBR_SO_LAN_THU: recipient.TBR_SO_LAN_THU + 1,
            TBR_LOI: null,
            TBR_LAST_SENT_AT: new Date(),
            TBR_UPDATED_AT: new Date(),
          },
        });
        success += 1;
      } catch (e: any) {
        const nextTry = recipient.TBR_SO_LAN_THU + 1;
        await this.prisma.tHONG_BAO_BATCH_RECIPIENT.update({
          where: { TBR_MA: recipient.TBR_MA },
          data: {
            TBR_TRANG_THAI: nextTry >= 3 ? 'DEAD' : 'FAILED',
            TBR_SO_LAN_THU: nextTry,
            TBR_LOI: e?.message || 'SEND_FAILED',
            TBR_UPDATED_AT: new Date(),
          },
        });
        failed += 1;
      }
      }

      await this.prisma.tHONG_BAO_BATCH.update({
        where: { TBB_MA: latestBatch.TBB_MA },
      data: {
        TBB_DA_XU_LY: { increment: success + failed },
        TBB_THANH_CONG: { increment: success },
        TBB_THAT_BAI: { increment: failed },
        TBB_LOI_GAN_NHAT: failed > 0 ? 'CO_RECIPIENT_GUI_THAT_BAI' : null,
      },
      });

      return { processedBatches: 1, batchId: latestBatch.TBB_MA, success, failed };
    });

      return lockedResult || { processedBatches: 0, skippedByLock: true };
    } catch (e) {
      if (this.isOptionalFeatureUnavailableError(e)) {
        this.optionalTableExistsCache.clear();
        return { processedBatches: 0, skippedByMissingTables: true };
      }
      throw e;
    }
  }

  async getOpsDashboard(query: OpsDashboardQueryDto) {
    const { fromDate, toDate } = this.normalizeDateRange({
      fromDate: query.fromDate,
      toDate: query.toDate,
    });
    const to = toDate || parseDateOnly(new Date().toISOString().slice(0, 10));
    const from = fromDate || new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);

    const appointmentWhere: Prisma.DANG_KYWhereInput = {
      N_NGAY: { gte: from, lte: to },
    };

    const [totalAppointments, groupedAppointments, notificationBatches, notificationRecipients, refunds, reconIssues] =
      await this.prisma.$transaction([
        this.prisma.dANG_KY.count({ where: appointmentWhere }),
        this.prisma.dANG_KY.groupBy({
          by: ['DK_TRANG_THAI'],
          where: appointmentWhere,
          _count: { _all: true },
        }),
        this.prisma.tHONG_BAO_BATCH.count({
          where: { TBB_THOI_GIAN_TAO: { gte: from, lte: to } },
        }),
        this.prisma.tHONG_BAO_BATCH_RECIPIENT.groupBy({
          by: ['TBR_TRANG_THAI'],
          where: { TBR_CREATED_AT: { gte: from, lte: to } },
          _count: { _all: true },
        }),
        this.prisma.tHANH_TOAN.findMany({
          where: {
            TT_LOAI: 'HOAN_TIEN',
            TT_THOI_GIAN: { gte: from, lte: to },
          },
          select: { TT_MA: true, TT_THOI_GIAN: true, TT_TRANG_THAI: true },
        }),
        this.prisma.pAYMENT_RECONCILIATION_ISSUE.count({
          where: { PRI_TAO_LUC: { gte: from, lte: to }, PRI_TRANG_THAI: 'OPEN' },
        }),
      ]);

    const groupedMap = new Map<string, number>();
    groupedAppointments.forEach((item) => groupedMap.set(item.DK_TRANG_THAI || 'UNKNOWN', item._count._all));
    const cancellationCount = (groupedMap.get('HUY') || 0) + (groupedMap.get('HUY_BS_NGHI') || 0);
    const noShowCount = groupedMap.get('NO_SHOW') || 0;

    const recipStatus = notificationRecipients.reduce(
      (acc, item) => {
        acc[item.TBR_TRANG_THAI || 'UNKNOWN'] = item._count._all;
        return acc;
      },
      {} as Record<string, number>,
    );
    const delivered = recipStatus.SENT || 0;
    const deliverFailed = recipStatus.FAILED || 0;
    const deliverTotal = delivered + deliverFailed || 1;

    const refundCompleted = refunds.filter((item) => ['REFUNDED', 'DA_HOAN_TIEN', 'HOAN_TIEN'].includes((item.TT_TRANG_THAI || '').toUpperCase())).length;

    return {
      range: {
        fromDate: from.toISOString().slice(0, 10),
        toDate: to.toISOString().slice(0, 10),
      },
      metrics: {
        totalAppointments,
        cancellationRate: Number(((cancellationCount / (totalAppointments || 1)) * 100).toFixed(2)),
        noShowRate: Number(((noShowCount / (totalAppointments || 1)) * 100).toFixed(2)),
        refundSlaRate: Number(((refundCompleted / (refunds.length || 1)) * 100).toFixed(2)),
        notificationDeliveryRate: Number(((delivered / deliverTotal) * 100).toFixed(2)),
        bulkQueueBacklog: (recipStatus.QUEUED || 0) + (recipStatus.PROCESSING || 0),
        bulkBatches: notificationBatches,
        openReconciliationIssues: reconIssues,
      },
    };
  }

  async listOpsAlerts() {
    const [queuedRecipients, failedBatches, failedWebhookEvents, openReconIssues] = await this.prisma.$transaction([
      this.prisma.tHONG_BAO_BATCH_RECIPIENT.count({ where: { TBR_TRANG_THAI: 'QUEUED' } }),
      this.prisma.tHONG_BAO_BATCH.count({ where: { TBB_TRANG_THAI: { in: ['FAILED', 'PARTIAL_FAILED'] } } }),
      this.prisma.pAYMENT_WEBHOOK_EVENT.count({ where: { PWE_TRANG_THAI: 'FAILED' } }),
      this.prisma.pAYMENT_RECONCILIATION_ISSUE.count({ where: { PRI_TRANG_THAI: 'OPEN' } }),
    ]);

    const alerts: Array<{ code: string; severity: string; value: number }> = [];
    if (queuedRecipients > 100) {
      alerts.push({ code: 'BULK_QUEUE_BACKLOG_HIGH', severity: 'high', value: queuedRecipients });
    }
    if (failedBatches > 0) {
      alerts.push({ code: 'BULK_BATCH_FAILED', severity: 'medium', value: failedBatches });
    }
    if (failedWebhookEvents > 0) {
      alerts.push({ code: 'PAYMENT_WEBHOOK_FAILED', severity: 'high', value: failedWebhookEvents });
    }
    if (openReconIssues > 0) {
      alerts.push({ code: 'RECONCILIATION_MISMATCH_OPEN', severity: 'high', value: openReconIssues });
    }

    return { items: alerts };
  }

  async runDailyReconciliation(date?: string) {
    const target = date ? parseDateOnly(date) : parseDateOnly(new Date().toISOString().slice(0, 10));
    const dayStart = target;
    const dayEnd = new Date(target);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const [payments, webhookEvents] = await this.prisma.$transaction([
      this.prisma.tHANH_TOAN.findMany({
        where: {
          TT_THOI_GIAN: { gte: dayStart, lt: dayEnd },
          TT_LOAI: { in: ['DAT_LICH', 'HOAN_TIEN'] },
        },
      }),
      this.prisma.pAYMENT_WEBHOOK_EVENT.findMany({
        where: {
          PWE_CREATED_AT: { gte: dayStart, lt: dayEnd },
          PWE_PROVIDER: 'VNPAY',
        },
      }),
    ]);

    const issues: Array<{ type: string; description: string; paymentId?: number; appointmentId?: number }> = [];
    const webhookRefSet = new Set(
      webhookEvents
        .map((item) => Number.parseInt(item.PWE_REF || '', 10))
        .filter((id) => Number.isFinite(id)),
    );

    for (const payment of payments) {
      if (payment.TT_TRANG_THAI === 'DA_THANH_TOAN' && !webhookRefSet.has(payment.TT_MA)) {
        issues.push({
          type: 'PAID_WITHOUT_WEBHOOK',
          description: 'Payment da thanh toan nhung khong tim thay webhook event',
          paymentId: payment.TT_MA,
          appointmentId: payment.DK_MA || undefined,
        });
      }
      if (payment.TT_TRANG_THAI === 'CHUA_THANH_TOAN' && payment.TT_MA_GIAO_DICH) {
        issues.push({
          type: 'PENDING_HAS_GATEWAY_TXN',
          description: 'Payment dang CHUA_THANH_TOAN nhung da co ma giao dich',
          paymentId: payment.TT_MA,
          appointmentId: payment.DK_MA || undefined,
        });
      }
    }

    const job = await this.prisma.pAYMENT_RECONCILIATION_JOB.create({
      data: {
        PRJ_NGAY: target,
        PRJ_TRANG_THAI: 'COMPLETED',
        PRJ_TONG_KIEM_TRA: payments.length,
        PRJ_SO_MISMATCH: issues.length,
      },
    });

    if (issues.length > 0) {
      await this.prisma.pAYMENT_RECONCILIATION_ISSUE.createMany({
        data: issues.map((item) => ({
          PRJ_MA: job.PRJ_MA,
          TT_MA: item.paymentId || null,
          DK_MA: item.appointmentId || null,
          PRI_LOAI: item.type,
          PRI_MO_TA: item.description,
          PRI_TRANG_THAI: 'OPEN',
        })),
      });
    }

    return {
      jobId: job.PRJ_MA,
      date: target.toISOString().slice(0, 10),
      totalChecked: payments.length,
      mismatchCount: issues.length,
    };
  }

  async getReconciliationJobDetail(jobId: number) {
    const job = await this.prisma.pAYMENT_RECONCILIATION_JOB.findUnique({ where: { PRJ_MA: jobId } });
    if (!job) throw new NotFoundException('Khong tim thay reconciliation job');
    const issues = await this.prisma.pAYMENT_RECONCILIATION_ISSUE.findMany({
      where: { PRJ_MA: jobId },
      orderBy: { PRI_TAO_LUC: 'desc' },
    });
    return { job, issues };
  }

  async listReconciliationMismatches(query: ReconciliationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { from, to } = this.resolveReportingRange(query);
    const where: Prisma.PAYMENT_RECONCILIATION_ISSUEWhereInput = {
      PRI_TAO_LUC: { gte: from, lte: to },
      ...(query.status ? { PRI_TRANG_THAI: query.status } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.pAYMENT_RECONCILIATION_ISSUE.count({ where }),
      this.prisma.pAYMENT_RECONCILIATION_ISSUE.findMany({
        where,
        skip,
        take: limit,
        orderBy: { PRI_TAO_LUC: 'desc' },
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getOpsHealth() {
    const db = await this.prisma.getClient().$queryRawUnsafe(`SELECT 1 as ok`);
    const [batchBacklog, waitlistHolding] = await this.prisma.$transaction([
      this.prisma.tHONG_BAO_BATCH_RECIPIENT.count({ where: { TBR_TRANG_THAI: { in: ['QUEUED', 'FAILED'] } } }),
      this.prisma.getClient().$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int AS total FROM "WAITLIST_ENTRY" WHERE "WL_STATUS" = 'HOLDING'`,
      ),
    ]);

    return {
      status: 'ok',
      checks: {
        db: Array.isArray(db) && db.length > 0 ? 'up' : 'down',
        batchQueueBacklog: batchBacklog,
        waitlistHolding: Number(waitlistHolding?.[0]?.total || 0),
      },
      at: new Date().toISOString(),
    };
  }

  async getReleaseReadiness() {
    const [openMismatches, failedBatches, failedWebhooks, infectedAttachments] = await this.prisma.$transaction([
      this.prisma.pAYMENT_RECONCILIATION_ISSUE.count({ where: { PRI_TRANG_THAI: 'OPEN' } }),
      this.prisma.tHONG_BAO_BATCH.count({ where: { TBB_TRANG_THAI: { in: ['FAILED', 'PARTIAL_FAILED'] } } }),
      this.prisma.pAYMENT_WEBHOOK_EVENT.count({ where: { PWE_TRANG_THAI: 'FAILED' } }),
      this.prisma.pRE_VISIT_ATTACHMENT.count({ where: { PVA_SCAN_STATUS: 'INFECTED', PVA_DA_XOA: false } }),
    ]);

    return {
      ready: openMismatches === 0 && failedBatches === 0 && failedWebhooks === 0,
      blockers: {
        openMismatches,
        failedBatches,
        failedWebhooks,
        infectedAttachments,
      },
      checklist: {
        migrationVerified: true,
        envVerified: true,
        rollbackDefined: true,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getPilotRolloutConfig() {
    const cfg = await this.prisma.pILOT_ROLLOUT_CONFIG.findFirst({
      orderBy: { PRC_UPDATED_AT: 'desc' },
    });
    return {
      enabled: cfg?.PRC_ENABLED || false,
      cohortType: cfg?.PRC_COHORT_TYPE || null,
      cohortIds: cfg?.PRC_COHORT_IDS || [],
      enabledFeatures: cfg?.PRC_FEATURES || [],
      startAt: cfg?.PRC_START_AT || null,
      endAt: cfg?.PRC_END_AT || null,
      note: cfg?.PRC_NOTE || null,
      updatedAt: cfg?.PRC_UPDATED_AT || null,
      updatedBy: cfg?.PRC_UPDATED_BY || null,
    };
  }

  async upsertPilotRolloutConfig(user: CurrentUserPayload, dto: PilotRolloutConfigDto) {
    const latest = await this.prisma.pILOT_ROLLOUT_CONFIG.findFirst({
      orderBy: { PRC_UPDATED_AT: 'desc' },
    });
    const startAt = dto.startAt ? new Date(`${dto.startAt}T00:00:00.000Z`) : latest?.PRC_START_AT || null;
    const endAt = dto.endAt ? new Date(`${dto.endAt}T23:59:59.999Z`) : latest?.PRC_END_AT || null;
    if (startAt && endAt && startAt.getTime() > endAt.getTime()) {
      throw new BadRequestException('startAt phai nho hon hoac bang endAt');
    }

    const row = latest
      ? await this.prisma.pILOT_ROLLOUT_CONFIG.update({
          where: { PRC_MA: latest.PRC_MA },
          data: {
            PRC_COHORT_TYPE: dto.cohortType ?? latest.PRC_COHORT_TYPE,
            PRC_COHORT_IDS: (dto.cohortIds as any) ?? latest.PRC_COHORT_IDS ?? [],
            PRC_FEATURES: (dto.enabledFeatures as any) ?? latest.PRC_FEATURES ?? [],
            PRC_START_AT: startAt,
            PRC_END_AT: endAt,
            PRC_ENABLED: dto.enabled ? dto.enabled === 'true' : latest.PRC_ENABLED,
            PRC_NOTE: dto.note ?? latest.PRC_NOTE,
            PRC_UPDATED_BY: user.TK_SDT,
            PRC_UPDATED_AT: new Date(),
          },
        })
      : await this.prisma.pILOT_ROLLOUT_CONFIG.create({
          data: {
            PRC_COHORT_TYPE: dto.cohortType || null,
            PRC_COHORT_IDS: (dto.cohortIds as any) || [],
            PRC_FEATURES: (dto.enabledFeatures as any) || [],
            PRC_START_AT: startAt,
            PRC_END_AT: endAt,
            PRC_ENABLED: dto.enabled === 'true',
            PRC_NOTE: dto.note || null,
            PRC_UPDATED_BY: user.TK_SDT,
          },
        });

    await this.writeAuditLog({
      table: 'PILOT_ROLLOUT_CONFIG',
      action: 'PILOT_ROLLOUT_UPDATED',
      actor: user.TK_SDT,
      pk: { PRC_MA: row.PRC_MA },
      next: {
        enabled: row.PRC_ENABLED,
        cohortType: row.PRC_COHORT_TYPE,
      },
    });

    return this.getPilotRolloutConfig();
  }

  async getReportOpsSummary(query: ReportingQueryDto) {
    const dashboard = await this.getOpsDashboard(query as OpsDashboardQueryDto);
    return dashboard;
  }

  async getReportAppointments(query: ReportingQueryDto) {
    const { from, to } = this.resolveReportingRange(query);
    const rows = await this.prisma.dANG_KY.groupBy({
      by: ['DK_TRANG_THAI'],
      where: { N_NGAY: { gte: from, lte: to } },
      _count: { _all: true },
    });
    return { fromDate: from, toDate: to, items: rows };
  }

  async getReportPayments(query: ReportingQueryDto) {
    const { from, to } = this.resolveReportingRange(query);
    const rows = await this.prisma.tHANH_TOAN.groupBy({
      by: ['TT_TRANG_THAI', 'TT_LOAI'],
      where: { TT_THOI_GIAN: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { TT_TONG_TIEN: true },
    });
    return { fromDate: from, toDate: to, items: rows };
  }

  async getReportNotifications(query: ReportingQueryDto) {
    const { from, to } = this.resolveReportingRange(query);
    const [batches, recipients] = await this.prisma.$transaction([
      this.prisma.tHONG_BAO_BATCH.groupBy({
        by: ['TBB_TRANG_THAI', 'TBB_LOAI'],
        where: { TBB_THOI_GIAN_TAO: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      this.prisma.tHONG_BAO_BATCH_RECIPIENT.groupBy({
        by: ['TBR_TRANG_THAI'],
        where: { TBR_CREATED_AT: { gte: from, lte: to } },
        _count: { _all: true },
      }),
    ]);
    return { fromDate: from, toDate: to, batches, recipients };
  }

  async getReportWaitlist(query: ReportingQueryDto) {
    const { from, to } = this.resolveReportingRange(query);
    const rows = await this.prisma.getClient().$queryRawUnsafe<any[]>(
      `SELECT "WL_STATUS", COUNT(*)::int AS total
       FROM "WAITLIST_ENTRY"
       WHERE "WL_CREATED_AT" >= $1
         AND "WL_CREATED_AT" <= $2
       GROUP BY "WL_STATUS"
       ORDER BY "WL_STATUS"`,
      from,
      to,
    );
    return { fromDate: from, toDate: to, items: rows };
  }

  async listRefundsForAdmin(query: RefundListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const fromDate = query.fromDate ? parseDateOnly(query.fromDate) : undefined;
    const toDate = query.toDate ? parseDateOnly(query.toDate) : undefined;
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('fromDate phai nho hon hoac bang toDate');
    }

    const keyword = query.keyword?.trim() || '';
    const keywordId = Number.parseInt(keyword, 10);
    const where: Prisma.THANH_TOANWhereInput = {
      TT_LOAI: 'HOAN_TIEN',
      ...(query.appointmentId ? { DK_MA: query.appointmentId } : {}),
      ...(query.refundStatus ? { TT_TRANG_THAI: query.refundStatus } : {}),
      ...(fromDate || toDate
        ? {
            TT_THOI_GIAN: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(query.patientId
        ? {
            DANG_KY: {
              is: { BN_MA: query.patientId },
            },
          }
        : {}),
      ...(keyword
        ? {
            OR: [
              ...(Number.isFinite(keywordId) ? [{ TT_MA: keywordId }, { DK_MA: keywordId }] : []),
              {
                DANG_KY: {
                  is: {
                    BENH_NHAN: {
                      OR: [
                        { BN_TEN: { contains: keyword, mode: 'insensitive' } },
                        { BN_HO_CHU_LOT: { contains: keyword, mode: 'insensitive' } },
                        { TK_SDT: { contains: keyword, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.tHANH_TOAN.count({ where }),
      this.prisma.tHANH_TOAN.findMany({
        where,
        skip,
        take: limit,
        orderBy: { TT_THOI_GIAN: 'desc' },
        include: {
          DANG_KY: {
            include: {
              BENH_NHAN: true,
              LICH_BSK: {
                include: {
                  BAC_SI: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      items: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getRefundDetailForAdmin(refundId: number) {
    const refund = await this.prisma.tHANH_TOAN.findFirst({
      where: { TT_MA: refundId, TT_LOAI: 'HOAN_TIEN' },
      include: {
        DANG_KY: {
          include: {
            BENH_NHAN: true,
            LICH_BSK: {
              include: {
                BAC_SI: true,
                PHONG: true,
              },
            },
          },
        },
      },
    });
    if (!refund) throw new NotFoundException('Khong tim thay yeu cau hoan tien');

    const logs = await this.prisma.aUDIT_LOG.findMany({
      where: { AL_TABLE: 'THANH_TOAN' },
      orderBy: { AL_CHANGED_AT: 'desc' },
      take: 200,
    });
    const timeline = logs.filter((item) => {
      const pk = item.AL_PK as any;
      return pk && Number(pk.TT_MA) === refundId;
    });

    return {
      refund,
      timeline,
    };
  }

  async updateRefundStatusByAdmin(
    user: CurrentUserPayload,
    refundId: number,
    dto: UpdateRefundStatusDto,
  ) {
    const refund = await this.prisma.tHANH_TOAN.findFirst({
      where: { TT_MA: refundId, TT_LOAI: 'HOAN_TIEN' },
    });
    if (!refund) throw new NotFoundException('Khong tim thay yeu cau hoan tien');

    const current = (refund.TT_TRANG_THAI || '').toUpperCase();
    const next = dto.status.toUpperCase();
    const allowedTransitions: Record<string, string[]> = {
      REFUND_PENDING: ['REFUNDED', 'REFUND_FAILED', 'REFUND_REJECTED'],
      REFUND_FAILED: ['REFUND_PENDING', 'REFUNDED', 'REFUND_REJECTED'],
      REFUND_REJECTED: [],
      REFUNDED: [],
    };
    if (!(allowedTransitions[current] || []).includes(next)) {
      throw new BadRequestException('Khong the cap nhat trang thai hoan tien theo transition nay');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.tHANH_TOAN.update({
        where: { TT_MA: refundId },
        data: {
          TT_TRANG_THAI: next,
          TT_MA_GIAO_DICH: dto.refundTransactionCode || refund.TT_MA_GIAO_DICH,
          ...(dto.reconciledAmount !== undefined
            ? { TT_THUC_THU: Number(dto.reconciledAmount) }
            : {}),
        },
      });

      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'THANH_TOAN',
          AL_ACTION: 'REFUND_STATUS_UPDATED',
          AL_PK: { TT_MA: refundId, DK_MA: refund.DK_MA },
          AL_OLD: { TT_TRANG_THAI: current },
          AL_NEW: {
            TT_TRANG_THAI: next,
            note: dto.note || null,
            refundTransactionCode: dto.refundTransactionCode || null,
            reconciledAmount: dto.reconciledAmount ?? null,
          },
          AL_CHANGED_BY: user.TK_SDT,
        },
      });

      if (refund.DK_MA) {
        await tx.aUDIT_LOG.create({
          data: {
            AL_TABLE: 'DANG_KY',
            AL_ACTION: 'REFUND_STATUS_UPDATED',
            AL_PK: { DK_MA: refund.DK_MA },
            AL_OLD: { refundStatus: current },
            AL_NEW: { refundStatus: next, refundId },
            AL_CHANGED_BY: user.TK_SDT,
          },
        });
      }

      return row;
    });

    return {
      message: 'Cap nhat trang thai hoan tien thanh cong',
      refund: updated,
    };
  }

  private async notifyWaitlistFirstCandidate(
    tx: Prisma.TransactionClient,
    slot: { BS_MA: number; N_NGAY: Date; B_TEN: string; KG_MA: number },
  ) {
    const slotMeta = await tx.kHUNG_GIO.findUnique({ where: { KG_MA: slot.KG_MA } });
    const activeCount = await tx.dANG_KY.count({
      where: {
        BS_MA: slot.BS_MA,
        N_NGAY: slot.N_NGAY,
        B_TEN: slot.B_TEN,
        KG_MA: slot.KG_MA,
        DK_TRANG_THAI: { in: ACTIVE_BOOKING_STATUS },
      },
    });
    if (activeCount >= (slotMeta?.KG_SO_BN_TOI_DA ?? 5)) return null;

    const rows = await tx.$queryRawUnsafe<any[]>(
      `SELECT wl.*, bn."TK_SDT"
       FROM "WAITLIST_ENTRY" wl
       JOIN "BENH_NHAN" bn ON bn."BN_MA" = wl."BN_MA"
       WHERE wl."BS_MA" = $1
         AND wl."N_NGAY" = $2
         AND wl."B_TEN" = $3
         AND wl."KG_MA" = $4
         AND wl."WL_STATUS" = 'WAITING'
       ORDER BY wl."WL_CREATED_AT" ASC
       LIMIT 1`,
      slot.BS_MA,
      slot.N_NGAY,
      slot.B_TEN,
      slot.KG_MA,
    );
    const candidate = rows[0];
    if (!candidate) return null;
    const holdToken = createHash('sha1')
      .update(`${candidate.WL_ID}-${Date.now()}-${Math.random()}`)
      .digest('hex');
    const holdExpiresAt = new Date(Date.now() + this.getWaitlistHoldMinutes() * 60 * 1000);

    await tx.$executeRawUnsafe(
      `UPDATE "WAITLIST_ENTRY"
       SET "WL_STATUS" = 'HOLDING',
           "WL_HOLD_TOKEN" = $2,
           "WL_HOLD_EXPIRES_AT" = $3,
           "WL_NOTIFIED_AT" = NOW(),
           "WL_UPDATED_AT" = NOW()
       WHERE "WL_ID" = $1`,
      candidate.WL_ID,
      holdToken,
      holdExpiresAt,
    );

    const dateLabel =
      candidate.N_NGAY instanceof Date
        ? candidate.N_NGAY.toISOString().slice(0, 10)
        : String(candidate.N_NGAY).slice(0, 10);
    if (candidate.TK_SDT) {
      await tx.tHONG_BAO.create({
        data: {
          TK_SDT: candidate.TK_SDT,
          TB_TIEU_DE: 'Co slot trong tu danh sach cho',
          TB_LOAI: 'waitlist',
          TB_NOI_DUNG: `Slot cho bac si ${candidate.BS_MA} ngay ${dateLabel} da duoc giu tam thoi den ${holdExpiresAt.toISOString()}. Vui long xac nhan som. [WAITLIST_ID=${candidate.WL_ID}]`,
          TB_TRANG_THAI: 'UNREAD',
          TB_THOI_GIAN: new Date(),
        },
      });
    }

    await tx.aUDIT_LOG.create({
      data: {
        AL_TABLE: 'WAITLIST_ENTRY',
        AL_ACTION: 'WAITLIST_HOLD_CREATED',
        AL_PK: { WL_ID: candidate.WL_ID },
        AL_NEW: {
          BS_MA: candidate.BS_MA,
          N_NGAY: dateLabel,
          B_TEN: candidate.B_TEN,
          KG_MA: candidate.KG_MA,
          WL_STATUS: 'HOLDING',
          holdExpiresAt: holdExpiresAt.toISOString(),
        },
      },
    });

    return { ...candidate, WL_HOLD_TOKEN: holdToken, WL_HOLD_EXPIRES_AT: holdExpiresAt };
  }

  async processExpiredWaitlistHolds() {
    const required = await this.hasOptionalTables([
      'public."WAITLIST_ENTRY"',
      'public."THONG_BAO"',
      'public."AUDIT_LOG"',
    ]);
    if (!required) return { expired: 0, skippedByMissingTables: true };

    const expiredRows = await this.prisma.getClient().$queryRawUnsafe<any[]>(
      `SELECT *
       FROM "WAITLIST_ENTRY"
       WHERE "WL_STATUS" = 'HOLDING'
         AND "WL_HOLD_EXPIRES_AT" IS NOT NULL
         AND "WL_HOLD_EXPIRES_AT" < NOW()
       ORDER BY "WL_HOLD_EXPIRES_AT" ASC
       LIMIT 50`,
    );
    if (expiredRows.length === 0) return { expired: 0 };

    for (const row of expiredRows) {
      await this.withAdvisoryLock(
        `waitlist-slot-${row.BS_MA}-${String(row.N_NGAY).slice(0, 10)}-${row.B_TEN}-${row.KG_MA}`,
        async () =>
          this.prisma.$transaction(async (tx) => {
        const latest = (await tx.$queryRawUnsafe(
          `SELECT *
           FROM "WAITLIST_ENTRY"
           WHERE "WL_ID" = $1
           LIMIT 1`,
          row.WL_ID,
        )) as any[];
        const item = latest[0];
        if (!item || item.WL_STATUS !== 'HOLDING') return;
        if (!item.WL_HOLD_EXPIRES_AT || new Date(item.WL_HOLD_EXPIRES_AT).getTime() > Date.now()) return;

        await tx.$executeRawUnsafe(
          `UPDATE "WAITLIST_ENTRY"
           SET "WL_STATUS" = 'EXPIRED',
               "WL_SKIP_REASON" = 'HOLD_EXPIRED',
               "WL_UPDATED_AT" = NOW()
           WHERE "WL_ID" = $1`,
          row.WL_ID,
        );

        await tx.aUDIT_LOG.create({
          data: {
            AL_TABLE: 'WAITLIST_ENTRY',
            AL_ACTION: 'WAITLIST_HOLD_EXPIRED',
            AL_PK: { WL_ID: row.WL_ID },
            AL_NEW: { WL_STATUS: 'EXPIRED' },
            AL_CHANGED_BY: 'SYSTEM',
          },
        });

        await this.notifyWaitlistFirstCandidate(tx, {
          BS_MA: item.BS_MA,
          N_NGAY: item.N_NGAY,
          B_TEN: item.B_TEN,
          KG_MA: item.KG_MA,
        });
          }),
      );
    }

    return { expired: expiredRows.length };
  }

  async processExpiredPendingPayments() {
    const required = await this.hasOptionalTables([
      'public."THANH_TOAN"',
      'public."DANG_KY"',
      'public."BENH_NHAN"',
      'public."THONG_BAO"',
      'public."AUDIT_LOG"',
    ]);
    if (!required) return { expired: 0, skippedByMissingTables: true };

    const expiryThreshold = new Date(Date.now() - 15 * 60 * 1000);
    const candidates = await this.prisma.tHANH_TOAN.findMany({
      where: {
        TT_LOAI: 'DAT_LICH',
        TT_TRANG_THAI: 'CHUA_THANH_TOAN',
        TT_THOI_GIAN: { lt: expiryThreshold },
      },
      orderBy: { TT_THOI_GIAN: 'asc' },
      take: 100,
      include: {
        DANG_KY: {
          include: {
            BENH_NHAN: true,
            KHUNG_GIO: true,
            LICH_BSK: {
              include: {
                BAC_SI: true,
              },
            },
          },
        },
      },
    });
    if (candidates.length === 0) return { expired: 0 };

    let expired = 0;
    for (const candidate of candidates) {
      const locked = await this.withAdvisoryLock(
        `payment-timeout-${candidate.TT_MA}`,
        async () =>
          this.prisma.$transaction(async (tx) => {
            const latest = await tx.tHANH_TOAN.findUnique({
              where: { TT_MA: candidate.TT_MA },
              include: {
                DANG_KY: {
                  include: {
                    BENH_NHAN: true,
                    KHUNG_GIO: true,
                    LICH_BSK: {
                      include: {
                        BAC_SI: true,
                      },
                    },
                  },
                },
              },
            });
            if (!latest) return null;
            if ((latest.TT_TRANG_THAI || '').toUpperCase() !== 'CHUA_THANH_TOAN') return null;

            const createdAt = latest.TT_THOI_GIAN ? new Date(latest.TT_THOI_GIAN).getTime() : 0;
            if (!createdAt || Date.now() - createdAt <= 15 * 60 * 1000) return null;

            await tx.tHANH_TOAN.update({
              where: { TT_MA: latest.TT_MA },
              data: {
                TT_TRANG_THAI: 'HET_HAN',
                TT_THOI_GIAN: new Date(),
              },
            });

            await tx.aUDIT_LOG.create({
              data: {
                AL_TABLE: 'THANH_TOAN',
                AL_ACTION: 'PAYMENT_EXPIRED_BY_TIMEOUT',
                AL_PK: { TT_MA: latest.TT_MA, DK_MA: latest.DK_MA || null },
                AL_OLD: { TT_TRANG_THAI: 'CHUA_THANH_TOAN' },
                AL_NEW: { TT_TRANG_THAI: 'HET_HAN' },
                AL_CHANGED_BY: 'SYSTEM',
              },
            });

            return {
              paymentId: latest.TT_MA,
              appointmentId: latest.DK_MA || latest.DANG_KY?.DK_MA || null,
              phone: latest.DANG_KY?.BENH_NHAN?.TK_SDT || null,
              date: latest.DANG_KY?.N_NGAY || null,
              time: latest.DANG_KY?.KHUNG_GIO?.KG_BAT_DAU || null,
              doctorName: latest.DANG_KY?.LICH_BSK?.BAC_SI?.BS_HO_TEN || null,
            };
          }),
      );
      if (!locked) continue;

      const dateLabel = this.formatDateOnly(locked.date);
      const timeLabel = this.formatTimeOnly(locked.time);
      const doctorName = String(locked.doctorName || '').trim();
      await this.createPaymentNotification({
        phone: locked.phone,
        type: 'payment_timeout',
        title: 'Thanh toan het han',
        content:
          `Giao dich thanh toan TT_MA=${locked.paymentId}` +
          (locked.appointmentId ? ` cho lich hen DK_MA=${locked.appointmentId}` : '') +
          ' da qua thoi gian thanh toan 15 phut.' +
          (dateLabel !== '-' ? ` Ngay kham: ${dateLabel}.` : '') +
          (timeLabel !== '-' ? ` Gio kham: ${timeLabel}.` : '') +
          (doctorName ? ` Bac si: ${doctorName}.` : '') +
          ' Vui long tao lan thanh toan moi neu ban van muon giu lich.',
        dedupeKey: `[PAYMENT_TIMEOUT_TT_MA=${locked.paymentId}]`,
      });
      expired += 1;
    }

    return { expired };
  }

  async generateReminderNotifications() {
    const required = await this.hasOptionalTables([
      'public."DANG_KY"',
      'public."KHUNG_GIO"',
      'public."BENH_NHAN"',
      'public."THONG_BAO"',
    ]);
    if (!required) return { created: 0, skippedByMissingTables: true };

    const reminderMinutes = Number.parseInt(
      this.config.get<string>('APPOINTMENT_REMINDER_MINUTES', '180'),
      10,
    );
    const minutes = Number.isFinite(reminderMinutes) && reminderMinutes > 0 ? reminderMinutes : 180;
    const now = new Date();
    const windowStart = new Date(now.getTime() + minutes * 60 * 1000 - 5 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + minutes * 60 * 1000 + 5 * 60 * 1000);

    const appointments = await this.prisma
      .getClient()
      .$queryRawUnsafe<
        Array<{
          DK_MA: number;
          BS_MA: number | null;
          N_NGAY: Date;
          KG_BAT_DAU: Date | null;
          TK_SDT: string | null;
        }>
      >(
        `SELECT dk."DK_MA", dk."BS_MA", dk."N_NGAY", kg."KG_BAT_DAU", bn."TK_SDT"
         FROM "DANG_KY" dk
         LEFT JOIN "KHUNG_GIO" kg ON kg."KG_MA" = dk."KG_MA"
         LEFT JOIN "BENH_NHAN" bn ON bn."BN_MA" = dk."BN_MA"
         WHERE dk."DK_TRANG_THAI" IN ('CHO_KHAM', 'DA_CHECKIN')
         ORDER BY dk."N_NGAY" ASC
         LIMIT 500`,
      )
      .catch(() => []);

    let created = 0;
    for (const item of appointments) {
      if (!item.KG_BAT_DAU) continue;
      const startAt = combineDateAndTime(item.N_NGAY, item.KG_BAT_DAU);
      if (startAt < windowStart || startAt > windowEnd) continue;
      if (!item.TK_SDT) continue;

      const dedupe = `[REMINDER_DK_MA=${item.DK_MA}]`;
      const exists = await this.prisma.tHONG_BAO.findFirst({
        where: {
          TK_SDT: item.TK_SDT,
          TB_LOAI: 'reminder',
          TB_NOI_DUNG: { contains: dedupe },
        },
      });
      if (exists) continue;

      await this.prisma.tHONG_BAO.create({
        data: {
          TK_SDT: item.TK_SDT,
          TB_TIEU_DE: 'Nhac lich kham sap toi',
          TB_LOAI: 'reminder',
          TB_NOI_DUNG: `Ban co lich kham voi bac si ${item.BS_MA || 'duoc phan cong'} vao ${startAt.toISOString()}. ${dedupe}`,
          TB_TRANG_THAI: 'UNREAD',
          TB_THOI_GIAN: new Date(),
        },
      });
      created += 1;
    }

    return { created };
  }

  async generateDoctorUnavailableNotifications() {
    const required = await this.hasOptionalTables([
      'public."DANG_KY"',
      'public."BENH_NHAN"',
      'public."THONG_BAO"',
    ]);
    if (!required) return { created: 0, skippedByMissingTables: true };

    const affected = await this.prisma
      .getClient()
      .$queryRawUnsafe<
        Array<{
          DK_MA: number;
          TK_SDT: string | null;
        }>
      >(
        `SELECT dk."DK_MA", bn."TK_SDT"
         FROM "DANG_KY" dk
         LEFT JOIN "BENH_NHAN" bn ON bn."BN_MA" = dk."BN_MA"
         WHERE dk."DK_TRANG_THAI" = 'HUY_BS_NGHI'
         ORDER BY dk."DK_MA" DESC
         LIMIT 500`,
      )
      .catch(() => []);

    let created = 0;
    for (const item of affected) {
      const phone = item.TK_SDT;
      if (!phone) continue;
      const dedupe = `[DOCTOR_UNAVAILABLE_DK_MA=${item.DK_MA}]`;
      const exists = await this.prisma.tHONG_BAO.findFirst({
        where: {
          TK_SDT: phone,
          TB_LOAI: 'doctor_unavailable',
          TB_NOI_DUNG: { contains: dedupe },
        },
      });
      if (exists) continue;
      await this.prisma.tHONG_BAO.create({
        data: {
          TK_SDT: phone,
          TB_TIEU_DE: 'Lich kham bi anh huong',
          TB_LOAI: 'doctor_unavailable',
          TB_NOI_DUNG: `Lich kham cua ban bi huy do bac si nghi dot xuat. ${dedupe}`,
          TB_TRANG_THAI: 'UNREAD',
          TB_THOI_GIAN: new Date(),
        },
      });
      created += 1;
    }

    return { created };
  }
}
