// src/modules/users/users.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import * as bcrypt from 'bcrypt';
import { ROLE } from '../auth/auth.constants';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) { }

  // ===== BAC_SI =====
  listDoctors(specialtyId?: number) {
    return this.prisma.bAC_SI.findMany({
      where: {
        BS_DA_XOA: false,
        ...(specialtyId ? { CK_MA: specialtyId } : {}),
      },
      include: { CHUYEN_KHOA: true },
      orderBy: { BS_MA: 'asc' },
    });
  }

  findDoctorById(id: number) {
    return this.prisma.bAC_SI.findUnique({
      where: { BS_MA: id },
      include: { CHUYEN_KHOA: true, TAI_KHOAN: true },
    });
  }

  async createDoctor(dto: CreateDoctorDto) {
    const hash = await bcrypt.hash(dto.TK_PASS, 10);
    return this.prisma.$transaction(async (tx) => {
      // 1. Tạo TAI_KHOAN trước
      await tx.tAI_KHOAN.create({
        data: {
          TK_SDT: dto.TK_SDT,
          TK_PASS: hash,
          TK_VAI_TRO: ROLE.BAC_SI,
        },
      });

      // 2. Tạo BAC_SI
      return tx.bAC_SI.create({
        data: {
          TK_SDT: dto.TK_SDT,
          BS_HO_TEN: dto.BS_HO_TEN,
          BS_SDT: dto.TK_SDT,
          CK_MA: dto.CK_MA,
          BS_EMAIL: dto.BS_EMAIL,
          BS_HOC_HAM: dto.BS_HOC_HAM,
          BS_ANH: dto.BS_ANH,
        },
      });
    });
  }

  // ===== CHUYEN_KHOA =====
  listSpecialties() {
    return this.prisma.cHUYEN_KHOA.findMany({
      orderBy: { CK_TEN: 'asc' },
    });
  }

  // ===== BENH_NHAN =====
  findPatientById(id: number) {
    return this.prisma.bENH_NHAN.findUnique({
      where: { BN_MA: id },
      include: {
        AP_KV: { include: { XA_PHUONG: { include: { TINH_TP: true } } } },
      },
    });
  }
}
