import DOMPurify from 'dompurify';
import type { Config as PurifyConfig } from 'dompurify';
import { renderMarkdown } from './markdown';

const HTML_TAG_PATTERN = /^<[a-z][\s\S]*>/i;

const PURIFY_CONFIG: PurifyConfig = {
  ALLOWED_TAGS: [
    'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
    'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'sub', 'sup',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'figure', 'figcaption', 'span', 'div',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height', 'class', 'style'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
};

// Hashtags are made clickable by wrapping them in <span class="md-hashtag">,
// which is the hook post-card.tsx's click handler tests for. Plain-text posts
// get theirs from renderMarkdown. Rich-text posts are stored as HTML and never
// went through it, so their hashtags rendered as inert text (#118).
//
// The wrapping happens on the fragment DOMPurify produces, never on the HTML
// string: a regex over markup would also match inside href="#anchor", inside
// code blocks and inside tag names. Working on the sanitised DOM means only
// text nodes are touched, and the spans are built with createElement rather
// than assembled as markup, so nothing here can introduce anything the
// sanitiser did not already pass.
const HASHTAG_PATTERN = /#\w+/g;

// A '#' inside a link is already clickable, and inside code it is comment
// syntax rather than a mention. An existing md-hashtag is left alone so that
// content already carrying one is not nested twice.
const SKIP_INSIDE = new Set(['A', 'CODE', 'PRE']);

function isExempt(node: Node, root: Node): boolean {
  let el = node.parentElement;
  while (el && el !== root) {
    if (SKIP_INSIDE.has(el.tagName) || el.classList.contains('md-hashtag')) return true;
    el = el.parentElement;
  }
  return false;
}

function wrapHashtags(root: DocumentFragment): void {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  // Collected first: replacing a text node while walking would disturb the walk.
  const textNodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) textNodes.push(n as Text);

  for (const textNode of textNodes) {
    const text = textNode.data;
    if (!text.includes('#') || isExempt(textNode, root)) continue;

    const pattern = new RegExp(HASHTAG_PATTERN.source, 'g');
    const replacement = doc.createDocumentFragment();
    let cursor = 0;

    for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
      if (match.index > cursor) {
        replacement.appendChild(doc.createTextNode(text.slice(cursor, match.index)));
      }
      const span = doc.createElement('span');
      span.className = 'md-hashtag';
      span.textContent = match[0];
      replacement.appendChild(span);
      cursor = match.index + match[0].length;
    }

    if (cursor === 0) continue;
    if (cursor < text.length) replacement.appendChild(doc.createTextNode(text.slice(cursor)));
    textNode.replaceWith(replacement);
  }
}

export function renderPostContent(content: string): { html: string; className: string } {
  const isHtml = HTML_TAG_PATTERN.test(content.trim());

  if (isHtml) {
    const fragment = DOMPurify.sanitize(content, {
      ...PURIFY_CONFIG,
      RETURN_DOM_FRAGMENT: true,
    }) as unknown as DocumentFragment;

    wrapHashtags(fragment);

    const container = fragment.ownerDocument.createElement('div');
    container.appendChild(fragment);
    return { html: container.innerHTML, className: 'tiptap-content' };
  }

  return { html: DOMPurify.sanitize(renderMarkdown(content), PURIFY_CONFIG) as string, className: 'md-content' };
}
