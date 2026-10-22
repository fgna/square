import { describe, it, expect } from 'vitest';
import { decodeUploadFilename } from './decode-filename';

// What multer hands over: the UTF-8 bytes read as Latin-1.
const asMulter = (name: string) => Buffer.from(name, 'utf8').toString('latin1');

describe('decodeUploadFilename', () => {
  it('restores umlauts sent by macOS in decomposed form', () => {
    const macName = 'Checkliste dass Dein Team noch nicht eigenständig arbeitet.pdf';
    expect(decodeUploadFilename(asMulter(macName))).toBe('Checkliste dass Dein Team noch nicht eigenständig arbeitet.pdf');
  });

  it('restores composed umlauts and ß', () => {
    expect(decodeUploadFilename(asMulter('Führung & Maß.pdf'))).toBe('Führung & Maß.pdf');
  });

  it('leaves plain ASCII names alone', () => {
    expect(decodeUploadFilename('worksheet_v2.pdf')).toBe('worksheet_v2.pdf');
  });

  it('keeps a name that really was Latin-1', () => {
    expect(decodeUploadFilename('Grüße.pdf')).toBe('Grüße.pdf');
  });
});
