import { Injectable } from '@nestjs/common';
import { AdminService } from '../admin/admin.service';
import { RegisterScheduleDto } from './dto/register-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(private readonly adminService: AdminService) {}

  async getRegistrationCycle(bsMa: number) {
    return this.adminService.getDoctorScheduleCycleOverview(bsMa);
  }

  async getRegistrationOptions(bsMa: number) {
    return this.adminService.getDoctorScheduleRegistrationOptions(bsMa);
  }

  async getMyRegistrations(bsMa: number, weekStart?: string) {
    return this.adminService.getDoctorScheduleRegistrations(bsMa, weekStart);
  }

  async getMyOfficialShifts(bsMa: number, weekStart?: string) {
    return this.adminService.getDoctorOfficialSchedules(bsMa, weekStart);
  }

  async getRegistrationDayContext(
    bsMa: number,
    params: {
      date?: string;
      roomId?: string;
      excludeDate?: string;
      excludeSession?: string;
    },
  ) {
    return this.adminService.getDoctorRegistrationDayContext(bsMa, params);
  }

  async register(bsMa: number, dto: RegisterScheduleDto) {
    return this.adminService.createDoctorRegistration(bsMa, dto);
  }

  async updateRegistration(
    bsMa: number,
    date: string,
    session: string,
    dto: RegisterScheduleDto,
  ) {
    return this.adminService.updateDoctorRegistration(bsMa, date, session, dto);
  }

  async cancelRegistration(bsMa: number, date: string, session: string) {
    return this.adminService.cancelDoctorRegistration(bsMa, date, session);
  }

  async getMySchedules(bsMa: number, weekStart?: string) {
    return this.getMyRegistrations(bsMa, weekStart);
  }
}
