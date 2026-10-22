// Mirrors the limit on POST /users/me/avatar. The API rejects a larger file
// mid-upload, which the browser reports as a lost connection rather than as
// "too large" — so check before sending.
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Avatars are shown at most a few hundred pixels wide; 1024 leaves room for
// high-density screens while turning a 12-megapixel phone photo into a few
// hundred kilobytes.
export const AVATAR_MAX_DIMENSION = 1024;

export function avatarTooLargeMessage(size: number): string | null {
  if (size <= MAX_AVATAR_BYTES) return null;
  const mb = (size / (1024 * 1024)).toFixed(1);
  return `Please choose an image under 5 MB — this one is ${mb} MB.`;
}

/** Scales width × height down to fit within `max` on both sides, keeping the aspect ratio. */
export function fitWithin(
  width: number,
  height: number,
  max: number = AVATAR_MAX_DIMENSION,
): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  const scale = max / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Shrinks a photo before it is uploaded as an avatar, so a full-resolution
 * phone photo does not run into the 5 MB limit.
 *
 * GIFs are left alone (redrawing would drop the animation), as are images
 * that are already small. If the browser cannot decode or re-encode the
 * image, the original file is returned and the size check still applies.
 */
export async function shrinkAvatar(file: File): Promise<File> {
  if (file.type === 'image/gif') return file;

  let bitmap: ImageBitmap;
  try {
    // 'from-image' applies the EXIF rotation, so portrait phone photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const alreadySmall = width === bitmap.width && file.size <= 1024 * 1024;
    if (alreadySmall) return file;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    // PNG and WebP may be transparent; JPEG cannot carry that.
    const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + (type === 'image/jpeg' ? '.jpg' : '.png');
    return new File([blob], name, { type });
  } finally {
    bitmap.close();
  }
}
