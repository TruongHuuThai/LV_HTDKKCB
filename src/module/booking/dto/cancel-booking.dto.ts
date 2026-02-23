// src/modules/booking/dto/cancel-booking.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  DK_LY_DO_HUY?: string;
}
