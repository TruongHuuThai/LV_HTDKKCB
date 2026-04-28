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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
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
  BulkNotificationDto,
  BulkNotificationListQueryDto,
  CancelAppointmentDto,
  CreateOrUpdatePreVisitInfoDto,
  DeleteAttachmentDto,
  DoctorStatsQueryDto,
  StartDoctorExamDto,
  UpdateDoctorClinicalNoteDto,
  CreateDoctorClinicalOrdersDto,
  UpdateDoctorOrderResultDto,
  CreateDoctorPrescriptionDto,
  FinishDoctorClinicalDto,
  GenerateEncounterBillingDto,
  MarkEncounterPaymentDto,
  CompleteEncounterDto,
  ConfirmDoctorExamDto,
  DoctorUpdateAppointmentStatusDto,
  DoctorCatalogQueryDto,
  DoctorWorklistQueryDto,
  JoinWaitlistDto,
  ManualBookingDto,
  NotificationListQueryDto,
  OpsDashboardQueryDto,
  PilotRolloutConfigDto,
  PatientAppointmentListQueryDto,
  PatientWaitlistListQueryDto,
  ReconciliationQueryDto,
  ReportingQueryDto,
  RefundListQueryDto,
  RetryBulkBatchDto,
  RescheduleAppointmentDto,
  UpdateRefundStatusDto,
  UploadPreVisitAttachmentDto,
  WaitlistHoldActionDto,
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

  @Get(':appointmentId/confirmation.pdf')
  async confirmationPdf(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Res() res: Response,
  ) {
    const result = await this.appointments.exportAppointmentConfirmationPdfForAdmin(
      user,
      appointmentId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Get(':appointmentId/pre-visit-info')
  async preVisitDetail(@Param('appointmentId', ParseIntPipe) appointmentId: number) {
    return this.appointments.getPreVisitInfoForAdmin(appointmentId);
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

@Controller('admin/notifications/bulk')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
export class AdminBulkNotificationsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post('preview')
  async preview(@Body() dto: BulkNotificationDto) {
    return this.appointments.previewBulkNotificationRecipients(dto);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: BulkNotificationDto,
  ) {
    return this.appointments.createBulkNotificationBatch(user, dto);
  }

  @Get()
  async list(@Query() query: BulkNotificationListQueryDto) {
    return this.appointments.listBulkNotificationBatches(query);
  }

  @Get(':batchId')
  async detail(@Param('batchId', ParseIntPipe) batchId: number) {
    return this.appointments.getBulkNotificationBatchDetail(batchId);
  }

  @Get(':batchId/recipients')
  async recipients(@Param('batchId', ParseIntPipe) batchId: number) {
    return this.appointments.getBulkNotificationBatchRecipients(batchId);
  }

  @Get(':batchId/failed-recipients')
  async failedRecipients(@Param('batchId', ParseIntPipe) batchId: number) {
    return this.appointments.getBulkNotificationBatchRecipients(batchId, true);
  }

  @Post(':batchId/retry')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async retry(
    @CurrentUser() user: CurrentUserPayload,
    @Param('batchId', ParseIntPipe) batchId: number,
    @Body() dto: RetryBulkBatchDto,
  ) {
    return this.appointments.retryBulkNotificationBatch(user, batchId, dto);
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

  @Get(':appointmentId/confirmation.pdf')
  async myAppointmentConfirmationPdf(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Res() res: Response,
  ) {
    const result = await this.appointments.exportAppointmentConfirmationPdfForPatient(
      user,
      appointmentId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
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
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
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

  @Patch(':appointmentId/pre-visit-info')
  async updatePreVisitInfo(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: CreateOrUpdatePreVisitInfoDto,
  ) {
    return this.appointments.updatePreVisitInfoByPatient(user, appointmentId, dto);
  }

  @Get(':appointmentId/pre-visit-info')
  async getPreVisitInfo(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
  ) {
    return this.appointments.getPreVisitInfoForPatient(user, appointmentId);
  }

  @Get(':appointmentId/attachments')
  async myAttachments(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
  ) {
    return this.appointments.listAttachmentsForPatient(user, appointmentId);
  }

  @Post(':appointmentId/attachments')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async uploadAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: UploadPreVisitAttachmentDto,
  ) {
    return this.appointments.uploadAttachmentForPatient(user, appointmentId, dto);
  }

  @Delete(':appointmentId/attachments/:attachmentId')
  async deleteAttachment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Body() dto: DeleteAttachmentDto,
  ) {
    return this.appointments.deleteAttachmentForPatient(user, appointmentId, attachmentId, dto);
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
    @Query() rawQuery: Record<string, string | undefined>,
  ) {
    const pageParsed = Number.parseInt(String(rawQuery?.page || '1'), 10);
    const limitParsed = Number.parseInt(String(rawQuery?.limit || '20'), 10);
    const normalizedQuery: NotificationListQueryDto = {
      page: Number.isFinite(pageParsed) && pageParsed > 0 ? pageParsed : 1,
      limit:
        Number.isFinite(limitParsed) && limitParsed > 0
          ? Math.min(limitParsed, 100)
          : 20,
      ...(rawQuery?.type ? { type: rawQuery.type as NotificationListQueryDto['type'] } : {}),
      ...(rawQuery?.isRead === 'true' || rawQuery?.isRead === 'false'
        ? { isRead: rawQuery.isRead }
        : {}),
    };
    return this.appointments.listNotifications(user, normalizedQuery);
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

  @Post(':waitlistId/claim-hold')
  async claimHold(
    @CurrentUser() user: CurrentUserPayload,
    @Param('waitlistId', ParseIntPipe) waitlistId: number,
    @Body() dto: WaitlistHoldActionDto,
    @Ip() ip: string,
  ) {
    return this.appointments.claimWaitlistHold(user, waitlistId, dto, ip);
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

  @Get('catalog/clinical-services')
  async clinicalServiceCatalog(@Query() query: DoctorCatalogQueryDto) {
    return this.appointments.getDoctorClinicalServiceCatalog(query);
  }

  @Get('catalog/medicines')
  async medicineCatalog(@Query() query: DoctorCatalogQueryDto) {
    return this.appointments.getDoctorMedicineCatalog(query);
  }

  @Get('worklist/pdf')
  async worklistPdf(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: DoctorWorklistQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.appointments.exportDoctorWorklistPdf(user, query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Patch(':appointmentId/status')
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: DoctorUpdateAppointmentStatusDto,
  ) {
    return this.appointments.updateStatusByDoctor(user, appointmentId, dto);
  }

  @Patch(':appointmentId/start-exam')
  async startExam(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: StartDoctorExamDto,
  ) {
    return this.appointments.startDoctorExam(user, appointmentId, dto);
  }

  @Get(':appointmentId/exam-workflow')
  async examWorkflow(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
  ) {
    return this.appointments.getDoctorExamWorkflow(user, appointmentId);
  }

  @Patch(':appointmentId/clinical-note')
  async updateClinicalNote(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: UpdateDoctorClinicalNoteDto,
  ) {
    return this.appointments.updateDoctorClinicalNote(user, appointmentId, dto);
  }

  @Post(':appointmentId/orders')
  async createOrders(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: CreateDoctorClinicalOrdersDto,
  ) {
    return this.appointments.createDoctorClinicalOrders(user, appointmentId, dto);
  }

  @Get(':appointmentId/orders')
  async getOrders(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
  ) {
    return this.appointments.getDoctorClinicalOrders(user, appointmentId);
  }

  @Patch(':appointmentId/orders/:orderId/services/:serviceId/result')
  async updateOrderResult(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Param('serviceId', ParseIntPipe) serviceId: number,
    @Body() dto: UpdateDoctorOrderResultDto,
  ) {
    return this.appointments.updateDoctorClinicalOrderResult(
      user,
      appointmentId,
      orderId,
      serviceId,
      dto,
    );
  }

  @Post(':appointmentId/prescriptions')
  async createPrescription(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: CreateDoctorPrescriptionDto,
  ) {
    return this.appointments.createDoctorPrescription(user, appointmentId, dto);
  }

  @Get(':appointmentId/prescriptions')
  async getPrescriptions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
  ) {
    return this.appointments.getDoctorPrescriptions(user, appointmentId);
  }

  @Get(':appointmentId/prescriptions/:prescriptionId/pdf')
  async prescriptionPdf(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Param('prescriptionId', ParseIntPipe) prescriptionId: number,
    @Res() res: Response,
  ) {
    const result = await this.appointments.exportDoctorPrescriptionPdf(
      user,
      appointmentId,
      prescriptionId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Patch(':appointmentId/finish-clinical')
  async finishClinical(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: FinishDoctorClinicalDto,
  ) {
    return this.appointments.finishDoctorClinical(user, appointmentId, dto);
  }

  @Post(':appointmentId/billing/generate')
  async generateBilling(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: GenerateEncounterBillingDto,
  ) {
    return this.appointments.generateEncounterBilling(user, appointmentId, dto);
  }

  @Patch(':appointmentId/billing/:paymentId/mark-paid')
  async markBillingPaid(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() dto: MarkEncounterPaymentDto,
  ) {
    return this.appointments.markEncounterPaymentAsPaid(
      user,
      appointmentId,
      paymentId,
      dto,
    );
  }

  @Patch(':appointmentId/complete')
  async completeEncounter(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: CompleteEncounterDto,
  ) {
    return this.appointments.completeEncounterAfterPayment(user, appointmentId, dto);
  }

  @Patch(':appointmentId/complete-exam')
  async completeExam(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Body() dto: ConfirmDoctorExamDto,
  ) {
    return this.appointments.confirmDoctorExamComplete(user, appointmentId, dto);
  }

  @Get(':appointmentId/orders/:orderId/pdf')
  async orderPdf(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
    @Param('orderId', ParseIntPipe) orderId: number,
    @Res() res: Response,
  ) {
    const result = await this.appointments.exportDoctorClinicalOrderPdf(
      user,
      appointmentId,
      orderId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Get(':appointmentId/pre-visit-info')
  async preVisitInfo(
    @CurrentUser() user: CurrentUserPayload,
    @Param('appointmentId', ParseIntPipe) appointmentId: number,
  ) {
    return this.appointments.getPreVisitInfoForDoctor(user, appointmentId);
  }
}

@Controller('doctor/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.BAC_SI)
export class DoctorStatsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('summary')
  async summary(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: DoctorStatsQueryDto,
  ) {
    return this.appointments.getDoctorStatsSummary(user, query);
  }

  @Get('trends')
  async trends(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: DoctorStatsQueryDto,
  ) {
    return this.appointments.getDoctorStatsTrends(user, query);
  }

  @Get('report.pdf')
  async reportPdf(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: DoctorStatsQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.appointments.exportDoctorStatsPdf(user, query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }
}

@Controller('admin/ops')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
export class AdminOpsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('dashboard')
  async dashboard(@Query() query: OpsDashboardQueryDto) {
    return this.appointments.getOpsDashboard(query);
  }

  @Get('release-readiness')
  async releaseReadiness() {
    return this.appointments.getReleaseReadiness();
  }

  @Get('health')
  async health() {
    return this.appointments.getOpsHealth();
  }

  @Get('alerts')
  async alerts() {
    return this.appointments.listOpsAlerts();
  }

  @Get('reconciliation/daily')
  async dailyReconciliation(@Query() query: ReconciliationQueryDto) {
    return this.appointments.runDailyReconciliation(query.date);
  }

  @Get('reconciliation/:jobId')
  async reconciliationDetail(@Param('jobId', ParseIntPipe) jobId: number) {
    return this.appointments.getReconciliationJobDetail(jobId);
  }

  @Get('pilot-rollout')
  async getPilotRollout() {
    return this.appointments.getPilotRolloutConfig();
  }

  @Patch('pilot-rollout')
  async setPilotRollout(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PilotRolloutConfigDto,
  ) {
    return this.appointments.upsertPilotRolloutConfig(user, dto);
  }
}

@Controller('admin/reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
export class AdminReconciliationController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('daily')
  async daily(@Query() query: ReconciliationQueryDto) {
    return this.appointments.runDailyReconciliation(query.date);
  }

  @Get(':jobId')
  async detail(@Param('jobId', ParseIntPipe) jobId: number) {
    return this.appointments.getReconciliationJobDetail(jobId);
  }

  @Get('mismatches')
  async mismatches(@Query() query: ReconciliationQueryDto) {
    return this.appointments.listReconciliationMismatches(query);
  }
}

@Controller('attachments')
export class AttachmentAccessController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get(':attachmentId/access-url')
  @UseGuards(JwtAuthGuard)
  async accessUrl(
    @CurrentUser() user: CurrentUserPayload,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
  ) {
    return this.appointments.getAttachmentAccessUrl(user, attachmentId);
  }

  @Get(':attachmentId/access')
  async access(
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const result = await this.appointments.streamAttachmentBySignedToken(attachmentId, token);
    res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename=\"${result.fileName}\"`);
    res.send(result.content);
  }
}

@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
export class AdminReportsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('ops-summary')
  async opsSummary(@Query() query: ReportingQueryDto) {
    return this.appointments.getReportOpsSummary(query);
  }

  @Get('appointments')
  async appointmentsReport(@Query() query: ReportingQueryDto) {
    return this.appointments.getReportAppointments(query);
  }

  @Get('payments')
  async payments(@Query() query: ReportingQueryDto) {
    return this.appointments.getReportPayments(query);
  }

  @Get('notifications')
  async notifications(@Query() query: ReportingQueryDto) {
    return this.appointments.getReportNotifications(query);
  }

  @Get('waitlist')
  async waitlist(@Query() query: ReportingQueryDto) {
    return this.appointments.getReportWaitlist(query);
  }
}
