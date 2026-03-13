import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
// Note: Assuming you have a JwtAuthGuard and RolesGuard setup for admin
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('ADMIN') // Requires an admin role - adjust based on your actual auth setup
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/summary')
  @HttpCode(HttpStatus.OK)
  async getDashboardSummary() {
    return this.adminService.getDashboardSummary();
  }

  @Get('dashboard/chart-data')
  @HttpCode(HttpStatus.OK)
  async getChartData(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.adminService.getChartData(year, month);
  }
}
