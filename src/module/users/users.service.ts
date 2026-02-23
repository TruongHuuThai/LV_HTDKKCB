// src/modules/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { mapPrismaError } from '../../common/prisma/prisma-error.util';

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async getDoctors() {
    try {
      return await this.repo.listDoctors();
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
