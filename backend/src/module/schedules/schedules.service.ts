import { Injectable } from '@nestjs/common';
import { AdminService } from '../admin/admin.service';

@Injectable()
export class SchedulesService {
  constructor(private readonly adminService: AdminService) {}

  async getWeeklyOverview(bsMa: number, weekStart?: string) {
    return this.adminService.getDoctorWeekOverview(bsMa, weekStart);
  }

  async getMyWeeklySchedules(bsMa: number, weekStart?: string) {
    return this.adminService.getDoctorWeeklySchedules(bsMa, weekStart);
  }

  async exportMyWeeklySchedulesPdf(bsMa: number, weekStart?: string, exportedBy?: string) {
    return this.adminService.exportDoctorWeeklySchedulePdf(bsMa, weekStart, exportedBy);
  }

  async getMyExceptionRequests(bsMa: number, weekStart?: string) {
    return this.adminService.getDoctorScheduleExceptionRequests(bsMa, weekStart);
  }

  async confirmWeek(bsMa: number, weekStart: string, actor?: string) {
    return this.adminService.confirmDoctorWeekSchedule(bsMa, weekStart, actor);
  }

  async confirmShift(bsMa: number, date: string, session: string, actor?: string) {
    return this.adminService.confirmDoctorShift(bsMa, date, session, actor);
  }

  async createExceptionRequest(
    bsMa: number,
    dto: {
      targetDate: string;
      targetSession: string;
      type: 'leave' | 'shift_change' | 'room_change' | 'other';
      reason: string;
      requestedDate?: string | null;
      requestedSession?: string | null;
      requestedRoomId?: number | null;
      suggestedDoctorId?: number | null;
    },
    actor?: string,
  ) {
    return this.adminService.createDoctorScheduleExceptionRequest(bsMa, dto, actor);
  }

}
