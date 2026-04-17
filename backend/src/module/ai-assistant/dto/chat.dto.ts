import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AiAssistantHistoryItemDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MaxLength(2000)
  content: string;
}

export class AiAssistantChatDto {
  @IsString()
  @MaxLength(3000)
  message: string;

  @IsOptional()
  @IsString()
  @IsIn(['vi', 'en'])
  locale?: 'vi' | 'en';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => AiAssistantHistoryItemDto)
  history?: AiAssistantHistoryItemDto[];
}

