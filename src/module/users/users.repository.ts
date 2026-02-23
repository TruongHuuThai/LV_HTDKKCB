// src/modules/users/users.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ===== BAC_SI =====
  listDoctors() {
    return this.prisma.bAC_SI.findMany({
      where: { BS_DA_XOA: false },
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
