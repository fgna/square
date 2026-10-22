import { BadRequestException, Body, Controller, Get, Put, Query } from '@nestjs/common';
import type { ApiPlugin, JournalEntryRecord, PluginContentPack } from '@community/plugin-sdk/api';

const MAX_TEXT = 5000;
const HISTORY_DAYS = 30;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const textOf = (entry: JournalEntryRecord | null) => {
  const content = entry?.content as { text?: unknown } | undefined;
  return typeof content?.text === 'string' ? content.text : '';
};

/** The pack's prompt for a day, in the member's language, or null without a pack. */
export async function promptOfTheDay(pack: PluginContentPack, day: Date, locale: 'de' | 'en') {
  const method = await pack.journalMethod();
  if (!method || method.prompts.length === 0) return null;
  const prompts = [...method.prompts].sort((a, b) => a.sortOrder - b.sortOrder);
  const dayOfYear = Math.floor((day.getTime() - Date.UTC(day.getUTCFullYear(), 0, 1)) / 86_400_000);
  const prompt = prompts[dayOfYear % prompts.length];
  const texts = await pack.journalTexts(locale);
  return texts?.prompts[prompt.id] ?? prompt.text;
}

/**
 * Example of a journal that replaces the built-in one (same id "journal"),
 * using only the plugin SDK: entries through ctx.data.journal, the prompt
 * through ctx.contentPack. One plain-text note per member and day (UTC).
 */
const simpleJournal: ApiPlugin = {
  register({ CurrentUser, data, contentPack }) {
    @Controller()
    class SimpleJournalController {
      @Get('today')
      async today(@CurrentUser('id') userId: string, @Query('locale') locale?: string) {
        const day = new Date();
        const entry = await data.journal.get(userId, isoDay(day));
        return { date: isoDay(day), text: textOf(entry), prompt: await promptOfTheDay(contentPack, day, locale === 'de' ? 'de' : 'en') };
      }

      @Put('today')
      async save(@CurrentUser('id') userId: string, @Body() body: { text?: unknown }) {
        if (typeof body?.text !== 'string' || body.text.length > MAX_TEXT) {
          throw new BadRequestException(`text must be a string of at most ${MAX_TEXT} characters`);
        }
        const entry = await data.journal.save(userId, isoDay(new Date()), { content: { text: body.text } });
        return { date: isoDay(entry.date), text: textOf(entry) };
      }

      @Get('history')
      async history(@CurrentUser('id') userId: string) {
        const today = new Date();
        const from = new Date(today.getTime() - HISTORY_DAYS * 86_400_000);
        const tomorrow = new Date(today.getTime() + 86_400_000);
        const entries = await data.journal.list(userId, { from: isoDay(from), to: isoDay(tomorrow) });
        return entries.map((e) => ({ date: isoDay(e.date), text: textOf(e) })).filter((e) => e.text);
      }
    }
    return { controllers: [SimpleJournalController] };
  },
};

export default simpleJournal;
