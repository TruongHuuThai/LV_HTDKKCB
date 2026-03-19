import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateMedicineDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  T_TEN_THUOC?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  BD_MA?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  DVT_MA?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  NT_MA?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  NSX_MA?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  T_GIA_THUOC?: number;

  @IsOptional()
  @IsDateString()
  T_HAN_SU_DUNG?: string | null;
}

