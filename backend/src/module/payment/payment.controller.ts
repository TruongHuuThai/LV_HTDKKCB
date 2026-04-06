import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { PaymentReliabilityService } from './payment-reliability.service';
import { VnpayService } from './vnpay.service';

@Controller('vnpay')
export class PaymentController {
  private readonly frontendUrl: string;

  constructor(
    private readonly vnpay: VnpayService,
    private readonly paymentReliability: PaymentReliabilityService,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
  }

  @Get('ipn')
  @HttpCode(HttpStatus.OK)
  async ipn(@Query() query: Record<string, string>) {
    return this.paymentReliability.handleVnpayWebhook(query || {});
  }

  @Post('/webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Body() body: Record<string, string>) {
    return this.paymentReliability.handleVnpayWebhook(body || {});
  }

  @Get('return')
  async returnUrl(@Query() query: Record<string, string>, @Res() res: Response) {
    const { valid, responseCode, transactionRef } = this.vnpay.verifyIpn(query);
    const success = valid && responseCode === '00';
    const redirectUrl = `${this.frontendUrl}/payment-result?success=${success}&ref=${transactionRef}`;
    res.redirect(redirectUrl);
  }
}

@Controller('payments')
export class PaymentWebhookController {
  constructor(private readonly paymentReliability: PaymentReliabilityService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Body() body: Record<string, string>) {
    return this.paymentReliability.handleVnpayWebhook(body || {});
  }
}

@Controller('refunds')
export class RefundWebhookController {
  constructor(private readonly paymentReliability: PaymentReliabilityService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Body() body: Record<string, any>) {
    return this.paymentReliability.handleRefundWebhook(body || {});
  }
}
