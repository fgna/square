import { describe, it, expect } from 'vitest';
import { onboardingAllowedOn } from './onboarding-wizard';

describe('onboardingAllowedOn', () => {
  it('keeps the modal wizard off plugin pages, which own their screen', () => {
    for (const path of ['/p/turbo-mathe', '/p/turbo-mathe/garage', '/p/x/']) expect(onboardingAllowedOn(path)).toBe(false);
  });

  it('shows it on the community pages', () => {
    for (const path of ['/dashboard', '/feed', '/', '/profile', '/plugins', '/pages/about', null]) expect(onboardingAllowedOn(path)).toBe(true);
  });
});
