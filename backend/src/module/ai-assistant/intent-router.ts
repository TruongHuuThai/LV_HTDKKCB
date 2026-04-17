/**
 * AI Assistant – Intent Router
 *
 * Phân loại câu hỏi của bệnh nhân thành các intent cụ thể bằng
 * keyword scoring (không cần ML/API bên ngoài).
 * Mỗi intent được ánh xạ tới 1 tập query read-only phù hợp.
 */

export const INTENT = {
  MY_APPOINTMENTS: 'MY_APPOINTMENTS',
  PAYMENT_STATUS: 'PAYMENT_STATUS',
  DOCTOR_SLOTS: 'DOCTOR_SLOTS',
  SPECIALTY_INFO: 'SPECIALTY_INFO',
  CANCEL_POLICY: 'CANCEL_POLICY',
  DOCTOR_CATALOG: 'DOCTOR_CATALOG',
  GENERAL_INFO: 'GENERAL_INFO',
} as const;

export type IntentCode = (typeof INTENT)[keyof typeof INTENT];

export type IntentRouterResult = {
  intent: IntentCode;
  /** Tham số thiếu cần hỏi lại người dùng */
  missingParams: MissingParam[];
  /** Các entity đã extract từ câu hỏi */
  extracted: ExtractedEntities;
};

export type MissingParam = 'date' | 'doctorId' | 'appointmentId';

export type ExtractedEntities = {
  /** YYYY-MM-DD nếu tìm thấy ngày trong câu hỏi */
  date: string | null;
  /** ID lịch hẹn nếu có số đi kèm từ khoá hẹn */
  appointmentId: number | null;
  /** Từ khoá tên bác sĩ hoặc chuyên khoa */
  searchKeyword: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .trim();
}

function tokenize(raw: string): string[] {
  return normalizeText(raw)
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function scoreKeywords(tokens: Set<string>, keywords: string[]): number {
  let score = 0;
  for (const kw of keywords) {
    const kwTokens = kw.split(' ');
    if (kwTokens.every((t) => tokens.has(t))) score += kwTokens.length;
  }
  return score;
}

// ---------------------------------------------------------------------------
// Entity extractors
// ---------------------------------------------------------------------------

function formatIsoUtcDate(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createUtcDateSafe(year: number, month: number, day: number): Date | null {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }
  return candidate;
}

function resolveFutureDateByMonthDay(baseDate: Date, month: number, day: number): Date | null {
  const year = baseDate.getUTCFullYear();
  const thisYear = createUtcDateSafe(year, month, day);
  if (!thisYear) return null;
  if (thisYear.getTime() >= baseDate.getTime()) return thisYear;
  return createUtcDateSafe(year + 1, month, day);
}

function resolveFutureDateByDayOnly(baseDate: Date, day: number): Date | null {
  for (let offset = 0; offset < 12; offset += 1) {
    const baseMonthIndex = baseDate.getUTCMonth() + offset;
    const year = baseDate.getUTCFullYear() + Math.floor(baseMonthIndex / 12);
    const month = (baseMonthIndex % 12) + 1;
    const candidate = createUtcDateSafe(year, month, day);
    if (candidate && candidate.getTime() >= baseDate.getTime()) {
      return candidate;
    }
  }
  return null;
}

function extractDate(rawMessage: string): string | null {
  const raw = String(rawMessage || '').trim();
  const normalized = normalizeText(raw);

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const ymdMatch = raw.match(/\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b/);
  if (ymdMatch) {
    const year = Number.parseInt(ymdMatch[1], 10);
    const month = Number.parseInt(ymdMatch[2], 10);
    const day = Number.parseInt(ymdMatch[3], 10);
    const parsed = createUtcDateSafe(year, month, day);
    return parsed ? formatIsoUtcDate(parsed) : null;
  }

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const dmyWithYearMatch = raw.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/);
  if (dmyWithYearMatch) {
    const day = Number.parseInt(dmyWithYearMatch[1], 10);
    const month = Number.parseInt(dmyWithYearMatch[2], 10);
    const year = Number.parseInt(dmyWithYearMatch[3], 10);
    const parsed = createUtcDateSafe(year, month, day);
    return parsed ? formatIsoUtcDate(parsed) : null;
  }

  // DD/MM or DD-MM or DD.MM (khong co nam)
  const dmyNoYearMatch = raw.match(/\b(\d{1,2})[/.-](\d{1,2})(?!\s*[/.-]\s*\d)\b/);
  if (dmyNoYearMatch) {
    const day = Number.parseInt(dmyNoYearMatch[1], 10);
    const month = Number.parseInt(dmyNoYearMatch[2], 10);
    const parsed = resolveFutureDateByMonthDay(todayUtc, month, day);
    return parsed ? formatIsoUtcDate(parsed) : null;
  }

  // "ngay 23 thang 4" hoac "23 thang 4 nam 2026"
  const dayMonthTextMatch = normalized.match(
    /\b(?:ngay\s+)?(\d{1,2})\s+thang\s+(\d{1,2})(?:\s+nam\s+(\d{4}))?\b/,
  );
  if (dayMonthTextMatch) {
    const day = Number.parseInt(dayMonthTextMatch[1], 10);
    const month = Number.parseInt(dayMonthTextMatch[2], 10);
    const explicitYear = dayMonthTextMatch[3]
      ? Number.parseInt(dayMonthTextMatch[3], 10)
      : null;

    const parsed = explicitYear
      ? createUtcDateSafe(explicitYear, month, day)
      : resolveFutureDateByMonthDay(todayUtc, month, day);
    return parsed ? formatIsoUtcDate(parsed) : null;
  }

  // "ngay 23"
  const dayOnlyMatch = normalized.match(/\bngay\s+(\d{1,2})\b/);
  if (dayOnlyMatch) {
    const day = Number.parseInt(dayOnlyMatch[1], 10);
    const parsed = resolveFutureDateByDayOnly(todayUtc, day);
    return parsed ? formatIsoUtcDate(parsed) : null;
  }

  if (/\b(ngay kia|day after tomorrow)\b/.test(normalized)) {
    const dayAfterTomorrow = new Date(todayUtc);
    dayAfterTomorrow.setUTCDate(dayAfterTomorrow.getUTCDate() + 2);
    return formatIsoUtcDate(dayAfterTomorrow);
  }

  if (/\b(ngay mai|tomorrow)\b/.test(normalized)) {
    const tomorrow = new Date(todayUtc);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return formatIsoUtcDate(tomorrow);
  }

  if (/\b(hom nay|today)\b/.test(normalized)) {
    return formatIsoUtcDate(todayUtc);
  }

  return null;
}
function extractAppointmentId(normalized: string): number | null {
  // "lịch hẹn 123", "đăng ký 456", "mã DK 789", "appointment 101"
  const match = normalized.match(
    /(?:lich hen|dang ky|ma dk|appointment|booking|dk|hen)\s*#?(\d+)/i,
  );
  if (match) return parseInt(match[1], 10);
  return null;
}

