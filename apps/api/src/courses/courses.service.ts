import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateLessonDto, UpdateLessonDto } from './dto/course-content.dto';
import { sanitizeRichText } from '../common/sanitize-rich-text';
import { toVideoEmbed, videoDownloadPage } from './video-url';
import { signUploadPath } from '../uploads/attachment-links';
import { absoluteUploadUrl } from '../uploads/public-url';
import { lessonAvailableAt } from './lesson-release';
import { coverCreditValue } from '../events/cover-image';
import { deleteUnusedHostedVideos, hostedVideoExists, isHostedVideo } from '../videos/hosted-video';

const lessonInclude = {
  attachments: { orderBy: { order: 'asc' as const } },
};

/**
 * Stored upload URLs are relative when files live on the API's own disk
 * (no S3). The web app runs on another origin, so hand out absolute links.
 */

/** PDF and audio can be shown in the lesson itself; everything else must be downloaded to open. */
export function isViewableInBrowser(mimeType: string): boolean {
  return mimeType === 'application/pdf' || mimeType.startsWith('audio/');
}

/** Normalises a video link, or rejects hosts that cannot be embedded. Videos uploaded to the platform must exist. */
function checkedVideoUrl(videoUrl: string | null | undefined): string | null | undefined {
  if (videoUrl === undefined) return undefined;
  if (videoUrl === null || videoUrl.trim() === '') return null;
  if (isHostedVideo(videoUrl.trim())) {
    if (!hostedVideoExists(videoUrl.trim())) throw new BadRequestException('Uploaded video not found');
    return videoUrl.trim();
  }
  if (!toVideoEmbed(videoUrl)) {
    throw new BadRequestException('Video link must be a YouTube, Vimeo or Loom link');
  }
  return videoUrl.trim();
}

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, userId?: string, userRole?: string) {
    limit = Math.max(1, Math.min(limit, 100));
    page = Math.max(1, page);
    const skip = (page - 1) * limit;
    const where = userRole === 'ADMIN' ? {} : { isPublished: true };
    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { modules: true, progress: true } },
          progress: userId ? { where: { userId } } : false,
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId?: string, userRole?: string) {
    const where: any = { id };
    if (userRole !== 'ADMIN') where.isPublished = true;

    const course = await this.prisma.course.findUnique({
      where,
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lessons: { orderBy: { order: 'asc' }, include: lessonInclude },
          },
        },
        progress: userId ? { where: { userId } } : false,
        categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { progress: true } },
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Admins edit the course and see everything as stored; courses without
    // drip have nothing to hold back.
    if (userRole === 'ADMIN' || !userId || course.releaseMode !== 'DRIP') {
      const forAdmin = userRole === 'ADMIN';
      return { ...course, modules: course.modules.map((m) => ({ ...m, lessons: m.lessons.map((l) => this.present(l, null, forAdmin)) })) };
    }

    const startedAt = await this.startedAt(course.id, userId);
    return {
      ...course,
      modules: course.modules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => this.present(l, lessonAvailableAt(course.releaseMode, startedAt, l.releaseAfterDays))),
      })),
    };
  }

  /**
   * The member's start of the course, which drip lessons count from. Recorded
   * on their first visit by creating their progress row.
   */
  private async startedAt(courseId: string, userId: string): Promise<Date> {
    const progress = await this.prisma.progress.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: { userId, courseId },
    });
    return progress.createdAt;
  }

  /**
   * Adds the embeddable video link and absolute attachment links. A lesson
   * that has not opened yet is sent without its content, video or files —
   * hiding them in the browser alone would leave them one request away.
   * Members get only the player link, not the video's own page: an unlisted
   * share link copied from a response would play anywhere. Admins keep it to
   * edit the lesson.
   */
  private present<L extends { content: string; videoUrl?: string | null; attachments?: { url: string }[] }>(
    lesson: L,
    availableAt: Date | null = null,
    forAdmin = false,
  ) {
    if (availableAt) {
      return {
        ...lesson,
        content: '',
        videoUrl: null,
        videoEmbedUrl: null,
        videoFileUrl: null,
        videoDownloadUrl: null,
        attachments: [],
        locked: true,
        availableAt,
      };
    }
    return {
      ...lesson,
      videoUrl: forAdmin ? lesson.videoUrl ?? null : null,
      videoEmbedUrl: lesson.videoUrl ? toVideoEmbed(lesson.videoUrl)?.embedUrl ?? null : null,
      // A video uploaded to the platform plays from a signed, expiring link.
      videoFileUrl: isHostedVideo(lesson.videoUrl) ? absoluteUploadUrl(signUploadPath(lesson.videoUrl)) : null,
      // Only when the admin allows it, and only for hosts that offer downloads.
      videoDownloadUrl:
        lesson.videoUrl && (lesson as { videoDownloadable?: boolean }).videoDownloadable
          ? videoDownloadPage(lesson.videoUrl)
          : null,
      attachments: (lesson.attachments ?? []).map((a) => ({ ...a, url: absoluteUploadUrl(signUploadPath(a.url)) })),
      locked: false,
      availableAt: null,
    };
  }

  async create(dto: CreateCourseDto) {
    const { categoryIds, coverCredit, ...data } = dto;
    const course = await this.prisma.course.create({
      data: { ...data, ...(coverCredit !== undefined && { coverCredit: coverCreditValue(coverCredit) }) },
      include: {
        modules: { include: { lessons: true } },
        _count: { select: { modules: true } },
      },
    });
    await this.setCategories(course.id, categoryIds);
    return course;
  }

  async update(id: string, dto: Partial<CreateCourseDto>) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');

    const { categoryIds, coverCredit, ...data } = dto;
    const updated = await this.prisma.course.update({
      where: { id },
      data: { ...data, ...(coverCredit !== undefined && { coverCredit: coverCreditValue(coverCredit) }) },
    });
    await this.setCategories(id, categoryIds);
    return updated;
  }

  /** Explore lists courses by category, but no course could be given one. */
  private async setCategories(courseId: string, categoryIds: string[] | undefined) {
    if (categoryIds === undefined) return;
    await this.prisma.courseCategory.deleteMany({ where: { courseId } });
    if (categoryIds.length === 0) return;
    await this.prisma.courseCategory.createMany({
      data: [...new Set(categoryIds)].map((categoryId) => ({ courseId, categoryId })),
      skipDuplicates: true,
    });
  }

  async delete(id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    const videos = await this.prisma.lesson.findMany({ where: { module: { courseId: id } }, select: { videoUrl: true } });
    await this.prisma.course.delete({ where: { id } });
    await deleteUnusedHostedVideos(this.prisma, videos.map((l) => l.videoUrl), this.logger);
    return { message: 'Course deleted' };
  }

  async getProgress(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: { include: { lessons: { select: { id: true } } } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    const progress = await this.prisma.progress.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    const completedLessons: string[] = (progress?.completedLessons as string[]) ?? [];
    return {
      percentage: progress?.percentage ?? 0,
      completedLessons,
      completedAt: progress?.completedAt ?? null,
    };
  }

  async updateProgress(courseId: string, userId: string, percentage: number) {
    if (percentage < 0 || percentage > 100) {
      throw new BadRequestException('Percentage must be between 0 and 100');
    }
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    return this.prisma.progress.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { percentage, completedAt: percentage >= 100 ? new Date() : null },
      create: { userId, courseId, percentage, completedAt: percentage >= 100 ? new Date() : null },
    });
  }

  async completeLesson(courseId: string, userId: string, lessonId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: { include: { lessons: { select: { id: true, releaseAfterDays: true } } } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    const totalLessons = course.modules.flatMap((m) => m.lessons).length;
    if (totalLessons === 0) throw new BadRequestException('Course has no lessons');

    const lesson = course.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
    if (!lesson) throw new BadRequestException('Lesson does not belong to this course');
    if (
      course.releaseMode === 'DRIP' &&
      lessonAvailableAt(course.releaseMode, await this.startedAt(courseId, userId), lesson.releaseAfterDays)
    ) {
      throw new ForbiddenException('This lesson has not opened yet');
    }

    const existing = await this.prisma.progress.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    const completedLessons: string[] = (existing?.completedLessons as string[]) ?? [];
    if (!completedLessons.includes(lessonId)) {
      completedLessons.push(lessonId);
    }

    const percentage = Math.round((completedLessons.length / totalLessons) * 100);

    return this.prisma.progress.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {
        completedLessons,
        percentage,
        completedAt: percentage >= 100 ? new Date() : null,
      },
      create: {
        userId,
        courseId,
        completedLessons,
        percentage,
        completedAt: percentage >= 100 ? new Date() : null,
      },
    });
  }

  async getLesson(lessonId: string, userRole?: string, userId?: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: true } }, ...lessonInclude },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (!lesson.module.course.isPublished && userRole !== 'ADMIN') {
      throw new NotFoundException('Lesson not found');
    }
    const course = lesson.module.course;
    if (userRole === 'ADMIN' || !userId || course.releaseMode !== 'DRIP') return this.present(lesson, null, userRole === 'ADMIN');

    return this.present(
      lesson,
      lessonAvailableAt(course.releaseMode, await this.startedAt(course.id, userId), lesson.releaseAfterDays),
    );
  }

  // ── Course content (admin) ────────────────────────────────────────────────
  // Until these existed, modules and lessons could only come from the seed
  // script: the API had no route to create a single lesson.

  async createModule(courseId: string, title: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    const last = await this.prisma.module.findFirst({ where: { courseId }, orderBy: { order: 'desc' } });
    return this.prisma.module.create({
      data: { courseId, title, order: (last?.order ?? 0) + 1 },
      include: { lessons: true },
    });
  }

  async updateModule(moduleId: string, title?: string) {
    await this.findModule(moduleId);
    return this.prisma.module.update({ where: { id: moduleId }, data: { ...(title !== undefined && { title }) } });
  }

  async deleteModule(moduleId: string) {
    await this.findModule(moduleId);
    const videos = await this.prisma.lesson.findMany({ where: { moduleId }, select: { videoUrl: true } });
    await this.prisma.module.delete({ where: { id: moduleId } });
    await deleteUnusedHostedVideos(this.prisma, videos.map((l) => l.videoUrl), this.logger);
    return { message: 'Module deleted' };
  }

  async moveModule(moduleId: string, direction: 'up' | 'down') {
    const mod = await this.findModule(moduleId);
    const neighbour = await this.prisma.module.findFirst({
      where: { courseId: mod.courseId, order: direction === 'up' ? { lt: mod.order } : { gt: mod.order } },
      orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!neighbour) return mod;
    await this.prisma.$transaction([
      this.prisma.module.update({ where: { id: mod.id }, data: { order: neighbour.order } }),
      this.prisma.module.update({ where: { id: neighbour.id }, data: { order: mod.order } }),
    ]);
    return { ...mod, order: neighbour.order };
  }

  async createLesson(moduleId: string, dto: CreateLessonDto) {
    await this.findModule(moduleId);
    const last = await this.prisma.lesson.findFirst({ where: { moduleId }, orderBy: { order: 'desc' } });
    const lesson = await this.prisma.lesson.create({
      data: {
        moduleId,
        title: dto.title,
        content: sanitizeRichText(dto.content ?? ''),
        videoUrl: checkedVideoUrl(dto.videoUrl) ?? null,
        releaseAfterDays: dto.releaseAfterDays ?? 0,
        order: (last?.order ?? 0) + 1,
      },
      include: lessonInclude,
    });
    return this.present(lesson, null, true);
  }

  async updateLesson(lessonId: string, dto: UpdateLessonDto) {
    const before = await this.findLesson(lessonId);
    const lesson = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: sanitizeRichText(dto.content) }),
        ...(dto.videoUrl !== undefined && { videoUrl: checkedVideoUrl(dto.videoUrl) }),
        ...(dto.releaseAfterDays !== undefined && { releaseAfterDays: dto.releaseAfterDays }),
        ...(dto.videoDownloadable !== undefined && { videoDownloadable: dto.videoDownloadable }),
      },
      include: lessonInclude,
    });
    // A replaced or removed video uploaded to the platform is deleted from disk.
    if (before.videoUrl !== lesson.videoUrl) await deleteUnusedHostedVideos(this.prisma, [before.videoUrl], this.logger);
    return this.present(lesson, null, true);
  }

  /** Viewable types (PDF, audio) may be view-only; Office files cannot be shown in a browser. */
  async updateAttachment(attachmentId: string, downloadable: boolean) {
    const attachment = await this.prisma.lessonAttachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (!downloadable && !isViewableInBrowser(attachment.mimeType)) {
      throw new BadRequestException(
        'Browsers cannot display this file type. To offer it view-only, upload a PDF version instead.',
      );
    }
    const updated = await this.prisma.lessonAttachment.update({ where: { id: attachmentId }, data: { downloadable } });
    return { ...updated, url: absoluteUploadUrl(signUploadPath(updated.url)) };
  }

  async deleteLesson(lessonId: string) {
    const lesson = await this.findLesson(lessonId);
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    await deleteUnusedHostedVideos(this.prisma, [lesson.videoUrl], this.logger);
    return { message: 'Lesson deleted' };
  }

  async moveLesson(lessonId: string, direction: 'up' | 'down') {
    const lesson = await this.findLesson(lessonId);
    const neighbour = await this.prisma.lesson.findFirst({
      where: { moduleId: lesson.moduleId, order: direction === 'up' ? { lt: lesson.order } : { gt: lesson.order } },
      orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
    });
    if (!neighbour) return lesson;
    await this.prisma.$transaction([
      this.prisma.lesson.update({ where: { id: lesson.id }, data: { order: neighbour.order } }),
      this.prisma.lesson.update({ where: { id: neighbour.id }, data: { order: lesson.order } }),
    ]);
    return { ...lesson, order: neighbour.order };
  }

  /**
   * Moves a lesson into another module of the same course, at its end. Notes,
   * attachments and members' progress stay with the lesson (they refer to it,
   * not to the module).
   */
  async moveLessonToModule(lessonId: string, moduleId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, include: { module: true } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const target = await this.findModule(moduleId);
    if (target.courseId !== lesson.module.courseId) {
      throw new BadRequestException('Lessons can only move between modules of the same course');
    }
    if (target.id === lesson.moduleId) return this.present(lesson);
    const last = await this.prisma.lesson.findFirst({ where: { moduleId }, orderBy: { order: 'desc' } });
    const moved = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { moduleId, order: (last?.order ?? 0) + 1 },
      include: lessonInclude,
    });
    return this.present(moved);
  }

  /** Attaches a file already stored through POST /uploads/file. */
  async addAttachment(lessonId: string, uploadId: string) {
    await this.findLesson(lessonId);
    const upload = await this.prisma.upload.findUnique({ where: { id: uploadId } });
    if (!upload) throw new NotFoundException('Upload not found');
    const last = await this.prisma.lessonAttachment.findFirst({ where: { lessonId }, orderBy: { order: 'desc' } });
    const attachment = await this.prisma.lessonAttachment.create({
      data: {
        lessonId,
        filename: upload.filename,
        url: upload.url,
        mimeType: upload.mimeType,
        size: upload.size,
        order: (last?.order ?? 0) + 1,
      },
    });
    return { ...attachment, url: absoluteUploadUrl(signUploadPath(attachment.url)) };
  }

  async deleteAttachment(attachmentId: string) {
    const attachment = await this.prisma.lessonAttachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.prisma.lessonAttachment.delete({ where: { id: attachmentId } });
    return { message: 'Attachment removed' };
  }

  private async findModule(moduleId: string) {
    const mod = await this.prisma.module.findUnique({ where: { id: moduleId } });
    if (!mod) throw new NotFoundException('Module not found');
    return mod;
  }

  private async findLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  async getNote(userId: string, lessonId: string) {
    return this.prisma.courseNote.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
  }

  async upsertNote(userId: string, lessonId: string, content: string) {
    return this.prisma.courseNote.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { content },
      create: { userId, lessonId, content },
    });
  }
}
