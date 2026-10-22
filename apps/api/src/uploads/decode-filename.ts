/**
 * Multer (busboy) reads multipart filenames as Latin-1, so a UTF-8 name like
 * "Führung.pdf" arrives as "FÃ¼hrung.pdf". macOS also sends umlauts
 * decomposed ("u" + combining diaeresis), which showed as "laÌhmen".
 * Re-decode as UTF-8 and compose; if the bytes are not valid UTF-8, the name
 * really was Latin-1 and is kept.
 */
export function decodeUploadFilename(name: string): string {
  const utf8 = Buffer.from(name, 'latin1').toString('utf8');
  const decoded = utf8.includes('�') ? name : utf8;
  return decoded.normalize('NFC');
}
