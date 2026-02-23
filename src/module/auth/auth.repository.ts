// src/modules/auth/auth.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ===== TAI_KHOAN =====
  findAccountByPhone(TK_SDT: string) {
    return this.prisma.tAI_KHOAN.findUnique({
      where: { TK_SDT },
      include: {
        BAC_SI: true,
        BENH_NHAN: true, // array theo schema
      },
    });
  }

  createAccount(data: { TK_SDT: string; TK_PASS: string; TK_VAI_TRO: string }) {
    return this.prisma.tAI_KHOAN.create({ data });
  }

  // tạo profile bệnh nhân tối thiểu
  createPatientProfile(data: {
    TK_SDT: string;
    BN_HO_CHU_LOT?: string;
    BN_TEN?: string;
    BN_EMAIL?: string;
  }) {
    return this.prisma.bENH_NHAN.create({
      data: {
        TK_SDT: data.TK_SDT,
        BN_MOI: true,
        BN_SDT_DANG_KY: data.TK_SDT,
        BN_HO_CHU_LOT: data.BN_HO_CHU_LOT,
        BN_TEN: data.BN_TEN,
        BN_EMAIL: data.BN_EMAIL,
      },
    });
  }

  // ===== OTP (nếu bạn muốn bật sau) =====
  createOtp(data: {
    TK_SDT: string;
    OTP_CODE: string;
    OTP_LOAI?: string;
    OTP_HET_HAN: Date;
    OTP_TRANG_THAI?: string;
  }) {
    return this.prisma.xAC_THUC_OTP.create({ data });
  }

  findLatestValidOtp(TK_SDT: string, OTP_LOAI: string) {
    return this.prisma.xAC_THUC_OTP.findFirst({
      where: {
        TK_SDT,
        OTP_LOAI,
        OTP_TRANG_THAI: 'VALID',
        OTP_HET_HAN: { gt: new Date() },
      },
      orderBy: { OTP_THOI_GIAN_TAO: 'desc' },
    });
  }

  invalidateOtp(OTP_MA: number) {
    return this.prisma.xAC_THUC_OTP.update({
      where: { OTP_MA },
      data: { OTP_TRANG_THAI: 'USED' },
    });
  }

  createRefreshToken(data: {
    TK_SDT: string;
    RT_HASH: string;
    RT_EXPIRES_AT: Date;
    RT_USER_AGENT?: string;
    RT_IP?: string;
  }) {
    return this.prisma.rEFRESH_TOKEN.create({ data });
  }

  findValidRefreshByHash(RT_HASH: string) {
    return this.prisma.rEFRESH_TOKEN.findFirst({
      where: {
        RT_HASH,
        RT_REVOKED_AT: null,
        RT_EXPIRES_AT: { gt: new Date() },
      },
    });
  }

  revokeRefresh(RT_ID: bigint) {
    return this.prisma.rEFRESH_TOKEN.update({
      where: { RT_ID },
      data: { RT_REVOKED_AT: new Date() },
    });
  }
}
