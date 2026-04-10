import { getApiErrorMessage } from './apiError';

export function getPatientFlowErrorMessage(error: unknown, fallback: string) {
  const message = getApiErrorMessage(error, fallback);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('internal server error') ||
    normalized.includes('prisma') ||
    normalized.includes('p2022') ||
    normalized.includes('schema') ||
    normalized.includes('cau truc co so du lieu')
  ) {
    return 'Co loi he thong trong qua trinh xu ly. Vui long thu lai sau it phut.';
  }
  if (normalized.includes('forbidden')) return 'Ban khong co quyen thao tac du lieu nay.';
  if (normalized.includes('not found') || normalized.includes('khong tim thay')) {
    return 'Khong tim thay du lieu can xu ly.';
  }
  if (normalized.includes('timeout')) return 'Yeu cau qua thoi gian. Vui long thu lai.';
  if (normalized.includes('network')) return 'Mat ket noi mang. Vui long kiem tra internet va thu lai.';
  if (normalized.includes('vnpay') && normalized.includes('chua duoc cau hinh')) {
    return 'Kenh thanh toan dang duoc cau hinh. Vui long thu lai sau.';
  }
  if (normalized.includes('expired') || normalized.includes('het han')) {
    return 'Lien ket thanh toan da het han. Vui long thu thanh toan lai.';
  }
  if (normalized.includes('retry') && normalized.includes('khong the')) {
    return 'Hien chua the thanh toan lai cho lich hen nay.';
  }
  if (normalized.includes('reschedule')) {
    return 'Khong the doi lich trong trang thai hien tai.';
  }
  if (normalized.includes('huy') && normalized.includes('khong the')) {
    return 'Khong the huy lich trong trang thai hien tai.';
  }

  return message;
}

