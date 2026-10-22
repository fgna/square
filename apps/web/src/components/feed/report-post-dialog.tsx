'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import apiClient from '@/lib/api-client';
import { toast } from '@/store/toast.store';

const REASONS = ['spam', 'offensive', 'offTopic', 'other'] as const;

/**
 * Lets a member flag a post for the admins. Until this existed there was no
 * way to report anything: moderation depended on admins reading every post.
 */
export function ReportPostDialog({ postId, onClose }: { postId: string; onClose: () => void }) {
  const t = useTranslations('feed');
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [note, setNote] = useState('');

  const report = useMutation({
    mutationFn: () =>
      apiClient.post(`/posts/${postId}/report`, {
        // The reason is stored as text for the admins, in the reporter's language.
        reason: note.trim() ? `${t(`report.reasons.${reason}`)}: ${note.trim()}` : t(`report.reasons.${reason}`),
      }),
    onSuccess: () => {
      toast.success(t('report.thanks'), t('report.thanksText'));
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('report.title')}</DialogTitle>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="text-sm mb-1" style={{ color: 'var(--theme-text-muted)' }}>
            {t('report.what')}
          </legend>
          {REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--theme-text)' }}>
              <input type="radio" name="report-reason" checked={reason === r} onChange={() => setReason(r)} />
              {t(`report.reasons.${r}`)}
            </label>
          ))}
        </fieldset>
        <Textarea
          aria-label={t('report.details')}
          placeholder={t('report.details')}
          rows={3}
          maxLength={400}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('composer.cancel')}
          </Button>
          <Button size="sm" disabled={!reason || report.isPending} onClick={() => report.mutate()}>
            {report.isPending && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {t('report.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
