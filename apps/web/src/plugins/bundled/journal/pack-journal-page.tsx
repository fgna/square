'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { JournalPrompts } from './journal-prompts';

type MethodField = { key: string; label: string; kind: 'text' | 'text-list' | 'task-list' };
export type JournalMethod = { source: 'legacy' | 'pack'; version: string | null; fields: MethodField[] };
type Task = { text: string; done: boolean };
type FieldValue = string | string[] | Task[];
type FormValues = Record<string, FieldValue>;

function emptyFor(fields: MethodField[]): FormValues {
  return Object.fromEntries(fields.map(f => [f.key, f.kind === 'text' ? '' : []]));
}

function normalized(fields: MethodField[], raw: unknown): FormValues {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyFor(fields);
  const entries = raw as Record<string, unknown>;
  return Object.fromEntries(fields.map(f => {
    const value = entries[f.key];
    if (f.kind === 'text') return [f.key, typeof value === 'string' ? value : ''];
    if (f.kind === 'text-list') return [f.key, Array.isArray(value) ? value.filter(v => typeof v === 'string').slice(0, 20) : []];
    if (f.kind === 'task-list') return [f.key, Array.isArray(value) ? value.filter(v =>
      v && typeof v === 'object' && typeof v.text === 'string' && typeof v.done === 'boolean'
    ).slice(0, 20) : []];
    return [f.key, ''];
  }));
}

/** A neutral method-driven editor. Legacy journal stays in journal-page.tsx. */
export function PackJournalPage({ method }: { method: JournalMethod }) {
  const t = useTranslations('journal');
  const today = useMemo(() => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }, []);
  const [date, setDate] = useState(today);
  const [draft, setDraft] = useState<{ date: string; values: FormValues } | null>(null);
  const queryClient = useQueryClient();
  const entry = useQuery({
    queryKey: ['pack-journal-entry', date],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ content: unknown }>(`/p/journal/${date}`);
        return normalized(method.fields, response.data.content);
      } catch (error) {
        if ((error as { response?: { status?: number } }).response?.status === 404) return emptyFor(method.fields);
        throw error;
      }
    },
    retry: false,
  });
  const values = draft?.date === date ? draft.values : entry.data ?? emptyFor(method.fields);
  const setField = (key: string, value: FieldValue) => setDraft({ date, values: { ...values, [key]: value } });
  const save = useMutation({
    mutationFn: (content: FormValues) => apiClient.put(`/p/journal/method-entry/${date}`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pack-journal-entry', date] });
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      setDraft(null);
    },
  });
  const remove = useMutation({
    mutationFn: () => apiClient.delete(`/p/journal/${date}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pack-journal-entry', date] });
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      setDraft(null);
    },
  });
  const firstText = method.fields.find(f => f.kind === 'text');
  const addPrompt = (prompt: string) => {
    if (!firstText) return;
    const existing = values[firstText.key];
    setField(firstText.key, (typeof existing === 'string' && existing ? existing + '\n\n' : '') + prompt + '\n');
  };

  return (
    <section className="space-y-6" aria-label={t('title')}>
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm opacity-70">{method.version}</p>
      </div>
      <label className="flex flex-col gap-2 max-w-xs">
        <span>{t('selectDate')}</span>
        <input type="date" className="rounded border p-2" value={date} max={today} onChange={e => { setDate(e.target.value); setDraft(null); }} />
      </label>
      {entry.isLoading ? <p role="status">{t('methodEntryLoading')}</p> :
       entry.isError ? <p role="alert">{t('methodLoadError')}</p> :
       <div className="space-y-5">
         {method.fields.map(field => {
           const value = values[field.key];
           return <div key={field.key} className="space-y-2">
             <label className="block font-medium" htmlFor={`pack-${field.key}`}>{field.label}</label>
             {field.kind === 'text' ? (
               <textarea id={`pack-${field.key}`} className="w-full min-h-24 rounded border p-3" maxLength={10000}
                 value={typeof value === 'string' ? value : ''}
                 onChange={e => setField(field.key, e.target.value)} />
             ) : (
               <div className="space-y-2" id={`pack-${field.key}`}>
                 {(Array.isArray(value) ? value : []).map((item, i) => (
                   <div key={i} className="flex items-center gap-2">
                     {field.kind === 'task-list' &&
                       <input type="checkbox" aria-label={`${t('markComplete')} ${field.label} ${i + 1}`}
                         checked={typeof item === 'object' && item !== null && item.done}
                         onChange={e => setField(field.key, (value as Task[]).map((task, j) => j === i ? { ...task, done: e.target.checked } : task))} />}
                     <input className="flex-1 rounded border p-2" maxLength={field.kind === 'task-list' ? 500 : 1000}
                       aria-label={`${field.label} ${i + 1}`}
                       value={typeof item === 'string' ? item : item.text}
                       onChange={e => setField(field.key, (value as (string | Task)[]).map((entry, j) => j !== i ? entry :
                         typeof entry === 'string' ? e.target.value : { ...entry, text: e.target.value }) as FieldValue)} />
                     <button type="button" onClick={() => setField(field.key, (value as (string | Task)[]).filter((_, j) => j !== i) as FieldValue)}>{t('methodRemoveItem')}</button>
                   </div>
                 ))}
                 <button type="button" disabled={(Array.isArray(value) ? value.length : 0) >= 20}
                   onClick={() => setField(field.key, [...(Array.isArray(value) ? value : []), field.kind === 'task-list' ? { text: '', done: false } : ''] as FieldValue)}>
                   {t('methodAddItem')}
                 </button>
               </div>
             )}
           </div>;
         })}
         {firstText && <JournalPrompts onSelect={addPrompt} />}
         <div className="flex gap-3">
           <button className="rounded border px-4 py-2" disabled={save.isPending || remove.isPending} onClick={() => save.mutate(values)}>{t('save')}</button>
           <button className="rounded border px-4 py-2" disabled={remove.isPending} onClick={() => {
             if (window.confirm(t('confirmDelete'))) remove.mutate();
           }}>{t('delete')}</button>
         </div>
         {(save.isError || remove.isError) && <p role="alert">{t('methodSaveError')}</p>}
         {save.isSuccess && <p role="status">{t('methodSaved')}</p>}
       </div>}
    </section>
  );
}
