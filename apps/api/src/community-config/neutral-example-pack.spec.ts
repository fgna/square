import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { inspectCommunityContentPack } from './content-pack-inspector';
import { AssessmentsService } from '../assessments/assessments.service';
import { JournalService } from '../plugins/bundled/journal/journal.service';
import { PrismaService } from '../prisma/prisma.service';
import { JournalEntryStore } from '../plugins/data/journal-entries.store';
import { ContentPackService } from '../plugins/data/content-pack.service';

/** The service with the Core's entry store and content pack over the given Prisma stand-in. */
const journalService = (prisma: PrismaService) => new JournalService(prisma, new JournalEntryStore(prisma), new ContentPackService());

const source = process.env.COMMUNITY_CONTENT_SOURCE;
const dir = process.env.COMMUNITY_CONTENT_DIR;
afterEach(() => {
  if (source === undefined) delete process.env.COMMUNITY_CONTENT_SOURCE;
  else process.env.COMMUNITY_CONTENT_SOURCE = source;
  if (dir === undefined) delete process.env.COMMUNITY_CONTENT_DIR;
  else process.env.COMMUNITY_CONTENT_DIR = dir;
});
describe('fully synthetic neutral installation contract', () => {
  it('inspects assessment + journal files and renders both data models with no DB seed', async () => {
    const root = resolve(process.cwd(), '../../examples/neutral-method-pack');
    const inspected = await inspectCommunityContentPack(root);
    expect(inspected.manifest.id).toBe('neutral-sample');
    expect(inspected.files).toHaveLength(4);
    process.env.COMMUNITY_CONTENT_SOURCE = 'pack';
    process.env.COMMUNITY_CONTENT_DIR = root;
    const findMany = vi.fn();
    const prisma = {
      assessmentQuestion: { findMany },
      journalPrompt: { findMany },
    } as unknown as PrismaService;
    const assessment = await new AssessmentsService(prisma).getQuestions();
    expect(assessment.dimensions.map(d => d.key)).toEqual(['Focus', 'Recovery', 'Connection', 'Learning', 'Wellbeing']);
    expect(assessment.totalQuestions).toBe(10);
    const journal = journalService(prisma);
    expect((await journal.getMethodFields('de')).fields.map(f => f.label)).toEqual(['Notizen', 'Pläne', 'Aufgaben']);
    expect((await journal.getMethodFields('en')).fields.map(f => f.label)).toEqual(['Notes', 'Plans', 'Tasks']);
    expect((await journal.getDailyPrompts('de'))).toHaveLength(1);
    expect((await journal.getDailyPrompts('en'))[0].category).toBe('Reflection');
    expect(findMany).not.toHaveBeenCalled();
  });
});
