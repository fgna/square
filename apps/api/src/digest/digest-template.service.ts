import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDigestTemplateDto } from './dto/create-digest-template.dto';
import { UpdateDigestTemplateDto } from './dto/update-digest-template.dto';
import { absoluteUploadUrl } from '../uploads/public-url';
import { digestCover, renderDigest } from '../email/digest-render';
import { coverCreditValue } from '../events/cover-image';

@Injectable()
export class DigestTemplateService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDigestTemplateDto) {
    return this.prisma.digestTemplate.create({
      data: {
        name: dto.name,
        subject: dto.subject,
        headerHtml: dto.headerHtml ?? '',
        footerHtml: dto.footerHtml ?? '',
        sections: dto.sections ?? [],
        accentColor: dto.accentColor ?? '#c5a880',
        logoUrl: dto.logoUrl,
        coverUrl: dto.coverUrl,
        ...(dto.coverCredit !== undefined && { coverCredit: coverCreditValue(dto.coverCredit) }),
        isActive: dto.isActive ?? false,
      },
    });
  }

  async findAll() {
    return this.prisma.digestTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.digestTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Digest template not found');
    return template;
  }

  async update(id: string, dto: UpdateDigestTemplateDto) {
    await this.findOne(id);
    const { coverCredit, ...data } = dto;
    return this.prisma.digestTemplate.update({
      where: { id },
      data: { ...data, ...(coverCredit !== undefined && { coverCredit: coverCreditValue(coverCredit) }) },
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.digestTemplate.delete({ where: { id } });
    return { message: 'Digest template deleted' };
  }

  async setActive(id: string) {
    await this.findOne(id);
    await this.prisma.$transaction([
      this.prisma.digestTemplate.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      this.prisma.digestTemplate.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);
    return this.prisma.digestTemplate.findUnique({ where: { id } });
  }

  /** The template as members will see it, with sample content. */
  async renderPreview(id: string): Promise<string> {
    const template = await this.findOne(id);
    const day = 24 * 60 * 60 * 1000;
    const { html } = renderDigest(
      {
        subject: template.subject,
        headerHtml: template.headerHtml,
        footerHtml: template.footerHtml,
        sections: Array.isArray(template.sections) ? (template.sections as string[]) : null,
        accentColor: template.accentColor,
        logoUrl: template.logoUrl ? absoluteUploadUrl(template.logoUrl) : null,
        ...digestCover(template),
      },
      {
        userName: 'Alex',
        platformName: (await this.prisma.platformSettings.findFirst())?.platformName || 'Community',
        frequency: 'WEEKLY',
        appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        newPosts: 3,
        topPosts: [
          { authorName: 'Sam', snippet: 'Welche Gewohnheit hilft dir am Montagmorgen am meisten?', reactions: 4, comments: 2 },
          { authorName: 'Robin', snippet: 'Danke für die Session gestern – hier meine drei Erkenntnisse.', reactions: 2, comments: 1 },
        ],
        upcomingEvents: [
          { title: 'Workshop', startsAt: new Date(Date.now() + 2 * day) },
          { title: 'Austausch am Abend', startsAt: new Date(Date.now() + 5 * day) },
        ],
        upcomingEventCount: 2,
        newCourses: [{ title: 'Neuer Kurs' }],
        unreadNotifications: 1,
      },
    );
    return html;
  }
}
