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

type ScheduleApprovalStatus = 'pending' | 'approved' | 'rejected';
type OfficialShiftDisplayStatus = 'approved' | 'official';
type ScheduleDisplayStatus =
  | 'empty'
  | 'pending'
  | 'approved'
  | 'official'
  | 'rejected';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private prisma: PrismaService) { }

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
        this.prisma.dANG_KY.count({ where: { N_NGAY: { gte: today, lt: tomorrow }, DK_TRANG_THAI: 'HUY' } }),
      ]);

      this.logger.debug("Executing chunk 2 (Financials)...");
      // 2. Financials & Staff (TĂ i chĂ­nh & NhĂ¢n sá»±)
      const [todayRevenueRaw, doctorsOnDutyToday] = await Promise.all([
        this.prisma.tHANH_TOAN.aggregate({
          _sum: { TT_TONG_TIEN: true },
          where: { TT_THOI_GIAN: { gte: today, lt: tomorrow }, TT_TRANG_THAI: 'DA_THANH_TOAN' },
        }),
        this.prisma.lICH_BSK.findMany({
          where: { N_NGAY: { gte: today, lt: tomorrow } },
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
        include: { BENH_NHAN: { select: { BN_HO_CHU_LOT: true, BN_TEN: true } } },
      });

      const recentActivities = recentActivitiesRaw.map((activity) => {
        const patientName =
          `${activity.BENH_NHAN?.BN_HO_CHU_LOT || ''} ${activity.BENH_NHAN?.BN_TEN || ''}`.trim() ||
          'Bệnh nhân ẩn danh';
        let actionStr = 'đã đăng ký lịch khám';
        if (activity.DK_TRANG_THAI === 'DA_KHAM') actionStr = 'đã hoàn thành khám';
        if (activity.DK_TRANG_THAI === 'HUY') actionStr = 'đã hủy lịch khám';

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
          name: `ThĂ¡ng ${month + 1}`,
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
          date: `ThĂ¡ng ${month + 1}`,
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
      include: {
        KHUNG_GIO: true
      }
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
          date: `ThĂ¡ng ${month + 1}`,
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

  async getScheduleCycleOverview(weekStartRaw?: string) {
    try {
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
            LBSK_TRANGTHAI_DUYET: true,
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
      for (const schedule of schedules) {
        const status = this.normalizeApprovalStatus(schedule.LBSK_TRANGTHAI_DUYET);
        if (status === 'pending') pending += 1;
        else if (status === 'approved') {
          approved += 1;
          officialCandidateCount += 1;
        } else {
          rejected += 1;
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
        approvedSchedules: schedules.filter(
          (row) => this.normalizeApprovalStatus(row.LBSK_TRANGTHAI_DUYET) === 'approved',
        ),
      });

      return {
        weekStartDate: weekStartIso,
        weekEndDate: weekEndIso,
        registrationOpenAt: registrationOpenAt.toISOString(),
        registrationCloseAt: registrationCloseAt.toISOString(),
        adminReviewWindowEndAt: adminReviewWindowEndAt.toISOString(),
        status: cycleStatus,
        finalizedAt: finalizedLog?.AL_CHANGED_AT || null,
        slotGeneratedAt: generatedLog?.AL_CHANGED_AT || null,
        summary: {
          total: schedules.length,
          pending,
          approved,
          rejected,
          official,
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
      if (!existing) {
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

      return await this.prisma.lICH_BSK.update({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: targetDate, B_TEN } },
        data: {
          LBSK_TRANGTHAI_DUYET: nextStatus,
          LBSK_GHI_CHU: mergedNote,
          LBSK_DUYET_BOI: 'ADMIN',
          LBSK_DUYET_LUC: reviewedAt,
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
                  select: { KG_MA: true },
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

      await this.ensureWeekNotFinalized(targetWeekStartIso);
      await this.ensureScheduleDateExists(targetDate);
      await this.validateDoctorRoomSpecialty(BS_MA, payload.P_MA);

      return await this.prisma.lICH_BSK.create({
        data: {
          BS_MA,
          P_MA: payload.P_MA,
          N_NGAY: targetDate,
          B_TEN: payload.B_TEN,
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

      return await this.prisma.lICH_BSK.update({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: currentDate, B_TEN } },
        data: {
          P_MA: payload.P_MA,
          N_NGAY: nextDate,
          B_TEN: payload.B_TEN,
          LBSK_TRANGTHAI_DUYET: 'pending',
          LBSK_GHI_CHU: payload.LBSK_GHI_CHU?.trim() || null,
          LBSK_DUYET_BOI: null,
          LBSK_DUYET_LUC: null,
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
      finalizedAt: finalizedLog?.AL_CHANGED_AT || null,
      slotGeneratedAt: generatedLog?.AL_CHANGED_AT || null,
      summary: {
        total: schedules.length,
        pending,
        approved,
        rejected,
        official,
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
                select: { KG_MA: true },
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
      this.assertAdminSundayActionForWeek(targetWeekStart, 'điều chỉnh lịch trực tuần');
      await this.ensureWeekNotFinalized(this.toDateOnlyIso(targetWeekStart));
      await this.validateDoctorRoomSpecialty(payload.BS_MA, payload.P_MA);
      await this.assertNoOfficialShiftOccupancyConflicts({
        BS_MA: payload.BS_MA,
        P_MA: payload.P_MA,
        N_NGAY: targetDate,
        B_TEN: payload.B_TEN,
      });

      return await this.prisma.lICH_BSK.create({
        data: {
          BS_MA: payload.BS_MA,
          P_MA: payload.P_MA,
          N_NGAY: targetDate,
          B_TEN: payload.B_TEN,
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
      if (!existing) {
        throw new NotFoundException('Không tìm thấy ca trực cần cập nhật');
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
          LBSK_TRANGTHAI_DUYET: 'approved',
          LBSK_GHI_CHU: nextNote,
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
      this.assertAdminSundayActionForWeek(mondayStart, 'chốt lịch trực tuần');
      const existingFinalizeLog = await this.prisma.aUDIT_LOG.findFirst({
        where: {
          AL_TABLE: 'SCHEDULE_CYCLE',
          AL_ACTION: 'FINALIZED',
          AL_PK: { equals: { weekStart: weekStartIso } },
        },
        orderBy: { AL_CHANGED_AT: 'desc' },
      });

      if (existingFinalizeLog) {
        throw new ConflictException(
          'Tuần này đã được chốt lịch. Nếu cần chốt lại, hãy bật chế độ chốt lại có chủ đích.',
        );
      }

      const rows = await this.prisma.lICH_BSK.findMany({
        where: { N_NGAY: { gte: mondayStart, lte: saturdayEnd } },
        select: { LBSK_TRANGTHAI_DUYET: true },
      });

      const pendingCount = rows.filter(
        (row) => this.normalizeApprovalStatus(row.LBSK_TRANGTHAI_DUYET) === 'pending',
      ).length;
      if (pendingCount > 0) {
        throw new ConflictException(
          `Vẫn còn ${pendingCount} đăng ký ở trạng thái chờ duyệt. Vui lòng duyệt hoặc từ chối trước khi chốt lịch.`,
        );
      }

      const approvedCount = rows.filter(
        (row) => this.normalizeApprovalStatus(row.LBSK_TRANGTHAI_DUYET) === 'approved',
      ).length;

      const finalizedAt = new Date();
      await this.prisma.aUDIT_LOG.create({
        data: {
          AL_TABLE: 'SCHEDULE_CYCLE',
          AL_ACTION: 'FINALIZED',
          AL_PK: { weekStart: weekStartIso },
          AL_NEW: {
            finalizedAt: finalizedAt.toISOString(),
            approvedShiftCount: approvedCount,
          },
          AL_CHANGED_AT: finalizedAt,
        },
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
        approvedShiftCount: approvedCount,
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
      this.assertAdminSundayActionForWeek(
        mondayStart,
        'sinh slot cho lịch trực tuần',
      );

      const [finalizedLog, existingGeneratedLog] = await this.prisma.$transaction([
        this.prisma.aUDIT_LOG.findFirst({
          where: {
            AL_TABLE: 'SCHEDULE_CYCLE',
            AL_ACTION: 'FINALIZED',
            AL_PK: { equals: { weekStart: weekStartIso } },
          },
          orderBy: { AL_CHANGED_AT: 'desc' },
        }),
        this.prisma.aUDIT_LOG.findFirst({
          where: {
            AL_TABLE: 'SCHEDULE_CYCLE',
            AL_ACTION: 'SLOTS_GENERATED',
            AL_PK: { equals: { weekStart: weekStartIso } },
          },
          orderBy: { AL_CHANGED_AT: 'desc' },
        }),
      ]);

      if (!finalizedLog) {
        throw new ConflictException(
          'Chỉ có thể sinh slot sau khi tuần đã được chốt lịch chính thức.',
        );
      }

      if (existingGeneratedLog && !options?.forceRegenerate) {
        throw new ConflictException(
          'Tuần này đã sinh slot trước đó. Nếu muốn sinh lại, hãy bật chế độ sinh lại có chủ đích.',
        );
      }

      const schedules = await this.prisma.lICH_BSK.findMany({
        where: {
          N_NGAY: { gte: mondayStart, lte: saturdayEnd },
          LBSK_TRANGTHAI_DUYET: 'approved',
        },
        include: {
          BUOI: {
            include: {
              KHUNG_GIO: {
                select: { KG_MA: true },
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
    const finalizedLog = await this.prisma.aUDIT_LOG.findFirst({
      where: {
        AL_TABLE: 'SCHEDULE_CYCLE',
        AL_ACTION: 'FINALIZED',
        AL_PK: { equals: { weekStart: weekStartIso } },
      },
      orderBy: { AL_CHANGED_AT: 'desc' },
    });

    if (finalizedLog) {
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

  private isMissingScheduleApprovalColumnsError(e: unknown) {
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
        where: { N_NGAY: targetDate },
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






