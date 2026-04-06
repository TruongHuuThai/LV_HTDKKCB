export type CancelPolicyEvaluationInput = {
  now: Date;
  appointmentStartAt: Date;
  cutoffMinutes: number;
  appointmentStatus?: string | null;
  isOwner: boolean;
  role: 'ADMIN' | 'BENH_NHAN';
};

const terminalStatuses = new Set(['HUY', 'HUY_BS_NGHI', 'DA_KHAM', 'NO_SHOW']);

export function evaluateCancelPolicy(input: CancelPolicyEvaluationInput) {
  const cutoffMs = Math.max(0, input.cutoffMinutes) * 60 * 1000;
  const cancelDeadlineAt = new Date(input.appointmentStartAt.getTime() - cutoffMs);

  if (!input.isOwner && input.role !== 'ADMIN') {
    return {
      canCancel: false,
      reasonIfBlocked: 'FORBIDDEN',
      cancelDeadlineAt,
    };
  }

  const status = input.appointmentStatus || '';
  if (terminalStatuses.has(status)) {
    return {
      canCancel: false,
      reasonIfBlocked: 'INVALID_STATUS',
      cancelDeadlineAt,
    };
  }

  if (status === 'DA_CHECKIN' && input.role !== 'ADMIN') {
    return {
      canCancel: false,
      reasonIfBlocked: 'CHECKED_IN',
      cancelDeadlineAt,
    };
  }

  if (input.role !== 'ADMIN' && input.now.getTime() > cancelDeadlineAt.getTime()) {
    return {
      canCancel: false,
      reasonIfBlocked: 'CUTOFF_EXCEEDED',
      cancelDeadlineAt,
    };
  }

  return {
    canCancel: true,
    reasonIfBlocked: null,
    cancelDeadlineAt,
  };
}
