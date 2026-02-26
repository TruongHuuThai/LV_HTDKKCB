// src/module/payment/payment.controller.ts
import {
    Controller,
    Get,
    Query,
    HttpCode,
    HttpStatus,
    Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { VnpayService } from './vnpay.service';
import { PaymentRepository } from './payment.repository';

@Controller('vnpay')
export class PaymentController {
    private readonly frontendUrl: string;

    constructor(
        private readonly vnpay: VnpayService,
        private readonly paymentRepo: PaymentRepository,
        private readonly config: ConfigService,
    ) {
        this.frontendUrl = this.config.get<string>(
            'FRONTEND_URL',
            'http://localhost:5173',
        );
    }

    /**
     * IPN – VNPAY gọi server-to-server để thông báo kết quả giao dịch.
     * Phải phản hồi đúng JSON để VNPAY xác nhận.
     */
    // @ts-ignore
    @Get('ipn')
    @HttpCode(HttpStatus.OK)
    async ipn(@Query() query: Record<string, string>) {
        const { valid, responseCode, transactionRef, bankTransactionId } =
            this.vnpay.verifyIpn(query);

        if (!valid) {
            return { RspCode: '97', Message: 'Invalid signature' };
        }

        // transactionRef = "TT_MA" (orderId khi tạo URL)
        const TT_MA = parseInt(transactionRef, 10);
        if (isNaN(TT_MA)) {
            return { RspCode: '01', Message: 'Invalid order ref' };
        }

        const payment = await this.paymentRepo.findPaymentByTtMa(TT_MA);
        if (!payment) return { RspCode: '01', Message: 'Order not found' };

        // 00 = thành công
        if (responseCode === '00') {
            await this.paymentRepo.updatePaymentStatus(
                TT_MA,
                'DA_THANH_TOAN',
                bankTransactionId,
                query['vnp_BankCode'],
            );
        } else {
            await this.paymentRepo.updatePaymentStatus(TT_MA, 'THAT_BAI');
        }

        return { RspCode: '00', Message: 'Confirm Success' };
    }

    /**
     * Return URL – VNPAY redirect trình duyệt người dùng về đây sau thanh toán.
     * Redirect tiếp qua Frontend để hiển thị kết quả.
     */
    // @ts-ignore
    @Get('return')
    async returnUrl(
        @Query() query: Record<string, string>,
        @Res() res: Response,
    ) {
        const { valid, responseCode, transactionRef } =
            this.vnpay.verifyIpn(query);

        const success = valid && responseCode === '00';
        const redirectUrl = `${this.frontendUrl}/payment-result?success=${success}&ref=${transactionRef}`;
        res.redirect(redirectUrl);
    }
}
