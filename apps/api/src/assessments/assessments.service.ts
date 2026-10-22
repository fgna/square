import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import { inspectCommunityContentPack } from '../community-config/content-pack-inspector';
import { validateAssessmentDefinition, AssessmentDefinition } from '../community-config/assessment-definition';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

function round2(n: number): number { return Math.round(n * 100) / 100; }

@Injectable()
export class AssessmentsService {
  private definitionSnapshot?: Promise<AssessmentDefinition>;
  constructor(private readonly prisma: PrismaService) {}

  private definition(): Promise<AssessmentDefinition> {
    if (!this.definitionSnapshot) this.definitionSnapshot = this.loadDefinition();
    return this.definitionSnapshot;
  }

  private async loadDefinition(): Promise<AssessmentDefinition> {
    const root = process.env.COMMUNITY_CONTENT_DIR;
    if (!root) throw new Error('COMMUNITY_CONTENT_DIR is required for assessments');
    const inspected = await inspectCommunityContentPack(root);
    const entry = inspected.manifest.assessment;
    if (!entry) throw new Error('Assessment configuration is not installed');
    const digest = inspected.files.find(f => f.path === entry.definition)?.sha256;
    if (!digest) throw new Error('Assessment definition not found in inspected content package');
    const data = await readFile(resolve(root, entry.definition), 'utf8');
    if (createHash('sha256').update(data).digest('hex') !== digest) throw new Error('Assessment configuration changed during validation');
    const configured = validateAssessmentDefinition(JSON.parse(data));
    if (configured.instrumentId !== entry.instrumentId || configured.instrumentVersion !== entry.instrumentVersion) {
      throw new Error('Assessment configuration identity mismatch');
    }
    return configured;
  }

  async getQuestions(locale?: string) {
    const config = await this.definition();
    return {
      dimensions: config.dimensions.map(key => ({
        key,
        questions: config.questions.filter(q => q.dimension === key).map(q => ({ ...q, text: locale === 'de' ? (q.textDe ?? q.text) : q.text })),
      })),
      totalQuestions: config.questions.length,
    };
  }

  async submit(userId: string, dto: SubmitAssessmentDto) {
    const config = await this.definition();
    const byId = new Map(config.questions.map(q => [q.id, q]));
    if (dto.answers.length !== byId.size || new Set(dto.answers.map(a => a.questionId)).size !== byId.size ||
        dto.answers.some(a => !byId.has(a.questionId))) {
      throw new BadRequestException('Exactly one answer per configured question is required');
    }
    const scores: Record<string, number | null> = {};
    for (const dimension of config.dimensions) {
      const answered = dto.answers.filter(a => byId.get(a.questionId)!.dimension === dimension && a.score != null)
        .map(a => a.score as number);
      scores[dimension] = answered.length >= config.minimumAnswersPerDimension
        ? round2(answered.reduce((sum, value) => sum + value, 0) / answered.length) : null;
    }
    const values = Object.values(scores);
    const overallScore = values.length > 0 && values.every(value => value != null)
      ? round2((values as number[]).reduce((sum, value) => sum + value, 0) / values.length) : null;
    return this.prisma.assessment.create({
      data: {
        userId, scores, overallScore, instrumentVersion: config.instrumentVersion,
        answers: { create: dto.answers.map(answer => {
          const question = byId.get(answer.questionId)!;
          return { questionId: question.id, dimension: question.dimension, text: question.text, score: answer.score ?? null };
        }) },
      },
      include: { answers: true },
    });
  }

  async findAll(userId: string, page = 1, limit = 10) {
    page = Math.max(1, page); limit = Math.max(1, Math.min(50, limit));
    const [data, total] = await Promise.all([
      this.prisma.assessment.findMany({ where: { userId }, orderBy: { completedAt: 'desc' },
        skip: (page - 1) * limit, take: limit }),
      this.prisma.assessment.count({ where: { userId } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findLatest(userId: string) {
    return this.prisma.assessment.findFirst({ where: { userId }, orderBy: { completedAt: 'desc' },
      include: { answers: true } });
  }

  async deleteAll(userId: string) {
    const { count } = await this.prisma.assessment.deleteMany({ where: { userId } });
    return { deleted: count };
  }

  async getRecommendations(userId: string, locale?: string) {
    const config = await this.definition();
    const record = await this.findLatest(userId);
    if (!record || record.instrumentVersion !== config.instrumentVersion) {
      return { dimensions: [], courses: [], events: [] };
    }
    const scores = record.scores as Record<string, number | null>;
    const ranked = config.dimensions.filter(key => scores[key] != null)
      .map(key => ({ key, score: scores[key] as number }))
      .sort((a, b) => a.score - b.score).slice(0, 3);
    const slugs = [...new Set(ranked.flatMap(dim => config.recommendationCategories[dim.key] ?? []))];
    const categories = slugs.length ? await this.prisma.category.findMany({
      where: { slug: { in: slugs } }, select: { id: true, name: true, slug: true, icon: true, color: true },
    }) : [];
    const ids = categories.map(category => category.id);
    const [courses, events, progress] = await Promise.all([
      ids.length ? this.prisma.course.findMany({ where: { isPublished: true,
        categories: { some: { categoryId: { in: ids } } } }, take: 6,
        select: { id: true, title: true, description: true, coverUrl: true } }) : [],
      ids.length ? this.prisma.event.findMany({ where: { startsAt: { gte: new Date() },
        categories: { some: { categoryId: { in: ids } } } }, take: 4, orderBy: { startsAt: 'asc' },
        select: { id: true, title: true, description: true, startsAt: true } }) : [],
      this.prisma.progress.findMany({ where: { userId }, select: { courseId: true, percentage: true } }),
    ]);
    const progressMap = new Map(progress.map(item => [item.courseId, item.percentage]));
    const thresholds = config.scoreBands ?? { strength: 4, solid: 3 };
    return {
      dimensions: ranked.map(dim => ({
        ...dim, band: dim.score >= thresholds.strength ? 'strength' : dim.score >= thresholds.solid ? 'solid' : 'develop',
        lowestQuestions: record.answers.filter(a => a.dimension === dim.key && a.score != null)
          .sort((a, b) => (a.score as number) - (b.score as number)).slice(0, 2)
          .map(a => ({ questionId: a.questionId, text: locale === 'de' ? (config.questions.find(q => q.id === a.questionId)?.textDe ?? a.text) : a.text, score: a.score })),
        categories: categories.filter(category => (config.recommendationCategories[dim.key] ?? []).includes(category.slug)),
      })),
      courses: courses.map(course => ({ ...course, progress: progressMap.get(course.id) ?? 0 })),
      events,
    };
  }

  /** Read-only, admin-only diagnostic identity; never returns private texts or paths. */
  async getPackIdentity() {
    const config = await this.definition();
    return { instrumentId: config.instrumentId, instrumentVersion: config.instrumentVersion };
  }

  isPackManaged(): boolean { return true; }
  async getAdminQuestions() {
    const config = await this.definition();
    return config.questions.map((q, index) => ({
      id: q.id, questionId: q.id, dimension: q.dimension, text: q.text, sortOrder: index, isActive: true,
    }));
  }
  createQuestion(_data: unknown): never { throw new BadRequestException('Questions are managed by the content package'); }
  updateQuestion(_id: string, _data: unknown): never { throw new BadRequestException('Questions are managed by the content package'); }
  deleteQuestion(_id: string): never { throw new BadRequestException('Questions are managed by the content package'); }
}
