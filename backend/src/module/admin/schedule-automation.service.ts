import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AdminService } from './admin.service';

@Injectable()
export class ScheduleAutomationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduleAutomationService.name);
  private intervalHandle: NodeJS.Timeout | null = null;
  private startupHandle: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly adminService: AdminService) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.log('Schedule automation disabled by configuration.');
      return;
    }

    const intervalMinutes = this.getIntervalMinutes();
    const intervalMs = intervalMinutes * 60_000;
    const startupDelayMs = this.getStartupDelayMs();

    this.startupHandle = setTimeout(() => {
      void this.runMaintenance('startup');
    }, startupDelayMs);

    this.intervalHandle = setInterval(() => {
      void this.runMaintenance('interval');
    }, intervalMs);

    this.logger.log(
      `Schedule automation enabled. Interval: ${intervalMinutes} minutes.`,
    );
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    if (this.startupHandle) {
      clearTimeout(this.startupHandle);
      this.startupHandle = null;
    }
  }

  private isEnabled() {
    const raw = (process.env.SCHEDULE_AUTOMATION_ENABLED ?? '')
      .trim()
      .toLowerCase();
    if (raw === '0' || raw === 'false' || raw === 'no') {
      return false;
    }
    if (raw === '1' || raw === 'true' || raw === 'yes') {
      return true;
    }
    return process.env.NODE_ENV !== 'test';
  }

  private getIntervalMinutes() {
    const parsed = Number.parseInt(
      process.env.SCHEDULE_AUTOMATION_INTERVAL_MINUTES || '',
      10,
    );
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return 360;
  }

  private getStartupDelayMs() {
    const parsed = Number.parseInt(
      process.env.SCHEDULE_AUTOMATION_STARTUP_DELAY_MS || '',
      10,
    );
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
    return 10_000;
  }

  private async runMaintenance(reason: 'startup' | 'interval') {
    if (this.running) {
      this.logger.warn('Schedule automation already running, skip this tick.');
      return;
    }
    this.running = true;
    try {
      const rolling = await this.adminService.maintainRollingScheduleWindow(
        'SYSTEM',
      );
      const autoConfirm = await this.adminService.autoConfirmExpiredSchedules(
        'SYSTEM',
      );
      this.logger.log(
        `Schedule automation (${reason}) done. Weeks: ${rolling.totalWeeks}, autoConfirmed: ${autoConfirm.confirmedCount}.`,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`Schedule automation failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
