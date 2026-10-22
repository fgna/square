export function extractHashtags(text: string): string[] {
  const matches = text.match(/#(\w+)/g) ?? [];
  return Array.from(new Set(matches.map(m => m.toLowerCase())));
}

export function renderMarkdown(text: string): string {
  return text
    // Escape HTML first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (triple backtick)
    .replace(/```([\s\S]*?)```/g, '<pre class="md-code-block"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>')
    // Bold
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    // Blockquote
    .replace(/^&gt; (.+)$/gm, '<blockquote class="md-quote">$1</blockquote>')
    // Links
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>')
    // Hashtags — rendered as styled spans
    .replace(/#(\w+)/g, '<span class="md-hashtag">#$1</span>')
    // Line breaks
    .replace(/\n/g, '<br />');
}
