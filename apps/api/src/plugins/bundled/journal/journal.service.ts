import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { JournalEntryStore, parseJournalDate } from '../../data/journal-entries.store';
import { ContentPackService } from '../../data/content-pack.service';
import { journalPromptIndices } from './journal-rotation';
import { UpsertJournalDto } from './dto/upsert-journal.dto';
import { CreatePromptDto, UpdatePromptDto, CreateCategoryDto, UpdateCategoryDto } from './dto/create-prompt.dto';

const MONTH_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])$/;

function validateMonthParam(month: string): void {
  if (!MONTH_REGEX.test(month)) {
    throw new BadRequestException('Invalid month format. Expected YYYY-MM.');
  }
}

/** Entries go through JournalEntryStore and the method through ContentPackService, the same services plugins get. */
@Injectable()
export class JournalService {
  constructor(
    private prisma: PrismaService,
    private entries: JournalEntryStore,
    private pack: ContentPackService,
  ) {}

  private assertDbManaged(): void {
    if (this.pack.source() === 'pack') {
      throw new BadRequestException('Journal prompts are managed by the active content pack');
    }
  }

  private method() {
    return this.pack.journalMethod();
  }

  private async localeText(locale?: string) {
    if (!locale) return null;
    if (locale !== 'de' && locale !== 'en') throw new BadRequestException('Unsupported journal locale');
    return this.pack.journalTexts(locale);
  }

  async getMethodFields(locale?: string) {
    const method = await this.method();
    const localized = method ? await this.localeText(locale) : null;
    const fields = method?.fields.map(f => ({ ...f, label: localized?.fields[f.key] ?? f.label })) ?? [];
    return { source: method ? 'pack' : 'legacy', version: method?.version ?? null, fields };
  }

  async getDailyPrompts(locale?: string) {
    const method = await this.method();
    const localized = method ? await this.localeText(locale) : null;
    if (method) {
      const ordered = [...method.prompts].sort((a, b) => a.sortOrder - b.sortOrder);
      const categories = new Map(method.categories.map(c => [c.id, c]));
      const indexes = journalPromptIndices(new Date(), ordered.length, method.rotation.promptsPerDay);
      return indexes.map(index => {
        const prompt = ordered[index];
        const category = categories.get(prompt.categoryId)!;
        return { id: prompt.id, text: localized?.prompts[prompt.id] ?? prompt.text, category: localized?.categories[category.id] ?? category.label, color: category.color };
      });
    }
    const allPrompts = await this.prisma.journalPrompt.findMany({
      where: { isActive: true, category: { isActive: true } },
      include: { category: { select: { name: true, color: true } } },
      // sortOrder is the canon's rotation: three prompts a day, one from each
      // pair of categories, repeating every 30 days with 90 prompts.
      orderBy: [{ sortOrder: 'asc' }],
    });

    if (allPrompts.length === 0) return [];

    const count = Math.min(3, allPrompts.length);
    const result = [];
    // Legacy uses a three-slot stride, even if fewer than three prompts exist.
    const indexes = journalPromptIndices(new Date(), allPrompts.length, count, 3);
    for (const index of indexes) {
      const p = allPrompts[index];
      result.push({ id: p.id, text: p.text, category: p.category.name, color: p.category.color });
    }
    return result;
  }

  // ── Category CRUD (admin) ────────────────────────────────────────────

