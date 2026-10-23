import { randomUUID } from 'crypto';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { CapabilityGuard } from './config/capabilities.guard';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';
import { normalizeRequestId } from './common/request-id';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CoursesModule } from './courses/courses.module';
import { EventsModule } from './events/events.module';
import { AdminModule } from './admin/admin.module';
import { GdprModule } from './gdpr/gdpr.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MessagesModule } from './messages/messages.module';
import { SearchModule } from './search/search.module';
import { InvitesModule } from './invites/invites.module';
import { EmailModule } from './email/email.module';
import { DigestService } from './email/digest.service';
import { CategoriesModule } from './categories/categories.module';
import { TestimonialsModule } from './testimonials/testimonials.module';
import { GoalsModule } from './goals/goals.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { EventProposalsModule } from './event-proposals/event-proposals.module';
import { UploadsModule } from './uploads/uploads.module';
import { VideosModule } from './videos/videos.module';
import { LearningGroupsModule } from './learning-groups/learning-groups.module';
import { TierModule } from './tier/tier.module';
import { DigestTemplateModule } from './digest/digest-template.module';
import { BillingModule } from './billing/billing.module';
import { AiCoachModule } from './ai-coach/ai-coach.module';
import { RedisModule } from './redis/redis.module';
import { CalendarModule } from './calendar/calendar.module';
import { PluginsModule } from './plugins/plugins.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
        // Trust an upstream-supplied request ID (e.g. nginx/load balancer) so a
        // request can be correlated end-to-end; otherwise mint one. Either way,
        // echo it back on the response so clients/error reports can quote it.
        genReqId: (req: any, res: any) => {
          const id = normalizeRequestId(req.headers['x-request-id']) ?? randomUUID();
          res.setHeader('X-Request-Id', id);
          return id;
        },
        // Redact sensitive headers from request logs
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-refresh-token"]'],
        serializers: {
          req: (req: any) => ({ id: req.id, method: req.method, url: req.url }),
          res: (res: any) => ({ statusCode: res.statusCode }),
        },
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: parseInt(process.env.THROTTLE_TTL || '60000'),
        limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
      },
      {
        name: 'auth',
        ttl: 900_000,  // 15 minutes
        limit: 60,
      },
    ]),
    RedisModule,
    CalendarModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    PostsModule,
    CoursesModule,
    EventsModule,
    AdminModule,
    GdprModule,
    HealthModule,
    NotificationsModule,
    MessagesModule,
    SearchModule,
    InvitesModule,
    EmailModule,
    CategoriesModule,
    TestimonialsModule,
    GoalsModule,
    AssessmentsModule,
    EventProposalsModule,
    UploadsModule,
    VideosModule,
    LearningGroupsModule,
    TierModule,
    DigestTemplateModule,
    BillingModule,
    AiCoachModule,
    PluginsModule.register(),
  ],
  providers: [
    DigestService,
    // UserThrottlerGuard uses authenticated userId as throttle key (falls back to IP),
    // which is more accurate than IP-based limiting behind a reverse proxy.
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_GUARD, useClass: CapabilityGuard },
  ],
})
export class AppModule {}
