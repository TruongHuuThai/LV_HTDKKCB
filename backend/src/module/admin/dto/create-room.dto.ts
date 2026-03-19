import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @IsInt()
  @IsPositive()
  CK_MA: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  P_TEN: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  P_VI_TRI?: string;
}
