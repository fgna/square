import { open } from 'fs/promises';

/** Box types a QuickTime/MP4 file may start with. */
const FIRST_BOXES = new Set(['ftyp', 'wide', 'free', 'skip', 'moov', 'mdat', 'pnot']);

/** True when the first bytes look like an MP4/QuickTime file (box size + known box type). */
export function looksLikeMp4OrMov(head: Buffer): boolean {
  return head.length >= 8 && FIRST_BOXES.has(head.subarray(4, 8).toString('latin1'));
}

export type VideoCodec = 'h264' | 'hevc' | 'other' | 'unknown';

const MAX_MOOV_BYTES = 64 * 1024 * 1024;

/**
 * The video codec of an MP4/MOV file, read from the sample descriptions in its
 * "moov" box (not by scanning the media data, where any 4 bytes can occur).
 * Walks the top-level boxes to find "moov", wherever it is in the file.
 */
export async function videoCodec(path: string): Promise<VideoCodec> {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const header = Buffer.alloc(16);
    let offset = 0;
    while (offset + 8 <= size) {
      await handle.read(header, 0, 16, offset);
      let boxSize = header.readUInt32BE(0);
      const type = header.subarray(4, 8).toString('latin1');
      let headerSize = 8;
      if (boxSize === 1) {
        boxSize = Number(header.readBigUInt64BE(8));
        headerSize = 16;
      } else if (boxSize === 0) {
        boxSize = size - offset;
      }
      if (boxSize < headerSize) return 'unknown';
      if (type === 'moov') {
        const length = Math.min(boxSize - headerSize, MAX_MOOV_BYTES);
        const moov = Buffer.alloc(length);
        await handle.read(moov, 0, length, offset + headerSize);
        if (moov.includes('avc1') || moov.includes('avc3')) return 'h264';
        if (moov.includes('hvc1') || moov.includes('hev1')) return 'hevc';
        return 'other';
      }
      offset += boxSize;
    }
    return 'unknown';
  } finally {
    await handle.close();
  }
}
