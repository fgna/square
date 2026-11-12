import { describe, expect, it } from 'vitest';
import { shouldShowOnboarding } from './onboarding-mode';

describe('community onboarding modes', () => {
  it.each([
    ['REQUIRED', false, false, true],
    ['REQUIRED', false, true, true],
    ['REQUIRED', true, false, false],
    ['OPTIONAL', false, false, true],
    ['OPTIONAL', false, true, false],
    ['OPTIONAL', true, false, false],
    ['DISABLED', false, false, false],
    ['DISABLED', false, true, false],
    ['DISABLED', true, false, false],
  ] as const)('%s, completed=%s, dismissed=%s -> visible=%s', (mode, completed, dismissed, visible) => {
    expect(shouldShowOnboarding(mode, completed, dismissed)).toBe(visible);
  });
});
