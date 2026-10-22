import type { ApiPlugin } from '@community/plugin-sdk/api';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';

/**
 * Built-in journal plugin: entries, daily prompts and their admin, under
 * /api/p/journal. Entries and prompts stay in the Core's tables; the method
 * (fields, prompts, rotation) comes from the content pack when one is active.
 */
const journal: ApiPlugin = {
  register: () => ({ controllers: [JournalController], providers: [JournalService] }),
};

export default journal;
