import { Injectable } from '@nestjs/common';
import { BookingService } from '../booking/booking.service';
import { PrismaService } from '../../prisma/prisma.service';

const UPCOMING_STATUSES = ['CHO_THANH_TOAN', 'CHO_KHAM', 'DA_CHECKIN'];

// Ánh xạ trạng thái sang nhãn thân thiện
const STATUS_LABEL: Record<string, string> = {
  CHO_THANH_TOAN: 'Chờ thanh toán',
  CHO_KHAM: 'Chờ khám',
  DA_CHECKIN: 'Đã check-in',
  DA_KHAM: 'Đã khám',
  HUY: 'Đã huỷ',
  HUY_BS_NGHI: 'Huỷ – bác sĩ nghỉ',
  NO_SHOW: 'Vắng mặt',
};

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toTimeHHMM(value: Date | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toISOString().slice(11, 16);
}

function parseDateFromQuestion(question: string) {
  const normalized = String(question || '').trim().toLowerCase();
  const dateMatch = normalized.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (dateMatch?.[1]) return dateMatch[1];

  const now = new Date();
  if (normalized.includes('tomorrow') || normalized.includes('ngay mai')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    return toIsoDate(tomorrow);
  }

  if (normalized.includes('today') || normalized.includes('hom nay')) {
    return toIsoDate(now);
  }

  return toIsoDate(now);
}

