import { IsEmail, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class UpdateDoctorDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  BS_HO_TEN?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  CK_MA?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  BS_SDT?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  BS_EMAIL?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  BS_HOC_HAM?: string;

  @IsOptional()
  @Matches(/^(https?:\/\/|data:image\/)/, {
    message: 'BS_ANH phải là URL hoặc dữ liệu ảnh hợp lệ',
  })
  @MaxLength(8000000)
  BS_ANH?: string;
}
