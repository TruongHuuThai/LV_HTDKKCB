// src/modules/booking/dto/create-booking.dto.ts
import { IsInt, IsOptional, IsString, Matches } from 'class-validator';

export class CreateBookingDto {
  @IsInt()
  BN_MA: number;

  @IsInt()
  BS_MA: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  N_NGAY: string; // YYYY-MM-DD

  @IsString()
  B_TEN: string; // "SANG"/"CHIEU"/...

  @IsInt()
  KG_MA: number;

  @IsOptional()
  @IsInt()
  LHK_MA?: number;
}
