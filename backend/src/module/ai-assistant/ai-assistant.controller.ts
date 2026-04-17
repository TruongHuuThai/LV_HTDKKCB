import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ROLE } from '../auth/auth.constants';
import { CurrentUser } from '../auth/current-user.decorator';
import type { CurrentUserPayload } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AiAssistantService } from './ai-assistant.service';
import { AiAssistantChatDto } from './dto/chat.dto';

@Controller('ai-assistant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiAssistantController {
  constructor(private readonly assistant: AiAssistantService) {}

  @Post('chat')
  @Roles(ROLE.BENH_NHAN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async chat(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AiAssistantChatDto,
  ) {
    return this.assistant.chat(user, dto);
  }
}
