import { describe, it, expect } from 'vitest';
import { htmlToText } from './html-to-text';

describe('htmlToText', () => {
  it('keeps plain text as it is', () => {
    expect(htmlToText('Treffen für alle.\nBitte pünktlich & gut gelaunt.')).toBe('Treffen für alle.\nBitte pünktlich & gut gelaunt.');
  });

  it('turns editor HTML into readable lines, with link addresses', () => {
    const html = '<p>Hallo <strong>alle</strong>,</p><p>hier die <a href="https://x.de/a" class="md-link">Anmeldung</a> &amp; Infos:</p><ul><li><p>Punkt 1</p></li><li><p>Punkt 2</p></li></ul>';

    expect(htmlToText(html)).toBe('Hallo alle,\nhier die Anmeldung (https://x.de/a) & Infos:\n• Punkt 1\n\n• Punkt 2');
  });

  it('shows a bare link once', () => {
    expect(htmlToText('<p><a href="https://x.de">https://x.de</a></p>')).toBe('https://x.de');
  });

  it('handles empty input', () => {
    expect(htmlToText(null)).toBe('');
  });
});
