import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PostsService } from './posts.service';

/** Publishes scheduled posts every minute. */
@Injectable()
export class PostSchedulerService {
  private readonly logger = new Logger(PostSchedulerService.name);

  constructor(private posts: PostsService) {}

  @Cron('* * * * *', { name: 'scheduled-posts' })
  async run() {
    try {
      await this.posts.publishDue();
    } catch (err) {
      this.logger.error(`Publishing scheduled posts failed: ${(err as Error).message}`);
    }
  }
}
