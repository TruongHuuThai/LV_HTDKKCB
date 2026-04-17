import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppointmentsService } from './appointments.service';

@Injectable()
export class AppointmentsBackgroundWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppointmentsBackgroundWorkerService.name);
  private handle: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly appointments: AppointmentsService,
  ) {}

  onModuleInit() {
    const disabled = (this.config.get<string>('APPOINTMENT_BACKGROUND_WORKER_ENABLED', 'true') || '')
      .toLowerCase()
      .trim();
    if (disabled === 'false' || process.env.NODE_ENV === 'test') return;

    const minutes = Number.parseInt(
      this.config.get<string>('APPOINTMENT_BACKGROUND_WORKER_INTERVAL_MINUTES', '1'),
      10,
    );
    const interval = Math.max(15_000, (Number.isFinite(minutes) ? minutes : 1) * 60_000);

    this.handle = setInterval(() => {
      void this.tick();
    }, interval);
    void this.tick();
    this.logger.log(`Appointment background worker enabled, intervalMs=${interval}`);
  }

  onModuleDestroy() {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
  }

  private async tick() {
    try {
      await this.appointments.processQueuedBulkNotificationBatches();
      await this.appointments.processExpiredWaitlistHolds();
      await this.appointments.processExpiredPendingPayments();
    } catch (e) {
      this.logger.error(`Background worker tick failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
