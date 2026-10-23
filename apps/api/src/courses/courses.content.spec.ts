import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;

function buildPrisma() {
  return {
    course: { findUnique: vi.fn() },
    module: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    lesson: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    lessonAttachment: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    upload: { findUnique: vi.fn() },
    progress: { findUnique: vi.fn(), upsert: vi.fn() },
  };
}

function lesson(id: string, releaseAfterDays: number) {
  return {
    id,
    title: id,
    content: `<p>${id} text</p>`,
    videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    releaseAfterDays,
    order: 1,
    attachments: [{ id: `${id}-a`, url: '/uploads/uploads/u/worksheet.pdf' }],
  };
}

describe('CoursesService — course content', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: CoursesService;

  beforeEach(async () => {
    prisma = buildPrisma();
    const module = await Test.createTestingModule({
      providers: [CoursesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(CoursesService);
  });

  describe('drip release', () => {
    beforeEach(() => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'c1',
        isPublished: true,
        releaseMode: 'DRIP',
        modules: [{ id: 'm1', lessons: [lesson('day0', 0), lesson('day7', 7)] }],
      });
      // The member started two days ago.
      prisma.progress.upsert.mockResolvedValue({ createdAt: new Date(Date.now() - 2 * DAY) });
    });

    it('sends a lesson that has not opened without its content, video or files', async () => {
      const course = await service.findOne('c1', 'member-1', 'MEMBER');
      const [open, locked] = course.modules[0].lessons;

      expect(open).toMatchObject({ locked: false, content: '<p>day0 text</p>' });
      expect(open.videoEmbedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
      // Members get the player, not the share link they could pass on.
      expect(open.videoUrl).toBeNull();

      expect(locked).toMatchObject({ locked: true, content: '', videoUrl: null, videoEmbedUrl: null, attachments: [] });
      expect(locked.availableAt).toBeInstanceOf(Date);
    });

    it('shows admins every lesson as stored', async () => {
      const course = await service.findOne('c1', 'admin-1', 'ADMIN');
      expect(course.modules[0].lessons.every((l) => !l.locked)).toBe(true);
      expect(course.modules[0].lessons[0].videoUrl).toBe('https://youtu.be/dQw4w9WgXcQ');
      expect(prisma.progress.upsert).not.toHaveBeenCalled();
    });

    it('will not mark a lesson complete before it opens', async () => {
      prisma.course.findUnique.mockResolvedValue({
        id: 'c1',
        releaseMode: 'DRIP',
        modules: [{ lessons: [{ id: 'day7', releaseAfterDays: 7 }] }],
      });

      await expect(service.completeLesson('c1', 'member-1', 'day7')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  it('rejects completing a lesson from another course', async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: 'c1',
      releaseMode: 'ALL_AT_ONCE',
      modules: [{ lessons: [{ id: 'l1', releaseAfterDays: 0 }] }],
    });

    await expect(service.completeLesson('c1', 'member-1', 'not-in-this-course')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('turns stored upload paths into links the web app can open', async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: 'c1',
      isPublished: true,
      releaseMode: 'ALL_AT_ONCE',
      modules: [{ id: 'm1', lessons: [lesson('l1', 0)] }],
    });

    const course = await service.findOne('c1', 'member-1', 'MEMBER');

    expect(course.modules[0].lessons[0].attachments[0].url).toMatch(/^https?:\/\/.+\/uploads\/uploads\/u\/worksheet\.pdf\?exp=\d+&sig=[0-9a-f]{64}$/);
  });

  describe('download controls', () => {
    it('refuses view-only for a Word file, which a browser cannot show', async () => {
      prisma.lessonAttachment.findUnique.mockResolvedValue({
        id: 'a1',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      await expect(service.updateAttachment('a1', false)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.lessonAttachment.update).not.toHaveBeenCalled();
    });

    it('lets a PDF or an audio file be view-only', async () => {
      for (const mimeType of ['application/pdf', 'audio/mpeg']) {
        prisma.lessonAttachment.findUnique.mockResolvedValue({ id: 'a1', mimeType });
        prisma.lessonAttachment.update.mockResolvedValue({ id: 'a1', mimeType, url: '/uploads/x', downloadable: false });

        await expect(service.updateAttachment('a1', false)).resolves.toMatchObject({ downloadable: false });
      }
    });

    it('offers the video download page only when the admin allowed it', async () => {
      const withVideo = (videoDownloadable: boolean) => ({
        id: 'c1',
        isPublished: true,
        releaseMode: 'ALL_AT_ONCE',
        modules: [{ id: 'm1', lessons: [{ ...lesson('l1', 0), videoUrl: 'https://vimeo.com/76979871', videoDownloadable }] }],
      });

      prisma.course.findUnique.mockResolvedValue(withVideo(false));
      expect((await service.findOne('c1', 'u1', 'MEMBER')).modules[0].lessons[0].videoDownloadUrl).toBeNull();

      prisma.course.findUnique.mockResolvedValue(withVideo(true));
      expect((await service.findOne('c1', 'u1', 'MEMBER')).modules[0].lessons[0].videoDownloadUrl).toBe(
        'https://vimeo.com/76979871',
      );
    });
  });

  describe('creating lessons', () => {
    beforeEach(() => {
      prisma.module.findUnique.mockResolvedValue({ id: 'm1', courseId: 'c1', order: 1 });
      prisma.lesson.findFirst.mockResolvedValue({ order: 3 });
      prisma.lesson.create.mockImplementation(async ({ data }) => ({ id: 'new', ...data, attachments: [] }));
    });

    it('appends the lesson and strips scripts from its text', async () => {
      const created = await service.createLesson('m1', {
        title: 'Intro',
        content: '<p>Hello</p><script>alert(1)</script>',
        videoUrl: 'https://vimeo.com/76979871',
      });

      expect(created.order).toBe(4);
      expect(created.content).toBe('<p>Hello</p>');
      expect(created.videoEmbedUrl).toBe('https://player.vimeo.com/video/76979871');
    });

    it('accepts a video uploaded to the platform only when its file exists, and plays it from a signed link', async () => {
      const missing = '/uploads/videos/0b4c5a52-8e8f-4d55-9a0e-6f3e1b2c3d4e.mp4';
      await expect(service.createLesson('m1', { title: 'Intro', videoUrl: missing })).rejects.toBeInstanceOf(BadRequestException);

      const root = mkdtempSync(join(tmpdir(), 'lesson-video-'));
      vi.spyOn(process, 'cwd').mockReturnValue(root);
      try {
        mkdirSync(join(root, 'uploads', 'videos'), { recursive: true });
        writeFileSync(join(root, 'uploads', 'videos', '0b4c5a52-8e8f-4d55-9a0e-6f3e1b2c3d4e.mp4'), 'x');
        const created = await service.createLesson('m1', { title: 'Intro', videoUrl: missing });
        expect(created.videoEmbedUrl).toBeNull();
        expect(created.videoFileUrl).toMatch(/\/uploads\/videos\/0b4c5a52-8e8f-4d55-9a0e-6f3e1b2c3d4e\.mp4\?exp=\d+&sig=[0-9a-f]+$/);
        expect(created.videoDownloadUrl).toBeNull();
      } finally {
        vi.restoreAllMocks();
        rmSync(root, { recursive: true, force: true });
      }
    });

    it('refuses a video link that cannot be embedded', async () => {
      await expect(
        service.createLesson('m1', { title: 'Intro', videoUrl: 'https://example.com/movie.mp4' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.lesson.create).not.toHaveBeenCalled();
    });
  });
});
