/** Runtime-safe shared contract for the CommonJS API and the web bundle. */
function isAndroidAppDownloadUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || !/^https:\/\//i.test(value) || /[\\\s]/.test(value)) return false;
  if (/^https:\/\/[^/?#]*@/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

function normalizeAndroidAppDownloadSettings(current, patch) {
  const enabled = patch.androidAppDownloadEnabled === undefined
    ? current?.androidAppDownloadEnabled ?? false : patch.androidAppDownloadEnabled;
  if (typeof enabled !== 'boolean') throw new Error('Android app download enabled must be a boolean');
  const value = patch.androidAppDownloadUrl === undefined
    ? current?.androidAppDownloadUrl ?? null : patch.androidAppDownloadUrl;
  if (value !== null && typeof value !== 'string') throw new Error('Android app download URL must be a string');
  const url = value?.trim() || null;
  if (url !== null && !isAndroidAppDownloadUrl(url)) {
    throw new Error('Android app download URL must be a valid HTTPS URL without credentials or fragment');
  }
  if (enabled && !url) throw new Error('Set an Android app download URL before enabling the download');
  return { androidAppDownloadEnabled: enabled, androidAppDownloadUrl: url };
}

function androidAppDownloadUrl(settings) {
  return settings?.androidAppDownloadEnabled === true && isAndroidAppDownloadUrl(settings.androidAppDownloadUrl)
    ? settings.androidAppDownloadUrl : null;
}

exports.isAndroidAppDownloadUrl = isAndroidAppDownloadUrl;
exports.normalizeAndroidAppDownloadSettings = normalizeAndroidAppDownloadSettings;
exports.androidAppDownloadUrl = androidAppDownloadUrl;
