// src/module/payment/vnpay.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

@Injectable()
export class VnpayService {
    private readonly tmnCode: string;
    private readonly hashSecret: string;
    private readonly vnpUrl: string;
    private readonly returnUrl: string;
    private readonly frontendUrl: string;
    private readonly requireConfiguredCredentials: boolean;
    private readonly qrBankBin: string;
    private readonly qrAccountNo: string;
    private readonly qrAccountName: string;
    private readonly qrTemplate: string;

    constructor(private readonly config: ConfigService) {
        this.tmnCode = this.config.get<string>('VNPAY_TMN_CODE', 'TESTCODE');
        this.hashSecret = this.config.get<string>('VNPAY_HASH_SECRET', 'TESTSECRET');
        this.vnpUrl = this.config.get<string>(
            'VNPAY_URL',
            'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
        );
        this.returnUrl = this.config.get<string>(
            'VNPAY_RETURN_URL',
            'http://localhost:3000/vnpay/return',
        );
        this.frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
        const strictEnv = String(this.config.get<string>('VNPAY_REQUIRE_CONFIG', '') || '')
            .trim()
            .toLowerCase();
        this.requireConfiguredCredentials =
            strictEnv === 'true' ||
            (strictEnv !== 'false' && String(process.env.NODE_ENV || '').toLowerCase() === 'production');
        this.qrBankBin = String(this.config.get<string>('PAYMENT_QR_BANK_BIN', '') || '').trim();
        this.qrAccountNo = String(this.config.get<string>('PAYMENT_QR_ACCOUNT_NO', '') || '').trim();
        this.qrAccountName = String(this.config.get<string>('PAYMENT_QR_ACCOUNT_NAME', '') || '').trim();
        this.qrTemplate = String(this.config.get<string>('PAYMENT_QR_TEMPLATE', 'compact2') || 'compact2').trim();
    }

    private hasConfiguredCredentials() {
        return !(
            this.tmnCode === 'TESTCODE' ||
            this.hashSecret === 'TESTSECRET' ||
            !this.tmnCode?.trim() ||
            !this.hashSecret?.trim()
        );
    }

    private assertConfigured() {
        if (this.hasConfiguredCredentials()) {
            return;
        }

        if (this.requireConfiguredCredentials) {
            throw new BadRequestException(
                'VNPAY chua duoc cau hinh dung. Vui long cap nhat VNPAY_TMN_CODE va VNPAY_HASH_SECRET trong backend/.env',
            );
        }
    }

    /**
     * Sinh URL thanh toán VNPAY
     * @param amount - Số tiền (VNĐ)
     * @param orderId - Mã đơn hàng nội bộ (TT_MA)
     * @param orderInfo - Thông tin mô tả (ví dụ: "Dat lich kham bac si Nguyen Van A")
     * @param clientIp - IP của client
     */
    createPaymentUrl(amount: number, orderId: string, orderInfo: string, clientIp: string): string {
        this.assertConfigured();
        if (!this.hasConfiguredCredentials()) {
            return this.createFallbackQrUrl(amount, orderId, orderInfo);
        }

        const now = new Date();
        const createDate = this.formatDate(now);
        const expireDate = this.formatDate(new Date(Date.now() + 15 * 60 * 1000)); // 15 phút

        const params: Record<string, string> = {
            vnp_Version: '2.1.0',
            vnp_Command: 'pay',
            vnp_TmnCode: this.tmnCode,
            vnp_Amount: String(amount * 100), // VNPAY tính theo đơn vị VNĐ * 100
            vnp_CreateDate: createDate,
            vnp_CurrCode: 'VND',
            vnp_IpAddr: clientIp || '127.0.0.1',
            vnp_Locale: 'vn',
            vnp_OrderInfo: orderInfo.slice(0, 255),
            vnp_OrderType: 'other',
            vnp_ReturnUrl: this.returnUrl,
            vnp_TxnRef: orderId,
            vnp_ExpireDate: expireDate,
        };

        // Sort tham số theo thứ tự abc (bắt buộc của VNPAY)
        const sortedKeys = Object.keys(params).sort();
        const queryParts = sortedKeys.map(
            (k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`,
        );
        const signData = queryParts.join('&');

        const signature = createHmac('sha512', this.hashSecret)
            .update(signData)
            .digest('hex');

        return `${this.vnpUrl}?${signData}&vnp_SecureHash=${signature}`;
    }

    private createFallbackQrUrl(amount: number, orderId: string, orderInfo: string) {
        const normalizedAmount = Math.max(0, Math.round(Number(amount) || 0));
        const transferContent = `${orderId} ${String(orderInfo || '').trim()}`.trim().slice(0, 120);

        // If bank info is provided, return a real VietQR transfer QR.
        if (this.qrBankBin && this.qrAccountNo) {
            const params = new URLSearchParams({
                amount: String(normalizedAmount),
                addInfo: transferContent || orderId,
            });
            if (this.qrAccountName) {
                params.set('accountName', this.qrAccountName);
            }

            const bankBin = encodeURIComponent(this.qrBankBin);
            const accountNo = encodeURIComponent(this.qrAccountNo);
            const template = encodeURIComponent(this.qrTemplate || 'compact2');
            return `https://img.vietqr.io/image/${bankBin}-${accountNo}-${template}.png?${params.toString()}`;
        }

        // Generic QR fallback for dev/testing when bank account is not configured.
        const qrPayload = `PAY|${orderId}|${normalizedAmount}|${transferContent || 'BOOKING'}`;
        return `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(
            qrPayload,
        )}`;
    }

    /**
     * Verify chữ ký từ VNPAY (dùng cho IPN và Return URL)
     * @param query - Toàn bộ query params từ VNPAY gửi về
     * @returns { valid, responseCode, transactionRef }
     */
    verifyIpn(query: Record<string, string>): {
        valid: boolean;
        responseCode: string;
        transactionRef: string;
        bankTransactionId: string;
    } {
        const { vnp_SecureHash, vnp_SecureHashType, ...rest } = query;

        const sortedKeys = Object.keys(rest).sort();
        const signData = sortedKeys
            .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(rest[k])}`)
            .join('&');

        const expectedHash = createHmac('sha512', this.hashSecret)
            .update(signData)
            .digest('hex');

        return {
            valid: expectedHash.toLowerCase() === vnp_SecureHash?.toLowerCase(),
            responseCode: query['vnp_ResponseCode'] ?? '',
            transactionRef: query['vnp_TxnRef'] ?? '',
            bankTransactionId: query['vnp_BankTranNo'] ?? '',
        };
    }

    private formatDate(d: Date): string {
        const pad = (n: number) => String(n).padStart(2, '0');
        return [
            d.getFullYear(),
            pad(d.getMonth() + 1),
            pad(d.getDate()),
            pad(d.getHours()),
            pad(d.getMinutes()),
            pad(d.getSeconds()),
        ].join('');
    }
}
