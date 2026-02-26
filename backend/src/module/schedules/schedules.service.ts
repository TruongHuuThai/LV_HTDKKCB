import { ConflictException, Injectable } from '@nestjs/common';
import { SchedulesRepository } from './schedules.repository';
import { RegisterScheduleDto } from './dto/register-schedule.dto';
import { mapPrismaError } from '../../common/prisma/prisma-error.util';

@Injectable()
export class SchedulesService {
    constructor(private readonly repo: SchedulesRepository) { }

    async register(BS_MA: number, dto: RegisterScheduleDto) {
        // Chuyển đổi string N_NGAY sang Date (UTC) để query Prisma
        const date = new Date(dto.N_NGAY);

        try {
            return await this.repo.registerSchedule({
                BS_MA,
                P_MA: dto.P_MA,
                N_NGAY: date,
                B_TEN: dto.B_TEN,
                LBSK_GHI_CHU: dto.LBSK_GHI_CHU,
            });
        } catch (e: any) {
            // Bắt lỗi trùng khóa phức hợp [BS_MA, N_NGAY, B_TEN] hoặc [P_MA, N_NGAY, B_TEN]
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
}
