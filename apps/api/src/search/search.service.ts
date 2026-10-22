import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(q: string, limit = 10) {
    if (!q || q.trim().length < 2) return { posts: [], users: [], courses: [], events: [], recordings: [] };

    const term = q.trim();

    const [posts, users, courses, events, recordings] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          isHidden: false,
          content: { contains: term, mode: 'insensitive' },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          type: true,
          createdAt: true,
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      this.prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { bio: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: { id: true, name: true, bio: true, avatarUrl: true, role: true },
      }),
      this.prisma.course.findMany({
        where: {
          isPublished: true,
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: { id: true, title: true, description: true, coverUrl: true },
      }),
      this.prisma.event.findMany({
        where: {
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { startsAt: 'asc' },
        select: { id: true, title: true, description: true, startsAt: true, isVirtual: true },
      }),
      this.prisma.recording.findMany({
        where: {
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          url: true,
          duration: true,
          event: { select: { id: true, title: true, startsAt: true } },
        },
      }),
    ]);

    return { posts, users, courses, events, recordings };
  }
}
