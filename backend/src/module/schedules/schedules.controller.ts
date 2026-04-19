import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLE } from '../auth/auth.constants';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserPayload } from '../auth/current-user.decorator';
import type { Response } from 'express';

@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.BAC_SI)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('weekly-overview')
  async getWeeklyOverview(
    @CurrentUser() user: CurrentUserPayload,
    @Query('weekStart') weekStart?: string,
  ) {
    return this.schedulesService.getWeeklyOverview(
      this.requireDoctorId(user),
      weekStart,
    );
  }

  @Get('weekly-schedules')
  async getMyWeeklySchedules(
    @CurrentUser() user: CurrentUserPayload,
    @Query('weekStart') weekStart?: string,
  ) {
    return this.schedulesService.getMyWeeklySchedules(
      this.requireDoctorId(user),
      weekStart,
    );
  }

  @Get('weekly-schedules/pdf')
  async exportMyWeeklySchedulesPdf(
    @CurrentUser() user: CurrentUserPayload,
    @Query('weekStart') weekStart?: string,
    @Res() res?: Response,
  ) {
    const result = await this.schedulesService.exportMyWeeklySchedulesPdf(
      this.requireDoctorId(user),
      weekStart,
      user.TK_SDT,
    );
    res?.setHeader('Content-Type', 'application/pdf');
    res?.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res?.send(result.buffer);
  }

  @Get('exception-requests')
  async getMyExceptionRequests(
    @CurrentUser() user: CurrentUserPayload,
    @Query('weekStart') weekStart?: string,
  ) {
    return this.schedulesService.getMyExceptionRequests(
      this.requireDoctorId(user),
      weekStart,
    );
  }

  @Post('weeks/:weekStart/confirm')
  async confirmWeek(
    @CurrentUser() user: CurrentUserPayload,
    @Param('weekStart') weekStart: string,
  ) {
    return this.schedulesService.confirmWeek(
      this.requireDoctorId(user),
      weekStart,
      user.TK_SDT,
    );
  }

  @Post('shifts/:date/:session/confirm')
  async confirmShift(
    @CurrentUser() user: CurrentUserPayload,
    @Param('date') date: string,
    @Param('session') session: string,
  ) {
    return this.schedulesService.confirmShift(
      this.requireDoctorId(user),
      date,
      session,
      user.TK_SDT,
    );
  }

  @Post('exception-requests')
  async createExceptionRequest(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      targetDate: string;
      targetSession: string;
      type: 'leave' | 'shift_change' | 'room_change' | 'other';
      reason: string;
      requestedDate?: string | null;
      requestedSession?: string | null;
      requestedRoomId?: number | null;
      suggestedDoctorId?: number | null;
    },
  ) {
    return this.schedulesService.createExceptionRequest(
      this.requireDoctorId(user),
      body,
      user.TK_SDT,
    );
  }

  private requireDoctorId(user: CurrentUserPayload) {
    if (!user.bsMa) {
      throw new ForbiddenException('Tai khoan hien tai khong phai bac si');
    }
    return user.bsMa;
  }
}