  async getCategories() {
    const method = await this.method();
    if (method) return method.categories.map((c, index) => ({ id: c.id, name: c.label, color: c.color, isActive: true, sortOrder: index, _count: { prompts: method.prompts.filter(p => p.categoryId === c.id).length } }));
    return this.prisma.journalPromptCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { prompts: true } } },
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    this.assertDbManaged();
    return this.prisma.journalPromptCategory.create({ data: dto });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    this.assertDbManaged();
    return this.prisma.journalPromptCategory.update({ where: { id }, data: dto });
  }

  async deleteCategory(id: string) {
    this.assertDbManaged();
    await this.prisma.journalPromptCategory.delete({ where: { id } });
    return { message: 'Category deleted' };
  }

  // ── Prompt CRUD (admin) ──────────────────────────────────────────────

  async getPrompts(categoryId?: string) {
    const method = await this.method();
    if (method) {
      const categories = new Map(method.categories.map(c => [c.id, c]));
      return method.prompts.filter(p => !categoryId || p.categoryId === categoryId).map(p => ({ id: p.id, text: p.text, categoryId: p.categoryId, isActive: true, sortOrder: p.sortOrder, category: { id: p.categoryId, name: categories.get(p.categoryId)!.label, color: categories.get(p.categoryId)!.color } }));
    }
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    return this.prisma.journalPrompt.findMany({
      where,
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      include: { category: { select: { id: true, name: true, color: true } } },
    });
  }

  async createPrompt(dto: CreatePromptDto) {
    this.assertDbManaged();
    return this.prisma.journalPrompt.create({
      data: dto,
      include: { category: { select: { id: true, name: true, color: true } } },
    });
  }

  async updatePrompt(id: string, dto: UpdatePromptDto) {
    this.assertDbManaged();
    return this.prisma.journalPrompt.update({
      where: { id },
      data: dto,
      include: { category: { select: { id: true, name: true, color: true } } },
    });
  }

  async deletePrompt(id: string) {
    this.assertDbManaged();
    await this.prisma.journalPrompt.delete({ where: { id } });
    return { message: 'Prompt deleted' };
  }

  /**
   * Separate pack-only write path. Legacy structured DTO remains unchanged.
   * The active pack fixes allowed field names and their types.
   */
  async upsertPackEntry(userId: string, date: string, body: unknown) {
    const method = await this.method();
    if (!method) throw new BadRequestException('Pack journal writing requires content pack mode');
    parseJournalDate(date);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Journal payload must be an object');
    }
    const input = body as Record<string, unknown>;
    if (Object.keys(input).length !== 1 || !input.content ||
        typeof input.content !== 'object' || Array.isArray(input.content)) {
      throw new BadRequestException('Expected only journal content object');
    }
    const content = input.content as Record<string, unknown>;
    if (Object.keys(content).length !== method.fields.length ||
        method.fields.some(f => !Object.prototype.hasOwnProperty.call(content, f.key))) {
      throw new BadRequestException('Journal fields do not match active method');
    }
    for (const field of method.fields) {
      const value = content[field.key];
      if (field.kind === 'text') {
        if (typeof value !== 'string' || value.length > 10000) throw new BadRequestException('Invalid journal text');
      } else if (field.kind === 'text-list') {
        if (!Array.isArray(value) || value.length > 20 || value.some(v => typeof v !== 'string' || v.length > 1000)) {
          throw new BadRequestException('Invalid journal text list');
        }
      } else if (!Array.isArray(value) || value.length > 20 || value.some(v =>
        !v || typeof v !== 'object' || Array.isArray(v) ||
        Object.keys(v).some(k => !['text', 'done'].includes(k)) ||
        typeof v.text !== 'string' || v.text.length > 500 || typeof v.done !== 'boolean')) {
        throw new BadRequestException('Invalid journal task list');
      }
    }
    return this.entries.save(userId, date, { content, moods: [] });
  }

  async findAll(userId: string, month?: string) {
    if (!month) return this.entries.list(userId);
    validateMonthParam(month);
    const [year, mon] = month.split('-').map(Number);
    const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`;
    return this.entries.list(userId, { from: `${month}-01`, to: `${next}-01` });
  }

  async findOne(userId: string, date: string) {
    const entry = await this.entries.get(userId, date);
    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }
    return entry;
  }

  async upsert(userId: string, date: string, dto: UpsertJournalDto) {
    if (this.pack.source() === 'pack') {
      throw new BadRequestException('Use the active journal method entry endpoint');
    }
    return this.entries.save(userId, date, { content: dto.content, moods: dto.moods });
  }

  async delete(userId: string, date: string) {
    if (!(await this.entries.remove(userId, date))) {
      throw new NotFoundException('Journal entry not found');
    }
    return { message: 'Journal entry deleted' };
  }

  async getStats(userId: string) {
    const entries = (await this.entries.dates(userId)).map((date) => ({ date }));

    const totalEntries = entries.length;

    // Calculate last 30 days count
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    const last30DaysCount = entries.filter(
      (e) => e.date >= thirtyDaysAgo,
    ).length;

    // Build a set of date strings for streak calculation
    const dateSet = new Set(
      entries.map((e) => {
        const d = new Date(e.date);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      }),
    );

    // Calculate current streak (consecutive days ending today or yesterday)
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkDate = new Date(today);
    // Start from today; if no entry today, check if yesterday has one
    const todayStr = `${checkDate.getUTCFullYear()}-${String(checkDate.getUTCMonth() + 1).padStart(2, '0')}-${String(checkDate.getUTCDate()).padStart(2, '0')}`;
    if (!dateSet.has(todayStr)) {
      // Allow streak to start from yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dateStr = `${checkDate.getUTCFullYear()}-${String(checkDate.getUTCMonth() + 1).padStart(2, '0')}-${String(checkDate.getUTCDate()).padStart(2, '0')}`;
      if (dateSet.has(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    if (entries.length > 0) {
      const sortedDates = Array.from(dateSet).sort();
      let streak = 1;

      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1] + 'T00:00:00.000Z');
        const currDate = new Date(sortedDates[i] + 'T00:00:00.000Z');
        const diffDays =
          (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
          streak++;
        } else {
          longestStreak = Math.max(longestStreak, streak);
          streak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, streak);
    }

    // Build entries by date map for heatmap (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    const entriesByDate: Record<string, boolean> = {};
    entries.forEach((e) => {
      if (e.date >= ninetyDaysAgo) {
        const d = new Date(e.date);
        const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        entriesByDate[dateStr] = true;
      }
    });

    return {
      currentStreak,
      longestStreak,
      totalEntries,
      last30DaysCount,
      entriesByDate,
    };
  }
}
