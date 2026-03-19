// src/modules/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

type JwtPayload = {
  sub: string;
  role?: string;
  bnMa?: number | null;
  bsMa?: number | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET') || 'umc-secret',
    });
  }

  async validate(payload: JwtPayload) {
    let bsMa = payload.bsMa ?? null;
    let bnMa = payload.bnMa ?? null;

    if (bsMa == null && bnMa == null) {
      const account = await this.prisma.tAI_KHOAN.findUnique({
        where: { TK_SDT: payload.sub },
        select: {
          BAC_SI: { select: { BS_MA: true } },
          BENH_NHAN: {
            select: { BN_MA: true },
            take: 1,
          },
        },
      });
      bsMa = account?.BAC_SI?.BS_MA ?? null;
      bnMa = account?.BENH_NHAN?.[0]?.BN_MA ?? null;
    }

    return {
      TK_SDT: payload.sub,
      role: payload.role,
      bnMa,
      bsMa,
    };
  }
}
