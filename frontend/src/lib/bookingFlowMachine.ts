export type EntryMode = 'BY_DATE' | 'BY_DEPARTMENT' | 'BY_DOCTOR';
export type FlowStep =
  | 'entryMode'
  | 'profile'
  | 'clinicalSelection'
  | 'insurance'
  | 'review'
  | 'holdingSlot'
  | 'paymentMethod'
  | 'paymentPending'
  | 'bookingConfirming'
  | 'success'
  | 'failure'
  | 'expired';

export type PaymentMethod = 'MOMO' | 'VNPAY' | 'QR_BANKING' | 'INTERNAL';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

export interface InsuranceSelection {
  hasBHYT: boolean | null;
  bhytTypeId: string | null;
  hasPrivateInsurance: boolean | null;
  privateInsurerId: string | null;
}

export interface BookingFlowContext {
  draftId: string | null;
  draftVersion: number;
  entryMode: EntryMode | null;
  step: FlowStep;

  patientProfileId: string | null;

  appointmentDate: string | null;
  departmentId: string | null;
  doctorId: string | null;
  roomId: string | null;
  slotId: string | null;
  consultationFee: number | null;
  priceVersion: string | null;

  insurance: InsuranceSelection;

  bookingHoldId: string | null;
  holdExpiresAt: string | null;

  paymentMethod: PaymentMethod | null;
  paymentIntentId: string | null;
  paymentStatus: PaymentStatus | null;
  paymentExpiresAt: string | null;

  bookingId: string | null;
  bookingCode: string | null;

  errorCode: string | null;
  errorMessage: string | null;
}

export type BookingFlowEvent =
  | { type: 'INIT'; payload?: Partial<BookingFlowContext> }
  | { type: 'SELECT_ENTRY_MODE'; entryMode: EntryMode }
  | { type: 'SELECT_PROFILE'; patientProfileId: string }
  | { type: 'SELECT_DATE'; appointmentDate: string }
  | { type: 'SELECT_DEPARTMENT'; departmentId: string; consultationFee?: number | null }
  | { type: 'SELECT_DOCTOR'; doctorId: string; roomId?: string | null }
  | { type: 'SELECT_SLOT'; slotId: string; roomId?: string | null }
  | { type: 'UPDATE_INSURANCE'; insurance: Partial<InsuranceSelection> }
  | { type: 'SET_PAYMENT_METHOD'; paymentMethod: PaymentMethod }
  | { type: 'VALIDATE_OK' }
  | { type: 'VALIDATE_FAIL'; errorCode: string; errorMessage: string }
  | { type: 'HOLD_OK'; bookingHoldId: string; holdExpiresAt: string }
  | { type: 'HOLD_FAIL'; errorCode: string; errorMessage: string }
  | { type: 'PAYMENT_INTENT_CREATED'; paymentIntentId: string; paymentExpiresAt: string }
  | { type: 'PAYMENT_STATUS_UPDATED'; paymentStatus: PaymentStatus }
  | { type: 'BOOKING_CONFIRMED'; bookingId: string; bookingCode: string }
  | { type: 'BOOKING_CONFIRM_PENDING' }
  | { type: 'FAIL'; errorCode: string; errorMessage: string }
  | { type: 'BACK' }
  | { type: 'NEXT' }
  | { type: 'RESET' };

export const BOOKING_FLOW_STORAGE_KEY = 'umc-booking-flow-v1';

export const initialBookingFlowContext: BookingFlowContext = {
  draftId: null,
  draftVersion: 0,
  entryMode: null,
  step: 'entryMode',

  patientProfileId: null,

  appointmentDate: null,
  departmentId: null,
  doctorId: null,
  roomId: null,
  slotId: null,
  consultationFee: null,
  priceVersion: null,

  insurance: {
    hasBHYT: null,
    bhytTypeId: null,
    hasPrivateInsurance: null,
    privateInsurerId: null,
  },

  bookingHoldId: null,
  holdExpiresAt: null,

  paymentMethod: null,
  paymentIntentId: null,
  paymentStatus: null,
  paymentExpiresAt: null,

  bookingId: null,
  bookingCode: null,

  errorCode: null,
  errorMessage: null,
};

function withErrorCleared(ctx: BookingFlowContext): BookingFlowContext {
  return {
    ...ctx,
    errorCode: null,
    errorMessage: null,
  };
}

