import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { SERVICE_TYPE_VALUES } from '../constants/service-type.constants';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  DVCLS_TEN: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @IsIn(SERVICE_TYPE_VALUES, { message: 'DVCLS_LOAI khong hop le' })
  DVCLS_LOAI?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  DVCLS_GIA_DV?: number;
}
