'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from './rich-text-editor';
import { useUpdatePost } from '@/hooks/use-feed';
import type { Post } from '@community/shared';

/** Posts written in the rich editor are stored as HTML; plain ones as text/markdown. */
export function isHtmlContent(content: string): boolean {
  return /^\s*</.test(content);
}

/** True when there is something left to read once the markup is removed. */
export function hasText(content: string): boolean {
  return content.replace(/<[^>]*>/g, '').trim().length > 0;
}

/**
 * Edits a post in place. The API allowed authors and admins to edit
 * (PUT /posts/:id) from the start, but nothing in the interface called it.
 * The editor matches how the post was written, so a rich-text post keeps its
 * formatting.
 */
export function EditPost({ post, onDone }: { post: Post; onDone: () => void }) {
  const t = useTranslations('feed');
  const rich = isHtmlContent(post.content);
  const [draft, setDraft] = useState(post.content);
  const update = useUpdatePost();

  const next = rich ? draft : draft.trim();
  const canSave = hasText(next) && next !== post.content && !update.isPending;

  const save = () => {
    if (!canSave) return;
    update.mutate({ postId: post.id, content: next }, { onSuccess: onDone });
  };

  return (
    <div className="space-y-3">
      {rich ? (
        <RichTextEditor content={post.content} onChange={setDraft} />
      ) : (
        <Textarea
          aria-label={t('edit.label')}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          autoFocus
        />
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={update.isPending}>
          {t('composer.cancel')}
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={!canSave}>
          {update.isPending && <Loader2 size={13} className="animate-spin mr-1" />}
          {t('edit.save')}
        </Button>
      </div>
    </div>
  );
}
