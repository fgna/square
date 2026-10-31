'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { PhotoCredit } from './cover-credit';

export interface UnsplashPhoto {
  id: string;
  thumbUrl: string;
  url: string;
  credit: PhotoCredit;
  downloadLocation: string;
  alt: string | null;
}

/** Whether the operator set up Unsplash (UNSPLASH_ACCESS_KEY); `api` is e.g. "/courses/covers". */
export function useUnsplashEnabled(api: string) {
  const { data } = useQuery({
    queryKey: [api, 'status'],
    queryFn: () => apiClient.get(`${api}/status`).then((r) => r.data as { unsplash: boolean }),
  });
  return data?.unsplash === true;
}

/**
 * Photo search in Unsplash for admins. A chosen photo is reported to Unsplash,
 * as their guidelines require, and handed back with its photographer credit.
 */
export function UnsplashSearch({ api, onChoose }: { api: string; onChoose: (photo: UnsplashPhoto) => void }) {
  const t = useTranslations('adminEventsUI');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnsplashPhoto[] | null>(null);
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

  const choose = (photo: UnsplashPhoto) => {
    onChoose(photo);
    setResults(null);
    apiClient.post(`${api}/chosen`, { downloadLocation: photo.downloadLocation }).catch(() => undefined);
  };

  return (
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
  );
}
