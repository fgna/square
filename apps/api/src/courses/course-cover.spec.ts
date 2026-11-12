import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '@prisma/client';
import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { CreateCourseDto } from './dto/create-course.dto';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

const base = { title: 'Führen statt Reagieren', description: 'Warum Du mit klaren Grenzen führst' };
const credit = { name: 'Jane Doe', url: 'https://unsplash.com/@jane?utm_source=square&utm_medium=referral', source: 'unsplash' };

async function errors(body: Record<string, unknown>) {
  return (await validate(plainToInstance(CreateCourseDto, { ...base, ...body }))).map((e) => e.property);
}

describe('Course cover from Unsplash', () => {
  it('accepts an upload or an Unsplash photo with its credit, and null to remove', async () => {
    expect(await errors({ coverUrl: '/uploads/uploads/u1/cover.jpg' })).toEqual([]);
    expect(await errors({ coverUrl: 'https://images.unsplash.com/photo-1?w=1080', coverCredit: credit })).toEqual([]);
    expect(await errors({ coverUrl: null, coverCredit: null })).toEqual([]);
  });

  it('refuses other addresses and credits that do not point to Unsplash', async () => {
    expect(await errors({ coverUrl: 'https://evil.example/x.jpg' })).toContain('coverUrl');
    expect(await errors({ coverUrl: 'javascript:alert(1)' })).toContain('coverUrl');
    expect(await errors({ coverCredit: { ...credit, url: 'https://evil.example/@jane' } })).toContain('coverCredit');
  });

  it('stores the credit with the cover and removes it with null', async () => {
    const prisma = { course: {
      findUnique: vi.fn().mockResolvedValue({ id: 'c1' }),
      update: vi.fn().mockResolvedValue({ id: 'c1' }),
    }, courseCategory: { deleteMany: vi.fn(), createMany: vi.fn() } };
    const service = new CoursesService(prisma as never);
    await service.update('c1', { coverUrl: 'https://images.unsplash.com/photo-1', coverCredit: credit });
    expect(prisma.course.update).toHaveBeenLastCalledWith({ where: { id: 'c1' },
      data: { coverUrl: 'https://images.unsplash.com/photo-1', coverCredit: credit } });
    await service.update('c1', { coverUrl: '/uploads/uploads/u1/c.jpg', coverCredit: null });
    expect(prisma.course.update).toHaveBeenLastCalledWith({ where: { id: 'c1' },
      data: { coverUrl: '/uploads/uploads/u1/c.jpg', coverCredit: Prisma.DbNull } });
  });

  it('registers the photo search before /:id, for admins only', () => {
    const proto = CoursesController.prototype as any;
    const names = Object.getOwnPropertyNames(proto).filter((n) => Reflect.getMetadata(METHOD_METADATA, proto[n]) !== undefined);
    const gets = names.filter((n) => Reflect.getMetadata(METHOD_METADATA, proto[n]) === RequestMethod.GET)
      .map((n) => Reflect.getMetadata(PATH_METADATA, proto[n]));
    expect(gets.indexOf('covers/search')).toBeGreaterThanOrEqual(0);
    expect(gets.indexOf('covers/search')).toBeLessThan(gets.indexOf(':id'));
    for (const handler of ['coverStatus', 'searchCovers', 'coverChosen']) {
      expect(Reflect.getMetadata('roles', proto[handler])).toEqual(['ADMIN']);
    }
  });
});
