import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { mapPrismaError } from '../../common/prisma/prisma-error.util';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { UpdateMedicineBrandInfoDto } from './dto/update-medicine-brand-info.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { SERVICE_TYPE_SET } from './constants/service-type.constants';
import { PdfService } from '../pdf/pdf.service';
import {
  SHIFT_STATUS,
  WEEK_STATUS,
  type ShiftStatus as ScheduleInstanceStatus,
  type WeekStatus as ScheduleWeekStatus,
  normalizeShiftStatus as normalizeScheduleInstanceStatusShared,
  normalizeWeekStatus as normalizeScheduleWeekStatusShared,
} from '../schedules/schedule-status';

type ScheduleApprovalStatus = 'pending' | 'approved' | 'rejected';
type OfficialShiftDisplayStatus = 'approved' | 'official';
type ScheduleDisplayStatus =
  | 'empty'
  | 'pending'
  | 'approved'
  | 'official'
  | 'rejected';
type ScheduleTemplateStatus = 'active' | 'inactive';
type ScheduleSource =
  | 'legacy_registration'
  | 'template'
  | 'admin_manual'
  | 'auto_rolling'
  | 'copied_1_month'
  | 'copied_2_months'
  | 'copied_3_months';
type ScheduleExceptionType = 'leave' | 'shift_change' | 'room_change' | 'other';
type ScheduleExceptionStatus = 'pending' | 'approved' | 'rejected';
type SchedulePlanningOverwriteMode = 'skip' | 'overwrite' | 'only_empty';
type SchedulePlanningAssignment = {
  date: string;
  session: string;
  roomId: number;
  doctorId: number;
};
type ScheduleCopyRangeOption = 'ONE_MONTH' | 'TWO_MONTHS' | 'THREE_MONTHS';
type ScheduleCopyConflictMode =
  | 'SKIP_EXISTING'
  | 'ARCHIVE_OLD_GENERATED'
  | 'ONLY_EMPTY';

