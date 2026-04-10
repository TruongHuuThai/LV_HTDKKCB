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

const ALLOWED_PRE_VISIT_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_PRE_VISIT_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const SUPPORTED_PAYMENT_METHOD = 'VNPAY';

const BHYT_TYPE_OPTIONS = [
  {
    id: 'BHYT_DK_KCB_BD_BV_DHYD',
    label: 'Có thẻ BHYT ĐK KCB BD tại BV ĐHYD',
    description: 'Áp dụng với đối tượng hợp lệ theo quy định bệnh viện',
  },
  {
    id: 'BHYT_TAI_KHAM_THEO_HEN',
    label: 'Có tái khám theo hẹn trên đơn thuốc BHYT của BV ĐHYD',
    description: 'Giấy chuyển tuyến còn hạn và có tái khám theo hẹn',
  },
  {
    id: 'BHYT_CHUYEN_TUYEN_DUNG_TUYEN',
    label: 'Có giấy chuyển BHYT đúng tuyến đến BV ĐHYD',
    description: 'Giấy chuyển tuyến còn hiệu lực theo quy định',
  },
];

const PRIVATE_INSURANCE_PROVIDERS = [
  { id: 'BAO_VIET', name: 'Tổng công ty bảo hiểm Bảo Việt' },
  { id: 'PVI', name: 'Công ty bảo hiểm PVI Phía Nam' },
  { id: 'PTI', name: 'Tổng công ty cổ phần bảo hiểm Bưu điện (PTI)' },
  { id: 'VBI', name: 'Công ty CP bảo hiểm Ngân hàng TMCP Công Thương Việt Nam (VBI)' },
  { id: 'PACIFIC_CROSS', name: 'Công ty TNHH MTV Pacific Cross (BHV)' },
  { id: 'MIC', name: 'Công ty cổ phần bảo hiểm Quân đội (MIC)' },
  { id: 'GENERALI', name: 'Công ty TNHH bảo hiểm nhân thọ Generali Việt Nam' },
  { id: 'MANULIFE', name: 'Công ty cổ phần Insmart (Manulife)' },
  { id: 'PRUDENTIAL', name: 'Công ty cổ phần Insmart (Prudential)' },
];

@Injectable()
export class BookingService {
  constructor(
    private readonly repo: BookingRepository,
    private readonly vnpay: VnpayService,
    private readonly paymentRepo: PaymentRepository,
  ) {}

  private validatePreVisitAttachments(dto: CreateBookingDto) {
    const attachments = dto.attachments || [];
    attachments.forEach((item) => {
      if (item.mimeType && !ALLOWED_PRE_VISIT_MIME.includes(item.mimeType.toLowerCase())) {
        throw new BadRequestException('Loai file dinh kem khong duoc ho tro');
      }
      if ((item.sizeBytes || 0) > MAX_PRE_VISIT_ATTACHMENT_SIZE) {
        throw new BadRequestException('Kich thuoc file dinh kem vuot qua gioi han');
      }
    });
  }

  private validateInsuranceAndPayment(dto: CreateBookingDto) {
    if (typeof dto.hasBHYT !== 'boolean') {
      throw new BadRequestException('Thong tin BHYT bat buoc chon Co/Khong');
    }
    if (typeof dto.hasPrivateInsurance !== 'boolean') {
      throw new BadRequestException('Thong tin bao hiem tu nhan bat buoc chon Co/Khong');
    }

    if (dto.hasBHYT && !String(dto.bhytType || '').trim()) {
      throw new BadRequestException('Vui long chon loai BHYT cu the');
    }

    if (
      dto.hasBHYT &&
      dto.bhytType &&
      !BHYT_TYPE_OPTIONS.some((item) => item.id === dto.bhytType)
    ) {
      throw new BadRequestException('Loai BHYT khong hop le');
    }

    if (dto.hasPrivateInsurance && !String(dto.privateInsuranceProvider || '').trim()) {
      throw new BadRequestException('Vui long chon cong ty bao hiem tu nhan');
    }

    if (
      dto.hasPrivateInsurance &&
      dto.privateInsuranceProvider &&
      !PRIVATE_INSURANCE_PROVIDERS.some((item) => item.id === dto.privateInsuranceProvider)
    ) {
      throw new BadRequestException('Cong ty bao hiem tu nhan khong hop le');
    }

    const paymentMethod = String(dto.paymentMethod || SUPPORTED_PAYMENT_METHOD).toUpperCase();
    if (paymentMethod !== SUPPORTED_PAYMENT_METHOD) {
      throw new BadRequestException('Phuong thuc thanh toan hien chi ho tro VNPAY');
    }
  }

