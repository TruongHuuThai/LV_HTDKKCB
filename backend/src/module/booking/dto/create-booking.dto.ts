// src/modules/booking/dto/create-booking.dto.ts
import {
  IsBoolean,
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePreVisitAttachmentDto {
  @IsString()
  @MaxLength(255)
  fileName: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  fileUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsOptional()
  @IsInt()
  sizeBytes?: number;
}

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

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  symptoms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  preVisitNote?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CreatePreVisitAttachmentDto)
  attachments?: CreatePreVisitAttachmentDto[];

  @IsOptional()
  @IsBoolean()
  hasBHYT?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bhytType?: string;

  @IsOptional()
  @IsBoolean()
  hasPrivateInsurance?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  privateInsuranceProvider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  paymentMethod?: string;
}
