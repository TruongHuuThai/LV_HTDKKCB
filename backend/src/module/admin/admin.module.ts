import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ScheduleAutomationService } from './schedule-automation.service';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [PrismaModule, PdfModule],
  controllers: [AdminController],
  providers: [AdminService, ScheduleAutomationService],
  exports: [AdminService],
})
export class AdminModule {}
