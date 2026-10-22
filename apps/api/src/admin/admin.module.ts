import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ReportsService } from './reports.service';
import { AdminController } from './admin.controller';
import { InvitesModule } from '../invites/invites.module';
import { PlatformController } from './platform.controller';
import { MessagesModule } from '../messages/messages.module';
import { ModerationFeedbackService } from './moderation-feedback.service';
import { GdprModule } from '../gdpr/gdpr.module';

@Module({
  imports: [InvitesModule, MessagesModule, GdprModule],
  providers: [AdminService, ReportsService, ModerationFeedbackService],
  controllers: [AdminController, PlatformController],
})
export class AdminModule {}
