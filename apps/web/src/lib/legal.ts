// Where the privacy policy and the imprint live (e.g. on the main website).
// Baked into the build like every NEXT_PUBLIC_* value; without them the
// links are simply not shown.
export const PRIVACY_URL = process.env.NEXT_PUBLIC_PRIVACY_URL || undefined;
export const IMPRINT_URL = process.env.NEXT_PUBLIC_IMPRINT_URL || undefined;
