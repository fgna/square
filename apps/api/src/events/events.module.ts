import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventRemindersService } from './event-reminders.service';
import { RecordingRetentionService } from './recording-retention.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [EventsService, EventRemindersService, RecordingRetentionService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
