import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSpecialtyDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  CK_TEN?: string;

  @IsOptional()
  @IsString()
  CK_MO_TA?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  CK_DOI_TUONG_KHAM?: string;
}
