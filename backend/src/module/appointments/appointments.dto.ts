import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { APPOINTMENT_STATUS } from './appointments.status';
import {
  BULK_NOTIFICATION_QUICK_PRESET_VALUES,
  BULK_NOTIFICATION_RECIPIENT_SCOPE_VALUES,
  BULK_NOTIFICATION_TARGET_GROUP_VALUES,
} from './notification-targeting.constants';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class AdminAppointmentListQueryDto {
  @IsOptional()
  @Matches(datePattern)
  dateFrom?: string;

  @IsOptional()
  @Matches(datePattern)
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  doctorId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  specialtyId?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class UpdateAppointmentStatusDto {
  @IsString()
  @IsIn([
    APPOINTMENT_STATUS.DA_CHECKIN,
    APPOINTMENT_STATUS.DA_KHAM,
    APPOINTMENT_STATUS.NO_SHOW,
  ])
  status!: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ManualBookingDto {
  @Type(() => Number)
  @IsInt()
  patientId!: number;

  @Type(() => Number)
  @IsInt()
  doctorId!: number;

  @Matches(datePattern)
  date!: string;

  @IsString()
  shift!: string;

  @Type(() => Number)
  @IsInt()
  slotId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serviceTypeId?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  symptoms?: string;
}

export class RescheduleAppointmentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  newDoctorId?: number;

  @Matches(datePattern)
  newDate!: string;

  @IsString()
  newShift!: string;

  @Type(() => Number)
  @IsInt()
  newSlotId!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class DoctorWorklistQueryDto {
  @IsOptional()
  @Matches(datePattern)
  date?: string;

  @IsOptional()
  @IsString()
  shift?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roomId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class DoctorCatalogQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CancelAppointmentDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class DoctorUpdateAppointmentStatusDto {
  @IsString()
  @IsIn([
    APPOINTMENT_STATUS.DA_CHECKIN,
    APPOINTMENT_STATUS.DA_KHAM,
    APPOINTMENT_STATUS.NO_SHOW,
  ])
  status!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class StartDoctorExamDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateDoctorClinicalNoteDto {
  @IsOptional()
  @IsString()
  symptoms?: string;

  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @IsOptional()
  @IsString()
  diagnosisPreliminary?: string;

  @IsOptional()
  @IsString()
  diagnosisFinal?: string;

  @IsOptional()
  @IsString()
  conclusion?: string;

  @IsOptional()
  @IsString()
  treatmentPlan?: string;
}

export class CreateDoctorClinicalOrderItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serviceId!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateDoctorClinicalOrdersDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateDoctorClinicalOrderItemDto)
  items!: CreateDoctorClinicalOrderItemDto[];
}

export class UpdateDoctorOrderResultDto {
  @IsOptional()
  @IsString()
  resultSummary?: string;

  @IsOptional()
  resultPayload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class CreateDoctorPrescriptionItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  medicineId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsString()
  usage?: string;
}

export class CreateDoctorPrescriptionDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateDoctorPrescriptionItemDto)
  items!: CreateDoctorPrescriptionItemDto[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number;
}

export class FinishDoctorClinicalDto {
  @IsOptional()
  @IsBoolean()
  allowIncompleteOrders?: boolean;
}

export class GenerateEncounterBillingDto {
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class MarkEncounterPaymentDto {
  @IsOptional()
  @IsString()
  transactionCode?: string;

  @IsOptional()
  @IsString()
  paymentGateway?: string;
}

export class CompleteEncounterDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class ConfirmDoctorExamDto {
  @IsOptional()
  @IsBoolean()
  allowIncompleteOrders?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class RefundListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  appointmentId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  patientId?: number;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  refundStatus?: string;

  @IsOptional()
  @Matches(datePattern)
  fromDate?: string;

  @IsOptional()
  @Matches(datePattern)
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  keyword?: string;
}

export class UpdateRefundStatusDto {
  @IsString()
  @IsIn(['REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED', 'REFUND_REJECTED'])
  status!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  refundTransactionCode?: string;

  @IsOptional()
  @Type(() => Number)
  reconciledAmount?: number;
}

export class PatientAppointmentListQueryDto {
  @IsOptional()
  @IsIn(['upcoming', 'completed', 'canceled', 'no_show'])
  statusGroup?: 'upcoming' | 'completed' | 'canceled' | 'no_show';

  @IsOptional()
  @Matches(datePattern)
  fromDate?: string;

  @IsOptional()
  @Matches(datePattern)
  toDate?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  profileId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class NotificationListQueryDto {
  @IsOptional()
  @IsIn([
    'reminder',
    'reschedule',
    'doctor_unavailable',
    'cancellation',
    'waitlist',
    'payment_success',
    'payment_failed',
    'payment_timeout',
    'payment_pending',
    'system_admin',
    'system_auto',
  ])
  type?:
    | 'reminder'
    | 'reschedule'
    | 'doctor_unavailable'
    | 'cancellation'
    | 'waitlist'
    | 'payment_success'
    | 'payment_failed'
    | 'payment_timeout'
    | 'payment_pending'
    | 'system_admin'
    | 'system_auto';

  @IsOptional()
  @IsIn(['true', 'false'])
  isRead?: 'true' | 'false';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class JoinWaitlistDto {
  @Type(() => Number)
  @IsInt()
  doctorId!: number;

  @Matches(datePattern)
  date!: string;

  @IsString()
  shift!: string;

  @Type(() => Number)
  @IsInt()
  slotId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  specialtyId?: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class PatientWaitlistListQueryDto {
  @IsOptional()
  @IsIn(['WAITING', 'NOTIFIED', 'HOLDING', 'PROMOTED', 'EXPIRED', 'CANCELED'])
  status?: 'WAITING' | 'NOTIFIED' | 'HOLDING' | 'PROMOTED' | 'EXPIRED' | 'CANCELED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class AdminWaitlistListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  doctorId?: number;

  @IsOptional()
  @Matches(datePattern)
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  slotId?: number;

  @IsOptional()
  @IsIn(['WAITING', 'NOTIFIED', 'HOLDING', 'PROMOTED', 'EXPIRED', 'CANCELED'])
  status?: 'WAITING' | 'NOTIFIED' | 'HOLDING' | 'PROMOTED' | 'EXPIRED' | 'CANCELED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PreVisitAttachmentInputDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  fileUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sizeBytes?: number;
}

export class CreateOrUpdatePreVisitInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  symptoms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => PreVisitAttachmentInputDto)
  attachments?: PreVisitAttachmentInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @Type(() => Number)
  @IsInt({ each: true })
  removeAttachmentIds?: number[];
}

export class DoctorStatsQueryDto {
  @IsOptional()
  @Matches(datePattern)
  fromDate?: string;

  @IsOptional()
  @Matches(datePattern)
  toDate?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';
}

export class BulkNotificationFilterDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @Type(() => Number)
  @IsInt({ each: true })
  specialtyIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @Type(() => Number)
  @IsInt({ each: true })
  doctorIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @Type(() => Number)
  @IsInt({ each: true })
  appointmentIds?: number[];

  @IsOptional()
  @Matches(datePattern)
  specificDate?: string;

  @IsOptional()
  @Matches(datePattern)
  fromDate?: string;

  @IsOptional()
  @Matches(datePattern)
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  scheduleId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  slotId?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  appointmentStatuses?: string[];

  @IsOptional()
  @IsIn(BULK_NOTIFICATION_RECIPIENT_SCOPE_VALUES)
  recipientScope?: string;
}

export class BulkNotificationDto {
  @IsOptional()
  @IsIn(BULK_NOTIFICATION_TARGET_GROUP_VALUES)
  targetGroup?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BulkNotificationFilterDto)
  filters?: BulkNotificationFilterDto;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  @IsIn(BULK_NOTIFICATION_QUICK_PRESET_VALUES)
  quickPreset?: string;

  @IsIn([
    'rescheduled',
    'canceled_session',
    'doctor_changed',
    'room_changed',
    'doctor_unavailable',
    'system_admin',
    'system_auto',
    'custom',
  ])
  type!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @Type(() => Number)
  @IsInt({ each: true })
  appointmentIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  doctorId?: number;

  @IsOptional()
  @Matches(datePattern)
  date?: string;

  @IsOptional()
  @Matches(datePattern)
  dateFrom?: string;

  @IsOptional()
  @Matches(datePattern)
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  scheduleId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  slotId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  specialtyId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsString()
  @MaxLength(2000)
  message!: string;
}

export class BulkNotificationListQueryDto {
  @IsOptional()
  @IsIn([
    'rescheduled',
    'canceled_session',
    'doctor_changed',
    'room_changed',
    'doctor_unavailable',
    'system_admin',
    'system_auto',
    'custom',
  ])
  type?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @Matches(datePattern)
  fromDate?: string;

  @IsOptional()
  @Matches(datePattern)
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UploadPreVisitAttachmentDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsString()
  base64Content!: string;
}

export class DeleteAttachmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RetryBulkBatchDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @Type(() => Number)
  @IsInt({ each: true })
  recipientIds?: number[];

  @IsOptional()
  @IsIn(['true', 'false'])
  onlyFailed?: 'true' | 'false';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;
}

