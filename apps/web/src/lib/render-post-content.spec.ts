import { describe, it, expect } from 'vitest';
import { renderPostContent } from './render-post-content';

// A hashtag is only clickable if it is rendered as <span class="md-hashtag">,
// because that class is what PostCard's click handler tests for. These tests
// pin down which posts get one and which do not.

describe('renderPostContent', () => {
  it('makes hashtags clickable in a plain-text post', () => {
    const { html, className } = renderPostContent('Morning run done #fitness');

    expect(className).toBe('md-content');
    expect(html).toContain('<span class="md-hashtag">#fitness</span>');
  });

  it('keeps the hashtag span through sanitisation', () => {
    // DOMPurify has to allow both `span` and `class`, or the markup survives
    // rendering but arrives without the hook the click handler looks for.
    const { html } = renderPostContent('#a #b');

    expect(html.match(/md-hashtag/g)).toHaveLength(2);
  });

  it('strips scripts while leaving the hashtag intact', () => {
    const { html } = renderPostContent('#safe <script>alert(1)</script>');

    expect(html).toContain('md-hashtag');
    expect(html).not.toContain('<script');
  });

  it('makes hashtags clickable in a rich-text (HTML) post', () => {
    // This was the gap #118 closed: CreatePost defaults to the rich text
    // editor, which stores HTML, and HTML used to skip renderMarkdown
    // entirely — so most posts had no clickable hashtag at all.
    const { html, className } = renderPostContent('<p>Morning run done #fitness</p>');

    expect(className).toBe('tiptap-content');
    expect(html).toContain('<span class="md-hashtag">#fitness</span>');
    expect(html).toContain('<p>');
  });

  describe('hashtags in rich-text content', () => {
    it('leaves the surrounding markup intact', () => {
      const { html } = renderPostContent('<p>Before <strong>bold</strong> #tag after</p>');

      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<span class="md-hashtag">#tag</span>');
      expect(html).toContain('Before ');
      expect(html).toContain(' after');
    });

    it('handles several hashtags in one text node', () => {
      const { html } = renderPostContent('<p>#one then #two</p>');

      expect(html.match(/md-hashtag/g)).toHaveLength(2);
      expect(html).toContain('then');
    });

    // The reason this works on the DOM rather than the HTML string: a regex
    // over markup would rewrite the href as well.
    it('does not touch a # inside an attribute', () => {
      const { html } = renderPostContent('<p><a href="#section">jump</a></p>');

      expect(html).not.toContain('md-hashtag');
      expect(html).toContain('href="#section"');
    });

    it('leaves a # inside code alone, where it is comment syntax', () => {
      const { html } = renderPostContent('<p><code># not a tag</code> but #this is</p>');

      expect(html.match(/md-hashtag/g)).toHaveLength(1);
      expect(html).toContain('<code># not a tag</code>');
    });

    it('does not make a hashtag inside a link doubly clickable', () => {
      const { html } = renderPostContent('<p><a href="https://example.com">see #here</a></p>');

      expect(html).not.toContain('md-hashtag');
    });

    it('does not nest a span inside one the author already wrote', () => {
      const { html } = renderPostContent('<p><span class="md-hashtag">#already</span></p>');

      expect(html.match(/md-hashtag/g)).toHaveLength(1);
    });

    it('still strips scripts from rich-text content', () => {
      const { html } = renderPostContent('<p>#safe</p><script>alert(1)</script>');

      expect(html).toContain('md-hashtag');
      expect(html).not.toContain('<script');
      expect(html).not.toContain('alert(1)');
    });

    it('leaves content without hashtags byte-for-byte alone', () => {
      const { html } = renderPostContent('<p>Nothing to see</p>');

      expect(html).toBe('<p>Nothing to see</p>');
    });
  });
});
