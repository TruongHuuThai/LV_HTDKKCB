import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

@Injectable()
export class AppointmentNotificationAutomationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AppointmentNotificationAutomationService.name);
  private intervalHandle: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly appointments: AppointmentsService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    const intervalMinutes = Number.parseInt(
      process.env.APPOINTMENT_NOTIFICATION_TICK_MINUTES || '10',
      10,
    );
    const intervalMs = (Number.isFinite(intervalMinutes) && intervalMinutes > 0
      ? intervalMinutes
      : 10) * 60_000;

    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const reminder = await this.appointments.generateReminderNotifications();
      const doctorLeave = await this.appointments.generateDoctorUnavailableNotifications();
      this.logger.log(
        `Notifications tick done. reminder=${reminder.created}, doctor_unavailable=${doctorLeave.created}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Notifications tick failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
