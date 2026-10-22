import { Module } from '@nestjs/common';
import { EventProposalsController } from './event-proposals.controller';
import { EventProposalsService } from './event-proposals.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EventProposalsController],
  providers: [EventProposalsService],
})
export class EventProposalsModule {}
