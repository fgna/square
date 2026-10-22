/**
 * Uploads are stored as paths ("/uploads/avatars/…"), never with a host:
 * a stored host breaks every picture the day the platform moves to another
 * domain. The web app reaches them through its own /uploads rewrite. Places
 * outside the browser — a calendar client, an e-mail — need a full address,
 * and get it here, from the API's configured public address.
 */
export function absoluteUploadUrl(url: string): string {
  if (!url.startsWith('/')) return url;
  return `${process.env.API_URL || 'http://localhost:3001'}${url}`;
}
