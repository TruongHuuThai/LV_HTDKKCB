import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BookingModule } from '../booking/booking.module';
import { PaymentModule } from '../payment/payment.module';
import {
  AdminOpsController,
  AdminRefundsController,
  AdminReconciliationController,
  AttachmentAccessController,
  AdminAppointmentsController,
  AdminBulkNotificationsController,
  AppointmentsController,
  DoctorAppointmentsController,
  DoctorStatsController,
  PatientNotificationsController,
  PatientWaitlistController,
} from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentNotificationAutomationService } from './appointments.notification-automation.service';
import { AttachmentStorageService } from './attachment-storage.service';
import { AttachmentScanService } from './attachment-scan.service';
import { AppointmentsBackgroundWorkerService } from './appointments.background-worker.service';

@Module({
  imports: [PrismaModule, BookingModule, PaymentModule],
  controllers: [
    AdminAppointmentsController,
    AdminRefundsController,
    AdminBulkNotificationsController,
    AdminOpsController,
    AdminReconciliationController,
    AppointmentsController,
    DoctorAppointmentsController,
    DoctorStatsController,
    PatientNotificationsController,
    PatientWaitlistController,
    AttachmentAccessController,
  ],
  providers: [
    AppointmentsService,
    AppointmentNotificationAutomationService,
    AttachmentStorageService,
    AttachmentScanService,
    AppointmentsBackgroundWorkerService,
  ],
})
export class AppointmentsModule {}
