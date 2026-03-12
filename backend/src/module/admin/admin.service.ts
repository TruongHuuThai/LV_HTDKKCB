import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardSummary() {
    // 1. Stats (Thống kê tổng)
    const [totalPatients, totalDoctors, activeServices, newContacts] =
      await Promise.all([
        // Đếm bệnh nhân
        this.prisma.bENH_NHAN.count(),
        // Đếm bác sĩ (chưa xóa)
        this.prisma.bAC_SI.count({
          where: { BS_DA_XOA: false },
        }),
        // Đếm dịch vụ (gói khám) (Tạm tính là tất cả LOAI_HINH_KHAM)
        this.prisma.lOAI_HINH_KHAM.count(),
        // Đếm liên hệ mới (THONG_BAO tạo trong ngày hôm nay)
        this.prisma.tHONG_BAO.count({
          where: {
            TB_THOI_GIAN: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)), // Bắt đầu ngày hôm nay
            },
            // Nếu có trạng thái thay cho "chưa đọc", thêm vào đây
            // TB_TRANG_THAI: 'CHUA_DOC', 
          },
        }),
      ]);

    // 2. Recent Activities (Hoạt động gần đây - 5 đăng ký mới nhất)
    const recentActivitiesRaw = await this.prisma.dANG_KY.findMany({
      take: 5,
      orderBy: {
        DK_THOI_GIAN_TAO: 'desc', // Lấy mới nhất
      },
      include: {
        BENH_NHAN: {
          select: {
            BN_HO_CHU_LOT: true,
            BN_TEN: true,
          },
        },
      },
    });

    const recentActivities = recentActivitiesRaw.map((activity) => {
      const patientName = `${activity.BENH_NHAN?.BN_HO_CHU_LOT || ''} ${
        activity.BENH_NHAN?.BN_TEN || ''
      }`.trim() || 'Bệnh nhân ẩn danh';
      
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

    // 3. Chart Data (Dữ liệu biểu đồ lượt khám - 7 ngày gần nhất)
    const chartData: { name: string; visits: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    for (let i = 6; i >= 0; i--) {
      // Calculate the date for the current iteration (from 6 days ago -> today)
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      
      const nextDate = new Date(targetDate);
      nextDate.setDate(targetDate.getDate() + 1);

      // Count registrations for this specific day
      const visits = await this.prisma.dANG_KY.count({
        where: {
          DK_THOI_GIAN_TAO: {
            gte: targetDate,
            lt: nextDate,
          },
        },
      });

      // Format name as purely "T" followed by day of week, or custom format.
      // E.g., Sunday = 0, Monday = 1.
      const dayOfWeekNum = targetDate.getDay();
      let name = '';
      if (dayOfWeekNum === 0) name = 'CN';
      else name = `T${dayOfWeekNum + 1}`;

      // To avoid duplicate names if covering multiple weeks (though we only do 7 days here),
      // we could also append the date: `T2 (${targetDate.getDate()}/${targetDate.getMonth()+1})`
      
      chartData.push({
        name,
        visits: visits || 0,
      });
    }

    return {
      stats: {
        totalPatients,
        totalDoctors,
        activeServices,
        newContacts,
      },
      recentActivities,
      chartData,
    };
  }
}
