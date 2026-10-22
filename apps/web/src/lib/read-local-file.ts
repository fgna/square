/**
 * Reads a picked file fully into memory before it is uploaded.
 *
 * A file kept in OneDrive or iCloud may exist on the Mac only as a
 * placeholder. The browser then fails while streaming it mid-upload, aborts
 * the connection, and the user sees "Could not reach the server" — which
 * points at the wrong cause. Reading it first either brings the whole file
 * in, or fails here where the message can say what to do.
 */
export class UnreadableFileError extends Error {
  constructor(public readonly fileName: string) {
    super(`Could not read "${fileName}"`);
    this.name = 'UnreadableFileError';
  }
}

export const UNREADABLE_FILE_HINT =
  'If it is stored in OneDrive or iCloud, make it available offline first (right-click → "Always keep on this device"), then try again.';

function readBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  // Older engines (and jsdom) only offer FileReader.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export async function readLocalFile(file: File): Promise<File> {
  try {
    const bytes = await readBytes(file);
    if (file.size > 0 && bytes.byteLength === 0) throw new Error('empty read');
    return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    throw new UnreadableFileError(file.name);
  }
}
