import { describe, expect, it } from 'vitest';
import de from '../../messages/de.json';
import en from '../../messages/en.json';

const landingKeys = [
  'signin', 'start', 'heroPrefix', 'heroSuffix', 'heroDescription',
  'join', 'signInTitle', 'featuresHeading', 'memberTitle',
  'memberDescription', 'learningTitle', 'learningDescription',
  'eventsTitle', 'eventsDescription', 'messagingTitle',
  'messagingDescription', 'gdprTitle', 'gdprDescription',
  'hostedTitle', 'hostedDescription', 'ready', 'readyDescription',
  'createAccount', 'register',
] as const;

describe('public landing page catalog contract', () => {
  it.each([['de', de], ['en', en]])('%s includes complete generic landing and privacy copy', (_locale, messages) => {
    for (const key of landingKeys) {
      expect(messages.landingUI[key], `landingUI.${key}`).toBeTruthy();
    }
    expect(messages.privacyNotice.title).toBeTruthy();
    expect(messages.privacyNotice.text).toBeTruthy();
  });
});
