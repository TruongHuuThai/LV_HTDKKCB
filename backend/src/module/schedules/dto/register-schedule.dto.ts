import { IsDateString, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class RegisterScheduleDto {
    @IsDateString({}, { message: 'Ngày không hợp lệ (định dạng YYYY-MM-DD)' })
    @IsNotEmpty({ message: 'Ngày không được để trống' })
    N_NGAY: string; // YYYY-MM-DD

    @IsString({ message: 'Tên buổi phải là chuỗi' })
    @IsNotEmpty({ message: 'Tên buổi không được để trống' })
    B_TEN: string; // SANG, CHIEU, TOI

    @IsNumber({}, { message: 'Phòng phải là số' })
    @IsNotEmpty({ message: 'Phòng không được để trống' })
    P_MA: number;

    @IsString()
    LBSK_GHI_CHU?: string;
}
