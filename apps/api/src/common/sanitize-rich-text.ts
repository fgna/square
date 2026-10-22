import sanitizeHtml from 'sanitize-html';

/**
 * Cleans HTML from the rich-text editor before it is stored. Shared by posts
 * and course lessons, so both accept exactly the same markup.
 */
export function sanitizeRichText(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h2', 'h3', 'img', 'figure', 'figcaption', 'span', 'del', 'ins', 'sup', 'sub']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title', 'width', 'height'],
      a: ['href', 'target', 'rel', 'class'],
      span: ['class'],
      '*': ['style'],
    },
    allowedStyles: {
      '*': {
        color: [/^#(0x)?[0-9a-fA-F]+$/i, /^rgb\(/],
        'background-color': [/^#(0x)?[0-9a-fA-F]+$/i, /^rgb\(/],
        'text-align': [/^left$/, /^right$/, /^center$/],
        'font-size': [/^\d+(?:px|em|%)$/],
      },
    },
    disallowedTagsMode: 'discard',
  }).replace(/\x00/g, '');
}
