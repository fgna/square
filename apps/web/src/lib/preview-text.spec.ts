import { describe, it, expect } from 'vitest';
import { previewText } from './preview-text';

describe('previewText', () => {
  it('shows the words of a rich-text post, not its markup', () => {
    expect(previewText('<p>Hello <strong>world</strong></p><p>Second line</p>')).toBe('Hello world Second line');
  });

  it('leaves plain posts as they are', () => {
    expect(previewText('Just text #leadership')).toBe('Just text #leadership');
  });

  it('shows an editor event description as text, entities decoded once', () => {
    expect(previewText('<p>Live Journaling&nbsp;unter Anleitung</p>')).toBe('Live Journaling unter Anleitung');
    expect(previewText('<p>Fragen &amp; Antworten: a &lt; b, &amp;lt;</p>')).toBe('Fragen & Antworten: a < b, &lt;');
  });
});
