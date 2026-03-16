import { IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  TK_SDT: string;

  @IsString()
  @MinLength(6)
  @MaxLength(255)
  TK_PASS: string;

  @IsString()
  @IsIn(['ADMIN', 'BAC_SI', 'BENH_NHAN'])
  TK_VAI_TRO: 'ADMIN' | 'BAC_SI' | 'BENH_NHAN';
}

