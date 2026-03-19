import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class RegisterScheduleDto {
  @IsDateString({}, { message: 'Ngay khong hop le (dinh dang YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'Ngay khong duoc de trong' })
  N_NGAY: string;

  @IsString({ message: 'Ten buoi phai la chuoi' })
  @IsNotEmpty({ message: 'Ten buoi khong duoc de trong' })
  @IsIn(['SANG', 'CHIEU'], {
    message: 'Bac si chi duoc dang ky buoi Sang hoac Chieu',
  })
  B_TEN: string;

  @IsNumber({}, { message: 'Phong phai la so' })
  @IsNotEmpty({ message: 'Phong khong duoc de trong' })
  P_MA: number;

  @IsOptional()
  @IsString()
  LBSK_GHI_CHU?: string;
}
