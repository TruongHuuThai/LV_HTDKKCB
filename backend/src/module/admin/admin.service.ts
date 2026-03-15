import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { mapPrismaError } from '../../common/prisma/prisma-error.util';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { SERVICE_TYPE_SET } from './constants/service-type.constants';

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

  async getSpecialties() {
    return this.prisma.cHUYEN_KHOA.findMany({
      select: {
        CK_MA: true,
        CK_TEN: true,
      },
      orderBy: {
        CK_TEN: 'asc',
      }
    });
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
}
