import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
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

  @Get('dashboard/visits')
  @HttpCode(HttpStatus.OK)
  async getDashboardVisits(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('specialtyId') specialtyId?: string,
  ) {
    return this.adminService.getDashboardVisits(year, month, specialtyId);
  }

  @Get('dashboard/time-slots')
  @HttpCode(HttpStatus.OK)
  async getDashboardTimeSlots(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.adminService.getDashboardTimeSlots(year, month);
  }

  @Get('dashboard/revenue')
  @HttpCode(HttpStatus.OK)
  async getDashboardRevenue(
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.adminService.getDashboardRevenue(year, month);
  }

  @Get('specialties')
  @HttpCode(HttpStatus.OK)
  async getSpecialties() {
    return this.adminService.getSpecialties();
  }

  @Get('services')
  @HttpCode(HttpStatus.OK)
  async getServices(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('serviceType') serviceType?: string,
  ) {
    return this.adminService.getServices({
      search,
      page,
      limit,
      sortBy,
      sortOrder,
      minPrice,
      maxPrice,
      serviceType,
    });
  }

  @Get('services/:id')
  @HttpCode(HttpStatus.OK)
  async getServiceById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getServiceById(id);
  }

  @Post('services')
  @HttpCode(HttpStatus.CREATED)
  async createService(@Body() dto: CreateServiceDto) {
    return this.adminService.createService(dto);
  }

  @Put('services/:id')
  @HttpCode(HttpStatus.OK)
  async updateService(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.adminService.updateService(id, dto);
  }

  @Delete('services/:id')
  @HttpCode(HttpStatus.OK)
  async deleteService(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteService(id);
  }
}
