import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
export class SchedulesController {
    constructor(private readonly schedulesService: SchedulesService) { }

    @Post('register')
    @Roles(ROLE.BAC_SI)
    async register(
        @CurrentUser() user: CurrentUserPayload,
        @Body() dto: RegisterScheduleDto,
    ) {
        // Chỉ có bác sĩ mới đăng ký được lịch cho mình
        if (!user.bsMa) {
            throw new Error('Not a doctor');
        }
        return this.schedulesService.register(user.bsMa, dto);
    }

    @Get('my-schedules')
    @Roles(ROLE.BAC_SI)
    async getMySchedules(
        @CurrentUser() user: CurrentUserPayload,
        @Query('fromDate') fromDate?: string,
        @Query('toDate') toDate?: string,
    ) {
        if (!user.bsMa) {
            throw new Error('Not a doctor');
        }
        return this.schedulesService.getMySchedules(user.bsMa, fromDate, toDate);
    }
}
