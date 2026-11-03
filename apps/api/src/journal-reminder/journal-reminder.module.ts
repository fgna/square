import { Module } from '@nestjs/common';
import { JournalReminderService } from './journal-reminder.service';

@Module({ providers: [JournalReminderService] })
export class JournalReminderModule {}
