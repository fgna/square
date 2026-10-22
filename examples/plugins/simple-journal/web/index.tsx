'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { PluginPageProps, WebPlugin } from '@community/plugin-sdk/web';

type Today = { date: string; text: string; prompt: string | null };
type Entry = { date: string; text: string };

function SimpleJournalPage({ api }: PluginPageProps) {
  const t = useTranslations('plugin.journal');
  const locale = useLocale();
  const [today, setToday] = useState<Today | null>(null);
  const [history, setHistory] = useState<Entry[]>([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  useEffect(() => {
    api.get<Today>(`today?locale=${locale}`).then((d) => {
      setToday(d);
      setText(d.text);
    });
    api.get<Entry[]>('history').then(setHistory);
  }, [api, locale]);

  const save = async () => {
    try {
      await api.put('today', { text });
      setStatus('saved');
      setHistory(await api.get<Entry[]>('history'));
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>{t('title')}</h1>
      <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{t('intro')}</p>
      {today?.prompt && (
        <p className="text-sm" style={{ color: 'var(--theme-text)' }}>
          <strong>{t('prompt')}:</strong> {today.prompt}
        </p>
      )}
      <textarea
        aria-label={t('placeholder')}
        placeholder={t('placeholder')}
        className="w-full min-h-32 rounded border p-3"
        maxLength={5000}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setStatus('idle');
        }}
      />
      <div className="flex items-center gap-3">
        <button className="rounded border px-4 py-2" onClick={save} disabled={!today}>{t('save')}</button>
        {status === 'saved' && <span role="status">{t('saved')}</span>}
        {status === 'error' && <span role="alert">{t('error')}</span>}
      </div>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--theme-text)' }}>{t('history')}</h2>
      {history.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>{t('empty')}</p>
      ) : (
        <ul className="space-y-2">
          {history.map((e) => (
            <li key={e.date} className="text-sm" style={{ color: 'var(--theme-text)' }}>
              <span style={{ color: 'var(--theme-text-muted)' }}>{e.date}</span> {e.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const simpleJournal: WebPlugin = { Page: SimpleJournalPage };
export default simpleJournal;
