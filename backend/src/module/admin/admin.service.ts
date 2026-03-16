import {
  BadRequestException,
  ConflictException,
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
import { SERVICE_TYPE_SET } from './constants/service-type.constants';
import {
  buildScheduleNote,
  parseScheduleStatus,
  type ScheduleWorkflowStatus,
} from '../schedules/schedule-status.util';

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
      // 1. Daily Operations (Vận hành khám bệnh hôm nay)
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
      // 2. Financials & Staff (Tài chính & Nhân sự)
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
      // 3. Top Doctors (Bác sĩ nổi bật trong tháng)
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
          name: docInfo?.BS_HO_TEN || 'BS Không xác định',
          specialty: docInfo?.CHUYEN_KHOA?.CK_TEN || '',
          avatar: docInfo?.BS_ANH,
          visits: td._count.BS_MA,
        };
      });

      this.logger.debug("Executing chunk 4 (Inventory)...");
      // 4. Inventory (Cảnh báo thuốc sắp hết hạn <= 30 ngày)
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
        const patientName = `${activity.BENH_NHAN?.BN_HO_CHU_LOT || ''} ${activity.BENH_NHAN?.BN_TEN || ''}`.trim() || 'Bệnh nhân ẩn danh';
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
      // 3. Chart Data (Dữ liệu biểu đồ lượt khám - 7 ngày gần nhất)
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
          name: `Tháng ${month + 1}`,
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
          date: `Tháng ${month + 1}`,
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
        // Lấy KHUNG_GIO để biết giờ khám
        KHUNG_GIO: {
          // Có thể thêm điều kiện KHUNG_GIO nếu cần
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
            TT_TRANG_THAI: 'DA_THANH_TOAN', // Giả sử trạng thái này
          },
          select: { TT_TONG_TIEN: true }
        });

        const revenue = payments.reduce((sum, p) => sum + Number(p.TT_TONG_TIEN || 0), 0);

        chartData.push({
          date: `Tháng ${month + 1}`,
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
          'Không thể xóa dịch vụ vì dịch vụ này đã phát sinh chỉ định hoặc kết quả cận lâm sàng trong hồ sơ khám. Vui lòng ngừng sử dụng hoặc cập nhật dịch vụ thay vì xóa.',
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
      const { mondayStart, saturdayEnd, sundayEnd, weekStartIso, weekEndIso } =
        this.resolveWeekRange(weekStartRaw);
      const now = new Date();

      const schedules = await this.prisma.lICH_BSK.findMany({
        where: {
          N_NGAY: {
            gte: mondayStart,
            lte: saturdayEnd,
          },
        },
        select: { LBSK_GHI_CHU: true },
      });

      let pending = 0;
      let approved = 0;
      let rejected = 0;
      let official = 0;
      for (const schedule of schedules) {
        const { status } = parseScheduleStatus(schedule.LBSK_GHI_CHU);
        if (status === 'pending') pending += 1;
        else if (status === 'approved') approved += 1;
        else if (status === 'rejected') rejected += 1;
        else official += 1;
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
        finalizedLog != null ? 'finalized' : now <= saturdayEnd ? 'open' : 'locked';

      return {
        weekStartDate: weekStartIso,
        weekEndDate: weekEndIso,
        registrationOpenAt: mondayStart.toISOString(),
        registrationCloseAt: saturdayEnd.toISOString(),
        adminReviewWindowEndAt: sundayEnd.toISOString(),
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
      };
    } catch (e) {
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
          const parsed = parseScheduleStatus(row.LBSK_GHI_CHU);
          return {
            BS_MA: row.BS_MA,
            N_NGAY: row.N_NGAY,
            B_TEN: row.B_TEN,
            P_MA: row.P_MA,
            status: parsed.status,
            note: parsed.note,
            doctor: row.BAC_SI,
            room: row.PHONG,
            submittedAt: null as string | null,
          };
        })
        .filter((row) => row.status === 'pending' || row.status === 'approved' || row.status === 'rejected')
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
    } catch (e) {
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
      const existing = await this.prisma.lICH_BSK.findUnique({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: targetDate, B_TEN } },
      });
      if (!existing) {
        throw new NotFoundException('Không tìm thấy ca đăng ký cần cập nhật');
      }

      const parsed = parseScheduleStatus(existing.LBSK_GHI_CHU);
      if (parsed.status !== 'pending' && parsed.status !== 'approved' && parsed.status !== 'rejected') {
        throw new ConflictException(
          'Ca trực này không thuộc nhóm đăng ký chờ duyệt nên không thể cập nhật theo luồng duyệt.',
        );
      }

      const mergedNote = this.mergeAdminNote(parsed.note, payload.adminNote);

      return await this.prisma.lICH_BSK.update({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: targetDate, B_TEN } },
        data: {
          LBSK_GHI_CHU: buildScheduleNote(payload.status, mergedNote),
        },
      });
    } catch (e) {
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
      });

      const mapped = allRows
        .map((row) => {
          const parsed = parseScheduleStatus(row.LBSK_GHI_CHU);
          return {
            BS_MA: row.BS_MA,
            N_NGAY: row.N_NGAY,
            B_TEN: row.B_TEN,
            P_MA: row.P_MA,
            status: parsed.status,
            note: parsed.note,
            doctor: row.BAC_SI,
            room: row.PHONG,
            slotCount: row.BUOI?.KHUNG_GIO?.length ?? 0,
          };
        })
        .filter((row) => row.status === 'official' || row.status === 'approved')
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
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async createOfficialSchedule(payload: {
    BS_MA: number;
    P_MA: number;
    N_NGAY: string;
    B_TEN: string;
    note?: string;
    status?: ScheduleWorkflowStatus;
  }) {
    try {
      const targetDate = this.parseDateOnlyOrThrow(payload.N_NGAY);
      this.validateScheduleDateForAdmin(targetDate);
      await this.validateDoctorRoomSpecialty(payload.BS_MA, payload.P_MA);

      return await this.prisma.lICH_BSK.create({
        data: {
          BS_MA: payload.BS_MA,
          P_MA: payload.P_MA,
          N_NGAY: targetDate,
          B_TEN: payload.B_TEN,
          LBSK_GHI_CHU: buildScheduleNote(payload.status || 'official', payload.note),
        },
      });
    } catch (e) {
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
      status?: ScheduleWorkflowStatus;
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
      const currentParsed = parseScheduleStatus(existing.LBSK_GHI_CHU);
      const nextStatus = payload.status ?? currentParsed.status;
      const nextNote = payload.note ?? currentParsed.note ?? undefined;
      this.validateScheduleDateForAdmin(nextDate);
      await this.validateDoctorRoomSpecialty(nextDoctorId, nextRoomId);

      return await this.prisma.lICH_BSK.update({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: oldDate, B_TEN } },
        data: {
          BS_MA: nextDoctorId,
          P_MA: nextRoomId,
          N_NGAY: nextDate,
          B_TEN: nextSession,
          LBSK_GHI_CHU: buildScheduleNote(nextStatus, nextNote),
        },
      });
    } catch (e) {
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
      await this.prisma.lICH_BSK.delete({
        where: { BS_MA_N_NGAY_B_TEN: { BS_MA, N_NGAY: targetDate, B_TEN } },
      });
      return { message: 'Xóa ca trực thành công' };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
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
      const existingFinalizeLog = await this.prisma.aUDIT_LOG.findFirst({
        where: {
          AL_TABLE: 'SCHEDULE_CYCLE',
          AL_ACTION: 'FINALIZED',
          AL_PK: { equals: { weekStart: weekStartIso } },
        },
        orderBy: { AL_CHANGED_AT: 'desc' },
      });

      if (existingFinalizeLog && !options?.forceRefinalize) {
        throw new ConflictException(
          'Tuần này đã được chốt lịch. Nếu cần chốt lại, hãy bật chế độ chốt lại có chủ đích.',
        );
      }

      const rows = await this.prisma.lICH_BSK.findMany({
        where: { N_NGAY: { gte: mondayStart, lte: saturdayEnd } },
        select: { BS_MA: true, N_NGAY: true, B_TEN: true, LBSK_GHI_CHU: true },
      });

      const pendingCount = rows.filter(
        (row) => parseScheduleStatus(row.LBSK_GHI_CHU).status === 'pending',
      ).length;
      if (pendingCount > 0) {
        throw new ConflictException(
          `Vẫn còn ${pendingCount} đăng ký ở trạng thái chờ duyệt. Vui lòng duyệt hoặc từ chối trước khi chốt lịch.`,
        );
      }

      await this.prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const parsed = parseScheduleStatus(row.LBSK_GHI_CHU);
          if (parsed.status === 'approved') {
            await tx.lICH_BSK.update({
              where: {
                BS_MA_N_NGAY_B_TEN: {
                  BS_MA: row.BS_MA,
                  N_NGAY: row.N_NGAY,
                  B_TEN: row.B_TEN,
                },
              },
              data: {
                LBSK_GHI_CHU: buildScheduleNote('official', parsed.note),
              },
            });
          }
        }

        await tx.aUDIT_LOG.create({
          data: {
            AL_TABLE: 'SCHEDULE_CYCLE',
            AL_ACTION: 'FINALIZED',
            AL_PK: { weekStart: weekStartIso },
            AL_NEW: {
              finalizedAt: new Date().toISOString(),
            },
            AL_CHANGED_AT: new Date(),
          },
        });
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

      const existingGeneratedLog = await this.prisma.aUDIT_LOG.findFirst({
        where: {
          AL_TABLE: 'SCHEDULE_CYCLE',
          AL_ACTION: 'SLOTS_GENERATED',
          AL_PK: { equals: { weekStart: weekStartIso } },
        },
        orderBy: { AL_CHANGED_AT: 'desc' },
      });

      if (existingGeneratedLog && !options?.forceRegenerate) {
        throw new ConflictException(
          'Tuần này đã sinh slot trước đó. Nếu muốn sinh lại, hãy bật chế độ sinh lại có chủ đích.',
        );
      }

      const schedules = await this.prisma.lICH_BSK.findMany({
        where: { N_NGAY: { gte: mondayStart, lte: saturdayEnd } },
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

      const officialSchedules = schedules.filter((schedule) => {
        const { status } = parseScheduleStatus(schedule.LBSK_GHI_CHU);
        return status === 'official' || status === 'approved';
      });

      const totalSlots = officialSchedules.reduce(
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
              shiftCount: officialSchedules.length,
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
              shiftCount: officialSchedules.length,
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
        shiftCount: officialSchedules.length,
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
      mondayStart = new Date(now);
      mondayStart.setHours(0, 0, 0, 0);
      mondayStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    }

    mondayStart.setHours(0, 0, 0, 0);
    const saturdayEnd = new Date(mondayStart);
    saturdayEnd.setDate(mondayStart.getDate() + 5);
    saturdayEnd.setHours(23, 59, 59, 999);

    const sundayEnd = new Date(mondayStart);
    sundayEnd.setDate(mondayStart.getDate() + 6);
    sundayEnd.setHours(23, 59, 59, 999);

    return {
      mondayStart,
      saturdayEnd,
      sundayEnd,
      weekStartIso: this.toDateOnlyIso(mondayStart),
      weekEndIso: this.toDateOnlyIso(saturdayEnd),
    };
  }

  private parseDateOnlyOrThrow(dateRaw: string) {
    const date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ');
    }
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private toDateOnlyIso(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private mergeAdminNote(currentNote?: string | null, adminNote?: string) {
    const current = currentNote?.trim() || '';
    const incoming = adminNote?.trim() || '';
    if (!incoming) return current || null;
    if (!current) return incoming;
    return `${current}\n[ADMIN] ${incoming}`;
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (targetDate < today) {
      throw new BadRequestException(
        'Không thể tạo/cập nhật lịch trực cho ngày đã qua.',
      );
    }
    const day = targetDate.getDay();
    if (day < 1 || day > 6) {
      throw new BadRequestException(
        'Lịch trực chỉ được lập từ thứ 2 đến thứ 7.',
      );
    }
  }
}
