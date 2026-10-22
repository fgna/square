/**
 * Validates a client-supplied X-Request-Id before it's trusted as the
 * request's log-correlation id. Behind a trusted reverse proxy this is safe
 * to pass through, but the API itself is also reachable directly — an
 * unvalidated value could be arbitrarily long or contain characters that
 * break log parsing / enable log injection.
 */
export function normalizeRequestId(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return undefined;

  const trimmed = raw.trim();
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(trimmed)) return undefined;

  return trimmed;
}
