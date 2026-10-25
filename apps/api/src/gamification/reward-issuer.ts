import { createHash, timingSafeEqual } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';

// Explicit, server-only issuer configuration. Never ship tokens to a browser.
// JSON array: [{ "id":"example", "tokenSha256":"64 hex chars", "rewardCodes":["action"] }]
export function authorizeRewardIssuer(bearer: string | undefined, code: string, raw = process.env.SQUARE_REWARD_ISSUERS): string {
  if (!raw) throw new UnauthorizedException('Issuer access unavailable');
  let entries: unknown;
  try { entries = JSON.parse(raw); } catch { throw new Error('Invalid SQUARE_REWARD_ISSUERS JSON'); }
  if (!Array.isArray(entries)) throw new Error('SQUARE_REWARD_ISSUERS must be an array');
  const token = /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(bearer ?? '')?.[1];
  if (!token) throw new UnauthorizedException('Invalid issuer credentials');
  const digest = createHash('sha256').update(token).digest();
  let matched: string | undefined;
  for (const value of entries) {
    const entry = value as Record<string, unknown> | null;
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string'
      || !/^[a-z0-9_-]{1,48}$/.test(entry.id)
      || !/^[a-f0-9]{64}$/.test(entry.tokenSha256)
      || !Array.isArray(entry.rewardCodes)
      || entry.rewardCodes.length === 0
      || !entry.rewardCodes.every((s: unknown) => typeof s === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(s))) {
      throw new Error('Invalid SQUARE_REWARD_ISSUERS entry');
    }
    const permitted = entry.rewardCodes as string[];
    if (timingSafeEqual(digest, Buffer.from(entry.tokenSha256 as string, 'hex'))
      && permitted.includes(code)) matched = entry.id as string;
  }
  if (!matched) throw new UnauthorizedException('Invalid issuer credentials or scope');
  return matched;
}
