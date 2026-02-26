// src/module/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { VnpayService } from './vnpay.service';
import { PaymentRepository } from './payment.repository';
import { PaymentController } from './payment.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [VnpayService, PaymentRepository],
    controllers: [PaymentController],
    exports: [VnpayService, PaymentRepository],
})
export class PaymentModule { }
