'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api-client';
import { toast } from '@/store/toast.store';

/**
 * Admin → Members: deletes a member's account for them, with the same deletion
 * as "delete my account". The admin types the member's e-mail address first,
 * because it cannot be undone.
 */
export function DeleteMemberDialog({
  member,
  onClose,
  onDeleted,
}: {
  member: { id: string; name: string; email: string };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations('adminUsersUI');
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === member.email.toLowerCase();

  const remove = useMutation({
    mutationFn: () => apiClient.post(`/admin/users/${member.id}/delete`, { confirmEmail: typed.trim() }),
    onSuccess: () => {
      toast.success(t('deleteDone', { name: member.name }));
      onDeleted();
      onClose();
    },
    onError: () => toast.error(t('deleteFailed')),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('deleteTitle', { name: member.name })}</DialogTitle>
        </DialogHeader>
        <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
          {t('deleteExplain')}
        </p>
        <label className="block text-sm" style={{ color: 'var(--theme-text)' }}>
          {t('deleteConfirmLabel', { email: member.email })}
          <Input
            className="mt-1"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            aria-label={t('deleteConfirmLabel', { email: member.email })}
          />
        </label>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="destructive" size="sm" disabled={!matches || remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending && <Loader2 size={14} className="animate-spin mr-1.5" />}
            {t('deleteConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
