// src/modules/booking/booking.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ROLE } from '../auth/auth.constants';
import { BookingRepository } from './booking.repository';
import { combineDateAndTime, parseDateOnly } from './booking.utils';
import { CreateBookingDto } from './dto/create-booking.dto';
import { VnpayService } from '../payment/vnpay.service';
import { PaymentRepository } from '../payment/payment.repository';

@Injectable()
export class BookingService {
  constructor(
    private readonly repo: BookingRepository,
    private readonly vnpay: VnpayService,
    private readonly paymentRepo: PaymentRepository,
  ) { }

  private async resolvePatientIdOrThrow(TK_SDT: string): Promise<number> {
    const bn = await this.repo.findActivePatientByPhone(TK_SDT);
    if (!bn) throw new NotFoundException('Tài khoản chưa có hồ sơ bệnh nhân');
    return bn.BN_MA;
  }

  async getAvailability(BS_MA: number, yyyy_mm_dd: string, B_TEN: string) {
    const N_NGAY = parseDateOnly(yyyy_mm_dd);

    const lich = await this.repo.findDoctorSchedule(BS_MA, N_NGAY, B_TEN);
    if (!lich)
      throw new NotFoundException('Bác sĩ không có lịch ngày/buổi này');

    const slots = await this.repo.listTimeSlotsByBuoi(B_TEN);
    const booked = await this.repo.listBookedSlots(BS_MA, N_NGAY, B_TEN);
    const bookedSet = new Set(booked.map((x) => x.KG_MA));

    return {
      schedule: lich,
      slots: slots.map((s) => ({
        KG_MA: s.KG_MA,
        KG_BAT_DAU: s.KG_BAT_DAU,
        KG_KET_THUC: s.KG_KET_THUC,
        available: !bookedSet.has(s.KG_MA),
      })),
    };
  }

  async getAvailableDoctors(YYYY_MM_DD?: string, CK_MA?: number) {
    const N_NGAY = YYYY_MM_DD ? parseDateOnly(YYYY_MM_DD) : undefined;
    const docs = await this.repo.findAvailableDoctors(N_NGAY, CK_MA);
    return docs.map(d => ({
      BS_MA: d.BS_MA,
      BS_HO_TEN: d.BS_HO_TEN,
      BS_HOC_HAM: d.BS_HOC_HAM,
      BS_ANH: d.BS_ANH,
      CHUYEN_KHOA: d.CHUYEN_KHOA ? d.CHUYEN_KHOA.CK_TEN : null,
      CK_MA: d.CK_MA,
    }));
  }

  async getDoctorSlotsForDay(BS_MA: number, yyyy_mm_dd: string) {
    const N_NGAY = parseDateOnly(yyyy_mm_dd);
    const sches = await this.repo.listDoctorSchedulesForDate(BS_MA, N_NGAY);
    if (!sches || sches.length === 0) {
      return [];
    }

    const booked = await this.repo.listBookedSlotsForDate(BS_MA, N_NGAY);
    const bookedSet = new Set(booked.map(x => x.KG_MA));

    return sches.map(sch => {
      const slots = sch.BUOI.KHUNG_GIO.map((kg: any) => ({
        KG_MA: kg.KG_MA,
        KG_BAT_DAU: kg.KG_BAT_DAU,
        KG_KET_THUC: kg.KG_KET_THUC,
        available: !bookedSet.has(kg.KG_MA),
      }));

      return {
        B_TEN: sch.B_TEN,
        PHONG: sch.PHONG ? sch.PHONG.P_TEN : null,
        slots,
      };
    });
  }

  async createByUser(
    user: { TK_SDT: string; role?: string },
    dto: CreateBookingDto,
    clientIp = '127.0.0.1',
  ) {
    const BN_MA = await this.resolvePatientIdOrThrow(user.TK_SDT);
    const N_NGAY = parseDateOnly(dto.N_NGAY);

    const kg = await this.repo.findTimeSlot(dto.KG_MA);
    if (!kg) throw new NotFoundException('Khung giờ không tồn tại');

    const startAt = combineDateAndTime(N_NGAY, kg.KG_BAT_DAU);

    if (startAt.getTime() <= Date.now())
      throw new BadRequestException('Không thể đặt lịch ở thời điểm đã qua');

    const lich = await this.repo.findDoctorSchedule(
      dto.BS_MA,
      N_NGAY,
      dto.B_TEN,
    );
    if (!lich)
      throw new NotFoundException('Bác sĩ không có lịch ngày/buổi này');

    // Lấy giá khám từ loại hình khám (nếu có)
    const price = dto.LHK_MA
      ? (await this.repo.findLoaiHinhKham(dto.LHK_MA))?.LHK_GIA ?? 0
      : 0;

    let booking: any;
    try {
      booking = await this.repo.createBooking({
        BN_MA,
        BS_MA: dto.BS_MA,
        N_NGAY,
        B_TEN: dto.B_TEN,
        KG_MA: dto.KG_MA,
        LHK_MA: dto.LHK_MA,
      });
    } catch (e: any) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Khung giờ này đã có người đặt');
      }
      throw e;
    }

    // Tạo bản ghi THANH_TOAN với trạng thái CHUA_THANH_TOAN
    const payment = await this.paymentRepo.createPayment({
      DK_MA: booking.DK_MA,
      TT_TONG_TIEN: Number(price),
      TT_TIEN_KHAM: Number(price),
      TT_LOAI: 'DAT_LICH',
      TT_PHUONG_THUC: 'VNPAY',
    });

    // Sinh URL thanh toán VNPAY
    const orderInfo = `Dat lich kham BS ${dto.BS_MA} ngay ${dto.N_NGAY}`;
    const paymentUrl = this.vnpay.createPaymentUrl(
      Number(price) || 10000, // tối thiểu 10,000 VND để test
      String(payment.TT_MA),
      orderInfo,
      clientIp,
    );

    return {
      booking,
      payment: { TT_MA: payment.TT_MA, TT_TRANG_THAI: payment.TT_TRANG_THAI },
      payment_url: paymentUrl,
    };
  }

  async listMyBookings(user: { TK_SDT: string; role?: string }) {
    const BN_MA = await this.resolvePatientIdOrThrow(user.TK_SDT);
    return this.repo.listBookingsOfPatient(BN_MA);
  }

  async cancel(
    user: { TK_SDT: string; role?: string },
    DK_MA: number,
    reason?: string,
  ) {
    const dk = await this.repo.findBookingById(DK_MA);
    if (!dk) throw new NotFoundException('Không tìm thấy đăng ký');

    // ✅ Patient chỉ được huỷ của mình, Admin được huỷ tất cả
    if (user.role !== ROLE.ADMIN) {
      const BN_MA = await this.resolvePatientIdOrThrow(user.TK_SDT);
      if (dk.BN_MA !== BN_MA)
        throw new ForbiddenException('Bạn không có quyền hủy đăng ký này');
    }

    if (dk.DK_TRANG_THAI === 'HUY') return dk; // idempotent
    return this.repo.cancelBooking(DK_MA, reason);
  }
}

