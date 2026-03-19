import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMedicineBrandInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  BD_TEN?: string;

  @IsOptional()
  @IsString()
  BD_CONG_DUNG?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  BD_HAM_LUONG?: string;

  @IsOptional()
  @IsString()
  BD_LIEU_DUNG?: string;
}
