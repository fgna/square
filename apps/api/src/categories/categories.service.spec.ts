import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

const NOW = new Date('2026-11-02T12:00:00Z');
const category = { id: 'topic-1', name: 'Example', slug: 'example' };
const events = [
  { id: 'past', startsAt: new Date('2026-11-02T11:59:59.999Z') },
  { id: 'boundary', startsAt: NOW },
  { id: 'future', startsAt: new Date('2026-11-03T12:00:00Z') },
];

// Evaluate the requested relation filter against fixed rows so a count of all
// events fails the same way as the user-visible discrepancy in #13.
function matchingEvents(filter: any) {
  const cutoff = filter?.where?.event?.startsAt?.gte;
  return cutoff ? events.filter(e => e.startsAt >= cutoff) : events;
}

describe('topic event counts', () => {
  let service: CategoriesService;
  let prisma: any;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const withCount = (args: any) => ({
      ...category,
      _count: { posts: 3, courses: 4, events: matchingEvents(args.include._count.select.events).length },
    });
    prisma = {
      category: {
        findMany: vi.fn(async args => [withCount(args)]),
        findUnique: vi.fn(async args => args.include ? withCount(args) : category),
      },
      eventCategory: {
        findMany: vi.fn(async args => matchingEvents(args).map(event => ({ event }))),
      },
    };
    service = new CategoriesService(prisma as PrismaService);
  });

  afterEach(() => vi.useRealTimers());

  it('makes topic detail count match upcoming content, including the exact boundary', async () => {
    const detail = await service.findBySlug('example');
    const content = await service.findContentByCategory('example', 'events');
    expect(content.events.map((event: any) => event.id)).toEqual(['boundary', 'future']);
    expect(detail._count.events).toBe(content.events.length);
    expect(detail._count).toMatchObject({ posts: 3, courses: 4 });
  });

  it('uses the same upcoming count in the topic index', async () => {
    expect((await service.findAll())[0]._count.events).toBe(2);
  });

  it('returns zero upcoming items when all event dates are in the past', async () => {
    vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
    expect((await service.findBySlug('example'))._count.events).toBe(0);
    expect((await service.findAll())[0]._count.events).toBe(0);
    expect((await service.findContentByCategory('example', 'events')).events).toEqual([]);
  });

  it('retains the not-found response for an unknown topic', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(service.findBySlug('missing')).rejects.toThrow('Category not found');
  });
});
