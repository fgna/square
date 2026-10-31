import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { authorizeRewardIssuer } from './reward-issuer';

describe('application-scoped reward issuer', () => {
  const secret = 'server_side_secret_for_testing_123456789012345';
  const hash = createHash('sha256').update(secret).digest('hex');
  const config = JSON.stringify([{ id: 'learning', tokenSha256: hash, rewardCodes: ['completed'] }]);

  it('accepts the correct credential and permitted reward', () => {
    expect(authorizeRewardIssuer('Bearer ' + secret, 'completed', config)).toBe('learning');
  });
  it('rejects incorrect token, missing credentials and unlisted reward scope', () => {
    expect(() => authorizeRewardIssuer('Bearer ' + secret, 'admin-bonus', config)).toThrow();
    expect(() => authorizeRewardIssuer('Bearer ' + 'x'.repeat(40), 'completed', config)).toThrow();
    expect(() => authorizeRewardIssuer(undefined, 'completed', config)).toThrow();
    expect(() => authorizeRewardIssuer('Bearer ' + secret, 'completed', undefined)).toThrow();
  });
  it('fails closed for invalid issuer configuration', () => {
    expect(() => authorizeRewardIssuer('Bearer ' + secret, 'completed', '{')).toThrow();
    expect(() => authorizeRewardIssuer('Bearer ' + secret, 'completed', JSON.stringify([{ id: 'X', tokenSha256: hash, rewardCodes: ['completed'] }]))).toThrow();
  });
  it('rejects duplicate issuer IDs or shared secrets instead of accepting ambiguous scopes', () => {
    const duplicateId = JSON.stringify([
      { id: 'learning', tokenSha256: hash, rewardCodes: ['completed'] },
      { id: 'learning', tokenSha256: 'a'.repeat(64), rewardCodes: ['bonus'] },
    ]);
    const sharedToken = JSON.stringify([
      { id: 'learning', tokenSha256: hash, rewardCodes: ['completed'] },
      { id: 'other', tokenSha256: hash, rewardCodes: ['bonus'] },
    ]);
    expect(() => authorizeRewardIssuer('Bearer ' + secret, 'completed', duplicateId)).toThrow();
    expect(() => authorizeRewardIssuer('Bearer ' + secret, 'completed', sharedToken)).toThrow();
  });
  it('supports separate issuer identities with the same client event key', () => {
    const other = 'another_server_secret_1234567890123456789012';
    const config2 = JSON.stringify([
      { id: 'first', tokenSha256: hash, rewardCodes: ['completed'] },
      { id: 'second', tokenSha256: createHash('sha256').update(other).digest('hex'), rewardCodes: ['completed'] },
    ]);
    expect(authorizeRewardIssuer('Bearer ' + secret, 'completed', config2)).toBe('first');
    expect(authorizeRewardIssuer('Bearer ' + other, 'completed', config2)).toBe('second');
  });
});