function extractSearchKeyword(raw: string): string | null {
  const cleanKeyword = (value: string) =>
    value
      .replace(/\s*[-/]\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+(co|có)\s+(lich|lịch|slot).*/i, '')
      .replace(/\s+(nào|nao|gì|gi|khong|không|có|co)\s*$/i, '')
      .trim();

  // Ưu tiên: bác sĩ chuyên khoa <Tên> -> bắt phần sau "chuyên khoa"
  const specialtyAfterDoctor = raw.match(
    /(?:bac si|bác sĩ|bs|doctor|dr\.?)\s+(?:chuyen khoa|chuyên khoa)\s+([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s\-]{1,40}?)(?=\s+(?:co|có|nao|nào|khong|không|ngay|ngày|vao|vào)\b|$)/i,
  );
  if (specialtyAfterDoctor) {
    const cleaned = cleanKeyword(specialtyAfterDoctor[1]);
    if (cleaned.length >= 2) return cleaned;
  }

  // Bắt chuyên khoa đơn (không có "bác sĩ" phía trước)
  const specialtyOnly = raw.match(
    /(?:chuyen khoa|chuyên khoa|specialty)\s+([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s\-]{1,40}?)(?=\s+(?:co|có|nao|nào|khong|không|ngay|ngày|vao|vào)\b|$)/i,
  );
  if (specialtyOnly) {
    const cleaned = cleanKeyword(specialtyOnly[1]);
    if (cleaned.length >= 2) return cleaned;
  }

  // Bắt tên bác sĩ sau "bác sĩ"
  const doctorName = raw.match(
    /(?:bac si|bác sĩ|bs|doctor|dr\.?)\s+([a-zA-ZÀ-ỹ][a-zA-ZÀ-ỹ\s\-]{1,45})/i,
  );
  if (doctorName) {
    const cleaned = cleanKeyword(
      doctorName[1]
        .replace(/(?:chuyen khoa|chuyên khoa|khoa|specialty).*$/i, '')
        .replace(/\s+(ở|o)\s*$/i, ''),
    );
    if (cleaned.length >= 2) return cleaned;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Intent scoring tables
// ---------------------------------------------------------------------------

const INTENT_KEYWORDS: Record<IntentCode, string[]> = {
  [INTENT.MY_APPOINTMENTS]: [
    'lich hen', 'lich kham', 'lich cua toi', 'dang ky cua toi',
    'hen kham', 'xem lich', 'lich sap toi', 'upcoming',
    'trang thai lich', 'appointment', 'booking cua toi',
    'hen', 'my appointment', 'lich benh nhan',
  ],
  [INTENT.PAYMENT_STATUS]: [
    'thanh toan', 'da thanh toan', 'chua thanh toan', 'payment',
    'so tien', 'phi', 'hoa don', 'tien kham', 'qr',
    'qr banking', 'chuyen khoan', 'trang thai thanh toan',
    'da tra tien', 'can tra', 'gia kham',
  ],
  [INTENT.DOCTOR_SLOTS]: [
    'con slot', 'khung gio', 'gio kham', 'slot',
    'con cho', 'con trong', 'buoi sang', 'buoi chieu',
    'kham luc may gio', 'dat duoc khong', 'available slot',
    'time slot', 'gio trong',
    'lich trong', 'lich ranh', 'co lich trong', 'lich trong nao',
  ],
  [INTENT.SPECIALTY_INFO]: [
    'chuyen khoa',
    'loai hinh kham', 'loai kham', 'gia kham',
    'gia dich vu', 'service', 'specialty', 'can kham khoa nao',
    'kham gi', 'noi khoa', 'ngoai khoa', 'san phu khoa',
    'tai mui hong', 'rang ham mat', 'da lieu', 'tam than',
    'tim mach', 'than kinh', 'co xuong khop', 'tieu hoa',
    'gia bao nhieu', 'bao nhieu tien', 'chi phi kham',
    'co chuyen khoa', 'chuyen khoa gi',
  ],
  [INTENT.CANCEL_POLICY]: [
    'huy lich', 'doi lich', 'huy hen', 'cancel',
    'reschedule', 'chinh sach huy', 'co the huy khong',
    'huy before', 'truoc may gio', 'thoi han huy',
    'doi ngay kham', 'thay doi lich',
  ],
  [INTENT.DOCTOR_CATALOG]: [
    'bac si nao', 'tim bac si', 'danh sach bac si', 'doctor',
    'bs nao', 'bac si co', 'ai kham', 'thay thuoc',
    'find doctor', 'bac si gioi', 'list bac si',
    'bac si khoa', 'bs khoa',
    'bac si chuyen khoa',  // "bác sĩ chuyên khoa X" — 3 tokens
  ],
  [INTENT.GENERAL_INFO]: [
    'gio lam viec', 'opening hours', 'dia chi', 'address',
    'so dien thoai', 'hotline', 'lien he', 'contact',
    'bao hiem', 'bhyt', 'insurance', 'ho so can gi',
    'mang gi di kham', 'giay to', 'huong dan', 'guide',
    'quy trinh', 'cach dat', 'how to book',
    'mo cua', 'may gio mo', 'gio mo cua', 'khi nao mo',
    'mo cua luc', 'lam viec luc', 'bat dau luc',
  ],
};

// ---------------------------------------------------------------------------
// Main router function
// ---------------------------------------------------------------------------

export function routeIntent(rawMessage: string): IntentRouterResult {
  const normalized = normalizeText(rawMessage);
  const tokens = new Set(tokenize(normalized));

  // Score each intent
  const scores = Object.entries(INTENT_KEYWORDS).map(([intent, keywords]) => ({
    intent: intent as IntentCode,
    score: scoreKeywords(tokens, keywords.map(normalizeText)),
  }));

  scores.sort((a, b) => b.score - a.score);
  let topIntent = scores[0].score > 0 ? scores[0].intent : INTENT.GENERAL_INFO;

  // Nếu câu chứa tín hiệu mạnh về "slot/lịch trống", ưu tiên DOCTOR_SLOTS
  const hasStrongSlotSignal =
    scoreKeywords(
      tokens,
      [
        'con slot',
        'slot',
        'khung gio',
        'gio trong',
        'lich trong',
        'lich ranh',
        'time slot',
        'available slot',
      ].map(normalizeText),
    ) > 0;
  if (hasStrongSlotSignal) {
    topIntent = INTENT.DOCTOR_SLOTS;
  }

  // Tiebreak: nếu score bằng nhau giữa DOCTOR_SLOTS và GENERAL_INFO,
  // ưu tiên GENERAL_INFO khi câu hỏi không có từ chỉ slot cụ thể
  if (
    topIntent === INTENT.DOCTOR_SLOTS &&
    scores[0].score === (scores.find((s) => s.intent === INTENT.GENERAL_INFO)?.score ?? -1)
  ) {
    topIntent = INTENT.GENERAL_INFO;
  }

  // Extract entities
  // LƯU Ý: extractDate nhận rawMessage (chưa normalize) để giữ dấu / trong DD/MM/YYYY
  const extracted: ExtractedEntities = {
    date: extractDate(rawMessage),
    appointmentId: extractAppointmentId(normalized),
    searchKeyword: extractSearchKeyword(rawMessage),
  };

  // Determine missing params based on intent
  const missingParams: MissingParam[] = [];
  if (topIntent === INTENT.DOCTOR_SLOTS && !extracted.date) {
    missingParams.push('date');
  }

  return {
    intent: topIntent,
    missingParams,
    extracted,
  };
}
