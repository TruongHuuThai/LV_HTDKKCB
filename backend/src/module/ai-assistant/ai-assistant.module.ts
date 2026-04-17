import { Module } from '@nestjs/common';
import { BookingModule } from '../booking/booking.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantRepository } from './ai-assistant.repository';
import { AiAssistantService } from './ai-assistant.service';

@Module({
  imports: [BookingModule],
  controllers: [AiAssistantController],
  providers: [AiAssistantRepository, AiAssistantService],
})
export class AiAssistantModule {}

