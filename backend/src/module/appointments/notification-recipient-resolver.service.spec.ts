import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { NotificationRecipientResolverService } from './notification-recipient-resolver.service';
import {
  BULK_NOTIFICATION_RECIPIENT_SCOPE,
  BULK_NOTIFICATION_TARGET_GROUP,
} from './notification-targeting.constants';

function createBaseDto() {
  return {
    type: 'system_admin',
    message: 'Thông báo kiểm thử',
  };
}

function createPrismaMock() {
  return {
    tAI_KHOAN: { findMany: jest.fn() },
    bENH_NHAN: { findMany: jest.fn() },
    dANG_KY: { findMany: jest.fn() },
    bAC_SI: { findMany: jest.fn() },
  } as unknown as PrismaService;
}

describe('NotificationRecipientResolverService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: NotificationRecipientResolverService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new NotificationRecipientResolverService(prisma);
  });

  it('resolves ALL_USERS and returns broad-scope warning', async () => {
    (prisma.tAI_KHOAN.findMany as jest.Mock).mockResolvedValue([
      { TK_SDT: '0901000001' },
      { TK_SDT: null },
      { TK_SDT: '0901000002' },
    ]);

    const result = await service.resolve({
      ...createBaseDto(),
      targetGroup: BULK_NOTIFICATION_TARGET_GROUP.ALL_USERS,
    });

    expect(result.recipients).toHaveLength(2);
    expect(result.recipientScope).toBe(BULK_NOTIFICATION_RECIPIENT_SCOPE.ALL_USERS);
    expect(result.scopeSummary).toContain('toàn bộ người dùng');
    expect(result.warnings).toContain('Bạn đang gửi diện rộng cho toàn bộ người dùng.');
  });

  it('resolves PATIENTS without filters as all patients', async () => {
    (prisma.bENH_NHAN.findMany as jest.Mock).mockResolvedValue([
      { TK_SDT: '0902000001', BN_HO_CHU_LOT: 'Nguyễn', BN_TEN: 'An' },
    ]);

    const result = await service.resolve({
      ...createBaseDto(),
      targetGroup: BULK_NOTIFICATION_TARGET_GROUP.PATIENTS,
    });

    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0]?.role).toBe('BENH_NHAN');
    expect(result.scopeSummary).toBe('Gửi cho toàn bộ bệnh nhân.');
  });

  it('resolves DOCTORS without filters as all doctors and warns broad send', async () => {
    (prisma.bAC_SI.findMany as jest.Mock).mockResolvedValue([
      { TK_SDT: '0903000001', BS_HO_TEN: 'BS Minh' },
      { TK_SDT: '0903000002', BS_HO_TEN: 'BS Lan' },
    ]);

    const result = await service.resolve({
      ...createBaseDto(),
      targetGroup: BULK_NOTIFICATION_TARGET_GROUP.DOCTORS,
    });

    expect(result.recipients).toHaveLength(2);
    expect(result.recipients.every((item) => item.role === 'BAC_SI')).toBe(true);
    expect(result.warnings).toContain('Bạn đang gửi diện rộng không giới hạn điều kiện lọc.');
  });

  it('rejects BY_SPECIALTY when specialtyIds are missing', async () => {
    await expect(
      service.resolve({
        ...createBaseDto(),
        targetGroup: BULK_NOTIFICATION_TARGET_GROUP.BY_SPECIALTY,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves BY_SPECIALTY with at least one specialty', async () => {
    (prisma.bAC_SI.findMany as jest.Mock).mockResolvedValue([
      { TK_SDT: '0904000001', BS_HO_TEN: 'BS Chuyên khoa' },
    ]);

    const result = await service.resolve({
      ...createBaseDto(),
      targetGroup: BULK_NOTIFICATION_TARGET_GROUP.BY_SPECIALTY,
      filters: {
        specialtyIds: [3],
      },
    });

    expect(result.recipients).toHaveLength(1);
    expect(result.scopeSummary).toContain('chuyên khoa đã chọn');
    expect(result.filterSummary).toContain('Chuyên khoa: 3');
  });

  it('rejects ADVANCED_FILTER when no meaningful condition is provided', async () => {
    await expect(
      service.resolve({
        ...createBaseDto(),
        targetGroup: BULK_NOTIFICATION_TARGET_GROUP.ADVANCED_FILTER,
        filters: { recipientScope: BULK_NOTIFICATION_RECIPIENT_SCOPE.PATIENTS },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves ADVANCED_FILTER for doctors and returns recipient scope summary', async () => {
    (prisma.bAC_SI.findMany as jest.Mock).mockResolvedValue([
      { TK_SDT: '0905000001', BS_HO_TEN: 'BS Scope' },
    ]);

    const result = await service.resolve({
      ...createBaseDto(),
      targetGroup: BULK_NOTIFICATION_TARGET_GROUP.ADVANCED_FILTER,
      filters: {
        recipientScope: BULK_NOTIFICATION_RECIPIENT_SCOPE.DOCTORS,
        doctorIds: [12],
      },
    });

    expect(result.recipients).toHaveLength(1);
    expect(result.recipientScope).toBe(BULK_NOTIFICATION_RECIPIENT_SCOPE.DOCTORS);
    expect(result.filterSummary).toContain('Phạm vi nhận: Bác sĩ');
  });

  it('returns emptyReason for PATIENTS when appointment-filtered result is empty', async () => {
    (prisma.dANG_KY.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.resolve({
      ...createBaseDto(),
      targetGroup: BULK_NOTIFICATION_TARGET_GROUP.PATIENTS,
      filters: {
        specificDate: '2026-04-18',
      },
    });

    expect(result.recipients).toHaveLength(0);
    expect(result.emptyReason).toContain('Không có bệnh nhân');
  });
});

