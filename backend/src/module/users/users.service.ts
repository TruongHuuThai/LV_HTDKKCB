// src/modules/users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { mapPrismaError } from '../../common/prisma/prisma-error.util';
import { CreateDoctorDto } from './dto/create-doctor.dto';

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) { }

  async createDoctor(dto: CreateDoctorDto) {
    try {
      return await this.repo.createDoctor(dto);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException('Số điện thoại đã được đăng ký');
      }
      mapPrismaError(e);
    }
  }

  async getDoctors(specialtyId?: number) {
    try {
      return await this.repo.listDoctors(specialtyId);
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getDoctorDetail(id: number) {
    try {
      const bs = await this.repo.findDoctorById(id);
      if (!bs || bs.BS_DA_XOA)
        throw new NotFoundException('Không tìm thấy bác sĩ');
      return bs;
    } catch (e) {
      mapPrismaError(e);
    }
  }

  async getSpecialties() {
    try {
      return await this.repo.listSpecialties();
    } catch (e) {
      mapPrismaError(e);
    }
  }
}
