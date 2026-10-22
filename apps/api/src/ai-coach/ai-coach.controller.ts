import { Controller, Post, Get, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AiCoachService } from './ai-coach.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatDto } from './dto/chat.dto';

@ApiTags('ai-coach')
@ApiBearerAuth()
@Controller('ai-coach')
export class AiCoachController {
  constructor(private aiCoachService: AiCoachService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check if AI Coach is available' })
  getStatus() {
    return { available: this.aiCoachService.isConfigured() };
  }

  @Post('chat')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Send a message to the AI Coach' })
  async chat(@CurrentUser() user: any, @Body() dto: ChatDto) {
    return this.aiCoachService.chat(user.id, dto.message, dto.history ?? []);
  }
}
