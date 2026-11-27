import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PostsService } from './posts.service';
import { AnnouncementsService } from './announcements.service';

/** Publishes scheduled posts every minute, then tells members about new announcements. */
@Injectable()
export class PostSchedulerService {
  private readonly logger = new Logger(PostSchedulerService.name);

  constructor(
    private posts: PostsService,
    private announcements: AnnouncementsService,
  ) {}

  @Cron('* * * * *', { name: 'scheduled-posts' })
  async run() {
    try {
      await this.posts.publishDue();
    } catch (err) {
      this.logger.error(`Publishing scheduled posts failed: ${(err as Error).message}`);
    }
    try {
      await this.announcements.announceDue();
    } catch (err) {
      this.logger.error(`Sending announcements failed: ${(err as Error).message}`);
    }
  }
}
