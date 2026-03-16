import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SchedulesRepository {
    constructor(private readonly prisma: PrismaService) { }

    registerSchedule(data: {
        BS_MA: number;
        P_MA: number;
        N_NGAY: Date;
        B_TEN: string;
        LBSK_GHI_CHU?: string;
    }) {
        return this.prisma.lICH_BSK.create({
            data: {
                BS_MA: data.BS_MA,
                P_MA: data.P_MA,
                N_NGAY: data.N_NGAY,
                B_TEN: data.B_TEN,
                LBSK_GHI_CHU: data.LBSK_GHI_CHU,
            },
        });
    }

    findDoctorSchedules(BS_MA: number, fromDate?: Date, toDate?: Date) {
        const where: any = { BS_MA };

        if (fromDate || toDate) {
            where.N_NGAY = {};
            if (fromDate) where.N_NGAY.gte = fromDate;
            if (toDate) where.N_NGAY.lte = toDate;
        }

        return this.prisma.lICH_BSK.findMany({
            where,
            include: {
                PHONG: true,
                BUOI: true,
            },
            orderBy: [
                { N_NGAY: 'asc' },
                { B_TEN: 'asc' },
            ],
        });
    }

    findDoctorById(BS_MA: number) {
        return this.prisma.bAC_SI.findUnique({
            where: { BS_MA },
            select: { BS_MA: true, CK_MA: true, BS_DA_XOA: true },
        });
    }

    findRoomById(P_MA: number) {
        return this.prisma.pHONG.findUnique({
            where: { P_MA },
            select: { P_MA: true, CK_MA: true },
        });
    }
}
