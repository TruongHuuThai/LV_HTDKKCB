// src/module/payment/vnpay.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

@Injectable()
export class VnpayService {
    private readonly tmnCode: string;
    private readonly hashSecret: string;
    private readonly vnpUrl: string;
    private readonly returnUrl: string;

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
    }

    /**
     * Sinh URL thanh toán VNPAY
     * @param amount - Số tiền (VNĐ)
     * @param orderId - Mã đơn hàng nội bộ (TT_MA)
     * @param orderInfo - Thông tin mô tả (ví dụ: "Dat lich kham bac si Nguyen Van A")
     * @param clientIp - IP của client
     */
    createPaymentUrl(amount: number, orderId: string, orderInfo: string, clientIp: string): string {
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
