export type PaymentStatus =
  | 'paid'
  | 'unpaid'
  | 'pending'
  | 'failed'
  | 'expired'
  | 'refunded'
  | 'refund_pending'
  | 'refund_failed'
  | 'refund_rejected';

export type AppointmentStatusGroup = 'upcoming' | 'completed' | 'canceled' | 'no_show';

export function getPaymentStatusLabel(status: PaymentStatus) {
  const labels: Record<PaymentStatus, string> = {
    paid: '\u0110\u00e3 thanh to\u00e1n',
    unpaid: 'Ch\u01b0a thanh to\u00e1n',
    pending: '\u0110ang x\u1eed l\u00fd',
    failed: 'Thanh to\u00e1n th\u1ea5t b\u1ea1i',
    expired: 'Thanh to\u00e1n h\u1ebft h\u1ea1n',
    refunded: '\u0110\u00e3 ho\u00e0n ti\u1ec1n',
    refund_pending: '\u0110ang x\u1eed l\u00fd ho\u00e0n ti\u1ec1n',
    refund_failed: 'Ho\u00e0n ti\u1ec1n th\u1ea5t b\u1ea1i',
    refund_rejected: 'T\u1eeb ch\u1ed1i ho\u00e0n ti\u1ec1n',
  };
  return labels[status] || status;
}

export function getPaymentStatusTone(status: PaymentStatus) {
  if (status === 'paid' || status === 'refunded') return 'success';
  if (status === 'failed' || status === 'expired' || status === 'refund_failed' || status === 'refund_rejected') {
    return 'danger';
  }
  if (status === 'pending' || status === 'refund_pending') return 'warning';
  return 'muted';
}

export function getStatusGroupLabel(group: AppointmentStatusGroup) {
  const labels: Record<AppointmentStatusGroup, string> = {
    upcoming: 'S\u1eafp kh\u00e1m',
    completed: 'Ho\u00e0n t\u1ea5t',
    canceled: '\u0110\u00e3 h\u1ee7y',
    no_show: 'V\u1eafng m\u1eb7t',
  };
  return labels[group];
}

export function getAppointmentStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    CHO_THANH_TOAN: 'Ch\u1edd thanh to\u00e1n',
    CHO_KHAM: 'Ch\u1edd kh\u00e1m',
    DA_CHECKIN: '\u0110\u00e3 check-in',
    DA_KHAM: '\u0110\u00e3 kh\u00e1m',
    HUY: '\u0110\u00e3 h\u1ee7y',
    HUY_BS_NGHI: 'B\u00e1c s\u0129 ngh\u1ec9 / h\u1ee7y l\u1ecbch',
    NO_SHOW: 'Kh\u00f4ng \u0111\u1ebfn kh\u00e1m',
  };
  return status ? map[status] || status : 'Kh\u00f4ng x\u00e1c \u0111\u1ecbnh';
}

export function isRetryPaymentAllowed(status: PaymentStatus) {
  return status === 'failed' || status === 'expired' || status === 'unpaid';
}

export function normalizePaymentStatus(raw?: string | null): PaymentStatus {
  const value = (raw || '').toLowerCase();
  if (['paid', 'da_thanh_toan'].includes(value)) return 'paid';
  if (['failed', 'that_bai'].includes(value)) return 'failed';
  if (['expired', 'het_han'].includes(value)) return 'expired';
  if (['refunded', 'hoan_tien', 'da_hoan_tien'].includes(value)) return 'refunded';
  if (['refund_pending'].includes(value)) return 'refund_pending';
  if (['refund_failed'].includes(value)) return 'refund_failed';
  if (['refund_rejected'].includes(value)) return 'refund_rejected';
  if (['pending'].includes(value)) return 'pending';
  return 'unpaid';
}

export function canOpenPaymentUrl(url?: string | null) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
