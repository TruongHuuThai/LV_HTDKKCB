import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUserPayload } from '../auth/current-user.decorator';
import { BookingService } from '../booking/booking.service';
import { combineDateAndTime, parseDateOnly } from '../booking/booking.utils';
import { VnpayService } from '../payment/vnpay.service';
import {
  AdminWaitlistListQueryDto,
  AdminAppointmentListQueryDto,
  CancelAppointmentDto,
  NotificationListQueryDto,
  DoctorUpdateAppointmentStatusDto,
  DoctorWorklistQueryDto,
  JoinWaitlistDto,
  ManualBookingDto,
  PatientAppointmentListQueryDto,
  PatientWaitlistListQueryDto,
  RefundListQueryDto,
  RescheduleAppointmentDto,
  UpdateAppointmentStatusDto,
  UpdateRefundStatusDto,
} from './appointments.dto';
import {
  APPOINTMENT_STATUS,
  assertValidAppointmentStatusTransition,
  isAppointmentTerminalStatus,
} from './appointments.status';
import { evaluateCancelPolicy } from './cancel-policy.util';
import { mapAppointmentStatusToGroup } from './appointment-status-group.util';

const ACTIVE_BOOKING_STATUS = ['CHO_KHAM', 'DA_CHECKIN'];
const REFUND_STATUSES = ['REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED', 'REFUND_REJECTED'];

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingService: BookingService,
    private readonly vnpay: VnpayService,
    private readonly config: ConfigService,
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

  private validateAppointmentOwner(user: CurrentUserPayload, ownerPhone?: string | null) {
    if (!ownerPhone || ownerPhone !== user.TK_SDT) {
      throw new ForbiddenException('Ban khong co quyen thao tac lich hen nay');
    }
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
      return { DK_TRANG_THAI: 'DA_KHAM' };
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

  private async createAppointmentNotification(input: {
    appointmentId: number;
    phone: string;
    type: 'reminder' | 'reschedule' | 'doctor_unavailable' | 'cancellation' | 'waitlist';
    title: string;
    content: string;
    dedupeKey: string;
  }) {
    const exists = await this.prisma.tHONG_BAO.findFirst({
      where: {
        TK_SDT: input.phone,
        TB_LOAI: input.type,
        TB_NOI_DUNG: { contains: input.dedupeKey, mode: 'insensitive' },
      },
    });
    if (exists) return exists;

    return this.createNotification({
      phone: input.phone,
      title: input.title,
      type: input.type,
      content: `${input.content} (${input.dedupeKey})`,
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
        return {
          appointmentId: row.DK_MA,
          DK_MA: row.DK_MA,
          N_NGAY: row.N_NGAY,
          B_TEN: row.B_TEN,
          KG_MA: row.KG_MA,
          KG_BAT_DAU: row.KHUNG_GIO?.KG_BAT_DAU || null,
          KG_KET_THUC: row.KHUNG_GIO?.KG_KET_THUC || null,
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

    return {
      appointment,
      cancelPolicy,
      refund: this.buildRefundSummary(appointment),
      notifications,
      waitlist: waitlistItems,
    };
  }

  async listNotifications(user: CurrentUserPayload, query: NotificationListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const isRead =
      query.isRead === 'true' ? 'READ' : query.isRead === 'false' ? 'UNREAD' : undefined;

    const where: Prisma.THONG_BAOWhereInput = {
      TK_SDT: user.TK_SDT,
      ...(query.type ? { TB_LOAI: query.type } : {}),
      ...(isRead ? { TB_TRANG_THAI: isRead } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.tHONG_BAO.count({ where }),
      this.prisma.tHONG_BAO.findMany({
        where,
        skip,
        take: limit,
        orderBy: { TB_THOI_GIAN: 'desc' },
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

  async markNotificationRead(user: CurrentUserPayload, notificationId: number) {
    const noti = await this.prisma.tHONG_BAO.findUnique({ where: { TB_MA: notificationId } });
    if (!noti || noti.TK_SDT !== user.TK_SDT) {
      throw new NotFoundException('Khong tim thay thong bao');
    }

    const updated = await this.prisma.tHONG_BAO.update({
      where: { TB_MA: notificationId },
      data: { TB_TRANG_THAI: 'READ' },
    });
    return { message: 'Da danh dau da doc', notification: updated };
  }

  async markAllNotificationsRead(user: CurrentUserPayload) {
    const result = await this.prisma.tHONG_BAO.updateMany({
      where: { TK_SDT: user.TK_SDT, TB_TRANG_THAI: { not: 'READ' } },
      data: { TB_TRANG_THAI: 'READ' },
    });
    return { message: 'Da danh dau tat ca la da doc', updatedCount: result.count };
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
        LBSK_TRANG_THAI: 'finalized',
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
           AND "WL_STATUS" IN ('WAITING', 'NOTIFIED')
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
    if (!['WAITING', 'NOTIFIED'].includes(found.WL_STATUS)) {
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
          LBSK_TRANG_THAI: 'finalized',
          DOT_LICH_TUAN: {
            is: { DLT_TRANG_THAI: 'slot_opened' },
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

    const latest = appointment.THANH_TOAN[0] || null;
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
            normalizedStatus: this.normalizePaymentStatus(
              latest.TT_TRANG_THAI,
              latest.TT_THOI_GIAN,
            ),
            TT_MA_GIAO_DICH: latest.TT_MA_GIAO_DICH,
            TT_THOI_GIAN: latest.TT_THOI_GIAN,
            expiresAt,
            paymentUrl: null,
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

    const baseAmount =
      Number(latest?.TT_TONG_TIEN ?? 0) ||
      Number(appointment.LOAI_HINH_KHAM?.LHK_GIA ?? 0) ||
      10000;

    const created = await this.prisma.getClient().$transaction(async (tx) => {
      if (latest && latest.TT_TRANG_THAI === 'CHUA_THANH_TOAN') {
        await tx.tHANH_TOAN.update({
          where: { TT_MA: latest.TT_MA },
          data: { TT_TRANG_THAI: 'HET_HAN' },
        });
      }

      const payment = await tx.tHANH_TOAN.create({
        data: {
          DK_MA: appointment.DK_MA,
          TT_TONG_TIEN: baseAmount,
          TT_TIEN_KHAM: baseAmount,
          TT_THUC_THU: baseAmount,
          TT_LOAI: 'DAT_LICH',
          TT_PHUONG_THUC: 'VNPAY',
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

    const paymentUrl = this.vnpay.createPaymentUrl(
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

  async getDoctorWorklist(user: CurrentUserPayload, query: DoctorWorklistQueryDto) {
    const bsMa = user.bsMa;
    if (!bsMa) throw new ForbiddenException('Tai khoan hien tai khong phai bac si');

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const targetDate = query.date ? parseDateOnly(query.date) : undefined;
    const statusList = this.parseStatusList(query.status);

    const where: Prisma.DANG_KYWhereInput = {
      BS_MA: bsMa,
      ...(targetDate ? { N_NGAY: targetDate } : {}),
      ...(query.shift ? { B_TEN: query.shift } : {}),
      ...(statusList.length > 0 ? { DK_TRANG_THAI: { in: statusList } } : {}),
    };

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
          THANH_TOAN: {
            orderBy: { TT_THOI_GIAN: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    return {
      items: rows.map((row) => {
        const latestPayment = row.THANH_TOAN[0] || null;
        return {
          DK_MA: row.DK_MA,
          BN_MA: row.BN_MA,
          patientName: `${row.BENH_NHAN?.BN_HO_CHU_LOT || ''} ${row.BENH_NHAN?.BN_TEN || ''}`
            .trim()
            .trim(),
          N_NGAY: row.N_NGAY,
          B_TEN: row.B_TEN,
          KG_MA: row.KG_MA,
          KG_BAT_DAU: row.KHUNG_GIO?.KG_BAT_DAU || null,
          KG_KET_THUC: row.KHUNG_GIO?.KG_KET_THUC || null,
          DK_TRANG_THAI: row.DK_TRANG_THAI,
          note: row.DK_LY_DO_HUY || null,
          paymentStatus: latestPayment
            ? this.normalizePaymentStatus(
                latestPayment.TT_TRANG_THAI,
                latestPayment.TT_THOI_GIAN,
              )
            : 'unpaid',
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
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

    await tx.$executeRawUnsafe(
      `UPDATE "WAITLIST_ENTRY"
       SET "WL_STATUS" = 'NOTIFIED',
           "WL_NOTIFIED_AT" = NOW(),
           "WL_UPDATED_AT" = NOW()
       WHERE "WL_ID" = $1`,
      candidate.WL_ID,
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
          TB_NOI_DUNG: `Slot cho bac si ${candidate.BS_MA} ngay ${dateLabel} da trong. Vui long dat lich som. [WAITLIST_ID=${candidate.WL_ID}]`,
          TB_TRANG_THAI: 'UNREAD',
          TB_THOI_GIAN: new Date(),
        },
      });
    }

    await tx.aUDIT_LOG.create({
      data: {
        AL_TABLE: 'WAITLIST_ENTRY',
        AL_ACTION: 'WAITLIST_NOTIFIED',
        AL_PK: { WL_ID: candidate.WL_ID },
        AL_NEW: {
          BS_MA: candidate.BS_MA,
          N_NGAY: dateLabel,
          B_TEN: candidate.B_TEN,
          KG_MA: candidate.KG_MA,
        },
      },
    });

    return candidate;
  }

  async generateReminderNotifications() {
    const reminderMinutes = Number.parseInt(
      this.config.get<string>('APPOINTMENT_REMINDER_MINUTES', '180'),
      10,
    );
    const minutes = Number.isFinite(reminderMinutes) && reminderMinutes > 0 ? reminderMinutes : 180;
    const now = new Date();
    const windowStart = new Date(now.getTime() + minutes * 60 * 1000 - 5 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + minutes * 60 * 1000 + 5 * 60 * 1000);

    const appointments = await this.prisma.dANG_KY.findMany({
      where: {
        DK_TRANG_THAI: { in: ['CHO_KHAM', 'DA_CHECKIN'] },
      },
      include: {
        KHUNG_GIO: true,
        BENH_NHAN: true,
        LICH_BSK: {
          include: {
            BAC_SI: true,
          },
        },
      },
      take: 500,
      orderBy: { N_NGAY: 'asc' },
    });

    let created = 0;
    for (const item of appointments) {
      if (!item.KHUNG_GIO?.KG_BAT_DAU) continue;
      const startAt = combineDateAndTime(item.N_NGAY, item.KHUNG_GIO.KG_BAT_DAU);
      if (startAt < windowStart || startAt > windowEnd) continue;
      if (!item.BENH_NHAN?.TK_SDT) continue;

      const dedupe = `[REMINDER_DK_MA=${item.DK_MA}]`;
      const exists = await this.prisma.tHONG_BAO.findFirst({
        where: {
          TK_SDT: item.BENH_NHAN.TK_SDT,
          TB_LOAI: 'reminder',
          TB_NOI_DUNG: { contains: dedupe },
        },
      });
      if (exists) continue;

      await this.prisma.tHONG_BAO.create({
        data: {
          TK_SDT: item.BENH_NHAN.TK_SDT,
          TB_TIEU_DE: 'Nhac lich kham sap toi',
          TB_LOAI: 'reminder',
          TB_NOI_DUNG: `Ban co lich kham voi bac si ${item.LICH_BSK?.BAC_SI?.BS_HO_TEN || item.BS_MA} vao ${startAt.toISOString()}. ${dedupe}`,
          TB_TRANG_THAI: 'UNREAD',
          TB_THOI_GIAN: new Date(),
        },
      });
      created += 1;
    }

    return { created };
  }

  async generateDoctorUnavailableNotifications() {
    const affected = await this.prisma.dANG_KY.findMany({
      where: { DK_TRANG_THAI: 'HUY_BS_NGHI' },
      include: {
        BENH_NHAN: true,
      },
      take: 500,
      orderBy: { DK_MA: 'desc' },
    });

    let created = 0;
    for (const item of affected) {
      const phone = item.BENH_NHAN?.TK_SDT;
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
