import { Module } from '@nestjs/common';
import { LearningGroupsService } from './learning-groups.service';
import { LearningGroupsController } from './learning-groups.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [LearningGroupsService],
  controllers: [LearningGroupsController],
  exports: [LearningGroupsService],
})
export class LearningGroupsModule {}
