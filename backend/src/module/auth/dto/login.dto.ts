// src/modules/auth/dto/login.dto.ts
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\D/g, '').trim() : value,
  )
  @IsString({ message: 'So dien thoai phai la chuoi' })
  @IsNotEmpty({ message: 'So dien thoai khong duoc de trong' })
  TK_SDT: string;

  @IsString({ message: 'Mat khau phai la chuoi' })
  @IsNotEmpty({ message: 'Mat khau khong duoc de trong' })
  @MinLength(6, { message: 'Mat khau phai co it nhat 6 ky tu' })
  TK_PASS: string;
}
