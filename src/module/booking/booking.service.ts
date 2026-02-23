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

@Injectable()
export class BookingService {
  constructor(private readonly repo: BookingRepository) { }

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

  async createByUser(
    user: { TK_SDT: string; role?: string },
    dto: CreateBookingDto,
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

    try {
      return await this.repo.createBooking({
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

