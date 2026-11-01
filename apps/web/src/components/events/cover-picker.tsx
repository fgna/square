'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ImageUploadField } from '@/components/common/image-upload-field';

export type CoverCredit = { name: string; url: string; source?: string } | null;

/**
 * Admins give an event or a course a cover: an uploaded picture, or a photo
 * from Unsplash when the operator configured it (UNSPLASH_ACCESS_KEY).
 * `api` is the owner's photo search ("/events/covers" or "/courses/covers").
 */
export function CoverPicker({
  url,
  onChange,
  api = '/events/covers',
}: {
  url: string | null;
  onChange: (url: string | null, credit: CoverCredit) => void;
  api?: string;
}) {
  const t = useTranslations('adminEventsUI');
  const { data: status } = useQuery({
    queryKey: [api, 'status'],
    queryFn: () => apiClient.get(`${api}/status`).then((r) => r.data as { unsplash: boolean }),
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    setSearching(true);
    try {
      setResults((await apiClient.get(`${api}/search`, { params: { q: query } })).data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const choose = (photo: any) => {
    onChange(photo.url, photo.credit);
    setResults(null);
    apiClient.post(`${api}/chosen`, { downloadLocation: photo.downloadLocation }).catch(() => undefined);
  };

  return (
    <div className="space-y-2">
      <ImageUploadField label={t('cover')} value={url} onChange={(next) => onChange(next, null)} />
      {status?.unsplash && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('coverSearch')} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())} />
            <Button type="button" variant="outline" size="sm" onClick={search} disabled={query.trim().length < 2 || searching}>
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </Button>
          </div>
          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t('coverUnsplashNote')}</p>
          {results && (
            <div className="grid grid-cols-3 gap-2">
              {results.map((p) => (
                <button key={p.id} type="button" onClick={() => choose(p)} className="relative" title={p.credit.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl} alt={p.alt ?? ''} className="w-full rounded object-cover" style={{ aspectRatio: '3 / 2' }} />
                </button>
              ))}
              {results.length === 0 && <p className="col-span-3 text-xs">{t('coverNone')}</p>}
              <button type="button" className="col-span-3 text-xs flex items-center gap-1" onClick={() => setResults(null)}>
                <X size={12} /> {t('coverClose')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
