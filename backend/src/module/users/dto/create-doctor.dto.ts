import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

export class CreateDoctorDto {
    @IsPhoneNumber('VN')
    @IsNotEmpty()
    TK_SDT: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    TK_PASS: string;

    @IsString()
    @IsNotEmpty()
    BS_HO_TEN: string;

    @IsEmail()
    @IsOptional()
    BS_EMAIL?: string;

    @IsNumber()
    @IsNotEmpty()
    CK_MA: number;

    @IsString()
    @IsOptional()
    BS_HOC_HAM?: string;

    @IsString()
    @IsOptional()
    BS_ANH?: string;
}
