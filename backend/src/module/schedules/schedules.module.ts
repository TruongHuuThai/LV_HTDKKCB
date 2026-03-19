import { Module } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { SchedulesRepository } from './schedules.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminModule } from '../admin/admin.module';

@Module({
    imports: [PrismaModule, AdminModule],
    controllers: [SchedulesController],
    providers: [SchedulesService, SchedulesRepository],
    exports: [SchedulesService],
})
export class SchedulesModule { }
