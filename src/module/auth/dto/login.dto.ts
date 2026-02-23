// src/modules/auth/dto/login.dto.ts
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  TK_SDT: string;

  @IsString()
  @MinLength(6)
  TK_PASS: string;
}
