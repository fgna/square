'use client';

import { useTranslations } from 'next-intl';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Heading2,
  Minus,
  ImagePlus,
  Camera,
} from 'lucide-react';
import { UnsplashSearch, useUnsplashEnabled, type UnsplashPhoto } from '@/components/common/unsplash-search';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  compact?: boolean;
  /**
   * Enables images: uploads the picked file and returns its URL. Left out
   * (as in the feed), the editor offers no image button.
   */
  onUploadImage?: (file: File) => Promise<string>;
  /**
   * With images on: the photo search to offer next to uploads (e.g.
   * "/courses/covers"), shown when the operator set up Unsplash.
   */
  photoSearchApi?: string;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Picks an Unsplash photo and inserts it with the credit line Unsplash requires right below. */
function UnsplashDialog({ editor, api, onClose }: { editor: Editor; api: string; onClose: () => void }) {
  const t = useTranslations('editorUI');
  const credits = useTranslations('events');
  const insert = (photo: UnsplashPhoto) => {
    const library = `https://unsplash.com/?${photo.credit.url.split('?')[1] ?? ''}`;
    const credit = credits.markup('coverCredit', {
      name: escapeHtml(photo.credit.name),
      author: (chunks) => `<a href="${escapeHtml(photo.credit.url)}" target="_blank" rel="noopener noreferrer">${chunks}</a>`,
      library: (chunks) => `<a href="${escapeHtml(library)}" target="_blank" rel="noopener noreferrer">${chunks}</a>`,
    });
    editor.chain().focus().setImage({ src: photo.url, alt: photo.alt ?? '' }).insertContent(`<p><em>${credit}</em></p>`).run();
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('insertUnsplash')}</DialogTitle>
        </DialogHeader>
        <UnsplashSearch api={api} onChoose={insert} />
      </DialogContent>
    </Dialog>
  );
}

function ToolbarButton({
  onClick,
  active,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 rounded transition-colors"
      style={{
        color: active ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
        background: active ? 'rgba(197,168,128,0.1)' : 'transparent',
      }}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, onUploadImage, photoSearchApi }: { editor: Editor; onUploadImage?: (file: File) => Promise<string>; photoSearchApi?: string }) {
  const t = useTranslations('editorUI');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [unsplashOpen, setUnsplashOpen] = useState(false);

  const [linkOpen, setLinkOpen] = useState(false);

  return (
    <div
      className="flex flex-wrap gap-0.5 px-2 py-1 border-b"
      style={{ borderColor: 'var(--theme-border)' }}
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title={t('heading')}
      >
        <Heading2 size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title={t('bold')}
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title={t('italic')}
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title={t('code')}
      >
        <Code size={14} />
      </ToolbarButton>
      <div className="w-px mx-1" style={{ background: 'var(--theme-border)' }} />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title={t('bullet')}
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title={t('numbered')}
      >
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title={t('quote')}
      >
        <Quote size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title={t('divider')}
      >
        <Minus size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => setLinkOpen(true)}
        active={editor.isActive('link')}
        title={t('link')}
      >
        <LinkIcon size={14} />
      </ToolbarButton>
      {onUploadImage && (
        <>
          <ToolbarButton onClick={() => imageInputRef.current?.click()} title={t('insertImage')}>
            <ImagePlus size={14} />
          </ToolbarButton>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              // A failed upload reports itself through the global mutation toast.
              const src = await onUploadImage(file).catch(() => null);
              if (src) editor.chain().focus().setImage({ src, alt: file.name }).run();
            }}
          />
          {photoSearchApi && <UnsplashButton api={photoSearchApi} onClick={() => setUnsplashOpen(true)} />}
        </>
      )}
      {unsplashOpen && photoSearchApi && <UnsplashDialog editor={editor} api={photoSearchApi} onClose={() => setUnsplashOpen(false)} />}
      {linkOpen && <LinkDialog editor={editor} onClose={() => setLinkOpen(false)} />}
    </div>
  );
}

/** Web addresses only; a bare "example.com" becomes https://example.com. */
export function normalizeLinkUrl(input: string): string | null {
  const url = input.trim();
  if (!url) return null;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(url)) return url;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Link with a visible text: the text shows in the post, the address sits
 * behind it. Prefilled from the selection or the link under the cursor.
 */
function LinkDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const t = useTranslations('editorUI');
  const editing = editor.isActive('link');
  const [initial] = useState(() => {
    if (editing) editor.chain().extendMarkRange('link').run();
    const { from, to } = editor.state.selection;
    return {
      text: editor.state.doc.textBetween(from, to, ' '),
      url: editing ? String(editor.getAttributes('link').href ?? '') : '',
    };
  });
  const [text, setText] = useState(initial.text);
  const [url, setUrl] = useState(initial.url);
  const href = normalizeLinkUrl(url);

  const save = () => {
    if (!href) return;
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .insertContent({ type: 'text', text: text.trim() || href, marks: [{ type: 'link', attrs: { href } }] })
      .unsetMark('link')
      .run();
    onClose();
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t('linkEditTitle') : t('linkTitle')}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="link-text">{t('linkText')}</Label>
            <Input id="link-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('linkTextPlaceholder')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link-url">{t('linkUrl')}</Label>
            <Input id="link-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" autoFocus={!editing} />
            {url.trim() && !href && (
              <p className="text-xs" style={{ color: 'var(--theme-danger)' }}>{t('linkInvalid')}</p>
            )}
          </div>
          <DialogFooter>
            {editing && (
              <Button type="button" variant="ghost" size="sm" onClick={remove}>
                {t('linkRemove')}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={!href}>
              {t('linkSave')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Shown only when the operator set up Unsplash. */
function UnsplashButton({ api, onClick }: { api: string; onClick: () => void }) {
  const t = useTranslations('editorUI');
  if (!useUnsplashEnabled(api)) return null;
  return (
    <ToolbarButton onClick={onClick} title={t('insertUnsplash')}>
      <Camera size={14} />
    </ToolbarButton>
  );
}

export function RichTextEditor({ content, onChange, placeholder, compact, onUploadImage, photoSearchApi }: RichTextEditorProps) {
  const t = useTranslations('editorUI');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      ...(onUploadImage ? [Image.configure({ HTMLAttributes: { class: 'rounded-lg max-w-full' } })] : []),
      Placeholder.configure({
        placeholder: placeholder || t('write'),
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'md-link', target: '_blank', rel: 'noopener noreferrer' },
      }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose-editor ${compact ? 'compact' : ''}`,
      },
    },
  });

  if (!editor) return null;

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        border: '1px solid var(--theme-border)',
        background: 'var(--theme-surface, var(--theme-background))',
      }}
    >
      <Toolbar editor={editor} onUploadImage={onUploadImage} photoSearchApi={photoSearchApi} />
      <EditorContent editor={editor} />
    </div>
  );
}
