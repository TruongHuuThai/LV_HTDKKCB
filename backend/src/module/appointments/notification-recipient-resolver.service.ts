import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseDateOnly } from '../booking/booking.utils';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BulkNotificationDto,
  BulkNotificationFilterDto,
} from './appointments.dto';
import {
  BULK_NOTIFICATION_RECIPIENT_SCOPE,
  BULK_NOTIFICATION_TARGET_GROUP,
  type BulkNotificationRecipientScope,
  type BulkNotificationTargetGroup,
} from './notification-targeting.constants';

type RecipientRole = 'BENH_NHAN' | 'BAC_SI' | 'USER';

export interface BulkResolvedRecipient {
  appointmentId: number | null;
  phone: string;
  patientName?: string | null;
  doctorName?: string | null;
  roomName?: string | null;
  date?: Date | null;
  shift?: string | null;
  role: RecipientRole;
}

interface NormalizedBulkFilter {
  specialtyIds: number[];
  doctorIds: number[];
  appointmentIds: number[];
  specificDate?: string;
  fromDate?: string;
  toDate?: string;
  scheduleId?: number;
  slotId?: number;
  appointmentStatuses: string[];
  recipientScope: BulkNotificationRecipientScope;
}

export interface BulkNotificationResolvedResult {
  targetGroup: BulkNotificationTargetGroup;
  recipientScope: BulkNotificationRecipientScope;
  scopeSummary: string;
  filterSummary: string[];
  warnings: string[];
  emptyReason: string | null;
  recipients: BulkResolvedRecipient[];
  normalizedFilter: NormalizedBulkFilter;
  normalizedIds: number[];
  dateFrom?: Date;
  dateTo?: Date;
}

@Injectable()
export class NotificationRecipientResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(dto: BulkNotificationDto): Promise<BulkNotificationResolvedResult> {
    const targetGroup = this.resolveTargetGroup(dto);
    const normalizedFilter = this.normalizeFilter(dto, targetGroup);
    this.validateFilter(targetGroup, normalizedFilter);

    const dateFrom = normalizedFilter.specificDate
      ? parseDateOnly(normalizedFilter.specificDate)
      : normalizedFilter.fromDate
        ? parseDateOnly(normalizedFilter.fromDate)
        : undefined;
    const dateTo = normalizedFilter.specificDate
      ? parseDateOnly(normalizedFilter.specificDate)
      : normalizedFilter.toDate
        ? parseDateOnly(normalizedFilter.toDate)
        : undefined;

    let recipients: BulkResolvedRecipient[] = [];
    switch (targetGroup) {
      case BULK_NOTIFICATION_TARGET_GROUP.ALL_USERS:
        recipients = await this.resolveAllUsers();
        break;
      case BULK_NOTIFICATION_TARGET_GROUP.PATIENTS:
        recipients = await this.resolvePatients(normalizedFilter, dateFrom, dateTo);
        break;
      case BULK_NOTIFICATION_TARGET_GROUP.DOCTORS:
        recipients = await this.resolveDoctors(normalizedFilter, dateFrom, dateTo);
        break;
      case BULK_NOTIFICATION_TARGET_GROUP.BY_SPECIALTY:
        recipients = await this.resolveDoctorsBySpecialty(normalizedFilter, dateFrom, dateTo);
        break;
      case BULK_NOTIFICATION_TARGET_GROUP.ADVANCED_FILTER:
        recipients = await this.resolveAdvanced(normalizedFilter, dateFrom, dateTo);
        break;
      default:
        throw new BadRequestException('Nhóm đối tượng nhận không hợp lệ.');
    }

    const deduped = this.dedupeRecipients(recipients);
    const scopeSummary = this.buildScopeSummary(targetGroup, normalizedFilter);
    const filterSummary = this.buildFilterSummary(targetGroup, normalizedFilter);
    const warnings = this.buildWarnings(targetGroup, normalizedFilter, deduped.length);
    const emptyReason = deduped.length > 0 ? null : this.buildEmptyReason(targetGroup, normalizedFilter);

