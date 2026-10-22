/**
 * Plain text from the editor's HTML, for e-mails and calendar entries.
 * Paragraphs and list items become lines, links keep their address as
 * "text (https://…)", tags are dropped and entities decoded. Plain text
 * (event descriptions written before the editor) passes through unchanged.
 */
export function htmlToText(input: string | null | undefined): string {
  if (!input) return '';
  if (!/<[a-z][\s\S]*>/i.test(input)) return input;
  return input
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, text: string) => {
      const label = text.replace(/<[^>]+>/g, '').trim();
      return label && label !== href ? `${label} (${href})` : href;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
