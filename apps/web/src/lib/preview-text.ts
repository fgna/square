const ENTITIES: Record<string, string> = { nbsp: ' ', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", amp: '&' };

/**
 * Plain words for a one-line preview. Rich-text posts and event descriptions
 * are stored as HTML, which previews used to show tags and all. Rendered as
 * React text, so decoding entities cannot inject markup.
 */
export function previewText(content: string): string {
  return content
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|lt|gt|quot|#39|apos|amp);/g, (_, name: string) => ENTITIES[name])
    .replace(/\s+/g, ' ')
    .trim();
}
