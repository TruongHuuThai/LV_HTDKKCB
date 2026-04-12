export type PaymentStatus = 'paid' | 'unpaid' | 'pending' | 'failed' | 'expired' | 'refunded' | 'refund_pending' | 'refund_failed' | 'refund_rejected';
export type AppointmentStatusGroup = 'upcoming' | 'completed' | 'canceled' | 'no_show';

export function getPaymentStatusLabel(status: PaymentStatus) {
  const labels: Record<PaymentStatus, string> = {
    paid: 'Ð? thanh toán',
    unpaid: 'Chýa thanh toán',
    pending: 'Ðang x? l?',
    failed: 'Thanh toán th?t b?i',
    expired: 'Thanh toán h?t h?n',
    refunded: 'Ð? hoàn ti?n',
    refund_pending: 'Ðang x? l? hoàn ti?n',
    refund_failed: 'Hoàn ti?n th?t b?i',
    refund_rejected: 'T? ch?i hoàn ti?n',
  };
  return labels[status] || status;
}

export function getPaymentStatusTone(status: PaymentStatus) {
  if (status === 'paid' || status === 'refunded') return 'success';
  if (status === 'failed' || status === 'expired' || status === 'refund_failed' || status === 'refund_rejected') return 'danger';
  if (status === 'pending' || status === 'refund_pending') return 'warning';
  return 'muted';
}

export function getStatusGroupLabel(group: AppointmentStatusGroup) {
  const labels: Record<AppointmentStatusGroup, string> = {
    upcoming: 'S?p t?i',
    completed: 'Ð? khám',
    canceled: 'Ð? h?y',
    no_show: 'V?ng m?t',
  };
  return labels[group];
}

export function getAppointmentStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    CHO_THANH_TOAN: 'Ch? thanh toán',
    CHO_KHAM: 'Ch? khám',
    DA_CHECKIN: 'Ð? check-in',
    DA_KHAM: 'Ð? khám',
    HUY: 'Ð? h?y',
    HUY_BS_NGHI: 'Bác s? ngh? / h?y l?ch',
    NO_SHOW: 'Không ð?n khám',
  };
  return status ? map[status] || status : 'Không xác ð?nh';
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