function resetAfterProfile(ctx: BookingFlowContext): BookingFlowContext {
  return {
    ...ctx,
    appointmentDate: null,
    departmentId: null,
    doctorId: null,
    roomId: null,
    slotId: null,
    consultationFee: null,
    priceVersion: null,
    insurance: {
      hasBHYT: null,
      bhytTypeId: null,
      hasPrivateInsurance: null,
      privateInsurerId: null,
    },
    bookingHoldId: null,
    holdExpiresAt: null,
    paymentMethod: null,
    paymentIntentId: null,
    paymentStatus: null,
    paymentExpiresAt: null,
    bookingId: null,
    bookingCode: null,
  };
}

function resetAfterDateOrDepartment(ctx: BookingFlowContext): BookingFlowContext {
  return {
    ...ctx,
    doctorId: null,
    roomId: null,
    slotId: null,
    bookingHoldId: null,
    holdExpiresAt: null,
    paymentMethod: null,
    paymentIntentId: null,
    paymentStatus: null,
    paymentExpiresAt: null,
    bookingId: null,
    bookingCode: null,
  };
}

function resetAfterDoctor(ctx: BookingFlowContext): BookingFlowContext {
  return {
    ...ctx,
    slotId: null,
    bookingHoldId: null,
    holdExpiresAt: null,
    paymentMethod: null,
    paymentIntentId: null,
    paymentStatus: null,
    paymentExpiresAt: null,
    bookingId: null,
    bookingCode: null,
  };
}

function normalizeInsurance(insurance: InsuranceSelection): InsuranceSelection {
  const hasBHYT = insurance.hasBHYT;
  const hasPrivateInsurance = insurance.hasPrivateInsurance;

  return {
    hasBHYT,
    bhytTypeId: hasBHYT ? insurance.bhytTypeId : null,
    hasPrivateInsurance,
    privateInsurerId: hasPrivateInsurance ? insurance.privateInsurerId : null,
  };
}

export function isInsuranceValid(insurance: InsuranceSelection): boolean {
  if (insurance.hasBHYT === null) return false;
  if (insurance.hasPrivateInsurance === null) return false;
  if (insurance.hasBHYT && !insurance.bhytTypeId) return false;
  if (insurance.hasPrivateInsurance && !insurance.privateInsurerId) return false;
  return true;
}

export function hasClinicalSelection(ctx: BookingFlowContext): boolean {
  return Boolean(
    ctx.patientProfileId &&
      ctx.appointmentDate &&
      ctx.departmentId &&
      ctx.doctorId &&
      ctx.roomId &&
      ctx.slotId,
  );
}

export function canMoveNext(ctx: BookingFlowContext): boolean {
  switch (ctx.step) {
    case 'entryMode':
      return ctx.entryMode !== null;
    case 'profile':
      return ctx.patientProfileId !== null;
    case 'clinicalSelection':
      return hasClinicalSelection(ctx);
    case 'insurance':
      return isInsuranceValid(ctx.insurance);
    case 'review':
      return true;
    case 'paymentMethod':
      return !!ctx.paymentMethod;
    default:
      return false;
  }
}

function nextStep(step: FlowStep): FlowStep {
  switch (step) {
    case 'entryMode':
      return 'profile';
    case 'profile':
      return 'clinicalSelection';
    case 'clinicalSelection':
      return 'insurance';
    case 'insurance':
      return 'review';
    case 'review':
      return 'holdingSlot';
    case 'holdingSlot':
      return 'paymentMethod';
    case 'paymentMethod':
      return 'paymentPending';
    case 'paymentPending':
      return 'bookingConfirming';
    case 'bookingConfirming':
      return 'success';
    default:
      return step;
  }
}

function prevStep(step: FlowStep): FlowStep {
  switch (step) {
    case 'profile':
      return 'entryMode';
    case 'clinicalSelection':
      return 'profile';
    case 'insurance':
      return 'clinicalSelection';
    case 'review':
      return 'insurance';
    case 'holdingSlot':
      return 'review';
    case 'paymentMethod':
      return 'review';
    case 'paymentPending':
      return 'paymentMethod';
    case 'bookingConfirming':
      return 'paymentPending';
    case 'failure':
    case 'expired':
      return 'paymentMethod';
    default:
      return step;
  }
}

