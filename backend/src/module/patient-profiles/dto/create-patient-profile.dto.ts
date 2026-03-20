import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePatientProfileDto {
  @IsOptional()
  @IsInt()
  AK_MA?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  BN_HO_CHU_LOT?: string;

  @IsString()
  @MaxLength(255)
  BN_TEN!: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  BN_NGAY_SINH?: string;

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
  @MaxLength(20)
  BN_SO_BHYT?: string;

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
  @IsString()
  @MaxLength(500)
  BN_DIA_CHI?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  BN_QUAN_HE_VOI_TK?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(https?:\/\/|data:image\/)/, {
    message: 'BN_ANH phai la URL hoac du lieu anh hop le',
  })
  BN_ANH?: string;
}
