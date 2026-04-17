import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PaymentRepository } from './payment.repository';
import { VnpayService } from './vnpay.service';

@Injectable()
export class PaymentReliabilityService {
  private readonly logger = new Logger(PaymentReliabilityService.name);

  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly vnpay: VnpayService,
  ) {}

  private formatDate(value?: Date | string | null) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  private formatTime(value?: Date | string | null) {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(11, 16);
    const normalized = String(value);
    if (normalized.includes('T')) return normalized.slice(11, 16);
    return normalized.slice(0, 5);
  }

  private async notifyPaymentStatusChanged(TT_MA: number, status: 'success' | 'failed') {
    const context = await this.paymentRepo.getPaymentNotificationContext(TT_MA);
    const appointment = context?.DANG_KY;
    const phone = appointment?.BENH_NHAN?.TK_SDT || null;
    if (!phone) return;

    const appointmentId = Number(context?.DK_MA || appointment?.DK_MA || 0) || null;
    const doctorName = String(appointment?.LICH_BSK?.BAC_SI?.BS_HO_TEN || '').trim();
    const dateLabel = this.formatDate(appointment?.N_NGAY);
    const timeLabel = this.formatTime(appointment?.KHUNG_GIO?.KG_BAT_DAU);

    if (status === 'success') {
      const dedupeKey = `[PAYMENT_SUCCESS_TT_MA=${TT_MA}]`;
      await this.paymentRepo.createNotificationIfAbsent({
        phone,
        type: 'payment_success',
        title: 'Thanh toan thanh cong',
        content:
          `He thong da xac nhan thanh toan thanh cong cho giao dich TT_MA=${TT_MA}` +
          (appointmentId ? ` (DK_MA=${appointmentId})` : '') +
          (dateLabel ? `, ngay kham ${dateLabel}` : '') +
          (timeLabel ? ` luc ${timeLabel}` : '') +
          (doctorName ? ` voi bac si ${doctorName}.` : '.'),
        dedupeKey,
      });
      return;
    }

    const dedupeKey = `[PAYMENT_FAILED_TT_MA=${TT_MA}]`;
    await this.paymentRepo.createNotificationIfAbsent({
      phone,
      type: 'payment_failed',
      title: 'Thanh toan khong thanh cong',
      content:
        `Giao dich thanh toan TT_MA=${TT_MA}` +
        (appointmentId ? ` (DK_MA=${appointmentId})` : '') +
        ' khong thanh cong. Vui long thu lai thanh toan hoac tao giao dich moi.',
      dedupeKey,
    });
  }

  async handleVnpayWebhook(query: Record<string, string>) {
    const verify = this.vnpay.verifyIpn(query);
    const payloadForHash = JSON.stringify(
      Object.keys(query)
        .sort()
        .reduce(
          (acc, key) => {
            acc[key] = query[key];
            return acc;
          },
          {} as Record<string, string>,
        ),
    );
    const eventKey = createHash('sha1').update(payloadForHash).digest('hex');

    const existing = await this.paymentRepo.findWebhookEventByKey(eventKey);
    if (existing) {
      return {
        RspCode: '00',
        Message: 'Duplicate webhook ignored',
        idempotent: true,
      };
    }

    const event = await this.paymentRepo.createWebhookEvent({
      provider: 'VNPAY',
      eventKey,
      eventType: 'payment_ipn',
      reference: verify.transactionRef || null,
      signatureOk: verify.valid,
      payload: query,
      status: 'RECEIVED',
    });

    if (!verify.valid) {
      await this.paymentRepo.updateWebhookEventResult(event.PWE_MA, 'FAILED', 'INVALID_SIGNATURE');
      return { RspCode: '97', Message: 'Invalid signature' };
    }

    const TT_MA = Number.parseInt(verify.transactionRef, 10);
    if (!Number.isFinite(TT_MA)) {
      await this.paymentRepo.updateWebhookEventResult(event.PWE_MA, 'FAILED', 'INVALID_REFERENCE');
      return { RspCode: '01', Message: 'Invalid order ref' };
    }

    const payment = await this.paymentRepo.findPaymentByTtMa(TT_MA);
    if (!payment) {
      await this.paymentRepo.updateWebhookEventResult(event.PWE_MA, 'FAILED', 'ORDER_NOT_FOUND');
      return { RspCode: '01', Message: 'Order not found' };
    }

    try {
      if (verify.responseCode === '00') {
        const updatedPayment = await this.paymentRepo.updatePaymentStatus(
          TT_MA,
          'DA_THANH_TOAN',
          verify.bankTransactionId,
          query['vnp_BankCode'],
        );
        if (updatedPayment?.DK_MA) {
          await this.paymentRepo.confirmAppointmentAfterPayment(updatedPayment.DK_MA);
        }
        await this.notifyPaymentStatusChanged(TT_MA, 'success');
      } else {
        await this.paymentRepo.updatePaymentStatus(TT_MA, 'THAT_BAI');
        await this.notifyPaymentStatusChanged(TT_MA, 'failed');
      }
      await this.paymentRepo.updateWebhookEventResult(event.PWE_MA, 'PROCESSED');
      return { RspCode: '00', Message: 'Confirm Success' };
    } catch (e: any) {
      this.logger.error(`Webhook processing failed: ${e?.message || String(e)}`);
      await this.paymentRepo.updateWebhookEventResult(event.PWE_MA, 'FAILED', e?.message || 'PROCESSING_FAILED');
      throw new BadRequestException('Webhook processing failed');
    }
  }

  async handleRefundWebhook(payload: Record<string, any>) {
    const payloadForHash = JSON.stringify(
      Object.keys(payload || {})
        .sort()
        .reduce(
          (acc, key) => {
            acc[key] = payload[key];
            return acc;
          },
          {} as Record<string, any>,
        ),
    );
    const eventKey = createHash('sha1').update(payloadForHash).digest('hex');
    const existing = await this.paymentRepo.findWebhookEventByKey(eventKey);
    if (existing) {
      return { ok: true, idempotent: true, message: 'duplicate refund webhook ignored' };
    }

    const event = await this.paymentRepo.createWebhookEvent({
      provider: 'VNPAY_REFUND',
      eventKey,
      eventType: 'refund_webhook',
      reference: payload?.transactionRef || null,
      signatureOk: true,
      payload: payload || {},
      status: 'IGNORED',
    });
    await this.paymentRepo.updateWebhookEventResult(event.PWE_MA, 'IGNORED');
    return { ok: true, message: 'refund webhook recorded' };
  }
}
