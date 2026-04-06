import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BookingModule } from '../booking/booking.module';
import { PaymentModule } from '../payment/payment.module';
import {
  AdminRefundsController,
  AdminAppointmentsController,
  AppointmentsController,
  DoctorAppointmentsController,
  PatientNotificationsController,
  PatientWaitlistController,
} from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentNotificationAutomationService } from './appointments.notification-automation.service';

@Module({
  imports: [PrismaModule, BookingModule, PaymentModule],
  controllers: [
    AdminAppointmentsController,
    AdminRefundsController,
    AppointmentsController,
    DoctorAppointmentsController,
    PatientNotificationsController,
    PatientWaitlistController,
  ],
  providers: [AppointmentsService, AppointmentNotificationAutomationService],
})
export class AppointmentsModule {}
