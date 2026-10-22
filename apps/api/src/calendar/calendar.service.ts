import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { generateCalendarFeed, CalendarFeedEvent } from '../email/ics.util';
import { eventUrl } from '../events/event-url';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  /**
   * The feed URL is the only credential protecting it, so the token has to be
   * unguessable rather than merely unique — 32 random bytes, not the user id.
   */
  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  async getOrCreateToken(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { calendarToken: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.calendarToken) return user.calendarToken;

    const calendarToken = this.generateToken();
    await this.prisma.user.update({ where: { id: userId }, data: { calendarToken } });
    return calendarToken;
  }

  /** Invalidates the old URL immediately — used when a link was shared by mistake. */
  async regenerateToken(userId: string): Promise<string> {
    const calendarToken = this.generateToken();
    await this.prisma.user.update({ where: { id: userId }, data: { calendarToken } });
    return calendarToken;
  }

  async revokeToken(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { calendarToken: null },
    });
    return { message: 'Calendar feed disabled' };
  }

  /**
   * Builds the feed for whoever holds this token.
   *
   * Only events the user is attending are included. An event they withdraw
   * from — or that gets deleted — is absent on the next poll, and the calendar
   * client removes it locally. That is the whole cancellation mechanism.
   */
  async getFeedByToken(token: string, appUrl: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { calendarToken: token },
      select: { id: true, name: true },
    });
    if (!user) throw new NotFoundException('Calendar not found');

    const rsvps = await this.prisma.eventRsvp.findMany({
      where: {
        userId: user.id,
        status: { in: ['GOING', 'MAYBE'] },
      },
      include: { event: true },
      orderBy: { event: { startsAt: 'asc' } },
    });

    const events: CalendarFeedEvent[] = rsvps.map(({ event, status }) => ({
      // Stable across polls, so the client updates an entry instead of
      // creating a duplicate when an event is edited.
      uid: `event-${event.id}@community-platform`,
      title: event.title,
      description: event.description,
      location: event.isVirtual ? event.meetingUrl || 'Online' : event.location || undefined,
      url: eventUrl(appUrl, event.id),
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      tentative: status === 'MAYBE',
    }));

    return generateCalendarFeed(events, `${user.name} — Community Events`);
  }
}
