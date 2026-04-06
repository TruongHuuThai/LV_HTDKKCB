import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ROLE } from '../auth/auth.constants';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import {
  AdminWaitlistListQueryDto,
  AdminAppointmentListQueryDto,
  CancelAppointmentDto,
  DoctorUpdateAppointmentStatusDto,
  DoctorWorklistQueryDto,
  JoinWaitlistDto,
  ManualBookingDto,
  NotificationListQueryDto,
  PatientAppointmentListQueryDto,
  PatientWaitlistListQueryDto,
  RefundListQueryDto,
  RescheduleAppointmentDto,
  UpdateRefundStatusDto,
  UpdateAppointmentStatusDto,
} from './appointments.dto';
import { AppointmentsService } from './appointments.service';

@Controller('admin/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
export class AdminAppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  async list(@Query() query: AdminAppointmentListQueryDto) {
    return this.appointments.listForAdmin(query);
  }

  @Get('waitlist')
  async waitlist(@Query() query: AdminWaitlistListQueryDto) {
    return this.appointments.listWaitlistForAdmin(query);
  }

  @Get(':appointmentId')
  async detail(@Param('appointmentId', ParseIntPipe) appointmentId: number) {
    return this.appointments.getDetailForAdmin(appointmentId);
  }

  @Patch(':appointmentId/status')
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointments.updateStatusByAdmin(user, appointmentId, dto);
  }

  @Post('manual-booking')
  async manualBooking(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ManualBookingDto,
    @Ip() ip: string,
  ) {
    return this.appointments.manualBookingByAdmin(user, dto, ip);
  }

  @Post(':appointmentId/cancel')
  async cancelByAdmin(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointments.cancelAppointment(user, appointmentId, dto, 'ADMIN');
  }
}

@Controller('admin/refunds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
export class AdminRefundsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  async list(@Query() query: RefundListQueryDto) {
    return this.appointments.listRefundsForAdmin(query);
  }

  @Get(':refundId')
  async detail(@Param('refundId', ParseIntPipe) refundId: number) {
    return this.appointments.getRefundDetailForAdmin(refundId);
  }

  @Patch(':refundId/status')
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('refundId', ParseIntPipe) refundId: number,
    @Body() dto: UpdateRefundStatusDto,
  ) {
    return this.appointments.updateRefundStatusByAdmin(user, refundId, dto);
  }
}

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.BENH_NHAN)
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('my')
  async myAppointments(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PatientAppointmentListQueryDto,
  ) {
    return this.appointments.listMyAppointments(user, query);
  }

  @Get(':appointmentId')
  async myAppointmentDetail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
  ) {
    return this.appointments.getAppointmentDetailForPatient(user, appointmentId);
  }

  @Patch(':appointmentId/reschedule')
  async reschedule(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    return this.appointments.rescheduleByPatient(user, appointmentId, dto);
  }

  @Get(':appointmentId/payment-status')
  async paymentStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
  ) {
    return this.appointments.getPaymentStatusByPatient(user, appointmentId);
  }

  @Post(':appointmentId/payment-retry')
  async paymentRetry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Ip() ip: string,
  ) {
    return this.appointments.retryPaymentByPatient(user, appointmentId, ip);
  }

  @Get(':appointmentId/cancel-policy')
  async cancelPolicy(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
  ) {
    return this.appointments.getCancelPolicyForPatient(user, appointmentId);
  }

  @Post(':appointmentId/cancel')
  async cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointments.cancelAppointment(user, appointmentId, dto, 'PATIENT');
  }
}

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.BENH_NHAN)
export class PatientNotificationsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: NotificationListQueryDto,
  ) {
    return this.appointments.listNotifications(user, query);
  }

  @Patch(':notificationId/read')
  async markOneRead(
    @CurrentUser() user: CurrentUserPayload,
    @Param('notificationId', ParseIntPipe) notificationId: number,
  ) {
    return this.appointments.markNotificationRead(user, notificationId);
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() user: CurrentUserPayload) {
    return this.appointments.markAllNotificationsRead(user);
  }
}

@Controller('waitlist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.BENH_NHAN)
export class PatientWaitlistController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  async join(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: JoinWaitlistDto,
  ) {
    return this.appointments.joinWaitlist(user, dto);
  }

  @Delete(':waitlistId')
  async leave(
    @CurrentUser() user: CurrentUserPayload,
    @Param('waitlistId', ParseIntPipe) waitlistId: number,
  ) {
    return this.appointments.leaveWaitlist(user, waitlistId);
  }

  @Get('my')
  async my(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PatientWaitlistListQueryDto,
  ) {
    return this.appointments.listMyWaitlist(user, query);
  }
}

@Controller('doctor/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.BAC_SI)
export class DoctorAppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('worklist')
  async worklist(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: DoctorWorklistQueryDto,
  ) {
    return this.appointments.getDoctorWorklist(user, query);
  }

  @Patch(':appointmentId/status')
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: DoctorUpdateAppointmentStatusDto,
  ) {
    return this.appointments.updateStatusByDoctor(user, appointmentId, dto);
  }
}
