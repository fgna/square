export interface AndroidAppDownloadSettings {
  androidAppDownloadEnabled?: boolean;
  androidAppDownloadUrl?: string | null;
}

export function isAndroidAppDownloadUrl(value: unknown): value is string;
export function normalizeAndroidAppDownloadSettings(
  current: AndroidAppDownloadSettings | null,
  patch: AndroidAppDownloadSettings,
): Required<AndroidAppDownloadSettings>;
export function androidAppDownloadUrl(settings?: AndroidAppDownloadSettings | null): string | null;
