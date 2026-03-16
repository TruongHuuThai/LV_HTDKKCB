import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(255)
  TK_PASS?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ADMIN', 'BAC_SI', 'BENH_NHAN'])
  TK_VAI_TRO?: 'ADMIN' | 'BAC_SI' | 'BENH_NHAN';

  @IsOptional()
  @IsBoolean()
  TK_DA_XOA?: boolean;
}

