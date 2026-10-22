/**
 * Plain words for a one-line preview. Rich-text posts are stored as HTML,
 * which the moderation list used to show tags and all.
 */
export function previewText(content: string): string {
  return content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