const BOOKING_CANCELLED_STATUSES = new Set(['HUY', 'HUY_BS_NGHI']);

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(
    private prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  async getDashboardSummary() {
    try {
      this.logger.debug("Starting getDashboardSummary...");
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(today.getDate() + 30);

      this.logger.debug("Executing chunk 1 (Daily)...");
      // 1. Daily Operations (Váº­n hĂ nh khĂ¡m bá»‡nh hĂ´m nay)
      const [
        totalPatientsToday,
        pendingVisitsToday,
        completedVisitsToday,
        canceledVisitsToday,
      ] = await Promise.all([
        this.prisma.dANG_KY.count({ where: { N_NGAY: { gte: today, lt: tomorrow } } }),
        this.prisma.dANG_KY.count({ where: { N_NGAY: { gte: today, lt: tomorrow }, DK_TRANG_THAI: 'CHO_KHAM' } }),
        this.prisma.dANG_KY.count({ where: { N_NGAY: { gte: today, lt: tomorrow }, DK_TRANG_THAI: 'DA_KHAM' } }),
        this.prisma.dANG_KY.count({
          where: {
            N_NGAY: { gte: today, lt: tomorrow },
            DK_TRANG_THAI: { in: ['HUY', 'HUY_BS_NGHI'] },
          },
        }),
      ]);

      this.logger.debug("Executing chunk 2 (Financials)...");
      // 2. Financials & Staff (TĂ i chĂ­nh & NhĂ¢n sá»±)
      const [todayRevenueRaw, doctorsOnDutyToday] = await Promise.all([
        this.prisma.tHANH_TOAN.aggregate({
          _sum: { TT_TONG_TIEN: true },
          where: { TT_THOI_GIAN: { gte: today, lt: tomorrow }, TT_TRANG_THAI: 'DA_THANH_TOAN' },
        }),
        this.prisma.lICH_BSK.findMany({
          where: { N_NGAY: { gte: today, lt: tomorrow }, LBSK_IS_ARCHIVED: false },
          distinct: ['BS_MA'],
          select: { BS_MA: true }
        }).then(res => res.length),
      ]);

      const todayRevenue = Number(todayRevenueRaw._sum.TT_TONG_TIEN || 0);

      this.logger.debug("Executing chunk 3 (Top Doctors)...");
      // 3. Top Doctors (BĂ¡c sÄ© ná»•i báº­t trong thĂ¡ng)
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const topDoctorsRaw = await this.prisma.dANG_KY.groupBy({
        by: ['BS_MA'],
        where: { N_NGAY: { gte: startOfMonth }, DK_TRANG_THAI: 'DA_KHAM' },
        _count: { BS_MA: true },
        orderBy: { _count: { BS_MA: 'desc' } },
        take: 5,
      });

      let doctorsInfo: any[] = [];
      const topDoctorsIds = topDoctorsRaw.map(td => td.BS_MA);
      if (topDoctorsIds.length > 0) {
        doctorsInfo = await this.prisma.bAC_SI.findMany({
          where: { BS_MA: { in: topDoctorsIds } },
          include: { CHUYEN_KHOA: true }
        });
      }

      const topDoctors = topDoctorsRaw.map(td => {
        const docInfo = doctorsInfo.find(d => d.BS_MA === td.BS_MA);
        return {
          id: td.BS_MA,
          name: docInfo?.BS_HO_TEN || 'BS KhĂ´ng xĂ¡c Ä‘á»‹nh',
          specialty: docInfo?.CHUYEN_KHOA?.CK_TEN || '',
          avatar: docInfo?.BS_ANH,
          visits: td._count.BS_MA,
        };
      });

      this.logger.debug("Executing chunk 4 (Inventory)...");
      // 4. Inventory (Cáº£nh bĂ¡o thuá»‘c sáº¯p háº¿t háº¡n <= 30 ngĂ y)
      const expiringMedicines = await this.prisma.tHUOC.findMany({
        where: { T_HAN_SU_DUNG: { gte: today, lte: thirtyDaysFromNow }, T_DA_XOA: false },
        select: { T_MA: true, T_TEN_THUOC: true, T_HAN_SU_DUNG: true },
        orderBy: { T_HAN_SU_DUNG: 'asc' },
        take: 10,
      });

      this.logger.debug("Executing chunk 5 (Recent Activities)...");
      // 2. Recent Activities (Hoạt động gần đây - 5 đăng ký mới nhất)
      const recentActivitiesRaw = await this.prisma.dANG_KY.findMany({
        take: 5,
        orderBy: { DK_THOI_GIAN_TAO: 'desc' },
        select: {
          DK_MA: true,
          DK_TRANG_THAI: true,
          DK_THOI_GIAN_TAO: true,
          BENH_NHAN: { select: { BN_HO_CHU_LOT: true, BN_TEN: true } },
        },
      });

      const recentActivities = recentActivitiesRaw.map((activity) => {
        const patientName =
          `${activity.BENH_NHAN?.BN_HO_CHU_LOT || ''} ${activity.BENH_NHAN?.BN_TEN || ''}`.trim() ||
          'Bệnh nhân ẩn danh';
        let actionStr = 'đã đăng ký lịch khám';
        if (activity.DK_TRANG_THAI === 'DA_KHAM') actionStr = 'đã hoàn thành khám';
        if (activity.DK_TRANG_THAI === 'HUY' || activity.DK_TRANG_THAI === 'HUY_BS_NGHI')
          actionStr = 'đã hủy lịch khám';

        return {
          id: activity.DK_MA,
          patientName,
          action: actionStr,
          createdAt: activity.DK_THOI_GIAN_TAO,
        };
      });

      this.logger.debug("Executing chunk 6 (Chart Data)...");
      // 3. Chart Data (Dá»¯ liá»‡u biá»ƒu Ä‘á»“ lÆ°á»£t khĂ¡m - 7 ngĂ y gáº§n nháº¥t)
      const chartData: { name: string; visits: number }[] = [];
      const chartToday = new Date();
      chartToday.setHours(0, 0, 0, 0); // Normalize to start of day

      for (let i = 6; i >= 0; i--) {
        const targetDate = new Date(chartToday);
        targetDate.setDate(chartToday.getDate() - i);
        const nextDate = new Date(targetDate);
        nextDate.setDate(targetDate.getDate() + 1);

        const visits = await this.prisma.dANG_KY.count({
          where: { DK_THOI_GIAN_TAO: { gte: targetDate, lt: nextDate } },
        });

        chartData.push({
          name: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][targetDate.getDay()],
          visits,
        });
      }

      this.logger.debug("Completed all queries successfully!");
      return {
        dailyOperations: {
          totalPatientsToday,
          pendingVisitsToday,
          completedVisitsToday,
          canceledVisitsToday,
          doctorsOnDutyToday,
        },
        financials: {
          todayRevenue,
        },
        topDoctors,
        expiringMedicines: expiringMedicines.map(m => ({
          id: m.T_MA,
          name: m.T_TEN_THUOC,
          expiryDate: m.T_HAN_SU_DUNG ? m.T_HAN_SU_DUNG.toISOString() : '',
        })),
        recentActivities,
        chartData,
      };
    } catch (error) {
      this.logger.error("FATAL ERROR IN getDashboardSummary:", error);
      throw new InternalServerErrorException(error instanceof Error ? error.message : "Database Error");
    }
  }

  async getChartData(yearStr: string, monthStr: string) {
    const chartData: { name: string; total: number }[] = [];
    const year = parseInt(yearStr, 10);

    if (monthStr === 'all') {
      for (let month = 0; month < 12; month++) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 1);

        const visits = await this.prisma.dANG_KY.count({
          where: {
            DK_THOI_GIAN_TAO: {
              gte: startDate,
              lt: endDate,
            },
          },
        });

        chartData.push({
          name: `Th\u00e1ng ${month + 1}`,
          total: visits,
        });
      }
    } else {
      // Specific month selected
      const monthIndex = parseInt(monthStr, 10) - 1;
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const startDate = new Date(year, monthIndex, day);
        const endDate = new Date(year, monthIndex, day + 1);

        const visits = await this.prisma.dANG_KY.count({
          where: {
            DK_THOI_GIAN_TAO: {
              gte: startDate,
              lt: endDate,
            },
          },
        });

        const name = `${day.toString().padStart(2, '0')}/${(monthIndex + 1).toString().padStart(2, '0')}`;
        chartData.push({
          name,
          total: visits,
        });
      }
    }

    return chartData;
  }

  async getDashboardVisits(yearStr: string, monthStr: string, specialtyId?: string) {
    const chartData: { date: string; totalVisits: number; specialtyVisits: number }[] = [];
    const year = parseInt(yearStr, 10);
    const filterSpecialtyId = specialtyId ? parseInt(specialtyId, 10) : undefined;

    if (monthStr === 'all') {
      for (let month = 0; month < 12; month++) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 1);

        const totalVisits = await this.prisma.dANG_KY.count({
          where: { DK_THOI_GIAN_TAO: { gte: startDate, lt: endDate } },
        });

        let specialtyVisits = 0;
        if (filterSpecialtyId) {
          specialtyVisits = await this.prisma.dANG_KY.count({
            where: {
              DK_THOI_GIAN_TAO: { gte: startDate, lt: endDate },
              LOAI_HINH_KHAM: { CK_MA: filterSpecialtyId }
            },
          });
        }

        chartData.push({
          date: `Th\u00e1ng ${month + 1}`,
          totalVisits,
          specialtyVisits,
        });
      }
    } else {
      const monthIndex = parseInt(monthStr, 10) - 1;
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const startDate = new Date(year, monthIndex, day);
        const endDate = new Date(year, monthIndex, day + 1);

        const totalVisits = await this.prisma.dANG_KY.count({
          where: { DK_THOI_GIAN_TAO: { gte: startDate, lt: endDate } },
        });

        let specialtyVisits = 0;
        if (filterSpecialtyId) {
          specialtyVisits = await this.prisma.dANG_KY.count({
            where: {
              DK_THOI_GIAN_TAO: { gte: startDate, lt: endDate },
              LOAI_HINH_KHAM: { CK_MA: filterSpecialtyId }
            },
          });
        }

        const date = `${day.toString().padStart(2, '0')}/${(monthIndex + 1).toString().padStart(2, '0')}`;
        chartData.push({
          date,
          totalVisits,
          specialtyVisits,
        });
      }
    }

    return chartData;
  }

  async getDashboardTimeSlots(yearStr: string, monthStr: string) {
    const year = parseInt(yearStr, 10);

    // Define the time slots (07:00 to 17:00)
    const hours = Array.from({ length: 11 }, (_, i) => i + 7);
    const timeSlots = hours.map(h => ({
      time: `${h.toString().padStart(2, '0')}:00`,
      count: 0
    }));

    let startDate: Date;
    let endDate: Date;

    if (monthStr === 'all') {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year + 1, 0, 1);
    } else {
      const monthIndex = parseInt(monthStr, 10) - 1;
      startDate = new Date(year, monthIndex, 1);
      endDate = new Date(year, monthIndex + 1, 1);
    }

    const appointments = await this.prisma.dANG_KY.findMany({
      where: {
        DK_THOI_GIAN_TAO: { gte: startDate, lt: endDate },
        // Láº¥y KHUNG_GIO Ä‘á»ƒ biáº¿t giá» khĂ¡m
        KHUNG_GIO: {
          // CĂ³ thá»ƒ thĂªm Ä‘iá»u kiá»‡n KHUNG_GIO náº¿u cáº§n
        }
      },
      select: {
        KHUNG_GIO: {
          select: {
            KG_BAT_DAU: true,
          },
        },
      },
    });

    appointments.forEach(app => {
      if (app.KHUNG_GIO && app.KHUNG_GIO.KG_BAT_DAU) {
        // Prisma maps @db.Time to a Date object in JavaScript/TypeScript
        const hour = app.KHUNG_GIO.KG_BAT_DAU.getUTCHours();

        const slot = timeSlots.find(s => s.time.startsWith(hour.toString().padStart(2, '0')));
        if (slot) {
          slot.count++;
        }
      }
    });

    return timeSlots;
  }

  async getDashboardRevenue(yearStr: string, monthStr: string) {
    const chartData: { date: string; revenue: number }[] = [];
    const year = parseInt(yearStr, 10);

    if (monthStr === 'all') {
      for (let month = 0; month < 12; month++) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 1);

        const payments = await this.prisma.tHANH_TOAN.findMany({
          where: {
            TT_THOI_GIAN: { gte: startDate, lt: endDate },
            TT_TRANG_THAI: 'DA_THANH_TOAN', // Giáº£ sá»­ tráº¡ng thĂ¡i nĂ y
          },
          select: { TT_TONG_TIEN: true }
        });

        const revenue = payments.reduce((sum, p) => sum + Number(p.TT_TONG_TIEN || 0), 0);

        chartData.push({
          date: `Th\u00e1ng ${month + 1}`,
          revenue,
        });
      }
    } else {
      const monthIndex = parseInt(monthStr, 10) - 1;
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const startDate = new Date(year, monthIndex, day);
        const endDate = new Date(year, monthIndex, day + 1);

        const payments = await this.prisma.tHANH_TOAN.findMany({
          where: {
            TT_THOI_GIAN: { gte: startDate, lt: endDate },
            TT_TRANG_THAI: 'DA_THANH_TOAN',
          },
          select: { TT_TONG_TIEN: true }
        });

        const revenue = payments.reduce((sum, p) => sum + Number(p.TT_TONG_TIEN || 0), 0);

        const date = `${day.toString().padStart(2, '0')}/${(monthIndex + 1).toString().padStart(2, '0')}`;
        chartData.push({
          date,
          revenue,
        });
      }
    }

    return chartData;
  }

  async getSpecialties(params?: {
    search?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
  }) {
    try {
      const hasListParams =
        !!params?.search ||
        !!params?.page ||
        !!params?.limit ||
        !!params?.sortBy ||
        !!params?.sortOrder;

      if (!hasListParams) {
        return this.prisma.cHUYEN_KHOA.findMany({
          select: {
            CK_MA: true,
            CK_TEN: true,
          },
          orderBy: {
            CK_TEN: 'asc',
          },
        });
      }

      const rawPage = Number.parseInt(params?.page || '1', 10);
      const rawLimit = Number.parseInt(params?.limit || '10', 10);
      const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
      const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 100);
      const search = params?.search?.trim();
      const sortBy: 'code' | 'name' = params?.sortBy === 'name' ? 'name' : 'code';
      const sortOrder: 'asc' | 'desc' = params?.sortOrder === 'desc' ? 'desc' : 'asc';

      const where: Prisma.CHUYEN_KHOAWhereInput | undefined = search
        ? {
            CK_TEN: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : undefined;

      const orderBy =
        sortBy === 'name'
          ? { CK_TEN: sortOrder }
          : { CK_MA: sortOrder };

      const [total, items] = await this.prisma.$transaction([
        this.prisma.cHUYEN_KHOA.count({ where }),
        this.prisma.cHUYEN_KHOA.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages,
          sortBy,
          sortOrder,
          search: search || '',
        },
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getSpecialtyById(id: number) {
    try {
      const specialty = await this.prisma.cHUYEN_KHOA.findUnique({
        where: { CK_MA: id },
      });
      if (!specialty) {
        throw new NotFoundException('Khong tim thay chuyen khoa');
      }
      return specialty;
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async createSpecialty(dto: CreateSpecialtyDto) {
    try {
      return await this.prisma.cHUYEN_KHOA.create({
        data: {
          CK_TEN: dto.CK_TEN.trim(),
          CK_MO_TA: dto.CK_MO_TA?.trim() || null,
          CK_DOI_TUONG_KHAM: dto.CK_DOI_TUONG_KHAM?.trim() || null,
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async updateSpecialty(id: number, dto: UpdateSpecialtyDto) {
    try {
      await this.getSpecialtyById(id);
      return await this.prisma.cHUYEN_KHOA.update({
        where: { CK_MA: id },
        data: {
          ...(dto.CK_TEN !== undefined ? { CK_TEN: dto.CK_TEN.trim() } : {}),
          ...(dto.CK_MO_TA !== undefined ? { CK_MO_TA: dto.CK_MO_TA.trim() || null } : {}),
          ...(dto.CK_DOI_TUONG_KHAM !== undefined
            ? { CK_DOI_TUONG_KHAM: dto.CK_DOI_TUONG_KHAM.trim() || null }
            : {}),
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async deleteSpecialty(id: number) {
    try {
      await this.getSpecialtyById(id);
      await this.prisma.cHUYEN_KHOA.delete({
        where: { CK_MA: id },
      });
      return { message: 'Xoa chuyen khoa thanh cong' };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'Khong the xoa chuyen khoa nay vi da co du lieu lien quan o noi khac. Vui long xoa hoac cap nhat du lieu lien quan truoc khi thu lai.',
        );
      }
      mapPrismaError(e);
    }
  }

  async getRooms(params?: {
    search?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
    specialtyId?: string;
  }) {
    try {
      const rawPage = Number.parseInt(params?.page || '1', 10);
      const rawLimit = Number.parseInt(params?.limit || '10', 10);
      const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
      const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 100);
      const search = params?.search?.trim();
      const parsedSpecialtyId = Number.parseInt(params?.specialtyId || '', 10);
      const specialtyId = Number.isNaN(parsedSpecialtyId) ? undefined : parsedSpecialtyId;
      const sortBy: 'code' | 'name' = params?.sortBy === 'name' ? 'name' : 'code';
      const sortOrder: 'asc' | 'desc' = params?.sortOrder === 'desc' ? 'desc' : 'asc';

      const where: Prisma.PHONGWhereInput = {
        ...(specialtyId ? { CK_MA: specialtyId } : {}),
        ...(search
          ? {
              OR: [
                {
                  P_TEN: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  P_VI_TRI: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  CHUYEN_KHOA: {
                    CK_TEN: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }
          : {}),
      };

      const orderBy =
        sortBy === 'name'
          ? { P_TEN: sortOrder }
          : { P_MA: sortOrder };

      const [total, items] = await this.prisma.$transaction([
        this.prisma.pHONG.count({ where }),
        this.prisma.pHONG.findMany({
          where,
          include: {
            CHUYEN_KHOA: {
              select: {
                CK_MA: true,
                CK_TEN: true,
              },
            },
          },
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages,
          sortBy,
          sortOrder,
          search: search || '',
          specialtyId: specialtyId ?? null,
        },
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getRoomById(id: number) {
    try {
      const room = await this.prisma.pHONG.findUnique({
        where: { P_MA: id },
        include: {
          CHUYEN_KHOA: {
            select: {
              CK_MA: true,
              CK_TEN: true,
            },
          },
        },
      });

      if (!room) {
        throw new NotFoundException('Khong tim thay phong');
      }

      return room;
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async createRoom(dto: CreateRoomDto) {
    try {
      await this.getSpecialtyById(dto.CK_MA);

      return await this.prisma.pHONG.create({
        data: {
          CK_MA: dto.CK_MA,
          P_TEN: dto.P_TEN.trim(),
          P_VI_TRI: dto.P_VI_TRI?.trim() || null,
        },
        include: {
          CHUYEN_KHOA: {
            select: {
              CK_MA: true,
              CK_TEN: true,
            },
          },
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async updateRoom(id: number, dto: UpdateRoomDto) {
    try {
      await this.getRoomById(id);

      if (dto.CK_MA !== undefined) {
        await this.getSpecialtyById(dto.CK_MA);
      }

      return await this.prisma.pHONG.update({
        where: { P_MA: id },
        data: {
          ...(dto.CK_MA !== undefined ? { CK_MA: dto.CK_MA } : {}),
          ...(dto.P_TEN !== undefined ? { P_TEN: dto.P_TEN.trim() } : {}),
          ...(dto.P_VI_TRI !== undefined ? { P_VI_TRI: dto.P_VI_TRI.trim() || null } : {}),
        },
        include: {
          CHUYEN_KHOA: {
            select: {
              CK_MA: true,
              CK_TEN: true,
            },
          },
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async deleteRoom(id: number) {
    try {
      await this.getRoomById(id);

      await this.prisma.pHONG.delete({
        where: { P_MA: id },
      });

      return { message: 'Xoa phong thanh cong' };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'Khong the xoa phong nay vi da co lich hoac du lieu lien quan. Vui long cap nhat du lieu lien quan truoc khi thu lai.',
        );
      }

      mapPrismaError(e);
    }
  }

  async getServices(params?: {
    search?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
    minPrice?: string;
    maxPrice?: string;
    serviceType?: string;
  }) {
    try {
      const rawPage = Number.parseInt(params?.page || '1', 10);
      const rawLimit = Number.parseInt(params?.limit || '10', 10);
      const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
      const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 100);
      const search = params?.search?.trim();
      const sortBy: 'name' | 'code' | 'price' =
        params?.sortBy === 'name'
          ? 'name'
          : params?.sortBy === 'price'
            ? 'price'
            : 'code';
      const sortOrder: 'asc' | 'desc' =
        params?.sortOrder === 'asc' ? 'asc' : 'desc';
      const parsedMinPrice = Number.parseFloat(params?.minPrice ?? '');
      const parsedMaxPrice = Number.parseFloat(params?.maxPrice ?? '');
      const minPrice = Number.isFinite(parsedMinPrice) && parsedMinPrice >= 0 ? parsedMinPrice : undefined;
      const maxPrice = Number.isFinite(parsedMaxPrice) && parsedMaxPrice >= 0 ? parsedMaxPrice : undefined;
      const rawServiceType = params?.serviceType?.trim();
      const serviceType = rawServiceType && SERVICE_TYPE_SET.has(rawServiceType) ? rawServiceType : undefined;

      const where: Prisma.DICHVUWhereInput = {};
      if (search) {
        where.DVCLS_TEN = {
          contains: search,
          mode: 'insensitive',
        };
      }
      if (minPrice !== undefined || maxPrice !== undefined) {
        where.DVCLS_GIA_DV = {
          ...(minPrice !== undefined ? { gte: minPrice } : {}),
          ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
        };
      }
      if (serviceType) {
        where.DVCLS_LOAI = serviceType;
      }
      const finalWhere: Prisma.DICHVUWhereInput | undefined =
        Object.keys(where).length > 0 ? where : undefined;

      const orderBy =
        sortBy === 'name'
          ? { DVCLS_TEN: sortOrder }
          : sortBy === 'price'
            ? { DVCLS_GIA_DV: sortOrder }
            : { DVCLS_MA: sortOrder };

      const [total, items] = await this.prisma.$transaction([
        this.prisma.dICHVU.count({ where: finalWhere }),
        this.prisma.dICHVU.findMany({
          where: finalWhere,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages,
          sortBy,
          sortOrder,
          search: search || '',
          minPrice: minPrice ?? null,
          maxPrice: maxPrice ?? null,
          serviceType: serviceType || '',
        },
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getServiceById(id: number) {
    try {
      const service = await this.prisma.dICHVU.findUnique({
        where: { DVCLS_MA: id },
      });
      if (!service) {
        throw new NotFoundException('Khong tim thay dich vu');
      }
      return service;
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async createService(dto: CreateServiceDto) {
    try {
      return await this.prisma.dICHVU.create({
        data: {
          DVCLS_TEN: dto.DVCLS_TEN,
          DVCLS_LOAI: dto.DVCLS_LOAI || null,
          DVCLS_GIA_DV: dto.DVCLS_GIA_DV ?? 0,
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async updateService(id: number, dto: UpdateServiceDto) {
    try {
      await this.getServiceById(id);
      return await this.prisma.dICHVU.update({
        where: { DVCLS_MA: id },
        data: {
          ...(dto.DVCLS_TEN !== undefined ? { DVCLS_TEN: dto.DVCLS_TEN } : {}),
          ...(dto.DVCLS_LOAI !== undefined ? { DVCLS_LOAI: dto.DVCLS_LOAI || null } : {}),
          ...(dto.DVCLS_GIA_DV !== undefined ? { DVCLS_GIA_DV: dto.DVCLS_GIA_DV } : {}),
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async deleteService(id: number) {
    try {
      await this.getServiceById(id);
      await this.prisma.dICHVU.delete({
        where: { DVCLS_MA: id },
      });
      return { message: 'Xoa dich vu thanh cong' };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'KhĂ´ng thá»ƒ xĂ³a dá»‹ch vá»¥ vĂ¬ dá»‹ch vá»¥ nĂ y Ä‘Ă£ phĂ¡t sinh chá»‰ Ä‘á»‹nh hoáº·c káº¿t quáº£ cáº­n lĂ¢m sĂ ng trong há»“ sÆ¡ khĂ¡m. Vui lĂ²ng ngá»«ng sá»­ dá»¥ng hoáº·c cáº­p nháº­t dá»‹ch vá»¥ thay vĂ¬ xĂ³a.',
        );
      }
      mapPrismaError(e);
    }
  }

  async getMedicines(params?: {
    search?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
    groupId?: string;
    manufacturerId?: string;
    minPrice?: string;
    maxPrice?: string;
    expirationStatus?: string;
  }) {
    try {
      const rawPage = Number.parseInt(params?.page || '1', 10);
      const rawLimit = Number.parseInt(params?.limit || '10', 10);
      const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
      const limit = Number.isNaN(rawLimit)
        ? 10
        : Math.min(Math.max(rawLimit, 1), 100);
      const search = params?.search?.trim();
      const sortBy: 'code' | 'price' =
        params?.sortBy === 'price' ? 'price' : 'code';
      const sortOrder: 'asc' | 'desc' =
        params?.sortOrder === 'desc' ? 'desc' : 'asc';
      const parsedGroupId = Number.parseInt(params?.groupId || '', 10);
      const groupId =
        Number.isNaN(parsedGroupId) || parsedGroupId <= 0
          ? undefined
          : parsedGroupId;
      const parsedManufacturerId = Number.parseInt(
        params?.manufacturerId || '',
        10,
      );
      const manufacturerId =
        Number.isNaN(parsedManufacturerId) || parsedManufacturerId <= 0
          ? undefined
          : parsedManufacturerId;
      const parsedMinPrice = Number.parseFloat(params?.minPrice ?? '');
      const parsedMaxPrice = Number.parseFloat(params?.maxPrice ?? '');
      const minPrice =
        Number.isFinite(parsedMinPrice) && parsedMinPrice >= 0
          ? parsedMinPrice
          : undefined;
      const maxPrice =
        Number.isFinite(parsedMaxPrice) && parsedMaxPrice >= 0
          ? parsedMaxPrice
          : undefined;
      const expirationStatusRaw = params?.expirationStatus?.trim().toLowerCase();
      const expirationStatus: 'all' | 'valid' | 'expiring' | 'expired' =
        expirationStatusRaw === 'valid' ||
        expirationStatusRaw === 'expiring' ||
        expirationStatusRaw === 'expired'
          ? expirationStatusRaw
          : 'all';

      const where: Prisma.THUOCWhereInput = {
        OR: [{ T_DA_XOA: false }, { T_DA_XOA: null }],
      };

      if (search) {
        where.T_TEN_THUOC = {
          contains: search,
          mode: 'insensitive',
        };
      }

      if (groupId) {
        where.NT_MA = groupId;
      }

      if (manufacturerId) {
        where.NSX_MA = manufacturerId;
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        where.T_GIA_THUOC = {
          ...(minPrice !== undefined ? { gte: minPrice } : {}),
          ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
        };
      }

      if (expirationStatus !== 'all') {
        const now = new Date();
        const today = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        );
        const sevenDaysLater = new Date(today);
        sevenDaysLater.setUTCDate(today.getUTCDate() + 7);

        if (expirationStatus === 'expired') {
          where.T_HAN_SU_DUNG = { lt: today };
        } else if (expirationStatus === 'expiring') {
          where.T_HAN_SU_DUNG = { gte: today, lte: sevenDaysLater };
        } else {
          where.T_HAN_SU_DUNG = { gt: sevenDaysLater };
        }
      }

      const orderBy: Prisma.THUOCOrderByWithRelationInput[] =
        sortBy === 'price'
          ? [{ T_GIA_THUOC: sortOrder }, { T_MA: 'asc' }]
          : [{ T_MA: sortOrder }];

      const [total, items] = await this.prisma.$transaction([
        this.prisma.tHUOC.count({ where }),
        this.prisma.tHUOC.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            NHOM_THUOC: {
              select: {
                NT_MA: true,
                NT_TEN: true,
              },
            },
            NHA_SAN_XUAT: {
              select: {
                NSX_MA: true,
                NSX_TEN: true,
              },
            },
            DON_VI_TINH: {
              select: {
                DVT_MA: true,
                DVT_TEN: true,
              },
            },
            BIET_DUOC: {
              select: {
                BD_MA: true,
                BD_TEN: true,
              },
            },
          },
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages,
          sortBy,
          sortOrder,
          search: search || '',
          groupId: groupId ?? null,
          manufacturerId: manufacturerId ?? null,
          minPrice: minPrice ?? null,
          maxPrice: maxPrice ?? null,
          expirationStatus,
        },
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getMedicineFilterOptions() {
    try {
      const [groups, manufacturers, units, brands] = await this.prisma.$transaction([
        this.prisma.nHOM_THUOC.findMany({
          select: {
            NT_MA: true,
            NT_TEN: true,
          },
          orderBy: {
            NT_TEN: 'asc',
          },
        }),
        this.prisma.nHA_SAN_XUAT.findMany({
          select: {
            NSX_MA: true,
            NSX_TEN: true,
          },
          orderBy: {
            NSX_TEN: 'asc',
          },
        }),
        this.prisma.dON_VI_TINH.findMany({
          select: {
            DVT_MA: true,
            DVT_TEN: true,
          },
          orderBy: {
            DVT_TEN: 'asc',
          },
        }),
        this.prisma.bIET_DUOC.findMany({
          select: {
            BD_MA: true,
            BD_TEN: true,
          },
          orderBy: {
            BD_TEN: 'asc',
          },
        }),
      ]);

      return {
        groups,
        manufacturers,
        units,
        brands,
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getMedicineById(id: number) {
    try {
      const medicine = await this.prisma.tHUOC.findFirst({
        where: {
          T_MA: id,
          OR: [{ T_DA_XOA: false }, { T_DA_XOA: null }],
        },
        include: {
          NHOM_THUOC: {
            select: {
              NT_MA: true,
              NT_TEN: true,
            },
          },
          NHA_SAN_XUAT: {
            select: {
              NSX_MA: true,
              NSX_TEN: true,
            },
          },
          DON_VI_TINH: {
            select: {
              DVT_MA: true,
              DVT_TEN: true,
            },
          },
          BIET_DUOC: {
            select: {
              BD_MA: true,
              BD_TEN: true,
              BD_CONG_DUNG: true,
              BD_HAM_LUONG: true,
              BD_LIEU_DUNG: true,
            },
          },
        },
      });

      if (!medicine) {
        throw new NotFoundException('Khong tim thay thuoc');
      }

      return medicine;
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async createMedicine(dto: CreateMedicineDto) {
    try {
      return await this.prisma.tHUOC.create({
        data: {
          T_TEN_THUOC: dto.T_TEN_THUOC.trim(),
          BD_MA: dto.BD_MA ?? null,
          DVT_MA: dto.DVT_MA ?? null,
          NT_MA: dto.NT_MA ?? null,
          NSX_MA: dto.NSX_MA ?? null,
          T_GIA_THUOC: dto.T_GIA_THUOC ?? 0,
          T_HAN_SU_DUNG: dto.T_HAN_SU_DUNG
            ? this.parseDateOnlyOrThrow(dto.T_HAN_SU_DUNG)
            : null,
          T_DA_XOA: false,
        },
        include: {
          NHOM_THUOC: {
            select: {
              NT_MA: true,
              NT_TEN: true,
            },
          },
          NHA_SAN_XUAT: {
            select: {
              NSX_MA: true,
              NSX_TEN: true,
            },
          },
          DON_VI_TINH: {
            select: {
              DVT_MA: true,
              DVT_TEN: true,
            },
          },
          BIET_DUOC: {
            select: {
              BD_MA: true,
              BD_TEN: true,
              BD_CONG_DUNG: true,
              BD_HAM_LUONG: true,
              BD_LIEU_DUNG: true,
            },
          },
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async updateMedicine(id: number, dto: UpdateMedicineDto) {
    try {
      await this.getMedicineById(id);
      return await this.prisma.tHUOC.update({
        where: { T_MA: id },
        data: {
          ...(dto.T_TEN_THUOC !== undefined
            ? { T_TEN_THUOC: dto.T_TEN_THUOC.trim() }
            : {}),
          ...(dto.BD_MA !== undefined ? { BD_MA: dto.BD_MA ?? null } : {}),
          ...(dto.DVT_MA !== undefined ? { DVT_MA: dto.DVT_MA ?? null } : {}),
          ...(dto.NT_MA !== undefined ? { NT_MA: dto.NT_MA ?? null } : {}),
          ...(dto.NSX_MA !== undefined ? { NSX_MA: dto.NSX_MA ?? null } : {}),
          ...(dto.T_GIA_THUOC !== undefined
            ? { T_GIA_THUOC: dto.T_GIA_THUOC }
            : {}),
          ...(dto.T_HAN_SU_DUNG !== undefined
            ? {
                T_HAN_SU_DUNG: dto.T_HAN_SU_DUNG
                  ? this.parseDateOnlyOrThrow(dto.T_HAN_SU_DUNG)
                  : null,
              }
            : {}),
        },
        include: {
          NHOM_THUOC: {
            select: {
              NT_MA: true,
              NT_TEN: true,
            },
          },
          NHA_SAN_XUAT: {
            select: {
              NSX_MA: true,
              NSX_TEN: true,
            },
          },
          DON_VI_TINH: {
            select: {
              DVT_MA: true,
              DVT_TEN: true,
            },
          },
          BIET_DUOC: {
            select: {
              BD_MA: true,
              BD_TEN: true,
              BD_CONG_DUNG: true,
              BD_HAM_LUONG: true,
              BD_LIEU_DUNG: true,
            },
          },
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async updateMedicineBrandInfo(id: number, dto: UpdateMedicineBrandInfoDto) {
    try {
      const medicine = await this.getMedicineById(id);
      const brandName = dto.BD_TEN?.trim();
      if (dto.BD_TEN !== undefined && !brandName) {
        throw new BadRequestException('Ten biet duoc khong duoc de trong.');
      }
      const brandData = {
        ...(dto.BD_TEN !== undefined ? { BD_TEN: brandName } : {}),
        ...(dto.BD_CONG_DUNG !== undefined
          ? { BD_CONG_DUNG: dto.BD_CONG_DUNG.trim() || null }
          : {}),
        ...(dto.BD_HAM_LUONG !== undefined
          ? { BD_HAM_LUONG: dto.BD_HAM_LUONG.trim() || null }
          : {}),
        ...(dto.BD_LIEU_DUNG !== undefined
          ? { BD_LIEU_DUNG: dto.BD_LIEU_DUNG.trim() || null }
          : {}),
      };

      if (medicine.BD_MA) {
        await this.prisma.bIET_DUOC.update({
          where: { BD_MA: medicine.BD_MA },
          data: brandData,
        });
        return this.getMedicineById(id);
      }

      if (!brandName) {
        throw new BadRequestException(
          'Thuoc chua co biet duoc. Vui long nhap ten biet duoc de tao moi.',
        );
      }

      const createdBrand = await this.prisma.bIET_DUOC.create({
        data: {
          BD_TEN: brandName,
          BD_CONG_DUNG: dto.BD_CONG_DUNG?.trim() || null,
          BD_HAM_LUONG: dto.BD_HAM_LUONG?.trim() || null,
          BD_LIEU_DUNG: dto.BD_LIEU_DUNG?.trim() || null,
        },
      });

      await this.prisma.tHUOC.update({
        where: { T_MA: id },
        data: {
          BD_MA: createdBrand.BD_MA,
        },
      });

      return this.getMedicineById(id);
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async deleteMedicine(id: number) {
    try {
      await this.getMedicineById(id);
      await this.prisma.tHUOC.delete({
        where: { T_MA: id },
      });
      return { message: 'Xoa thuoc thanh cong' };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'Khong the xoa thuoc nay vi da co trong don thuoc hoac du lieu lien quan.',
        );
      }
      mapPrismaError(e);
    }
  }

  async getDoctors(params?: {
    search?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
    specialtyId?: string;
    academicTitle?: string;
  }) {
    try {
      const rawPage = Number.parseInt(params?.page || '1', 10);
      const rawLimit = Number.parseInt(params?.limit || '10', 10);
      const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
      const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 100);
      const search = params?.search?.trim();
      const sortBy: 'code' = 'code';
      const sortOrder: 'asc' | 'desc' = params?.sortOrder === 'desc' ? 'desc' : 'asc';
      const parsedSpecialtyId = Number.parseInt(params?.specialtyId || '', 10);
      const specialtyId = Number.isNaN(parsedSpecialtyId) ? undefined : parsedSpecialtyId;
      const academicTitle = params?.academicTitle?.trim() || undefined;

      const where: Prisma.BAC_SIWhereInput = {
        BS_DA_XOA: false,
        ...(search
          ? {
              OR: [
                { BS_HO_TEN: { contains: search, mode: 'insensitive' } },
                { BS_SDT: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(specialtyId ? { CK_MA: specialtyId } : {}),
        ...(academicTitle ? { BS_HOC_HAM: academicTitle } : {}),
      };

      const [total, items] = await this.prisma.$transaction([
        this.prisma.bAC_SI.count({ where }),
        this.prisma.bAC_SI.findMany({
          where,
          orderBy: { BS_MA: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            CHUYEN_KHOA: {
              select: {
                CK_MA: true,
                CK_TEN: true,
              },
            },
          },
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages,
          sortBy,
          sortOrder,
          search: search || '',
          specialtyId: specialtyId ?? null,
          academicTitle: academicTitle || '',
        },
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getDoctorAcademicTitles() {
    try {
      const rows = await this.prisma.bAC_SI.findMany({
        where: {
          BS_DA_XOA: false,
          BS_HOC_HAM: {
            not: null,
          },
        },
        select: {
          BS_HOC_HAM: true,
        },
        distinct: ['BS_HOC_HAM'],
        orderBy: {
          BS_HOC_HAM: 'asc',
        },
      });

      return rows
        .map((row) => row.BS_HOC_HAM?.trim() || '')
        .filter((value) => value.length > 0);
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getDoctorById(id: number) {
    try {
      const doctor = await this.prisma.bAC_SI.findFirst({
        where: {
          BS_MA: id,
          BS_DA_XOA: false,
        },
        include: {
          CHUYEN_KHOA: {
            select: {
              CK_MA: true,
              CK_TEN: true,
            },
          },
        },
      });
      if (!doctor) {
        throw new NotFoundException('Khong tim thay bac si');
      }
      return doctor;
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async createDoctor(dto: CreateDoctorDto) {
    try {
      return await this.prisma.bAC_SI.create({
        data: {
          BS_HO_TEN: dto.BS_HO_TEN.trim(),
          CK_MA: dto.CK_MA,
          BS_SDT: dto.BS_SDT?.trim() || null,
          BS_EMAIL: dto.BS_EMAIL?.trim() || null,
          BS_HOC_HAM: dto.BS_HOC_HAM?.trim() || null,
          BS_ANH: dto.BS_ANH?.trim() || null,
          BS_DA_XOA: false,
        },
        include: {
          CHUYEN_KHOA: {
            select: {
              CK_MA: true,
              CK_TEN: true,
            },
          },
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async updateDoctor(id: number, dto: UpdateDoctorDto) {
    try {
      await this.getDoctorById(id);

      return await this.prisma.bAC_SI.update({
        where: { BS_MA: id },
        data: {
          ...(dto.BS_HO_TEN !== undefined ? { BS_HO_TEN: dto.BS_HO_TEN.trim() } : {}),
          ...(dto.CK_MA !== undefined ? { CK_MA: dto.CK_MA } : {}),
          ...(dto.BS_SDT !== undefined ? { BS_SDT: dto.BS_SDT.trim() || null } : {}),
          ...(dto.BS_EMAIL !== undefined ? { BS_EMAIL: dto.BS_EMAIL.trim() || null } : {}),
          ...(dto.BS_HOC_HAM !== undefined ? { BS_HOC_HAM: dto.BS_HOC_HAM.trim() || null } : {}),
          ...(dto.BS_ANH !== undefined ? { BS_ANH: dto.BS_ANH.trim() || null } : {}),
          BS_NGAY_CAP_NHAT: new Date(),
        },
        include: {
          CHUYEN_KHOA: {
            select: {
              CK_MA: true,
              CK_TEN: true,
            },
          },
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async deleteDoctor(id: number) {
    try {
      await this.getDoctorById(id);
      await this.prisma.bAC_SI.delete({
        where: { BS_MA: id },
      });
      return { message: 'Xoa bac si thanh cong' };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'Khong the xoa bac si nay vi da co du lieu lien quan o bang khac. Vui long xu ly du lieu lien quan truoc khi thu lai.',
        );
      }
      mapPrismaError(e);
    }
  }

  async getPatients(params?: {
    search?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
    gender?: string;
    nationality?: string;
    ethnicity?: string;
    patientType?: string;
    accountPhone?: string;
  }) {
    try {
      const rawPage = Number.parseInt(params?.page || '1', 10);
      const rawLimit = Number.parseInt(params?.limit || '10', 10);
      const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
      const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 100);
      const search = params?.search?.trim();
      const sortBy: 'code' | 'name' = params?.sortBy === 'name' ? 'name' : 'code';
      const sortOrder: 'asc' | 'desc' = params?.sortOrder === 'desc' ? 'desc' : 'asc';

      const genderParam = params?.gender?.trim().toLowerCase();
      const gender =
        genderParam === 'male' ? true : genderParam === 'female' ? false : undefined;
      const nationality = params?.nationality?.trim() || undefined;
      const ethnicity = params?.ethnicity?.trim() || undefined;
      const patientTypeParam = params?.patientType?.trim().toLowerCase();
      const patientType =
        patientTypeParam === 'new'
          ? true
          : patientTypeParam === 'returning'
            ? false
            : undefined;
      const accountPhone = params?.accountPhone?.trim() || undefined;

      const where: Prisma.BENH_NHANWhereInput = {
        ...(search
          ? {
              OR: [
                { BN_HO_CHU_LOT: { contains: search, mode: 'insensitive' } },
                { BN_TEN: { contains: search, mode: 'insensitive' } },
                { BN_SDT_DANG_KY: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(gender !== undefined ? { BN_LA_NAM: gender } : {}),
        ...(nationality ? { BN_QUOC_GIA: nationality } : {}),
        ...(ethnicity ? { BN_DAN_TOC: ethnicity } : {}),
        ...(patientType !== undefined ? { BN_MOI: patientType } : {}),
        ...(accountPhone ? { TK_SDT: accountPhone } : {}),
      };

      const orderBy =
        sortBy === 'name'
          ? [{ BN_TEN: sortOrder }, { BN_HO_CHU_LOT: sortOrder }, { BN_MA: 'asc' as const }]
          : [{ BN_MA: sortOrder }];

      const [total, items] = await this.prisma.$transaction([
        this.prisma.bENH_NHAN.count({ where }),
        this.prisma.bENH_NHAN.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages,
          sortBy,
          sortOrder,
          search: search || '',
          gender: genderParam === 'male' || genderParam === 'female' ? genderParam : 'all',
          nationality: nationality || '',
          ethnicity: ethnicity || '',
          patientType:
            patientTypeParam === 'new' || patientTypeParam === 'returning'
              ? patientTypeParam
              : 'all',
          accountPhone: accountPhone || '',
        },
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getPatientFilterOptions() {
    try {
      const [nationalityRows, ethnicityRows] = await this.prisma.$transaction([
        this.prisma.bENH_NHAN.findMany({
          where: {
            BN_QUOC_GIA: {
              not: null,
            },
          },
          select: {
            BN_QUOC_GIA: true,
          },
          distinct: ['BN_QUOC_GIA'],
          orderBy: {
            BN_QUOC_GIA: 'asc',
          },
        }),
        this.prisma.bENH_NHAN.findMany({
          where: {
            BN_DAN_TOC: {
              not: null,
            },
          },
          select: {
            BN_DAN_TOC: true,
          },
          distinct: ['BN_DAN_TOC'],
          orderBy: {
            BN_DAN_TOC: 'asc',
          },
        }),
      ]);

      return {
        nationalities: nationalityRows
          .map((row) => row.BN_QUOC_GIA?.trim() || '')
          .filter((value) => value.length > 0),
        ethnicities: ethnicityRows
          .map((row) => row.BN_DAN_TOC?.trim() || '')
          .filter((value) => value.length > 0),
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getPatientById(id: number) {
    try {
      const patient = await this.prisma.bENH_NHAN.findUnique({
        where: { BN_MA: id },
      });

      if (!patient) {
        throw new NotFoundException('Khong tim thay benh nhan');
      }

      return patient;
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async createPatient(dto: CreatePatientDto) {
    try {
      const accountPhone = dto.TK_SDT?.trim() || null;
      if (accountPhone) {
        const account = await this.prisma.tAI_KHOAN.findUnique({
          where: { TK_SDT: accountPhone },
          select: { TK_DA_XOA: true },
        });

        if (!account || account.TK_DA_XOA) {
          throw new NotFoundException('Khong tim thay tai khoan quan ly hop le');
        }

        const managedCount = await this.prisma.bENH_NHAN.count({
          where: { TK_SDT: accountPhone },
        });

        if (managedCount >= 10) {
          throw new ConflictException(
            'Moi tai khoan chi duoc quan ly toi da 10 ho so benh nhan.',
          );
        }
      }

      return await this.prisma.bENH_NHAN.create({
        data: {
          TK_SDT: accountPhone,
          BN_HO_CHU_LOT: dto.BN_HO_CHU_LOT?.trim() || null,
          BN_TEN: dto.BN_TEN.trim(),
          BN_LA_NAM: dto.BN_LA_NAM ?? null,
          BN_SDT_DANG_KY: dto.BN_SDT_DANG_KY?.trim() || null,
          BN_EMAIL: dto.BN_EMAIL?.trim() || null,
          BN_CCCD: dto.BN_CCCD?.trim() || null,
          BN_QUOC_GIA: dto.BN_QUOC_GIA?.trim() || null,
          BN_DAN_TOC: dto.BN_DAN_TOC?.trim() || null,
          BN_SO_DDCN: dto.BN_SO_DDCN?.trim() || null,
          BN_MOI: dto.BN_MOI ?? false,
          BN_ANH: dto.BN_ANH?.trim() || null,
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async updatePatient(id: number, dto: UpdatePatientDto) {
    try {
      const currentPatient = await this.getPatientById(id);
      const targetAccountPhone =
        dto.TK_SDT !== undefined ? dto.TK_SDT.trim() || null : currentPatient.TK_SDT || null;

      if (
        targetAccountPhone &&
        targetAccountPhone !== (currentPatient.TK_SDT || null)
      ) {
        const account = await this.prisma.tAI_KHOAN.findUnique({
          where: { TK_SDT: targetAccountPhone },
          select: { TK_DA_XOA: true },
        });

        if (!account || account.TK_DA_XOA) {
          throw new NotFoundException('Khong tim thay tai khoan quan ly hop le');
        }

        const managedCount = await this.prisma.bENH_NHAN.count({
          where: { TK_SDT: targetAccountPhone },
        });

        if (managedCount >= 10) {
          throw new ConflictException(
            'Moi tai khoan chi duoc quan ly toi da 10 ho so benh nhan.',
          );
        }
      }

      return await this.prisma.bENH_NHAN.update({
        where: { BN_MA: id },
        data: {
          ...(dto.TK_SDT !== undefined ? { TK_SDT: dto.TK_SDT.trim() || null } : {}),
          ...(dto.BN_HO_CHU_LOT !== undefined
            ? { BN_HO_CHU_LOT: dto.BN_HO_CHU_LOT.trim() || null }
            : {}),
          ...(dto.BN_TEN !== undefined ? { BN_TEN: dto.BN_TEN.trim() } : {}),
          ...(dto.BN_LA_NAM !== undefined ? { BN_LA_NAM: dto.BN_LA_NAM } : {}),
          ...(dto.BN_SDT_DANG_KY !== undefined
            ? { BN_SDT_DANG_KY: dto.BN_SDT_DANG_KY.trim() || null }
            : {}),
          ...(dto.BN_EMAIL !== undefined ? { BN_EMAIL: dto.BN_EMAIL.trim() || null } : {}),
          ...(dto.BN_CCCD !== undefined ? { BN_CCCD: dto.BN_CCCD.trim() || null } : {}),
          ...(dto.BN_QUOC_GIA !== undefined
            ? { BN_QUOC_GIA: dto.BN_QUOC_GIA.trim() || null }
            : {}),
          ...(dto.BN_DAN_TOC !== undefined
            ? { BN_DAN_TOC: dto.BN_DAN_TOC.trim() || null }
            : {}),
          ...(dto.BN_SO_DDCN !== undefined
            ? { BN_SO_DDCN: dto.BN_SO_DDCN.trim() || null }
            : {}),
          ...(dto.BN_MOI !== undefined ? { BN_MOI: dto.BN_MOI } : {}),
          ...(dto.BN_ANH !== undefined ? { BN_ANH: dto.BN_ANH.trim() || null } : {}),
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async deletePatient(id: number) {
    try {
      await this.getPatientById(id);
      await this.prisma.bENH_NHAN.delete({
        where: { BN_MA: id },
      });
      return { message: 'Xoa benh nhan thanh cong' };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'Khong the xoa benh nhan nay vi da co du lieu kham benh hoac thanh toan lien quan.',
        );
      }
      mapPrismaError(e);
    }
  }

  async getAccounts(params?: {
    search?: string;
    page?: string;
    limit?: string;
    role?: string;
    deletedStatus?: string;
  }) {
    try {
      const rawPage = Number.parseInt(params?.page || '1', 10);
      const rawLimit = Number.parseInt(params?.limit || '10', 10);
      const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
      const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 100);
      const search = params?.search?.trim();
      const role = params?.role?.trim();
      const deletedStatus = params?.deletedStatus?.trim();

      const where: Prisma.TAI_KHOANWhereInput = {
        ...(search
          ? {
              TK_SDT: {
                contains: search,
                mode: 'insensitive',
              },
            }
          : {}),
        ...(role && role !== 'all' ? { TK_VAI_TRO: role } : {}),
        ...(deletedStatus === 'deleted'
          ? { TK_DA_XOA: true }
          : deletedStatus === 'active'
            ? {
                OR: [{ TK_DA_XOA: false }, { TK_DA_XOA: null }],
              }
            : {}),
      };

      const [total, items] = await this.prisma.$transaction([
        this.prisma.tAI_KHOAN.count({ where }),
        this.prisma.tAI_KHOAN.findMany({
          where,
          orderBy: { TK_SDT: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            _count: {
              select: {
                BENH_NHAN: true,
              },
            },
            BAC_SI: {
              select: {
                BS_HO_TEN: true,
              },
            },
            BENH_NHAN: {
              select: {
                BN_HO_CHU_LOT: true,
                BN_TEN: true,
              },
              orderBy: {
                BN_MA: 'asc',
              },
              take: 1,
            },
          },
        }),
      ]);

      const totalPages = Math.max(1, Math.ceil(total / limit));

      return {
        items: items.map((account) => ({
          TK_SDT: account.TK_SDT,
          TK_PASS_MASKED: account.TK_PASS ? `${account.TK_PASS.slice(0, 10)}...` : null,
          TK_VAI_TRO: account.TK_VAI_TRO,
          TK_DA_XOA: account.TK_DA_XOA,
          TK_NGAY_TAO: account.TK_NGAY_TAO,
          TK_NGAY_CAP_NHAT: account.TK_NGAY_CAP_NHAT,
          doctorName: account.BAC_SI?.BS_HO_TEN || null,
          primaryPatientName:
            account.BENH_NHAN[0]
              ? `${account.BENH_NHAN[0].BN_HO_CHU_LOT || ''} ${account.BENH_NHAN[0].BN_TEN || ''}`.trim()
              : null,
          managedPatientCount: account._count.BENH_NHAN,
          managedPatientLimitReached: account._count.BENH_NHAN >= 10,
        })),
        meta: {
          total,
          page,
          limit,
          totalPages,
          search: search || '',
          role: role && role !== 'all' ? role : 'all',
          deletedStatus:
            deletedStatus === 'active' || deletedStatus === 'deleted'
              ? deletedStatus
              : 'all',
        },
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getAccountById(id: string) {
    try {
      const account = await this.prisma.tAI_KHOAN.findUnique({
        where: { TK_SDT: id },
      });

      if (!account) {
        throw new NotFoundException('Khong tim thay tai khoan');
      }

      return account;
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async createAccount(dto: CreateAccountDto) {
    try {
      const hashedPassword = await bcrypt.hash(dto.TK_PASS, 10);

      return await this.prisma.tAI_KHOAN.create({
        data: {
          TK_SDT: dto.TK_SDT.trim(),
          TK_PASS: hashedPassword,
          TK_VAI_TRO: dto.TK_VAI_TRO,
          TK_DA_XOA: false,
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async updateAccount(id: string, dto: UpdateAccountDto) {
    try {
      await this.getAccountById(id);

      const updateData: Prisma.TAI_KHOANUpdateInput = {
        ...(dto.TK_VAI_TRO !== undefined ? { TK_VAI_TRO: dto.TK_VAI_TRO } : {}),
        ...(dto.TK_DA_XOA !== undefined ? { TK_DA_XOA: dto.TK_DA_XOA } : {}),
        TK_NGAY_CAP_NHAT: new Date(),
      };

      if (dto.TK_PASS) {
        updateData.TK_PASS = await bcrypt.hash(dto.TK_PASS, 10);
      }

      return await this.prisma.tAI_KHOAN.update({
        where: { TK_SDT: id },
        data: updateData,
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async deleteAccount(id: string) {
    try {
      await this.getAccountById(id);

      await this.prisma.tAI_KHOAN.update({
        where: { TK_SDT: id },
        data: {
          TK_DA_XOA: true,
          TK_NGAY_CAP_NHAT: new Date(),
        },
      });

      return { message: 'Xoa tai khoan thanh cong' };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'Khong the xoa tai khoan nay vi da co du lieu lien quan.',
        );
      }
      mapPrismaError(e);
    }
  }

  async getScheduleManagementOptions() {
    try {
      const [specialties, doctors, rooms, sessions] = await this.prisma.$transaction([
        this.prisma.cHUYEN_KHOA.findMany({
          select: { CK_MA: true, CK_TEN: true },
          orderBy: { CK_TEN: 'asc' },
        }),
        this.prisma.bAC_SI.findMany({
          where: { BS_DA_XOA: false },
          select: {
            BS_MA: true,
            BS_HO_TEN: true,
            CK_MA: true,
            CHUYEN_KHOA: { select: { CK_TEN: true } },
          },
          orderBy: { BS_HO_TEN: 'asc' },
        }),
        this.prisma.pHONG.findMany({
          select: {
            P_MA: true,
            P_TEN: true,
            CK_MA: true,
            CHUYEN_KHOA: { select: { CK_TEN: true } },
          },
          orderBy: { P_TEN: 'asc' },
        }),
        this.prisma.bUOI.findMany({
          select: { B_TEN: true, B_GIO_BAT_DAU: true, B_GIO_KET_THUC: true },
          orderBy: { B_GIO_BAT_DAU: 'asc' },
        }),
      ]);

      return { specialties, doctors, rooms, sessions };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getSchedulePlanningExisting(params: {
    dateFrom: string;
    dateTo: string;
    specialtyId?: string;
  }) {
    try {
      const dateFromRaw = params.dateFrom?.trim();
      const dateToRaw = params.dateTo?.trim();
      if (!dateFromRaw || !dateToRaw) {
        throw new BadRequestException('Vui lòng chọn đầy đủ khoảng thời gian.');
      }
      const dateFrom = this.parseDateOnlyOrThrow(dateFromRaw);
      const dateTo = this.parseDateOnlyOrThrow(dateToRaw);
      if (dateFrom > dateTo) {
        throw new BadRequestException('Từ ngày phải nhỏ hơn hoặc bằng đến ngày.');
      }

      const parsedSpecialtyId = Number.parseInt(params.specialtyId || '', 10);
      const specialtyId = Number.isNaN(parsedSpecialtyId) ? undefined : parsedSpecialtyId;

      const rows = await this.prisma.lICH_BSK.findMany({
        where: {
          LBSK_IS_ARCHIVED: false,
          N_NGAY: { gte: dateFrom, lte: dateTo },
          ...(specialtyId ? { BAC_SI: { CK_MA: specialtyId } } : {}),
        },
        include: {
          BUOI: {
            select: {
              KHUNG_GIO: {
                select: {
                  KG_MA: true,
                  KG_SO_BN_TOI_DA: true,
                },
              },
            },
          },
          DANG_KY: {
            where: {
              DK_TRANG_THAI: {
                notIn: Array.from(BOOKING_CANCELLED_STATUSES),
              },
            },
            select: {
              DK_MA: true,
            },
          },
          DOT_LICH_TUAN: {
            select: {
              DLT_TRANG_THAI: true,
            },
          },
          BAC_SI: {
            select: {
              BS_MA: true,
              BS_HO_TEN: true,
              CK_MA: true,
              CHUYEN_KHOA: { select: { CK_TEN: true } },
            },
          },
          PHONG: {
            select: {
              P_MA: true,
              P_TEN: true,
              CK_MA: true,
              CHUYEN_KHOA: { select: { CK_TEN: true } },
            },
          },
        },
        orderBy: [{ N_NGAY: 'asc' }, { B_TEN: 'asc' }],
      });

      return {
        items: rows.map((row) => ({
          slotCount: row.BUOI?.KHUNG_GIO?.length ?? 0,
          slotCapacity: (row.BUOI?.KHUNG_GIO ?? []).reduce(
            (sum, slot) => sum + (slot.KG_SO_BN_TOI_DA ?? 5),
            0,
          ),
          bookingCount: row.DANG_KY?.length ?? 0,
          BS_MA: row.BS_MA,
          P_MA: row.P_MA,
          N_NGAY: this.toDateOnlyIso(row.N_NGAY),
          B_TEN: row.B_TEN,
          status: this.normalizeScheduleInstanceStatus(row.LBSK_TRANG_THAI),
          weekStatus: this.normalizeScheduleWeekStatus(row.DOT_LICH_TUAN?.DLT_TRANG_THAI),
          source: this.normalizeScheduleSource(row.LBSK_NGUON),
          doctor: row.BAC_SI,
          room: row.PHONG,
        })),
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async createSchedulePlanningDraft(
    payload: {
      dateFrom: string;
      dateTo: string;
      specialtyId: number;
      assignments: SchedulePlanningAssignment[];
    },
    actor: string,
  ) {
    try {
      const dateFrom = this.parseDateOnlyOrThrow(payload.dateFrom);
      const dateTo = this.parseDateOnlyOrThrow(payload.dateTo);
      if (dateFrom > dateTo) {
        throw new BadRequestException('Từ ngày phải nhỏ hơn hoặc bằng đến ngày.');
      }

      const specialty = await this.prisma.cHUYEN_KHOA.findUnique({
        where: { CK_MA: payload.specialtyId },
        select: { CK_MA: true },
      });
      if (!specialty) {
        throw new NotFoundException('Không tìm thấy chuyên khoa cần lưu nháp.');
      }

      const created = await this.prisma.lICH_BSK_NHAP.create({
        data: {
          CK_MA: payload.specialtyId,
          LBN_TU_NGAY: dateFrom,
          LBN_DEN_NGAY: dateTo,
          LBN_DU_LIEU: payload.assignments ?? [],
          LBN_TAO_LUC: new Date(),
          LBN_TAO_BOI: actor,
          LBN_CAP_NHAT_LUC: new Date(),
          LBN_CAP_NHAT_BOI: actor,
        },
      });

      return {
        id: created.LBN_ID,
        dateFrom: this.toDateOnlyIso(created.LBN_TU_NGAY),
        dateTo: this.toDateOnlyIso(created.LBN_DEN_NGAY),
        specialtyId: created.CK_MA,
        assignments: created.LBN_DU_LIEU,
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async updateSchedulePlanningDraft(
    id: number,
    payload: {
      dateFrom: string;
      dateTo: string;
      specialtyId: number;
      assignments: SchedulePlanningAssignment[];
    },
    actor: string,
  ) {
    try {
      const dateFrom = this.parseDateOnlyOrThrow(payload.dateFrom);
      const dateTo = this.parseDateOnlyOrThrow(payload.dateTo);
      if (dateFrom > dateTo) {
        throw new BadRequestException('Từ ngày phải nhỏ hơn hoặc bằng đến ngày.');
      }

      const existing = await this.prisma.lICH_BSK_NHAP.findUnique({
        where: { LBN_ID: id },
      });
      if (!existing) {
        throw new NotFoundException('Không tìm thấy nháp cần cập nhật.');
      }

      const updated = await this.prisma.lICH_BSK_NHAP.update({
        where: { LBN_ID: id },
        data: {
          CK_MA: payload.specialtyId,
          LBN_TU_NGAY: dateFrom,
          LBN_DEN_NGAY: dateTo,
          LBN_DU_LIEU: payload.assignments ?? [],
          LBN_CAP_NHAT_LUC: new Date(),
          LBN_CAP_NHAT_BOI: actor,
        },
      });

      return {
        id: updated.LBN_ID,
        dateFrom: this.toDateOnlyIso(updated.LBN_TU_NGAY),
        dateTo: this.toDateOnlyIso(updated.LBN_DEN_NGAY),
        specialtyId: updated.CK_MA,
        assignments: updated.LBN_DU_LIEU,
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getSchedulePlanningDraft(id: number) {
    try {
      const draft = await this.prisma.lICH_BSK_NHAP.findUnique({
        where: { LBN_ID: id },
      });
      if (!draft) {
        throw new NotFoundException('Không tìm thấy nháp cần tải.');
      }

      return {
        id: draft.LBN_ID,
        dateFrom: this.toDateOnlyIso(draft.LBN_TU_NGAY),
        dateTo: this.toDateOnlyIso(draft.LBN_DEN_NGAY),
        specialtyId: draft.CK_MA,
        assignments: draft.LBN_DU_LIEU,
        updatedAt: draft.LBN_CAP_NHAT_LUC,
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getLatestSchedulePlanningDraft(params?: { specialtyId?: string }) {
    try {
      const parsedSpecialtyId = Number.parseInt(params?.specialtyId || '', 10);
      const specialtyId = Number.isNaN(parsedSpecialtyId) ? undefined : parsedSpecialtyId;

      const draft = await this.prisma.lICH_BSK_NHAP.findFirst({
        where: {
          ...(specialtyId ? { CK_MA: specialtyId } : {}),
        },
        orderBy: [{ LBN_CAP_NHAT_LUC: 'desc' }, { LBN_ID: 'desc' }],
      });
      if (!draft) {
        throw new NotFoundException('Chưa có nháp gần nhất phù hợp.');
      }

      return {
        id: draft.LBN_ID,
        dateFrom: this.toDateOnlyIso(draft.LBN_TU_NGAY),
        dateTo: this.toDateOnlyIso(draft.LBN_DEN_NGAY),
        specialtyId: draft.CK_MA,
        assignments: draft.LBN_DU_LIEU,
        updatedAt: draft.LBN_CAP_NHAT_LUC,
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async generateSchedulePlanning(
    payload: {
      dateFrom: string;
      dateTo: string;
      specialtyId: number;
      assignments: SchedulePlanningAssignment[];
      overwriteMode?: SchedulePlanningOverwriteMode;
      status?: OfficialShiftDisplayStatus;
    },
    actor: string,
  ) {
    try {
      const dateFrom = this.parseDateOnlyOrThrow(payload.dateFrom);
      const dateTo = this.parseDateOnlyOrThrow(payload.dateTo);
      if (dateFrom > dateTo) {
        throw new BadRequestException('Từ ngày phải nhỏ hơn hoặc bằng đến ngày.');
      }
      const overwriteMode: SchedulePlanningOverwriteMode = payload.overwriteMode || 'skip';

      const assignments = Array.isArray(payload.assignments)
        ? payload.assignments
        : [];
      if (assignments.length === 0) {
        throw new BadRequestException('Chưa có phân công nào để tạo lịch trực.');
      }

      const specialty = await this.prisma.cHUYEN_KHOA.findUnique({
        where: { CK_MA: payload.specialtyId },
        select: { CK_MA: true },
      });
      if (!specialty) {
        throw new NotFoundException('Không tìm thấy chuyên khoa cần tạo lịch.');
      }

      const existing = await this.prisma.lICH_BSK.findMany({
        where: {
          LBSK_IS_ARCHIVED: false,
          N_NGAY: { gte: dateFrom, lte: dateTo },
          ...(payload.specialtyId ? { BAC_SI: { CK_MA: payload.specialtyId } } : {}),
        },
        select: { BS_MA: true, P_MA: true, N_NGAY: true, B_TEN: true },
      });

      const existingRoomSlot = new Map<string, { BS_MA: number; N_NGAY: Date; B_TEN: string; P_MA: number }>();
      const existingDoctorSlot = new Map<string, { BS_MA: number; N_NGAY: Date; B_TEN: string; P_MA: number }>();
      for (const row of existing) {
        const dateIso = this.toDateOnlyIso(row.N_NGAY);
        existingRoomSlot.set(`${row.P_MA}::${dateIso}::${row.B_TEN}`, row);
        existingDoctorSlot.set(`${row.BS_MA}::${dateIso}::${row.B_TEN}`, row);
      }

      const payloadDoctorSlot = new Map<string, SchedulePlanningAssignment>();
      const payloadRoomSlot = new Map<string, SchedulePlanningAssignment>();
      let created = 0;
      let updated = 0;
      let skipped = 0;
      let conflicts = 0;
      const conflictItems: Array<{
        date: string;
        session: string;
        roomId: number;
        doctorId: number;
        reason: string;
      }> = [];

      for (const assignment of assignments) {
        const dateIso = assignment?.date?.trim();
        const session = assignment?.session?.trim();
        if (!dateIso || !session) {
          conflicts += 1;
          conflictItems.push({
            date: dateIso || '',
            session: session || '',
            roomId: assignment?.roomId ?? 0,
            doctorId: assignment?.doctorId ?? 0,
            reason: 'Thiếu ngày hoặc buổi.',
          });
          continue;
        }

        const targetDate = this.parseDateOnlyOrThrow(dateIso);
        if (targetDate < dateFrom || targetDate > dateTo) {
          conflicts += 1;
          conflictItems.push({
            date: dateIso,
            session,
            roomId: assignment.roomId,
            doctorId: assignment.doctorId,
            reason: 'Ngoài phạm vi ngày đã chọn.',
          });
          continue;
        }

        if (this.isSundayScheduleRestrictionEnabled() && this.getWeekdayFromDate(targetDate) === 0) {
          conflicts += 1;
          conflictItems.push({
            date: dateIso,
            session,
            roomId: assignment.roomId,
            doctorId: assignment.doctorId,
            reason: 'Không hỗ trợ Chủ nhật.',
          });
          continue;
        }

        const doctorSlotKey = `${assignment.doctorId}::${dateIso}::${session}`;
        if (payloadDoctorSlot.has(doctorSlotKey)) {
          conflicts += 1;
          conflictItems.push({
            date: dateIso,
            session,
            roomId: assignment.roomId,
            doctorId: assignment.doctorId,
            reason: 'Bác sĩ đã được phân công ở buổi này.',
          });
          continue;
        }
        payloadDoctorSlot.set(doctorSlotKey, assignment);

        const roomSlotKey = `${assignment.roomId}::${dateIso}::${session}`;
        if (payloadRoomSlot.has(roomSlotKey)) {
          conflicts += 1;
          conflictItems.push({
            date: dateIso,
            session,
            roomId: assignment.roomId,
            doctorId: assignment.doctorId,
            reason: 'Phòng đã được phân công ở buổi này.',
          });
          continue;
        }
        payloadRoomSlot.set(roomSlotKey, assignment);
        const existingSlot = existingRoomSlot.get(roomSlotKey);

        if (existingSlot && overwriteMode !== 'overwrite') {
          skipped += 1;
          continue;
        }

        try {
          if (existingSlot && overwriteMode === 'overwrite') {
            await this.updateOfficialSchedule(existingSlot.BS_MA, dateIso, session, {
              BS_MA: assignment.doctorId,
              P_MA: assignment.roomId,
              N_NGAY: dateIso,
              B_TEN: session,
              status: payload.status,
            });
            updated += 1;
          } else {
            if (overwriteMode === 'only_empty') {
              const occupiedByDoctor = existingDoctorSlot.get(doctorSlotKey);
              if (occupiedByDoctor) {
                skipped += 1;
                continue;
              }
            }
            await this.createOfficialSchedule({
              BS_MA: assignment.doctorId,
              P_MA: assignment.roomId,
              N_NGAY: dateIso,
              B_TEN: session,
              status: payload.status,
            });
            created += 1;
          }
        } catch (error: any) {
          conflicts += 1;
          conflictItems.push({
            date: dateIso,
            session,
            roomId: assignment.roomId,
            doctorId: assignment.doctorId,
            reason: error instanceof Error ? error.message : 'Lỗi tạo lịch trực.',
          });
        }
      }

      return {
        message: 'Đã xử lý tạo lịch trực theo phân bổ.',
        created,
        updated,
        skipped,
        conflicts,
        conflictItems,
        actor,
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async archiveSchedules(
    payload: {
      dateFrom: string;
      dateTo: string;
      specialtyId?: number;
      source?: string;
      reason?: string;
      confirm?: boolean;
    },
    actor = 'ADMIN',
  ) {
    try {
      const dateFrom = this.parseDateOnlyOrThrow(payload.dateFrom);
      const dateTo = this.parseDateOnlyOrThrow(payload.dateTo);
      if (dateFrom > dateTo) {
        throw new BadRequestException('Từ ngày phải nhỏ hơn hoặc bằng đến ngày.');
      }

      const parsedSpecialtyId = Number.parseInt(String(payload.specialtyId ?? ''), 10);
      const specialtyId = Number.isNaN(parsedSpecialtyId) ? undefined : parsedSpecialtyId;
      const rawSource = payload.source?.trim().toLowerCase() || '';
      const sourceFilter =
        rawSource && rawSource !== 'all' ? rawSource : undefined;
      if (
        sourceFilter &&
        ![
          'legacy_registration',
          'template',
          'admin_manual',
          'auto_rolling',
          'copied_1_month',
          'copied_2_months',
          'copied_3_months',
        ].includes(sourceFilter)
      ) {
        throw new BadRequestException('Nguồn lịch không hợp lệ.');
      }

      const rows = await this.prisma.lICH_BSK.findMany({
        where: {
          N_NGAY: { gte: dateFrom, lte: dateTo },
          ...(specialtyId ? { BAC_SI: { CK_MA: specialtyId } } : {}),
          ...(sourceFilter ? { LBSK_NGUON: sourceFilter } : {}),
        },
        select: {
          BS_MA: true,
          N_NGAY: true,
          B_TEN: true,
          LBSK_NGUON: true,
          LBSK_TRANG_THAI: true,
          LBSK_IS_ARCHIVED: true,
          DANG_KY: {
            where: { DK_TRANG_THAI: { notIn: Array.from(BOOKING_CANCELLED_STATUSES) } },
            select: { DK_MA: true },
          },
          YEU_CAU_LICH_BSK: {
            where: { YCL_TRANG_THAI: 'pending' },
            select: { YCL_ID: true },
          },
        },
      });

      const total = rows.length;
      const alreadyArchived = rows.filter((row) => row.LBSK_IS_ARCHIVED).length;
      const withBookings = rows.filter((row) => row.DANG_KY.length > 0).length;
      const withPendingRequests = rows.filter(
        (row) => row.YEU_CAU_LICH_BSK.length > 0,
      ).length;
      const eligible = rows.filter(
        (row) =>
          !row.LBSK_IS_ARCHIVED &&
          row.DANG_KY.length === 0 &&
          row.YEU_CAU_LICH_BSK.length === 0,
      );

      if (!payload.confirm) {
        return {
          preview: true,
          dateFrom: this.toDateOnlyIso(dateFrom),
          dateTo: this.toDateOnlyIso(dateTo),
          specialtyId: specialtyId ?? null,
          source: sourceFilter ?? 'all',
          total,
          eligible: eligible.length,
          alreadyArchived,
          skippedWithBookings: withBookings,
          skippedWithPendingRequests: withPendingRequests,
        };
      }

      if (eligible.length === 0) {
        return {
          preview: false,
          dateFrom: this.toDateOnlyIso(dateFrom),
          dateTo: this.toDateOnlyIso(dateTo),
          specialtyId: specialtyId ?? null,
          source: sourceFilter ?? 'all',
          total,
          eligible: 0,
          alreadyArchived,
          skippedWithBookings: withBookings,
          skippedWithPendingRequests: withPendingRequests,
          archivedCount: 0,
        };
      }

      const now = new Date();
      const eligibleKeys = eligible.map((row) => ({
        BS_MA: row.BS_MA,
        N_NGAY: row.N_NGAY,
        B_TEN: row.B_TEN,
      }));
      const updateResult = await this.prisma.lICH_BSK.updateMany({
        where: {
          LBSK_IS_ARCHIVED: false,
          OR: eligibleKeys,
        },
        data: {
          LBSK_IS_ARCHIVED: true,
          LBSK_ARCHIVED_AT: now,
          LBSK_ARCHIVED_BY: actor,
          LBSK_ARCHIVE_REASON: payload.reason?.trim() || null,
          LBSK_CAP_NHAT_LUC: now,
        },
      });

      await this.prisma.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'LICH_BSK',
          AL_ACTION: 'ARCHIVE_BATCH',
          AL_PK: {
            dateFrom: this.toDateOnlyIso(dateFrom),
            dateTo: this.toDateOnlyIso(dateTo),
            specialtyId: specialtyId ?? null,
            source: sourceFilter ?? 'all',
          },
          AL_NEW: {
            archivedCount: updateResult.count,
            skippedWithBookings: withBookings,
            skippedWithPendingRequests: withPendingRequests,
          },
          AL_CHANGED_BY: actor,
          AL_CHANGED_AT: now,
        },
      });

      return {
        preview: false,
        dateFrom: this.toDateOnlyIso(dateFrom),
        dateTo: this.toDateOnlyIso(dateTo),
        specialtyId: specialtyId ?? null,
        source: sourceFilter ?? 'all',
        total,
        eligible: eligible.length,
        alreadyArchived,
        skippedWithBookings: withBookings,
        skippedWithPendingRequests: withPendingRequests,
        archivedCount: updateResult.count,
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async restoreArchivedSchedules(
    payload: {
      dateFrom: string;
      dateTo: string;
      specialtyId: number;
      confirm?: boolean;
    },
    actor = 'ADMIN',
  ) {
    try {
      const dateFrom = this.parseDateOnlyOrThrow(payload.dateFrom);
      const dateTo = this.parseDateOnlyOrThrow(payload.dateTo);
      if (dateFrom > dateTo) {
        throw new BadRequestException('Từ ngày phải nhỏ hơn hoặc bằng đến ngày.');
      }

      const parsedSpecialtyId = Number.parseInt(String(payload.specialtyId ?? ''), 10);
      if (Number.isNaN(parsedSpecialtyId)) {
        throw new BadRequestException('Vui lòng chọn chuyên khoa cần tái sử dụng lịch.');
      }

      const specialty = await this.prisma.cHUYEN_KHOA.findUnique({
        where: { CK_MA: parsedSpecialtyId },
        select: { CK_MA: true },
      });
      if (!specialty) {
        throw new NotFoundException('Không tìm thấy chuyên khoa cần tái sử dụng lịch.');
      }

      const archivedRows = await this.prisma.lICH_BSK.findMany({
        where: {
          LBSK_IS_ARCHIVED: true,
          N_NGAY: { gte: dateFrom, lte: dateTo },
          BAC_SI: { CK_MA: parsedSpecialtyId },
        },
        select: {
          BS_MA: true,
          P_MA: true,
          N_NGAY: true,
          B_TEN: true,
          DANG_KY: {
            where: { DK_TRANG_THAI: { notIn: Array.from(BOOKING_CANCELLED_STATUSES) } },
            select: { DK_MA: true },
          },
          YEU_CAU_LICH_BSK: {
            where: { YCL_TRANG_THAI: 'pending' },
            select: { YCL_ID: true },
          },
        },
      });

      const activeRows = await this.prisma.lICH_BSK.findMany({
        where: {
          LBSK_IS_ARCHIVED: false,
          N_NGAY: { gte: dateFrom, lte: dateTo },
          BAC_SI: { CK_MA: parsedSpecialtyId },
        },
        select: {
          BS_MA: true,
          P_MA: true,
          N_NGAY: true,
          B_TEN: true,
        },
      });

      const roomKey = (roomId: number, date: Date, session: string) =>
        `${roomId}::${this.toDateOnlyIso(date)}::${session}`;
      const doctorKey = (doctorId: number, date: Date, session: string) =>
        `${doctorId}::${this.toDateOnlyIso(date)}::${session}`;

      const activeRoomKeys = new Set(activeRows.map((row) => roomKey(row.P_MA, row.N_NGAY, row.B_TEN)));
      const activeDoctorKeys = new Set(activeRows.map((row) => doctorKey(row.BS_MA, row.N_NGAY, row.B_TEN)));
      const plannedRoomKeys = new Set<string>();
      const plannedDoctorKeys = new Set<string>();

      let skippedWithBookings = 0;
      let skippedWithPendingRequests = 0;
      let skippedWithConflicts = 0;
      const eligible = [] as Array<{ BS_MA: number; N_NGAY: Date; B_TEN: string }>;

      for (const row of archivedRows) {
        if (row.DANG_KY.length > 0) {
          skippedWithBookings += 1;
          continue;
        }
        if (row.YEU_CAU_LICH_BSK.length > 0) {
          skippedWithPendingRequests += 1;
          continue;
        }

        const roomSlotKey = roomKey(row.P_MA, row.N_NGAY, row.B_TEN);
        const doctorSlotKey = doctorKey(row.BS_MA, row.N_NGAY, row.B_TEN);
        if (
          activeRoomKeys.has(roomSlotKey) ||
          activeDoctorKeys.has(doctorSlotKey) ||
          plannedRoomKeys.has(roomSlotKey) ||
          plannedDoctorKeys.has(doctorSlotKey)
        ) {
          skippedWithConflicts += 1;
          continue;
        }

        plannedRoomKeys.add(roomSlotKey);
        plannedDoctorKeys.add(doctorSlotKey);
        eligible.push({
          BS_MA: row.BS_MA,
          N_NGAY: row.N_NGAY,
          B_TEN: row.B_TEN,
        });
      }

      const totalArchived = archivedRows.length;
      const responseBase = {
        dateFrom: this.toDateOnlyIso(dateFrom),
        dateTo: this.toDateOnlyIso(dateTo),
        specialtyId: parsedSpecialtyId,
        totalArchived,
        eligible: eligible.length,
        skippedWithBookings,
        skippedWithPendingRequests,
        skippedWithConflicts,
      };

      if (!payload.confirm) {
        return {
          preview: true,
          ...responseBase,
        };
      }

      if (eligible.length === 0) {
        return {
          preview: false,
          ...responseBase,
          restoredCount: 0,
        };
      }

      const now = new Date();
      const eligibleKeys = eligible.map((row) => ({
        BS_MA: row.BS_MA,
        N_NGAY: row.N_NGAY,
        B_TEN: row.B_TEN,
      }));
      const updateResult = await this.prisma.lICH_BSK.updateMany({
        where: {
          LBSK_IS_ARCHIVED: true,
          OR: eligibleKeys,
        },
        data: {
          LBSK_IS_ARCHIVED: false,
          LBSK_ARCHIVED_AT: null,
          LBSK_ARCHIVED_BY: null,
          LBSK_ARCHIVE_REASON: null,
          LBSK_CAP_NHAT_LUC: now,
        },
      });

      await this.prisma.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'LICH_BSK',
          AL_ACTION: 'RESTORE_ARCHIVED_BATCH',
          AL_PK: {
            dateFrom: this.toDateOnlyIso(dateFrom),
            dateTo: this.toDateOnlyIso(dateTo),
            specialtyId: parsedSpecialtyId,
          },
          AL_NEW: {
            restoredCount: updateResult.count,
            skippedWithBookings,
            skippedWithPendingRequests,
            skippedWithConflicts,
          },
          AL_CHANGED_BY: actor,
          AL_CHANGED_AT: now,
        },
      });

      return {
        preview: false,
        ...responseBase,
        restoredCount: updateResult.count,
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async copyWeekToFutureMonths(
    payload: {
      sourceWeekStart: string;
      specialtyId: number;
      copyRangeOption: ScheduleCopyRangeOption;
      conflictMode: ScheduleCopyConflictMode;
      confirm?: boolean;
    },
    actor = 'ADMIN',
  ) {
    try {
      const sourceWeekStartDate = this.parseDateOnlyOrThrow(payload.sourceWeekStart);
      const sourceWeekStart = this.getWeekMondayFromDate(sourceWeekStartDate);
      const sourceWeekStartIso = this.toDateOnlyIso(sourceWeekStart);
      const { mondayStart, saturdayEnd, weekEndIso } =
        this.resolveWeekRange(sourceWeekStartIso);

      const specialty = await this.prisma.cHUYEN_KHOA.findUnique({
        where: { CK_MA: payload.specialtyId },
        select: { CK_MA: true },
      });
      if (!specialty) {
        throw new NotFoundException('Không tìm thấy chuyên khoa cần sao chép.');
      }

      const copyRange =
        payload.copyRangeOption === 'TWO_MONTHS'
          ? 2
          : payload.copyRangeOption === 'THREE_MONTHS'
            ? 3
            : 1;
      const sourceTag: ScheduleSource =
        payload.copyRangeOption === 'TWO_MONTHS'
          ? 'copied_2_months'
          : payload.copyRangeOption === 'THREE_MONTHS'
            ? 'copied_3_months'
            : 'copied_1_month';

      const startTarget = new Date(mondayStart);
      startTarget.setUTCDate(startTarget.getUTCDate() + 7);
      const horizonEnd = this.addMonthsUtc(mondayStart, copyRange);

      const targetWeekStarts: Date[] = [];
      for (
        let cursor = new Date(startTarget);
        cursor <= horizonEnd;
        cursor.setUTCDate(cursor.getUTCDate() + 7)
      ) {
        targetWeekStarts.push(new Date(cursor));
      }

      if (targetWeekStarts.length === 0) {
        return {
          preview: true,
          sourceWeekStart: sourceWeekStartIso,
          sourceWeekEnd: weekEndIso,
          targetStart: null,
          targetEnd: null,
          totalSourceShifts: 0,
          totalPlanned: 0,
          targetWeeks: 0,
          willCreate: 0,
          willUpdate: 0,
          skippedExisting: 0,
          conflicts: 0,
          lockedWeeks: 0,
          skippedLocked: 0,
        };
      }

      const targetStart = targetWeekStarts[0];
      const targetEnd = new Date(targetWeekStarts[targetWeekStarts.length - 1]);
      targetEnd.setUTCDate(targetEnd.getUTCDate() + 5);

      const sourceRows = await this.prisma.lICH_BSK.findMany({
        where: {
          LBSK_IS_ARCHIVED: false,
          N_NGAY: { gte: mondayStart, lte: saturdayEnd },
          BAC_SI: { CK_MA: payload.specialtyId },
        },
        select: {
          BS_MA: true,
          P_MA: true,
          N_NGAY: true,
          B_TEN: true,
          LBSK_GHI_CHU: true,
          LBSK_TRANG_THAI: true,
        },
        orderBy: [{ N_NGAY: 'asc' }, { B_TEN: 'asc' }, { BS_MA: 'asc' }],
      });

      const activeSource = sourceRows.filter((row) => {
        const status = this.normalizeScheduleInstanceStatus(row.LBSK_TRANG_THAI);
        return !this.isScheduleStatusInactive(status);
      });

      const weekBatches = await this.prisma.dOT_LICH_TUAN.findMany({
        where: { DLT_TUAN_BAT_DAU: { in: targetWeekStarts } },
        select: { DLT_TUAN_BAT_DAU: true, DLT_TRANG_THAI: true },
      });
      const lockedWeeks = new Set(
        weekBatches
          .filter((batch) => {
            const status = this.normalizeScheduleWeekStatus(batch.DLT_TRANG_THAI);
            return status === WEEK_STATUS.finalized || status === WEEK_STATUS.slot_opened;
          })
          .map((batch) => this.toDateOnlyIso(batch.DLT_TUAN_BAT_DAU)),
      );

      const targetRows = await this.prisma.lICH_BSK.findMany({
        where: {
          N_NGAY: { gte: targetStart, lte: targetEnd },
          BAC_SI: { CK_MA: payload.specialtyId },
        },
        select: {
          BS_MA: true,
          P_MA: true,
          N_NGAY: true,
          B_TEN: true,
          LBSK_NGUON: true,
          LBSK_TRANG_THAI: true,
          LBSK_IS_ARCHIVED: true,
          DANG_KY: {
            where: { DK_TRANG_THAI: { notIn: Array.from(BOOKING_CANCELLED_STATUSES) } },
            select: { DK_MA: true },
          },
          YEU_CAU_LICH_BSK: {
            where: { YCL_TRANG_THAI: 'pending' },
            select: { YCL_ID: true },
          },
        },
      });

      const roomMap = new Map<string, (typeof targetRows)[number]>();
      const doctorMap = new Map<string, (typeof targetRows)[number]>();
      for (const row of targetRows) {
        const dateIso = this.toDateOnlyIso(row.N_NGAY);
        roomMap.set(`${row.P_MA}::${dateIso}::${row.B_TEN}`, row);
        doctorMap.set(`${row.BS_MA}::${dateIso}::${row.B_TEN}`, row);
      }

      const plannedRoom = new Set<string>();
      const plannedDoctor = new Set<string>();
      const createData: Prisma.LICH_BSKCreateManyInput[] = [];
      const updateTasks: Array<() => Promise<unknown>> = [];

      let willCreate = 0;
      let willUpdate = 0;
      let skippedExisting = 0;
      let conflicts = 0;
      let skippedLocked = 0;

      const isOverwritableGenerated = (row: (typeof targetRows)[number]) => {
        if (row.DANG_KY.length > 0) return false;
        if (row.YEU_CAU_LICH_BSK.length > 0) return false;
        const source = this.normalizeScheduleSource(row.LBSK_NGUON);
        if (
          ![
            'template',
            'auto_rolling',
            'copied_1_month',
            'copied_2_months',
            'copied_3_months',
          ].includes(source)
        ) {
          return false;
        }
        const status = this.normalizeScheduleInstanceStatus(row.LBSK_TRANG_THAI);
        if (
          status === SHIFT_STATUS.finalized ||
          status === SHIFT_STATUS.vacant_by_leave ||
          status === SHIFT_STATUS.cancelled_by_doctor_leave
        ) {
          return false;
        }
        return true;
      };

      const plannedOccurrences: Array<{
        BS_MA: number;
        P_MA: number;
        N_NGAY: Date;
        B_TEN: string;
        note: string | null;
        weekStart: Date;
      }> = [];

      for (const row of activeSource) {
        const weekday = this.getWeekdayFromDate(row.N_NGAY);
        if (weekday === 0) continue;
        const offset = weekday - 1;
        for (const weekStart of targetWeekStarts) {
          const weekStartIso = this.toDateOnlyIso(weekStart);
          if (lockedWeeks.has(weekStartIso)) {
            skippedLocked += 1;
            continue;
          }
          const targetDate = new Date(weekStart);
          targetDate.setUTCDate(weekStart.getUTCDate() + offset);
          plannedOccurrences.push({
            BS_MA: row.BS_MA,
            P_MA: row.P_MA,
            N_NGAY: targetDate,
            B_TEN: row.B_TEN,
            note: row.LBSK_GHI_CHU?.trim() || null,
            weekStart,
          });
        }
      }

      for (const occurrence of plannedOccurrences) {
        const dateIso = this.toDateOnlyIso(occurrence.N_NGAY);
        const roomKey = `${occurrence.P_MA}::${dateIso}::${occurrence.B_TEN}`;
        const doctorKey = `${occurrence.BS_MA}::${dateIso}::${occurrence.B_TEN}`;

        if (plannedRoom.has(roomKey) || plannedDoctor.has(doctorKey)) {
          conflicts += 1;
          continue;
        }

        const roomRow = roomMap.get(roomKey) || null;
        const doctorRow = doctorMap.get(doctorKey) || null;
        const roomArchived = roomRow ? Boolean(roomRow.LBSK_IS_ARCHIVED) : false;
        const doctorArchived = doctorRow ? Boolean(doctorRow.LBSK_IS_ARCHIVED) : false;
        const sameRow =
          roomRow &&
          doctorRow &&
          roomRow.BS_MA === doctorRow.BS_MA &&
          this.toDateOnlyIso(roomRow.N_NGAY) === this.toDateOnlyIso(doctorRow.N_NGAY) &&
          roomRow.B_TEN === doctorRow.B_TEN;

        if (roomRow && doctorRow && !sameRow) {
          conflicts += 1;
          continue;
        }

        if (roomRow && !roomArchived) {
          if (payload.conflictMode === 'ARCHIVE_OLD_GENERATED' && isOverwritableGenerated(roomRow)) {
            updateTasks.push(() =>
              this.prisma.lICH_BSK.update({
                where: {
                  BS_MA_N_NGAY_B_TEN: {
                    BS_MA: roomRow.BS_MA,
                    N_NGAY: roomRow.N_NGAY,
                    B_TEN: roomRow.B_TEN,
                  },
                },
                data: {
                  BS_MA: occurrence.BS_MA,
                  P_MA: occurrence.P_MA,
                  N_NGAY: occurrence.N_NGAY,
                  B_TEN: occurrence.B_TEN,
                  DLT_TUAN_BAT_DAU: occurrence.weekStart,
                  LBM_ID: null,
                  LBSK_NGUON: sourceTag,
                  LBSK_TRANG_THAI: 'generated',
                  LBSK_TRANGTHAI_DUYET: 'pending',
                  LBSK_GHI_CHU: occurrence.note,
                  LBSK_XAC_NHAN_LUC: null,
                  LBSK_IS_ARCHIVED: false,
                  LBSK_ARCHIVED_AT: null,
                  LBSK_ARCHIVED_BY: null,
                  LBSK_ARCHIVE_REASON: null,
                  LBSK_CAP_NHAT_LUC: new Date(),
                },
              }),
            );
            willUpdate += 1;
            plannedRoom.add(roomKey);
            plannedDoctor.add(doctorKey);
            continue;
          }
          skippedExisting += 1;
          continue;
        }

        if (doctorRow && !doctorArchived) {
          conflicts += 1;
          continue;
        }

        if (roomRow && roomArchived) {
          updateTasks.push(() =>
            this.prisma.lICH_BSK.update({
              where: {
                BS_MA_N_NGAY_B_TEN: {
                  BS_MA: roomRow.BS_MA,
                  N_NGAY: roomRow.N_NGAY,
                  B_TEN: roomRow.B_TEN,
                },
              },
              data: {
                BS_MA: occurrence.BS_MA,
                P_MA: occurrence.P_MA,
                N_NGAY: occurrence.N_NGAY,
                B_TEN: occurrence.B_TEN,
                DLT_TUAN_BAT_DAU: occurrence.weekStart,
                LBM_ID: null,
                LBSK_NGUON: sourceTag,
                LBSK_TRANG_THAI: 'generated',
                LBSK_TRANGTHAI_DUYET: 'pending',
                LBSK_GHI_CHU: occurrence.note,
                LBSK_XAC_NHAN_LUC: null,
                LBSK_IS_ARCHIVED: false,
                LBSK_ARCHIVED_AT: null,
                LBSK_ARCHIVED_BY: null,
                LBSK_ARCHIVE_REASON: null,
                LBSK_CAP_NHAT_LUC: new Date(),
              },
            }),
          );
          willUpdate += 1;
          plannedRoom.add(roomKey);
          plannedDoctor.add(doctorKey);
          continue;
        }

        if (doctorRow && doctorArchived) {
          updateTasks.push(() =>
            this.prisma.lICH_BSK.update({
              where: {
                BS_MA_N_NGAY_B_TEN: {
                  BS_MA: doctorRow.BS_MA,
                  N_NGAY: doctorRow.N_NGAY,
                  B_TEN: doctorRow.B_TEN,
                },
              },
              data: {
                BS_MA: occurrence.BS_MA,
                P_MA: occurrence.P_MA,
                N_NGAY: occurrence.N_NGAY,
                B_TEN: occurrence.B_TEN,
                DLT_TUAN_BAT_DAU: occurrence.weekStart,
                LBM_ID: null,
                LBSK_NGUON: sourceTag,
                LBSK_TRANG_THAI: 'generated',
                LBSK_TRANGTHAI_DUYET: 'pending',
                LBSK_GHI_CHU: occurrence.note,
                LBSK_XAC_NHAN_LUC: null,
                LBSK_IS_ARCHIVED: false,
                LBSK_ARCHIVED_AT: null,
                LBSK_ARCHIVED_BY: null,
                LBSK_ARCHIVE_REASON: null,
                LBSK_CAP_NHAT_LUC: new Date(),
              },
            }),
          );
          willUpdate += 1;
          plannedRoom.add(roomKey);
          plannedDoctor.add(doctorKey);
          continue;
        }

        createData.push({
          BS_MA: occurrence.BS_MA,
          P_MA: occurrence.P_MA,
          N_NGAY: occurrence.N_NGAY,
          B_TEN: occurrence.B_TEN,
          DLT_TUAN_BAT_DAU: occurrence.weekStart,
          LBM_ID: null,
          LBSK_NGUON: sourceTag,
          LBSK_TRANG_THAI: 'generated',
          LBSK_TRANGTHAI_DUYET: 'pending',
          LBSK_GHI_CHU: occurrence.note,
          LBSK_TAO_LUC: new Date(),
          LBSK_CAP_NHAT_LUC: new Date(),
        });
        plannedRoom.add(roomKey);
        plannedDoctor.add(doctorKey);
        willCreate += 1;
      }

      const totalPlanned = plannedOccurrences.length;
      const lockedWeeksCount = lockedWeeks.size;

      if (!payload.confirm) {
        return {
          preview: true,
          sourceWeekStart: sourceWeekStartIso,
          sourceWeekEnd: weekEndIso,
          targetStart: this.toDateOnlyIso(targetStart),
          targetEnd: this.toDateOnlyIso(targetEnd),
          totalSourceShifts: activeSource.length,
          targetWeeks: targetWeekStarts.length,
          totalPlanned,
          willCreate,
          willUpdate,
          skippedExisting,
          conflicts,
          lockedWeeks: lockedWeeksCount,
          skippedLocked,
        };
      }

      for (const weekStart of targetWeekStarts) {
        await this.ensureScheduleDatesForWeek(weekStart);
        await this.upsertScheduleWeek(this.toDateOnlyIso(weekStart), actor);
      }

      if (createData.length > 0) {
        await this.prisma.lICH_BSK.createMany({
          data: createData,
          skipDuplicates: true,
        });
      }

      for (const task of updateTasks) {
        await task();
      }

      return {
        preview: false,
        sourceWeekStart: sourceWeekStartIso,
        sourceWeekEnd: weekEndIso,
        targetStart: this.toDateOnlyIso(targetStart),
        targetEnd: this.toDateOnlyIso(targetEnd),
        totalSourceShifts: activeSource.length,
        targetWeeks: targetWeekStarts.length,
        totalPlanned,
        willCreate,
        willUpdate,
        skippedExisting,
        conflicts,
        lockedWeeks: lockedWeeksCount,
        skippedLocked,
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getScheduleTemplates(params?: {
    page?: string;
    limit?: string;
    doctorId?: string;
    specialtyId?: string;
    roomId?: string;
    status?: string;
    search?: string;
  }) {
    try {
      const rawPage = Number.parseInt(params?.page || '1', 10);
      const rawLimit = Number.parseInt(params?.limit || '20', 10);
      const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
      const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 100);
      const parsedDoctorId = Number.parseInt(params?.doctorId || '', 10);
      const parsedRoomId = Number.parseInt(params?.roomId || '', 10);
      const parsedSpecialtyId = Number.parseInt(params?.specialtyId || '', 10);
      const doctorId = Number.isNaN(parsedDoctorId) ? undefined : parsedDoctorId;
      const roomId = Number.isNaN(parsedRoomId) ? undefined : parsedRoomId;
      const specialtyId = Number.isNaN(parsedSpecialtyId) ? undefined : parsedSpecialtyId;
      const status = (params?.status || 'all').trim().toLowerCase();
      const search = params?.search?.trim().toLowerCase() || '';

      const where: Prisma.LICH_BSK_MAUWhereInput = {
        ...(doctorId ? { BS_MA: doctorId } : {}),
        ...(roomId ? { P_MA: roomId } : {}),
        ...(specialtyId ? { CK_MA: specialtyId } : {}),
        ...(status === 'active' || status === 'inactive'
          ? { LBM_TRANG_THAI: status }
          : {}),
      };

      const rows = await this.prisma.lICH_BSK_MAU.findMany({
        where,
        include: {
          BAC_SI: {
            select: {
              BS_MA: true,
              BS_HO_TEN: true,
              CK_MA: true,
              CHUYEN_KHOA: { select: { CK_TEN: true } },
            },
          },
          CHUYEN_KHOA: { select: { CK_MA: true, CK_TEN: true } },
          PHONG: { select: { P_MA: true, P_TEN: true, CK_MA: true } },
          BUOI: { select: { B_TEN: true, B_GIO_BAT_DAU: true, B_GIO_KET_THUC: true } },
        },
        orderBy: [
          { LBM_TRANG_THAI: 'asc' },
          { BS_MA: 'asc' },
          { LBM_THU_TRONG_TUAN: 'asc' },
          { B_TEN: 'asc' },
        ],
      });

      const mapped = rows
        .map((row) => ({
          LBM_ID: row.LBM_ID,
          BS_MA: row.BS_MA,
          CK_MA: row.CK_MA,
          P_MA: row.P_MA,
          B_TEN: row.B_TEN,
          weekday: row.LBM_THU_TRONG_TUAN,
          effectiveStartDate: this.toDateOnlyIso(row.LBM_HIEU_LUC_TU),
          effectiveEndDate: row.LBM_HIEU_LUC_DEN
            ? this.toDateOnlyIso(row.LBM_HIEU_LUC_DEN)
            : null,
          status: this.normalizeTemplateStatus(row.LBM_TRANG_THAI),
          note: row.LBM_GHI_CHU,
          createdAt: row.LBM_TAO_LUC?.toISOString() || null,
          createdBy: row.LBM_TAO_BOI || null,
          updatedAt: row.LBM_CAP_NHAT_LUC?.toISOString() || null,
          updatedBy: row.LBM_CAP_NHAT_BOI || null,
          doctor: row.BAC_SI,
          specialty: row.CHUYEN_KHOA,
          room: row.PHONG,
          session: row.BUOI,
        }))
        .filter((row) => {
          if (!search) return true;
          return (
            row.doctor.BS_HO_TEN.toLowerCase().includes(search) ||
            row.room.P_TEN.toLowerCase().includes(search) ||
            row.specialty.CK_TEN.toLowerCase().includes(search) ||
            row.LBM_ID.toString().includes(search)
          );
        });

      const total = mapped.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (page - 1) * limit;

      return {
        items: mapped.slice(offset, offset + limit),
        meta: {
          total,
          page,
          limit,
          totalPages,
        },
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async createScheduleTemplate(
    payload: {
      BS_MA: number;
      CK_MA: number;
      P_MA: number;
      B_TEN: string;
      weekday: number;
      effectiveStartDate: string;
      effectiveEndDate?: string | null;
      status?: ScheduleTemplateStatus;
      note?: string;
    },
    actor = 'ADMIN',
  ) {
    try {
      const normalized = await this.prepareScheduleTemplatePayload(payload);
      await this.assertNoTemplateConflicts(normalized);

      return await this.prisma.lICH_BSK_MAU.create({
        data: {
          BS_MA: normalized.BS_MA,
          CK_MA: normalized.CK_MA,
          P_MA: normalized.P_MA,
          B_TEN: normalized.B_TEN,
          LBM_THU_TRONG_TUAN: normalized.weekday,
          LBM_HIEU_LUC_TU: normalized.effectiveStartDate,
          LBM_HIEU_LUC_DEN: normalized.effectiveEndDate,
          LBM_TRANG_THAI: normalized.status,
          LBM_GHI_CHU: normalized.note,
          LBM_TAO_BOI: actor,
          LBM_CAP_NHAT_BOI: actor,
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async updateScheduleTemplate(
    templateId: number,
    payload: {
      BS_MA?: number;
      CK_MA?: number;
      P_MA?: number;
      B_TEN?: string;
      weekday?: number;
      effectiveStartDate?: string;
      effectiveEndDate?: string | null;
      status?: ScheduleTemplateStatus;
      note?: string | null;
    },
    actor = 'ADMIN',
  ) {
    try {
      const existing = await this.prisma.lICH_BSK_MAU.findUnique({
        where: { LBM_ID: templateId },
      });
      if (!existing) {
        throw new NotFoundException('Không tìm thấy mẫu lịch chuẩn cần cập nhật.');
      }

      const normalized = await this.prepareScheduleTemplatePayload(
        {
          BS_MA: payload.BS_MA ?? existing.BS_MA,
          CK_MA: payload.CK_MA ?? existing.CK_MA,
          P_MA: payload.P_MA ?? existing.P_MA,
          B_TEN: payload.B_TEN ?? existing.B_TEN,
          weekday: payload.weekday ?? existing.LBM_THU_TRONG_TUAN,
          effectiveStartDate:
            payload.effectiveStartDate ?? this.toDateOnlyIso(existing.LBM_HIEU_LUC_TU),
          effectiveEndDate:
            payload.effectiveEndDate === undefined
              ? existing.LBM_HIEU_LUC_DEN
                ? this.toDateOnlyIso(existing.LBM_HIEU_LUC_DEN)
                : null
              : payload.effectiveEndDate,
          status: payload.status ?? this.normalizeTemplateStatus(existing.LBM_TRANG_THAI),
          note: payload.note ?? existing.LBM_GHI_CHU,
        },
        templateId,
      );

      await this.assertNoTemplateConflicts(normalized, templateId);

      return await this.prisma.lICH_BSK_MAU.update({
        where: { LBM_ID: templateId },
        data: {
          BS_MA: normalized.BS_MA,
          CK_MA: normalized.CK_MA,
          P_MA: normalized.P_MA,
          B_TEN: normalized.B_TEN,
          LBM_THU_TRONG_TUAN: normalized.weekday,
          LBM_HIEU_LUC_TU: normalized.effectiveStartDate,
          LBM_HIEU_LUC_DEN: normalized.effectiveEndDate,
          LBM_TRANG_THAI: normalized.status,
          LBM_GHI_CHU: normalized.note,
          LBM_CAP_NHAT_LUC: new Date(),
          LBM_CAP_NHAT_BOI: actor,
        },
      });
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async generateWeeklySchedulesFromTemplates(
    weekStartRaw: string,
    actor = 'SYSTEM',
  ) {
    try {
      return await this.ensureWeeklySchedulesGenerated(weekStartRaw, actor);
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async maintainRollingScheduleWindow(
    actor = 'SYSTEM',
    options?: { horizonMonths?: number },
  ) {
    const horizonMonths = options?.horizonMonths ?? 3;
    const { windowStart, windowEnd, horizonEnd } =
      this.getRollingScheduleWindow(horizonMonths);

    const summaries: Array<{
      weekStart: string;
      created: number;
      updated: number;
      cancelled: number;
      skipped: number;
      locked: boolean;
    }> = [];

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalCancelled = 0;
    let totalSkipped = 0;
    let lockedWeeks = 0;

    const cursor = new Date(windowStart);
    while (cursor <= windowEnd) {
      const weekStartIso = this.toDateOnlyIso(cursor);
      await this.ensureScheduleDatesForWeek(cursor);
      try {
        const result = await this.ensureWeeklySchedulesGenerated(weekStartIso, actor, {
          source: 'auto_rolling',
        });
        summaries.push(result);
        totalCreated += result.created;
        totalUpdated += result.updated;
        totalCancelled += result.cancelled;
        totalSkipped += result.skipped;
        if (result.locked) lockedWeeks += 1;
      } catch (e) {
        if (this.isMissingColumnError(e)) {
          this.logger.warn(
            `Missing schedule columns; stop rolling generation at week ${weekStartIso}.`,
          );
          break;
        }
        mapPrismaError(e);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    return {
      windowStart: this.toDateOnlyIso(windowStart),
      horizonEnd: this.toDateOnlyIso(horizonEnd),
      totalWeeks: summaries.length,
      totalCreated,
      totalUpdated,
      totalCancelled,
      totalSkipped,
      lockedWeeks,
    };
  }

  async autoConfirmExpiredSchedules(
    actor = 'SYSTEM',
    options?: { days?: number },
  ) {
    const days = options?.days ?? 7;
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const confirmedAt = new Date();

    const baseWhere: Prisma.LICH_BSKWhereInput = {
      LBSK_IS_ARCHIVED: false,
      LBSK_TRANG_THAI: 'generated',
      YEU_CAU_LICH_BSK: { none: { YCL_TRANG_THAI: 'pending' } },
      OR: [
        { LBSK_TAO_LUC: { lte: cutoff } },
        { LBSK_TAO_LUC: null, LBSK_CAP_NHAT_LUC: { lte: cutoff } },
      ],
    };

    let result: { count: number };
    try {
      result = await this.prisma.lICH_BSK.updateMany({
        where: baseWhere,
        data: {
          LBSK_TRANG_THAI: 'confirmed',
          LBSK_TRANGTHAI_DUYET: 'approved',
          LBSK_XAC_NHAN_LUC: confirmedAt,
          LBSK_CAP_NHAT_LUC: confirmedAt,
          LBSK_DUYET_BOI: actor,
          LBSK_DUYET_LUC: confirmedAt,
        },
      });
    } catch (e) {
      if (!this.isMissingScheduleApprovalColumnsError(e)) {
        throw e;
      }
      this.logger.warn(
        'Missing schedule approval columns; using legacy auto-confirm fallback.',
      );
      result = await this.prisma.lICH_BSK.updateMany({
        where: baseWhere,
        data: {
          LBSK_TRANG_THAI: 'confirmed',
          LBSK_XAC_NHAN_LUC: confirmedAt,
          LBSK_CAP_NHAT_LUC: confirmedAt,
        },
      });
    }

    return {
      confirmedCount: result.count,
      cutoff: cutoff.toISOString(),
      days,
    };
  }

  async confirmGeneratedSchedulesByAdmin(
    weekStartRaw: string,
    actor = 'ADMIN',
    params?: { doctorId?: number },
  ) {
    const { mondayStart, saturdayEnd, weekStartIso } = this.resolveWeekRange(weekStartRaw);
    try {
      await this.ensureWeeklySchedulesGenerated(weekStartIso, 'SYSTEM');
    } catch (e) {
      if (!this.isMissingColumnError(e)) {
        throw e;
      }
      this.logger.warn('Missing schedule columns; skip auto-generation for admin confirm.');
    }
    await this.ensureWeekNotFinalized(weekStartIso);

    const baseWhere = {
      LBSK_IS_ARCHIVED: false,
      N_NGAY: { gte: mondayStart, lte: saturdayEnd },
      ...(params?.doctorId ? { BS_MA: params.doctorId } : {}),
    };

    const confirmedAt = new Date();
    let generatedResult: { count: number };
    let adjustedResult: { count: number };
    try {
      [generatedResult, adjustedResult] = await this.prisma.$transaction([
        this.prisma.lICH_BSK.updateMany({
          where: {
            ...baseWhere,
            LBSK_TRANG_THAI: 'generated',
          },
          data: {
            LBSK_TRANG_THAI: 'confirmed',
            LBSK_TRANGTHAI_DUYET: 'approved',
            LBSK_XAC_NHAN_LUC: confirmedAt,
            LBSK_CAP_NHAT_LUC: confirmedAt,
            LBSK_DUYET_BOI: actor,
            LBSK_DUYET_LUC: confirmedAt,
          },
        }),
        this.prisma.lICH_BSK.updateMany({
          where: {
            ...baseWhere,
            LBSK_TRANG_THAI: 'adjusted',
          },
          data: {
            LBSK_TRANGTHAI_DUYET: 'approved',
            LBSK_XAC_NHAN_LUC: confirmedAt,
            LBSK_CAP_NHAT_LUC: confirmedAt,
          },
        }),
      ]);
    } catch (e) {
      if (!this.isMissingScheduleApprovalColumnsError(e)) {
        throw e;
      }
      this.logger.warn(
        'Missing schedule approval columns; using legacy admin confirm fallback.',
      );
      [generatedResult, adjustedResult] = await this.prisma.$transaction([
        this.prisma.lICH_BSK.updateMany({
          where: {
            ...baseWhere,
            LBSK_TRANG_THAI: 'generated',
          },
          data: {
            LBSK_TRANG_THAI: 'confirmed',
            LBSK_XAC_NHAN_LUC: confirmedAt,
            LBSK_CAP_NHAT_LUC: confirmedAt,
          },
        }),
        this.prisma.lICH_BSK.updateMany({
          where: {
            ...baseWhere,
            LBSK_TRANG_THAI: 'adjusted',
          },
          data: {
            LBSK_XAC_NHAN_LUC: confirmedAt,
            LBSK_CAP_NHAT_LUC: confirmedAt,
          },
        }),
      ]);
    }

    return {
      message: 'Xác nhận lịch trực theo tuần thành công',
      weekStart: weekStartIso,
      confirmedCount: generatedResult.count,
      acknowledgedAdjustedCount: adjustedResult.count,
    };
  }

  async runScheduleAutomation(actor = 'SYSTEM') {
    const rolling = await this.maintainRollingScheduleWindow(actor);
    const autoConfirm = await this.autoConfirmExpiredSchedules(actor);
    return { rolling, autoConfirm };
  }

  async getWeeklySchedules(params?: {
    weekStart?: string;
    page?: string;
    limit?: string;
    specialtyId?: string;
    doctorId?: string;
    roomId?: string;
    status?: string;
    session?: string;
    weekday?: string;
    date?: string;
    search?: string;
    source?: string;
  }) {
    try {
      const rawPage = Number.parseInt(params?.page || '1', 10);
      const rawLimit = Number.parseInt(params?.limit || '20', 10);
      const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
      const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 200);
      const parsedDoctorId = Number.parseInt(params?.doctorId || '', 10);
      const parsedRoomId = Number.parseInt(params?.roomId || '', 10);
      const parsedSpecialtyId = Number.parseInt(params?.specialtyId || '', 10);
      const parsedWeekday = Number.parseInt(params?.weekday || '', 10);
      const doctorId = Number.isNaN(parsedDoctorId) ? undefined : parsedDoctorId;
      const roomId = Number.isNaN(parsedRoomId) ? undefined : parsedRoomId;
      const specialtyId = Number.isNaN(parsedSpecialtyId) ? undefined : parsedSpecialtyId;
      const weekday =
        Number.isNaN(parsedWeekday) || parsedWeekday < 0 || parsedWeekday > 6
          ? undefined
          : parsedWeekday;
      const status = (params?.status || 'all').trim().toLowerCase();
      const source = (params?.source || 'all').trim().toLowerCase();
      const session = params?.session?.trim() || undefined;
      const search = params?.search?.trim().toLowerCase() || '';
      const dateFilter = params?.date?.trim() || undefined;
      const { mondayStart, saturdayEnd, weekStartIso } = this.resolveWeekRange(
        params?.weekStart,
      );

      await this.ensureWeeklySchedulesGenerated(weekStartIso, 'SYSTEM');
      const weekBatch = await this.getScheduleWeekOrThrow(weekStartIso);

      const rows = await this.prisma.lICH_BSK.findMany({
        where: {
          LBSK_IS_ARCHIVED: false,
          N_NGAY: { gte: mondayStart, lte: saturdayEnd },
          ...(doctorId ? { BS_MA: doctorId } : {}),
          ...(roomId ? { P_MA: roomId } : {}),
          ...(session ? { B_TEN: session } : {}),
          ...(specialtyId ? { BAC_SI: { CK_MA: specialtyId } } : {}),
          ...(dateFilter ? { N_NGAY: this.parseDateOnlyOrThrow(dateFilter) } : {}),
        },
        select: {
          BS_MA: true,
          P_MA: true,
          N_NGAY: true,
          B_TEN: true,
          LBM_ID: true,
          LBSK_NGUON: true,
          LBSK_TRANG_THAI: true,
          LBSK_GHI_CHU: true,
          LBSK_TAO_LUC: true,
          LBSK_CAP_NHAT_LUC: true,
          LBSK_XAC_NHAN_LUC: true,
          BAC_SI: {
            select: {
              BS_MA: true,
              BS_HO_TEN: true,
              CK_MA: true,
              CHUYEN_KHOA: { select: { CK_TEN: true } },
            },
          },
          PHONG: {
            select: {
              P_MA: true,
              P_TEN: true,
              CK_MA: true,
              CHUYEN_KHOA: { select: { CK_TEN: true } },
            },
          },
          BUOI: {
            select: {
              B_TEN: true,
              B_GIO_BAT_DAU: true,
              B_GIO_KET_THUC: true,
              KHUNG_GIO: { select: { KG_MA: true } },
            },
          },
          LICH_BSK_MAU: {
            select: {
              LBM_ID: true,
              LBM_THU_TRONG_TUAN: true,
              LBM_TRANG_THAI: true,
              LBM_HIEU_LUC_TU: true,
              LBM_HIEU_LUC_DEN: true,
            },
          },
          DANG_KY: {
            select: {
              DK_TRANG_THAI: true,
            },
          },
          YEU_CAU_LICH_BSK: {
            orderBy: [{ YCL_TAO_LUC: 'desc' }, { YCL_ID: 'desc' }],
            take: 1,
            select: {
              YCL_ID: true,
              YCL_LOAI: true,
              YCL_LY_DO: true,
              YCL_TRANG_THAI: true,
              YCL_TRANG_THAI_TRUOC: true,
              YCL_NGAY_MOI: true,
              YCL_BUOI_MOI: true,
              YCL_GHI_CHU_ADMIN: true,
              YCL_TAO_LUC: true,
              YCL_TAO_BOI: true,
              YCL_DUYET_LUC: true,
              YCL_DUYET_BOI: true,
              BS_MA: true,
              LBSK_N_NGAY: true,
              LBSK_B_TEN: true,
              PHONG_MOI: { select: { P_MA: true, P_TEN: true } },
              BAC_SI_GOI_Y: { select: { BS_MA: true, BS_HO_TEN: true } },
            },
          },
        },
        orderBy: [{ N_NGAY: 'asc' }, { B_TEN: 'asc' }, { BS_MA: 'asc' }],
      });

      const mapped = rows
        .map((row) => this.mapWeeklyScheduleRow(row, weekBatch))
        .filter((row) => (status === 'all' ? true : row.status === status))
        .filter((row) => (source === 'all' ? true : row.source === source))
        .filter((row) =>
          weekday === undefined ? true : this.getWeekdayFromDate(row.N_NGAY) === weekday,
        )
        .filter((row) => {
          if (!search) return true;
          return (
            row.doctor.BS_HO_TEN.toLowerCase().includes(search) ||
            row.room.P_TEN.toLowerCase().includes(search) ||
            row.doctor.BS_MA.toString().includes(search) ||
            row.room.P_MA.toString().includes(search)
          );
        });

      const total = mapped.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (page - 1) * limit;

      return {
        items: mapped.slice(offset, offset + limit),
        meta: {
          total,
          page,
          limit,
          totalPages,
          weekStart: weekStartIso,
          workflowStatus: this.normalizeScheduleWeekStatus(weekBatch.DLT_TRANG_THAI),
          finalizedAt: weekBatch.DLT_CHOT_LUC?.toISOString() || null,
          slotOpenedAt: weekBatch.DLT_MO_SLOT_LUC?.toISOString() || null,
        },
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getScheduleExceptionRequests(params?: {
    weekStart?: string;
    page?: string;
    limit?: string;
    doctorId?: string;
    status?: string;
    search?: string;
  }) {
    try {
      const rawPage = Number.parseInt(params?.page || '1', 10);
      const rawLimit = Number.parseInt(params?.limit || '20', 10);
      const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
      const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 100);
      const parsedDoctorId = Number.parseInt(params?.doctorId || '', 10);
      const doctorId = Number.isNaN(parsedDoctorId) ? undefined : parsedDoctorId;
      const status = (params?.status || 'all').trim().toLowerCase();
      const search = params?.search?.trim().toLowerCase() || '';
      const { mondayStart, saturdayEnd, weekStartIso } = this.resolveWeekRange(
        params?.weekStart,
      );

      const rows = await this.prisma.yEU_CAU_LICH_BSK.findMany({
        where: {
          LBSK_N_NGAY: { gte: mondayStart, lte: saturdayEnd },
          ...(doctorId ? { BS_MA: doctorId } : {}),
          ...(status === 'pending' || status === 'approved' || status === 'rejected'
            ? { YCL_TRANG_THAI: status }
            : {}),
        },
        include: {
          BAC_SI: {
            select: {
              BS_MA: true,
              BS_HO_TEN: true,
              CK_MA: true,
              CHUYEN_KHOA: { select: { CK_TEN: true } },
            },
          },
          LICH_BSK: {
            select: {
              BS_MA: true,
              N_NGAY: true,
              B_TEN: true,
              LBSK_TRANG_THAI: true,
              PHONG: { select: { P_MA: true, P_TEN: true, CK_MA: true } },
              BAC_SI: {
                select: {
                  BS_MA: true,
                  BS_HO_TEN: true,
                },
              },
            },
          },
          PHONG_MOI: { select: { P_MA: true, P_TEN: true, CK_MA: true } },
          BAC_SI_GOI_Y: { select: { BS_MA: true, BS_HO_TEN: true } },
        },
        orderBy: [{ YCL_TAO_LUC: 'desc' }, { YCL_ID: 'desc' }],
      });

      const bookingCounts = new Map<string, number>();
      const bookingKeys = Array.from(
        new Map(
          rows.map((row) => {
            const key = `${row.BS_MA}::${this.toDateOnlyIso(row.LBSK_N_NGAY)}::${row.LBSK_B_TEN}`;
            return [key, { BS_MA: row.BS_MA, N_NGAY: row.LBSK_N_NGAY, B_TEN: row.LBSK_B_TEN }];
          }),
        ).values(),
      );

      if (bookingKeys.length > 0) {
        const groups = await this.prisma.dANG_KY.groupBy({
          by: ['BS_MA', 'N_NGAY', 'B_TEN'],
          where: {
            DK_TRANG_THAI: { notIn: Array.from(BOOKING_CANCELLED_STATUSES) },
            OR: bookingKeys.map((item) => ({
              BS_MA: item.BS_MA,
              N_NGAY: item.N_NGAY,
              B_TEN: item.B_TEN,
            })),
          },
          _count: { _all: true },
        });

        groups.forEach((group) => {
          const key = `${group.BS_MA}::${this.toDateOnlyIso(group.N_NGAY)}::${group.B_TEN}`;
          bookingCounts.set(key, group._count._all ?? 0);
        });
      }

      const mapped = rows
        .map((row) => {
          const key = `${row.BS_MA}::${this.toDateOnlyIso(row.LBSK_N_NGAY)}::${row.LBSK_B_TEN}`;
          const affectedBookingCount = bookingCounts.get(key) ?? 0;
          return this.mapScheduleExceptionRequestRow(row, affectedBookingCount);
        })
        .filter((row) => {
          if (!search) return true;
          return (
            row.doctor.BS_HO_TEN.toLowerCase().includes(search) ||
            row.targetShift.room?.P_TEN?.toLowerCase().includes(search) ||
            row.reason.toLowerCase().includes(search) ||
            row.type.toLowerCase().includes(search)
          );
        });

      const total = mapped.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (page - 1) * limit;

      return {
        items: mapped.slice(offset, offset + limit),
        meta: {
          total,
          page,
          limit,
          totalPages,
          weekStart: weekStartIso,
        },
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async reviewScheduleExceptionRequest(
    requestId: number,
    payload: { status: ScheduleExceptionStatus; adminNote?: string },
    actor = 'ADMIN',
  ) {
    try {
      const request = await this.prisma.yEU_CAU_LICH_BSK.findUnique({
        where: { YCL_ID: requestId },
        select: {
          YCL_ID: true,
          BS_MA: true,
          LBSK_N_NGAY: true,
          LBSK_B_TEN: true,
          YCL_LOAI: true,
          YCL_LY_DO: true,
          YCL_TRANG_THAI: true,
          YCL_TRANG_THAI_TRUOC: true,
          YCL_NGAY_MOI: true,
          YCL_BUOI_MOI: true,
          YCL_P_MA_MOI: true,
          YCL_GOI_Y_BS_MA: true,
          LICH_BSK: {
            select: {
              BS_MA: true,
              N_NGAY: true,
              B_TEN: true,
              P_MA: true,
              LBSK_TRANG_THAI: true,
            },
          },
        },
      });
      if (!request) {
        throw new NotFoundException('Không tìm thấy yêu cầu điều chỉnh lịch.');
      }
      if (this.normalizeScheduleExceptionStatus(request.YCL_TRANG_THAI) !== 'pending') {
        throw new ConflictException('Yêu cầu này đã được xử lý trước đó.');
      }

      const weekStartIso = this.toDateOnlyIso(
        this.getWeekMondayFromDate(request.LBSK_N_NGAY),
      );
      const requestType = this.normalizeScheduleExceptionType(request.YCL_LOAI);
      if (requestType !== 'leave') {
        await this.ensureWeekNotFinalized(weekStartIso);
      }

      try {
        return await this.prisma.$transaction(async (tx) => {
          const reviewedAt = new Date();
          const nextStatus = this.normalizeScheduleExceptionStatus(payload.status);
          if (nextStatus === 'approved') {
            await this.applyApprovedScheduleExceptionRequest(tx, request, actor, reviewedAt);
          } else {
            await this.restoreScheduleStatusAfterRejectedException(tx, request);
          }

          return await tx.yEU_CAU_LICH_BSK.update({
            where: { YCL_ID: requestId },
            data: {
              YCL_TRANG_THAI: nextStatus,
              YCL_GHI_CHU_ADMIN: payload.adminNote?.trim() || null,
              YCL_DUYET_BOI: actor,
              YCL_DUYET_LUC: reviewedAt,
            },
          });
        });
      } catch (e) {
        if (!this.isMissingColumnError(e)) {
          throw e;
        }
        this.logger.warn(
          'Missing schedule columns; using legacy exception review fallback.',
        );

        const reviewedAt = new Date();
        const nextStatus = this.normalizeScheduleExceptionStatus(payload.status);
        if (nextStatus === 'approved') {
          await this.applyApprovedScheduleExceptionRequestLegacy(request, actor, reviewedAt);
        } else {
          await this.restoreScheduleStatusAfterRejectedExceptionLegacy(request);
        }

        try {
          return await this.prisma.yEU_CAU_LICH_BSK.update({
            where: { YCL_ID: requestId },
            data: {
              YCL_TRANG_THAI: nextStatus,
              YCL_GHI_CHU_ADMIN: payload.adminNote?.trim() || null,
              YCL_DUYET_BOI: actor,
              YCL_DUYET_LUC: reviewedAt,
            },
          });
        } catch (innerError) {
          if (!this.isMissingColumnError(innerError)) {
            throw innerError;
          }
          return await this.prisma.yEU_CAU_LICH_BSK.update({
            where: { YCL_ID: requestId },
            data: {
              YCL_TRANG_THAI: nextStatus,
            },
          });
        }
      }
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getScheduleCycleOverview(weekStartRaw?: string) {
    try {
      const { mondayStart, saturdayEnd, weekStartIso, weekEndIso } =
        this.resolveWeekRange(weekStartRaw);
      await this.ensureWeeklySchedulesGenerated(weekStartIso, 'SYSTEM');

      const now = new Date();
      const registrationOpenAt = new Date(mondayStart);
      registrationOpenAt.setUTCDate(mondayStart.getUTCDate() - 7);
      registrationOpenAt.setUTCHours(0, 0, 0, 0);
      const registrationCloseAt = new Date(mondayStart);
      registrationCloseAt.setUTCDate(mondayStart.getUTCDate() - 2);
      registrationCloseAt.setUTCHours(23, 59, 59, 999);
      const adminReviewWindowEndAt = new Date(mondayStart);
      adminReviewWindowEndAt.setUTCDate(mondayStart.getUTCDate() - 1);
      adminReviewWindowEndAt.setUTCHours(23, 59, 59, 999);

      const [schedules, sessions, weekBatch, exceptionRequests] = await this.prisma.$transaction([
        this.prisma.lICH_BSK.findMany({
          where: {
            LBSK_IS_ARCHIVED: false,
            N_NGAY: {
              gte: mondayStart,
              lte: saturdayEnd,
            },
          },
          select: {
            N_NGAY: true,
            B_TEN: true,
            LBSK_TRANG_THAI: true,
            LBSK_TRANGTHAI_DUYET: true,
          },
        }),
        this.prisma.bUOI.findMany({
          select: { B_TEN: true },
          orderBy: { B_GIO_BAT_DAU: 'asc' },
        }),
        this.prisma.dOT_LICH_TUAN.findUnique({
          where: { DLT_TUAN_BAT_DAU: mondayStart },
        }),
        this.prisma.yEU_CAU_LICH_BSK.findMany({
          where: {
            LBSK_N_NGAY: {
              gte: mondayStart,
              lte: saturdayEnd,
            },
          },
          select: { YCL_TRANG_THAI: true },
        }),
      ]);

      const resolvedWeekBatch = weekBatch ?? (await this.getScheduleWeekOrThrow(weekStartIso));
      const workflowStatus = this.normalizeScheduleWeekStatus(
        resolvedWeekBatch.DLT_TRANG_THAI,
      );

      let generated = 0;
      let confirmed = 0;
      let changeRequested = 0;
      let adjusted = 0;
      let finalized = 0;
      let cancelled = 0;

      for (const schedule of schedules) {
        const status = this.normalizeScheduleInstanceStatus(schedule.LBSK_TRANG_THAI);
        if (status === 'generated') generated += 1;
        else if (status === 'confirmed') confirmed += 1;
        else if (status === 'change_requested') changeRequested += 1;
        else if (status === 'vacant_by_leave') changeRequested += 1;
        else if (status === 'adjusted') adjusted += 1;
        else if (status === 'finalized') finalized += 1;
        else cancelled += 1;
      }

      const pendingExceptions = exceptionRequests.filter(
        (row) => this.normalizeScheduleExceptionStatus(row.YCL_TRANG_THAI) === 'pending',
      ).length;
      const approvedExceptions = exceptionRequests.filter(
        (row) => this.normalizeScheduleExceptionStatus(row.YCL_TRANG_THAI) === 'approved',
      ).length;
      const rejectedExceptions = exceptionRequests.filter(
        (row) => this.normalizeScheduleExceptionStatus(row.YCL_TRANG_THAI) === 'rejected',
      ).length;

      const cycleStatus =
        workflowStatus === 'finalized' || workflowStatus === 'slot_opened'
          ? 'finalized'
          : now <= registrationCloseAt
          ? 'open'
          : 'locked';
      const missingShifts = this.buildMissingShiftSummary({
        mondayStart,
        saturdayEnd,
        sessions: sessions.map((session) => session.B_TEN),
        approvedSchedules: schedules.filter(
          (row) => {
            const status = this.normalizeScheduleInstanceStatus(row.LBSK_TRANG_THAI);
            return !this.isScheduleStatusInactive(status);
          },
        ),
      });

      return {
        weekStartDate: weekStartIso,
        weekEndDate: weekEndIso,
        registrationOpenAt: registrationOpenAt.toISOString(),
        registrationCloseAt: registrationCloseAt.toISOString(),
        adminReviewWindowEndAt: adminReviewWindowEndAt.toISOString(),
        status: cycleStatus,
        workflowStatus,
        finalizedAt: resolvedWeekBatch.DLT_CHOT_LUC || null,
        slotGeneratedAt: resolvedWeekBatch.DLT_MO_SLOT_LUC || null,
        summary: {
          total: schedules.length,
          pending: generated + changeRequested,
          approved: confirmed + adjusted,
          rejected: cancelled,
          official: finalized,
          generated,
          confirmed,
          changeRequested,
          adjusted,
          finalized,
          cancelled,
          pendingExceptions,
          approvedExceptions,
          rejectedExceptions,
        },
        missingShifts,
      };
    } catch (e) {
      if (this.isMissingScheduleApprovalColumnsError(e)) {
        this.logger.warn(
          'Missing schedule approval columns; using legacy schedule cycle overview fallback.',
        );
        return this.getScheduleCycleOverviewLegacy(weekStartRaw);
      }
      mapPrismaError(e);
    }
  }

  async exportWeeklySchedulePdf(
    params: {
      weekStart?: string;
      specialtyId?: string;
      doctorId?: string;
      roomId?: string;
      status?: string;
      session?: string;
      weekday?: string;
      date?: string;
      search?: string;
      source?: string;
    },
    exportedBy: string,
  ) {
    const [overview, list] = await Promise.all([
      this.getScheduleCycleOverview(params.weekStart),
      this.getWeeklySchedules({
        ...params,
        page: '1',
        limit: '200',
      }),
    ]);

    const rows = (list as any)?.items || [];
    const tableRows = rows.map((item: any) => [
      this.toDateOnlyIso(new Date(item.N_NGAY)),
      item.B_TEN || '-',
      item.doctor?.BS_HO_TEN || `BS #${item.BS_MA}`,
      item.room?.P_TEN || `Phong #${item.P_MA}`,
      item.status || '-',
      String(item.bookingCount ?? 0),
      String(item.slotCount ?? 0),
    ]);

    const report = await this.pdfService.buildReport({
      title: 'BAO CAO LICH KHAM TUAN (ADMIN)',
      subtitle: `Tuan ${overview.weekStartDate} -> ${overview.weekEndDate}`,
      metadataLines: [`Exported by: ${exportedBy}`],
      sections: [
        {
          heading: 'Tong quan tuan',
          keyValues: [
            { label: 'Trang thai chu ky', value: overview.workflowStatus || '-' },
            { label: 'Tong ca', value: String(overview.summary?.total ?? 0) },
            { label: 'Generated', value: String(overview.summary?.generated ?? 0) },
            { label: 'Confirmed', value: String(overview.summary?.confirmed ?? 0) },
            { label: 'Adjusted', value: String(overview.summary?.adjusted ?? 0) },
            { label: 'Finalized', value: String(overview.summary?.finalized ?? 0) },
            { label: 'Pending requests', value: String(overview.summary?.pendingExceptions ?? 0) },
          ],
        },
        {
          heading: 'Danh sach ca truc trong tuan',
          table: {
            headers: ['Ngay', 'Buoi', 'Bac si', 'Phong', 'Trang thai', 'Booking', 'Slots'],
            rows:
              tableRows.length > 0
                ? tableRows
                : [['-', '-', '-', '-', '-', '0', '0']],
          },
        },
      ],
    });

    await this.writePdfAuditLog('ADMIN_WEEKLY_SCHEDULE_PDF_EXPORTED', exportedBy, {
      weekStart: overview.weekStartDate,
      weekEnd: overview.weekEndDate,
      count: rows.length,
    });

    return {
      filename: `admin-weekly-schedule-${overview.weekStartDate}.pdf`,
      buffer: report,
    };
  }

  async exportDoctorWeeklySchedulePdf(
    BS_MA: number,
    weekStartRaw?: string,
    exportedBy = 'DOCTOR',
  ) {
    const [overview, list] = await Promise.all([
      this.getDoctorWeekOverview(BS_MA, weekStartRaw),
      this.getDoctorWeeklySchedules(BS_MA, weekStartRaw),
    ]);

    const rows = (list as any)?.items || [];
    const tableRows = rows.map((item: any) => [
      this.toDateOnlyIso(new Date(item.N_NGAY)),
      item.B_TEN || '-',
      item.room?.P_TEN || `Phong #${item.P_MA}`,
      item.status || '-',
      String(item.bookingCount ?? 0),
      String(item.slotCount ?? 0),
    ]);

    const report = await this.pdfService.buildReport({
      title: 'LỊCH LÀM VIỆC THEO TUẦN (BÁC SĨ)',
      subtitle: `Bác sĩ: ${overview?.doctor?.BS_HO_TEN || `#${BS_MA}`} | Tuần ${overview.weekStartDate} -> ${overview.weekEndDate}`,
      metadataLines: [
        `Mã bác sĩ: ${overview?.doctor?.BS_MA ?? BS_MA}`,
        `Chuyên khoa: ${overview?.doctor?.CHUYEN_KHOA?.CK_TEN || '-'}`,
        `Người xuất: ${exportedBy}`,
      ],
      sections: [
        {
          heading: 'Tổng quan tuần',
          keyValues: [
            { label: 'Trạng thái chu kỳ', value: overview.workflowStatus || '-' },
            { label: 'Tổng ca', value: String(overview.summary?.total ?? rows.length) },
            { label: 'Đã xác nhận', value: String(overview.summary?.confirmed ?? 0) },
            { label: 'Cần điều chỉnh', value: String(overview.summary?.changeRequested ?? 0) },
            { label: 'Ca chính thức', value: String(overview.summary?.finalized ?? 0) },
          ],
        },
        {
          heading: 'Danh sách ca làm việc',
          table: {
            headers: ['Ngày', 'Buổi', 'Phòng', 'Trạng thái', 'Lịch hẹn', 'Slot'],
            rows: tableRows.length > 0 ? tableRows : [['-', '-', '-', '-', '0', '0']],
          },
        },
      ],
    });

    await this.writePdfAuditLog('DOCTOR_WEEKLY_SCHEDULE_PDF_EXPORTED', exportedBy, {
      doctorId: BS_MA,
      weekStart: overview.weekStartDate,
      weekEnd: overview.weekEndDate,
      count: rows.length,
    });

    return {
      filename: `doctor-weekly-schedule-${BS_MA}-${overview.weekStartDate}.pdf`,
      buffer: report,
    };
  }

  async exportPatientsPdf(
    params: {
      search?: string;
      sortBy?: string;
      sortOrder?: string;
      gender?: string;
      nationality?: string;
      ethnicity?: string;
      patientType?: string;
      accountPhone?: string;
    },
    exportedBy: string,
  ) {
    const result = (await this.getPatients({
      ...params,
      page: '1',
      limit: '100',
    })) as any;
    const rows = result?.items || [];

    const report = await this.pdfService.buildReport({
      title: 'BAO CAO DANH SACH BENH NHAN',
      subtitle: 'Danh sach benh nhan theo bo loc hien tai',
      metadataLines: [
        `Exported by: ${exportedBy}`,
        `Total exported rows: ${rows.length}`,
      ],
      sections: [
        {
          heading: 'Thong tin bo loc',
          keyValues: [
            { label: 'Search', value: params.search || '-' },
            { label: 'Gender', value: params.gender || 'all' },
            { label: 'Nationality', value: params.nationality || '-' },
            { label: 'Ethnicity', value: params.ethnicity || '-' },
            { label: 'Patient type', value: params.patientType || 'all' },
            { label: 'Account phone', value: params.accountPhone || '-' },
          ],
        },
        {
          heading: 'Danh sach benh nhan',
          table: {
            headers: ['BN_MA', 'Ho ten', 'Gioi tinh', 'SDT', 'Quoc gia', 'Dan toc', 'Loai'],
            rows:
              rows.length > 0
                ? rows.map((item: any) => [
                    String(item.BN_MA),
                    this.toFullPatientName(item) || '-',
                    this.genderLabel(item.BN_LA_NAM),
                    item.BN_SDT_DANG_KY || '-',
                    item.BN_QUOC_GIA || '-',
                    item.BN_DAN_TOC || '-',
                    item.BN_MOI === true ? 'new' : item.BN_MOI === false ? 'returning' : '-',
                  ])
                : [['-', '-', '-', '-', '-', '-', '-']],
          },
        },
      ],
    });

    await this.writePdfAuditLog('PATIENTS_LIST_PDF_EXPORTED', exportedBy, {
      count: rows.length,
      filters: params,
    });

    return {
      filename: `patients-list-${this.toDateOnlyIso(new Date())}.pdf`,
      buffer: report,
    };
  }

  async exportPatientProfilePdf(patientId: number, exportedBy: string) {
    const patient = (await this.getPatientById(patientId)) as any;
    const report = await this.pdfService.buildReport({
      title: 'HO SO BENH NHAN',
      subtitle: `Benh nhan #${patient.BN_MA}`,
      metadataLines: [`Exported by: ${exportedBy}`],
      sections: [
        {
          heading: 'Thong tin co ban',
          keyValues: [
            { label: 'Ma benh nhan', value: String(patient.BN_MA) },
            { label: 'Ho ten', value: this.toFullPatientName(patient) || '-' },
            { label: 'Gioi tinh', value: this.genderLabel(patient.BN_LA_NAM) },
            { label: 'SDT dang ky', value: patient.BN_SDT_DANG_KY || '-' },
            { label: 'Email', value: patient.BN_EMAIL || '-' },
            { label: 'CCCD', value: patient.BN_CCCD || '-' },
            { label: 'Quoc gia', value: patient.BN_QUOC_GIA || '-' },
            { label: 'Dan toc', value: patient.BN_DAN_TOC || '-' },
            { label: 'So dia chi', value: patient.BN_SO_DDCN || '-' },
            { label: 'So tai khoan', value: patient.TK_SDT || '-' },
          ],
        },
      ],
    });

    await this.writePdfAuditLog('PATIENT_PROFILE_PDF_EXPORTED', exportedBy, {
      patientId,
    });

    return {
      filename: `patient-${patientId}.pdf`,
      buffer: report,
    };
  }

  async exportDoctorsPdf(
    params: {
      search?: string;
      sortBy?: string;
      sortOrder?: string;
      specialtyId?: string;
      academicTitle?: string;
    },
    exportedBy: string,
  ) {
    const result = (await this.getDoctors({
      ...params,
      page: '1',
      limit: '100',
    })) as any;
    const rows = result?.items || [];

    const report = await this.pdfService.buildReport({
      title: 'BAO CAO DANH SACH BAC SI',
      subtitle: 'Danh sach bac si theo bo loc hien tai',
      metadataLines: [
        `Exported by: ${exportedBy}`,
        `Total exported rows: ${rows.length}`,
      ],
      sections: [
        {
          heading: 'Thong tin bo loc',
          keyValues: [
            { label: 'Search', value: params.search || '-' },
            { label: 'Specialty ID', value: params.specialtyId || '-' },
            { label: 'Academic title', value: params.academicTitle || '-' },
          ],
        },
        {
          heading: 'Danh sach bac si',
          table: {
            headers: ['BS_MA', 'Ho ten', 'SDT', 'Email', 'Hoc ham', 'Chuyen khoa'],
            rows:
              rows.length > 0
                ? rows.map((item: any) => [
                    String(item.BS_MA),
                    item.BS_HO_TEN || '-',
                    item.BS_SDT || '-',
                    item.BS_EMAIL || '-',
                    item.BS_HOC_HAM || '-',
                    item.CHUYEN_KHOA?.CK_TEN || '-',
                  ])
                : [['-', '-', '-', '-', '-', '-']],
          },
        },
      ],
    });

    await this.writePdfAuditLog('DOCTORS_LIST_PDF_EXPORTED', exportedBy, {
      count: rows.length,
      filters: params,
    });

    return {
      filename: `doctors-list-${this.toDateOnlyIso(new Date())}.pdf`,
      buffer: report,
    };
  }

  async exportDoctorProfilePdf(doctorId: number, exportedBy: string) {
    const doctor = (await this.getDoctorById(doctorId)) as any;
    const report = await this.pdfService.buildReport({
      title: 'HO SO BAC SI',
      subtitle: `Bac si #${doctor.BS_MA}`,
      metadataLines: [`Exported by: ${exportedBy}`],
      sections: [
        {
          heading: 'Thong tin co ban',
          keyValues: [
            { label: 'Ma bac si', value: String(doctor.BS_MA) },
            { label: 'Ho ten', value: doctor.BS_HO_TEN || '-' },
            { label: 'So dien thoai', value: doctor.BS_SDT || '-' },
            { label: 'Email', value: doctor.BS_EMAIL || '-' },
            { label: 'Hoc ham', value: doctor.BS_HOC_HAM || '-' },
            { label: 'Chuyen khoa', value: doctor.CHUYEN_KHOA?.CK_TEN || '-' },
            { label: 'Tai khoan SDT', value: doctor.TK_SDT || '-' },
          ],
        },
      ],
    });

    await this.writePdfAuditLog('DOCTOR_PROFILE_PDF_EXPORTED', exportedBy, {
      doctorId,
    });

    return {
      filename: `doctor-${doctorId}.pdf`,
      buffer: report,
    };
  }

  async exportSupportCatalogPdf(exportedBy: string) {
    const [specialties, roomsResult, servicesResult] = await Promise.all([
      this.getSpecialties(),
      this.getRooms({ page: '1', limit: '100', sortBy: 'name', sortOrder: 'asc' }),
      this.getServices({ page: '1', limit: '100', sortBy: 'name', sortOrder: 'asc' }),
    ]);

    const rooms = (roomsResult as any)?.items || [];
    const services = (servicesResult as any)?.items || [];
    const specialtyRows = Array.isArray(specialties) ? specialties : (specialties as any)?.items || [];

    const report = await this.pdfService.buildReport({
      title: 'TAI LIEU THONG TIN HO TRO NGUOI DUNG',
      subtitle: 'Tong hop chuyen khoa, phong kham, dich vu',
      metadataLines: [`Exported by: ${exportedBy}`],
      sections: [
        {
          heading: 'Danh muc chuyen khoa',
          table: {
            headers: ['CK_MA', 'Ten chuyen khoa'],
            rows:
              specialtyRows.length > 0
                ? specialtyRows.map((item: any) => [String(item.CK_MA), item.CK_TEN || '-'])
                : [['-', '-']],
          },
        },
        {
          heading: 'Danh muc phong kham',
          table: {
            headers: ['P_MA', 'Ten phong', 'Chuyen khoa', 'Vi tri'],
            rows:
              rooms.length > 0
                ? rooms.map((item: any) => [
                    String(item.P_MA),
                    item.P_TEN || '-',
                    item.CHUYEN_KHOA?.CK_TEN || '-',
                    item.P_VI_TRI || '-',
                  ])
                : [['-', '-', '-', '-']],
          },
        },
        {
          heading: 'Danh muc dich vu',
          table: {
            headers: ['DVCLS_MA', 'Ten dich vu', 'Loai', 'Gia'],
            rows:
              services.length > 0
                ? services.map((item: any) => [
                    String(item.DVCLS_MA),
                    item.DVCLS_TEN || '-',
                    item.DVCLS_LOAI || '-',
                    String(item.DVCLS_GIA_DV ?? 0),
                  ])
                : [['-', '-', '-', '-']],
          },
        },
      ],
    });

    await this.writePdfAuditLog('SUPPORT_CATALOG_PDF_EXPORTED', exportedBy, {
      specialties: specialtyRows.length,
      rooms: rooms.length,
      services: services.length,
    });

    return {
      filename: `support-catalog-${this.toDateOnlyIso(new Date())}.pdf`,
      buffer: report,
    };
  }

  async getScheduleRegistrations(params?: {
    weekStart?: string;
    page?: string;
    limit?: string;
    specialtyId?: string;
    doctorId?: string;
    roomId?: string;
    status?: string;
    session?: string;
    date?: string;
    search?: string;
  }) {
    try {
      const rawPage = Number.parseInt(params?.page || '1', 10);
      const rawLimit = Number.parseInt(params?.limit || '10', 10);
      const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
      const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 100);
      const parsedDoctorId = Number.parseInt(params?.doctorId || '', 10);
      const parsedRoomId = Number.parseInt(params?.roomId || '', 10);
      const parsedSpecialtyId = Number.parseInt(params?.specialtyId || '', 10);
      const doctorId = Number.isNaN(parsedDoctorId) ? undefined : parsedDoctorId;
      const roomId = Number.isNaN(parsedRoomId) ? undefined : parsedRoomId;
      const specialtyId = Number.isNaN(parsedSpecialtyId)
        ? undefined
        : parsedSpecialtyId;
      const status = (params?.status || 'all').trim().toLowerCase();
      const session = params?.session?.trim() || undefined;
      const search = params?.search?.trim().toLowerCase() || '';
      const dateFilter = params?.date?.trim() || undefined;
      const { mondayStart, saturdayEnd, weekStartIso } = this.resolveWeekRange(
        params?.weekStart,
      );

      const where: Prisma.LICH_BSKWhereInput = {
        LBSK_IS_ARCHIVED: false,
        N_NGAY: { gte: mondayStart, lte: saturdayEnd },
        ...(doctorId ? { BS_MA: doctorId } : {}),
        ...(roomId ? { P_MA: roomId } : {}),
        ...(session ? { B_TEN: session } : {}),
        ...(specialtyId ? { BAC_SI: { CK_MA: specialtyId } } : {}),
        ...(dateFilter ? { N_NGAY: new Date(dateFilter) } : {}),
        NOT: { LBSK_DUYET_BOI: 'ADMIN_MANUAL' },
        ...(status === 'pending' || status === 'approved' || status === 'rejected'
          ? { LBSK_TRANGTHAI_DUYET: status }
          : {}),
      };

      const allRows = await this.prisma.lICH_BSK.findMany({
        where,
        include: {
          BAC_SI: {
            select: {
              BS_MA: true,
              BS_HO_TEN: true,
              CK_MA: true,
              CHUYEN_KHOA: { select: { CK_TEN: true } },
            },
          },
          PHONG: {
            select: {
              P_MA: true,
              P_TEN: true,
              CK_MA: true,
              CHUYEN_KHOA: { select: { CK_TEN: true } },
            },
          },
        },
        orderBy: [{ N_NGAY: 'asc' }, { B_TEN: 'asc' }, { BS_MA: 'asc' }],
      });

      const mapped = allRows
        .map((row) => {
          return {
            BS_MA: row.BS_MA,
            N_NGAY: row.N_NGAY,
            B_TEN: row.B_TEN,
            P_MA: row.P_MA,
            status: this.normalizeApprovalStatus(row.LBSK_TRANGTHAI_DUYET),
            note: row.LBSK_GHI_CHU,
            doctor: row.BAC_SI,
            room: row.PHONG,
            submittedAt: null as string | null,
            reviewedBy: row.LBSK_DUYET_BOI,
            reviewedAt: row.LBSK_DUYET_LUC?.toISOString() || null,
          };
        })
        .filter((row) =>
          search.length === 0
            ? true
            : row.doctor.BS_HO_TEN.toLowerCase().includes(search) ||
              row.doctor.BS_MA.toString().includes(search),
        );

      const total = mapped.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (page - 1) * limit;
      const items = mapped.slice(offset, offset + limit);

      return {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages,
          weekStart: weekStartIso,
        },
      };
    } catch (e) {
      if (this.isMissingScheduleApprovalColumnsError(e)) {
        this.logger.warn(
          'Missing schedule approval columns; using legacy registrations fallback.',
        );
        return this.getScheduleRegistrationsLegacy(params);
      }
      mapPrismaError(e);
    }
  }

    async updateScheduleRegistrationStatus(
    BS_MA: number,
    N_NGAY: string,
    B_TEN: string,
    payload: { status: 'approved' | 'rejected'; adminNote?: string },
  ) {
    try {
      const targetDate = this.parseDateOnlyOrThrow(N_NGAY);
      const targetWeekStart = this.getWeekMondayFromDate(targetDate);
      const targetWeekStartIso = this.toDateOnlyIso(targetWeekStart);
      this.assertAdminSundayActionForWeek(
        targetWeekStart,
        'duyệt hoặc từ chối đăng ký lịch trực',
      );
      await this.ensureWeekNotFinalized(targetWeekStartIso);

      const existing = await this.prisma.lICH_BSK.findUnique({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: targetDate, B_TEN } },
      });
      if (!existing || existing.LBSK_IS_ARCHIVED) {
        throw new NotFoundException('Không tìm thấy ca đăng ký cần cập nhật');
      }
      if (existing.LBSK_DUYET_BOI === 'ADMIN_MANUAL') {
        throw new ConflictException(
          'Ca trực này là ca chính thức do admin tạo thủ công, không thuộc luồng duyệt đăng ký.',
        );
      }

      const currentStatus = this.normalizeApprovalStatus(existing.LBSK_TRANGTHAI_DUYET);
      if (currentStatus !== 'pending') {
        throw new ConflictException(
          'Chỉ có thể duyệt hoặc từ chối khi đăng ký đang ở trạng thái chờ duyệt.',
        );
      }

      const nextStatus = this.normalizeApprovalStatus(payload.status);
      if (nextStatus === 'approved') {
        await this.validateDoctorRoomSpecialty(existing.BS_MA, existing.P_MA);
        await this.assertNoApprovalConflicts({
          BS_MA: existing.BS_MA,
          P_MA: existing.P_MA,
          N_NGAY: targetDate,
          B_TEN,
          currentKey: { BS_MA: existing.BS_MA, N_NGAY: targetDate, B_TEN },
        });
      }

      const mergedNote = this.mergeAdminNote(existing.LBSK_GHI_CHU, payload.adminNote);
      const reviewedAt = new Date();
      const nextInstanceStatus =
        nextStatus === 'approved'
          ? ('confirmed' as ScheduleInstanceStatus)
          : ('cancelled' as ScheduleInstanceStatus);

      return await this.prisma.lICH_BSK.update({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: targetDate, B_TEN } },
        data: {
          LBSK_TRANG_THAI: nextInstanceStatus,
          LBSK_TRANGTHAI_DUYET: nextStatus,
          LBSK_GHI_CHU: mergedNote,
          LBSK_DUYET_BOI: 'ADMIN',
          LBSK_DUYET_LUC: reviewedAt,
          LBSK_XAC_NHAN_LUC: nextStatus === 'approved' ? reviewedAt : null,
          LBSK_CAP_NHAT_LUC: reviewedAt,
        },
      });
    } catch (e) {
      if (this.isMissingScheduleApprovalColumnsError(e)) {
        this.logger.warn(
          'Missing schedule approval columns; using legacy registration status update fallback.',
        );
        return this.updateScheduleRegistrationStatusLegacy(
          BS_MA,
          N_NGAY,
          B_TEN,
          payload,
        );
      }
      mapPrismaError(e);
    }
  }
  async getOfficialSchedules(params?: {
    weekStart?: string;
    page?: string;
    limit?: string;
    specialtyId?: string;
    doctorId?: string;
    roomId?: string;
    status?: string;
    session?: string;
    weekday?: string;
    date?: string;
    search?: string;
  }) {
    try {
      const rawPage = Number.parseInt(params?.page || '1', 10);
      const rawLimit = Number.parseInt(params?.limit || '10', 10);
      const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
      const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 100);
      const parsedDoctorId = Number.parseInt(params?.doctorId || '', 10);
      const parsedRoomId = Number.parseInt(params?.roomId || '', 10);
      const parsedSpecialtyId = Number.parseInt(params?.specialtyId || '', 10);
      const doctorId = Number.isNaN(parsedDoctorId) ? undefined : parsedDoctorId;
      const roomId = Number.isNaN(parsedRoomId) ? undefined : parsedRoomId;
      const specialtyId = Number.isNaN(parsedSpecialtyId) ? undefined : parsedSpecialtyId;
      const status = (params?.status || 'all').trim().toLowerCase();
      const session = params?.session?.trim() || undefined;
      const parsedWeekday = Number.parseInt(params?.weekday || '', 10);
      const weekday =
        Number.isNaN(parsedWeekday) || parsedWeekday < 0 || parsedWeekday > 6
          ? undefined
          : parsedWeekday;
      const search = params?.search?.trim().toLowerCase() || '';
      const dateFilter = params?.date?.trim() || undefined;
      const { mondayStart, saturdayEnd, weekStartIso } = this.resolveWeekRange(
        params?.weekStart,
      );

      const where: Prisma.LICH_BSKWhereInput = {
        LBSK_IS_ARCHIVED: false,
        N_NGAY: { gte: mondayStart, lte: saturdayEnd },
        LBSK_TRANGTHAI_DUYET: 'approved',
        ...(doctorId ? { BS_MA: doctorId } : {}),
        ...(roomId ? { P_MA: roomId } : {}),
        ...(session ? { B_TEN: session } : {}),
        ...(specialtyId ? { BAC_SI: { CK_MA: specialtyId } } : {}),
        ...(dateFilter ? { N_NGAY: new Date(dateFilter) } : {}),
      };

      const [allRows, finalizedLog] = await this.prisma.$transaction([
        this.prisma.lICH_BSK.findMany({
          where,
          include: {
            BAC_SI: {
              select: {
                BS_MA: true,
                BS_HO_TEN: true,
                CK_MA: true,
                CHUYEN_KHOA: { select: { CK_TEN: true } },
              },
            },
            PHONG: {
              select: {
                P_MA: true,
                P_TEN: true,
                CK_MA: true,
                CHUYEN_KHOA: { select: { CK_TEN: true } },
              },
            },
            BUOI: {
              select: {
                B_TEN: true,
                KHUNG_GIO: {
                  select: { KG_MA: true, KG_SO_BN_TOI_DA: true },
                },
              },
            },
          },
          orderBy: [{ N_NGAY: 'asc' }, { B_TEN: 'asc' }, { BS_MA: 'asc' }],
        }),
        this.prisma.aUDIT_LOG.findFirst({
          where: {
            AL_TABLE: 'SCHEDULE_CYCLE',
            AL_ACTION: 'FINALIZED',
            AL_PK: { equals: { weekStart: weekStartIso } },
          },
          orderBy: { AL_CHANGED_AT: 'desc' },
        }),
      ]);

      const displayStatus = this.resolveOfficialShiftDisplayStatus(Boolean(finalizedLog));
      const mapped = allRows
        .map((row) => ({
          BS_MA: row.BS_MA,
          N_NGAY: row.N_NGAY,
          B_TEN: row.B_TEN,
          P_MA: row.P_MA,
          status: displayStatus,
          note: row.LBSK_GHI_CHU,
          doctor: row.BAC_SI,
          room: row.PHONG,
          slotCount: row.BUOI?.KHUNG_GIO?.length ?? 0,
          slotMax: this.resolveSlotMax(row.BUOI?.KHUNG_GIO),
        }))
        .filter((row) => (status === 'all' ? true : row.status === status))
        .filter((row) =>
          weekday === undefined ? true : this.getWeekdayFromDate(row.N_NGAY) === weekday,
        )
        .filter((row) =>
          search.length === 0
            ? true
            : row.doctor.BS_HO_TEN.toLowerCase().includes(search) ||
              row.doctor.BS_MA.toString().includes(search),
        );

      const total = mapped.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const offset = (page - 1) * limit;
      const items = mapped.slice(offset, offset + limit);

      return {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages,
          weekStart: weekStartIso,
        },
      };
    } catch (e) {
      if (this.isMissingScheduleApprovalColumnsError(e)) {
        this.logger.warn(
          'Missing schedule approval columns; using legacy official shifts fallback.',
        );
        return this.getOfficialSchedulesLegacy(params);
      }
      mapPrismaError(e);
    }
  }

  async getOfficialShiftFormContext(params?: {
    date?: string;
    roomId?: string;
    doctorId?: string;
    excludeBsMa?: string;
    excludeDate?: string;
    excludeSession?: string;
  }) {
    try {
      if (!params?.date?.trim()) {
        throw new BadRequestException('Vui lòng chọn ngày làm việc.');
      }

      const targetDate = this.parseDateOnlyOrThrow(params.date.trim());
      const dateIso = this.toDateOnlyIso(targetDate);
      const parsedRoomId = Number.parseInt(params.roomId || '', 10);
      const parsedDoctorId = Number.parseInt(params.doctorId || '', 10);
      const roomId = Number.isNaN(parsedRoomId) ? undefined : parsedRoomId;
      const doctorId = Number.isNaN(parsedDoctorId) ? undefined : parsedDoctorId;
      const parsedExcludeBsMa = Number.parseInt(params.excludeBsMa || '', 10);
      const excludeBsMa = Number.isNaN(parsedExcludeBsMa)
        ? undefined
        : parsedExcludeBsMa;
      const excludeDate = params.excludeDate?.trim() || undefined;
      const excludeSession = params.excludeSession?.trim() || undefined;

      const [sessions, room, doctor, finalizedLog] = await Promise.all([
        this.prisma.bUOI.findMany({
          select: { B_TEN: true },
          orderBy: { B_GIO_BAT_DAU: 'asc' },
        }),
        roomId
          ? this.prisma.pHONG.findUnique({
              where: { P_MA: roomId },
              select: {
                P_MA: true,
                P_TEN: true,
                CK_MA: true,
                CHUYEN_KHOA: { select: { CK_TEN: true } },
              },
            })
          : Promise.resolve(null),
        doctorId
          ? this.prisma.bAC_SI.findUnique({
              where: { BS_MA: doctorId },
              select: {
                BS_MA: true,
                BS_HO_TEN: true,
                CK_MA: true,
                BS_DA_XOA: true,
                CHUYEN_KHOA: { select: { CK_TEN: true } },
              },
            })
          : Promise.resolve(null),
        this.prisma.aUDIT_LOG.findFirst({
          where: {
            AL_TABLE: 'SCHEDULE_CYCLE',
            AL_ACTION: 'FINALIZED',
            AL_PK: {
              equals: {
                weekStart: this.toDateOnlyIso(this.getWeekMondayFromDate(targetDate)),
              },
            },
          },
          orderBy: { AL_CHANGED_AT: 'desc' },
        }),
      ]);

      if (roomId && !room) {
        throw new NotFoundException('Không tìm thấy phòng đã chọn.');
      }
      if (doctorId && (!doctor || doctor.BS_DA_XOA)) {
        throw new NotFoundException('Không tìm thấy bác sĩ hợp lệ đã chọn.');
      }

      const doctorSpecialtyMatchesRoom =
        room && doctor ? doctor.CK_MA === room.CK_MA : null;

      const rows = await this.getDailyScheduleContextRows(
        targetDate,
        Boolean(finalizedLog),
      );
      const excludedRows = rows.filter((row) => {
        if (!excludeBsMa || !excludeDate || !excludeSession) return true;
        return !(
          row.BS_MA === excludeBsMa &&
          this.toDateOnlyIso(row.N_NGAY) === excludeDate &&
          row.B_TEN === excludeSession
        );
      });

      const sessionNames = (sessions ?? []).map((s) => s.B_TEN);
      const roomSessionMap = new Map<string, (typeof excludedRows)[number]>();
      const doctorSessionMap = new Map<string, (typeof excludedRows)[number]>();

      for (const row of excludedRows) {
        if (roomId && row.P_MA === roomId) {
          const current = roomSessionMap.get(row.B_TEN);
          if (!current || this.getDisplayStatusPriority(row.status) > this.getDisplayStatusPriority(current.status)) {
            roomSessionMap.set(row.B_TEN, row);
          }
        }
        if (doctorId && row.BS_MA === doctorId) {
          const current = doctorSessionMap.get(row.B_TEN);
          if (!current || this.getDisplayStatusPriority(row.status) > this.getDisplayStatusPriority(current.status)) {
            doctorSessionMap.set(row.B_TEN, row);
          }
        }
      }

      const sessionContext = sessionNames.map((session) => {
        const roomRow = roomSessionMap.get(session);
        const doctorRow = doctorSessionMap.get(session);
        const roomOccupied = this.isOccupiedScheduleStatus(roomRow?.status);
        const doctorOccupied = this.isOccupiedScheduleStatus(doctorRow?.status);
        const reasons: string[] = [];

        if (roomOccupied) {
          reasons.push('Buổi này của phòng đã có bác sĩ được phân công.');
        }
        if (doctorOccupied) {
          reasons.push('Bác sĩ này đã có ca trực khác trong cùng buổi.');
        }
        if (doctorSpecialtyMatchesRoom === false) {
          reasons.push('Bác sĩ không thuộc chuyên khoa của phòng đã chọn.');
        }

        const canSelect =
          Boolean(roomId) &&
          !roomOccupied &&
          (!doctorId || !doctorOccupied) &&
          doctorSpecialtyMatchesRoom !== false;

        return {
          session,
          room: {
            status: roomRow?.status ?? ('empty' as ScheduleDisplayStatus),
            occupied: roomOccupied,
            doctor: roomRow
              ? { BS_MA: roomRow.BS_MA, BS_HO_TEN: roomRow.doctorName }
              : null,
            note: roomRow?.note || null,
          },
          doctor: {
            status: doctorRow?.status ?? ('empty' as ScheduleDisplayStatus),
            occupied: doctorOccupied,
            room: doctorRow
              ? { P_MA: doctorRow.P_MA, P_TEN: doctorRow.roomName }
              : null,
            note: doctorRow?.note || null,
          },
          canSelect,
          reasons,
        };
      });

      const availableSessions = sessionContext
        .filter((item) => item.canSelect)
        .map((item) => item.session);

      return {
        date: dateIso,
        room:
          room == null
            ? null
            : {
                P_MA: room.P_MA,
                P_TEN: room.P_TEN,
                CK_MA: room.CK_MA,
                CHUYEN_KHOA: room.CHUYEN_KHOA,
              },
        doctor:
          doctor == null
            ? null
            : {
                BS_MA: doctor.BS_MA,
                BS_HO_TEN: doctor.BS_HO_TEN,
                CK_MA: doctor.CK_MA,
                CHUYEN_KHOA: doctor.CHUYEN_KHOA,
              },
        doctorSpecialtyMatchesRoom,
        sessionContext,
        availableSessions,
        hasAnyAvailableSession: availableSessions.length > 0,
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getDoctorScheduleCycleOverview(BS_MA: number) {
    const doctor = await this.getDoctorScheduleOwnerOrThrow(BS_MA);
    const nextWeekStartIso = this.toDateOnlyIso(this.getNextWeekMondayFromNow());
    const overview = await this.getScheduleCycleOverview(nextWeekStartIso);

    return {
      ...overview,
      doctor: {
        BS_MA: doctor.BS_MA,
        BS_HO_TEN: doctor.BS_HO_TEN,
        CK_MA: doctor.CK_MA,
        CHUYEN_KHOA: doctor.CHUYEN_KHOA,
      },
      canRegister: overview.status === 'open',
      canManageRegistrations: overview.status === 'open',
    };
  }

  async getDoctorWeekOverview(BS_MA: number, weekStartRaw?: string) {
    const doctor = await this.getDoctorScheduleOwnerOrThrow(BS_MA);
    const weekStart =
      weekStartRaw?.trim() || this.toDateOnlyIso(this.getNextWeekMondayFromNow());

    try {
      const overview: any = await this.getScheduleCycleOverview(weekStart);
      const canManage =
        overview.workflowStatus !== 'finalized' && overview.workflowStatus !== 'slot_opened';

      return {
        ...overview,
        doctor: {
          BS_MA: doctor.BS_MA,
          BS_HO_TEN: doctor.BS_HO_TEN,
          CK_MA: doctor.CK_MA,
          CHUYEN_KHOA: doctor.CHUYEN_KHOA,
        },
        canConfirm: canManage,
        canRequestChanges: canManage,
      };
    } catch (e) {
      if (!this.isLegacyScheduleFallbackEnabled()) {
        mapPrismaError(e);
      }
      this.logger.warn(
        `Falling back to legacy doctor week overview for BS_MA=${BS_MA}, weekStart=${weekStart}: ${e instanceof Error ? e.message : String(e)}`,
      );

      const cycle = await this.getDoctorScheduleCycleOverview(BS_MA);
      const registrations = await this.getDoctorScheduleRegistrations(BS_MA, weekStart);
      const official = await this.getDoctorOfficialSchedules(BS_MA, weekStart);
      const officialItems = official?.items ?? [];
      const registrationItems = registrations?.items ?? [];
      const workflowStatus =
        cycle.status === 'finalized' ? 'finalized' : ('generated' as ScheduleWeekStatus);
      const canManage = workflowStatus !== 'finalized';

      return {
        weekStartDate: cycle.weekStartDate,
        weekEndDate: cycle.weekEndDate,
        registrationOpenAt: cycle.registrationOpenAt,
        registrationCloseAt: cycle.registrationCloseAt,
        adminReviewWindowEndAt: cycle.adminReviewWindowEndAt,
        status: cycle.status,
        workflowStatus,
        finalizedAt: cycle.status === 'finalized' ? cycle.adminReviewWindowEndAt : null,
        slotGeneratedAt: null,
        summary: {
          total: registrationItems.length,
          pending: registrationItems.filter((item: any) => item.status === 'pending').length,
          approved: registrationItems.filter((item: any) => item.status === 'approved').length,
          rejected: registrationItems.filter((item: any) => item.status === 'rejected').length,
          official: officialItems.length,
          generated: registrationItems.filter((item: any) => item.status === 'pending').length,
          confirmed: registrationItems.filter((item: any) => item.status === 'approved').length,
          changeRequested: 0,
          adjusted: 0,
          finalized: officialItems.length,
          cancelled: registrationItems.filter((item: any) => item.status === 'rejected').length,
          pendingExceptions: 0,
          approvedExceptions: 0,
          rejectedExceptions: 0,
        },
        missingShifts: { totalMissing: 0, items: [] },
        doctor: {
          BS_MA: doctor.BS_MA,
          BS_HO_TEN: doctor.BS_HO_TEN,
          CK_MA: doctor.CK_MA,
          CHUYEN_KHOA: doctor.CHUYEN_KHOA,
        },
        canConfirm: canManage,
        canRequestChanges: canManage,
      };
    }
  }

  async getDoctorWeeklySchedules(BS_MA: number, weekStartRaw?: string) {
    await this.getDoctorScheduleOwnerOrThrow(BS_MA);
    const weekStart =
      weekStartRaw?.trim() || this.toDateOnlyIso(this.getNextWeekMondayFromNow());
    try {
      return await this.getWeeklySchedules({
        weekStart,
        doctorId: String(BS_MA),
        page: '1',
        limit: '200',
      });
    } catch (e) {
      if (!this.isLegacyScheduleFallbackEnabled()) {
        mapPrismaError(e);
      }
      this.logger.warn(
        `Falling back to legacy doctor weekly schedules for BS_MA=${BS_MA}, weekStart=${weekStart}: ${e instanceof Error ? e.message : String(e)}`,
      );

      const [cycle, registrations, official] = await Promise.all([
        this.getDoctorScheduleCycleOverview(BS_MA),
        this.getDoctorScheduleRegistrations(BS_MA, weekStart),
        this.getDoctorOfficialSchedules(BS_MA, weekStart),
      ]);

      const workflowStatus =
        cycle.status === 'finalized' ? 'finalized' : ('generated' as ScheduleWeekStatus);
      const officialMap = new Map<string, any>();
      for (const item of official?.items ?? []) {
        officialMap.set(`${this.toDateOnlyIso(item.N_NGAY)}::${item.B_TEN}`, item);
      }

      const items = (registrations?.items ?? []).map((item: any) => {
        const key = `${this.toDateOnlyIso(item.N_NGAY)}::${item.B_TEN}`;
        const officialItem = officialMap.get(key);
        const status =
          officialItem != null
            ? 'finalized'
            : item.status === 'approved'
              ? 'confirmed'
              : item.status === 'rejected'
                ? 'cancelled'
                : 'generated';

        return {
          BS_MA: item.BS_MA,
          N_NGAY: item.N_NGAY,
          B_TEN: item.B_TEN,
          P_MA: item.P_MA,
          status,
          source: 'legacy_registration',
          note: item.note ?? null,
          confirmationAt: null,
          createdAt: item.submittedAt ?? null,
          updatedAt: item.reviewedAt ?? null,
          slotCount: officialItem?.slotCount ?? 0,
          slotMax: officialItem?.slotMax ?? null,
          bookingCount: 0,
          doctor: item.doctor,
          room: item.room,
          template: null,
          latestException: null,
          weekStatus: workflowStatus,
          finalizedAt: cycle.status === 'finalized' ? cycle.adminReviewWindowEndAt : null,
          slotOpenedAt: null,
        };
      });

      return {
        items,
        meta: {
          total: items.length,
          page: 1,
          limit: 200,
          totalPages: 1,
          weekStart,
          workflowStatus,
          finalizedAt: cycle.status === 'finalized' ? cycle.adminReviewWindowEndAt : null,
          slotOpenedAt: null,
        },
      };
    }
  }

  async getDoctorScheduleExceptionRequests(BS_MA: number, weekStartRaw?: string) {
    await this.getDoctorScheduleOwnerOrThrow(BS_MA);
    const weekStart =
      weekStartRaw?.trim() || this.toDateOnlyIso(this.getNextWeekMondayFromNow());
    try {
      return await this.getScheduleExceptionRequests({
        weekStart,
        doctorId: String(BS_MA),
        page: '1',
        limit: '200',
      });
    } catch (e) {
      if (!this.isLegacyScheduleFallbackEnabled()) {
        mapPrismaError(e);
      }
      this.logger.warn(
        `Falling back to empty doctor exception list for BS_MA=${BS_MA}, weekStart=${weekStart}: ${e instanceof Error ? e.message : String(e)}`,
      );
      return {
        items: [],
        meta: {
          total: 0,
          page: 1,
          limit: 200,
          totalPages: 1,
          weekStart,
        },
      };
    }
  }

  async confirmDoctorWeekSchedule(
    BS_MA: number,
    weekStartRaw: string,
    actor = 'DOCTOR',
  ) {
    await this.getDoctorScheduleOwnerOrThrow(BS_MA);
    const { mondayStart, saturdayEnd, weekStartIso } = this.resolveWeekRange(weekStartRaw);
    try {
      await this.ensureWeeklySchedulesGenerated(weekStartIso, 'SYSTEM');
    } catch (e) {
      if (!this.isMissingColumnError(e)) {
        throw e;
      }
      this.logger.warn('Missing schedule columns; skip auto-generation for confirmation.');
    }
    await this.ensureWeekNotFinalized(weekStartIso);

    const confirmedAt = new Date();
    let generatedResult: { count: number };
    let adjustedResult: { count: number };
    try {
      [generatedResult, adjustedResult] = await this.prisma.$transaction([
        this.prisma.lICH_BSK.updateMany({
          where: {
            BS_MA,
            N_NGAY: { gte: mondayStart, lte: saturdayEnd },
            LBSK_IS_ARCHIVED: false,
            LBSK_TRANG_THAI: 'generated',
          },
          data: {
            LBSK_TRANG_THAI: 'confirmed',
            LBSK_TRANGTHAI_DUYET: 'approved',
            LBSK_XAC_NHAN_LUC: confirmedAt,
            LBSK_CAP_NHAT_LUC: confirmedAt,
            LBSK_DUYET_BOI: actor,
            LBSK_DUYET_LUC: confirmedAt,
          },
        }),
        this.prisma.lICH_BSK.updateMany({
          where: {
            BS_MA,
            N_NGAY: { gte: mondayStart, lte: saturdayEnd },
            LBSK_IS_ARCHIVED: false,
            LBSK_TRANG_THAI: 'adjusted',
          },
          data: {
            LBSK_TRANGTHAI_DUYET: 'approved',
            LBSK_XAC_NHAN_LUC: confirmedAt,
            LBSK_CAP_NHAT_LUC: confirmedAt,
          },
        }),
      ]);
    } catch (e) {
      if (!this.isMissingScheduleApprovalColumnsError(e)) {
        throw e;
      }
      this.logger.warn(
        'Missing schedule approval columns; using legacy confirmation fallback.',
      );
      [generatedResult, adjustedResult] = await this.prisma.$transaction([
        this.prisma.lICH_BSK.updateMany({
          where: {
            BS_MA,
            N_NGAY: { gte: mondayStart, lte: saturdayEnd },
            LBSK_IS_ARCHIVED: false,
            LBSK_TRANG_THAI: 'generated',
          },
          data: {
            LBSK_TRANG_THAI: 'confirmed',
            LBSK_XAC_NHAN_LUC: confirmedAt,
            LBSK_CAP_NHAT_LUC: confirmedAt,
          },
        }),
        this.prisma.lICH_BSK.updateMany({
          where: {
            BS_MA,
            N_NGAY: { gte: mondayStart, lte: saturdayEnd },
            LBSK_IS_ARCHIVED: false,
            LBSK_TRANG_THAI: 'adjusted',
          },
          data: {
            LBSK_XAC_NHAN_LUC: confirmedAt,
            LBSK_CAP_NHAT_LUC: confirmedAt,
          },
        }),
      ]);
    }

    return {
      message: 'Xác nhận lịch tuần thành công',
      weekStart: weekStartIso,
      confirmedCount: generatedResult.count,
      acknowledgedAdjustedCount: adjustedResult.count,
    };
  }

  async confirmDoctorShift(
    BS_MA: number,
    dateRaw: string,
    session: string,
    actor = 'DOCTOR',
  ) {
    await this.getDoctorScheduleOwnerOrThrow(BS_MA);
    const targetDate = this.parseDateOnlyOrThrow(this.normalizeDateParam(dateRaw));
    const weekStartIso = this.toDateOnlyIso(this.getWeekMondayFromDate(targetDate));
    try {
      await this.ensureWeeklySchedulesGenerated(weekStartIso, 'SYSTEM');
    } catch (e) {
      if (!this.isMissingColumnError(e)) {
        throw e;
      }
      this.logger.warn('Missing schedule columns; skip auto-generation for confirmation.');
    }
    await this.ensureWeekNotFinalized(weekStartIso);

    const existing = await this.prisma.lICH_BSK.findUnique({
      where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: targetDate, B_TEN: session } },
      select: {
        LBSK_TRANG_THAI: true,
        LBSK_IS_ARCHIVED: true,
      },
    });
    if (!existing || existing.LBSK_IS_ARCHIVED) {
      throw new NotFoundException('Không tìm thấy ca trực cần xác nhận.');
    }

    const currentStatus = this.normalizeScheduleInstanceStatus(existing.LBSK_TRANG_THAI);
    if (this.isScheduleStatusInactive(currentStatus) || currentStatus === 'finalized') {
      throw new ConflictException('Ca trực này không còn khả dụng để xác nhận.');
    }
    if (currentStatus === 'change_requested') {
      throw new ConflictException(
        'Ca trực đang có yêu cầu điều chỉnh chờ xử lý. Không thể xác nhận lúc này.',
      );
    }

    const confirmedAt = new Date();
    try {
      return await this.prisma.lICH_BSK.update({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: targetDate, B_TEN: session } },
        data: {
          LBSK_TRANG_THAI:
            currentStatus === 'adjusted'
              ? 'adjusted'
              : ('confirmed' as ScheduleInstanceStatus),
          LBSK_TRANGTHAI_DUYET: 'approved',
          LBSK_XAC_NHAN_LUC: confirmedAt,
          LBSK_CAP_NHAT_LUC: confirmedAt,
          LBSK_DUYET_BOI: actor,
          LBSK_DUYET_LUC: confirmedAt,
        },
        select: {
          BS_MA: true,
          N_NGAY: true,
          B_TEN: true,
          LBSK_TRANG_THAI: true,
          LBSK_XAC_NHAN_LUC: true,
          LBSK_CAP_NHAT_LUC: true,
        },
      });
    } catch (e) {
      if (!this.isMissingScheduleApprovalColumnsError(e)) {
        throw e;
      }
      this.logger.warn(
        'Missing schedule approval columns; using legacy confirmation fallback.',
      );
      return this.prisma.lICH_BSK.update({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: targetDate, B_TEN: session } },
        data: {
          LBSK_TRANG_THAI:
            currentStatus === 'adjusted'
              ? 'adjusted'
              : ('confirmed' as ScheduleInstanceStatus),
          LBSK_XAC_NHAN_LUC: confirmedAt,
          LBSK_CAP_NHAT_LUC: confirmedAt,
        },
        select: {
          BS_MA: true,
          N_NGAY: true,
          B_TEN: true,
          LBSK_TRANG_THAI: true,
          LBSK_XAC_NHAN_LUC: true,
          LBSK_CAP_NHAT_LUC: true,
        },
      });
    }
  }

  async createDoctorScheduleExceptionRequest(
    BS_MA: number,
    payload: {
      targetDate: string;
      targetSession: string;
      type: ScheduleExceptionType;
      reason: string;
      requestedDate?: string | null;
      requestedSession?: string | null;
      requestedRoomId?: number | null;
      suggestedDoctorId?: number | null;
    },
    actor = 'DOCTOR',
  ) {
    await this.getDoctorScheduleOwnerOrThrow(BS_MA);
    const targetDate = this.parseDateOnlyOrThrow(payload.targetDate);
    const weekStartIso = this.toDateOnlyIso(this.getWeekMondayFromDate(targetDate));
    try {
      await this.ensureWeeklySchedulesGenerated(weekStartIso, 'SYSTEM');
    } catch (e) {
      if (!this.isMissingColumnError(e)) {
        throw e;
      }
      this.logger.warn('Missing schedule columns; skip auto-generation for exception request.');
    }

    const current = await this.prisma.lICH_BSK.findUnique({
      where: {
        BS_MA_N_NGAY_B_TEN: {
          BS_MA,
          N_NGAY: targetDate,
          B_TEN: payload.targetSession,
        },
      },
      select: {
        LBSK_TRANG_THAI: true,
        LBSK_IS_ARCHIVED: true,
        P_MA: true,
      },
    });
    if (!current || current.LBSK_IS_ARCHIVED) {
      throw new NotFoundException('Không tìm thấy ca trực mục tiêu để tạo yêu cầu.');
    }

    const requestType = this.normalizeScheduleExceptionType(payload.type);
    const reason = payload.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Vui lòng nhập lý do điều chỉnh.');
    }
    if (requestType !== 'leave') {
      await this.ensureWeekNotFinalized(weekStartIso);
    }
    const currentStatus = this.normalizeScheduleInstanceStatus(current.LBSK_TRANG_THAI);
    if (this.isScheduleStatusInactive(currentStatus)) {
      throw new ConflictException('Ca trực này không còn khả dụng để gửi yêu cầu điều chỉnh.');
    }
    if (requestType !== 'leave' && currentStatus === 'finalized') {
      throw new ConflictException('Ca trực này không còn khả dụng để gửi yêu cầu điều chỉnh.');
    }

    const pendingRequest = await this.prisma.yEU_CAU_LICH_BSK.findFirst({
      where: {
        BS_MA,
        LBSK_N_NGAY: targetDate,
        LBSK_B_TEN: payload.targetSession,
        YCL_TRANG_THAI: 'pending',
      },
      select: { YCL_ID: true },
    });
    if (pendingRequest) {
      throw new ConflictException(
        'Ca trực này đã có yêu cầu điều chỉnh đang chờ xử lý.',
      );
    }

    const requestedDate = payload.requestedDate
      ? this.parseDateOnlyOrThrow(payload.requestedDate)
      : null;
    const requestedSession = payload.requestedSession?.trim() || null;
    const requestedRoomId = payload.requestedRoomId ?? null;
    const suggestedDoctorId = payload.suggestedDoctorId ?? null;

    if (requestType === 'room_change' && !requestedRoomId) {
      throw new BadRequestException('Yêu cầu đổi phòng cần chỉ định phòng mong muốn.');
    }
    if (requestType === 'shift_change') {
      if (!requestedDate || !requestedSession || !requestedRoomId) {
        throw new BadRequestException(
          'Yêu cầu đổi lịch trực cần đầy đủ ngày, buổi và phòng đề xuất.',
        );
      }
    }
    if (requestType === 'leave') {
      const hasAnyChange = Boolean(requestedDate || requestedSession || requestedRoomId);
      const hasAllChange = Boolean(requestedDate && requestedSession && requestedRoomId);
      if (hasAnyChange && !hasAllChange) {
        throw new BadRequestException(
          'Nếu đề xuất ca bù, vui lòng nhập đầy đủ ngày, buổi và phòng.',
        );
      }
    }
    if (requestedRoomId) {
      await this.validateDoctorRoomSpecialty(BS_MA, requestedRoomId);
    }
    if (requestedDate) {
      if (this.getWeekdayFromDate(requestedDate) === 0) {
        throw new BadRequestException('Không thể chọn Chủ nhật cho ca đề xuất.');
      }
      const requestedWeekStartIso = this.toDateOnlyIso(this.getWeekMondayFromDate(requestedDate));
      if (requestedWeekStartIso !== weekStartIso) {
        throw new BadRequestException(
          'Yêu cầu điều chỉnh hiện chỉ hỗ trợ đổi ca trong cùng một tuần làm việc.',
        );
      }
    }
    if (requestedDate && requestedSession && requestedRoomId) {
      if (
        this.toDateOnlyIso(requestedDate) === this.toDateOnlyIso(targetDate) &&
        requestedSession === payload.targetSession &&
        requestedRoomId === current.P_MA
      ) {
        throw new BadRequestException('Ca đề xuất không được trùng ca hiện tại.');
      }
    }

    const createdAt = new Date();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const request = await tx.yEU_CAU_LICH_BSK.create({
          data: {
            BS_MA,
            LBSK_N_NGAY: targetDate,
            LBSK_B_TEN: payload.targetSession,
            YCL_LOAI: requestType,
            YCL_LY_DO: reason,
            YCL_TRANG_THAI: 'pending',
            YCL_TRANG_THAI_TRUOC: currentStatus,
            YCL_NGAY_MOI: requestedDate,
            YCL_BUOI_MOI: requestedSession,
            YCL_P_MA_MOI: requestedRoomId,
            YCL_GOI_Y_BS_MA: suggestedDoctorId,
            YCL_TAO_BOI: actor,
            YCL_TAO_LUC: createdAt,
          },
        });

        if (requestType !== 'leave') {
          await tx.lICH_BSK.update({
            where: {
              BS_MA_N_NGAY_B_TEN: {
                BS_MA,
                N_NGAY: targetDate,
                B_TEN: payload.targetSession,
              },
            },
            data: {
              LBSK_TRANG_THAI: 'change_requested',
              LBSK_TRANGTHAI_DUYET: 'pending',
              LBSK_CAP_NHAT_LUC: createdAt,
            },
          });
        }

        return request;
      });
    } catch (e) {
      if (!this.isMissingColumnError(e)) {
        throw e;
      }
      this.logger.warn('Missing exception columns; using legacy exception create fallback.');
      const request = await this.prisma.yEU_CAU_LICH_BSK.create({
        data: {
          BS_MA,
          LBSK_N_NGAY: targetDate,
          LBSK_B_TEN: payload.targetSession,
          YCL_LOAI: requestType,
          YCL_LY_DO: reason,
          YCL_TRANG_THAI: 'pending',
          YCL_NGAY_MOI: requestedDate,
          YCL_BUOI_MOI: requestedSession,
          YCL_P_MA_MOI: requestedRoomId,
        },
      });

      if (requestType !== 'leave') {
        try {
          await this.prisma.lICH_BSK.update({
            where: {
              BS_MA_N_NGAY_B_TEN: {
                BS_MA,
                N_NGAY: targetDate,
                B_TEN: payload.targetSession,
              },
            },
            data: {
              LBSK_TRANG_THAI: 'change_requested',
              LBSK_CAP_NHAT_LUC: createdAt,
            },
          });
        } catch (updateError) {
          if (!this.isMissingColumnError(updateError)) {
            throw updateError;
          }
        }
      }

      return request;
    }
  }

  async getDoctorScheduleRegistrationOptions(BS_MA: number) {
    const doctor = await this.getDoctorScheduleOwnerOrThrow(BS_MA);
    const nextWeekMonday = this.getNextWeekMondayFromNow();
    const { saturdayEnd } = this.resolveWeekRange(this.toDateOnlyIso(nextWeekMonday));

    const [rooms, sessionRows] = await this.prisma.$transaction([
      this.prisma.pHONG.findMany({
        where: { CK_MA: doctor.CK_MA },
        select: {
          P_MA: true,
          P_TEN: true,
          CK_MA: true,
          CHUYEN_KHOA: { select: { CK_TEN: true } },
        },
        orderBy: { P_TEN: 'asc' },
      }),
      this.prisma.bUOI.findMany({
        select: { B_TEN: true, B_GIO_BAT_DAU: true, B_GIO_KET_THUC: true },
        orderBy: { B_GIO_BAT_DAU: 'asc' },
      }),
    ]);

    const sessions = sessionRows.filter((session) =>
      this.isDoctorFacingSession(session.B_TEN),
    );

    const allowedDates: Array<{ date: string; weekday: number }> = [];
    const cursor = new Date(nextWeekMonday);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor <= saturdayEnd) {
      allowedDates.push({
        date: this.toDateOnlyIso(cursor),
        weekday: this.getWeekdayFromDate(cursor),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return {
      weekStartDate: this.toDateOnlyIso(nextWeekMonday),
      weekEndDate: this.toDateOnlyIso(saturdayEnd),
      doctor: {
        BS_MA: doctor.BS_MA,
        BS_HO_TEN: doctor.BS_HO_TEN,
        CK_MA: doctor.CK_MA,
        CHUYEN_KHOA: doctor.CHUYEN_KHOA,
      },
      rooms,
      sessions,
      allowedDates,
    };
  }

  async getDoctorScheduleRegistrations(BS_MA: number, weekStartRaw?: string) {
    await this.getDoctorScheduleOwnerOrThrow(BS_MA);
    const weekStart = weekStartRaw?.trim() || this.toDateOnlyIso(this.getNextWeekMondayFromNow());
    return this.getScheduleRegistrations({
      weekStart,
      doctorId: String(BS_MA),
      page: '1',
      limit: '200',
    });
  }

  async getDoctorOfficialSchedules(BS_MA: number, weekStartRaw?: string) {
    await this.getDoctorScheduleOwnerOrThrow(BS_MA);
    const weekStart = weekStartRaw?.trim() || this.toDateOnlyIso(this.getNextWeekMondayFromNow());
    return this.getOfficialSchedules({
      weekStart,
      doctorId: String(BS_MA),
      page: '1',
      limit: '200',
    });
  }

  async getDoctorRegistrationDayContext(
    BS_MA: number,
    params?: {
      date?: string;
      roomId?: string;
      excludeDate?: string;
      excludeSession?: string;
    },
  ) {
    await this.getDoctorScheduleOwnerOrThrow(BS_MA);
    if (!params?.date?.trim()) {
      throw new BadRequestException('Vui lòng chọn ngày đăng ký.');
    }

    const targetDate = this.parseDateOnlyOrThrow(params.date.trim());
    this.assertDoctorTargetsNextWeek(targetDate, 'xem ngữ cảnh đăng ký lịch trực');

    const context = await this.getOfficialShiftFormContext({
      date: this.toDateOnlyIso(targetDate),
      roomId: params.roomId,
      doctorId: String(BS_MA),
      excludeBsMa:
        params.excludeDate?.trim() && params.excludeSession?.trim()
          ? String(BS_MA)
          : undefined,
      excludeDate: params.excludeDate,
      excludeSession: params.excludeSession,
    });

    const filteredSessionContext = context.sessionContext.filter((item) =>
      this.isDoctorFacingSession(item.session),
    );
    const availableSessions = context.availableSessions.filter((session) =>
      this.isDoctorFacingSession(session),
    );

    return {
      ...context,
      sessionContext: filteredSessionContext,
      availableSessions,
      hasAnyAvailableSession: availableSessions.length > 0,
    };
  }

  async createDoctorRegistration(BS_MA: number, payload: {
    N_NGAY: string;
    B_TEN: string;
    P_MA: number;
    LBSK_GHI_CHU?: string;
  }) {
    try {
      await this.getDoctorScheduleOwnerOrThrow(BS_MA);
      const targetDate = this.parseDateOnlyOrThrow(payload.N_NGAY);
      const targetWeekStartIso = this.assertDoctorRegistrationWindowForDate(
        targetDate,
        'đăng ký lịch trực',
      );
      const targetWeekStart = this.parseDateOnlyOrThrow(targetWeekStartIso);

      await this.ensureWeekNotFinalized(targetWeekStartIso);
      await this.ensureScheduleDateExists(targetDate);
      await this.validateDoctorRoomSpecialty(BS_MA, payload.P_MA);
      await this.upsertScheduleWeek(targetWeekStartIso, 'DOCTOR');

      return await this.prisma.lICH_BSK.create({
        data: {
          BS_MA,
          P_MA: payload.P_MA,
          N_NGAY: targetDate,
          B_TEN: payload.B_TEN,
          DLT_TUAN_BAT_DAU: targetWeekStart,
          LBSK_NGUON: 'legacy_registration',
          LBSK_TRANG_THAI: 'generated',
          LBSK_TAO_LUC: new Date(),
          LBSK_CAP_NHAT_LUC: new Date(),
          LBSK_TRANGTHAI_DUYET: 'pending',
          LBSK_GHI_CHU: payload.LBSK_GHI_CHU?.trim() || null,
          LBSK_DUYET_BOI: null,
          LBSK_DUYET_LUC: null,
        },
      });
    } catch (e) {
      if (this.isMissingScheduleApprovalColumnsError(e)) {
        const targetDate = this.parseDateOnlyOrThrow(payload.N_NGAY);
        await this.ensureScheduleDateExists(targetDate);
        return this.prisma.lICH_BSK.create({
          data: {
            BS_MA,
            P_MA: payload.P_MA,
            N_NGAY: targetDate,
            B_TEN: payload.B_TEN,
            LBSK_GHI_CHU: this.buildLegacyScheduleStatusNote(
              'pending',
              payload.LBSK_GHI_CHU,
            ),
          },
        });
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'Trùng lịch trực: bác sĩ hoặc phòng đã có lịch trong cùng ngày và buổi.',
        );
      }
      mapPrismaError(e);
    }
  }

  async updateDoctorRegistration(
    BS_MA: number,
    N_NGAY: string,
    B_TEN: string,
    payload: {
      N_NGAY: string;
      B_TEN: string;
      P_MA: number;
      LBSK_GHI_CHU?: string;
    },
  ) {
    try {
      await this.getDoctorScheduleOwnerOrThrow(BS_MA);
      const currentDate = this.parseDateOnlyOrThrow(N_NGAY);
      const nextDate = this.parseDateOnlyOrThrow(payload.N_NGAY);

      this.assertDoctorRegistrationWindowForDate(
        currentDate,
        'cập nhật đăng ký lịch trực',
      );
      const nextWeekStartIso = this.assertDoctorRegistrationWindowForDate(
        nextDate,
        'cập nhật đăng ký lịch trực',
      );
      const nextWeekStart = this.parseDateOnlyOrThrow(nextWeekStartIso);

      await this.ensureWeekNotFinalized(nextWeekStartIso);

      const existing = await this.prisma.lICH_BSK.findUnique({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: currentDate, B_TEN } },
      });
      if (!existing) {
        throw new NotFoundException('Không tìm thấy đăng ký lịch trực cần cập nhật.');
      }
      if (existing.LBSK_DUYET_BOI === 'ADMIN_MANUAL') {
        throw new ConflictException(
          'Ca trực này là lịch chính thức, bác sĩ không thể tự chỉnh sửa.',
        );
      }

      await this.ensureScheduleDateExists(nextDate);
      await this.validateDoctorRoomSpecialty(BS_MA, payload.P_MA);
      await this.upsertScheduleWeek(nextWeekStartIso, 'DOCTOR');

      return await this.prisma.lICH_BSK.update({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: currentDate, B_TEN } },
        data: {
          P_MA: payload.P_MA,
          N_NGAY: nextDate,
          B_TEN: payload.B_TEN,
          DLT_TUAN_BAT_DAU: nextWeekStart,
          LBSK_NGUON: 'legacy_registration',
          LBSK_TRANG_THAI: 'generated',
          LBSK_TRANGTHAI_DUYET: 'pending',
          LBSK_GHI_CHU: payload.LBSK_GHI_CHU?.trim() || null,
          LBSK_DUYET_BOI: null,
          LBSK_DUYET_LUC: null,
          LBSK_XAC_NHAN_LUC: null,
          LBSK_CAP_NHAT_LUC: new Date(),
        },
      });
    } catch (e) {
      if (this.isMissingScheduleApprovalColumnsError(e)) {
        const currentDate = this.parseDateOnlyOrThrow(N_NGAY);
        const nextDate = this.parseDateOnlyOrThrow(payload.N_NGAY);
        const existingLegacy = await this.prisma.lICH_BSK.findUnique({
          where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: currentDate, B_TEN } },
          select: {
            LBSK_GHI_CHU: true,
          },
        });
        if (!existingLegacy) {
          throw new NotFoundException('Không tìm thấy đăng ký lịch trực cần cập nhật.');
        }
        const parsed = this.parseLegacyScheduleStatus(existingLegacy.LBSK_GHI_CHU);
        if (parsed.status === 'official') {
          throw new ConflictException(
            'Ca trực này là lịch chính thức, bác sĩ không thể tự chỉnh sửa.',
          );
        }
        return this.prisma.lICH_BSK.update({
          where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: currentDate, B_TEN } },
          data: {
            P_MA: payload.P_MA,
            N_NGAY: nextDate,
            B_TEN: payload.B_TEN,
            LBSK_GHI_CHU: this.buildLegacyScheduleStatusNote(
              'pending',
              payload.LBSK_GHI_CHU,
            ),
          },
        });
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'Trùng lịch trực: bác sĩ hoặc phòng đã có lịch trong cùng ngày và buổi.',
        );
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'Không thể cập nhật đăng ký này vì đã có dữ liệu liên quan.',
        );
      }
      mapPrismaError(e);
    }
  }

  async cancelDoctorRegistration(BS_MA: number, N_NGAY: string, B_TEN: string) {
    try {
      await this.getDoctorScheduleOwnerOrThrow(BS_MA);
      const currentDate = this.parseDateOnlyOrThrow(N_NGAY);
      const targetWeekStartIso = this.assertDoctorRegistrationWindowForDate(
        currentDate,
        'hủy đăng ký lịch trực',
      );
      await this.ensureWeekNotFinalized(targetWeekStartIso);

      const existing = await this.prisma.lICH_BSK.findUnique({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: currentDate, B_TEN } },
      });
      if (!existing) {
        throw new NotFoundException('Không tìm thấy đăng ký lịch trực cần hủy.');
      }
      if (existing.LBSK_DUYET_BOI === 'ADMIN_MANUAL') {
        throw new ConflictException(
          'Ca trực này là lịch chính thức, bác sĩ không thể tự hủy.',
        );
      }

      await this.prisma.lICH_BSK.delete({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: currentDate, B_TEN } },
      });
      return { message: 'Hủy đăng ký lịch trực thành công' };
    } catch (e) {
      if (this.isMissingScheduleApprovalColumnsError(e)) {
        const currentDate = this.parseDateOnlyOrThrow(N_NGAY);
        const existingLegacy = await this.prisma.lICH_BSK.findUnique({
          where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: currentDate, B_TEN } },
          select: {
            LBSK_GHI_CHU: true,
          },
        });
        if (!existingLegacy) {
          throw new NotFoundException('Không tìm thấy đăng ký lịch trực cần hủy.');
        }
        const parsed = this.parseLegacyScheduleStatus(existingLegacy.LBSK_GHI_CHU);
        if (parsed.status === 'official') {
          throw new ConflictException(
            'Ca trực này là lịch chính thức, bác sĩ không thể tự hủy.',
          );
        }

        await this.prisma.lICH_BSK.delete({
          where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: currentDate, B_TEN } },
        });
        return { message: 'Hủy đăng ký lịch trực thành công' };
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'Không thể hủy đăng ký này vì đã có dữ liệu liên quan.',
        );
      }
      mapPrismaError(e);
    }
  }

  private async getScheduleCycleOverviewLegacy(weekStartRaw?: string) {
    const { mondayStart, saturdayEnd, weekStartIso, weekEndIso } =
      this.resolveWeekRange(weekStartRaw);
    const now = new Date();
    const registrationOpenAt = new Date(mondayStart);
    registrationOpenAt.setUTCDate(mondayStart.getUTCDate() - 7);
    registrationOpenAt.setUTCHours(0, 0, 0, 0);
    const registrationCloseAt = new Date(mondayStart);
    registrationCloseAt.setUTCDate(mondayStart.getUTCDate() - 2);
    registrationCloseAt.setUTCHours(23, 59, 59, 999);
    const adminReviewWindowEndAt = new Date(mondayStart);
    adminReviewWindowEndAt.setUTCDate(mondayStart.getUTCDate() - 1);
    adminReviewWindowEndAt.setUTCHours(23, 59, 59, 999);

    const [schedules, sessions] = await this.prisma.$transaction([
      this.prisma.lICH_BSK.findMany({
        where: {
          N_NGAY: {
            gte: mondayStart,
            lte: saturdayEnd,
          },
        },
        select: {
          N_NGAY: true,
          B_TEN: true,
          LBSK_GHI_CHU: true,
        },
      }),
      this.prisma.bUOI.findMany({
        select: { B_TEN: true },
        orderBy: { B_GIO_BAT_DAU: 'asc' },
      }),
    ]);

    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let officialCandidateCount = 0;
    const approvedSchedules: Array<{ N_NGAY: Date; B_TEN: string }> = [];
    for (const schedule of schedules) {
      const parsed = this.parseLegacyScheduleStatus(schedule.LBSK_GHI_CHU);
      if (parsed.status === 'pending') {
        pending += 1;
      } else if (parsed.status === 'rejected') {
        rejected += 1;
      } else {
        approved += 1;
        officialCandidateCount += 1;
        approvedSchedules.push({ N_NGAY: schedule.N_NGAY, B_TEN: schedule.B_TEN });
      }
    }

    const [finalizedLog, generatedLog] = await this.prisma.$transaction([
      this.prisma.aUDIT_LOG.findFirst({
        where: {
          AL_TABLE: 'SCHEDULE_CYCLE',
          AL_ACTION: 'FINALIZED',
          AL_PK: {
            equals: { weekStart: weekStartIso },
          },
        },
        orderBy: { AL_CHANGED_AT: 'desc' },
      }),
      this.prisma.aUDIT_LOG.findFirst({
        where: {
          AL_TABLE: 'SCHEDULE_CYCLE',
          AL_ACTION: 'SLOTS_GENERATED',
          AL_PK: {
            equals: { weekStart: weekStartIso },
          },
        },
        orderBy: { AL_CHANGED_AT: 'desc' },
      }),
    ]);

    const cycleStatus =
      finalizedLog != null ? 'finalized' : now <= registrationCloseAt ? 'open' : 'locked';
    const official = finalizedLog != null ? officialCandidateCount : 0;
    const missingShifts = this.buildMissingShiftSummary({
      mondayStart,
      saturdayEnd,
      sessions: sessions.map((session) => session.B_TEN),
      approvedSchedules,
    });

    return {
      weekStartDate: weekStartIso,
      weekEndDate: weekEndIso,
      registrationOpenAt: registrationOpenAt.toISOString(),
      registrationCloseAt: registrationCloseAt.toISOString(),
      adminReviewWindowEndAt: adminReviewWindowEndAt.toISOString(),
      status: cycleStatus,
      workflowStatus: cycleStatus,
      finalizedAt: finalizedLog?.AL_CHANGED_AT || null,
      slotGeneratedAt: generatedLog?.AL_CHANGED_AT || null,
      summary: {
        total: schedules.length,
        pending,
        approved,
        rejected,
        official,
        generated: 0,
        confirmed: approved,
        changeRequested: 0,
        adjusted: 0,
        finalized: official,
        cancelled: rejected,
        pendingExceptions: 0,
        approvedExceptions: 0,
        rejectedExceptions: 0,
      },
      missingShifts,
    };
  }

  private async getScheduleRegistrationsLegacy(
    params?: {
      weekStart?: string;
      page?: string;
      limit?: string;
      specialtyId?: string;
      doctorId?: string;
      roomId?: string;
      status?: string;
      session?: string;
      date?: string;
      search?: string;
    },
  ) {
    const rawPage = Number.parseInt(params?.page || '1', 10);
    const rawLimit = Number.parseInt(params?.limit || '10', 10);
    const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
    const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 100);
    const parsedDoctorId = Number.parseInt(params?.doctorId || '', 10);
    const parsedRoomId = Number.parseInt(params?.roomId || '', 10);
    const parsedSpecialtyId = Number.parseInt(params?.specialtyId || '', 10);
    const doctorId = Number.isNaN(parsedDoctorId) ? undefined : parsedDoctorId;
    const roomId = Number.isNaN(parsedRoomId) ? undefined : parsedRoomId;
    const specialtyId = Number.isNaN(parsedSpecialtyId)
      ? undefined
      : parsedSpecialtyId;
    const status = (params?.status || 'all').trim().toLowerCase();
    const session = params?.session?.trim() || undefined;
    const search = params?.search?.trim().toLowerCase() || '';
    const dateFilter = params?.date?.trim() || undefined;
    const { mondayStart, saturdayEnd, weekStartIso } = this.resolveWeekRange(
      params?.weekStart,
    );

    const where: Prisma.LICH_BSKWhereInput = {
      N_NGAY: { gte: mondayStart, lte: saturdayEnd },
      ...(doctorId ? { BS_MA: doctorId } : {}),
      ...(roomId ? { P_MA: roomId } : {}),
      ...(session ? { B_TEN: session } : {}),
      ...(specialtyId ? { BAC_SI: { CK_MA: specialtyId } } : {}),
      ...(dateFilter ? { N_NGAY: new Date(dateFilter) } : {}),
    };

    const allRows = await this.prisma.lICH_BSK.findMany({
      where,
      select: {
        BS_MA: true,
        N_NGAY: true,
        B_TEN: true,
        P_MA: true,
        LBSK_GHI_CHU: true,
        BAC_SI: {
          select: {
            BS_MA: true,
            BS_HO_TEN: true,
            CK_MA: true,
            CHUYEN_KHOA: { select: { CK_TEN: true } },
          },
        },
        PHONG: {
          select: {
            P_MA: true,
            P_TEN: true,
            CK_MA: true,
            CHUYEN_KHOA: { select: { CK_TEN: true } },
          },
        },
      },
      orderBy: [{ N_NGAY: 'asc' }, { B_TEN: 'asc' }, { BS_MA: 'asc' }],
    });

    const mapped = allRows
      .flatMap((row) => {
        const parsed = this.parseLegacyScheduleStatus(row.LBSK_GHI_CHU);
        if (parsed.status === 'official') {
          return [];
        }
        return [
          {
            BS_MA: row.BS_MA,
            N_NGAY: row.N_NGAY,
            B_TEN: row.B_TEN,
            P_MA: row.P_MA,
            status: parsed.status,
            note: parsed.note,
            doctor: row.BAC_SI,
            room: row.PHONG,
            submittedAt: null as string | null,
            reviewedBy: null as string | null,
            reviewedAt: null as string | null,
          },
        ];
      })
      .filter((row) => (status === 'all' ? true : row.status === status))
      .filter((row) =>
        search.length === 0
          ? true
          : row.doctor.BS_HO_TEN.toLowerCase().includes(search) ||
            row.doctor.BS_MA.toString().includes(search),
      );

    const total = mapped.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const items = mapped.slice(offset, offset + limit);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages,
        weekStart: weekStartIso,
      },
    };
  }

  private async getOfficialSchedulesLegacy(
    params?: {
      weekStart?: string;
      page?: string;
      limit?: string;
      specialtyId?: string;
      doctorId?: string;
      roomId?: string;
      status?: string;
      session?: string;
      weekday?: string;
      date?: string;
      search?: string;
    },
  ) {
    const rawPage = Number.parseInt(params?.page || '1', 10);
    const rawLimit = Number.parseInt(params?.limit || '10', 10);
    const page = Number.isNaN(rawPage) ? 1 : Math.max(rawPage, 1);
    const limit = Number.isNaN(rawLimit) ? 10 : Math.min(Math.max(rawLimit, 1), 100);
    const parsedDoctorId = Number.parseInt(params?.doctorId || '', 10);
    const parsedRoomId = Number.parseInt(params?.roomId || '', 10);
    const parsedSpecialtyId = Number.parseInt(params?.specialtyId || '', 10);
    const doctorId = Number.isNaN(parsedDoctorId) ? undefined : parsedDoctorId;
    const roomId = Number.isNaN(parsedRoomId) ? undefined : parsedRoomId;
    const specialtyId = Number.isNaN(parsedSpecialtyId) ? undefined : parsedSpecialtyId;
    const status = (params?.status || 'all').trim().toLowerCase();
    const session = params?.session?.trim() || undefined;
    const parsedWeekday = Number.parseInt(params?.weekday || '', 10);
    const weekday =
      Number.isNaN(parsedWeekday) || parsedWeekday < 0 || parsedWeekday > 6
        ? undefined
        : parsedWeekday;
    const search = params?.search?.trim().toLowerCase() || '';
    const dateFilter = params?.date?.trim() || undefined;
    const { mondayStart, saturdayEnd, weekStartIso } = this.resolveWeekRange(
      params?.weekStart,
    );

    const where: Prisma.LICH_BSKWhereInput = {
      N_NGAY: { gte: mondayStart, lte: saturdayEnd },
      ...(doctorId ? { BS_MA: doctorId } : {}),
      ...(roomId ? { P_MA: roomId } : {}),
      ...(session ? { B_TEN: session } : {}),
      ...(specialtyId ? { BAC_SI: { CK_MA: specialtyId } } : {}),
      ...(dateFilter ? { N_NGAY: new Date(dateFilter) } : {}),
    };

    const [allRows, finalizedLog] = await this.prisma.$transaction([
      this.prisma.lICH_BSK.findMany({
        where,
        select: {
          BS_MA: true,
          N_NGAY: true,
          B_TEN: true,
          P_MA: true,
          LBSK_GHI_CHU: true,
          BAC_SI: {
            select: {
              BS_MA: true,
              BS_HO_TEN: true,
              CK_MA: true,
              CHUYEN_KHOA: { select: { CK_TEN: true } },
            },
          },
          PHONG: {
            select: {
              P_MA: true,
              P_TEN: true,
              CK_MA: true,
              CHUYEN_KHOA: { select: { CK_TEN: true } },
            },
          },
          BUOI: {
            select: {
              B_TEN: true,
              KHUNG_GIO: {
                select: { KG_MA: true, KG_SO_BN_TOI_DA: true },
              },
            },
          },
        },
        orderBy: [{ N_NGAY: 'asc' }, { B_TEN: 'asc' }, { BS_MA: 'asc' }],
      }),
      this.prisma.aUDIT_LOG.findFirst({
        where: {
          AL_TABLE: 'SCHEDULE_CYCLE',
          AL_ACTION: 'FINALIZED',
          AL_PK: { equals: { weekStart: weekStartIso } },
        },
        orderBy: { AL_CHANGED_AT: 'desc' },
      }),
    ]);

    const displayStatus = this.resolveOfficialShiftDisplayStatus(Boolean(finalizedLog));
    const mapped = allRows
      .flatMap((row) => {
        const parsed = this.parseLegacyScheduleStatus(row.LBSK_GHI_CHU);
        if (parsed.status === 'pending' || parsed.status === 'rejected') {
          return [];
        }
        const rowStatus: OfficialShiftDisplayStatus =
          parsed.status === 'official' ? 'official' : displayStatus;
        return [
          {
            BS_MA: row.BS_MA,
            N_NGAY: row.N_NGAY,
            B_TEN: row.B_TEN,
            P_MA: row.P_MA,
            status: rowStatus,
            note: parsed.note,
            doctor: row.BAC_SI,
            room: row.PHONG,
            slotCount: row.BUOI?.KHUNG_GIO?.length ?? 0,
            slotMax: this.resolveSlotMax(row.BUOI?.KHUNG_GIO),
          },
        ];
      })
      .filter((row) => (status === 'all' ? true : row.status === status))
      .filter((row) =>
        weekday === undefined ? true : this.getWeekdayFromDate(row.N_NGAY) === weekday,
      )
      .filter((row) =>
        search.length === 0
          ? true
          : row.doctor.BS_HO_TEN.toLowerCase().includes(search) ||
            row.doctor.BS_MA.toString().includes(search),
      );

    const total = mapped.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const items = mapped.slice(offset, offset + limit);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages,
        weekStart: weekStartIso,
      },
    };
  }

  private async updateScheduleRegistrationStatusLegacy(
    BS_MA: number,
    N_NGAY: string,
    B_TEN: string,
    payload: { status: 'approved' | 'rejected'; adminNote?: string },
  ) {
    const targetDate = this.parseDateOnlyOrThrow(N_NGAY);
    const targetWeekStart = this.getWeekMondayFromDate(targetDate);
    const targetWeekStartIso = this.toDateOnlyIso(targetWeekStart);
    this.assertAdminSundayActionForWeek(
      targetWeekStart,
      'duyệt hoặc từ chối đăng ký lịch trực',
    );
    await this.ensureWeekNotFinalized(targetWeekStartIso);

    const existing = await this.prisma.lICH_BSK.findUnique({
      where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: targetDate, B_TEN } },
      select: {
        BS_MA: true,
        P_MA: true,
        N_NGAY: true,
        B_TEN: true,
        LBSK_GHI_CHU: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Không tìm thấy ca đăng ký cần cập nhật');
    }

    const currentParsed = this.parseLegacyScheduleStatus(existing.LBSK_GHI_CHU);
    if (currentParsed.status === 'official') {
      throw new ConflictException(
        'Ca trực này là ca chính thức do admin tạo thủ công, không thuộc luồng duyệt đăng ký.',
      );
    }
    if (currentParsed.status !== 'pending') {
      throw new ConflictException(
        'Chỉ có thể duyệt hoặc từ chối khi đăng ký đang ở trạng thái chờ duyệt.',
      );
    }

    const nextStatus = this.normalizeApprovalStatus(payload.status);
    if (nextStatus === 'approved') {
      await this.validateDoctorRoomSpecialty(existing.BS_MA, existing.P_MA);
      await this.assertNoApprovalConflictsLegacy({
        BS_MA: existing.BS_MA,
        P_MA: existing.P_MA,
        N_NGAY: targetDate,
        B_TEN,
        currentKey: { BS_MA: existing.BS_MA, N_NGAY: targetDate, B_TEN },
      });
    }

    const mergedNote = this.mergeAdminNote(currentParsed.note, payload.adminNote);

    return await this.prisma.lICH_BSK.update({
      where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: targetDate, B_TEN } },
      data: {
        LBSK_GHI_CHU: this.buildLegacyScheduleStatusNote(nextStatus, mergedNote),
      },
    });
  }

  private async createOfficialScheduleLegacy(payload: {
    BS_MA: number;
    P_MA: number;
    N_NGAY: string;
    B_TEN: string;
    note?: string;
    status?: OfficialShiftDisplayStatus;
  }) {
    const targetDate = this.parseDateOnlyOrThrow(payload.N_NGAY);
    this.validateScheduleDateForAdmin(targetDate);
    await this.ensureScheduleDateExists(targetDate);
    const targetWeekStart = this.getWeekMondayFromDate(targetDate);
    this.assertAdminSundayActionForWeek(targetWeekStart, 'điều chỉnh lịch trực tuần');
    await this.ensureWeekNotFinalized(this.toDateOnlyIso(targetWeekStart));
    await this.validateDoctorRoomSpecialty(payload.BS_MA, payload.P_MA);
    await this.assertNoOfficialShiftOccupancyConflicts({
      BS_MA: payload.BS_MA,
      P_MA: payload.P_MA,
      N_NGAY: targetDate,
      B_TEN: payload.B_TEN,
    });

    const status: ScheduleApprovalStatus | 'official' =
      payload.status === 'official' ? 'official' : 'approved';

    const note = this.buildLegacyScheduleStatusNote(status, payload.note);
    const client = this.prisma.getClient();
    const dateOnly = this.toDateOnlyIso(targetDate);

    try {
      const createdWithStatus = await client.$queryRaw<
        Array<{
          BS_MA: number;
          P_MA: number;
          N_NGAY: Date;
          B_TEN: string;
          LBSK_GHI_CHU: string | null;
        }>
      >(Prisma.sql`
        INSERT INTO "LICH_BSK"
          ("BS_MA", "P_MA", "N_NGAY", "B_TEN", "LBSK_TRANGTHAI_DUYET", "LBSK_GHI_CHU")
        VALUES
          (${payload.BS_MA}, ${payload.P_MA}, ${dateOnly}, ${payload.B_TEN}, ${null}, ${note})
        RETURNING "BS_MA", "P_MA", "N_NGAY", "B_TEN", "LBSK_GHI_CHU"
      `);
      return createdWithStatus[0];
    } catch (e) {
      const haystack = `${(e as any)?.message || ''} ${JSON.stringify((e as any)?.meta || {})}`.toLowerCase();
      const missingStatusColumn =
        haystack.includes('lbsk_trangthai_duyet') &&
        (haystack.includes('does not exist') || haystack.includes('columnnotfound'));
      if (!missingStatusColumn) {
        this.rethrowOfficialShiftLegacyWriteError(e);
      }
    }

    try {
      const createdWithoutStatus = await client.$queryRaw<
        Array<{
          BS_MA: number;
          P_MA: number;
          N_NGAY: Date;
          B_TEN: string;
          LBSK_GHI_CHU: string | null;
        }>
      >(Prisma.sql`
        INSERT INTO "LICH_BSK"
          ("BS_MA", "P_MA", "N_NGAY", "B_TEN", "LBSK_GHI_CHU")
        VALUES
          (${payload.BS_MA}, ${payload.P_MA}, ${dateOnly}, ${payload.B_TEN}, ${note})
        RETURNING "BS_MA", "P_MA", "N_NGAY", "B_TEN", "LBSK_GHI_CHU"
      `);
      return createdWithoutStatus[0];
    } catch (e) {
      this.rethrowOfficialShiftLegacyWriteError(e);
    }
  }

  private async updateOfficialScheduleLegacy(
    BS_MA: number,
    N_NGAY: string,
    B_TEN: string,
    payload: {
      BS_MA?: number;
      P_MA?: number;
      N_NGAY?: string;
      B_TEN?: string;
      note?: string;
      status?: OfficialShiftDisplayStatus;
    },
  ) {
    const oldDate = this.parseDateOnlyOrThrow(N_NGAY);
    const existing = await this.prisma.lICH_BSK.findUnique({
      where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: oldDate, B_TEN } },
      select: {
        BS_MA: true,
        P_MA: true,
        N_NGAY: true,
        B_TEN: true,
        LBSK_GHI_CHU: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy ca trực cần cập nhật');
    }

    const nextDoctorId = payload.BS_MA ?? BS_MA;
    const nextRoomId = payload.P_MA ?? existing.P_MA;
    const nextDate = payload.N_NGAY
      ? this.parseDateOnlyOrThrow(payload.N_NGAY)
      : oldDate;
    const nextSession = payload.B_TEN ?? B_TEN;
    const currentParsed = this.parseLegacyScheduleStatus(existing.LBSK_GHI_CHU);
    const noteFromCurrent = currentParsed.note || '';
    const nextNote = payload.note ?? noteFromCurrent;
    const nextStatus: ScheduleApprovalStatus | 'official' =
      payload.status === 'official' ? 'official' : 'approved';

    this.validateScheduleDateForAdmin(nextDate);
    await this.ensureScheduleDateExists(nextDate);
    const nextWeekStart = this.getWeekMondayFromDate(nextDate);
    this.assertAdminSundayActionForWeek(nextWeekStart, 'điều chỉnh lịch trực tuần');
    await this.ensureWeekNotFinalized(this.toDateOnlyIso(nextWeekStart));
    await this.validateDoctorRoomSpecialty(nextDoctorId, nextRoomId);
    await this.assertNoOfficialShiftOccupancyConflicts({
      BS_MA: nextDoctorId,
      P_MA: nextRoomId,
      N_NGAY: nextDate,
      B_TEN: nextSession,
      currentKey: { BS_MA, N_NGAY: oldDate, B_TEN },
    });

    return await this.prisma.lICH_BSK.update({
      where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: oldDate, B_TEN } },
      data: {
        BS_MA: nextDoctorId,
        P_MA: nextRoomId,
        N_NGAY: nextDate,
        B_TEN: nextSession,
        LBSK_GHI_CHU: this.buildLegacyScheduleStatusNote(nextStatus, nextNote),
      },
      select: {
        BS_MA: true,
        P_MA: true,
        N_NGAY: true,
        B_TEN: true,
        LBSK_GHI_CHU: true,
      },
    });
  }
  async createOfficialSchedule(payload: {
    BS_MA: number;
    P_MA: number;
    N_NGAY: string;
    B_TEN: string;
    note?: string;
    status?: OfficialShiftDisplayStatus;
  }) {
    try {
      const targetDate = this.parseDateOnlyOrThrow(payload.N_NGAY);
      this.validateScheduleDateForAdmin(targetDate);
      await this.ensureScheduleDateExists(targetDate);
      const targetWeekStart = this.getWeekMondayFromDate(targetDate);
      const targetWeekStartIso = this.toDateOnlyIso(targetWeekStart);
      this.assertAdminSundayActionForWeek(targetWeekStart, 'điều chỉnh lịch trực tuần');
      await this.ensureWeekNotFinalized(targetWeekStartIso);
      await this.validateDoctorRoomSpecialty(payload.BS_MA, payload.P_MA);
      await this.assertNoOfficialShiftOccupancyConflicts({
        BS_MA: payload.BS_MA,
        P_MA: payload.P_MA,
        N_NGAY: targetDate,
        B_TEN: payload.B_TEN,
      });
      await this.upsertScheduleWeek(targetWeekStartIso, 'ADMIN');

      const scheduleStatus =
        payload.status === 'official' ? 'finalized' : ('adjusted' as ScheduleInstanceStatus);

      const archivedCandidates = await this.prisma.lICH_BSK.findMany({
        where: {
          N_NGAY: targetDate,
          B_TEN: payload.B_TEN,
          LBSK_IS_ARCHIVED: true,
          OR: [{ BS_MA: payload.BS_MA }, { P_MA: payload.P_MA }],
        },
        select: { BS_MA: true, N_NGAY: true, B_TEN: true },
      });
      if (archivedCandidates.length > 1) {
        throw new ConflictException(
          'Đang tồn tại nhiều ca archive trùng ngày/buổi, vui lòng dọn dữ liệu trước khi tạo mới.',
        );
      }
      if (archivedCandidates.length === 1) {
        const archived = archivedCandidates[0];
        return await this.prisma.lICH_BSK.update({
          where: {
            BS_MA_N_NGAY_B_TEN: {
              BS_MA: archived.BS_MA,
              N_NGAY: archived.N_NGAY,
              B_TEN: archived.B_TEN,
            },
          },
          data: {
            BS_MA: payload.BS_MA,
            P_MA: payload.P_MA,
            N_NGAY: targetDate,
            B_TEN: payload.B_TEN,
            DLT_TUAN_BAT_DAU: targetWeekStart,
            LBM_ID: null,
            LBSK_NGUON: 'admin_manual',
            LBSK_TRANG_THAI: scheduleStatus,
            LBSK_TAO_LUC: new Date(),
            LBSK_CAP_NHAT_LUC: new Date(),
            LBSK_XAC_NHAN_LUC: new Date(),
            LBSK_TRANGTHAI_DUYET: 'approved',
            LBSK_GHI_CHU: payload.note?.trim() || null,
            LBSK_DUYET_BOI: 'ADMIN_MANUAL',
            LBSK_DUYET_LUC: new Date(),
            LBSK_IS_ARCHIVED: false,
            LBSK_ARCHIVED_AT: null,
            LBSK_ARCHIVED_BY: null,
            LBSK_ARCHIVE_REASON: null,
          },
        });
      }

      return await this.prisma.lICH_BSK.create({
        data: {
          BS_MA: payload.BS_MA,
          P_MA: payload.P_MA,
          N_NGAY: targetDate,
          B_TEN: payload.B_TEN,
          DLT_TUAN_BAT_DAU: targetWeekStart,
          LBSK_NGUON: 'admin_manual',
          LBSK_TRANG_THAI: scheduleStatus,
          LBSK_TAO_LUC: new Date(),
          LBSK_CAP_NHAT_LUC: new Date(),
          LBSK_XAC_NHAN_LUC: new Date(),
          LBSK_TRANGTHAI_DUYET: 'approved',
          LBSK_GHI_CHU: payload.note?.trim() || null,
          LBSK_DUYET_BOI: 'ADMIN_MANUAL',
          LBSK_DUYET_LUC: new Date(),
        },
      });
    } catch (e) {
      if (this.isMissingScheduleApprovalColumnsError(e)) {
        this.logger.warn(
          'Missing schedule approval columns; using legacy official shift create fallback.',
        );
        return this.createOfficialScheduleLegacy(payload);
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'Trùng lịch trực: bác sĩ hoặc phòng đã có lịch trong cùng ngày và buổi.',
        );
      }
      mapPrismaError(e);
    }
  }
  async updateOfficialSchedule(
    BS_MA: number,
    N_NGAY: string,
    B_TEN: string,
    payload: {
      BS_MA?: number;
      P_MA?: number;
      N_NGAY?: string;
      B_TEN?: string;
      note?: string;
      status?: OfficialShiftDisplayStatus;
    },
  ) {
    try {
      const oldDate = this.parseDateOnlyOrThrow(N_NGAY);
      const existing = await this.prisma.lICH_BSK.findUnique({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: oldDate, B_TEN } },
      });
      if (!existing || existing.LBSK_IS_ARCHIVED) {
        throw new NotFoundException('Không tìm thấy ca trực cần cập nhật');
      }
      if (
        this.normalizeScheduleInstanceStatus(existing.LBSK_TRANG_THAI) ===
        'cancelled_by_doctor_leave'
      ) {
        throw new ConflictException(
          'Ca trực đã hủy do bác sĩ nghỉ, không thể thay thế bác sĩ khác.',
        );
      }

      const nextDoctorId = payload.BS_MA ?? BS_MA;
      const nextRoomId = payload.P_MA ?? existing.P_MA;
      const nextDate = payload.N_NGAY
        ? this.parseDateOnlyOrThrow(payload.N_NGAY)
        : oldDate;
      const nextSession = payload.B_TEN ?? B_TEN;
      const nextNote = payload.note ?? existing.LBSK_GHI_CHU ?? undefined;

      this.validateScheduleDateForAdmin(nextDate);
      await this.ensureScheduleDateExists(nextDate);
      const nextWeekStart = this.getWeekMondayFromDate(nextDate);
      const nextWeekStartIso = this.toDateOnlyIso(nextWeekStart);
      this.assertAdminSundayActionForWeek(nextWeekStart, 'điều chỉnh lịch trực tuần');
      await this.ensureWeekNotFinalized(nextWeekStartIso);
      await this.validateDoctorRoomSpecialty(nextDoctorId, nextRoomId);
      await this.assertNoOfficialShiftOccupancyConflicts({
        BS_MA: nextDoctorId,
        P_MA: nextRoomId,
        N_NGAY: nextDate,
        B_TEN: nextSession,
        currentKey: { BS_MA, N_NGAY: oldDate, B_TEN },
      });
      await this.upsertScheduleWeek(nextWeekStartIso, 'ADMIN');

      const nextScheduleStatus =
        payload.status === 'official'
          ? 'finalized'
          : ('adjusted' as ScheduleInstanceStatus);

      return await this.prisma.lICH_BSK.update({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: oldDate, B_TEN } },
        data: {
          BS_MA: nextDoctorId,
          P_MA: nextRoomId,
          N_NGAY: nextDate,
          B_TEN: nextSession,
          DLT_TUAN_BAT_DAU: nextWeekStart,
          LBSK_NGUON: 'admin_manual',
          LBSK_TRANG_THAI: nextScheduleStatus,
          LBSK_TRANGTHAI_DUYET: 'approved',
          LBSK_GHI_CHU: nextNote,
          LBSK_CAP_NHAT_LUC: new Date(),
          LBSK_DUYET_BOI: existing.LBSK_DUYET_BOI || 'ADMIN_MANUAL',
          LBSK_DUYET_LUC: new Date(),
        },
      });
    } catch (e) {
      if (this.isMissingScheduleApprovalColumnsError(e)) {
        this.logger.warn(
          'Missing schedule approval columns; using legacy official shift update fallback.',
        );
        return this.updateOfficialScheduleLegacy(BS_MA, N_NGAY, B_TEN, payload);
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'Trùng lịch trực: bác sĩ hoặc phòng đã có lịch trong cùng ngày và buổi.',
        );
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'Không thể sửa ca trực này vì đã có lịch hẹn bệnh nhân liên quan.',
        );
      }
      mapPrismaError(e);
    }
  }
  async deleteOfficialSchedule(BS_MA: number, N_NGAY: string, B_TEN: string) {
    try {
      const targetDate = this.parseDateOnlyOrThrow(N_NGAY);
      const existing = await this.prisma.lICH_BSK.findUnique({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: targetDate, B_TEN } },
        select: { LBSK_TRANG_THAI: true, LBSK_IS_ARCHIVED: true },
      });
      if (!existing || existing.LBSK_IS_ARCHIVED) {
        throw new NotFoundException('Không tìm thấy ca trực cần xóa');
      }
      if (
        this.normalizeScheduleInstanceStatus(existing.LBSK_TRANG_THAI) ===
        'cancelled_by_doctor_leave'
      ) {
        throw new ConflictException(
          'Ca trực đã hủy do bác sĩ nghỉ, không thể xóa.',
        );
      }
      const targetWeekStart = this.getWeekMondayFromDate(targetDate);
      this.assertAdminSundayActionForWeek(targetWeekStart, 'điều chỉnh lịch trực tuần');
      await this.ensureWeekNotFinalized(this.toDateOnlyIso(targetWeekStart));
      await this.prisma.lICH_BSK.delete({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: targetDate, B_TEN } },
      });
      return { message: 'Xóa ca trực thành công' };
    } catch (e) {
      if (this.isMissingScheduleApprovalColumnsError(e)) {
        this.logger.warn(
          'Missing schedule approval columns; using legacy official shift delete fallback.',
        );
        const targetDate = this.parseDateOnlyOrThrow(N_NGAY);
        return this.deleteOfficialScheduleLegacy(BS_MA, targetDate, B_TEN);
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'Không thể xóa ca trực này vì đã có lịch hẹn bệnh nhân liên quan.',
        );
      }
      mapPrismaError(e);
    }
  }

  private async deleteOfficialScheduleLegacy(
    BS_MA: number,
    targetDate: Date,
    B_TEN: string,
  ) {
    const client = this.prisma.getClient();
    const dateOnly = this.toDateOnlyIso(targetDate);

    try {
      const deleted = await client.$queryRaw<
        Array<{ BS_MA: number }>
      >(Prisma.sql`
        DELETE FROM "LICH_BSK"
        WHERE "BS_MA" = ${BS_MA}
          AND "N_NGAY" = ${dateOnly}
          AND "B_TEN" = ${B_TEN}
        RETURNING "BS_MA"
      `);
      if (deleted.length === 0) {
        throw new NotFoundException('Không tìm thấy ca trực cần xóa');
      }
      return { message: 'Xóa ca trực thành công' };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        this.isRawForeignKeyViolation(e)
      ) {
        throw new ConflictException(
          'Không thể xóa ca trực này vì đã có lịch hẹn bệnh nhân liên quan.',
        );
      }
      mapPrismaError(e);
    }
  }

    async finalizeScheduleWeek(
    weekStartRaw: string,
    options?: { forceRefinalize?: boolean; generateSlots?: boolean; forceRegenerate?: boolean },
  ) {
    try {
      const { mondayStart, saturdayEnd, weekStartIso } = this.resolveWeekRange(
        weekStartRaw,
      );
      await this.ensureWeeklySchedulesGenerated(weekStartIso, 'SYSTEM');
      this.assertAdminSundayActionForWeek(mondayStart, 'chốt lịch trực tuần');
      const batch = await this.getScheduleWeekOrThrow(weekStartIso);
      if (
        !options?.forceRefinalize &&
        (this.normalizeScheduleWeekStatus(batch.DLT_TRANG_THAI) === 'finalized' ||
          this.normalizeScheduleWeekStatus(batch.DLT_TRANG_THAI) === 'slot_opened')
      ) {
        throw new ConflictException(
          'Tuần này đã được chốt lịch. Nếu cần chốt lại, hãy bật chế độ chốt lại có chủ đích.',
        );
      }

      const [rows, pendingExceptions] = await this.prisma.$transaction([
        this.prisma.lICH_BSK.findMany({
          where: { N_NGAY: { gte: mondayStart, lte: saturdayEnd }, LBSK_IS_ARCHIVED: false },
          select: { LBSK_TRANG_THAI: true },
        }),
        this.prisma.yEU_CAU_LICH_BSK.count({
          where: {
            LBSK_N_NGAY: { gte: mondayStart, lte: saturdayEnd },
            YCL_TRANG_THAI: 'pending',
          },
        }),
      ]);

      const unresolvedChangeRequests = rows.filter(
        (row) => this.normalizeScheduleInstanceStatus(row.LBSK_TRANG_THAI) === 'change_requested',
      ).length;
      if (pendingExceptions > 0 || unresolvedChangeRequests > 0) {
        throw new ConflictException(
          `Vẫn còn ${Math.max(pendingExceptions, unresolvedChangeRequests)} yêu cầu điều chỉnh chưa xử lý. Vui lòng duyệt hoặc từ chối trước khi chốt lịch.`,
        );
      }

      const finalizedAt = new Date();
      const finalizedResult = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.lICH_BSK.updateMany({
          where: {
            N_NGAY: { gte: mondayStart, lte: saturdayEnd },
            LBSK_IS_ARCHIVED: false,
            LBSK_TRANG_THAI: {
              notIn: ['cancelled', 'cancelled_by_doctor_leave', 'vacant_by_leave'],
            },
          },
          data: {
            LBSK_TRANG_THAI: 'finalized',
            LBSK_TRANGTHAI_DUYET: 'approved',
            LBSK_CAP_NHAT_LUC: finalizedAt,
            LBSK_DUYET_LUC: finalizedAt,
          },
        });

        await tx.dOT_LICH_TUAN.update({
          where: { DLT_TUAN_BAT_DAU: mondayStart },
          data: {
            DLT_TRANG_THAI: 'finalized',
            DLT_CHOT_LUC: finalizedAt,
            DLT_CHOT_BOI: 'ADMIN',
          },
        });

        await tx.aUDIT_LOG.create({
          data: {
            AL_TABLE: 'SCHEDULE_CYCLE',
            AL_ACTION: 'FINALIZED',
            AL_PK: { weekStart: weekStartIso },
            AL_NEW: {
              finalizedAt: finalizedAt.toISOString(),
              finalizedShiftCount: updated.count,
            },
            AL_CHANGED_BY: 'ADMIN',
            AL_CHANGED_AT: finalizedAt,
          },
        });

        return updated.count;
      });

      const generated =
        options?.generateSlots === true
          ? await this.generateSlotsFromOfficialSchedule(weekStartIso, {
              forceRegenerate: options?.forceRegenerate,
            })
          : null;

      return {
        message: 'Chốt lịch trực tuần thành công',
        weekStart: weekStartIso,
        approvedShiftCount: finalizedResult,
        generated,
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }
    async generateSlotsFromOfficialSchedule(
    weekStartRaw: string,
    options?: { forceRegenerate?: boolean },
  ) {
    try {
      const { mondayStart, saturdayEnd, weekStartIso } = this.resolveWeekRange(
        weekStartRaw,
      );
      await this.ensureWeeklySchedulesGenerated(weekStartIso, 'SYSTEM');
      this.assertAdminSundayActionForWeek(
        mondayStart,
        'sinh slot cho lịch trực tuần',
      );

      const weekBatch = await this.getScheduleWeekOrThrow(weekStartIso);

      if (
        this.normalizeScheduleWeekStatus(weekBatch.DLT_TRANG_THAI) !== 'finalized' &&
        this.normalizeScheduleWeekStatus(weekBatch.DLT_TRANG_THAI) !== 'slot_opened'
      ) {
        throw new ConflictException(
          'Chỉ có thể sinh slot sau khi tuần đã được chốt lịch chính thức.',
        );
      }

      if (
        this.normalizeScheduleWeekStatus(weekBatch.DLT_TRANG_THAI) === 'slot_opened' &&
        !options?.forceRegenerate
      ) {
        throw new ConflictException(
          'Tuần này đã sinh slot trước đó. Nếu muốn sinh lại, hãy bật chế độ sinh lại có chủ đích.',
        );
      }

      const schedules = await this.prisma.lICH_BSK.findMany({
        where: {
          N_NGAY: { gte: mondayStart, lte: saturdayEnd },
          LBSK_IS_ARCHIVED: false,
          LBSK_TRANG_THAI: 'finalized',
        },
        include: {
          BUOI: {
            include: {
              KHUNG_GIO: {
                select: { KG_MA: true, KG_SO_BN_TOI_DA: true },
              },
            },
          },
        },
      });

      if (schedules.length === 0) {
        throw new ConflictException('Không có ca trực chính thức để sinh slot cho tuần này.');
      }

      const totalSlots = schedules.reduce(
        (sum, schedule) => sum + (schedule.BUOI?.KHUNG_GIO?.length ?? 0),
        0,
      );

      const generatedAt = new Date();
      await this.prisma.$transaction([
        this.prisma.dOT_LICH_TUAN.update({
          where: { DLT_TUAN_BAT_DAU: mondayStart },
          data: {
            DLT_TRANG_THAI: 'slot_opened',
            DLT_MO_SLOT_LUC: generatedAt,
            DLT_MO_SLOT_BOI: 'ADMIN',
          },
        }),
        this.prisma.aUDIT_LOG.create({
          data: {
            AL_TABLE: 'SCHEDULE_SLOT_BATCH',
            AL_ACTION: 'GENERATED',
            AL_PK: { weekStart: weekStartIso },
            AL_NEW: {
              shiftCount: schedules.length,
              totalSlots,
              generatedAt: generatedAt.toISOString(),
            },
            AL_CHANGED_BY: 'ADMIN',
            AL_CHANGED_AT: generatedAt,
          },
        }),
        this.prisma.aUDIT_LOG.create({
          data: {
            AL_TABLE: 'SCHEDULE_CYCLE',
            AL_ACTION: 'SLOTS_GENERATED',
            AL_PK: { weekStart: weekStartIso },
            AL_NEW: {
              shiftCount: schedules.length,
              totalSlots,
              generatedAt: generatedAt.toISOString(),
            },
            AL_CHANGED_BY: 'ADMIN',
            AL_CHANGED_AT: generatedAt,
          },
        }),
      ]);

      return {
        weekStart: weekStartIso,
        generatedAt: generatedAt.toISOString(),
        shiftCount: schedules.length,
        totalSlots,
      };
    } catch (e) {
      mapPrismaError(e);
    }
  }

  private async prepareScheduleTemplatePayload(
    payload: {
      BS_MA: number;
      CK_MA: number;
      P_MA: number;
      B_TEN: string;
      weekday: number;
      effectiveStartDate: string;
      effectiveEndDate?: string | null;
      status?: ScheduleTemplateStatus;
      note?: string | null;
    },
    _templateId?: number,
  ) {
    const effectiveStartDate = this.parseDateOnlyOrThrow(payload.effectiveStartDate);
    const effectiveEndDate = payload.effectiveEndDate
      ? this.parseDateOnlyOrThrow(payload.effectiveEndDate)
      : null;
    const weekday = Number(payload.weekday);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 6) {
      throw new BadRequestException('Thứ trong tuần của mẫu lịch phải từ thứ 2 đến thứ 7.');
    }
    if (effectiveEndDate && effectiveEndDate < effectiveStartDate) {
      throw new BadRequestException('Ngày kết thúc hiệu lực không được nhỏ hơn ngày bắt đầu.');
    }

    const [doctor, room, specialty, session] = await this.prisma.$transaction([
      this.prisma.bAC_SI.findUnique({
        where: { BS_MA: payload.BS_MA },
        select: { BS_MA: true, CK_MA: true, BS_DA_XOA: true },
      }),
      this.prisma.pHONG.findUnique({
        where: { P_MA: payload.P_MA },
        select: { P_MA: true, CK_MA: true },
      }),
      this.prisma.cHUYEN_KHOA.findUnique({
        where: { CK_MA: payload.CK_MA },
        select: { CK_MA: true },
      }),
      this.prisma.bUOI.findUnique({
        where: { B_TEN: payload.B_TEN },
        select: { B_TEN: true },
      }),
    ]);

    if (!doctor || doctor.BS_DA_XOA) {
      throw new NotFoundException('Không tìm thấy bác sĩ hợp lệ cho mẫu lịch.');
    }
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng khám cho mẫu lịch.');
    }
    if (!specialty) {
      throw new NotFoundException('Không tìm thấy chuyên khoa cho mẫu lịch.');
    }
    if (!session) {
      throw new NotFoundException('Không tìm thấy buổi làm việc cho mẫu lịch.');
    }
    if (doctor.CK_MA !== payload.CK_MA || room.CK_MA !== payload.CK_MA) {
      throw new ConflictException(
        'Bác sĩ, chuyên khoa và phòng trong mẫu lịch phải thuộc cùng một chuyên khoa.',
      );
    }

    return {
      BS_MA: payload.BS_MA,
      CK_MA: payload.CK_MA,
      P_MA: payload.P_MA,
      B_TEN: payload.B_TEN.trim(),
      weekday,
      effectiveStartDate,
      effectiveEndDate,
      status: this.normalizeTemplateStatus(payload.status),
      note: payload.note?.trim() || null,
    };
  }

  private async assertNoTemplateConflicts(
    payload: Awaited<ReturnType<AdminService['prepareScheduleTemplatePayload']>>,
    templateId?: number,
  ) {
    if (payload.status !== 'active') {
      return;
    }

    const [doctorCandidates, roomCandidates] = await this.prisma.$transaction([
      this.prisma.lICH_BSK_MAU.findMany({
        where: {
          BS_MA: payload.BS_MA,
          B_TEN: payload.B_TEN,
          LBM_THU_TRONG_TUAN: payload.weekday,
          LBM_TRANG_THAI: 'active',
          ...(templateId ? { NOT: { LBM_ID: templateId } } : {}),
        },
        select: {
          LBM_ID: true,
          LBM_HIEU_LUC_TU: true,
          LBM_HIEU_LUC_DEN: true,
        },
      }),
      this.prisma.lICH_BSK_MAU.findMany({
        where: {
          P_MA: payload.P_MA,
          B_TEN: payload.B_TEN,
          LBM_THU_TRONG_TUAN: payload.weekday,
          LBM_TRANG_THAI: 'active',
          ...(templateId ? { NOT: { LBM_ID: templateId } } : {}),
        },
        select: {
          LBM_ID: true,
          LBM_HIEU_LUC_TU: true,
          LBM_HIEU_LUC_DEN: true,
        },
      }),
    ]);

    const hasDoctorConflict = doctorCandidates.some((candidate) =>
      this.doDateRangesOverlap(
        candidate.LBM_HIEU_LUC_TU,
        candidate.LBM_HIEU_LUC_DEN ?? null,
        payload.effectiveStartDate,
        payload.effectiveEndDate,
      ),
    );
    if (hasDoctorConflict) {
      throw new ConflictException(
        'Bác sĩ đã có mẫu lịch khác trùng thứ, buổi và khoảng hiệu lực.',
      );
    }

    const hasRoomConflict = roomCandidates.some((candidate) =>
      this.doDateRangesOverlap(
        candidate.LBM_HIEU_LUC_TU,
        candidate.LBM_HIEU_LUC_DEN ?? null,
        payload.effectiveStartDate,
        payload.effectiveEndDate,
      ),
    );
    if (hasRoomConflict) {
      throw new ConflictException(
        'Phòng đã được gán cho mẫu lịch khác trùng thứ, buổi và khoảng hiệu lực.',
      );
    }
  }

  private async upsertScheduleWeek(weekStartRaw: string, actor = 'SYSTEM') {
    const { mondayStart, saturdayEnd } = this.resolveWeekRange(weekStartRaw);
    return this.prisma.dOT_LICH_TUAN.upsert({
      where: { DLT_TUAN_BAT_DAU: mondayStart },
      create: {
        DLT_TUAN_BAT_DAU: mondayStart,
        DLT_TUAN_KET_THUC: new Date(
          Date.UTC(
            saturdayEnd.getUTCFullYear(),
            saturdayEnd.getUTCMonth(),
            saturdayEnd.getUTCDate(),
          ),
        ),
        DLT_TRANG_THAI: 'generated',
        DLT_SINH_LUC: new Date(),
        DLT_SINH_BOI: actor,
      },
      update: {
        DLT_TUAN_KET_THUC: new Date(
          Date.UTC(
            saturdayEnd.getUTCFullYear(),
            saturdayEnd.getUTCMonth(),
            saturdayEnd.getUTCDate(),
          ),
        ),
      },
    });
  }

  private async getScheduleWeekOrThrow(weekStartRaw: string) {
    const { mondayStart } = this.resolveWeekRange(weekStartRaw);
    const batch = await this.upsertScheduleWeek(weekStartRaw, 'SYSTEM');
    if (!batch || batch.DLT_TUAN_BAT_DAU.getTime() !== mondayStart.getTime()) {
      throw new NotFoundException('Không tìm thấy dữ liệu tuần lịch làm việc.');
    }
    return batch;
  }

  private async ensureWeeklySchedulesGenerated(
    weekStartRaw: string,
    actor = 'SYSTEM',
    options?: { source?: ScheduleSource },
  ) {
    const { mondayStart, saturdayEnd, weekStartIso } = this.resolveWeekRange(weekStartRaw);
    const generationSource: ScheduleSource = options?.source ?? 'template';
    const batch = await this.upsertScheduleWeek(weekStartIso, actor);
    const batchStatus = this.normalizeScheduleWeekStatus(batch.DLT_TRANG_THAI);
    if (batchStatus === 'finalized' || batchStatus === 'slot_opened') {
      return {
        weekStart: weekStartIso,
        created: 0,
        updated: 0,
        cancelled: 0,
        skipped: 0,
        locked: true,
      };
    }

    const templates = await this.prisma.lICH_BSK_MAU.findMany({
      where: {
        LBM_TRANG_THAI: 'active',
        LBM_HIEU_LUC_TU: { lte: saturdayEnd },
        OR: [{ LBM_HIEU_LUC_DEN: null }, { LBM_HIEU_LUC_DEN: { gte: mondayStart } }],
      },
      orderBy: [{ BS_MA: 'asc' }, { LBM_THU_TRONG_TUAN: 'asc' }, { B_TEN: 'asc' }],
    });

    const desiredOccurrences: Array<{
      templateId: number;
      BS_MA: number;
      P_MA: number;
      B_TEN: string;
      date: Date;
      note: string | null;
    }> = [];

    const cursor = new Date(mondayStart);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor <= saturdayEnd) {
      const dateOnly = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()),
      );
      const weekday = dateOnly.getUTCDay();
      for (const template of templates) {
        if (template.LBM_THU_TRONG_TUAN !== weekday) continue;
        if (dateOnly < template.LBM_HIEU_LUC_TU) continue;
        if (template.LBM_HIEU_LUC_DEN && dateOnly > template.LBM_HIEU_LUC_DEN) continue;
        desiredOccurrences.push({
          templateId: template.LBM_ID,
          BS_MA: template.BS_MA,
          P_MA: template.P_MA,
          B_TEN: template.B_TEN,
          date: dateOnly,
          note: template.LBM_GHI_CHU || null,
        });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const existingRows = await this.prisma.lICH_BSK.findMany({
      where: {
        N_NGAY: { gte: mondayStart, lte: saturdayEnd },
      },
      select: {
        BS_MA: true,
        P_MA: true,
        N_NGAY: true,
        B_TEN: true,
        LBM_ID: true,
        LBSK_NGUON: true,
        LBSK_TRANG_THAI: true,
        LBSK_IS_ARCHIVED: true,
        DANG_KY: {
          where: { DK_TRANG_THAI: { notIn: ['HUY', 'HUY_BS_NGHI'] } },
          select: { DK_MA: true },
        },
        YEU_CAU_LICH_BSK: {
          where: { YCL_TRANG_THAI: 'pending' },
          select: { YCL_ID: true },
        },
      },
    });

    const templateSlotMap = new Map<string, (typeof existingRows)[number]>();
    const doctorSlotMap = new Map<string, (typeof existingRows)[number]>();
    const roomSlotMap = new Map<string, (typeof existingRows)[number]>();

    for (const row of existingRows) {
      const dateIso = this.toDateOnlyIso(row.N_NGAY);
      const templateKey = row.LBM_ID
        ? `${row.LBM_ID}::${dateIso}::${row.B_TEN}`
        : null;
      const doctorKey = `${row.BS_MA}::${dateIso}::${row.B_TEN}`;
      const roomKey = `${row.P_MA}::${dateIso}::${row.B_TEN}`;
      const isArchived = Boolean((row as any).LBSK_IS_ARCHIVED);

      if (templateKey) {
        templateSlotMap.set(templateKey, row);
      }
      const status = this.normalizeScheduleInstanceStatus(row.LBSK_TRANG_THAI);
      if (!isArchived && !this.isScheduleStatusInactive(status)) {
        doctorSlotMap.set(doctorKey, row);
        roomSlotMap.set(roomKey, row);
      }
    }

    const createData: Prisma.LICH_BSKCreateManyInput[] = [];
    const updateTasks: Array<() => Promise<unknown>> = [];
    const desiredKeys = new Set<string>();
    let skipped = 0;
    let updated = 0;

    for (const occurrence of desiredOccurrences) {
      const dateIso = this.toDateOnlyIso(occurrence.date);
      const templateKey = `${occurrence.templateId}::${dateIso}::${occurrence.B_TEN}`;
      const doctorKey = `${occurrence.BS_MA}::${dateIso}::${occurrence.B_TEN}`;
      const roomKey = `${occurrence.P_MA}::${dateIso}::${occurrence.B_TEN}`;
      desiredKeys.add(templateKey);

      const existingExact = templateSlotMap.get(templateKey);
      if (existingExact) {
        if (this.canAutoReconcileTemplateRow(existingExact)) {
          const normalizedStatus = this.normalizeScheduleInstanceStatus(
            existingExact.LBSK_TRANG_THAI,
          );
          const nextStatus = this.isScheduleStatusCancelled(normalizedStatus)
            ? 'generated'
            : normalizedStatus;
          updateTasks.push(() =>
            this.prisma.lICH_BSK.update({
              where: {
                BS_MA_N_NGAY_B_TEN: {
                  BS_MA: existingExact.BS_MA,
                  N_NGAY: existingExact.N_NGAY,
                  B_TEN: existingExact.B_TEN,
                },
              },
              data: {
                P_MA: occurrence.P_MA,
                LBM_ID: occurrence.templateId,
                DLT_TUAN_BAT_DAU: mondayStart,
                LBSK_NGUON: generationSource,
                LBSK_TRANG_THAI: nextStatus,
                LBSK_TRANGTHAI_DUYET: this.mapScheduleInstanceToApprovalStatus(nextStatus),
                LBSK_GHI_CHU: occurrence.note,
                LBSK_IS_ARCHIVED: false,
                LBSK_ARCHIVED_AT: null,
                LBSK_ARCHIVED_BY: null,
                LBSK_ARCHIVE_REASON: null,
                LBSK_CAP_NHAT_LUC: new Date(),
              },
            }),
          );
          updated += 1;
        } else {
          skipped += 1;
        }
        continue;
      }

      if (doctorSlotMap.has(doctorKey) || roomSlotMap.has(roomKey)) {
        skipped += 1;
        continue;
      }

      createData.push({
        BS_MA: occurrence.BS_MA,
        P_MA: occurrence.P_MA,
        N_NGAY: occurrence.date,
        B_TEN: occurrence.B_TEN,
        LBM_ID: occurrence.templateId,
        DLT_TUAN_BAT_DAU: mondayStart,
        LBSK_NGUON: generationSource,
        LBSK_TRANG_THAI: 'generated',
        LBSK_TRANGTHAI_DUYET: 'pending',
        LBSK_GHI_CHU: occurrence.note,
        LBSK_TAO_LUC: new Date(),
        LBSK_CAP_NHAT_LUC: new Date(),
      });
      doctorSlotMap.set(doctorKey, existingRows[0] as any);
      roomSlotMap.set(roomKey, existingRows[0] as any);
    }

    const obsoleteRows = existingRows.filter((row) => {
      if ((row as any).LBSK_IS_ARCHIVED) return false;
      if (row.LBM_ID == null) return false;
      const normalizedSource = this.normalizeScheduleSource(row.LBSK_NGUON);
      if (normalizedSource !== 'template' && normalizedSource !== 'auto_rolling') return false;
      const key = `${row.LBM_ID}::${this.toDateOnlyIso(row.N_NGAY)}::${row.B_TEN}`;
      return !desiredKeys.has(key);
    });

    let cancelled = 0;
    for (const row of obsoleteRows) {
      if (!this.canAutoReconcileTemplateRow(row)) {
        skipped += 1;
        continue;
      }
      updateTasks.push(() =>
        this.prisma.lICH_BSK.update({
          where: {
            BS_MA_N_NGAY_B_TEN: {
              BS_MA: row.BS_MA,
              N_NGAY: row.N_NGAY,
              B_TEN: row.B_TEN,
            },
          },
          data: {
            LBSK_TRANG_THAI: 'cancelled',
            LBSK_TRANGTHAI_DUYET: 'rejected',
            LBSK_CAP_NHAT_LUC: new Date(),
          },
        }),
      );
      cancelled += 1;
    }

    if (createData.length > 0) {
      await this.prisma.lICH_BSK.createMany({
        data: createData,
        skipDuplicates: true,
      });
    }

    for (const task of updateTasks) {
      await task();
    }

    return {
      weekStart: weekStartIso,
      created: createData.length,
      updated,
      cancelled,
      skipped,
      locked: false,
    };
  }

  private canAutoReconcileTemplateRow(row: {
    LBSK_NGUON: string | null;
    LBSK_TRANG_THAI: string | null;
    LBSK_IS_ARCHIVED?: boolean | null;
    DANG_KY: Array<{ DK_MA: number }>;
    YEU_CAU_LICH_BSK: Array<{ YCL_ID: number }>;
  }) {
    const isArchived = Boolean(row.LBSK_IS_ARCHIVED);
    const source = this.normalizeScheduleSource(row.LBSK_NGUON);
    const status = this.normalizeScheduleInstanceStatus(row.LBSK_TRANG_THAI);
    if (row.DANG_KY.length > 0) return false;
    if (row.YEU_CAU_LICH_BSK.length > 0) return false;
    if (isArchived) return true;
    if (source !== 'template' && source !== 'auto_rolling') return false;
    if (
      status === SHIFT_STATUS.vacant_by_leave ||
      status === SHIFT_STATUS.cancelled_by_doctor_leave
    )
      return false;
    return (
      status === SHIFT_STATUS.generated ||
      status === SHIFT_STATUS.confirmed ||
      status === SHIFT_STATUS.cancelled
    );
  }

  private mapWeeklyScheduleRow(
    row: any,
    weekBatch: { DLT_TRANG_THAI: string | null; DLT_CHOT_LUC: Date | null; DLT_MO_SLOT_LUC: Date | null },
  ) {
    const latestRequest = row.YEU_CAU_LICH_BSK?.[0] ?? null;
    const bookingCount = Array.isArray(row.DANG_KY)
      ? row.DANG_KY.filter((booking: any) =>
          this.isBookingActiveStatus(booking.DK_TRANG_THAI),
        ).length
      : 0;
    return {
      BS_MA: row.BS_MA,
      N_NGAY: row.N_NGAY,
      B_TEN: row.B_TEN,
      P_MA: row.P_MA,
      status: this.normalizeScheduleInstanceStatus(row.LBSK_TRANG_THAI),
      source: this.normalizeScheduleSource(row.LBSK_NGUON),
      note: row.LBSK_GHI_CHU,
      confirmationAt: row.LBSK_XAC_NHAN_LUC?.toISOString() || null,
      createdAt: row.LBSK_TAO_LUC?.toISOString() || null,
      updatedAt: row.LBSK_CAP_NHAT_LUC?.toISOString() || null,
      slotCount: row.BUOI?.KHUNG_GIO?.length ?? 0,
      slotMax: this.resolveSlotMax(row.BUOI?.KHUNG_GIO),
      bookingCount,
      doctor: row.BAC_SI,
      room: row.PHONG,
      template:
        row.LICH_BSK_MAU == null
          ? null
          : {
              LBM_ID: row.LICH_BSK_MAU.LBM_ID,
              weekday: row.LICH_BSK_MAU.LBM_THU_TRONG_TUAN,
              status: this.normalizeTemplateStatus(row.LICH_BSK_MAU.LBM_TRANG_THAI),
              effectiveStartDate: this.toDateOnlyIso(row.LICH_BSK_MAU.LBM_HIEU_LUC_TU),
              effectiveEndDate: row.LICH_BSK_MAU.LBM_HIEU_LUC_DEN
                ? this.toDateOnlyIso(row.LICH_BSK_MAU.LBM_HIEU_LUC_DEN)
                : null,
            },
      latestException: latestRequest ? this.mapScheduleExceptionRequestRow(latestRequest) : null,
      weekStatus: this.normalizeScheduleWeekStatus(weekBatch.DLT_TRANG_THAI),
      finalizedAt: weekBatch.DLT_CHOT_LUC?.toISOString() || null,
      slotOpenedAt: weekBatch.DLT_MO_SLOT_LUC?.toISOString() || null,
    };
  }

  private mapScheduleExceptionRequestRow(row: any, affectedBookingCount = 0) {
    const requestType = this.normalizeScheduleExceptionType(row.YCL_LOAI);
    const leaveApprovalMode =
      requestType === 'leave'
        ? affectedBookingCount > 0
          ? 'cancel_with_bookings'
          : 'replacement'
        : null;
    return {
      id: row.YCL_ID,
      type: requestType,
      status: this.normalizeScheduleExceptionStatus(row.YCL_TRANG_THAI),
      reason: row.YCL_LY_DO,
      previousStatus: row.YCL_TRANG_THAI_TRUOC
        ? this.normalizeScheduleInstanceStatus(row.YCL_TRANG_THAI_TRUOC)
        : null,
      createdAt: row.YCL_TAO_LUC?.toISOString() || null,
      createdBy: row.YCL_TAO_BOI || null,
      reviewedAt: row.YCL_DUYET_LUC?.toISOString() || null,
      reviewedBy: row.YCL_DUYET_BOI || null,
      adminNote: row.YCL_GHI_CHU_ADMIN || null,
      affectedBookingCount,
      leaveApprovalMode,
      doctor: row.BAC_SI
        ? row.BAC_SI
        : row.LICH_BSK?.BAC_SI || {
            BS_MA: row.BS_MA,
            BS_HO_TEN: `BS #${row.BS_MA}`,
          },
      targetShift: {
        BS_MA: row.BS_MA,
        N_NGAY: row.LBSK_N_NGAY,
        B_TEN: row.LBSK_B_TEN,
        status: row.LICH_BSK
          ? this.normalizeScheduleInstanceStatus(row.LICH_BSK.LBSK_TRANG_THAI)
          : null,
        room: row.LICH_BSK?.PHONG
          ? {
              P_MA: row.LICH_BSK.PHONG.P_MA,
              P_TEN: row.LICH_BSK.PHONG.P_TEN,
              CK_MA: row.LICH_BSK.PHONG.CK_MA,
            }
          : null,
      },
      requestedChange: {
        date: row.YCL_NGAY_MOI ? this.toDateOnlyIso(row.YCL_NGAY_MOI) : null,
        session: row.YCL_BUOI_MOI || null,
        room: row.PHONG_MOI
          ? {
              P_MA: row.PHONG_MOI.P_MA,
              P_TEN: row.PHONG_MOI.P_TEN,
              CK_MA: row.PHONG_MOI.CK_MA,
            }
          : null,
        suggestedDoctor: row.BAC_SI_GOI_Y
          ? {
              BS_MA: row.BAC_SI_GOI_Y.BS_MA,
              BS_HO_TEN: row.BAC_SI_GOI_Y.BS_HO_TEN,
            }
          : null,
      },
    };
  }

  private normalizeDateParam(raw: string) {
    const trimmed = raw?.trim();
    if (!trimmed) return raw;
    if (trimmed.includes('T')) return trimmed.split('T')[0];
    if (trimmed.includes(' ')) return trimmed.split(' ')[0];
    return trimmed;
  }

  private resolveSlotMax(
    slots: Array<{ KG_SO_BN_TOI_DA?: number | null }> | null | undefined,
  ) {
    if (!slots || slots.length === 0) return 5;
    const values = slots
      .map((item) => item.KG_SO_BN_TOI_DA)
      .filter((value): value is number => typeof value === 'number');
    if (values.length === 0) return 5;
    return Math.max(...values);
  }

  private async applyApprovedScheduleExceptionRequest(
    tx: Prisma.TransactionClient,
    request: any,
    actor: string,
    reviewedAt: Date,
  ) {
    const requestType = this.normalizeScheduleExceptionType(request.YCL_LOAI);
    const current = request.LICH_BSK;
    if (!current) {
      throw new NotFoundException('Không tìm thấy ca trực gốc của yêu cầu điều chỉnh.');
    }

    if (requestType === 'leave') {
      const activeBookings = await tx.dANG_KY.findMany({
        where: {
          BS_MA: current.BS_MA,
          N_NGAY: current.N_NGAY,
          B_TEN: current.B_TEN,
          DK_TRANG_THAI: {
            notIn: Array.from(BOOKING_CANCELLED_STATUSES),
          },
        },
        select: {
          DK_MA: true,
          BN_MA: true,
          DK_TRANG_THAI: true,
          BENH_NHAN: {
            select: {
              TK_SDT: true,
            },
          },
        },
      });

      const affectedBookingCount = activeBookings.length;
      const handlingType =
        affectedBookingCount > 0 ? 'cancel_with_bookings' : 'vacant_by_leave';

      if (affectedBookingCount === 0) {
        await tx.lICH_BSK.update({
          where: {
            BS_MA_N_NGAY_B_TEN: {
              BS_MA: current.BS_MA,
              N_NGAY: current.N_NGAY,
              B_TEN: current.B_TEN,
            },
          },
          data: {
            LBSK_TRANG_THAI: 'vacant_by_leave',
            LBSK_TRANGTHAI_DUYET: 'pending',
            LBSK_CAP_NHAT_LUC: reviewedAt,
            LBSK_DUYET_BOI: actor,
            LBSK_DUYET_LUC: reviewedAt,
          },
        });
      } else {
        await tx.lICH_BSK.update({
          where: {
            BS_MA_N_NGAY_B_TEN: {
              BS_MA: current.BS_MA,
              N_NGAY: current.N_NGAY,
              B_TEN: current.B_TEN,
            },
          },
          data: {
            LBSK_TRANG_THAI: 'cancelled_by_doctor_leave',
            LBSK_TRANGTHAI_DUYET: 'rejected',
            LBSK_CAP_NHAT_LUC: reviewedAt,
            LBSK_DUYET_BOI: actor,
            LBSK_DUYET_LUC: reviewedAt,
          },
        });

        const bookingIds = activeBookings.map((booking) => booking.DK_MA);
        if (bookingIds.length > 0) {
          await tx.dANG_KY.updateMany({
            where: { DK_MA: { in: bookingIds } },
            data: {
              DK_TRANG_THAI: 'HUY_BS_NGHI',
              DK_LY_DO_HUY: request.YCL_LY_DO || 'Bác sĩ nghỉ đột xuất',
            },
          });
        }

        const notifyTargets = Array.from(
          new Set(
            activeBookings
              .map((booking) => booking.BENH_NHAN?.TK_SDT)
              .filter((value): value is string => Boolean(value)),
          ),
        );
        if (notifyTargets.length > 0) {
          const dateLabel = this.toDateOnlyIso(current.N_NGAY);
          const content = `Bác sĩ phụ trách lịch khám ngày ${dateLabel} đã nghỉ đột xuất. Lịch khám của bạn đã được hủy. Vui lòng đặt lại lịch khám khác.`;
          await tx.tHONG_BAO.createMany({
            data: notifyTargets.map((TK_SDT) => ({
              TK_SDT,
              TB_TIEU_DE: 'Hủy lịch khám do bác sĩ nghỉ',
              TB_LOAI: 'APPOINTMENT',
              TB_NOI_DUNG: content,
              TB_TRANG_THAI: 'UNREAD',
              TB_THOI_GIAN: reviewedAt,
            })),
          });
        }
      }

      await tx.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'YEU_CAU_LICH_BSK',
          AL_ACTION: 'LEAVE_APPROVED',
          AL_PK: { YCL_ID: request.YCL_ID },
          AL_NEW: {
            reason: request.YCL_LY_DO,
            reviewedBy: actor,
            reviewedAt: reviewedAt.toISOString(),
            handlingType,
            affectedBookingCount,
            target: {
              BS_MA: current.BS_MA,
              N_NGAY: this.toDateOnlyIso(current.N_NGAY),
              B_TEN: current.B_TEN,
            },
          },
          AL_CHANGED_BY: actor,
          AL_CHANGED_AT: reviewedAt,
        },
      });
      return;
    }

    const nextDate = request.YCL_NGAY_MOI ?? current.N_NGAY;
    const nextSession = request.YCL_BUOI_MOI ?? current.B_TEN;
    const nextRoomId = request.YCL_P_MA_MOI ?? current.P_MA;
    const nextWeekStart = this.getWeekMondayFromDate(nextDate);
    const nextWeekStartIso = this.toDateOnlyIso(nextWeekStart);

    await this.ensureScheduleDateExists(nextDate);
    await this.upsertScheduleWeek(nextWeekStartIso, actor);
    await this.validateDoctorRoomSpecialty(current.BS_MA, nextRoomId);
    await this.assertNoOfficialShiftOccupancyConflicts({
      BS_MA: current.BS_MA,
      P_MA: nextRoomId,
      N_NGAY: nextDate,
      B_TEN: nextSession,
      currentKey: {
        BS_MA: current.BS_MA,
        N_NGAY: current.N_NGAY,
        B_TEN: current.B_TEN,
      },
    });

    await tx.lICH_BSK.update({
      where: {
        BS_MA_N_NGAY_B_TEN: {
          BS_MA: current.BS_MA,
          N_NGAY: current.N_NGAY,
          B_TEN: current.B_TEN,
        },
      },
      data: {
        P_MA: nextRoomId,
        N_NGAY: nextDate,
        B_TEN: nextSession,
        DLT_TUAN_BAT_DAU: nextWeekStart,
        LBSK_TRANG_THAI: 'adjusted',
        LBSK_TRANGTHAI_DUYET: 'approved',
        LBSK_CAP_NHAT_LUC: reviewedAt,
        LBSK_DUYET_BOI: actor,
        LBSK_DUYET_LUC: reviewedAt,
      },
    });
  }

  private async restoreScheduleStatusAfterRejectedException(
    tx: Prisma.TransactionClient,
    request: any,
  ) {
    const previousStatus = request.YCL_TRANG_THAI_TRUOC
      ? this.normalizeScheduleInstanceStatus(request.YCL_TRANG_THAI_TRUOC)
      : 'generated';

    await tx.lICH_BSK.update({
      where: {
        BS_MA_N_NGAY_B_TEN: {
          BS_MA: request.BS_MA,
          N_NGAY: request.LBSK_N_NGAY,
          B_TEN: request.LBSK_B_TEN,
        },
      },
      data: {
        LBSK_TRANG_THAI: previousStatus,
        LBSK_TRANGTHAI_DUYET: this.mapScheduleInstanceToApprovalStatus(previousStatus),
        LBSK_CAP_NHAT_LUC: new Date(),
      },
    });
  }

  private async applyApprovedScheduleExceptionRequestLegacy(
    request: any,
    actor: string,
    reviewedAt: Date,
  ) {
    const requestType = this.normalizeScheduleExceptionType(request.YCL_LOAI);
    const current = request.LICH_BSK;
    if (!current) {
      throw new NotFoundException('Không tìm thấy ca trực gốc của yêu cầu điều chỉnh.');
    }

    if (requestType === 'leave') {
      const activeBookings = await this.prisma.dANG_KY.findMany({
        where: {
          BS_MA: current.BS_MA,
          N_NGAY: current.N_NGAY,
          B_TEN: current.B_TEN,
          DK_TRANG_THAI: {
            notIn: Array.from(BOOKING_CANCELLED_STATUSES),
          },
        },
        select: {
          DK_MA: true,
          BENH_NHAN: { select: { TK_SDT: true } },
        },
      });

      const affectedBookingCount = activeBookings.length;
      const handlingType =
        affectedBookingCount > 0 ? 'cancel_with_bookings' : 'vacant_by_leave';

      if (affectedBookingCount === 0) {
        await this.prisma.lICH_BSK.update({
          where: {
            BS_MA_N_NGAY_B_TEN: {
              BS_MA: current.BS_MA,
              N_NGAY: current.N_NGAY,
              B_TEN: current.B_TEN,
            },
          },
          data: {
            LBSK_TRANG_THAI: 'vacant_by_leave',
            LBSK_CAP_NHAT_LUC: reviewedAt,
          },
          select: {
            BS_MA: true,
            N_NGAY: true,
            B_TEN: true,
            LBSK_TRANG_THAI: true,
          },
        });
      } else {
        await this.prisma.lICH_BSK.update({
          where: {
            BS_MA_N_NGAY_B_TEN: {
              BS_MA: current.BS_MA,
              N_NGAY: current.N_NGAY,
              B_TEN: current.B_TEN,
            },
          },
          data: {
            LBSK_TRANG_THAI: 'cancelled_by_doctor_leave',
            LBSK_CAP_NHAT_LUC: reviewedAt,
          },
          select: {
            BS_MA: true,
            N_NGAY: true,
            B_TEN: true,
            LBSK_TRANG_THAI: true,
          },
        });

        const bookingIds = activeBookings.map((booking) => booking.DK_MA);
        if (bookingIds.length > 0) {
          await this.prisma.dANG_KY.updateMany({
            where: { DK_MA: { in: bookingIds } },
            data: {
              DK_TRANG_THAI: 'HUY_BS_NGHI',
              DK_LY_DO_HUY: request.YCL_LY_DO || 'Bác sĩ nghỉ đột xuất',
            },
          });
        }

        const notifyTargets = Array.from(
          new Set(
            activeBookings
              .map((booking) => booking.BENH_NHAN?.TK_SDT)
              .filter((value): value is string => Boolean(value)),
          ),
        );
        if (notifyTargets.length > 0) {
          const dateLabel = this.toDateOnlyIso(current.N_NGAY);
          const content = `Bác sĩ phụ trách lịch khám ngày ${dateLabel} đã nghỉ đột xuất. Lịch khám của bạn đã được hủy. Vui lòng đặt lại lịch khám khác.`;
          await this.prisma.tHONG_BAO.createMany({
            data: notifyTargets.map((TK_SDT) => ({
              TK_SDT,
              TB_TIEU_DE: 'Hủy lịch khám do bác sĩ nghỉ',
              TB_LOAI: 'APPOINTMENT',
              TB_NOI_DUNG: content,
              TB_TRANG_THAI: 'UNREAD',
              TB_THOI_GIAN: reviewedAt,
            })),
          });
        }
      }

      await this.prisma.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'YEU_CAU_LICH_BSK',
          AL_ACTION: 'LEAVE_APPROVED',
          AL_PK: { YCL_ID: request.YCL_ID },
          AL_NEW: {
            reason: request.YCL_LY_DO,
            reviewedBy: actor,
            reviewedAt: reviewedAt.toISOString(),
            handlingType,
            affectedBookingCount,
            target: {
              BS_MA: current.BS_MA,
              N_NGAY: this.toDateOnlyIso(current.N_NGAY),
              B_TEN: current.B_TEN,
            },
          },
          AL_CHANGED_BY: actor,
          AL_CHANGED_AT: reviewedAt,
        },
      });
      return;
    }

    const nextDate = request.YCL_NGAY_MOI ?? current.N_NGAY;
    const nextSession = request.YCL_BUOI_MOI ?? current.B_TEN;
    const nextRoomId = request.YCL_P_MA_MOI ?? current.P_MA;
    const nextWeekStart = this.getWeekMondayFromDate(nextDate);
    const nextWeekStartIso = this.toDateOnlyIso(nextWeekStart);

    await this.ensureScheduleDateExists(nextDate);
    await this.upsertScheduleWeek(nextWeekStartIso, actor);
    await this.validateDoctorRoomSpecialty(current.BS_MA, nextRoomId);
    await this.assertNoOfficialShiftOccupancyConflicts({
      BS_MA: current.BS_MA,
      P_MA: nextRoomId,
      N_NGAY: nextDate,
      B_TEN: nextSession,
      currentKey: {
        BS_MA: current.BS_MA,
        N_NGAY: current.N_NGAY,
        B_TEN: current.B_TEN,
      },
    });

    try {
      await this.prisma.lICH_BSK.update({
        where: {
          BS_MA_N_NGAY_B_TEN: {
            BS_MA: current.BS_MA,
            N_NGAY: current.N_NGAY,
            B_TEN: current.B_TEN,
          },
        },
        data: {
          P_MA: nextRoomId,
          N_NGAY: nextDate,
          B_TEN: nextSession,
          DLT_TUAN_BAT_DAU: nextWeekStart,
          LBSK_TRANG_THAI: 'adjusted',
          LBSK_CAP_NHAT_LUC: reviewedAt,
        },
        select: {
          BS_MA: true,
          N_NGAY: true,
          B_TEN: true,
          LBSK_TRANG_THAI: true,
        },
      });
    } catch (e) {
      if (!this.isMissingColumnError(e)) {
        throw e;
      }
      this.logger.warn(
        'Missing schedule columns; using minimal legacy change update.',
      );
      await this.prisma.lICH_BSK.update({
        where: {
          BS_MA_N_NGAY_B_TEN: {
            BS_MA: current.BS_MA,
            N_NGAY: current.N_NGAY,
            B_TEN: current.B_TEN,
          },
        },
        data: {
          P_MA: nextRoomId,
          N_NGAY: nextDate,
          B_TEN: nextSession,
          LBSK_TRANG_THAI: 'adjusted',
        },
        select: {
          BS_MA: true,
          N_NGAY: true,
          B_TEN: true,
          LBSK_TRANG_THAI: true,
        },
      });
    }
  }

  private async restoreScheduleStatusAfterRejectedExceptionLegacy(request: any) {
    const previousStatus = request.YCL_TRANG_THAI_TRUOC
      ? this.normalizeScheduleInstanceStatus(request.YCL_TRANG_THAI_TRUOC)
      : 'generated';

    try {
      await this.prisma.lICH_BSK.update({
        where: {
          BS_MA_N_NGAY_B_TEN: {
            BS_MA: request.BS_MA,
            N_NGAY: request.LBSK_N_NGAY,
            B_TEN: request.LBSK_B_TEN,
          },
        },
        data: {
          LBSK_TRANG_THAI: previousStatus,
          LBSK_CAP_NHAT_LUC: new Date(),
        },
        select: {
          BS_MA: true,
          N_NGAY: true,
          B_TEN: true,
          LBSK_TRANG_THAI: true,
        },
      });
    } catch (e) {
      if (!this.isMissingColumnError(e)) {
        throw e;
      }
      this.logger.warn(
        'Missing schedule columns; using minimal legacy reject update.',
      );
      await this.prisma.lICH_BSK.update({
        where: {
          BS_MA_N_NGAY_B_TEN: {
            BS_MA: request.BS_MA,
            N_NGAY: request.LBSK_N_NGAY,
            B_TEN: request.LBSK_B_TEN,
          },
        },
        data: {
          LBSK_TRANG_THAI: previousStatus,
        },
        select: {
          BS_MA: true,
          N_NGAY: true,
          B_TEN: true,
          LBSK_TRANG_THAI: true,
        },
      });
    }
  }

  private normalizeTemplateStatus(value?: string | null): ScheduleTemplateStatus {
    return String(value ?? '').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active';
  }

  private normalizeScheduleInstanceStatus(value?: string | null): ScheduleInstanceStatus {
    return normalizeScheduleInstanceStatusShared(value);
  }

  private normalizeScheduleWeekStatus(value?: string | null): ScheduleWeekStatus {
    return normalizeScheduleWeekStatusShared(value);
  }

  private normalizeScheduleSource(value?: string | null): ScheduleSource {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'template') return 'template';
    if (normalized === 'admin_manual') return 'admin_manual';
    if (normalized === 'auto_rolling') return 'auto_rolling';
    if (normalized === 'copied_1_month') return 'copied_1_month';
    if (normalized === 'copied_2_months') return 'copied_2_months';
    if (normalized === 'copied_3_months') return 'copied_3_months';
    return 'legacy_registration';
  }

  private normalizeScheduleExceptionType(value?: string | null): ScheduleExceptionType {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'leave') return 'leave';
    if (normalized === 'shift_change') return 'shift_change';
    if (normalized === 'room_change') return 'room_change';
    return 'other';
  }

  private normalizeScheduleExceptionStatus(value?: string | null): ScheduleExceptionStatus {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'approved') return 'approved';
    if (normalized === 'rejected') return 'rejected';
    return 'pending';
  }

  private mapScheduleInstanceToApprovalStatus(
    status: ScheduleInstanceStatus,
  ): ScheduleApprovalStatus {
    if (
      status === SHIFT_STATUS.cancelled ||
      status === SHIFT_STATUS.cancelled_by_doctor_leave
    )
      return 'rejected';
    if (
      status === SHIFT_STATUS.generated ||
      status === SHIFT_STATUS.change_requested ||
      status === SHIFT_STATUS.vacant_by_leave
    )
      return 'pending';
    return 'approved';
  }

  private isScheduleStatusCancelled(status: ScheduleInstanceStatus) {
    return (
      status === SHIFT_STATUS.cancelled ||
      status === SHIFT_STATUS.cancelled_by_doctor_leave
    );
  }

  private isScheduleStatusInactive(status: ScheduleInstanceStatus) {
    return this.isScheduleStatusCancelled(status) || status === SHIFT_STATUS.vacant_by_leave;
  }

  private isBookingActiveStatus(status?: string | null) {
    const normalized = String(status ?? '').trim().toUpperCase();
    return !BOOKING_CANCELLED_STATUSES.has(normalized);
  }

  private doDateRangesOverlap(
    startA: Date,
    endA: Date | null,
    startB: Date,
    endB: Date | null,
  ) {
    const farFuture = new Date(Date.UTC(9999, 11, 31));
    const effectiveEndA = endA ?? farFuture;
    const effectiveEndB = endB ?? farFuture;
    return startA <= effectiveEndB && startB <= effectiveEndA;
  }

  private addMonthsUtc(date: Date, months: number) {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const base = new Date(Date.UTC(year, month + months, 1));
    const lastDay = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0),
    ).getUTCDate();
    base.setUTCDate(Math.min(day, lastDay));
    return base;
  }

  private resolveWeekRange(weekStartRaw?: string) {
    let mondayStart: Date;
    if (weekStartRaw) {
      mondayStart = this.parseDateOnlyOrThrow(weekStartRaw);
    } else {
      const now = new Date();
      mondayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      mondayStart.setUTCDate(
        mondayStart.getUTCDate() - ((mondayStart.getUTCDay() + 6) % 7),
      );
    }

    mondayStart.setUTCHours(0, 0, 0, 0);
    const saturdayEnd = new Date(mondayStart);
    saturdayEnd.setUTCDate(mondayStart.getUTCDate() + 5);
    saturdayEnd.setUTCHours(23, 59, 59, 999);

    const sundayEnd = new Date(mondayStart);
    sundayEnd.setUTCDate(mondayStart.getUTCDate() + 6);
    sundayEnd.setUTCHours(23, 59, 59, 999);

    return {
      mondayStart,
      saturdayEnd,
      sundayEnd,
      weekStartIso: this.toDateOnlyIso(mondayStart),
      weekEndIso: this.toDateOnlyIso(saturdayEnd),
    };
  }

  private parseDateOnlyOrThrow(dateRaw: string) {
    const normalized = dateRaw.trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]);
      const day = Number(dateOnlyMatch[3]);
      const dateOnly = new Date(Date.UTC(year, month - 1, day));
      if (
        dateOnly.getUTCFullYear() !== year ||
        dateOnly.getUTCMonth() !== month - 1 ||
        dateOnly.getUTCDate() !== day
      ) {
        throw new BadRequestException('Ngày không hợp lệ');
      }
      dateOnly.setUTCHours(0, 0, 0, 0);
      return dateOnly;
    }

    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ');
    }
    const utcDate = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    utcDate.setUTCHours(0, 0, 0, 0);
    return utcDate;
  }

  private toDateOnlyIso(date: Date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toFullPatientName(patient: {
    BN_HO_CHU_LOT?: string | null;
    BN_TEN?: string | null;
  }) {
    return [patient.BN_HO_CHU_LOT, patient.BN_TEN]
      .map((part) => (part || '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private genderLabel(value?: boolean | null) {
    if (value === true) return 'Nam';
    if (value === false) return 'Nu';
    return '-';
  }

  private async writePdfAuditLog(action: string, by: string, metadata?: any) {
    await this.prisma.aUDIT_LOG.create({
      data: {
        AL_TABLE: 'PDF_EXPORT',
        AL_ACTION: action,
        AL_PK: metadata ?? Prisma.JsonNull,
        AL_OLD: Prisma.JsonNull,
        AL_NEW: metadata ?? Prisma.JsonNull,
        AL_CHANGED_BY: by,
      },
    });
  }

  private getWeekdayFromDate(date: Date) {
    return date.getUTCDay();
  }

  private getWeekMondayFromDate(date: Date) {
    const monday = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    monday.setUTCHours(0, 0, 0, 0);
    monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return monday;
  }

  private getNextWeekMondayFromNow() {
    const now = new Date();
    const utcToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const currentWeekMonday = this.getWeekMondayFromDate(utcToday);
    const nextWeekMonday = new Date(currentWeekMonday);
    nextWeekMonday.setUTCDate(currentWeekMonday.getUTCDate() + 7);
    return nextWeekMonday;
  }

  private assertAdminSundayActionForWeek(weekStart: Date, action: string) {
    if (!this.isSundayScheduleRestrictionEnabled()) {
      return;
    }

    const now = new Date();
    if (now.getDay() !== 0) {
      throw new ForbiddenException(
        `Chỉ được ${action} vào Chủ nhật trong khung duyệt lịch.`,
      );
    }

    const nextWeekMonday = this.getNextWeekMondayFromNow();
    if (this.toDateOnlyIso(weekStart) !== this.toDateOnlyIso(nextWeekMonday)) {
      throw new ForbiddenException(
        `Chỉ được ${action} cho tuần kế tiếp bắt đầu từ ${this.toDateOnlyIso(nextWeekMonday)}.`,
      );
    }
  }

  private isSundayScheduleRestrictionEnabled() {
    const raw = (process.env.ENFORCE_SUNDAY_SCHEDULE_ACTIONS || '')
      .trim()
      .toLowerCase();
    if (raw === '1' || raw === 'true' || raw === 'yes') {
      return true;
    }
    if (raw === '0' || raw === 'false' || raw === 'no') {
      return false;
    }
    return process.env.NODE_ENV === 'production';
  }

  private async ensureWeekNotFinalized(weekStartIso: string) {
    const mondayStart = this.parseDateOnlyOrThrow(weekStartIso);
    let weekBatch: any;
    let finalizedLog: any;
    try {
      [weekBatch, finalizedLog] = await this.prisma.$transaction([
        this.prisma.dOT_LICH_TUAN.findUnique({
          where: { DLT_TUAN_BAT_DAU: mondayStart },
        }),
        this.prisma.aUDIT_LOG.findFirst({
          where: {
            AL_TABLE: 'SCHEDULE_CYCLE',
            AL_ACTION: 'FINALIZED',
            AL_PK: { equals: { weekStart: weekStartIso } },
          },
          orderBy: { AL_CHANGED_AT: 'desc' },
        }),
      ]);
    } catch (e) {
      if (!this.isMissingColumnError(e)) {
        throw e;
      }
      this.logger.warn(
        'Missing schedule columns; skip finalized check for current operation.',
      );
      return;
    }

    if (
      (weekBatch &&
        (this.normalizeScheduleWeekStatus(weekBatch.DLT_TRANG_THAI) === 'finalized' ||
          this.normalizeScheduleWeekStatus(weekBatch.DLT_TRANG_THAI) === 'slot_opened')) ||
      finalizedLog
    ) {
      throw new ConflictException(
        'Tuần này đã được chốt lịch. Không thể chỉnh sửa thêm.',
      );
    }
  }

  private normalizeApprovalStatus(
    value: string | number | null | undefined,
  ): ScheduleApprovalStatus {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    if (normalized === 'approved') return 'approved';
    if (normalized === 'rejected') return 'rejected';
    if (normalized === '1') return 'approved';
    if (normalized === '-1') return 'rejected';
    return 'pending';
  }

  private resolveOfficialShiftDisplayStatus(
    isFinalized: boolean,
  ): OfficialShiftDisplayStatus {
    return isFinalized ? 'official' : 'approved';
  }

  private isLegacyScheduleFallbackEnabled() {
    return process.env.SCHEDULE_LEGACY_FALLBACK === 'true';
  }

  private isMissingScheduleApprovalColumnsError(e: unknown) {
    if (!this.isLegacyScheduleFallbackEnabled()) {
      return false;
    }
    if (!(e instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (e.code === 'P2022') {
      return true;
    }

    if (e.code !== 'P2007') {
      return false;
    }

    const haystack = `${e.message} ${JSON.stringify(e.meta ?? {})}`.toLowerCase();
    const isScheduleModel =
      haystack.includes('"modelname":"lich_bsk"') || haystack.includes('lich_bsk');
    if (!isScheduleModel) {
      return false;
    }

    if (haystack.includes('lbsk_trangthai_duyet')) {
      return true;
    }

    const isNumericStatusMismatch =
      haystack.includes('invalid input syntax for type numeric') &&
      (haystack.includes('"pending"') ||
        haystack.includes('"approved"') ||
        haystack.includes('"rejected"'));
    return isNumericStatusMismatch;
  }

  private isMissingColumnError(e: unknown) {
    if (!this.isLegacyScheduleFallbackEnabled()) {
      return false;
    }
    return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2022';
  }

  private parseLegacyScheduleStatus(rawNote?: string | null): {
    status: ScheduleApprovalStatus | 'official';
    note: string | null;
  } {
    if (!rawNote) {
      return { status: 'approved', note: null };
    }

    const trimmed = rawNote.trim();
    const markerMatch = /^\[#SCHEDULE_STATUS:(pending|approved|rejected|official)\]/i.exec(
      trimmed,
    );

    if (markerMatch) {
      const marker = markerMatch[1].toLowerCase() as
        | ScheduleApprovalStatus
        | 'official';
      const note = trimmed.slice(markerMatch[0].length).trim();
      return {
        status: marker,
        note: note.length > 0 ? note : null,
      };
    }

    return {
      status: 'approved',
      note: trimmed.length > 0 ? trimmed : null,
    };
  }

  private async getDailyScheduleContextRows(
    targetDate: Date,
    isWeekFinalized: boolean,
  ) {
    try {
      const rows = await this.prisma.lICH_BSK.findMany({
        where: { N_NGAY: targetDate, LBSK_IS_ARCHIVED: false },
        select: {
          BS_MA: true,
          P_MA: true,
          N_NGAY: true,
          B_TEN: true,
          LBSK_GHI_CHU: true,
          LBSK_TRANGTHAI_DUYET: true,
          BAC_SI: {
            select: { BS_HO_TEN: true },
          },
          PHONG: {
            select: { P_TEN: true },
          },
        },
      });

      return rows.map((row) => {
        const normalized = this.normalizeApprovalStatus(row.LBSK_TRANGTHAI_DUYET);
        const status = this.resolveDisplayStatusFromApproval(
          normalized,
          isWeekFinalized,
        );
        return {
          BS_MA: row.BS_MA,
          P_MA: row.P_MA,
          N_NGAY: row.N_NGAY,
          B_TEN: row.B_TEN,
          status,
          note: row.LBSK_GHI_CHU,
          doctorName: row.BAC_SI?.BS_HO_TEN || `BS #${row.BS_MA}`,
          roomName: row.PHONG?.P_TEN || `Phòng #${row.P_MA}`,
        };
      });
    } catch (e) {
      if (!this.isMissingScheduleApprovalColumnsError(e)) {
        throw e;
      }
    }

    const legacyRows = await this.prisma.lICH_BSK.findMany({
      where: { N_NGAY: targetDate },
      select: {
        BS_MA: true,
        P_MA: true,
        N_NGAY: true,
        B_TEN: true,
        LBSK_GHI_CHU: true,
        BAC_SI: {
          select: { BS_HO_TEN: true },
        },
        PHONG: {
          select: { P_TEN: true },
        },
      },
    });

    return legacyRows.map((row) => {
      const parsed = this.parseLegacyScheduleStatus(row.LBSK_GHI_CHU);
      const baseStatus: ScheduleDisplayStatus =
        parsed.status === 'official'
          ? 'official'
          : this.resolveDisplayStatusFromApproval(parsed.status, isWeekFinalized);
      return {
        BS_MA: row.BS_MA,
        P_MA: row.P_MA,
        N_NGAY: row.N_NGAY,
        B_TEN: row.B_TEN,
        status: baseStatus,
        note: parsed.note,
        doctorName: row.BAC_SI?.BS_HO_TEN || `BS #${row.BS_MA}`,
        roomName: row.PHONG?.P_TEN || `Phòng #${row.P_MA}`,
      };
    });
  }

  private resolveDisplayStatusFromApproval(
    status: ScheduleApprovalStatus,
    isWeekFinalized: boolean,
  ): ScheduleDisplayStatus {
    if (status === 'pending') return 'pending';
    if (status === 'rejected') return 'rejected';
    return isWeekFinalized ? 'official' : 'approved';
  }

  private isOccupiedScheduleStatus(status?: ScheduleDisplayStatus) {
    return status === 'pending' || status === 'approved' || status === 'official';
  }

  private getDisplayStatusPriority(status: ScheduleDisplayStatus) {
    if (status === 'official') return 4;
    if (status === 'approved') return 3;
    if (status === 'pending') return 2;
    if (status === 'rejected') return 1;
    return 0;
  }

  private buildMissingShiftSummary(params: {
    mondayStart: Date;
    saturdayEnd: Date;
    sessions: string[];
    approvedSchedules: Array<{ N_NGAY: Date; B_TEN: string }>;
  }) {
    const coverageSet = new Set<string>();
    for (const row of params.approvedSchedules) {
      const dateIso = this.toDateOnlyIso(row.N_NGAY);
      coverageSet.add(`${dateIso}::${row.B_TEN}`);
    }

    const days: string[] = [];
    const cursor = new Date(params.mondayStart);
    cursor.setUTCHours(0, 0, 0, 0);
    while (cursor <= params.saturdayEnd) {
      days.push(this.toDateOnlyIso(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const missingItems: Array<{ date: string; weekday: number; session: string }> =
      [];
    for (const dateIso of days) {
      const dateObj = this.parseDateOnlyOrThrow(dateIso);
      const weekday = this.getWeekdayFromDate(dateObj);
      for (const session of params.sessions) {
        if (!coverageSet.has(`${dateIso}::${session}`)) {
          missingItems.push({ date: dateIso, weekday, session });
        }
      }
    }

    return {
      totalMissing: missingItems.length,
      items: missingItems,
    };
  }

  private async assertNoApprovalConflicts(params: {
    BS_MA: number;
    P_MA: number;
    N_NGAY: Date;
    B_TEN: string;
    currentKey?: {
      BS_MA: number;
      N_NGAY: Date;
      B_TEN: string;
    };
  }) {
    const [doctorConflict, roomConflict] = await this.prisma.$transaction([
      this.prisma.lICH_BSK.findFirst({
        where: {
          BS_MA: params.BS_MA,
          N_NGAY: params.N_NGAY,
          B_TEN: params.B_TEN,
          LBSK_TRANGTHAI_DUYET: 'approved',
          ...(params.currentKey
            ? {
                NOT: {
                  BS_MA: params.currentKey.BS_MA,
                  N_NGAY: params.currentKey.N_NGAY,
                  B_TEN: params.currentKey.B_TEN,
                },
              }
            : {}),
        },
        select: { BS_MA: true },
      }),
      this.prisma.lICH_BSK.findFirst({
        where: {
          P_MA: params.P_MA,
          N_NGAY: params.N_NGAY,
          B_TEN: params.B_TEN,
          LBSK_TRANGTHAI_DUYET: 'approved',
          ...(params.currentKey
            ? {
                NOT: {
                  BS_MA: params.currentKey.BS_MA,
                  N_NGAY: params.currentKey.N_NGAY,
                  B_TEN: params.currentKey.B_TEN,
                },
              }
            : {}),
        },
        select: { P_MA: true },
      }),
    ]);

    if (doctorConflict) {
      throw new ConflictException(
        'Bác sĩ đã có ca trực khác trong cùng ngày và buổi.',
      );
    }
    if (roomConflict) {
      throw new ConflictException(
        'Phòng đã có bác sĩ khác được duyệt trong cùng ngày và buổi.',
      );
    }
  }

  private async assertNoOfficialShiftOccupancyConflicts(params: {
    BS_MA: number;
    P_MA: number;
    N_NGAY: Date;
    B_TEN: string;
    currentKey?: {
      BS_MA: number;
      N_NGAY: Date;
      B_TEN: string;
    };
  }) {
    try {
      const [doctorConflict, roomConflict] = await this.prisma.$transaction([
        this.prisma.lICH_BSK.findFirst({
          where: {
            BS_MA: params.BS_MA,
            N_NGAY: params.N_NGAY,
            B_TEN: params.B_TEN,
            LBSK_IS_ARCHIVED: false,
            LBSK_TRANGTHAI_DUYET: { in: ['pending', 'approved'] },
            ...(params.currentKey
              ? {
                  NOT: {
                    BS_MA: params.currentKey.BS_MA,
                    N_NGAY: params.currentKey.N_NGAY,
                    B_TEN: params.currentKey.B_TEN,
                  },
                }
              : {}),
          },
          select: { BS_MA: true },
        }),
        this.prisma.lICH_BSK.findFirst({
          where: {
            P_MA: params.P_MA,
            N_NGAY: params.N_NGAY,
            B_TEN: params.B_TEN,
            LBSK_IS_ARCHIVED: false,
            LBSK_TRANGTHAI_DUYET: { in: ['pending', 'approved'] },
            ...(params.currentKey
              ? {
                  NOT: {
                    BS_MA: params.currentKey.BS_MA,
                    N_NGAY: params.currentKey.N_NGAY,
                    B_TEN: params.currentKey.B_TEN,
                  },
                }
              : {}),
          },
          select: { P_MA: true },
        }),
      ]);

      if (roomConflict) {
        throw new ConflictException(
          'Buổi này của phòng đã có bác sĩ được phân công.',
        );
      }
      if (doctorConflict) {
        throw new ConflictException(
          'Bác sĩ này đã có ca trực khác trong cùng buổi.',
        );
      }
      return;
    } catch (e) {
      if (!this.isMissingScheduleApprovalColumnsError(e)) {
        throw e;
      }
    }

    await this.assertNoOfficialShiftOccupancyConflictsLegacy(params);
  }

  private async assertNoApprovalConflictsLegacy(params: {
    BS_MA: number;
    P_MA: number;
    N_NGAY: Date;
    B_TEN: string;
    currentKey?: {
      BS_MA: number;
      N_NGAY: Date;
      B_TEN: string;
    };
  }) {
    const candidates = await this.prisma.lICH_BSK.findMany({
      where: {
        LBSK_IS_ARCHIVED: false,
        N_NGAY: params.N_NGAY,
        B_TEN: params.B_TEN,
        OR: [{ BS_MA: params.BS_MA }, { P_MA: params.P_MA }],
      },
      select: {
        BS_MA: true,
        P_MA: true,
        N_NGAY: true,
        B_TEN: true,
        LBSK_GHI_CHU: true,
      },
    });

    const activeRows = candidates.filter((row) => {
      const isCurrent =
        params.currentKey &&
        row.BS_MA === params.currentKey.BS_MA &&
        this.toDateOnlyIso(row.N_NGAY) === this.toDateOnlyIso(params.currentKey.N_NGAY) &&
        row.B_TEN === params.currentKey.B_TEN;
      if (isCurrent) return false;
      const parsed = this.parseLegacyScheduleStatus(row.LBSK_GHI_CHU);
      return parsed.status === 'approved' || parsed.status === 'official';
    });

    if (activeRows.some((row) => row.BS_MA === params.BS_MA)) {
      throw new ConflictException(
        'Bác sĩ đã có ca trực khác trong cùng ngày và buổi.',
      );
    }
    if (activeRows.some((row) => row.P_MA === params.P_MA)) {
      throw new ConflictException(
        'Phòng đã có bác sĩ khác được duyệt trong cùng ngày và buổi.',
      );
    }
  }

  private async assertNoOfficialShiftOccupancyConflictsLegacy(params: {
    BS_MA: number;
    P_MA: number;
    N_NGAY: Date;
    B_TEN: string;
    currentKey?: {
      BS_MA: number;
      N_NGAY: Date;
      B_TEN: string;
    };
  }) {
    const candidates = await this.prisma.lICH_BSK.findMany({
      where: {
        LBSK_IS_ARCHIVED: false,
        N_NGAY: params.N_NGAY,
        B_TEN: params.B_TEN,
        OR: [{ BS_MA: params.BS_MA }, { P_MA: params.P_MA }],
      },
      select: {
        BS_MA: true,
        P_MA: true,
        N_NGAY: true,
        B_TEN: true,
        LBSK_GHI_CHU: true,
      },
    });

    const activeRows = candidates.filter((row) => {
      const isCurrent =
        params.currentKey &&
        row.BS_MA === params.currentKey.BS_MA &&
        this.toDateOnlyIso(row.N_NGAY) === this.toDateOnlyIso(params.currentKey.N_NGAY) &&
        row.B_TEN === params.currentKey.B_TEN;
      if (isCurrent) return false;
      const parsed = this.parseLegacyScheduleStatus(row.LBSK_GHI_CHU);
      return (
        parsed.status === 'pending' ||
        parsed.status === 'approved' ||
        parsed.status === 'official'
      );
    });

    if (activeRows.some((row) => row.P_MA === params.P_MA)) {
      throw new ConflictException(
        'Buổi này của phòng đã có bác sĩ được phân công.',
      );
    }
    if (activeRows.some((row) => row.BS_MA === params.BS_MA)) {
      throw new ConflictException(
        'Bác sĩ này đã có ca trực khác trong cùng buổi.',
      );
    }
  }

  private mergeAdminNote(currentNote?: string | null, adminNote?: string) {
    const current = currentNote?.trim() || '';
    const incoming = adminNote?.trim() || '';
    if (!incoming) return current || null;
    if (!current) return incoming;
    return `${current}\n[ADMIN] ${incoming}`;
  }

  private buildLegacyScheduleStatusNote(
    status: ScheduleApprovalStatus | 'official',
    note?: string | null,
  ) {
    const marker = `[#SCHEDULE_STATUS:${status}]`;
    const normalizedNote = note?.trim() || '';
    return normalizedNote.length > 0 ? `${marker}\n${normalizedNote}` : marker;
  }

  private rethrowOfficialShiftLegacyWriteError(e: unknown): never {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      (e.code === 'P2002' || this.isRawUniqueViolation(e))
    ) {
      throw new ConflictException(
        'Trùng lịch trực: bác sĩ hoặc phòng đã có lịch trong cùng ngày và buổi.',
      );
    }
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      (e.code === 'P2003' || this.isRawForeignKeyViolation(e))
    ) {
      throw new BadRequestException('Dữ liệu ca trực không hợp lệ.');
    }
    mapPrismaError(e);
  }

  private async ensureScheduleDateExists(targetDate: Date) {
    const client = this.prisma.getClient();
    const dateOnly = this.toDateOnlyIso(targetDate);
    await client.$executeRaw(Prisma.sql`
      INSERT INTO "NGAY" ("N_NGAY")
      VALUES (${dateOnly})
      ON CONFLICT ("N_NGAY") DO NOTHING
    `);
  }

  private async ensureScheduleDatesForWeek(mondayStart: Date) {
    const cursor = new Date(mondayStart);
    cursor.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < 6; i += 1) {
      await this.ensureScheduleDateExists(cursor);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  private getRollingScheduleWindow(horizonMonths: number) {
    const now = new Date();
    const utcToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const horizonEnd = new Date(utcToday);
    horizonEnd.setUTCMonth(horizonEnd.getUTCMonth() + horizonMonths);

    const windowStart = this.getWeekMondayFromDate(utcToday);
    const windowEnd = this.getWeekMondayFromDate(horizonEnd);
    return { windowStart, windowEnd, horizonEnd };
  }

  private async getDoctorScheduleOwnerOrThrow(BS_MA: number) {
    const doctor = await this.prisma.bAC_SI.findUnique({
      where: { BS_MA },
      select: {
        BS_MA: true,
        BS_HO_TEN: true,
        CK_MA: true,
        BS_DA_XOA: true,
        CHUYEN_KHOA: { select: { CK_TEN: true } },
      },
    });

    if (!doctor || doctor.BS_DA_XOA) {
      throw new NotFoundException('Không tìm thấy bác sĩ hợp lệ');
    }

    return doctor;
  }

  private isDoctorFacingSession(session: string) {
    const normalized = session.trim().toUpperCase();
    return normalized === 'SANG' || normalized === 'CHIEU';
  }

  private assertDoctorTargetsNextWeek(targetDate: Date, action: string) {
    const nextWeekMonday = this.getNextWeekMondayFromNow();
    const { saturdayEnd } = this.resolveWeekRange(this.toDateOnlyIso(nextWeekMonday));
    const day = targetDate.getUTCDay();

    if (day < 1 || day > 6) {
      throw new BadRequestException(
        'Bác sĩ chỉ được thao tác lịch trực từ thứ 2 đến thứ 7.',
      );
    }

    if (targetDate < nextWeekMonday || targetDate > saturdayEnd) {
      throw new ForbiddenException(
        `Chỉ được ${action} cho tuần kế tiếp từ ${this.toDateOnlyIso(nextWeekMonday)} đến ${this.toDateOnlyIso(saturdayEnd)}.`,
      );
    }

    return this.toDateOnlyIso(nextWeekMonday);
  }

  private assertDoctorRegistrationWindowForDate(targetDate: Date, action: string) {
    const weekStartIso = this.assertDoctorTargetsNextWeek(targetDate, action);
    const nextWeekMonday = this.parseDateOnlyOrThrow(weekStartIso);
    const registrationCloseAt = new Date(nextWeekMonday);
    registrationCloseAt.setUTCDate(nextWeekMonday.getUTCDate() - 2);
    registrationCloseAt.setUTCHours(23, 59, 59, 999);

    if (new Date() > registrationCloseAt) {
      throw new ForbiddenException(
        'Đăng ký lịch trực đã bị khóa sau hết ngày thứ 7. Vui lòng chờ admin chốt lịch.',
      );
    }

    return weekStartIso;
  }

  private isRawUniqueViolation(e: Prisma.PrismaClientKnownRequestError) {
    if (e.code !== 'P2010') return false;
    const haystack = `${e.message} ${JSON.stringify(e.meta ?? {})}`.toLowerCase();
    return (
      haystack.includes('23505') ||
      haystack.includes('duplicate key value') ||
      haystack.includes('uniqueconstraintviolation')
    );
  }

  private isRawForeignKeyViolation(e: Prisma.PrismaClientKnownRequestError) {
    if (e.code !== 'P2010') return false;
    const haystack = `${e.message} ${JSON.stringify(e.meta ?? {})}`.toLowerCase();
    return (
      haystack.includes('23503') ||
      haystack.includes('foreign key constraint') ||
      haystack.includes('foreignkeyconstraintviolation')
    );
  }

  private async validateDoctorRoomSpecialty(BS_MA: number, P_MA: number) {
    const [doctor, room] = await this.prisma.$transaction([
      this.prisma.bAC_SI.findUnique({
        where: { BS_MA },
        select: { BS_MA: true, CK_MA: true, BS_DA_XOA: true },
      }),
      this.prisma.pHONG.findUnique({
        where: { P_MA },
        select: { P_MA: true, CK_MA: true },
      }),
    ]);

    if (!doctor || doctor.BS_DA_XOA) {
      throw new NotFoundException('Không tìm thấy bác sĩ hợp lệ');
    }
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng khám');
    }
    if (doctor.CK_MA !== room.CK_MA) {
      throw new ConflictException(
        'Bác sĩ chỉ được phân vào phòng thuộc cùng chuyên khoa.',
      );
    }
  }

  private validateScheduleDateForAdmin(targetDate: Date) {
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    today.setUTCHours(0, 0, 0, 0);
    if (targetDate < today) {
      throw new BadRequestException(
        'Không thể tạo/cập nhật lịch trực cho ngày đã qua.',
      );
    }
    const day = targetDate.getUTCDay();
    if (day < 1 || day > 6) {
      throw new BadRequestException(
        'Lịch trực chỉ được lập từ thứ 2 đến thứ 7.',
      );
    }
  }
}






