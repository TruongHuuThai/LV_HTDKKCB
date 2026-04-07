import { getApiErrorMessage } from './apiError';

export function getPatientFlowErrorMessage(error: unknown, fallback: string) {
  const message = getApiErrorMessage(error, fallback);
  const normalized = message.toLowerCase();

  if (normalized.includes('forbidden')) return 'B?n không có quy?n thao tác d? li?u này.';
  if (normalized.includes('not found') || normalized.includes('khong tim thay')) {
    return 'Không t?m th?y d? li?u c?n x? l?.';
  }
  if (normalized.includes('timeout')) return 'Yêu c?u b? quá th?i gian. Vui l?ng th? l?i.';
  if (normalized.includes('network')) return 'M?t k?t n?i m?ng. Vui l?ng ki?m tra internet và th? l?i.';
  if (normalized.includes('expired') || normalized.includes('het han')) {
    return 'Liên k?t thanh toán ð? h?t h?n. Vui l?ng th? thanh toán l?i.';
  }
  if (normalized.includes('retry') && normalized.includes('khong the')) {
    return 'Hi?n chýa th? thanh toán l?i cho l?ch h?n này.';
  }
  if (normalized.includes('reschedule')) {
    return 'Không th? ð?i l?ch trong tr?ng thái hi?n t?i.';
  }
  if (normalized.includes('huy') && normalized.includes('khong the')) {
    return 'Không th? h?y l?ch trong tr?ng thái hi?n t?i.';
  }

  return message;
}