@Injectable()
export class AiAssistantRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingService: BookingService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Profiles
  // ──────────────────────────────────────────────────────────────────────────

  async listSafePatientProfiles(accountPhone: string) {
    const profiles = await this.prisma.bENH_NHAN.findMany({
      where: {
        TK_SDT: accountPhone,
        BN_DA_VO_HIEU: { not: true },
      },
      select: {
        BN_MA: true,
        BN_HO_CHU_LOT: true,
        BN_TEN: true,
        BN_NGAY_SINH: true,
        BN_LA_NAM: true,
      },
      orderBy: { BN_MA: 'asc' },
      take: 5,
    });

    return profiles.map((item) => ({
      profileId: item.BN_MA,
      fullName: [item.BN_HO_CHU_LOT, item.BN_TEN].filter(Boolean).join(' ').trim() || 'Benh nhan',
      yearOfBirth: item.BN_NGAY_SINH ? new Date(item.BN_NGAY_SINH).getUTCFullYear() : null,
      gender: item.BN_LA_NAM == null ? null : item.BN_LA_NAM ? 'male' : 'female',
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Upcoming appointments (list)
  // ──────────────────────────────────────────────────────────────────────────

  async listSafeUpcomingAppointments(accountPhone: string) {
    const todayIso = toIsoDate(new Date());
    const rows = await this.prisma.dANG_KY.findMany({
      where: {
        BENH_NHAN: { TK_SDT: accountPhone },
        N_NGAY: { gte: new Date(`${todayIso}T00:00:00.000Z`) },
        DK_TRANG_THAI: { in: UPCOMING_STATUSES },
      },
      select: {
        DK_MA: true,
        N_NGAY: true,
        B_TEN: true,
        DK_TRANG_THAI: true,
        KHUNG_GIO: {
          select: {
            KG_BAT_DAU: true,
            KG_KET_THUC: true,
          },
        },
        LICH_BSK: {
          select: {
            BAC_SI: {
              select: {
                BS_HO_TEN: true,
                BS_HOC_HAM: true,
                CHUYEN_KHOA: {
                  select: {
                    CK_TEN: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ N_NGAY: 'asc' }, { KG_MA: 'asc' }],
      take: 6,
    });

    return rows.map((item) => ({
      appointmentId: item.DK_MA,
      date: toIsoDate(new Date(item.N_NGAY)),
      session: item.B_TEN,
      status: item.DK_TRANG_THAI || 'CHO_KHAM',
      statusLabel: STATUS_LABEL[item.DK_TRANG_THAI ?? ''] ?? item.DK_TRANG_THAI,
      slotStart: toTimeHHMM(item.KHUNG_GIO?.KG_BAT_DAU),
      slotEnd: toTimeHHMM(item.KHUNG_GIO?.KG_KET_THUC),
      doctorName: item.LICH_BSK?.BAC_SI?.BS_HO_TEN || null,
      doctorDegree: item.LICH_BSK?.BAC_SI?.BS_HOC_HAM || null,
      specialty: item.LICH_BSK?.BAC_SI?.CHUYEN_KHOA?.CK_TEN || null,
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // [NEW] Chi tiết 1 lịch hẹn (chỉ chủ sở hữu)
  // ──────────────────────────────────────────────────────────────────────────

  async getAppointmentDetailForPatient(DK_MA: number, accountPhone: string) {
    const row = await this.prisma.dANG_KY.findFirst({
      where: {
        DK_MA,
        BENH_NHAN: { TK_SDT: accountPhone },
      },
      select: {
        DK_MA: true,
        N_NGAY: true,
        B_TEN: true,
        DK_TRANG_THAI: true,
        DK_STT: true,
        KHUNG_GIO: {
          select: { KG_BAT_DAU: true, KG_KET_THUC: true },
        },
        LICH_BSK: {
          select: {
            PHONG: { select: { P_TEN: true } },
            BAC_SI: {
              select: {
                BS_HO_TEN: true,
                BS_HOC_HAM: true,
                CHUYEN_KHOA: { select: { CK_TEN: true } },
              },
            },
          },
        },
        LOAI_HINH_KHAM: {
          select: { LHK_TEN: true, LHK_GIA: true },
        },
        THANH_TOAN: {
          select: {
            TT_TRANG_THAI: true,
            TT_TONG_TIEN: true,
            TT_PHUONG_THUC: true,
          },
          orderBy: { TT_THOI_GIAN: 'desc' },
          take: 1,
        },
      },
    });

    if (!row) return null;

    return {
      appointmentId: row.DK_MA,
      date: toIsoDate(new Date(row.N_NGAY)),
      session: row.B_TEN,
      queueNumber: row.DK_STT,
      status: row.DK_TRANG_THAI,
      statusLabel: STATUS_LABEL[row.DK_TRANG_THAI ?? ''] ?? row.DK_TRANG_THAI,
      slotStart: toTimeHHMM(row.KHUNG_GIO?.KG_BAT_DAU),
      slotEnd: toTimeHHMM(row.KHUNG_GIO?.KG_KET_THUC),
      room: row.LICH_BSK?.PHONG?.P_TEN ?? null,
      doctorName: row.LICH_BSK?.BAC_SI?.BS_HO_TEN ?? null,
      doctorDegree: row.LICH_BSK?.BAC_SI?.BS_HOC_HAM ?? null,
      specialty: row.LICH_BSK?.BAC_SI?.CHUYEN_KHOA?.CK_TEN ?? null,
      serviceType: row.LOAI_HINH_KHAM?.LHK_TEN ?? null,
      servicePrice: row.LOAI_HINH_KHAM?.LHK_GIA ? Number(row.LOAI_HINH_KHAM.LHK_GIA) : null,
      payment: row.THANH_TOAN?.[0]
        ? {
            status: row.THANH_TOAN[0].TT_TRANG_THAI,
            totalAmount: Number(row.THANH_TOAN[0].TT_TONG_TIEN),
            method: row.THANH_TOAN[0].TT_PHUONG_THUC,
          }
        : null,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // [NEW] Trạng thái thanh toán của 1 lịch hẹn (chủ sở hữu)
  // ──────────────────────────────────────────────────────────────────────────

  async getPaymentStatusForAppointment(DK_MA: number, accountPhone: string) {
    const row = await this.prisma.tHANH_TOAN.findFirst({
      where: {
        DK_MA,
        DANG_KY: { BENH_NHAN: { TK_SDT: accountPhone } },
      },
      select: {
        TT_MA: true,
        TT_TRANG_THAI: true,
        TT_TONG_TIEN: true,
        TT_PHUONG_THUC: true,
        TT_THOI_GIAN: true,
      },
      orderBy: { TT_THOI_GIAN: 'desc' },
    });

    if (!row) return null;

    const PAYMENT_STATUS_LABEL: Record<string, string> = {
      CHUA_THANH_TOAN: 'Chưa thanh toán',
      DA_THANH_TOAN: 'Đã thanh toán',
      THAT_BAI: 'Thanh toán thất bại',
      HOAN_TIEN: 'Đã hoàn tiền',
    };

    return {
      paymentId: row.TT_MA,
      status: row.TT_TRANG_THAI,
      statusLabel: PAYMENT_STATUS_LABEL[row.TT_TRANG_THAI ?? ''] ?? row.TT_TRANG_THAI,
      totalAmount: Number(row.TT_TONG_TIEN),
      method: row.TT_PHUONG_THUC,
      paidAt: row.TT_THOI_GIAN ? row.TT_THOI_GIAN.toISOString() : null,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // [NEW] Slot trống của bác sĩ theo ngày (dùng khi user hỏi "còn slot không")
  // ──────────────────────────────────────────────────────────────────────────

  async getDoctorSlotsForDate(targetDate: string, doctorKeyword?: string | null) {
    // Tìm bác sĩ phù hợp nếu có keyword
    let doctorFilter: { BS_MA: number; BS_HO_TEN: string; BS_HOC_HAM: string | null } | null =
      null;

    if (doctorKeyword) {
      const found = await this.prisma.bAC_SI.findFirst({
        where: {
          BS_DA_XOA: false,
          BS_HO_TEN: { contains: doctorKeyword, mode: 'insensitive' },
        },
        select: { BS_MA: true, BS_HO_TEN: true, BS_HOC_HAM: true },
      });
      if (found) doctorFilter = found;
    }

    const result = await this.bookingService.getAvailableDoctors(targetDate);
    const topList = (doctorFilter
      ? result.filter((d: any) => d.BS_MA === doctorFilter!.BS_MA)
      : result
    ).slice(0, 6);

    return {
      targetDate,
      totalAvailable: result.length,
      doctors: topList.map((d: any) => ({
        doctorId: d.BS_MA,
        doctorName: d.BS_HO_TEN,
        degree: d.BS_HOC_HAM ?? null,
        specialty: d.CHUYEN_KHOA ?? null,
      })),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // [NEW] Danh sách chuyên khoa + loại khám + giá
  // ──────────────────────────────────────────────────────────────────────────

  async getSpecialtiesWithServiceTypes(keyword?: string | null) {
    const buildQuery = (kw: string | null | undefined) =>
      kw ? { CK_TEN: { contains: kw, mode: 'insensitive' as const } } : undefined;

    let specialties = await this.prisma.cHUYEN_KHOA.findMany({
      where: buildQuery(keyword),
      select: {
        CK_MA: true,
        CK_TEN: true,
        CK_MO_TA: true,
        CK_DOI_TUONG_KHAM: true,
        LOAI_HINH_KHAM: {
          select: {
            LHK_MA: true,
            LHK_TEN: true,
            LHK_GIA: true,
            LHK_MO_TA: true,
          },
          orderBy: [{ LHK_GIA: 'asc' }, { LHK_TEN: 'asc' }],
        },
      },
      orderBy: { CK_TEN: 'asc' },
      take: 10,
    });

    // Fallback: nếu có keyword nhưng không tìm được → trả toàn bộ danh sách
    if (keyword && specialties.length === 0) {
      specialties = await this.prisma.cHUYEN_KHOA.findMany({
        select: {
          CK_MA: true,
          CK_TEN: true,
          CK_MO_TA: true,
          CK_DOI_TUONG_KHAM: true,
          LOAI_HINH_KHAM: {
            select: {
              LHK_MA: true,
              LHK_TEN: true,
              LHK_GIA: true,
              LHK_MO_TA: true,
            },
            orderBy: [{ LHK_GIA: 'asc' }, { LHK_TEN: 'asc' }],
          },
        },
        orderBy: { CK_TEN: 'asc' },
        take: 10,
      });
    }

    return specialties.map((ck) => ({
      specialtyId: ck.CK_MA,
      specialtyName: ck.CK_TEN,
      description: ck.CK_MO_TA ?? null,
      targetPatients: ck.CK_DOI_TUONG_KHAM ?? null,
      serviceTypes: (ck.LOAI_HINH_KHAM ?? []).map((lhk) => ({
        id: lhk.LHK_MA,
        name: lhk.LHK_TEN,
        price: Number(lhk.LHK_GIA),
        description: lhk.LHK_MO_TA ?? null,
      })),
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // [NEW] Tìm bác sĩ theo tên hoặc chuyên khoa
  // ──────────────────────────────────────────────────────────────────────────

  async searchDoctors(keyword?: string | null, specialtyName?: string | null) {
    let specialtyId: number | undefined;

    if (specialtyName) {
      const ck = await this.prisma.cHUYEN_KHOA.findFirst({
        where: { CK_TEN: { contains: specialtyName, mode: 'insensitive' } },
        select: { CK_MA: true },
      });
      if (ck) specialtyId = ck.CK_MA;
    }

    // Nếu keyword là tên chuyên khoa (ví dụ: "Nhi", "Nội khoa"), thử tìm theo chuyên khoa trước
    if (keyword && !specialtyId) {
      const ck = await this.prisma.cHUYEN_KHOA.findFirst({
        where: { CK_TEN: { contains: keyword, mode: 'insensitive' } },
        select: { CK_MA: true },
      });
      if (ck) specialtyId = ck.CK_MA;
    }

    const buildWhere = (kw: string | null | undefined) => ({
      BS_DA_XOA: false,
      ...(specialtyId ? { CK_MA: specialtyId } : {}),
      ...(kw && !specialtyId
        ? {
            OR: [
              { BS_HO_TEN: { contains: kw, mode: 'insensitive' as const } },
              {
                CHUYEN_KHOA: {
                  CK_TEN: { contains: kw, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    });

    let doctors = await this.prisma.bAC_SI.findMany({
      where: buildWhere(keyword),
      select: {
        BS_MA: true,
        BS_HO_TEN: true,
        BS_HOC_HAM: true,
        BS_LANAM: true,
        CHUYEN_KHOA: { select: { CK_TEN: true, CK_MO_TA: true } },
      },
      orderBy: [{ BS_HO_TEN: 'asc' }],
      take: 8,
    });

    // Fallback: nếu có keyword nhưng không tìm được ai → trả toàn bộ danh sách (giới hạn 8)
    if (keyword && doctors.length === 0) {
      doctors = await this.prisma.bAC_SI.findMany({
        where: { BS_DA_XOA: false },
        select: {
          BS_MA: true,
          BS_HO_TEN: true,
          BS_HOC_HAM: true,
          BS_LANAM: true,
          CHUYEN_KHOA: { select: { CK_TEN: true, CK_MO_TA: true } },
        },
        orderBy: [{ BS_HO_TEN: 'asc' }],
        take: 8,
      });
    }

    return doctors.map((d) => ({
      doctorId: d.BS_MA,
      doctorName: d.BS_HO_TEN,
      degree: d.BS_HOC_HAM ?? null,
      gender: d.BS_LANAM == null ? null : d.BS_LANAM ? 'Nam' : 'Nữ',
      specialty: d.CHUYEN_KHOA?.CK_TEN ?? null,
      specialtyDesc: d.CHUYEN_KHOA?.CK_MO_TA ?? null,
    }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // [NEW] Thông tin chính sách hủy/đổi lịch
  // ──────────────────────────────────────────────────────────────────────────

  getCancelPolicyInfo() {
    return {
      cutoffHours: 1,
      cutoffMinutes: 60,
      allowedStatuses: ['CHO_THANH_TOAN', 'CHO_KHAM'],
      blockedStatuses: ['DA_CHECKIN', 'DA_KHAM', 'HUY', 'HUY_BS_NGHI', 'NO_SHOW'],
      reschedulingSupported: false,
      notes: [
        'Hủy lịch phải thực hiện trước giờ khám ít nhất 1 tiếng.',
        'Lịch đã check-in hoặc đã khám không thể hủy.',
        'Hệ thống chưa hỗ trợ đổi lịch trực tiếp – hủy và đặt lại lịch mới.',
        'Nếu bác sĩ nghỉ đột xuất, hệ thống sẽ tự hủy lịch và thông báo.',
      ],
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Doctor availability (dùng chung, giữ nguyên)
  // ──────────────────────────────────────────────────────────────────────────

  async getRealtimeDoctorAvailability(question: string) {
    const targetDate = parseDateFromQuestion(question);
    const doctors = await this.bookingService.getAvailableDoctors(targetDate);
    const topDoctors = doctors.slice(0, 8).map((item: any) => ({
      doctorId: item.BS_MA,
      doctorName: item.BS_HO_TEN,
      degree: item.BS_HOC_HAM || null,
      specialty: item.CHUYEN_KHOA || null,
    }));

    return {
      targetDate,
      availableDoctorCount: doctors.length,
      topDoctors,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Audit log
  // ──────────────────────────────────────────────────────────────────────────

  async writeAuditLog(input: {
    actor: string;
    questionPreview: string;
    locale: string;
    sourceCount: number;
    intent?: string;
  }) {
    await this.prisma.aUDIT_LOG.create({
      data: {
        AL_TABLE: 'AI_ASSISTANT',
        AL_ACTION: 'CHAT_ANSWERED',
        AL_PK: { TK_SDT: input.actor },
        AL_OLD: { questionPreview: input.questionPreview },
        AL_NEW: {
          locale: input.locale,
          sourceCount: input.sourceCount,
          intent: input.intent ?? 'GENERAL_INFO',
          hasRealtimeContext: true,
        },
        AL_CHANGED_BY: input.actor,
      },
    });
  }
}
