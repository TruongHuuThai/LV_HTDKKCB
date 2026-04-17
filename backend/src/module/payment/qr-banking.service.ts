import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentRepository } from './payment.repository';

type QrPaymentRecord = {
  TT_MA: number;
  DK_MA?: number | null;
  TT_TONG_TIEN?: number | string | { toString(): string } | null;
  TT_TRANG_THAI?: string | null;
  TT_PHUONG_THUC?: string | null;
  TT_MA_GIAO_DICH?: string | null;
};

type MatchedBankTransaction = {
  transactionRef: string | null;
  amount: number;
  description: string;
  paymentIdFromDescription: number | null;
};

@Injectable()
export class QrBankingService {
  private readonly logger = new Logger(QrBankingService.name);
  private readonly bankId: string;
  private readonly accountNo: string;
  private readonly accountName: string;
  private readonly template: string;
  private readonly cassoGoogleScriptUrl: string;
  private readonly cassoRecentLimit: number;

  constructor(
    private readonly config: ConfigService,
    private readonly paymentRepo: PaymentRepository,
  ) {
    this.bankId = String(
      this.config.get<string>('PAYMENT_QR_BANK_BIN') ||
        this.config.get<string>('PAYMENT_QR_BANK_ID') ||
        '',
    ).trim();
    this.accountNo = String(this.config.get<string>('PAYMENT_QR_ACCOUNT_NO', '') || '').trim();
    this.accountName = String(this.config.get<string>('PAYMENT_QR_ACCOUNT_NAME', '') || '').trim();
    this.template = String(this.config.get<string>('PAYMENT_QR_TEMPLATE', 'compact2') || 'compact2').trim();
    this.cassoGoogleScriptUrl = String(
      this.config.get<string>('CASSO_GOOGLE_SCRIPT_URL') || '',
    ).trim();
    const parsedLimit = Number.parseInt(
      String(this.config.get<string>('CASSO_RECENT_LIMIT', '10') || '10'),
      10,
    );
    this.cassoRecentLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
  }

