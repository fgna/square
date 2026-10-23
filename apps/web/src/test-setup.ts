import '@testing-library/jest-dom/vitest';

// Components translate their text with next-intl. Tests may render them
// without a provider, so useTranslations resolves against the English
// messages directly through next-intl's own translator (ICU plurals included).
// Tests that wrap in NextIntlClientProvider keep working: it passes through.
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Keep DOM nodes and listeners from bleeding into subsequent tests.
afterEach(() => cleanup());
import enCore from '../messages/en.json';
import { withPluginMessages } from './plugins/messages';

const en = withPluginMessages(enCore, 'en');

vi.mock('next-intl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({ locale: 'en', messages: en, namespace: namespace as never }),
    useLocale: () => 'en',
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// jsdom does not implement Range layout geometry used by ProseMirror focus scrolling.
// Provide inert geometry solely in tests; browsers continue using native layout.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} } as unknown as DOMRectList);
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
}
