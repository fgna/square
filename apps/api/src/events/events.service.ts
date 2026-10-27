import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { generateIcs } from '../email/ics.util';
import { eventUrl } from './event-url';
import type { Event, Prisma } from '@prisma/client';

export interface EventListFilter {
  when?: 'upcoming' | 'past' | 'all';
  from?: Date;
  to?: Date;
  mine?: boolean;
}

/** The fields an invitation or cancellation is built from. */
type CalendarEvent = Pick<
  Event,
  'id' | 'title' | 'description' | 'isVirtual' | 'meetingUrl' | 'location' | 'startsAt' | 'endsAt'
>;
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { randomUUID } from 'crypto';
import { mailDate, mailTime, firstName } from '../email/mail-format';
import { htmlToText } from '../email/html-to-text';
import { signUploadPath } from '../uploads/attachment-links';
import { absoluteUploadUrl } from '../uploads/public-url';
import { toVideoEmbed } from '../courses/video-url';
import { unlink } from 'fs/promises';
import { resolve, sep } from 'path';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Turns a date string into a Date, rejecting unparseable input with a 400
 * instead of letting it reach Prisma and surface as a 500.
 */
function parseEventDate(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} is not a valid date`);
  }
  return parsed;
}

/**
 * Expands a recurrence into concrete start times.
 *
 * Occurrences are materialised as rows rather than computed on read, so each
 * one carries its own RSVPs and can be moved or cancelled independently. That
 * makes an unbounded series impossible, hence the hard horizon below.
 *
 * Steps are taken on the wall clock of the platform's time zone, not in UTC:
 * a series at 7:45 stays at 7:45 across the switch to and from summer time.
 * (The container clock runs on UTC, so stepping a Date by days used to move
 * every occurrence after the switch by an hour.)
 */
const RECURRENCE_HORIZON_MONTHS = 12;
const MAX_OCCURRENCES = 400;

type Rule = 'DAILY' | 'WEEKDAYS' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

/** Wall-clock parts of an instant in a time zone. */
function wallClock(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  return {
    y: Number(parts.year), m: Number(parts.month) - 1, d: Number(parts.day),
    h: Number(parts.hour), mi: Number(parts.minute), s: Number(parts.second),
  };
}

/** The instant at which the wall clock in a time zone shows the given date and time. */
export function fromWallClock(y: number, m: number, d: number, h: number, mi: number, s: number, ms: number, timeZone: string): Date {
  const asUtc = Date.UTC(y, m, d, h, mi, s, ms);
  let guess = asUtc;
  // Two passes settle the offset, including on the days the clocks change.
  for (let i = 0; i < 2; i++) {
    const w = wallClock(new Date(guess), timeZone);
    const shown = Date.UTC(w.y, w.m, w.d, w.h, w.mi, w.s, ms);
    guess += asUtc - shown;
  }
  return new Date(guess);
}

export function expandRecurrence(
  start: Date,
  rule: Rule,
  until?: Date | null,
  timeZone: string = process.env.PLATFORM_TIME_ZONE || 'Europe/Berlin',
): Date[] {
  const horizon = new Date(start);
  horizon.setMonth(horizon.getMonth() + RECURRENCE_HORIZON_MONTHS);

  // Never generate past the horizon, even if the caller asked for longer.
  const limit = until && until < horizon ? until : horizon;

  const w = wallClock(start, timeZone);
  const ms = start.getUTCMilliseconds();
  const at = (dayOffset: number, monthOffset = 0) =>
    fromWallClock(w.y, w.m + monthOffset, w.d + dayOffset, w.h, w.mi, w.s, ms, timeZone);
  // Weekday of a calendar date, independent of any time zone (0 = Sunday).
  const weekday = (dayOffset: number) => new Date(Date.UTC(w.y, w.m, w.d + dayOffset)).getUTCDay();

  const dates: Date[] = [];
  for (let step = 0; dates.length < MAX_OCCURRENCES; step++) {
    let next: Date;
    switch (rule) {
      case 'DAILY':
        next = at(step);
        break;
      case 'WEEKDAYS':
        if (weekday(step) === 0 || weekday(step) === 6) {
          if (at(step) > limit) return dates;
          continue;
        }
        next = at(step);
        break;
      case 'WEEKLY':
        next = at(step * 7);
        break;
      case 'BIWEEKLY':
        next = at(step * 14);
        break;
      case 'MONTHLY':
        next = at(0, step);
        break;
    }
    if (next > limit) break;
    dates.push(next);
  }

  return dates;
}

/**
 * Deletes stored files (paths such as /uploads/uploads/…) from the upload
 * folder. Paths outside it are ignored; a missing file is not an error.
 */
async function removeUploadedFiles(paths: string[], logger: Logger) {
  const root = resolve(process.cwd(), 'uploads');
  for (const p of paths) {
    if (!p.startsWith('/uploads/')) continue;
    const file = resolve(root, p.slice('/uploads/'.length));
    if (!file.startsWith(root + sep)) continue;
    await unlink(file).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') logger.warn(`Could not delete ${p}: ${err.message}`);
    });
  }
}

/**
 * How many days members can watch a recording, from RECORDING_RETENTION_DAYS
 * (e.g. 365 when the privacy policy promises at most a year). Unset or 0 keeps
 * recordings until an admin deletes them.
 */
export function recordingRetentionDays(): number {
  const days = Number(process.env.RECORDING_RETENTION_DAYS);
  return Number.isInteger(days) && days > 0 ? days : 0;
}

/** Recordings created before this date are expired; null when they never expire. */
export function recordingCutoff(now = new Date()): Date | null {
  const days = recordingRetentionDays();
  return days ? new Date(now.getTime() - days * 86_400_000) : null;
}

function unexpiredRecordings() {
  const cutoff = recordingCutoff();
  return cutoff ? { createdAt: { gte: cutoff } } : {};
}

/**
 * How a recording's video reaches the browser. A YouTube, Vimeo or Loom video
 * is played inside the platform, and members get only the player link (embedUrl):
 * the share link itself would play anywhere once copied, and recordings show
 * members. Admins keep the share link to manage the recording. Other links
 * (e.g. a cloud folder) cannot be embedded and stay a plain link.
 */
export function recordingVideo(url: string, forAdmin: boolean) {
  const embedUrl = toVideoEmbed(url)?.embedUrl ?? null;
  return { url: forAdmin || !embedUrl ? url : null, embedUrl };
}

/** Player link, signed links for the attachments, and the date the recording disappears (null if never). */
function withRecordingLinks<T extends { url: string; createdAt: Date; attachments?: { url: string }[] }>(
  recording: T,
  forAdmin: boolean,
) {
  const days = recordingRetentionDays();
  return {
    ...recording,
    ...recordingVideo(recording.url, forAdmin),
    availableUntil: days ? new Date(recording.createdAt.getTime() + days * 86_400_000) : null,
    attachments: (recording.attachments ?? []).map((a) => ({ ...a, url: absoluteUploadUrl(signUploadPath(a.url)) })),
  };
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  /**
   * Events for lists, the calendar and the dashboard. By default only events
   * that have not ended yet, soonest first: with a daily series, "all events
   * from the oldest" filled every page with past dates. `past` lists ended
   * events, latest first; `from`/`to` select a period (calendar month);
   * `mine` keeps the events the member said yes to.
   */
  async findAll(page = 1, limit = 20, userId?: string, filter: EventListFilter = {}) {
    limit = Math.max(1, Math.min(limit, 100));
    page = Math.max(1, page);
    const skip = (page - 1) * limit;
    const now = new Date();
    const when = filter.from || filter.to ? 'all' : (filter.when ?? 'upcoming');
    const where: Prisma.EventWhereInput = {
      ...(when === 'upcoming' && { endsAt: { gte: now } }),
      ...(when === 'past' && { endsAt: { lt: now } }),
      ...((filter.from || filter.to) && {
        startsAt: { ...(filter.from && { gte: filter.from }), ...(filter.to && { lt: filter.to }) },
      }),
      ...(filter.mine && userId && { rsvps: { some: { userId, status: 'GOING' } } }),
    };
    const [data, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startsAt: when === 'past' ? 'desc' : 'asc' },
        include: {
          _count: { select: { rsvps: true } },
          categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
          rsvps: {
            take: 5,
            select: { id: true, status: true, userId: true, user: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    // The member's own answer, also when they are not among the five shown.
    const own = userId && data.length
      ? await this.prisma.eventRsvp.findMany({
          where: { userId, eventId: { in: data.map((e) => e.id) } },
          select: { id: true, status: true, userId: true, eventId: true },
        })
      : [];
    const events = data.map((event) => ({
      ...event,
      userRsvp: userId ? (own.find((r) => r.eventId === event.id) ?? null) : null,
    }));

    return {
      data: events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        rsvps: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        _count: { select: { rsvps: true } },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const userRsvp = userId
      ? event.rsvps.find((r) => r.userId === userId) || null
      : null;

    return { ...event, userRsvp };
  }

  async create(dto: CreateEventDto) {
    const startsAt = parseEventDate(dto.startsAt, 'startsAt');
    const endsAt = parseEventDate(dto.endsAt, 'endsAt');
    if (startsAt >= endsAt) {
      throw new BadRequestException('startsAt must be before endsAt');
    }

    const { recurrence, recurrenceEndsAt, categoryIds, ...eventData } = dto as any;

    // Hand Prisma real Date objects: @IsDateString() also accepts values such as
    // "2026-10-01T14:30" (what an <input type="datetime-local"> produces), which
    // Prisma rejects with a 500 rather than a validation error.
    if (!recurrence) {
      const event = await this.prisma.event.create({ data: { ...eventData, startsAt, endsAt } });
      await this.setCategories([event.id], categoryIds);
      return event;
    }

    const until = recurrenceEndsAt ? parseEventDate(recurrenceEndsAt, 'recurrenceEndsAt') : null;
    if (until && until < startsAt) {
      throw new BadRequestException('recurrenceEndsAt must be after startsAt');
    }

    const durationMs = endsAt.getTime() - startsAt.getTime();
    const occurrences = expandRecurrence(startsAt, recurrence, until);
    const seriesId = randomUUID();

    await this.prisma.event.createMany({
      data: occurrences.map((occurrenceStart) => ({
        ...eventData,
        startsAt: occurrenceStart,
        endsAt: new Date(occurrenceStart.getTime() + durationMs),
        seriesId,
        recurrence,
      })),
    });

    const created = await this.prisma.event.findMany({ where: { seriesId }, select: { id: true } });
    await this.setCategories(created.map((e) => e.id), categoryIds);

    const first = await this.prisma.event.findFirst({
      where: { seriesId },
      orderBy: { startsAt: 'asc' },
    });

    return { ...first, seriesId, occurrences: occurrences.length };
  }

  /** Removes every occurrence of a series, including its RSVPs (cascade). */
  async deleteSeries(seriesId: string) {
    const result = await this.prisma.event.deleteMany({ where: { seriesId } });
    if (result.count === 0) {
      throw new NotFoundException('Series not found');
    }
    return { message: `Deleted ${result.count} occurrences`, count: result.count };
  }

  async update(id: string, dto: UpdateEventDto) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    const startsAt = dto.startsAt ? parseEventDate(dto.startsAt, 'startsAt') : undefined;
    const endsAt = dto.endsAt ? parseEventDate(dto.endsAt, 'endsAt') : undefined;

    const effectiveStart = startsAt ?? event.startsAt;
    const effectiveEnd = endsAt ?? event.endsAt;
    if (effectiveStart >= effectiveEnd) {
      throw new BadRequestException('startsAt must be before endsAt');
    }

    const { categoryIds, ...fields } = dto;
    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        ...fields,
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
      },
    });
    await this.setCategories([id], categoryIds);
    return updated;
  }

  /**
   * Replaces the categories of the given events. Explore lists events by
   * category, but until now no event could be given one. Undefined leaves
   * them as they are; an empty list clears them.
   */
  private async setCategories(eventIds: string[], categoryIds: string[] | undefined) {
    if (categoryIds === undefined || eventIds.length === 0) return;
    await this.prisma.eventCategory.deleteMany({ where: { eventId: { in: eventIds } } });
    if (categoryIds.length === 0) return;
    await this.prisma.eventCategory.createMany({
      data: eventIds.flatMap((eventId) => [...new Set(categoryIds)].map((categoryId) => ({ eventId, categoryId }))),
      skipDuplicates: true,
    });
  }

  async delete(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { rsvps: { where: { status: 'GOING' }, select: { userId: true } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    await this.prisma.event.delete({ where: { id } });

    // Everyone who was sent an invitation gets it withdrawn, so a deleted
    // event does not linger in their calendars.
    for (const { userId } of event.rsvps ?? []) {
      this.sendCalendarCancellation(userId, event).catch((err) =>
        this.logger.error('Failed to send calendar cancellation', err),
      );
    }
    return { message: 'Event deleted' };
  }

  async rsvp(eventId: string, userId: string, status: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        include: { _count: { select: { rsvps: { where: { status: 'GOING' } } } } },
      });

      if (!event) throw new NotFoundException('Event not found');

      const currentRsvp = await tx.eventRsvp.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });

      if (
        event.maxRsvps &&
        status === 'GOING' &&
        currentRsvp?.status !== 'GOING' &&
        (event._count as any).rsvps >= event.maxRsvps
      ) {
        throw new BadRequestException('Event is at capacity');
      }

      const rsvp = await tx.eventRsvp.upsert({
        where: { eventId_userId: { eventId, userId } },
        update: { status: status as any },
        create: { eventId, userId, status: status as any },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      return { rsvp, event, previousStatus: currentRsvp?.status };
    });

    if (status === 'GOING') {
      this.sendCalendarInvite(userId, result.event).catch((err) =>
        this.logger.error('Failed to send calendar invite', err),
      );
    } else if (result.previousStatus === 'GOING') {
      this.sendCalendarCancellation(userId, result.event).catch((err) =>
        this.logger.error('Failed to send calendar cancellation', err),
      );
    }

    return result.rsvp;
  }

  // ── Recordings ─────────────────────────────────────────────────────────

  async findAllRecordings(page = 1, limit = 20, forAdmin = false) {
    limit = Math.max(1, Math.min(limit, 100));
    page = Math.max(1, page);
    const skip = (page - 1) * limit;
    const where = unexpiredRecordings();

    const [data, total] = await Promise.all([
      this.prisma.recording.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          event: { select: { id: true, title: true, startsAt: true, isVirtual: true } },
          attachments: { orderBy: { order: 'asc' } },
        },
      }),
      this.prisma.recording.count({ where }),
    ]);

    return { data: data.map((r) => withRecordingLinks(r, forAdmin)), total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findRecordingsByEvent(eventId: string, forAdmin = false) {
    const recordings = await this.prisma.recording.findMany({
      where: { eventId, ...unexpiredRecordings() },
      orderBy: { createdAt: 'desc' },
      include: { attachments: { orderBy: { order: 'asc' } } },
    });
    return recordings.map((r) => withRecordingLinks(r, forAdmin));
  }

  /** Attaches a file already stored through POST /uploads/file (slides, handouts). */
  async addRecordingAttachment(recordingId: string, uploadId: string) {
    const recording = await this.prisma.recording.findUnique({ where: { id: recordingId } });
    if (!recording) throw new NotFoundException('Recording not found');
    const upload = await this.prisma.upload.findUnique({ where: { id: uploadId } });
    if (!upload) throw new NotFoundException('Upload not found');
    const last = await this.prisma.recordingAttachment.findFirst({ where: { recordingId }, orderBy: { order: 'desc' } });
    const attachment = await this.prisma.recordingAttachment.create({
      data: {
        recordingId,
        filename: upload.filename,
        url: upload.url,
        mimeType: upload.mimeType,
        size: upload.size,
        order: (last?.order ?? 0) + 1,
      },
    });
    return { ...attachment, url: absoluteUploadUrl(signUploadPath(attachment.url)) };
  }

  async deleteRecordingAttachment(attachmentId: string) {
    const attachment = await this.prisma.recordingAttachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.prisma.recordingAttachment.delete({ where: { id: attachmentId } });
    await removeUploadedFiles([attachment.url], this.logger);
    return { message: 'Attachment removed' };
  }

  /**
   * Deletes recordings older than RECORDING_RETENTION_DAYS with their
   * attachments; does nothing when no retention is set. The video itself lives
   * on Vimeo, YouTube, Loom or Drive and is deleted there.
   */
  async deleteExpiredRecordings(now = new Date()) {
    const cutoff = recordingCutoff(now);
    if (!cutoff) return 0;
    const expired = { createdAt: { lt: cutoff } };
    const files = await this.prisma.recordingAttachment.findMany({ where: { recording: expired }, select: { url: true } });
    const result = await this.prisma.recording.deleteMany({ where: expired });
    await removeUploadedFiles(files.map((f) => f.url), this.logger);
    if (result.count > 0) this.logger.log(`Deleted ${result.count} recordings older than ${recordingRetentionDays()} days`);
    return result.count;
  }

  async createRecording(eventId: string, dto: CreateRecordingDto) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    return this.prisma.recording.create({
      data: { ...dto, eventId },
      include: {
        event: { select: { id: true, title: true, startsAt: true } },
      },
    });
  }

  async deleteRecording(id: string) {
    const recording = await this.prisma.recording.findUnique({ where: { id } });
    if (!recording) throw new NotFoundException('Recording not found');
    await this.prisma.recording.delete({ where: { id } });
    return { message: 'Recording deleted' };
  }

  private async sendCalendarInvite(userId: string, event: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, calendarInvites: true },
    });

    if (!user || !user.calendarInvites) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const icsContent = generateIcs(this.icsEvent(event, appUrl), {
      method: 'REQUEST',
      organizerEmail: this.organizerEmail(),
      attendeeEmail: user.email,
    });

    const locationLine = event.isVirtual
      ? (event.meetingUrl ? `<a href="${this.esc(event.meetingUrl)}">Online-Termin beitreten</a>` : 'Online')
      : (event.location ? this.esc(event.location) : 'Ort folgt');

    await this.email.send({
      to: user.email,
      subject: `Kalendereinladung: ${event.title}`,
      html: this.buildInviteHtml(user.name, event, locationLine, appUrl),
      icalEvent: icsContent,
      icalMethod: 'REQUEST',
    });
  }

  /**
   * Withdraws the invitation sent on RSVP. Same UID and organizer, higher
   * SEQUENCE, METHOD:CANCEL — calendar apps that accepted the invitation
   * (Google via Gmail, Apple Mail, Outlook) then remove the event. Copies made
   * with "Add to calendar" are not invitations and cannot be reached.
   */
  private async sendCalendarCancellation(userId: string, event: CalendarEvent) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, calendarInvites: true },
    });

    if (!user || !user.calendarInvites) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const icsContent = generateIcs(this.icsEvent(event, appUrl), {
      method: 'CANCEL',
      organizerEmail: this.organizerEmail(),
      attendeeEmail: user.email,
    });

    await this.email.send({
      to: user.email,
      subject: `Aus deinem Kalender entfernt: ${event.title}`,
      html: `<p>Hallo ${escapeHtml(firstName(user.name))},</p><p><strong>${escapeHtml(event.title)}</strong> wurde aus deinem Kalender entfernt, weil du nicht mehr zugesagt hast oder die Veranstaltung nicht stattfindet.</p>`,
      icalEvent: icsContent,
      icalMethod: 'CANCEL',
    });
  }

  private icsEvent(event: CalendarEvent, appUrl: string) {
    return {
      // Must stay identical between invitation and cancellation.
      uid: `${event.id}@community`,
      title: event.title,
      description: event.description,
      location: event.isVirtual ? event.meetingUrl || 'Online' : event.location || undefined,
      url: eventUrl(appUrl, event.id),
      startsAt: new Date(event.startsAt),
      endsAt: new Date(event.endsAt),
    };
  }

  private organizerEmail(): string {
    // SMTP_FROM may be `Name <address>`; ORGANIZER needs the bare address.
    const from = process.env.SMTP_FROM || 'noreply@community.local';
    return from.match(/<([^>]+)>/)?.[1] ?? from;
  }

  private buildInviteHtml(userName: string, event: any, locationLine: string, appUrl: string): string {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    const dateStr = mailDate(start);
    const timeStr = `${mailTime(start)} – ${mailTime(end)} Uhr`;

    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#090d16;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#090d16;padding:24px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding:24px 32px;background:rgba(17,24,39,0.9);border-radius:12px 12px 0 0;border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:13px;color:#9ca3af;">Du bist dabei!</div>
          <div style="font-size:20px;font-weight:600;color:#f3f4f6;margin-top:4px;">${this.esc(event.title)}</div>
        </td></tr>
        <tr><td style="padding:24px 32px;background:rgba(17,24,39,0.7);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;color:#9ca3af;font-size:13px;width:80px;">Wann</td>
              <td style="padding:8px 0;color:#e5e7eb;font-size:14px;">${dateStr}<br/>${timeStr}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#9ca3af;font-size:13px;">Wo</td>
              <td style="padding:8px 0;color:#e5e7eb;font-size:14px;">${locationLine}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 32px 24px;background:rgba(17,24,39,0.7);">
          <div style="font-size:13px;color:#9ca3af;margin-bottom:12px;">${this.esc(htmlToText(event.description)).slice(0, 300)}</div>
          <a href="${eventUrl(appUrl, event.id)}" style="display:inline-block;padding:10px 20px;background:#c5a880;color:#090d16;font-weight:600;font-size:14px;border-radius:8px;text-decoration:none;">Zur Veranstaltung</a>
        </td></tr>
        <tr><td style="padding:16px 32px;background:rgba(17,24,39,0.7);border-radius:0 0 12px 12px;border-top:1px solid rgba(255,255,255,0.05);">
          <div style="font-size:12px;color:#6b7280;">Eine Kalendereinladung (.ics) ist angehängt. <a href="${appUrl}/settings" style="color:#c5a880;text-decoration:underline;">Benachrichtigungen verwalten</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private esc(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * RSVP to every upcoming occurrence of a series at once (e.g. a daily
   * journaling session). Full occurrences are skipped. Instead of one calendar
   * invitation per occurrence (a weekday series would mean ~260 e-mails) the
   * member gets one confirmation; the occurrences reach their calendar through
   * the calendar subscription.
   */
  async rsvpSeries(seriesId: string, userId: string, status: string) {
    const occurrences = await this.prisma.event.findMany({
      where: { seriesId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      include: {
        _count: { select: { rsvps: { where: { status: 'GOING' } } } },
        rsvps: { where: { userId }, select: { status: true } },
      },
    });
    if (occurrences.length === 0) throw new NotFoundException('No upcoming occurrences in this series');

    let skippedFull = 0;
    const ids: string[] = [];
    for (const occ of occurrences) {
      const alreadyGoing = occ.rsvps[0]?.status === 'GOING';
      if (occ.maxRsvps && status === 'GOING' && !alreadyGoing && (occ._count as any).rsvps >= occ.maxRsvps) {
        skippedFull++;
        continue;
      }
      ids.push(occ.id);
    }
    await this.prisma.$transaction(
      ids.map((eventId) =>
        this.prisma.eventRsvp.upsert({
          where: { eventId_userId: { eventId, userId } },
          update: { status: status as any },
          create: { eventId, userId, status: status as any },
        }),
      ),
    );

    if (status === 'GOING' && ids.length > 0) {
      const first = occurrences.find((o) => o.id === ids[0])!;
      this.sendSeriesConfirmation(userId, first, ids.length).catch((err) =>
        this.logger.error('Failed to send series confirmation', err),
      );
    }
    return { count: ids.length, skippedFull };
  }

  /** Withdraws the member's RSVPs from every upcoming occurrence of a series. */
  async cancelSeriesRsvp(seriesId: string, userId: string) {
    const result = await this.prisma.eventRsvp.deleteMany({
      where: { userId, event: { seriesId, startsAt: { gte: new Date() } } },
    });
    return { count: result.count };
  }

  private async sendSeriesConfirmation(userId: string, first: any, count: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, calendarInvites: true },
    });
    if (!user || !user.calendarInvites) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const start = new Date(first.startsAt);
    const end = new Date(first.endsAt);
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#090d16;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#090d16;padding:24px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding:24px 32px;background:rgba(17,24,39,0.9);border-radius:12px 12px 0 0;border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="font-size:13px;color:#9ca3af;">Du bist bei allen kommenden Terminen dabei</div>
          <div style="font-size:20px;font-weight:600;color:#f3f4f6;margin-top:4px;">${this.esc(first.title)}</div>
        </td></tr>
        <tr><td style="padding:24px 32px;background:rgba(17,24,39,0.7);color:#e5e7eb;font-size:14px;">
          ${count} Termine, der nächste am ${mailDate(start)}, ${mailTime(start)} – ${mailTime(end)} Uhr.
          <div style="font-size:13px;color:#9ca3af;margin-top:12px;">Damit dein Kalender nicht mit Einzeleinladungen überläuft, schicken wir für Serien keine .ics-Dateien. Über das Kalender-Abo auf der Veranstaltungsseite erscheinen alle Termine automatisch in deinem Kalender.</div>
          <a href="${eventUrl(appUrl, first.id)}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#c5a880;color:#090d16;font-weight:600;font-size:14px;border-radius:8px;text-decoration:none;">Zur Veranstaltung</a>
        </td></tr>
        <tr><td style="padding:16px 32px;background:rgba(17,24,39,0.7);border-radius:0 0 12px 12px;border-top:1px solid rgba(255,255,255,0.05);">
          <div style="font-size:12px;color:#6b7280;"><a href="${appUrl}/settings" style="color:#c5a880;text-decoration:underline;">Benachrichtigungen verwalten</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    await this.email.send({ to: user.email, subject: `Zugesagt: ${first.title} (${count} Termine)`, html });
  }

  async cancelRsvp(eventId: string, userId: string) {
    const existing = await this.prisma.eventRsvp.findUnique({
      where: { eventId_userId: { eventId, userId } },
      include: { event: true },
    });
    await this.prisma.eventRsvp.deleteMany({
      where: { eventId, userId },
    });

    // Only GOING sends an invitation, so only GOING needs withdrawing.
    if (existing?.status === 'GOING' && existing.event) {
      this.sendCalendarCancellation(userId, existing.event).catch((err) =>
        this.logger.error('Failed to send calendar cancellation', err),
      );
    }
    return { message: 'RSVP cancelled' };
  }
}