export class WaitlistHoldActionDto {
  @IsOptional()
  @IsString()
  holdToken?: string;
}

export class OpsDashboardQueryDto {
  @IsOptional()
  @Matches(datePattern)
  fromDate?: string;

  @IsOptional()
  @Matches(datePattern)
  toDate?: string;

  @IsOptional()
  @IsIn(['day', 'week'])
  groupBy?: 'day' | 'week';
}

export class ReconciliationQueryDto {
  @IsOptional()
  @Matches(datePattern)
  date?: string;

  @IsOptional()
  @Matches(datePattern)
  fromDate?: string;

  @IsOptional()
  @Matches(datePattern)
  toDate?: string;

  @IsOptional()
  @IsIn(['OPEN', 'RESOLVED'])
  status?: 'OPEN' | 'RESOLVED';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ReportingQueryDto {
  @IsOptional()
  @Matches(datePattern)
  fromDate?: string;

  @IsOptional()
  @Matches(datePattern)
  toDate?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';
}

export class PilotRolloutConfigDto {
  @IsOptional()
  @IsIn(['department', 'userGroup', 'specialty'])
  cohortType?: 'department' | 'userGroup' | 'specialty';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  cohortIds?: Array<number | string>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  enabledFeatures?: string[];

  @IsOptional()
  @Matches(datePattern)
  startAt?: string;

  @IsOptional()
  @Matches(datePattern)
  endAt?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  enabled?: 'true' | 'false';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
