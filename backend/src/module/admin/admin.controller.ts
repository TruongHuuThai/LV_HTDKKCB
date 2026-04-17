import {
  Body,
  Controller,
  Delete,
  Get,
  Res,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
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
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { UpdateMedicineBrandInfoDto } from './dto/update-medicine-brand-info.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLE } from '../auth/auth.constants';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
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

  @Get('rooms')
  @HttpCode(HttpStatus.OK)
  async getRooms(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('specialtyId') specialtyId?: string,
  ) {
    return this.adminService.getRooms({
      search,
      page,
      limit,
      sortBy,
      sortOrder,
      specialtyId,
    });
  }

  @Get('rooms/:id')
  @HttpCode(HttpStatus.OK)
  async getRoomById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getRoomById(id);
  }

  @Post('rooms')
  @HttpCode(HttpStatus.CREATED)
  async createRoom(@Body() dto: CreateRoomDto) {
    return this.adminService.createRoom(dto);
  }

  @Put('rooms/:id')
  @HttpCode(HttpStatus.OK)
  async updateRoom(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.adminService.updateRoom(id, dto);
  }

  @Delete('rooms/:id')
  @HttpCode(HttpStatus.OK)
  async deleteRoom(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteRoom(id);
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

  @Get('medicines')
  @HttpCode(HttpStatus.OK)
  async getMedicines(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('groupId') groupId?: string,
    @Query('manufacturerId') manufacturerId?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('expirationStatus') expirationStatus?: string,
  ) {
    return this.adminService.getMedicines({
      search,
      page,
      limit,
      sortBy,
      sortOrder,
      groupId,
      manufacturerId,
      minPrice,
      maxPrice,
      expirationStatus,
    });
  }

  @Get('medicines/filter-options')
  @HttpCode(HttpStatus.OK)
  async getMedicineFilterOptions() {
    return this.adminService.getMedicineFilterOptions();
  }

  @Get('medicines/:id')
  @HttpCode(HttpStatus.OK)
  async getMedicineById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getMedicineById(id);
  }

  @Post('medicines')
  @HttpCode(HttpStatus.CREATED)
  async createMedicine(@Body() dto: CreateMedicineDto) {
    return this.adminService.createMedicine(dto);
  }

  @Put('medicines/:id')
  @HttpCode(HttpStatus.OK)
  async updateMedicine(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMedicineDto,
  ) {
    return this.adminService.updateMedicine(id, dto);
  }

  @Put('medicines/:id/brand-info')
  @HttpCode(HttpStatus.OK)
  async updateMedicineBrandInfo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMedicineBrandInfoDto,
  ) {
    return this.adminService.updateMedicineBrandInfo(id, dto);
  }

  @Delete('medicines/:id')
  @HttpCode(HttpStatus.OK)
  async deleteMedicine(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteMedicine(id);
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

  @Get('doctors/pdf')
  @HttpCode(HttpStatus.OK)
  async exportDoctorsPdf(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('specialtyId') specialtyId?: string,
    @Query('academicTitle') academicTitle?: string,
    @Res() res?: Response,
  ) {
    const result = await this.adminService.exportDoctorsPdf(
      {
        search,
        sortBy,
        sortOrder,
        specialtyId,
        academicTitle,
      },
      user.TK_SDT,
    );
    res?.setHeader('Content-Type', 'application/pdf');
    res?.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res?.send(result.buffer);
  }

  @Get('doctors/:id')
  @HttpCode(HttpStatus.OK)
  async getDoctorById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getDoctorById(id);
  }

  @Get('doctors/:id/pdf')
  @HttpCode(HttpStatus.OK)
  async exportDoctorProfilePdf(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Res() res?: Response,
  ) {
    const result = await this.adminService.exportDoctorProfilePdf(id, user.TK_SDT);
    res?.setHeader('Content-Type', 'application/pdf');
    res?.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res?.send(result.buffer);
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

  @Get('patients/pdf')
  @HttpCode(HttpStatus.OK)
  async exportPatientsPdf(
    @CurrentUser() user: CurrentUserPayload,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('gender') gender?: string,
    @Query('nationality') nationality?: string,
    @Query('ethnicity') ethnicity?: string,
    @Query('patientType') patientType?: string,
    @Query('accountPhone') accountPhone?: string,
    @Res() res?: Response,
  ) {
    const result = await this.adminService.exportPatientsPdf(
      {
        search,
        sortBy,
        sortOrder,
        gender,
        nationality,
        ethnicity,
        patientType,
        accountPhone,
      },
      user.TK_SDT,
    );
    res?.setHeader('Content-Type', 'application/pdf');
    res?.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res?.send(result.buffer);
  }

  @Get('patients/:id')
  @HttpCode(HttpStatus.OK)
  async getPatientById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getPatientById(id);
  }

  @Get('patients/:id/pdf')
  @HttpCode(HttpStatus.OK)
  async exportPatientProfilePdf(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Res() res?: Response,
  ) {
    const result = await this.adminService.exportPatientProfilePdf(id, user.TK_SDT);
    res?.setHeader('Content-Type', 'application/pdf');
    res?.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res?.send(result.buffer);
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

  @Get('schedule-management/planning/existing')
  @HttpCode(HttpStatus.OK)
  async getSchedulePlanningExisting(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('specialtyId') specialtyId?: string,
  ) {
    return this.adminService.getSchedulePlanningExisting({
      dateFrom: dateFrom || '',
      dateTo: dateTo || '',
      specialtyId,
    });
  }

  @Post('schedule-management/planning/drafts')
  @HttpCode(HttpStatus.CREATED)
  async createSchedulePlanningDraft(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      dateFrom: string;
      dateTo: string;
      specialtyId: number;
      assignments: Array<{
        date: string;
        session: string;
        roomId: number;
        doctorId: number;
      }>;
    },
  ) {
    return this.adminService.createSchedulePlanningDraft(body, user.TK_SDT);
  }

  @Put('schedule-management/planning/drafts/:id')
  @HttpCode(HttpStatus.OK)
  async updateSchedulePlanningDraft(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      dateFrom: string;
      dateTo: string;
      specialtyId: number;
      assignments: Array<{
        date: string;
        session: string;
        roomId: number;
        doctorId: number;
      }>;
    },
  ) {
    return this.adminService.updateSchedulePlanningDraft(id, body, user.TK_SDT);
  }

  @Get('schedule-management/planning/drafts/:id')
  @HttpCode(HttpStatus.OK)
  async getSchedulePlanningDraft(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getSchedulePlanningDraft(id);
  }

  @Get('schedule-management/planning/drafts')
  @HttpCode(HttpStatus.OK)
  async getLatestSchedulePlanningDraft(@Query('specialtyId') specialtyId?: string) {
    return this.adminService.getLatestSchedulePlanningDraft({ specialtyId });
  }

  @Post('schedule-management/planning/generate')
  @HttpCode(HttpStatus.OK)
  async generateSchedulePlanning(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      dateFrom: string;
      dateTo: string;
      specialtyId: number;
      assignments: Array<{
        date: string;
        session: string;
        roomId: number;
        doctorId: number;
      }>;
      overwriteMode?: 'skip' | 'overwrite' | 'only_empty';
      status?: 'approved' | 'official';
    },
  ) {
    return this.adminService.generateSchedulePlanning(body, user.TK_SDT);
  }

  @Post('schedule-management/archive')
  @HttpCode(HttpStatus.OK)
  async archiveSchedules(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      dateFrom: string;
      dateTo: string;
      specialtyId?: number;
      source?: string;
      reason?: string;
      confirm?: boolean;
    },
  ) {
    return this.adminService.archiveSchedules(body, user.TK_SDT);
  }

  @Post('schedule-management/archive/restore')
  @HttpCode(HttpStatus.OK)
  async restoreArchivedSchedules(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      dateFrom: string;
      dateTo: string;
      specialtyId: number;
      confirm?: boolean;
    },
  ) {
    return this.adminService.restoreArchivedSchedules(body, user.TK_SDT);
  }

  @Post('schedule-management/copy-week')
  @HttpCode(HttpStatus.OK)
  async copyWeekToFutureMonths(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      sourceWeekStart: string;
      specialtyId: number;
      copyRangeOption: 'ONE_MONTH' | 'TWO_MONTHS' | 'THREE_MONTHS';
      conflictMode: 'SKIP_EXISTING' | 'ARCHIVE_OLD_GENERATED' | 'ONLY_EMPTY';
      confirm?: boolean;
    },
  ) {
    return this.adminService.copyWeekToFutureMonths(body, user.TK_SDT);
  }

  @Get('schedule-management/templates')
  @HttpCode(HttpStatus.OK)
  async getScheduleTemplates(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('doctorId') doctorId?: string,
    @Query('specialtyId') specialtyId?: string,
    @Query('roomId') roomId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getScheduleTemplates({
      page,
      limit,
      doctorId,
      specialtyId,
      roomId,
      status,
      search,
    });
  }

  @Post('schedule-management/templates')
  @HttpCode(HttpStatus.CREATED)
  async createScheduleTemplate(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      BS_MA: number;
      CK_MA: number;
      P_MA: number;
      B_TEN: string;
      weekday: number;
      effectiveStartDate: string;
      effectiveEndDate?: string | null;
      status?: 'active' | 'inactive';
      note?: string;
    },
  ) {
    return this.adminService.createScheduleTemplate(body, user.TK_SDT);
  }

  @Put('schedule-management/templates/:id')
  @HttpCode(HttpStatus.OK)
  async updateScheduleTemplate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      BS_MA?: number;
      CK_MA?: number;
      P_MA?: number;
      B_TEN?: string;
      weekday?: number;
      effectiveStartDate?: string;
      effectiveEndDate?: string | null;
      status?: 'active' | 'inactive';
      note?: string | null;
    },
  ) {
    return this.adminService.updateScheduleTemplate(id, body, user.TK_SDT);
  }

  @Post('schedule-management/cycles/:weekStart/generate-from-templates')
  @HttpCode(HttpStatus.OK)
  async generateWeeklySchedulesFromTemplates(
    @Param('weekStart') weekStart: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.adminService.generateWeeklySchedulesFromTemplates(
      weekStart,
      user.TK_SDT,
    );
  }

  @Post('schedule-management/cycles/:weekStart/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmWeeklySchedulesByAdmin(
    @Param('weekStart') weekStart: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() body?: { doctorId?: number },
  ) {
    return this.adminService.confirmGeneratedSchedulesByAdmin(
      weekStart,
      user.TK_SDT,
      body,
    );
  }

  @Get('schedule-management/cycle-overview')
  @HttpCode(HttpStatus.OK)
  async getScheduleCycleOverview(@Query('weekStart') weekStart?: string) {
    return this.adminService.getScheduleCycleOverview(weekStart);
  }

  @Get('schedule-management/weekly-shifts')
  @HttpCode(HttpStatus.OK)
  async getWeeklySchedules(
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
    @Query('source') source?: string,
  ) {
    return this.adminService.getWeeklySchedules({
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
      source,
    });
  }

  @Get('schedule-management/weekly-shifts/pdf')
  @HttpCode(HttpStatus.OK)
  async exportWeeklySchedulesPdf(
    @CurrentUser() user: CurrentUserPayload,
    @Query('weekStart') weekStart?: string,
    @Query('specialtyId') specialtyId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('roomId') roomId?: string,
    @Query('status') status?: string,
    @Query('session') session?: string,
    @Query('weekday') weekday?: string,
    @Query('date') date?: string,
    @Query('search') search?: string,
    @Query('source') source?: string,
    @Res() res?: Response,
  ) {
    const result = await this.adminService.exportWeeklySchedulePdf(
      {
        weekStart,
        specialtyId,
        doctorId,
        roomId,
        status,
        session,
        weekday,
        date,
        search,
        source,
      },
      user.TK_SDT,
    );
    res?.setHeader('Content-Type', 'application/pdf');
    res?.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res?.send(result.buffer);
  }

  @Get('schedule-management/exception-requests')
  @HttpCode(HttpStatus.OK)
  async getScheduleExceptionRequests(
    @Query('weekStart') weekStart?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('doctorId') doctorId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getScheduleExceptionRequests({
      weekStart,
      page,
      limit,
      doctorId,
      status,
      search,
    });
  }

  @Put('schedule-management/exception-requests/:id/review')
  @HttpCode(HttpStatus.OK)
  async reviewScheduleExceptionRequest(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { status: 'approved' | 'rejected'; adminNote?: string },
  ) {
    return this.adminService.reviewScheduleExceptionRequest(id, body, user.TK_SDT);
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
    @CurrentUser() _user: CurrentUserPayload,
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
    @CurrentUser() _user: CurrentUserPayload,
    @Body() body?: { forceRegenerate?: boolean },
  ) {
    return this.adminService.generateSlotsFromOfficialSchedule(weekStart, body);
  }

  @Post('schedule-management/automation/run')
  @HttpCode(HttpStatus.OK)
  async runScheduleAutomation(@CurrentUser() user: CurrentUserPayload) {
    return this.adminService.runScheduleAutomation(user.TK_SDT);
  }

  @Get('reports/support-catalog/pdf')
  @HttpCode(HttpStatus.OK)
  async exportSupportCatalogPdf(
    @CurrentUser() user: CurrentUserPayload,
    @Res() res?: Response,
  ) {
    const result = await this.adminService.exportSupportCatalogPdf(user.TK_SDT);
    res?.setHeader('Content-Type', 'application/pdf');
    res?.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res?.send(result.buffer);
  }
}
