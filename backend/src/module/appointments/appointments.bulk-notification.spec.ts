import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { CurrentUserPayload } from '../auth/current-user.decorator';
import type { PrismaService } from '../../prisma/prisma.service';
import type { BookingService } from '../booking/booking.service';
import type { VnpayService } from '../payment/vnpay.service';
import type { QrBankingService } from '../payment/qr-banking.service';
import type { AttachmentStorageService } from './attachment-storage.service';
import type { AttachmentScanService } from './attachment-scan.service';
import type { PdfService } from '../pdf/pdf.service';
import { AppointmentsService } from './appointments.service';
import type { NotificationRecipientResolverService } from './notification-recipient-resolver.service';
import {
  BULK_NOTIFICATION_RECIPIENT_SCOPE,
  BULK_NOTIFICATION_TARGET_GROUP,
} from './notification-targeting.constants';

function createResolvedRecipients() {
  return {
    targetGroup: BULK_NOTIFICATION_TARGET_GROUP.PATIENTS,
    recipientScope: BULK_NOTIFICATION_RECIPIENT_SCOPE.PATIENTS,
    scopeSummary: 'Gửi cho toàn bộ bệnh nhân.',
    filterSummary: ['Nhóm đối tượng: Bệnh nhân'],
    warnings: [],
    emptyReason: null,
    recipients: [
      {
        appointmentId: null,
        phone: '0909000001',
        role: 'BENH_NHAN' as const,
        patientName: 'Nguyễn An',
      },
    ],
    normalizedFilter: {
      specialtyIds: [],
      doctorIds: [],
      appointmentIds: [],
      appointmentStatuses: [],
      recipientScope: BULK_NOTIFICATION_RECIPIENT_SCOPE.PATIENTS,
    },
    normalizedIds: [],
    dateFrom: undefined,
    dateTo: undefined,
  };
}

function createServiceMocks() {
  const prisma = {
    tHONG_BAO_BATCH: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    tHONG_BAO_BATCH_RECIPIENT: {
      createMany: jest.fn(),
    },
    aUDIT_LOG: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;

  const resolver = {
    resolve: jest.fn(),
  } as unknown as NotificationRecipientResolverService;

  const service = new AppointmentsService(
    prisma,
    {} as BookingService,
    {} as VnpayService,
    {} as QrBankingService,
    {
      get: jest.fn().mockReturnValue('120'),
    } as unknown as ConfigService,
    {} as AttachmentStorageService,
    {} as AttachmentScanService,
    {} as PdfService,
    resolver,
  );

  return { prisma, resolver, service };
}

describe('AppointmentsService bulk notification flow', () => {
  const adminUser = {
    TK_SDT: '0988000001',
    role: 'ADMIN',
  } as unknown as CurrentUserPayload;

  it('uses resolver result for both preview and send consistently', async () => {
    const { prisma, resolver, service } = createServiceMocks();
    const resolved = createResolvedRecipients();
    (resolver.resolve as jest.Mock).mockResolvedValue(resolved);

    (prisma.tHONG_BAO_BATCH.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: any) => Promise<any>) =>
      cb({
        tHONG_BAO_BATCH: {
          create: jest.fn().mockResolvedValue({ TBB_MA: 123 }),
        },
        tHONG_BAO_BATCH_RECIPIENT: {
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        aUDIT_LOG: {
          create: jest.fn().mockResolvedValue({}),
        },
      }),
    );

    const preview = await service.previewBulkNotificationRecipients({
      type: 'system_admin',
      message: 'Nội dung test',
      targetGroup: BULK_NOTIFICATION_TARGET_GROUP.PATIENTS,
    });
    const created = await service.createBulkNotificationBatch(adminUser, {
      type: 'system_admin',
      message: 'Nội dung test',
      targetGroup: BULK_NOTIFICATION_TARGET_GROUP.PATIENTS,
    });

    expect(preview.totalRecipients).toBe(created.totalRecipients);
    expect(preview.targetGroup).toBe(created.targetGroup);
    expect(resolver.resolve).toHaveBeenCalledTimes(2);
  });

  it('throws bad request when resolver returns empty recipients', async () => {
    const { resolver, service } = createServiceMocks();
    (resolver.resolve as jest.Mock).mockResolvedValue({
      ...createResolvedRecipients(),
      recipients: [],
      emptyReason: 'Không có người nhận hợp lệ.',
    });

    await expect(
      service.createBulkNotificationBatch(adminUser, {
        type: 'system_admin',
        message: 'Nội dung test',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
