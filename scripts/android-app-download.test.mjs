import test from 'node:test';
import assert from 'node:assert/strict';
import { isAndroidAppDownloadUrl, normalizeAndroidAppDownloadSettings, androidAppDownloadUrl } from '../packages/shared/src/utils/android-app-download.cjs';
import { editableSettings } from '../apps/web/src/lib/platform-settings.ts';

const url = 'https://downloads.example.com/releases/community-v1.apk';

test('admin save includes the download pair but excludes server-owned record fields', () => {
  assert.deepEqual(editableSettings({ id: 'default', updatedAt: 'ignored',
    androidAppDownloadEnabled: true, androidAppDownloadUrl: url }), {
    androidAppDownloadEnabled: true, androidAppDownloadUrl: url,
  });
});

test('accepts HTTPS release URLs without requiring an APK suffix or cross-origin HEAD', () => {
  for (const value of [url, 'https://example.com/download?id=2', 'https://example.com:8443/app']) {
    assert.equal(isAndroidAppDownloadUrl(value), true);
  }
});

test('rejects unsafe, malformed, overlong and credential-bearing links', () => {
  for (const value of [undefined, null, '', '/app.apk', 'http://example.com/app.apk', 'javascript:alert(1)',
    'https://', 'https://user:password@example.com/app.apk', 'https://token@example.com/app',
    'https://@example.com/app', 'https://example.com\\app',
    'https://example.com:99999/app', 'https://example.com/app#fragment', 'https://example.com/a b',
    'https://example.com/' + 'x'.repeat(2048)]) {
    assert.equal(isAndroidAppDownloadUrl(value), false, String(value));
  }
});

test('defaults to disabled and does not expose the draft URL', () => {
  assert.equal(androidAppDownloadUrl(undefined), null);
  assert.equal(androidAppDownloadUrl({ androidAppDownloadUrl: url }), null);
  assert.equal(androidAppDownloadUrl({ androidAppDownloadEnabled: false, androidAppDownloadUrl: url }), null);
  assert.equal(androidAppDownloadUrl({ androidAppDownloadEnabled: true, androidAppDownloadUrl: 'javascript:x' }), null);
});

test('configure, enable, reload, replace and disable preserve valid settings', () => {
  let settings = normalizeAndroidAppDownloadSettings(null, { androidAppDownloadUrl: ` ${url} ` });
  assert.deepEqual(settings, { androidAppDownloadEnabled: false, androidAppDownloadUrl: url });
  settings = normalizeAndroidAppDownloadSettings(settings, { androidAppDownloadEnabled: true });
  settings = JSON.parse(JSON.stringify(settings));
  assert.equal(androidAppDownloadUrl(settings), url);
  settings = normalizeAndroidAppDownloadSettings(settings, { androidAppDownloadUrl: 'https://example.com/v2.apk' });
  assert.equal(androidAppDownloadUrl(settings), 'https://example.com/v2.apk');
  settings = normalizeAndroidAppDownloadSettings(settings, { androidAppDownloadEnabled: false });
  assert.equal(androidAppDownloadUrl(settings), null);
  assert.equal(settings.androidAppDownloadUrl, 'https://example.com/v2.apk');
});

test('rejects enabling without a URL and clearing an enabled URL', () => {
  assert.throws(() => normalizeAndroidAppDownloadSettings(null, { androidAppDownloadEnabled: true }));
  const enabled = { androidAppDownloadEnabled: true, androidAppDownloadUrl: url };
  assert.throws(() => normalizeAndroidAppDownloadSettings(enabled, { androidAppDownloadUrl: '' }));
  assert.deepEqual(normalizeAndroidAppDownloadSettings(enabled, {
    androidAppDownloadEnabled: false, androidAppDownloadUrl: null,
  }), { androidAppDownloadEnabled: false, androidAppDownloadUrl: null });
});

test('rejects wrong runtime types even when validation is bypassed', () => {
  assert.throws(() => normalizeAndroidAppDownloadSettings(null, { androidAppDownloadEnabled: null }));
  assert.throws(() => normalizeAndroidAppDownloadSettings(null, { androidAppDownloadUrl: 123 }));
});
