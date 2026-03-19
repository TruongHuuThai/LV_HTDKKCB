import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class UpdateRoomDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  CK_MA?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  P_TEN?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  P_VI_TRI?: string;
}