    return {
      targetGroup,
      recipientScope: normalizedFilter.recipientScope,
      scopeSummary,
      filterSummary,
      warnings,
      emptyReason,
      recipients: deduped,
      normalizedFilter,
      normalizedIds: normalizedFilter.appointmentIds,
      dateFrom,
      dateTo,
    };
  }

  private resolveTargetGroup(dto: BulkNotificationDto): BulkNotificationTargetGroup {
    if (dto.targetGroup) {
      return dto.targetGroup as BulkNotificationTargetGroup;
    }
    return BULK_NOTIFICATION_TARGET_GROUP.PATIENTS;
  }

  private normalizeFilter(
    dto: BulkNotificationDto,
    targetGroup: BulkNotificationTargetGroup,
  ): NormalizedBulkFilter {
    const nested = dto.filters || new BulkNotificationFilterDto();
    const specialtyIds = this.normalizeNumberList([
      ...(nested.specialtyIds || []),
      ...(dto.specialtyId ? [dto.specialtyId] : []),
    ]);
    const doctorIds = this.normalizeNumberList([
      ...(nested.doctorIds || []),
      ...(dto.doctorId ? [dto.doctorId] : []),
    ]);
    const appointmentIds = this.normalizeNumberList([
      ...(nested.appointmentIds || []),
      ...(dto.appointmentIds || []),
    ]);

    const specificDate = nested.specificDate || dto.date || undefined;
    const fromDate = nested.fromDate || dto.dateFrom || undefined;
    const toDate = nested.toDate || dto.dateTo || undefined;
    const scheduleId = nested.scheduleId || dto.scheduleId || undefined;
    const slotId = nested.slotId || dto.slotId || undefined;
    const appointmentStatuses = Array.from(
      new Set(
        (nested.appointmentStatuses || [])
          .map((item) => String(item || '').trim().toUpperCase())
          .filter(Boolean),
      ),
    );

    const recipientScope =
      (nested.recipientScope as BulkNotificationRecipientScope | undefined) ||
      this.defaultRecipientScopeByTarget(targetGroup);

    if (specificDate && (fromDate || toDate)) {
      throw new BadRequestException('Chỉ được sử dụng `specificDate` hoặc `fromDate/toDate`.');
    }

    if (specificDate) {
      parseDateOnly(specificDate);
    }
    if (fromDate) {
      parseDateOnly(fromDate);
    }
    if (toDate) {
      parseDateOnly(toDate);
    }

    if (fromDate && toDate && parseDateOnly(fromDate) > parseDateOnly(toDate)) {
      throw new BadRequestException('`fromDate` phải nhỏ hơn hoặc bằng `toDate`.');
    }

    return {
      specialtyIds,
      doctorIds,
      appointmentIds,
      specificDate,
      fromDate,
      toDate,
      scheduleId,
      slotId,
      appointmentStatuses,
      recipientScope,
    };
  }

  private validateFilter(
    targetGroup: BulkNotificationTargetGroup,
    filter: NormalizedBulkFilter,
  ) {
    if (
      targetGroup === BULK_NOTIFICATION_TARGET_GROUP.BY_SPECIALTY &&
      filter.specialtyIds.length === 0
    ) {
      throw new BadRequestException(
        'Nhóm đối tượng "Theo chuyên khoa" cần chọn ít nhất một chuyên khoa.',
      );
    }

    if (
      targetGroup === BULK_NOTIFICATION_TARGET_GROUP.ADVANCED_FILTER &&
      !this.hasMeaningfulFilter(filter)
    ) {
      throw new BadRequestException(
        'Nhóm "Bộ lọc nâng cao" cần ít nhất một điều kiện lọc có ý nghĩa.',
      );
    }
  }

  private hasMeaningfulFilter(filter: NormalizedBulkFilter) {
    return (
      filter.specialtyIds.length > 0 ||
      filter.doctorIds.length > 0 ||
      filter.appointmentIds.length > 0 ||
      Boolean(filter.specificDate) ||
      Boolean(filter.fromDate) ||
      Boolean(filter.toDate) ||
      Boolean(filter.scheduleId) ||
      Boolean(filter.slotId) ||
      filter.appointmentStatuses.length > 0
    );
  }

  private hasAppointmentFilter(filter: NormalizedBulkFilter) {
    return (
      filter.appointmentIds.length > 0 ||
      filter.doctorIds.length > 0 ||
      filter.specialtyIds.length > 0 ||
      Boolean(filter.specificDate) ||
      Boolean(filter.fromDate) ||
      Boolean(filter.toDate) ||
      Boolean(filter.scheduleId) ||
      Boolean(filter.slotId) ||
      filter.appointmentStatuses.length > 0
    );
  }

  private async resolveAllUsers(): Promise<BulkResolvedRecipient[]> {
    const rows = await this.prisma.tAI_KHOAN.findMany({
      where: {
        OR: [{ TK_DA_XOA: false }, { TK_DA_XOA: null }],
      },
      select: {
        TK_SDT: true,
      },
    });

    return rows
      .filter((item) => Boolean(item.TK_SDT))
      .map((item) => ({
        appointmentId: null,
        phone: item.TK_SDT as string,
        role: 'USER',
      }));
  }

  private async resolvePatients(
    filter: NormalizedBulkFilter,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<BulkResolvedRecipient[]> {
    if (this.hasAppointmentFilter(filter)) {
      return this.resolvePatientsByAppointments(filter, dateFrom, dateTo);
    }

    const rows = await this.prisma.bENH_NHAN.findMany({
      where: {
        TK_SDT: { not: null },
        OR: [{ BN_DA_VO_HIEU: false }, { BN_DA_VO_HIEU: null }],
      },
      select: {
        TK_SDT: true,
        BN_HO_CHU_LOT: true,
        BN_TEN: true,
      },
    });

    return rows
      .filter((item) => Boolean(item.TK_SDT))
      .map((item) => ({
        appointmentId: null,
        phone: item.TK_SDT as string,
        patientName: `${item.BN_HO_CHU_LOT || ''} ${item.BN_TEN || ''}`.trim(),
        role: 'BENH_NHAN',
      }));
  }

  private async resolvePatientsByAppointments(
    filter: NormalizedBulkFilter,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<BulkResolvedRecipient[]> {
    const where = this.buildAppointmentWhere(filter, dateFrom, dateTo);
    const rows = await this.prisma.dANG_KY.findMany({
      where,
      include: {
        BENH_NHAN: true,
        LICH_BSK: {
          include: {
            BAC_SI: true,
            PHONG: true,
          },
        },
      },
    });

    return rows
      .filter((item) => Boolean(item.BENH_NHAN?.TK_SDT))
      .map((item) => ({
        appointmentId: item.DK_MA,
        phone: item.BENH_NHAN?.TK_SDT as string,
        patientName: `${item.BENH_NHAN?.BN_HO_CHU_LOT || ''} ${item.BENH_NHAN?.BN_TEN || ''}`.trim(),
        doctorName: item.LICH_BSK?.BAC_SI?.BS_HO_TEN || null,
        roomName: item.LICH_BSK?.PHONG?.P_TEN || null,
        date: item.N_NGAY,
        shift: item.B_TEN,
        role: 'BENH_NHAN',
      }));
  }

  private async resolveDoctors(
    filter: NormalizedBulkFilter,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<BulkResolvedRecipient[]> {
    const activeDoctorIds = await this.resolveDoctorIdsByActivity(filter, dateFrom, dateTo);
    if (activeDoctorIds && activeDoctorIds.length === 0) return [];

    const where: Prisma.BAC_SIWhereInput = {
      TK_SDT: { not: null },
      OR: [{ BS_DA_XOA: false }, { BS_DA_XOA: null }],
      ...(filter.specialtyIds.length > 0 ? { CK_MA: { in: filter.specialtyIds } } : {}),
      ...(filter.doctorIds.length > 0 ? { BS_MA: { in: filter.doctorIds } } : {}),
      ...(activeDoctorIds ? { BS_MA: { in: activeDoctorIds } } : {}),
    };

    const rows = await this.prisma.bAC_SI.findMany({
      where,
      select: {
        TK_SDT: true,
        BS_HO_TEN: true,
      },
    });

    return rows
      .filter((item) => Boolean(item.TK_SDT))
      .map((item) => ({
        appointmentId: null,
        phone: item.TK_SDT as string,
        doctorName: item.BS_HO_TEN || null,
        role: 'BAC_SI',
      }));
  }

  private async resolveDoctorsBySpecialty(
    filter: NormalizedBulkFilter,
    dateFrom?: Date,
    dateTo?: Date,
  ) {
    return this.resolveDoctors(filter, dateFrom, dateTo);
  }

  private async resolveAdvanced(
    filter: NormalizedBulkFilter,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<BulkResolvedRecipient[]> {
    if (filter.recipientScope === BULK_NOTIFICATION_RECIPIENT_SCOPE.ALL_USERS) {
      return this.resolveAllUsers();
    }

    if (filter.recipientScope === BULK_NOTIFICATION_RECIPIENT_SCOPE.DOCTORS) {
      return this.resolveDoctors(filter, dateFrom, dateTo);
    }

    return this.resolvePatients(filter, dateFrom, dateTo);
  }

  private async resolveDoctorIdsByActivity(
    filter: NormalizedBulkFilter,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<number[] | null> {
    const hasActivityFilter =
      filter.appointmentIds.length > 0 ||
      Boolean(filter.specificDate) ||
      Boolean(filter.fromDate) ||
      Boolean(filter.toDate) ||
      Boolean(filter.scheduleId) ||
      Boolean(filter.slotId) ||
      filter.appointmentStatuses.length > 0;

    if (!hasActivityFilter) return null;

    const where = this.buildAppointmentWhere(filter, dateFrom, dateTo);
    const rows = await this.prisma.dANG_KY.findMany({
      where,
      select: { BS_MA: true },
      distinct: ['BS_MA'],
    });
    return rows.map((item) => Number(item.BS_MA)).filter((item) => Number.isFinite(item));
  }

  private buildAppointmentWhere(
    filter: NormalizedBulkFilter,
    dateFrom?: Date,
    dateTo?: Date,
  ): Prisma.DANG_KYWhereInput {
    const statusFilter =
      filter.appointmentStatuses.length > 0
        ? filter.appointmentStatuses
        : ['CHO_KHAM', 'DA_CHECKIN'];

    const lichFilter: Prisma.LICH_BSKWhereInput = {
      ...(filter.scheduleId ? { LBM_ID: filter.scheduleId } : {}),
      ...(filter.specialtyIds.length > 0
        ? {
            BAC_SI: {
              CK_MA: { in: filter.specialtyIds },
            },
          }
        : {}),
    };

    return {
      DK_TRANG_THAI: { in: statusFilter },
      ...(filter.appointmentIds.length > 0 ? { DK_MA: { in: filter.appointmentIds } } : {}),
      ...(filter.doctorIds.length > 0 ? { BS_MA: { in: filter.doctorIds } } : {}),
      ...(filter.slotId ? { KG_MA: filter.slotId } : {}),
      ...(dateFrom || dateTo
        ? {
            N_NGAY: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
      ...(Object.keys(lichFilter).length > 0 ? { LICH_BSK: { is: lichFilter } } : {}),
    };
  }

  private defaultRecipientScopeByTarget(
    targetGroup: BulkNotificationTargetGroup,
  ): BulkNotificationRecipientScope {
    switch (targetGroup) {
      case BULK_NOTIFICATION_TARGET_GROUP.ALL_USERS:
        return BULK_NOTIFICATION_RECIPIENT_SCOPE.ALL_USERS;
      case BULK_NOTIFICATION_TARGET_GROUP.DOCTORS:
      case BULK_NOTIFICATION_TARGET_GROUP.BY_SPECIALTY:
        return BULK_NOTIFICATION_RECIPIENT_SCOPE.DOCTORS;
      default:
        return BULK_NOTIFICATION_RECIPIENT_SCOPE.PATIENTS;
    }
  }

  private buildScopeSummary(
    targetGroup: BulkNotificationTargetGroup,
    filter: NormalizedBulkFilter,
  ) {
    if (targetGroup === BULK_NOTIFICATION_TARGET_GROUP.ALL_USERS) {
      return 'Gửi cho toàn bộ người dùng trong hệ thống.';
    }

    if (targetGroup === BULK_NOTIFICATION_TARGET_GROUP.DOCTORS) {
      if (filter.specialtyIds.length > 0) {
        return `Gửi cho bác sĩ thuộc ${filter.specialtyIds.length} chuyên khoa đã chọn.`;
      }
      return 'Gửi cho toàn bộ bác sĩ.';
    }

    if (targetGroup === BULK_NOTIFICATION_TARGET_GROUP.BY_SPECIALTY) {
      return `Gửi theo chuyên khoa đã chọn (${filter.specialtyIds.join(', ')}).`;
    }

    if (targetGroup === BULK_NOTIFICATION_TARGET_GROUP.PATIENTS) {
      if (filter.specificDate) {
        return `Gửi cho bệnh nhân có lịch vào ngày ${filter.specificDate}.`;
      }
      if (filter.fromDate || filter.toDate) {
        return `Gửi cho bệnh nhân trong khoảng ngày ${filter.fromDate || '...'} đến ${
          filter.toDate || '...'
        }.`;
      }
      if (filter.appointmentIds.length > 0) {
        return `Gửi cho bệnh nhân theo danh sách mã lịch hẹn (${filter.appointmentIds.length} mã).`;
      }
      return 'Gửi cho toàn bộ bệnh nhân.';
    }

    return 'Gửi theo bộ lọc nâng cao.';
  }

  private buildFilterSummary(
    targetGroup: BulkNotificationTargetGroup,
    filter: NormalizedBulkFilter,
  ) {
    const summary: string[] = [`Nhóm đối tượng: ${this.targetGroupLabel(targetGroup)}`];
    summary.push(`Phạm vi nhận: ${this.recipientScopeLabel(filter.recipientScope)}`);
    if (filter.specialtyIds.length > 0) {
      summary.push(`Chuyên khoa: ${filter.specialtyIds.join(', ')}`);
    }
    if (filter.doctorIds.length > 0) {
      summary.push(`Bác sĩ: ${filter.doctorIds.join(', ')}`);
    }
    if (filter.appointmentIds.length > 0) {
      summary.push(`Mã lịch hẹn: ${filter.appointmentIds.join(', ')}`);
    }
    if (filter.specificDate) {
      summary.push(`Ngày cụ thể: ${filter.specificDate}`);
    } else if (filter.fromDate || filter.toDate) {
      summary.push(`Khoảng ngày: ${filter.fromDate || '...'} -> ${filter.toDate || '...'}`);
    }
    if (filter.scheduleId) {
      summary.push(`Lịch làm việc (mã nội bộ): ${filter.scheduleId}`);
    }
    if (filter.slotId) {
      summary.push(`Khung giờ (mã nội bộ): ${filter.slotId}`);
    }
    if (filter.appointmentStatuses.length > 0) {
      summary.push(`Trạng thái lịch hẹn: ${filter.appointmentStatuses.join(', ')}`);
    }
    return summary;
  }

  private buildWarnings(
    targetGroup: BulkNotificationTargetGroup,
    filter: NormalizedBulkFilter,
    recipientCount: number,
  ) {
    const warnings: string[] = [];
    const broadByFilter = !this.hasMeaningfulFilter(filter);
    if (targetGroup === BULK_NOTIFICATION_TARGET_GROUP.ALL_USERS) {
      warnings.push('Bạn đang gửi diện rộng cho toàn bộ người dùng.');
    } else if (
      (targetGroup === BULK_NOTIFICATION_TARGET_GROUP.PATIENTS ||
        targetGroup === BULK_NOTIFICATION_TARGET_GROUP.DOCTORS) &&
      broadByFilter
    ) {
      warnings.push('Bạn đang gửi diện rộng không giới hạn điều kiện lọc.');
    }

    if (recipientCount >= 1000) {
      warnings.push('Số lượng người nhận lớn, nên kiểm tra preview kỹ trước khi gửi.');
    }
    return warnings;
  }

  private buildEmptyReason(
    targetGroup: BulkNotificationTargetGroup,
    filter: NormalizedBulkFilter,
  ) {
    if (targetGroup === BULK_NOTIFICATION_TARGET_GROUP.ALL_USERS) {
      return 'Không có người dùng hoạt động hợp lệ để nhận thông báo.';
    }
    if (targetGroup === BULK_NOTIFICATION_TARGET_GROUP.DOCTORS) {
      return 'Không tìm thấy bác sĩ phù hợp với điều kiện đã chọn.';
    }
    if (targetGroup === BULK_NOTIFICATION_TARGET_GROUP.BY_SPECIALTY) {
      return 'Không có bác sĩ thuộc chuyên khoa hoặc điều kiện lọc đã chọn.';
    }
    if (
      filter.specificDate ||
      filter.fromDate ||
      filter.toDate ||
      filter.appointmentIds.length > 0
    ) {
      return 'Không có bệnh nhân khớp với lịch hẹn hoặc khoảng ngày đã chọn.';
    }
    return 'Không tìm thấy người nhận hợp lệ theo tiêu chí hiện tại.';
  }

  private dedupeRecipients(items: BulkResolvedRecipient[]) {
    const map = new Map<string, BulkResolvedRecipient>();
    items.forEach((item) => {
      const key = `${item.phone}::${item.appointmentId ?? 'NA'}::${item.role}`;
      if (!map.has(key)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  }

  private normalizeNumberList(values: Array<number | null | undefined>) {
    return Array.from(
      new Set(
        values
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item) && item > 0),
      ),
    ).sort((a, b) => a - b);
  }

  private targetGroupLabel(targetGroup: BulkNotificationTargetGroup) {
    switch (targetGroup) {
      case BULK_NOTIFICATION_TARGET_GROUP.ALL_USERS:
        return 'Tất cả người dùng';
      case BULK_NOTIFICATION_TARGET_GROUP.PATIENTS:
        return 'Bệnh nhân';
      case BULK_NOTIFICATION_TARGET_GROUP.DOCTORS:
        return 'Bác sĩ';
      case BULK_NOTIFICATION_TARGET_GROUP.BY_SPECIALTY:
        return 'Theo chuyên khoa';
      case BULK_NOTIFICATION_TARGET_GROUP.ADVANCED_FILTER:
        return 'Bộ lọc nâng cao';
      default:
        return targetGroup;
    }
  }

  private recipientScopeLabel(scope: BulkNotificationRecipientScope) {
    switch (scope) {
      case BULK_NOTIFICATION_RECIPIENT_SCOPE.ALL_USERS:
        return 'Tất cả người dùng';
      case BULK_NOTIFICATION_RECIPIENT_SCOPE.DOCTORS:
        return 'Bác sĩ';
      case BULK_NOTIFICATION_RECIPIENT_SCOPE.PATIENTS:
      default:
        return 'Bệnh nhân';
    }
  }
}
