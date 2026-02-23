// src/modules/booking/booking.module.ts
import { Module } from '@nestjs/common';
import { BookingRepository } from './booking.repository';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';

@Module({
  providers: [BookingRepository, BookingService],
  controllers: [BookingController],
})
export class BookingModule {}
