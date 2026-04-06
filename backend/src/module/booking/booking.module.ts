// src/modules/booking/booking.module.ts
import { Module } from '@nestjs/common';
import { BookingRepository } from './booking.repository';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [PaymentModule],
  providers: [BookingRepository, BookingService],
  controllers: [BookingController],
  exports: [BookingRepository, BookingService],
})
export class BookingModule { }
