/** Keep this list aligned with apps/api/src/config/capabilities.ts. */
export const CAPABILITIES = ['feed', 'messages', 'events', 'courses', 'journal', 'assessments'] as const;
export type Capability = (typeof CAPABILITIES)[number];
export function parseCapabilities(value: string | undefined): ReadonlySet<Capability> {
  if (value === undefined) return new Set(CAPABILITIES);
  const names = value.split(',').map((x) => x.trim()).filter(Boolean);
  const unknown = names.filter((name) => !CAPABILITIES.includes(name as Capability));
  if (unknown.length) throw new Error('Unknown NEXT_PUBLIC_SQUARE_CAPABILITIES: ' + unknown.join(', '));
  return new Set(names as Capability[]);
}
export const enabledCapabilities = parseCapabilities(process.env.NEXT_PUBLIC_SQUARE_CAPABILITIES);
export function capabilityForPath(path: string): Capability | undefined {
  const mappings: [Capability, RegExp][] = [
    ['feed', /^\/(?:feed|questions|bookmarks)(?:\/|$)/],
    ['messages', /^\/messages(?:\/|$)/],
    ['events', /^\/(?:events|recordings|event-proposals)(?:\/|$)/],
    ['courses', /^\/courses(?:\/|$)/],
    ['journal', /^\/(?:journal|p\/journal)(?:\/|$)/],
    ['assessments', /^\/assessment(?:\/|$)/],
    ['feed', /^\/admin\/(?:moderation|reports)(?:\/|$)/],
    ['events', /^\/admin\/(?:events|event-proposals)(?:\/|$)/],
    ['courses', /^\/admin\/courses(?:\/|$)/],
    ['journal', /^\/admin\/journal-prompts(?:\/|$)/],
    ['assessments', /^\/admin\/assessment(?:\/|$)/],
  ];
  return mappings.find(([, pattern]) => pattern.test(path))?.[0];
}
export function isPathEnabled(path: string, enabled: ReadonlySet<Capability> = enabledCapabilities): boolean {
  const capability = capabilityForPath(path);
  return !capability || enabled.has(capability);
}
