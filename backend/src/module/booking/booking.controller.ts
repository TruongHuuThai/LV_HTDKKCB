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
    @Query('q') q?: string,
  ): Promise<any> {
    const specId = specialtyId ? parseInt(specialtyId, 10) : undefined;
    return this.booking.getAvailableDoctors(date, specId, q);
  }

  // @ts-ignore
  @Get('doctor-catalog')
  @Roles(ROLE.BENH_NHAN, ROLE.ADMIN)
  async getDoctorCatalog(
    @Query('q') q?: string,
    @Query('specialtyId') specialtyId?: string,
    @Query('degree') degree?: string,
    @Query('gender') gender?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDirection') sortDirection?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<any> {
    const specId = specialtyId ? Number.parseInt(specialtyId, 10) : undefined;
    const pageNumber = page ? Number.parseInt(page, 10) : undefined;
    const pageSizeNumber = pageSize ? Number.parseInt(pageSize, 10) : undefined;

    return this.booking.getDoctorCatalog({
      q,
      specialtyId: Number.isFinite(specId ?? NaN) ? specId : undefined,
      degree: degree?.trim() || undefined,
      gender: gender?.trim() || undefined,
      sortBy: sortBy?.trim() || undefined,
      sortDirection: sortDirection?.trim() || undefined,
      page: Number.isFinite(pageNumber ?? NaN) ? pageNumber : undefined,
      pageSize: Number.isFinite(pageSizeNumber ?? NaN) ? pageSizeNumber : undefined,
    });
  }

  // @ts-ignore
  @Get('debug-availability')
  @Roles(ROLE.BENH_NHAN, ROLE.ADMIN)
  async debugAvailability(
    @Query('date') date: string,
    @Query('specialtyId') specialtyId?: string,
    @Query('q') q?: string,
  ): Promise<any> {
    const specId = specialtyId ? parseInt(specialtyId, 10) : undefined;
    return this.booking.getAvailabilityDebug(date, specId, q);
  }

  // @ts-ignore
  @Get('doctors/:bsMa/slots')
  @Roles(ROLE.BENH_NHAN, ROLE.ADMIN)
  async getDoctorSlots(
    @CurrentUser() user: CurrentUserPayload,
    @Param('bsMa', ParseIntPipe) bsMa: number,
    @Query('date') date: string,
    @Query('BN_MA') BN_MA?: string,
  ): Promise<any> {
    const profileId = BN_MA ? Number.parseInt(BN_MA, 10) : undefined;
    return this.booking.getDoctorSlotsForDay(bsMa, date, {
      user,
      BN_MA: Number.isFinite(profileId ?? NaN) ? profileId : undefined,
    });
  }

  // @ts-ignore
  @Get('doctors/:bsMa/bookable-dates')
  @Roles(ROLE.BENH_NHAN, ROLE.ADMIN)
  async getDoctorBookableDates(
    @Param('bsMa', ParseIntPipe) bsMa: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<any> {
    return this.booking.getDoctorBookableDates(bsMa, { from, to });
  }

  // @ts-ignore
  @Get('service-types')
  @Roles(ROLE.BENH_NHAN, ROLE.ADMIN)
  async getServiceTypes(
    @Query('specialtyId', ParseIntPipe) specialtyId: number,
  ): Promise<any> {
    return this.booking.getServiceTypesBySpecialty(specialtyId);
  }

  // @ts-ignore
  @Get('insurance/bhyt-types')
  @Roles(ROLE.BENH_NHAN, ROLE.ADMIN)
  async getBHYTTypes(): Promise<any> {
    return this.booking.getBHYTTypes();
  }

  // @ts-ignore
  @Get('insurance/private-providers')
  @Roles(ROLE.BENH_NHAN, ROLE.ADMIN)
  async getPrivateInsuranceProviders(@Query('q') q?: string): Promise<any> {
    return this.booking.getPrivateInsuranceProviders(q);
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
