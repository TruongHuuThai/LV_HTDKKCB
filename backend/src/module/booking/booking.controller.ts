// src/modules/booking/booking.controller.ts
import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ROLE } from '../auth/auth.constants';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/current-user.decorator';

@Controller('booking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingController {
  constructor(private readonly booking: BookingService) { }

  // @ts-ignore
  @Get('availability')
  @Roles(ROLE.BENH_NHAN, ROLE.ADMIN)
  async availability(
    // @ts-ignore
    @Query('BS_MA', ParseIntPipe) BS_MA: number,
    // @ts-ignore
    @Query('N_NGAY') N_NGAY: string,
    // @ts-ignore
    @Query('B_TEN') B_TEN: string,
  ): Promise<any> {
    return this.booking.getAvailability(BS_MA, N_NGAY, B_TEN);
  }

  // @ts-ignore
  @Get('doctors')
  @Roles(ROLE.BENH_NHAN, ROLE.ADMIN)
  async getDoctors(
    @Query('date') date?: string,
    @Query('specialtyId') specialtyId?: string,
  ): Promise<any> {
    const specId = specialtyId ? parseInt(specialtyId, 10) : undefined;
    return this.booking.getAvailableDoctors(date, specId);
  }

  // @ts-ignore
  @Get('debug-availability')
  @Roles(ROLE.BENH_NHAN, ROLE.ADMIN)
  async debugAvailability(
    @Query('date') date: string,
    @Query('specialtyId') specialtyId?: string,
  ): Promise<any> {
    const specId = specialtyId ? parseInt(specialtyId, 10) : undefined;
    return this.booking.getAvailabilityDebug(date, specId);
  }

  // @ts-ignore
  @Get('doctors/:bsMa/slots')
  @Roles(ROLE.BENH_NHAN, ROLE.ADMIN)
  async getDoctorSlots(
    @Param('bsMa', ParseIntPipe) bsMa: number,
    @Query('date') date: string,
  ): Promise<any> {
    return this.booking.getDoctorSlotsForDay(bsMa, date);
  }

  // @ts-ignore
  @Post()
  @Roles(ROLE.BENH_NHAN)
  async create(
    // @ts-ignore
    @CurrentUser() user: CurrentUserPayload,
    // @ts-ignore
    @Body() dto: CreateBookingDto,
    // @ts-ignore
    @Ip() ip: string,
  ): Promise<any> {
    return this.booking.createByUser(user, dto, ip);
  }

  // @ts-ignore
  @Get('my')
  @Roles(ROLE.BENH_NHAN)
  async my(
    // @ts-ignore
    @CurrentUser() user: CurrentUserPayload,
    @Query('BN_MA') BN_MA?: string,
  ): Promise<any> {
    const patientId = BN_MA ? parseInt(BN_MA, 10) : undefined;
    return this.booking.listMyBookings(user, patientId);
  }

  // @ts-ignore
  @Patch(':DK_MA/cancel')
  @Roles(ROLE.BENH_NHAN, ROLE.ADMIN)
  async cancel(
    // @ts-ignore
    @CurrentUser() user: CurrentUserPayload,
    // @ts-ignore
    @Param('DK_MA', ParseIntPipe) DK_MA: number,
    // @ts-ignore
    @Body() dto: CancelBookingDto,
  ): Promise<any> {
    return this.booking.cancel(user, DK_MA, dto.DK_LY_DO_HUY);
  }
}
