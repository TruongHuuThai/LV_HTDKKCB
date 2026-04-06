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
        await this.paymentRepo.updatePaymentStatus(
          TT_MA,
          'DA_THANH_TOAN',
          verify.bankTransactionId,
          query['vnp_BankCode'],
        );
      } else {
        await this.paymentRepo.updatePaymentStatus(TT_MA, 'THAT_BAI');
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
