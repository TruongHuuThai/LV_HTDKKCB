// src/modules/auth/dto/register.dto.ts
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @IsString({ message: 'Số điện thoại phải là chuỗi' })
    @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
    TK_SDT: string;

    @IsString({ message: 'Mật khẩu phải là chuỗi' })
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
    TK_PASS: string;

    @IsString({ message: 'Họ chữ lót phải là chuỗi' })
    @IsOptional()
    BN_HO_CHU_LOT?: string;

    @IsString({ message: 'Tên phải là chuỗi' })
    @IsNotEmpty({ message: 'Tên không được để trống' })
    BN_TEN: string;

    @IsEmail({}, { message: 'Email không hợp lệ' })
    @IsOptional()
    BN_EMAIL?: string;
}
