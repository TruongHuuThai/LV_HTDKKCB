import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SchedulesRepository } from './schedules.repository';
import { RegisterScheduleDto } from './dto/register-schedule.dto';
import { mapPrismaError } from '../../common/prisma/prisma-error.util';
import { buildScheduleNote } from './schedule-status.util';

@Injectable()
export class SchedulesService {
  constructor(private readonly repo: SchedulesRepository) {}

  async register(BS_MA: number, dto: RegisterScheduleDto) {
    this.validateDoctorSelfRegistrationWindow(dto.N_NGAY);
    await this.validateDoctorRoomSpecialty(BS_MA, dto.P_MA);

    const date = new Date(dto.N_NGAY);

    try {
      return await this.repo.registerSchedule({
        BS_MA,
        P_MA: dto.P_MA,
        N_NGAY: date,
        B_TEN: dto.B_TEN,
        LBSK_GHI_CHU: buildScheduleNote('pending', dto.LBSK_GHI_CHU),
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(
          'Lịch trực bị trùng lặp. Bác sĩ hoặc phòng này đã có lịch trong buổi hôm đó.',
        );
      }
      mapPrismaError(e);
    }
  }

  async getMySchedules(BS_MA: number, fromDateStr?: string, toDateStr?: string) {
    const fromDate = fromDateStr ? new Date(fromDateStr) : undefined;
    const toDate = toDateStr ? new Date(toDateStr) : undefined;

    return this.repo.findDoctorSchedules(BS_MA, fromDate, toDate);
  }

  private validateDoctorSelfRegistrationWindow(targetDateIso: string) {
    const now = new Date();
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday ... 6=Saturday

    if (currentDay === 0) {
      throw new ForbiddenException(
        'Hết thời gian đăng ký lịch trực trong tuần. Chủ nhật là thời gian admin duyệt và chốt lịch.',
      );
    }

    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));

    const saturdayEnd = new Date(monday);
    saturdayEnd.setDate(monday.getDate() + 5);
    saturdayEnd.setHours(23, 59, 59, 999);

    const targetDate = new Date(targetDateIso);
    if (Number.isNaN(targetDate.getTime())) {
      throw new BadRequestException('Ngày đăng ký lịch trực không hợp lệ');
    }

    const targetDay = targetDate.getDay();
    if (targetDay < 1 || targetDay > 6) {
      throw new BadRequestException('Bác sĩ chỉ được đăng ký lịch trực từ thứ 2 đến thứ 7.');
    }

    if (targetDate < monday || targetDate > saturdayEnd) {
      throw new ForbiddenException(
        'Chỉ được đăng ký lịch trực trong chu kỳ tuần hiện tại (thứ 2 đến thứ 7).',
      );
    }
  }

  private async validateDoctorRoomSpecialty(BS_MA: number, P_MA: number) {
    const [doctor, room] = await Promise.all([
      this.repo.findDoctorById(BS_MA),
      this.repo.findRoomById(P_MA),
    ]);

    if (!doctor || doctor.BS_DA_XOA) {
      throw new BadRequestException('Không tìm thấy bác sĩ hợp lệ');
    }
    if (!room) {
      throw new BadRequestException('Không tìm thấy phòng khám');
    }
    if (doctor.CK_MA !== room.CK_MA) {
      throw new BadRequestException(
        'Bác sĩ chỉ được đăng ký phòng thuộc cùng chuyên khoa.',
      );
    }
  }
}
