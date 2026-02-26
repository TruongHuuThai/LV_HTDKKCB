// src/modules/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

type JwtPayload = {
  sub: string;
  role?: string;
  bnMa?: number | null;
  bsMa?: number | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'umc-secret',
    });
  }

  async validate(payload: JwtPayload) {
    return {
      TK_SDT: payload.sub,
      role: payload.role,
      bnMa: payload.bnMa ?? null,
      bsMa: payload.bsMa ?? null,
    };
  }
}
