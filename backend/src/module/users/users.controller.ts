import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLE } from '../auth/auth.constants';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get('doctors')
    async getDoctors() {
        return this.usersService.getDoctors();
    }

    @Get('doctors/:id')
    async getDoctorDetail(@Param('id', ParseIntPipe) id: number) {
        return this.usersService.getDoctorDetail(id);
    }

    @Get('specialties')
    async getSpecialties() {
        return this.usersService.getSpecialties();
    }

    @Post('doctors')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(ROLE.ADMIN)
    async createDoctor(@Body() dto: CreateDoctorDto) {
        return this.usersService.createDoctor(dto);
    }
}
