// src/modules/booking/booking.controller.ts
import {
  Body,
  Controller,
  Get,
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
  constructor(private readonly booking: BookingService) {}

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
  @Post()
  @Roles(ROLE.BENH_NHAN)
  async create(
    // @ts-ignore
    @CurrentUser() user: CurrentUserPayload,
    // @ts-ignore
    @Body() dto: CreateBookingDto,
  ): Promise<any> {
    return this.booking.createByUser(user, dto);
  }

  // @ts-ignore
  @Get('my')
  @Roles(ROLE.BENH_NHAN)
  async my(
    // @ts-ignore
    @CurrentUser() user: CurrentUserPayload
  ): Promise<any> {
    return this.booking.listMyBookings(user);
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
