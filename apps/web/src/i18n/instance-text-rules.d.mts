type Messages = Record<string, unknown>;

export const MAX_LENGTH: number;
export const PROTECTED_KEYS: readonly string[];
export function flattenMessages(tree: Messages, prefix?: string): Record<string, unknown>;
export function icuArguments(text: string): Set<string>;
export function textProblems(value: unknown, reference: string): string[];
export function overrideProblems(overrides: { de?: unknown; en?: unknown }, base: { de: Messages; en: Messages }): string[];
export function applyOverrides<T extends Messages>(catalog: T, overrides: Messages): T;
