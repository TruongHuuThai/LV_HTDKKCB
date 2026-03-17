import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
// Note: Assuming you have a JwtAuthGuard and RolesGuard setup for admin
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('ADMIN') // Requires an admin role - adjust based on your actual auth setup
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/summary')
  @HttpCode(HttpStatus.OK)
  async getDashboardSummary() {
    return this.adminService.getDashboardSummary();
  }

  @Get('dashboard/chart-data')
  @HttpCode(HttpStatus.OK)
  async getChartData(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.adminService.getChartData(year, month);
  }

  @Get('dashboard/visits')
  @HttpCode(HttpStatus.OK)
  async getDashboardVisits(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('specialtyId') specialtyId?: string,
  ) {
    return this.adminService.getDashboardVisits(year, month, specialtyId);
  }

  @Get('dashboard/time-slots')
  @HttpCode(HttpStatus.OK)
  async getDashboardTimeSlots(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.adminService.getDashboardTimeSlots(year, month);
  }

  @Get('dashboard/revenue')
  @HttpCode(HttpStatus.OK)
  async getDashboardRevenue(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.adminService.getDashboardRevenue(year, month);
  }

  @Get('specialties')
  @HttpCode(HttpStatus.OK)
  async getSpecialties(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.adminService.getSpecialties({
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    });
  }

  @Get('specialties/:id')
  @HttpCode(HttpStatus.OK)
  async getSpecialtyById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getSpecialtyById(id);
  }

  @Post('specialties')
  @HttpCode(HttpStatus.CREATED)
  async createSpecialty(@Body() dto: CreateSpecialtyDto) {
    return this.adminService.createSpecialty(dto);
  }

  @Put('specialties/:id')
  @HttpCode(HttpStatus.OK)
  async updateSpecialty(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSpecialtyDto,
  ) {
    return this.adminService.updateSpecialty(id, dto);
  }

  @Delete('specialties/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSpecialty(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteSpecialty(id);
  }

  @Get('services')
  @HttpCode(HttpStatus.OK)
  async getServices(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('serviceType') serviceType?: string,
  ) {
    return this.adminService.getServices({
      search,
      page,
      limit,
      sortBy,
      sortOrder,
      minPrice,
      maxPrice,
      serviceType,
    });
  }

  @Get('services/:id')
  @HttpCode(HttpStatus.OK)
  async getServiceById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getServiceById(id);
  }

  @Post('services')
  @HttpCode(HttpStatus.CREATED)
  async createService(@Body() dto: CreateServiceDto) {
    return this.adminService.createService(dto);
  }

  @Put('services/:id')
  @HttpCode(HttpStatus.OK)
  async updateService(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.adminService.updateService(id, dto);
  }

  @Delete('services/:id')
  @HttpCode(HttpStatus.OK)
  async deleteService(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteService(id);
  }

  @Get('doctors')
  @HttpCode(HttpStatus.OK)
  async getDoctors(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('specialtyId') specialtyId?: string,
    @Query('academicTitle') academicTitle?: string,
  ) {
    return this.adminService.getDoctors({
      search,
      page,
      limit,
      sortBy,
      sortOrder,
      specialtyId,
      academicTitle,
    });
  }

  @Get('doctors/academic-titles')
  @HttpCode(HttpStatus.OK)
  async getDoctorAcademicTitles() {
    return this.adminService.getDoctorAcademicTitles();
  }

  @Get('doctors/:id')
  @HttpCode(HttpStatus.OK)
  async getDoctorById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getDoctorById(id);
  }

  @Post('doctors')
  @HttpCode(HttpStatus.CREATED)
  async createDoctor(@Body() dto: CreateDoctorDto) {
    return this.adminService.createDoctor(dto);
  }

  @Put('doctors/:id')
  @HttpCode(HttpStatus.OK)
  async updateDoctor(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDoctorDto,
  ) {
    return this.adminService.updateDoctor(id, dto);
  }

  @Delete('doctors/:id')
  @HttpCode(HttpStatus.OK)
  async deleteDoctor(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteDoctor(id);
  }

  @Get('patients')
  @HttpCode(HttpStatus.OK)
  async getPatients(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('gender') gender?: string,
    @Query('nationality') nationality?: string,
    @Query('ethnicity') ethnicity?: string,
    @Query('patientType') patientType?: string,
    @Query('accountPhone') accountPhone?: string,
  ) {
    return this.adminService.getPatients({
      search,
      page,
      limit,
      sortBy,
      sortOrder,
      gender,
      nationality,
      ethnicity,
      patientType,
      accountPhone,
    });
  }

  @Get('patients/filter-options')
  @HttpCode(HttpStatus.OK)
  async getPatientFilterOptions() {
    return this.adminService.getPatientFilterOptions();
  }

  @Get('patients/:id')
  @HttpCode(HttpStatus.OK)
  async getPatientById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getPatientById(id);
  }

  @Post('patients')
  @HttpCode(HttpStatus.CREATED)
  async createPatient(@Body() dto: CreatePatientDto) {
    return this.adminService.createPatient(dto);
  }

  @Put('patients/:id')
  @HttpCode(HttpStatus.OK)
  async updatePatient(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.adminService.updatePatient(id, dto);
  }

  @Delete('patients/:id')
  @HttpCode(HttpStatus.OK)
  async deletePatient(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deletePatient(id);
  }

  @Get('accounts')
  @HttpCode(HttpStatus.OK)
  async getAccounts(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
    @Query('deletedStatus') deletedStatus?: string,
  ) {
    return this.adminService.getAccounts({
      search,
      page,
      limit,
      role,
      deletedStatus,
    });
  }

  @Get('accounts/:id')
  @HttpCode(HttpStatus.OK)
  async getAccountById(@Param('id') id: string) {
    return this.adminService.getAccountById(id);
  }

  @Post('accounts')
  @HttpCode(HttpStatus.CREATED)
  async createAccount(@Body() dto: CreateAccountDto) {
    return this.adminService.createAccount(dto);
  }

  @Put('accounts/:id')
  @HttpCode(HttpStatus.OK)
  async updateAccount(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.adminService.updateAccount(id, dto);
  }

  @Delete('accounts/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@Param('id') id: string) {
    return this.adminService.deleteAccount(id);
  }

  @Get('schedule-management/options')
  @HttpCode(HttpStatus.OK)
  async getScheduleManagementOptions() {
    return this.adminService.getScheduleManagementOptions();
  }

  @Get('schedule-management/cycle-overview')
  @HttpCode(HttpStatus.OK)
  async getScheduleCycleOverview(@Query('weekStart') weekStart?: string) {
    return this.adminService.getScheduleCycleOverview(weekStart);
  }

  @Get('schedule-management/registrations')
  @HttpCode(HttpStatus.OK)
  async getScheduleRegistrations(
    @Query('weekStart') weekStart?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('specialtyId') specialtyId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('roomId') roomId?: string,
    @Query('status') status?: string,
    @Query('session') session?: string,
    @Query('date') date?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getScheduleRegistrations({
      weekStart,
      page,
      limit,
      specialtyId,
      doctorId,
      roomId,
      status,
      session,
      date,
      search,
    });
  }

  @Put('schedule-management/registrations/:bsMa/:date/:session/status')
  @HttpCode(HttpStatus.OK)
  async updateScheduleRegistrationStatus(
    @Param('bsMa', ParseIntPipe) bsMa: number,
    @Param('date') date: string,
    @Param('session') session: string,
    @Body() body: { status: 'approved' | 'rejected'; adminNote?: string },
  ) {
    return this.adminService.updateScheduleRegistrationStatus(bsMa, date, session, body);
  }

  @Get('schedule-management/official-shifts')
  @HttpCode(HttpStatus.OK)
  async getOfficialSchedules(
    @Query('weekStart') weekStart?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('specialtyId') specialtyId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('roomId') roomId?: string,
    @Query('status') status?: string,
    @Query('session') session?: string,
    @Query('weekday') weekday?: string,
    @Query('date') date?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getOfficialSchedules({
      weekStart,
      page,
      limit,
      specialtyId,
      doctorId,
      roomId,
      status,
      session,
      weekday,
      date,
      search,
    });
  }

  @Get('schedule-management/form-context')
  @HttpCode(HttpStatus.OK)
  async getOfficialShiftFormContext(
    @Query('date') date?: string,
    @Query('roomId') roomId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('excludeBsMa') excludeBsMa?: string,
    @Query('excludeDate') excludeDate?: string,
    @Query('excludeSession') excludeSession?: string,
  ) {
    return this.adminService.getOfficialShiftFormContext({
      date,
      roomId,
      doctorId,
      excludeBsMa,
      excludeDate,
      excludeSession,
    });
  }

  @Post('schedule-management/official-shifts')
  @HttpCode(HttpStatus.CREATED)
  async createOfficialSchedule(
    @Body()
    body: {
      BS_MA: number;
      P_MA: number;
      N_NGAY: string;
      B_TEN: string;
      note?: string;
      status?: 'approved' | 'official';
    },
  ) {
    return this.adminService.createOfficialSchedule(body);
  }

  @Put('schedule-management/official-shifts/:bsMa/:date/:session')
  @HttpCode(HttpStatus.OK)
  async updateOfficialSchedule(
    @Param('bsMa', ParseIntPipe) bsMa: number,
    @Param('date') date: string,
    @Param('session') session: string,
    @Body()
    body: {
      BS_MA?: number;
      P_MA?: number;
      N_NGAY?: string;
      B_TEN?: string;
      note?: string;
      status?: 'approved' | 'official';
    },
  ) {
    return this.adminService.updateOfficialSchedule(bsMa, date, session, body);
  }

  @Delete('schedule-management/official-shifts/:bsMa/:date/:session')
  @HttpCode(HttpStatus.OK)
  async deleteOfficialSchedule(
    @Param('bsMa', ParseIntPipe) bsMa: number,
    @Param('date') date: string,
    @Param('session') session: string,
  ) {
    return this.adminService.deleteOfficialSchedule(bsMa, date, session);
  }

  @Post('schedule-management/cycles/:weekStart/finalize')
  @HttpCode(HttpStatus.OK)
  async finalizeScheduleWeek(
    @Param('weekStart') weekStart: string,
    @Body()
    body?: {
      forceRefinalize?: boolean;
      generateSlots?: boolean;
      forceRegenerate?: boolean;
    },
  ) {
    return this.adminService.finalizeScheduleWeek(weekStart, body);
  }

  @Post('schedule-management/cycles/:weekStart/generate-slots')
  @HttpCode(HttpStatus.OK)
  async generateSlotsFromOfficialSchedule(
    @Param('weekStart') weekStart: string,
    @Body() body?: { forceRegenerate?: boolean },
  ) {
    return this.adminService.generateSlotsFromOfficialSchedule(weekStart, body);
  }
}
