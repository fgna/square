export interface PlatformSettings {
  id: string;
  platformName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  allowSignups: boolean;
  onboardingMode: 'REQUIRED' | 'OPTIONAL' | 'DISABLED';
  welcomeVideoUrl: string | null;
}

// The API rejects any property it does not know. The page used to send the
// whole loaded record — id and updatedAt included — so every save failed
// with 400 "property id should not exist".
const EDITABLE = ['platformName', 'logoUrl', 'primaryColor', 'accentColor', 'allowSignups', 'onboardingMode', 'welcomeVideoUrl'] as const;

export function editableSettings(form: Partial<PlatformSettings>): Partial<PlatformSettings> {
  return Object.fromEntries(EDITABLE.filter((k) => k in form).map((k) => [k, form[k]])) as Partial<PlatformSettings>;
}
