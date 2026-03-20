import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type CurrentUserPayload } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ROLE } from '../auth/auth.constants';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { PatientProfilesService } from './patient-profiles.service';

@Controller('patient-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.BENH_NHAN)
export class PatientProfilesController {
  constructor(private readonly patientProfiles: PatientProfilesService) {}

  @Get('location-options')
  async getLocationOptions() {
    return this.patientProfiles.getLocationOptions();
  }

  @Get()
  async listMine(@CurrentUser() user: CurrentUserPayload) {
    return this.patientProfiles.listMine(user);
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreatePatientProfileDto,
  ) {
    return this.patientProfiles.create(user, dto);
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.patientProfiles.getDetail(user, id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePatientProfileDto,
  ) {
    return this.patientProfiles.update(user, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.patientProfiles.remove(user, id);
  }

  @Get(':id/appointments')
  async appointments(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.patientProfiles.getAppointments(user, id);
  }

  @Get(':id/health-metrics')
  async healthMetrics(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.patientProfiles.getHealthMetrics(user, id);
  }

  @Get(':id/lab-results')
  async labResults(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.patientProfiles.getLabResults(user, id);
  }

  @Get(':id/imaging-results')
  async imagingResults(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.patientProfiles.getImagingResults(user, id);
  }

  @Get(':id/prescriptions')
  async prescriptions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.patientProfiles.getPrescriptions(user, id);
  }

  @Get(':id/invoices')
  async invoices(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.patientProfiles.getInvoices(user, id);
  }
}
