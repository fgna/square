'use client';

import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, Loader2, Paperclip, Trash2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from '@/store/toast.store';
import { readableOrExplain } from '@/hooks/use-course-editor';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Mirrors the API's FILE_TYPES for POST /uploads/file.
const ATTACHMENT_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp3,.m4a,.wav';

interface AdminRecording {
  id: string;
  title: string;
  description?: string | null;
  url: string;
  duration?: number | null;
  availableUntil: string | null;
  attachments: { id: string; filename: string; url: string; size: number }[];
}

/**
 * Admin → Events → "Aufzeichnungen": the recordings of one event (link to
 * Vimeo, YouTube, Loom or Drive) and their files (slides, handouts). Members
 * see them under Aufzeichnungen; with a retention period set on the server
 * they are deleted after it.
 */
export function RecordingsAdminDialog({ event, onClose }: { event: { id: string; title: string }; onClose: () => void }) {
  const t = useTranslations('adminRecordingsUI');
  const locale = useLocale() === 'de' ? 'de-DE' : 'en-US';
  const queryClient = useQueryClient();
  const key = ['admin', 'recordings', event.id];
  const { data: recordings = [], isLoading } = useQuery<AdminRecording[]>({
    queryKey: key,
    queryFn: () => apiClient.get(`/events/${event.id}/recordings`).then((r) => r.data),
  });
  const { data: retention } = useQuery<{ days: number }>({
    queryKey: ['recordings', 'retention'],
    queryFn: () => apiClient.get('/events/recordings/retention').then((r) => r.data),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ['recordings'] });
  };

  const [title, setTitle] = useState(event.title);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [minutes, setMinutes] = useState('');
  const urlValid = /^https?:\/\/\S+\.\S+/i.test(url.trim());

  const create = useMutation({
    mutationFn: () =>
      apiClient.post(`/events/${event.id}/recordings`, {
        title: title.trim(),
        url: url.trim(),
        ...(description.trim() && { description: description.trim() }),
        ...(minutes && Number(minutes) > 0 && { duration: Math.round(Number(minutes) * 60) }),
      }),
    onSuccess: () => {
      setUrl('');
      setDescription('');
      setMinutes('');
      toast.success(t('added'));
      refresh();
    },
    onError: () => toast.error(t('failed')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/events/recordings/${id}`),
    onSuccess: refresh,
  });
  const addFile = useMutation({
    mutationFn: async ({ recordingId, file }: { recordingId: string; file: File }) => {
      const form = new FormData();
      form.append('file', await readableOrExplain(file));
      const { data: upload } = await apiClient.post('/uploads/file', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return apiClient.post(`/events/recordings/${recordingId}/attachments`, { uploadId: upload.id });
    },
    onSuccess: refresh,
    onError: () => toast.error(t('uploadFailed')),
  });
  const removeFile = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/events/recordings/attachments/${id}`),
    onSuccess: refresh,
  });
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title', { event: event.title })}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {isLoading && <Loader2 size={16} className="animate-spin" />}
          {!isLoading && recordings.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{t('none')}</p>
          )}
          {recordings.map((r) => (
            <div key={r.id} className="rounded-lg p-3 space-y-2" style={{ border: '1px solid var(--theme-border)' }}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:underline inline-flex items-center gap-1" style={{ color: 'var(--theme-text)' }}>
                    {r.title} <ExternalLink size={12} />
                  </a>
                  {r.availableUntil && (
                    <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {t('availableUntil', { date: new Date(r.availableUntil).toLocaleDateString(locale) })}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-red-400"
                  onClick={() => confirm(t('deleteConfirm', { name: r.title })) && remove.mutate(r.id)}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
              {r.attachments.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  <FileText size={12} />
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate hover:underline">{a.filename}</a>
                  <button type="button" aria-label={t('removeFile', { name: a.filename })} onClick={() => removeFile.mutate(a.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <input
                ref={(el) => { fileInputs.current[r.id] = el; }}
                type="file"
                accept={ATTACHMENT_TYPES}
                className="hidden"
                aria-label={t('addFile')}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) addFile.mutate({ recordingId: r.id, file });
                  e.target.value = '';
                }}
              />
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => fileInputs.current[r.id]?.click()} disabled={addFile.isPending}>
                {addFile.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : <Paperclip size={12} className="mr-1" />}
                {t('addFile')}
              </Button>
            </div>
          ))}
        </div>

        <form
          className="space-y-3 pt-4"
          style={{ borderTop: '1px solid var(--theme-border)' }}
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim() && urlValid) create.mutate();
          }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{t('new')}</p>
          <div className="space-y-1.5">
            <Label htmlFor="rec-title">{t('recTitle')}</Label>
            <Input id="rec-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-url">{t('recUrl')}</Label>
            <Input id="rec-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://vimeo.com/…" />
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t('recUrlHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-desc">{t('recDescription')}</Label>
            <Textarea id="rec-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-min">{t('recMinutes')}</Label>
            <Input id="rec-min" type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-32" />
          </div>
          {!!retention?.days && (
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t('retentionHint', { days: retention.days })}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('close')}</Button>
            <Button type="submit" size="sm" disabled={!title.trim() || !urlValid || create.isPending}>
              {create.isPending && <Loader2 size={12} className="animate-spin mr-1" />}
              {t('add')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
