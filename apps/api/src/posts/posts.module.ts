import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { BookmarksService } from './bookmarks.service';
import { PostsController } from './posts.controller';
import { PostSchedulerService } from './post-scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [PostsService, BookmarksService, PostSchedulerService],
  controllers: [PostsController],
  exports: [PostsService, BookmarksService],
})
export class PostsModule {}
