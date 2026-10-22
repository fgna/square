import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async exportMembersCsv(from?: Date, to?: Date): Promise<string> {
    const where: any = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        membershipTier: true,
        isActive: true,
        createdAt: true,
        _count: { select: { posts: true, comments: true, courseProgress: true } },
      },
    });

    const header = 'id,name,email,role,tier,active,created_at,posts,comments,courses_started';
    const rows = users.map((u) =>
      [
        u.id,
        csvEscape(u.name),
        csvEscape(u.email),
        u.role,
        u.membershipTier,
        u.isActive,
        u.createdAt.toISOString(),
        u._count.posts,
        u._count.comments,
        u._count.courseProgress,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  async exportPostsCsv(from?: Date, to?: Date): Promise<string> {
    const where: any = { isHidden: false };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const posts = await this.prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      include: {
        author: { select: { name: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    });

    const header = 'id,author_name,type,content_preview,created_at,comments,reactions,pinned';
    const rows = posts.map((p) =>
      [
        p.id,
        csvEscape(p.author.name),
        p.type,
        csvEscape(p.content.slice(0, 100)),
        p.createdAt.toISOString(),
        p._count.comments,
        p._count.reactions,
        p.isPinned,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  async exportEventsCsv(from?: Date, to?: Date): Promise<string> {
    const where: any = {};
    if (from || to) {
      where.startsAt = {};
      if (from) where.startsAt.gte = from;
      if (to) where.startsAt.lte = to;
    }

    const events = await this.prisma.event.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      take: 10000,
      include: {
        _count: { select: { rsvps: true } },
      },
    });

    const header = 'id,title,description,location,starts_at,ends_at,virtual,rsvps';
    const rows = events.map((e) =>
      [
        e.id,
        csvEscape(e.title),
        csvEscape((e.description || '').slice(0, 200)),
        csvEscape(e.location || ''),
        e.startsAt.toISOString(),
        e.endsAt.toISOString(),
        e.isVirtual,
        e._count.rsvps,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  async exportCourseProgressCsv(): Promise<string> {
    const progress = await this.prisma.progress.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 10000,
      include: {
        user: { select: { name: true } },
        course: { select: { title: true } },
      },
    });

    const header = 'user_name,course,percentage,completed_at,updated_at';
    const rows = progress.map((p) =>
      [
        csvEscape(p.user.name),
        csvEscape(p.course.title),
        p.percentage,
        p.completedAt?.toISOString() || '',
        p.updatedAt.toISOString(),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