  private parseDateOnlyOrThrow(raw?: string | null) {
    const value = String(raw ?? '').trim();
    if (!value) {
      throw new BadRequestException('Ngay kham khong duoc de trong');
    }
    const date = parseDateOnly(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Ngay kham khong hop le');
    }
    return date;
  }

  private assertDateWithinBookingHorizon(date: Date) {
    const now = new Date();
    const todayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const horizonEnd = new Date(todayUtc);
    horizonEnd.setUTCMonth(horizonEnd.getUTCMonth() + 3);

    if (date < todayUtc) {
      throw new BadRequestException('Chi ho tro dat lich tu hom nay tro di');
    }
    if (date > horizonEnd) {
      throw new BadRequestException('Chi ho tro dat lich toi da 3 thang toi');
    }
  }

  private async ensureOwnedPatientProfileOrThrow(
    TK_SDT: string,
    BN_MA: number,
    options?: { allowDisabled?: boolean },
  ): Promise<number> {
    const bn = await this.repo.findOwnedPatientProfile(TK_SDT, BN_MA);
    if (!bn || (!options?.allowDisabled && bn.BN_DA_VO_HIEU === true)) {
      throw new NotFoundException(
        'Khong tim thay ho so benh nhan hop le thuoc tai khoan hien tai',
      );
    }
    return bn.BN_MA;
  }

  private async ensurePatientProfileByIdOrThrow(
    BN_MA: number,
    options?: { allowDisabled?: boolean },
  ): Promise<number> {
    const bn = await this.repo.findPatientProfileById(BN_MA);
    if (!bn || (!options?.allowDisabled && bn.BN_DA_VO_HIEU === true)) {
      throw new NotFoundException('Khong tim thay ho so benh nhan hop le');
    }
    return bn.BN_MA;
  }

