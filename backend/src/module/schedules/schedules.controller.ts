import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { RegisterScheduleDto } from './dto/register-schedule.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLE } from '../auth/auth.constants';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserPayload } from '../auth/current-user.decorator';

@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.BAC_SI)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('registration-cycle')
  async getRegistrationCycle(@CurrentUser() user: CurrentUserPayload) {
    return this.schedulesService.getRegistrationCycle(this.requireDoctorId(user));
  }

  @Get('registration-options')
  async getRegistrationOptions(@CurrentUser() user: CurrentUserPayload) {
    return this.schedulesService.getRegistrationOptions(this.requireDoctorId(user));
  }

  @Get('my-registrations')
  async getMyRegistrations(
    @CurrentUser() user: CurrentUserPayload,
    @Query('weekStart') weekStart?: string,
  ) {
    return this.schedulesService.getMyRegistrations(
      this.requireDoctorId(user),
      weekStart,
    );
  }

  @Get('my-official-shifts')
  async getMyOfficialShifts(
    @CurrentUser() user: CurrentUserPayload,
    @Query('weekStart') weekStart?: string,
  ) {
    return this.schedulesService.getMyOfficialShifts(
      this.requireDoctorId(user),
      weekStart,
    );
  }

  @Get('day-context')
  async getRegistrationDayContext(
    @CurrentUser() user: CurrentUserPayload,
    @Query('date') date?: string,
    @Query('roomId') roomId?: string,
    @Query('excludeDate') excludeDate?: string,
    @Query('excludeSession') excludeSession?: string,
  ) {
    return this.schedulesService.getRegistrationDayContext(
      this.requireDoctorId(user),
      {
        date,
        roomId,
        excludeDate,
        excludeSession,
      },
    );
  }

  @Post('registrations')
  async createRegistration(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RegisterScheduleDto,
  ) {
    return this.schedulesService.register(this.requireDoctorId(user), dto);
  }

  @Put('registrations/:date/:session')
  async updateRegistration(
    @CurrentUser() user: CurrentUserPayload,
    @Param('date') date: string,
    @Param('session') session: string,
    @Body() dto: RegisterScheduleDto,
  ) {
    return this.schedulesService.updateRegistration(
      this.requireDoctorId(user),
      date,
      session,
      dto,
    );
  }

  @Delete('registrations/:date/:session')
  async cancelRegistration(
    @CurrentUser() user: CurrentUserPayload,
    @Param('date') date: string,
    @Param('session') session: string,
  ) {
    return this.schedulesService.cancelRegistration(
      this.requireDoctorId(user),
      date,
      session,
    );
  }

  @Post('register')
  async register(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: RegisterScheduleDto,
  ) {
    return this.schedulesService.register(this.requireDoctorId(user), dto);
  }

  @Get('my-schedules')
  async getMySchedules(
    @CurrentUser() user: CurrentUserPayload,
    @Query('weekStart') weekStart?: string,
  ) {
    return this.schedulesService.getMySchedules(
      this.requireDoctorId(user),
      weekStart,
    );
  }

  private requireDoctorId(user: CurrentUserPayload) {
    if (!user.bsMa) {
      throw new ForbiddenException('Tai khoan hien tai khong phai bac si');
    }
    return user.bsMa;
  }
}
