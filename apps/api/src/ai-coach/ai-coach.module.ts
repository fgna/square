import { Module } from '@nestjs/common';
import { AiCoachService } from './ai-coach.service';
import { AiCoachController } from './ai-coach.controller';

@Module({
  providers: [AiCoachService],
  controllers: [AiCoachController],
})
export class AiCoachModule {}
