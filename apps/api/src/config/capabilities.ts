/**
 * Instance-wide capability switch. Omitting SQUARE_CAPABILITIES preserves the
 * complete legacy product. Explicit lists are allowlists, including an empty list.
 */
export const CAPABILITIES = ['feed', 'messages', 'events', 'courses', 'journal', 'assessments', 'learning-groups'] as const;
export type Capability = (typeof CAPABILITIES)[number];

const DEPENDENCIES: Partial<Record<Capability, Capability[]>> = {};
const ROUTES: Record<Capability, RegExp[]> = {
  feed: [/^\/api\/posts(?:\/|$)/, /^\/api\/admin\/(?:posts|reports)(?:\/|$)/],
  messages: [/^\/api\/messages(?:\/|$)/],
  events: [/^\/api\/(?:events|event-proposals|calendar)(?:\/|$)/, /^\/api\/admin\/(?:events|event-proposals)(?:\/|$)/],
  courses: [/^\/api\/courses(?:\/|$)/, /^\/api\/admin\/courses(?:\/|$)/],
  journal: [/^\/api\/p\/journal(?:\/|$)/, /^\/api\/admin\/journal(?:\/|$)/],
  assessments: [/^\/api\/assessments(?:\/|$)/, /^\/api\/admin\/assessment(?:\/|$)/],
};

export function parseCapabilities(value: string | undefined): ReadonlySet<Capability> {
  if (value === undefined) return new Set(CAPABILITIES);
  const names = value.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = names.filter((name) => !CAPABILITIES.includes(name as Capability));
  if (unknown.length) throw new Error('Unknown SQUARE_CAPABILITIES: ' + unknown.join(', ') + '. Allowed: ' + CAPABILITIES.join(', '));
  const enabled = new Set(names as Capability[]);
  for (const name of enabled) {
    for (const required of DEPENDENCIES[name] ?? []) {
      if (!enabled.has(required)) throw new Error('Capability ' + name + ' requires ' + required);
    }
  }
  return enabled;
}

export function disabledApiCapability(path: string, enabled: ReadonlySet<Capability>): Capability | undefined {
  const pathname = path.split('?')[0];
  return CAPABILITIES.find((name) => !enabled.has(name) && ROUTES[name].some((pattern) => pattern.test(pathname)));
}
export const instanceCapabilities = parseCapabilities(process.env.SQUARE_CAPABILITIES);