  private formatDate(value?: Date | string | null) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }

  private formatTime(value?: Date | string | null) {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(11, 16);
    const normalized = String(value);
    if (normalized.includes('T')) return normalized.slice(11, 16);
    return normalized.slice(0, 5);
  }

  private async createPaymentSuccessNotification(TT_MA: number) {
    const context = await this.paymentRepo.getPaymentNotificationContext(TT_MA);
    const appointment = context?.DANG_KY;
    const phone = appointment?.BENH_NHAN?.TK_SDT || null;
    if (!phone) return;

    const appointmentId = Number(context?.DK_MA || appointment?.DK_MA || 0) || null;
    const doctorName = String(appointment?.LICH_BSK?.BAC_SI?.BS_HO_TEN || '').trim();
    const dateLabel = this.formatDate(appointment?.N_NGAY);
    const timeLabel = this.formatTime(appointment?.KHUNG_GIO?.KG_BAT_DAU);
    const dedupeKey = `[PAYMENT_SUCCESS_TT_MA=${TT_MA}]`;

    await this.paymentRepo.createNotificationIfAbsent({
      phone,
      type: 'payment_success',
      title: 'Thanh toan thanh cong',
      content:
        `He thong da xac nhan thanh toan thanh cong cho giao dich TT_MA=${TT_MA}` +
        (appointmentId ? ` (DK_MA=${appointmentId})` : '') +
        (dateLabel ? `, ngay kham ${dateLabel}` : '') +
        (timeLabel ? ` luc ${timeLabel}` : '') +
        (doctorName ? ` voi bac si ${doctorName}.` : '.'),
      dedupeKey,
    });
  }

  isQrBankingMethod(method?: string | null) {
    return String(method || '')
      .trim()
      .toUpperCase() === 'QR_BANKING';
  }

  ensureQrConfigOrThrow() {
    if (this.bankId && this.accountNo) return;
    throw new BadRequestException(
      'QR Banking chua duoc cau hinh. Vui long cap nhat PAYMENT_QR_BANK_BIN va PAYMENT_QR_ACCOUNT_NO.',
    );
  }

  buildTransferContent(paymentId: number, bookingId?: number | null) {
    const safePaymentId = Number(paymentId) || 0;
    const safeBookingId = Number(bookingId) || 0;
    if (safeBookingId > 0) {
      return `TT DK ${safeBookingId} TT ${safePaymentId}`.slice(0, 120);
    }
    return `TT ${safePaymentId}`.slice(0, 120);
  }

  createPaymentUrl(input: { amount: number; paymentId: number; bookingId?: number | null }) {
    this.ensureQrConfigOrThrow();

    const amount = Math.max(0, Math.round(Number(input.amount) || 0));
    const transferContent = this.buildTransferContent(input.paymentId, input.bookingId);
    const params = new URLSearchParams({
      amount: String(amount),
      addInfo: transferContent,
    });
    if (this.accountName) {
      params.set('accountName', this.accountName);
    }

    const bank = encodeURIComponent(this.bankId);
    const account = encodeURIComponent(this.accountNo);
    const template = encodeURIComponent(this.template || 'compact2');
    return `https://img.vietqr.io/image/${bank}-${account}-${template}.png?${params.toString()}`;
  }

  getPaymentUrlForRecord(payment: QrPaymentRecord | null | undefined) {
    if (!payment || !this.isQrBankingMethod(payment.TT_PHUONG_THUC)) return null;
    if (!payment.TT_MA) return null;
    try {
      return this.createPaymentUrl({
        amount: Number(payment.TT_TONG_TIEN || 0),
        paymentId: Number(payment.TT_MA),
        bookingId: Number(payment.DK_MA || 0) || undefined,
      });
    } catch (error) {
      this.logger.warn(
        `Khong the tao lai URL QR TT_MA=${payment.TT_MA}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async reconcileUnpaidPayment(
    payment: QrPaymentRecord | null | undefined,
  ): Promise<QrPaymentRecord | null> {
    if (!payment || !this.isQrBankingMethod(payment.TT_PHUONG_THUC)) {
      return payment || null;
    }
    if (String(payment.TT_TRANG_THAI || '').toUpperCase() !== 'CHUA_THANH_TOAN') {
      return payment;
    }
    if (!this.cassoGoogleScriptUrl) {
      return payment;
    }

    const amount = Number(payment.TT_TONG_TIEN || 0);
    if (!Number.isFinite(amount)) {
      return payment;
    }
    const expectedAmount = amount > 0 ? amount : 0;
    if (expectedAmount <= 0) {
      this.logger.warn(
        `TT_MA=${payment.TT_MA} co TT_TONG_TIEN <= 0, doi soat se fallback theo noi dung chuyen khoan.`,
      );
    }

    const transferContent = this.buildTransferContent(payment.TT_MA, payment.DK_MA);
    const matched = await this.findMatchedBankTransaction(
      expectedAmount,
      transferContent,
      payment.DK_MA,
    );
    if (!matched) {
      return payment;
    }

    try {
      let targetPaymentId = payment.TT_MA;
      if (
        matched.paymentIdFromDescription &&
        matched.paymentIdFromDescription > 0 &&
        matched.paymentIdFromDescription !== payment.TT_MA
      ) {
        const paymentFromTransfer = await this.paymentRepo.findPaymentByTtMa(
          matched.paymentIdFromDescription,
        );
        if (
          paymentFromTransfer &&
          Number(paymentFromTransfer.DK_MA || 0) === Number(payment.DK_MA || 0)
        ) {
          targetPaymentId = Number(paymentFromTransfer.TT_MA);
          this.logger.warn(
            `QR transfer content dang tham chieu TT_MA=${targetPaymentId} (khac TT_MA hien tai=${payment.TT_MA}) cho DK_MA=${payment.DK_MA}.`,
          );
        }
      }

      const updated = await this.paymentRepo.updatePaymentStatus(
        targetPaymentId,
        'DA_THANH_TOAN',
        matched.transactionRef ||
          payment.TT_MA_GIAO_DICH ||
          String(targetPaymentId) ||
          undefined,
        'QR_BANKING',
      );
      if (updated?.DK_MA) {
        await this.paymentRepo.confirmAppointmentAfterPayment(updated.DK_MA);
      }
      await this.createPaymentSuccessNotification(targetPaymentId);
      return updated;
    } catch (error) {
      this.logger.warn(
        `Khong the cap nhat trang thai thanh toan QR TT_MA=${payment.TT_MA}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return payment;
    }
  }

  private async findMatchedBankTransaction(
    expectedAmount: number,
    transferContent: string,
    bookingId?: number | null,
  ): Promise<MatchedBankTransaction | null> {
    try {
      const requestUrl = this.buildSheetApiUrl();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(requestUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      if (payload?.error) {
        this.logger.warn(
          `Web App sheet tra loi loi: ${String(payload?.message || 'unknown error')}`,
        );
        return null;
      }

      const data = this.extractRowsFromPayload(payload);
      const recentRows = this.pickCandidateRows(data);
      if (recentRows.length < 3) {
        this.logger.warn(
          `Web App sheet dang tra ve rat it dong du lieu (${recentRows.length}). Nen tra ve it nhat 30 dong gan nhat de doi soat on dinh.`,
        );
      }
      const expectedContent = this.normalizeText(transferContent);
      const expectedBookingMarker =
        Number(bookingId || 0) > 0 ? this.normalizeText(`TT DK ${Number(bookingId)}`) : '';
      const expectedAccount = this.normalizeAccountNo(this.accountNo);

      for (const row of recentRows) {
        if (!row || typeof row !== 'object') continue;
        const amount = this.extractAmount(row as Record<string, unknown>);
        const description = this.extractDescription(row as Record<string, unknown>);
        const accountNo = this.extractAccountNo(row as Record<string, unknown>);
        if (!amount || !description) continue;
        if (expectedAccount && accountNo) {
          const actualAccount = this.normalizeAccountNo(accountNo);
          if (actualAccount && actualAccount !== expectedAccount) continue;
        }

        const normalizedDescription = this.normalizeText(description);
        const exactContentMatched = normalizedDescription.includes(expectedContent);
        const relaxedBookingMatched =
          !exactContentMatched &&
          Boolean(expectedBookingMarker) &&
          normalizedDescription.includes(expectedBookingMarker);
        if (amount + 0.0001 >= expectedAmount && (exactContentMatched || relaxedBookingMatched)) {
          return {
            transactionRef: this.extractTransactionRef(row as Record<string, unknown>),
            amount,
            description,
            paymentIdFromDescription: this.extractPaymentIdFromDescription(description),
          };
        }
      }
      return null;
    } catch (error) {
      this.logger.warn(
        `Khong the doi soat giao dich Casso: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private buildSheetApiUrl() {
    try {
      const url = new URL(this.cassoGoogleScriptUrl);
      url.searchParams.set('limit', String(Math.max(this.cassoRecentLimit, 30)));
      return url.toString();
    } catch {
      return this.cassoGoogleScriptUrl;
    }
  }

  private extractRowsFromPayload(payload: Record<string, unknown>) {
    if (Array.isArray(payload?.data)) {
      return payload.data.filter((item) => item && typeof item === 'object') as Record<
        string,
        unknown
      >[];
    }
    if (Array.isArray(payload)) {
      return payload.filter((item) => item && typeof item === 'object') as Record<
        string,
        unknown
      >[];
    }
    return [];
  }

  private extractAmount(row: Record<string, unknown>) {
    const raw =
      this.pickByAliases(row, ['Giá trị', 'Gia tri', 'Số tiền', 'So tien', 'amount', 'value']) ??
      null;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    const normalized = String(raw ?? '')
      .trim()
      .replace(/\s+/g, '');
    if (!normalized) return null;

    // VND often appears as "10,000" or "1.200.000" in bank sheets.
    // Prefer integer parsing by digits unless value is clearly decimal (1-2 fraction digits).
    const decimalPattern = /^-?\d+[.,]\d{1,2}$/;
    if (decimalPattern.test(normalized)) {
      const decimalValue = Number.parseFloat(normalized.replace(',', '.'));
      if (Number.isFinite(decimalValue) && decimalValue > 0) return decimalValue;
    }

    const digitsOnly = normalized.replace(/[^\d]/g, '');
    if (!digitsOnly) return null;
    const integerValue = Number.parseInt(digitsOnly, 10);
    return Number.isFinite(integerValue) && integerValue > 0 ? integerValue : null;
  }

  private extractDescription(row: Record<string, unknown>) {
    const raw = this.pickByAliases(row, [
      'Mô tả',
      'Mo ta',
      'Nội dung',
      'Noi dung',
      'description',
      'content',
    ]);
    const value = String(raw ?? '').trim();
    return value || null;
  }

  private extractTransactionRef(row: Record<string, unknown>) {
    const raw = this.pickByAliases(row, [
      'Mã giao dịch',
      'Ma giao dich',
      'Mã GD',
      'Ma GD',
      'Mã tham chiếu',
      'Ma tham chieu',
      'reference code',
      'transactionId',
      'transaction id',
      'reference',
      'ref',
    ]);
    const value = String(raw ?? '').trim();
    return value || null;
  }

  private extractPaymentIdFromDescription(description: string) {
    const normalized = this.normalizeText(description);
    // Example: "... tt dk 22 tt 23"
    const matched = normalized.match(/tt\s*dk\s*(\d+)\s*tt\s*(\d+)/i);
    if (!matched) return null;
    const paymentId = Number.parseInt(String(matched[2] || ''), 10);
    return Number.isFinite(paymentId) && paymentId > 0 ? paymentId : null;
  }

  private pickByAliases(row: Record<string, unknown>, aliases: string[]) {
    const normalizedAlias = new Set(aliases.map((item) => this.normalizeKey(item)));
    for (const [key, value] of Object.entries(row)) {
      if (normalizedAlias.has(this.normalizeKey(key))) {
        return value;
      }
    }
    return null;
  }

  private normalizeKey(value: string) {
    return this.normalizeText(value).replace(/[^a-z0-9]/g, '');
  }

  private extractAccountNo(row: Record<string, unknown>) {
    const raw = this.pickByAliases(row, [
      'Số tài khoản',
      'So tai khoan',
      'accountNo',
      'account number',
      'receiverAccount',
    ]);
    const value = String(raw ?? '').trim();
    return value || null;
  }

  private extractEventTimestamp(row: Record<string, unknown>) {
    const raw = this.pickByAliases(row, [
      'Ngày diễn ra',
      'Ngay dien ra',
      'transactionDate',
      'date',
      'createdAt',
      'time',
    ]);
    const value = String(raw ?? '').trim();
    if (!value) return 0;
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : 0;
  }

  private pickCandidateRows(rows: Record<string, unknown>[]) {
    const candidates = rows
      .filter((row) => row && typeof row === 'object')
      .map((row) => ({ row, ts: this.extractEventTimestamp(row) }));

    candidates.sort((a, b) => b.ts - a.ts);
    const limit = Math.max(this.cassoRecentLimit, 30);
    return candidates.slice(0, limit).map((item) => item.row);
  }

  private normalizeAccountNo(value?: string | null) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  private normalizeText(value: string) {
    return String(value || '')
      .replace(/\u00a0/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/\u0110/g, 'D')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
}