  private async createBookingForPatient(
    BN_MA: number,
    dto: CreateBookingDto,
    clientIp = '127.0.0.1',
  ) {
    this.validatePreVisitAttachments(dto);
    this.validateInsuranceAndPayment(dto);
    const N_NGAY = this.parseDateOnlyOrThrow(dto.N_NGAY);
    this.assertDateWithinBookingHorizon(N_NGAY);

    const kg = await this.repo.findTimeSlot(dto.KG_MA);
    if (!kg) {
      throw new NotFoundException('Khung gio khong ton tai');
    }

    const startAt = combineDateAndTime(N_NGAY, kg.KG_BAT_DAU);
    if (startAt.getTime() <= Date.now()) {
      throw new BadRequestException('Khong the dat lich o thoi diem da qua');
    }

    const lich = await this.repo.findDoctorSchedule(dto.BS_MA, N_NGAY, dto.B_TEN);
    if (!lich) {
      throw new NotFoundException('Bac si khong co lich ngay/buoi nay');
    }
    const scheduleDate = lich.N_NGAY ?? N_NGAY;

    const currentCount = await this.repo.countActiveBookingsForSlot(
      dto.BS_MA,
      scheduleDate,
      dto.B_TEN,
      dto.KG_MA,
    );
    const maxCapacity = kg.KG_SO_BN_TOI_DA ?? 5;
    if (currentCount >= maxCapacity) {
      throw new ConflictException('Khung gio nay da du so luong benh nhan');
    }

    const specialtyId = lich.BAC_SI?.CK_MA;
    if (specialtyId) {
      const patientSameSlotCount = await this.repo.countPatientBookingsInSpecialtySlot(
        BN_MA,
        scheduleDate,
        dto.KG_MA,
        specialtyId,
      );
      if (patientSameSlotCount > 0) {
        throw new ConflictException(
          'Benh nhan da dang ky 1 lich trong khung gio nay thuoc chuyen khoa nay',
        );
      }
    }

    const loaiHinhKham = dto.LHK_MA ? await this.repo.findLoaiHinhKham(dto.LHK_MA) : null;
    if (dto.LHK_MA && !loaiHinhKham) {
      throw new BadRequestException('Loai hinh kham khong ton tai');
    }
    const price = loaiHinhKham?.LHK_GIA ?? 0;

    let booking: any;
    try {
      const maxStt = await this.repo.getMaxSttForSlot(
        dto.BS_MA,
        scheduleDate,
        dto.B_TEN,
        dto.KG_MA,
      );
      const nextStt = (maxStt._max?.DK_STT ?? 0) + 1;
      booking = await this.repo.createBooking({
        BN_MA,
        BS_MA: dto.BS_MA,
        N_NGAY: scheduleDate,
        B_TEN: dto.B_TEN,
        KG_MA: dto.KG_MA,
        LHK_MA: dto.LHK_MA,
        DK_STT: nextStt,
        DK_CO_BHYT: dto.hasBHYT ?? null,
        DK_LOAI_BHYT: dto.hasBHYT ? dto.bhytType?.trim() || null : null,
        DK_CO_BHTN: dto.hasPrivateInsurance ?? null,
        DK_BHTN_DON_VI: dto.hasPrivateInsurance
          ? dto.privateInsuranceProvider?.trim() || null
          : null,
        DK_PT_THANH_TOAN: String(dto.paymentMethod || SUPPORTED_PAYMENT_METHOD).toUpperCase(),
      });
    } catch (e: any) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Khung gio nay da co nguoi dat');
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2003'
      ) {
        throw new BadRequestException('Du lieu dat lich khong hop le hoac da thay doi');
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      ) {
        throw new NotFoundException('Thong tin lich kham khong con ton tai');
      }
      throw e;
    }

    const payment = await this.paymentRepo.createPayment({
      DK_MA: booking.DK_MA,
      TT_TONG_TIEN: Number(price),
      TT_TIEN_KHAM: Number(price),
      TT_LOAI: 'DAT_LICH',
      TT_PHUONG_THUC: String(dto.paymentMethod || SUPPORTED_PAYMENT_METHOD).toUpperCase(),
    });

    const orderInfo = `Dat lich kham BS ${dto.BS_MA} ngay ${dto.N_NGAY}`;
    const paymentUrl = this.vnpay.createPaymentUrl(
      Number(price) || 10000,
      String(payment.TT_MA),
      orderInfo,
      clientIp,
    );

    const hasPreVisit =
      Boolean(dto.symptoms?.trim()) ||
      Boolean(dto.preVisitNote?.trim()) ||
      (dto.attachments?.length || 0) > 0;
    if (hasPreVisit) {
      await this.repo.updatePreVisitInfo(booking.DK_MA, {
        symptoms: dto.symptoms?.trim() || null,
        preVisitNote: dto.preVisitNote?.trim() || null,
      });
      if ((dto.attachments?.length || 0) > 0) {
        await this.repo.createPreVisitAttachments(
          booking.DK_MA,
          (dto.attachments || []).map((item) => ({
            fileName: item.fileName,
            fileUrl: item.fileUrl || null,
            mimeType: item.mimeType || null,
            sizeBytes: item.sizeBytes ?? null,
            createdBy: null,
          })),
        );
      }
    }

    return {
      booking,
      payment: { TT_MA: payment.TT_MA, TT_TRANG_THAI: payment.TT_TRANG_THAI },
      payment_url: paymentUrl,
    };
  }

  async getAvailability(BS_MA: number, yyyy_mm_dd: string, B_TEN: string) {
    const N_NGAY = this.parseDateOnlyOrThrow(yyyy_mm_dd);
    this.assertDateWithinBookingHorizon(N_NGAY);

    const lich = await this.repo.findDoctorSchedule(BS_MA, N_NGAY, B_TEN);
    if (!lich) {
      throw new NotFoundException('Bac si khong co lich ngay/buoi nay');
    }

    const slots = await this.repo.listTimeSlotsByBuoi(B_TEN);
    const booked = await this.repo.listBookedSlots(BS_MA, N_NGAY, B_TEN);
    const bookedCount = new Map<number, number>();
    booked.forEach((item) => {
      bookedCount.set(item.KG_MA, (bookedCount.get(item.KG_MA) ?? 0) + 1);
    });
    const now = new Date();

    return {
      schedule: lich,
      slots: slots.map((s) => ({
        KG_MA: s.KG_MA,
        KG_BAT_DAU: s.KG_BAT_DAU,
        KG_KET_THUC: s.KG_KET_THUC,
        available:
          (bookedCount.get(s.KG_MA) ?? 0) < (s.KG_SO_BN_TOI_DA ?? 5) &&
          combineDateAndTime(N_NGAY, s.KG_BAT_DAU).getTime() > now.getTime(),
      })),
    };
  }

  async getAvailableDoctors(YYYY_MM_DD?: string, CK_MA?: number, q?: string) {
    const N_NGAY = YYYY_MM_DD ? this.parseDateOnlyOrThrow(YYYY_MM_DD) : undefined;
    if (N_NGAY) {
      this.assertDateWithinBookingHorizon(N_NGAY);
    }
    const docs = await this.repo.findAvailableDoctors(N_NGAY, CK_MA, q);
    return docs.map((d) => ({
      BS_MA: d.BS_MA,
      BS_HO_TEN: d.BS_HO_TEN,
      BS_HOC_HAM: d.BS_HOC_HAM,
      BS_ANH: d.BS_ANH,
      CHUYEN_KHOA: d.CHUYEN_KHOA ? d.CHUYEN_KHOA.CK_TEN : null,
      CK_MA: d.CK_MA,
    }));
  }

  async getBHYTTypes() {
    return { items: BHYT_TYPE_OPTIONS };
  }

  async getPrivateInsuranceProviders(q?: string) {
    const keyword = String(q ?? '').trim().toLowerCase();
    if (!keyword) {
      return { items: PRIVATE_INSURANCE_PROVIDERS };
    }

    return {
      items: PRIVATE_INSURANCE_PROVIDERS.filter((item) =>
        item.name.toLowerCase().includes(keyword),
      ),
    };
  }

  async getAvailabilityDebug(YYYY_MM_DD: string, CK_MA?: number, q?: string) {
    const N_NGAY = this.parseDateOnlyOrThrow(YYYY_MM_DD);
    this.assertDateWithinBookingHorizon(N_NGAY);
    return this.repo.debugAvailability(N_NGAY, CK_MA, q);
  }

  async getDoctorSlotsForDay(BS_MA: number, yyyy_mm_dd: string) {
    const N_NGAY = this.parseDateOnlyOrThrow(yyyy_mm_dd);
    this.assertDateWithinBookingHorizon(N_NGAY);
    const sches = await this.repo.listDoctorSchedulesForDate(BS_MA, N_NGAY);
    if (!sches || sches.length === 0) {
      return [];
    }

    const booked = await this.repo.listBookedSlotsForDate(BS_MA, N_NGAY);
    const bookedCount = new Map<number, number>();
    booked.forEach((item) => {
      bookedCount.set(item.KG_MA, (bookedCount.get(item.KG_MA) ?? 0) + 1);
    });
    const now = new Date();

    return sches.map((sch) => {
      const slots = sch.BUOI.KHUNG_GIO.map((kg: any) => ({
        KG_MA: kg.KG_MA,
        KG_BAT_DAU: kg.KG_BAT_DAU,
        KG_KET_THUC: kg.KG_KET_THUC,
        available:
          (bookedCount.get(kg.KG_MA) ?? 0) < (kg.KG_SO_BN_TOI_DA ?? 5) &&
          combineDateAndTime(N_NGAY, kg.KG_BAT_DAU).getTime() > now.getTime(),
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
    const BN_MA = await this.ensureOwnedPatientProfileOrThrow(
      user.TK_SDT,
      dto.BN_MA,
    );
    return this.createBookingForPatient(BN_MA, dto, clientIp);
  }

  async createByAdmin(
    _admin: { TK_SDT: string; role?: string },
    dto: CreateBookingDto,
    clientIp = '127.0.0.1',
  ) {
    const BN_MA = await this.ensurePatientProfileByIdOrThrow(dto.BN_MA);
    return this.createBookingForPatient(BN_MA, dto, clientIp);
  }

  async listMyBookings(
    user: { TK_SDT: string; role?: string; bnMa?: number | null },
    requestedPatientId?: number,
  ) {
    const targetPatientId = requestedPatientId ?? user.bnMa ?? 0;
    const BN_MA = await this.ensureOwnedPatientProfileOrThrow(
      user.TK_SDT,
      targetPatientId,
      { allowDisabled: true },
    );
    return this.repo.listBookingsOfPatient(BN_MA);
  }

  async cancel(
    user: { TK_SDT: string; role?: string },
    DK_MA: number,
    reason?: string,
  ) {
    const dk = await this.repo.findBookingById(DK_MA);
    if (!dk) {
      throw new NotFoundException('Khong tim thay dang ky');
    }

    if (user.role !== ROLE.ADMIN) {
      const BN_MA = await this.ensureOwnedPatientProfileOrThrow(
        user.TK_SDT,
        dk.BN_MA,
        { allowDisabled: true },
      );
      if (dk.BN_MA !== BN_MA) {
        throw new ForbiddenException('Ban khong co quyen huy dang ky nay');
      }
    }

    if (dk.DK_TRANG_THAI === 'HUY' || dk.DK_TRANG_THAI === 'HUY_BS_NGHI') {
      return dk;
    }
    return this.repo.cancelBooking(DK_MA, reason);
  }
}
