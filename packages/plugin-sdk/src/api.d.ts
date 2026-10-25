/**
 * API side of a plugin: api/index.ts default-exports an ApiPlugin.
 *
 * Its controllers are mounted under /api/p/<plugin id>. Every route requires a
 * signed-in member, like all Core routes; add `Roles('ADMIN')` for admin-only
 * routes. Plugins import NestJS decorators (@Controller, @Get …) from
 * @nestjs/common themselves.
 */

type AnyClass = new (...args: any[]) => any;

/** What CurrentUser() returns. */
export interface PluginMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}

/** One journal entry: one per member and day. */
export interface JournalEntryRecord {
  id: string;
  userId: string;
  /** The day, at 00:00 UTC. */
  date: Date;
  /** Whatever the journal plugin stores; plain JSON. */
  content: unknown;
  moods: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Members' journal entries, kept in the Core's tables so that account deletion
 * and data export cover them. Days are "YYYY-MM-DD"; an invalid day is
 * rejected with 400. Only the active journal plugin should write here.
 */
export interface PluginJournalEntries {
  /** Newest first; `to` is exclusive. */
  list(userId: string, range?: { from: string; to: string }): Promise<JournalEntryRecord[]>;
  get(userId: string, date: string): Promise<JournalEntryRecord | null>;
  /** Creates or replaces the member's entry for that day. */
  save(userId: string, date: string, entry: { content: unknown; moods?: string[] }): Promise<JournalEntryRecord>;
  /** False when there was no entry. */
  remove(userId: string, date: string): Promise<boolean>;
  /** The days with an entry, newest first. */
  dates(userId: string): Promise<Date[]>;
}

/** The journal method of the content pack (journal/definition.json). */
export interface JournalMethod {
  version: string;
  categories: Array<{ id: string; label: string; color: string }>;
  prompts: Array<{ id: string; categoryId: string; text: string; sortOrder: number }>;
  rotation: { promptsPerDay: number; cycle: 'day-of-year' };
  fields: Array<{ key: string; label: string; kind: 'text' | 'text-list' | 'task-list' }>;
}

/** Translated texts of the journal method, by field key, category id and prompt id. */
export interface JournalMethodTexts {
  fields: Record<string, string>;
  categories: Record<string, string>;
  prompts: Record<string, string>;
}

/**
 * The instance's content pack. Its files are checked once and then pinned for
 * the lifetime of the process, so edits on disk need a restart.
 */
export interface PluginContentPack {
  /** "pack" when the instance runs with a content pack, otherwise "legacy". */
  source(): 'legacy' | 'pack';
  /** The pack's journal method, or null without a pack. */
  journalMethod(): Promise<JournalMethod | null>;
  /** The method's texts in one language, or null without a pack. */
  journalTexts(locale: 'de' | 'en'): Promise<JournalMethodTexts | null>;
}

export interface PluginTaskAttemptCreate {
  taskId: string;
  taskVersion: number;
  idempotencyKey: string;
  response: number | string[];
  correct: boolean;
  /** Must be derived from trusted server-side hint state. */
  hintsUsed: number;
}
export interface PluginTaskAttemptRecord extends PluginTaskAttemptCreate {
  id: string;
  userId: string;
  createdAt: Date;
}
/** Generic durable storage. Never accept memberId from HTTP request bodies. */
export interface PluginTaskAttempts {
  record(userId: string, input: PluginTaskAttemptCreate): Promise<PluginTaskAttemptRecord>;
  list(userId: string, taskId?: string): Promise<PluginTaskAttemptRecord[]>;
  /** Increment server-owned hint usage for an authenticated member and pending attempt. */
  revealHint(userId: string, taskId: string, taskVersion: number, idempotencyKey: string, hintCount: number): Promise<number>;
  /** Read server-owned hint usage; clients must never supply this as an answer field. */
  hintUsage(userId: string, taskId: string, taskVersion: number, idempotencyKey: string): Promise<number>;
}

export interface PluginApiContext {
  /** The plugin's id, e.g. for log messages. */
  pluginId: string;
  /** Restricts a route or controller to the given roles, e.g. Roles('ADMIN'). */
  Roles: (...roles: string[]) => ClassDecorator & MethodDecorator;
  /** Parameter decorator for the signed-in member (PluginMember), or one field: CurrentUser('id'). */
  CurrentUser: (field?: keyof PluginMember) => ParameterDecorator;
  /** Data the Core keeps for plugins. Usable in request handlers, not during register(). */
  data: { journal: PluginJournalEntries; tasks: PluginTaskAttempts };
  contentPack: PluginContentPack;
}

export interface PluginApiModule {
  controllers?: AnyClass[];
  providers?: AnyClass[];
}

export interface ApiPlugin {
  /** Called once at start-up; returns what the Core registers for this plugin. */
  register(ctx: PluginApiContext): PluginApiModule;
}
