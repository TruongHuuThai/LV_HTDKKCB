// src/modules/auth/dto/register-patient.dto.ts
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterPatientDto {
  @IsString()
  TK_SDT: string;

  @IsString()
  @MinLength(6)
  TK_PASS: string;

  // optional profile fields
  @IsOptional() @IsString() BN_HO_CHU_LOT?: string;
  @IsOptional() @IsString() BN_TEN?: string;
  @IsOptional() @IsString() BN_EMAIL?: string;
}
