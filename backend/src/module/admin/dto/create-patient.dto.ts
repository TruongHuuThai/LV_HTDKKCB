import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePatientDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  TK_SDT?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  BN_HO_CHU_LOT?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  BN_TEN: string;

  @IsOptional()
  @IsBoolean()
  BN_LA_NAM?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  BN_SDT_DANG_KY?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  BN_EMAIL?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  BN_CCCD?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  BN_QUOC_GIA?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  BN_DAN_TOC?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  BN_SO_DDCN?: string;

  @IsOptional()
  @IsBoolean()
  BN_MOI?: boolean;

  @IsOptional()
  @Matches(/^(https?:\/\/|data:image\/)/, {
    message: 'BN_ANH phai la URL hoac du lieu anh hop le',
  })
  @MaxLength(8000000)
  BN_ANH?: string;
}
