// src/modules/auth/auth.service.ts
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { ROLE } from './auth.constants';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly jwt: JwtService,
  ) { }

  private buildAuthUser(acc: Awaited<ReturnType<AuthRepository['findAccountByPhone']>>) {
    const bsMa = acc?.BAC_SI?.BS_MA ?? null;
    const bnMa = acc?.BENH_NHAN?.[0]?.BN_MA ?? null;
    const doctorName = acc?.BAC_SI?.BS_HO_TEN?.trim() || null;
    const patientName =
      `${acc?.BENH_NHAN?.[0]?.BN_HO_CHU_LOT || ''} ${acc?.BENH_NHAN?.[0]?.BN_TEN || ''}`.trim() || null;
    const displayName =
      acc?.TK_VAI_TRO === ROLE.BAC_SI
        ? doctorName
        : acc?.TK_VAI_TRO === ROLE.BENH_NHAN
          ? patientName
          : acc?.TK_VAI_TRO === ROLE.ADMIN
            ? 'Quản trị hệ thống'
            : null;

    return {
      TK_SDT: acc?.TK_SDT ?? '',
      TK_VAI_TRO: acc?.TK_VAI_TRO ?? null,
      BS_MA: bsMa,
      BN_MA: bnMa,
      TEN_HIEN_THI: displayName,
      BS_HO_TEN: doctorName,
      BN_HO_TEN: patientName,
    };
  }

  async login(TK_SDT: string, TK_PASS: string) {
    const acc = await this.repo.findAccountByPhone(TK_SDT);

    if (!acc || acc.TK_DA_XOA) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');
    }

    // Hỗ trợ cả password plain text (dữ liệu seed cũ) và password đã bcrypt
    const isBcryptHash = acc.TK_PASS?.startsWith('$2b$') || acc.TK_PASS?.startsWith('$2a$');
    const ok = isBcryptHash
      ? await bcrypt.compare(TK_PASS, acc.TK_PASS)
      : TK_PASS === acc.TK_PASS;
    if (!ok) throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu');

    const authUser = this.buildAuthUser(acc);

    const token = await this.jwt.signAsync(
      {
        sub: acc.TK_SDT,
        role: acc.TK_VAI_TRO ?? undefined,
        bsMa: authUser.BS_MA,
        bnMa: authUser.BN_MA,
      } as any,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as any,
    );

    const { raw, hash } = this.makeRefreshToken();
    const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 ngày
    await this.repo.createRefreshToken({
      TK_SDT: acc.TK_SDT,
      RT_HASH: hash,
      RT_EXPIRES_AT: exp,
    });

    return {
      access_token: token,
      refresh_token: raw,
      user: authUser,
    };
  }

  async me(TK_SDT: string) {
    const acc = await this.repo.findAccountByPhone(TK_SDT);
    if (!acc || acc.TK_DA_XOA) return null;

    return this.buildAuthUser(acc);
  }

  async registerPatient(input: {
    TK_SDT: string;
    TK_PASS: string;
    BN_HO_CHU_LOT?: string;
    BN_TEN?: string;
    BN_EMAIL?: string;
  }) {
    const existed = await this.repo.findAccountByPhone(input.TK_SDT);
    if (existed) throw new ConflictException('Số điện thoại đã tồn tại');

    const hash = await bcrypt.hash(input.TK_PASS, 10);

    const acc = await this.repo.createAccount({
      TK_SDT: input.TK_SDT,
      TK_PASS: hash,
      TK_VAI_TRO: ROLE.BENH_NHAN,
    });

    const bn = await this.repo.createPatientProfile({
      TK_SDT: acc.TK_SDT,
      BN_HO_CHU_LOT: input.BN_HO_CHU_LOT,
      BN_TEN: input.BN_TEN,
      BN_EMAIL: input.BN_EMAIL,
    });

    return { TK_SDT: acc.TK_SDT, BN_MA: bn.BN_MA };
  }

  async refresh(refresh_token: string) {
    const hash = createHash('sha256').update(refresh_token).digest('hex');
    const rt = await this.repo.findValidRefreshByHash(hash);

    if (!rt) throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');

    const acc = await this.repo.findAccountByPhone(rt.TK_SDT);
    if (!acc || acc.TK_DA_XOA) throw new UnauthorizedException('Tài khoản bị khóa hoặc không tồn tại');

    // Thu hồi token cũ
    await this.repo.revokeRefresh(rt.RT_ID);

    // Tạo JWT token mới
    const authUser = this.buildAuthUser(acc);

    const token = await this.jwt.signAsync(
      {
        sub: acc.TK_SDT,
        role: acc.TK_VAI_TRO ?? undefined,
        bsMa: authUser.BS_MA,
        bnMa: authUser.BN_MA,
      } as any,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as any,
    );

    // Tạo Refresh token mới
    const newRt = this.makeRefreshToken();
    const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.repo.createRefreshToken({
      TK_SDT: acc.TK_SDT,
      RT_HASH: newRt.hash,
      RT_EXPIRES_AT: exp,
    });

    return {
      access_token: token,
      refresh_token: newRt.raw,
      user: authUser,
    };
  }

  async logout(refresh_token: string) {
    const hash = createHash('sha256').update(refresh_token).digest('hex');
    const rt = await this.repo.findValidRefreshByHash(hash);
    if (rt) {
      await this.repo.revokeRefresh(rt.RT_ID);
    }
    return { message: 'Đăng xuất thành công' };
  }

  async changePassword(TK_SDT: string, old_pass: string, new_pass: string) {
    const acc = await this.repo.findAccountByPhone(TK_SDT);
    if (!acc || acc.TK_DA_XOA) throw new UnauthorizedException('Tài khoản không tồn tại');

    const ok = await bcrypt.compare(old_pass, acc.TK_PASS);
    if (!ok) throw new UnauthorizedException('Mật khẩu cũ không chính xác');

    const newHash = await bcrypt.hash(new_pass, 10);
    await this.repo.updatePassword(TK_SDT, newHash);

    return { message: 'Đổi mật khẩu thành công' };
  }

  private makeRefreshToken() {
    const raw = randomBytes(48).toString('base64url');
    const hash = createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
  }
}
