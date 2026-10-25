import { describe, expect, it } from 'vitest';
import { editableSettings } from './platform-settings';

describe('onboarding mode settings payload', () => {
  it.each(['REQUIRED', 'OPTIONAL', 'DISABLED'] as const)('preserves %s', (mode) => {
    expect(editableSettings({ id: 'default', onboardingMode: mode })).toEqual({ onboardingMode: mode });
  });
});
