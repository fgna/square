import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '@prisma/client';
import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { CreateDigestTemplateDto } from './dto/create-digest-template.dto';
import { DigestTemplateController } from './digest-template.controller';
import { DigestTemplateService } from './digest-template.service';
import { digestCover, renderDigest, type DigestContent } from '../email/digest-render';
import { sanitizeRichText } from '../common/sanitize-rich-text';

const credit = { name: 'Jane <Doe>', url: 'https://unsplash.com/@jane?utm_source=square&utm_medium=referral', source: 'unsplash' };
const content: DigestContent = {
  userName: 'Alex', platformName: 'GrowthLeaders', frequency: 'WEEKLY', appUrl: 'https://example.test',
  newPosts: 0, topPosts: [], upcomingEvents: [], upcomingEventCount: 0, newCourses: [], unreadNotifications: 0,
};

async function errors(body: Record<string, unknown>) {
  const dto = plainToInstance(CreateDigestTemplateDto, { name: 'Woche', subject: 'Deine Woche', ...body });
  return (await validate(dto)).map((e) => e.property);
}

describe('Digest cover and logo', () => {
  it('accepts an uploaded logo and an uploaded or Unsplash cover', async () => {
    expect(await errors({ logoUrl: '/uploads/uploads/u1/logo.png' })).toEqual([]);
    expect(await errors({ logoUrl: 'https://example.com/logo.png' })).toEqual([]);
    expect(await errors({ coverUrl: 'https://images.unsplash.com/p1', coverCredit: credit })).toEqual([]);
    expect(await errors({ coverUrl: '/uploads/uploads/u1/cover.jpg', coverCredit: null })).toEqual([]);
  });

  it('refuses scripts and outside cover addresses', async () => {
    expect(await errors({ logoUrl: 'javascript:alert(1)' })).toContain('logoUrl');
    expect(await errors({ coverUrl: 'https://evil.example/x.jpg' })).toContain('coverUrl');
    expect(await errors({ coverCredit: { ...credit, url: 'https://evil.example/@jane' } })).toContain('coverCredit');
  });

  it('shows the cover on top of the e-mail and names the photographer', () => {
    const look = digestCover({ coverUrl: 'https://images.unsplash.com/p1', coverCredit: credit });
    const { html } = renderDigest(look, content);
    expect(html).toContain('<img src="https://images.unsplash.com/p1"');
    expect(html).toContain('Foto: <a href="https://unsplash.com/@jane?utm_source=square&amp;utm_medium=referral"');
    expect(html).toContain('Jane &lt;Doe&gt;');
    expect(html.indexOf('images.unsplash.com/p1')).toBeLessThan(html.indexOf('Hallo Alex'));
  });

  it('gives an uploaded cover a full address and no credit', () => {
    vi.stubEnv('API_URL', 'https://api.example.test');
    expect(digestCover({ coverUrl: '/uploads/uploads/u1/c.jpg', coverCredit: credit })).toEqual({
      coverUrl: 'https://api.example.test/uploads/uploads/u1/c.jpg', coverCredit: { name: credit.name, url: credit.url } });
    expect(digestCover({ coverUrl: null })).toEqual({ coverUrl: null, coverCredit: null });
    expect(renderDigest(digestCover({ coverUrl: null }), content).html).not.toContain('Foto:');
    vi.unstubAllEnvs();
  });

  it('stores the credit with the cover and removes it with null', async () => {
    const prisma = { digestTemplate: { findUnique: vi.fn().mockResolvedValue({ id: 't1' }), update: vi.fn().mockResolvedValue({}) } };
    const service = new DigestTemplateService(prisma as never);
    await service.update('t1', { coverUrl: 'https://images.unsplash.com/p1', coverCredit: credit });
    expect(prisma.digestTemplate.update).toHaveBeenLastCalledWith({ where: { id: 't1' }, data: { coverUrl: 'https://images.unsplash.com/p1', coverCredit: credit } });
    await service.update('t1', { coverUrl: null, coverCredit: null });
    expect(prisma.digestTemplate.update).toHaveBeenLastCalledWith({ where: { id: 't1' }, data: { coverUrl: null, coverCredit: Prisma.DbNull } });
  });

  it('registers the photo search before /:id, for admins only', () => {
    const proto = DigestTemplateController.prototype as any;
    const gets = Object.getOwnPropertyNames(proto)
      .filter((n) => Reflect.getMetadata(METHOD_METADATA, proto[n]) === RequestMethod.GET)
      .map((n) => Reflect.getMetadata(PATH_METADATA, proto[n]));
    expect(gets.indexOf('covers/search')).toBeGreaterThanOrEqual(0);
    expect(gets.indexOf('covers/search')).toBeLessThan(gets.indexOf(':id'));
    for (const handler of ['coverStatus', 'searchCovers', 'coverChosen']) {
      expect(Reflect.getMetadata('roles', proto[handler])).toEqual(['ADMIN']);
    }
  });
});

describe('Lesson text with an Unsplash photo', () => {
  it('keeps the hotlinked photo and its credit links when stored', () => {
    const html = '<img src="https://images.unsplash.com/p1" alt="Team"><p><em>Foto: <a href="https://unsplash.com/@jane?utm_source=square&amp;utm_medium=referral" target="_blank" rel="noopener noreferrer">Jane</a> auf <a href="https://unsplash.com/?utm_source=square&amp;utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a></em></p>';
    const clean = sanitizeRichText(html);
    expect(clean).toContain('src="https://images.unsplash.com/p1"');
    expect(clean).toContain('href="https://unsplash.com/@jane?utm_source=square&amp;utm_medium=referral"');
  });
});
