// src/module/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { VnpayService } from './vnpay.service';
import { PaymentRepository } from './payment.repository';
import { PaymentController, PaymentWebhookController, RefundWebhookController } from './payment.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentReliabilityService } from './payment-reliability.service';

@Module({
    imports: [PrismaModule],
    providers: [VnpayService, PaymentRepository, PaymentReliabilityService],
    controllers: [PaymentController, PaymentWebhookController, RefundWebhookController],
    exports: [VnpayService, PaymentRepository],
})
export class PaymentModule { }