export function bookingFlowReducer(
  state: BookingFlowContext,
  event: BookingFlowEvent,
): BookingFlowContext {
  const ctx = withErrorCleared(state);

  switch (event.type) {
    case 'INIT': {
      return {
        ...ctx,
        ...event.payload,
        step: event.payload?.step ?? ctx.step,
      };
    }

    case 'RESET':
      return { ...initialBookingFlowContext };

    case 'SELECT_ENTRY_MODE':
      return {
        ...ctx,
        entryMode: event.entryMode,
        step: 'profile',
      };

    case 'SELECT_PROFILE':
      return {
        ...resetAfterProfile(ctx),
        patientProfileId: event.patientProfileId,
      };

    case 'SELECT_DATE':
      return {
        ...resetAfterDateOrDepartment(ctx),
        appointmentDate: event.appointmentDate,
      };

    case 'SELECT_DEPARTMENT':
      return {
        ...resetAfterDateOrDepartment(ctx),
        departmentId: event.departmentId,
        consultationFee: event.consultationFee ?? ctx.consultationFee,
      };

    case 'SELECT_DOCTOR':
      return {
        ...resetAfterDoctor(ctx),
        doctorId: event.doctorId,
        roomId: event.roomId ?? null,
      };

    case 'SELECT_SLOT':
      return {
        ...ctx,
        slotId: event.slotId,
        roomId: event.roomId ?? ctx.roomId,
      };

    case 'UPDATE_INSURANCE': {
      const merged = normalizeInsurance({
        ...ctx.insurance,
        ...event.insurance,
      });

      return {
        ...ctx,
        insurance: merged,
      };
    }

    case 'SET_PAYMENT_METHOD':
      return {
        ...ctx,
        paymentMethod: event.paymentMethod,
      };

    case 'VALIDATE_OK':
      return {
        ...ctx,
        step: 'holdingSlot',
      };

    case 'VALIDATE_FAIL':
      return {
        ...ctx,
        step: 'clinicalSelection',
        errorCode: event.errorCode,
        errorMessage: event.errorMessage,
      };

    case 'HOLD_OK':
      return {
        ...ctx,
        bookingHoldId: event.bookingHoldId,
        holdExpiresAt: event.holdExpiresAt,
        step: 'paymentMethod',
      };

    case 'HOLD_FAIL':
      return {
        ...ctx,
        step: 'clinicalSelection',
        errorCode: event.errorCode,
        errorMessage: event.errorMessage,
      };

    case 'PAYMENT_INTENT_CREATED':
      return {
        ...ctx,
        paymentIntentId: event.paymentIntentId,
        paymentExpiresAt: event.paymentExpiresAt,
        paymentStatus: 'PENDING',
        step: 'paymentPending',
      };

    case 'PAYMENT_STATUS_UPDATED':
      if (event.paymentStatus === 'SUCCESS') {
        return {
          ...ctx,
          paymentStatus: event.paymentStatus,
          step: 'bookingConfirming',
        };
      }

      if (event.paymentStatus === 'FAILED') {
        return {
          ...ctx,
          paymentStatus: event.paymentStatus,
          step: 'failure',
        };
      }

      if (event.paymentStatus === 'EXPIRED') {
        return {
          ...ctx,
          paymentStatus: event.paymentStatus,
          step: 'expired',
        };
      }

      return {
        ...ctx,
        paymentStatus: event.paymentStatus,
      };

    case 'BOOKING_CONFIRM_PENDING':
      return {
        ...ctx,
        step: 'paymentPending',
      };

    case 'BOOKING_CONFIRMED':
      return {
        ...ctx,
        bookingId: event.bookingId,
        bookingCode: event.bookingCode,
        step: 'success',
      };

    case 'FAIL':
      return {
        ...ctx,
        step: 'failure',
        errorCode: event.errorCode,
        errorMessage: event.errorMessage,
      };

    case 'NEXT':
      if (!canMoveNext(ctx)) return ctx;
      return {
        ...ctx,
        step: nextStep(ctx.step),
      };

    case 'BACK':
      return {
        ...ctx,
        step: prevStep(ctx.step),
      };

    default:
      return ctx;
  }
}

export function toDraftPatchPayload(ctx: BookingFlowContext): Record<string, unknown> {
  return {
    draftVersion: ctx.draftVersion,
    patientProfileId: ctx.patientProfileId,
    appointmentDate: ctx.appointmentDate,
    departmentId: ctx.departmentId,
    doctorId: ctx.doctorId,
    roomId: ctx.roomId,
    slotId: ctx.slotId,
    insurance: ctx.insurance,
  };
}

export function persistBookingFlowState(ctx: BookingFlowContext): void {
  sessionStorage.setItem(BOOKING_FLOW_STORAGE_KEY, JSON.stringify(ctx));
}

export function restoreBookingFlowState(): BookingFlowContext | null {
  try {
    const raw = sessionStorage.getItem(BOOKING_FLOW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BookingFlowContext;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...initialBookingFlowContext,
      ...parsed,
      insurance: {
        ...initialBookingFlowContext.insurance,
        ...(parsed.insurance ?? {}),
      },
    };
  } catch {
    return null;
  }
}

export function clearBookingFlowState(): void {
  sessionStorage.removeItem(BOOKING_FLOW_STORAGE_KEY);
}
