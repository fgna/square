/** Neutral journal configuration schema. */
export interface JournalMethodDefinition {
  version: string;
  categories: Array<{ id: string; label: string; color: string }>;
  prompts: Array<{ id: string; categoryId: string; text: string; sortOrder: number }>;
  rotation: { promptsPerDay: number; cycle: 'day-of-year' };
  fields: Array<{ key: string; label: string; kind: 'text' | 'text-list' | 'task-list' }>;
}
function obj(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function onlyKeys(input: Record<string, unknown>, allowed: string[], label: string) {
  if (Object.keys(input).some(k => !allowed.includes(k))) throw new Error(label + ': unknown property');
}
function label(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 5000) throw new Error(field + ': invalid');
  return value;
}
function id(value: unknown, field: string): string {
  const text = label(value, field);
  if (!/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(text)) throw new Error(field + ': invalid key');
  return text;
}
/** Validate a journal configuration without accessing stored user entries. */
export function validateJournalMethodDefinition(input: unknown): JournalMethodDefinition {
  if (!obj(input)) throw new Error('journal: object required');
  onlyKeys(input, ['version', 'categories', 'prompts', 'rotation', 'fields'], 'journal');
  const version = label(input.version, 'version');
  if (!Array.isArray(input.categories) || input.categories.length < 1 || input.categories.length > 100) throw new Error('categories: invalid');
  const categories = input.categories.map((v: unknown) => {
    if (!obj(v)) throw new Error('category: invalid');
    onlyKeys(v, ['id','label','color'], 'category');
    const color = label(v.color, 'color');
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('category: invalid color');
    return { id: id(v.id, 'category.id'), label: label(v.label,'category.label'), color };
  });
  const categoryIds = categories.map(v => v.id);
  if (new Set(categoryIds).size !== categoryIds.length) throw new Error('category IDs must be unique');
  if (!Array.isArray(input.prompts) || input.prompts.length < 1 || input.prompts.length > 2000) throw new Error('prompts: invalid');
  const prompts = input.prompts.map((v: unknown) => {
    if (!obj(v)) throw new Error('prompt: invalid');
    onlyKeys(v, ['id','categoryId','text','sortOrder'], 'prompt');
    const categoryId = id(v.categoryId, 'prompt.categoryId');
    if (!categoryIds.includes(categoryId)) throw new Error('prompt: unknown category');
    if (!Number.isInteger(v.sortOrder) || (v.sortOrder as number) < 0 || (v.sortOrder as number) > 1000000) throw new Error('prompt: sort order invalid');
    return { id: id(v.id,'prompt.id'), categoryId, text: label(v.text,'prompt.text'), sortOrder: v.sortOrder as number };
  });
  if (new Set(prompts.map(v => v.id)).size !== prompts.length || new Set(prompts.map(v => v.sortOrder)).size !== prompts.length) throw new Error('prompt IDs and sort order must be unique');
  if (!obj(input.rotation)) throw new Error('rotation: invalid');
  onlyKeys(input.rotation, ['promptsPerDay','cycle'],'rotation');
  const promptsPerDay = input.rotation.promptsPerDay;
  if (!Number.isInteger(promptsPerDay) || (promptsPerDay as number) < 1 || (promptsPerDay as number) > prompts.length || input.rotation.cycle !== 'day-of-year') throw new Error('rotation: unsupported');
  if (!Array.isArray(input.fields) || input.fields.length < 1 || input.fields.length > 30) throw new Error('fields: invalid');
  const fields = input.fields.map((v: unknown) => {
    if (!obj(v)) throw new Error('field: invalid');
    onlyKeys(v, ['key','label','kind'], 'field');
    if (v.kind !== 'text' && v.kind !== 'text-list' && v.kind !== 'task-list') throw new Error('field: invalid kind');
    return { key: id(v.key,'field.key'), label: label(v.label,'field.label'), kind: v.kind as 'text'|'text-list'|'task-list' };
  });
  if (new Set(fields.map(v => v.key)).size !== fields.length) throw new Error('field keys must be unique');
  return { version, categories, prompts, rotation: { promptsPerDay: promptsPerDay as number, cycle: 'day-of-year' }, fields };
}
