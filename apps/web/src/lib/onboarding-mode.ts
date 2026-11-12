import type { PlatformSettings } from './platform-settings';

type OnboardingMode = PlatformSettings['onboardingMode'];

/** Completed onboarding is permanent; optional dismissal never marks it complete. */
export function shouldShowOnboarding(mode: OnboardingMode, completed: boolean, dismissed: boolean): boolean {
  if (completed || mode === 'DISABLED') return false;
  return mode === 'REQUIRED' || !dismissed;
}
