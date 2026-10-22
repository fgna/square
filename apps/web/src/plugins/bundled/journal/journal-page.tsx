'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Flame, Award, BookOpen, Trash2, Loader2 } from 'lucide-react';
import {
  useJournalEntries,
  useJournalEntry,
  useUpsertJournal,
  useDeleteJournal,
  useJournalStats,
  EMPTY_JOURNAL_CONTENT,
} from './use-journal';
import type { JournalContent } from './use-journal';
import { JournalPrompts } from './journal-prompts';

const MOODS = [
  { value: 'grateful', emoji: '🙏' },
  { value: 'happy', emoji: '😊' },
  { value: 'reflective', emoji: '🤔' },
  { value: 'motivated', emoji: '💪' },
  { value: 'calm', emoji: '😌' },
  { value: 'anxious', emoji: '😟' },
  { value: 'tired', emoji: '😴' },
  { value: 'frustrated', emoji: '😤' },
];

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function hasContent(content: JournalContent): boolean {
  return (
    content.threeGoals.some((g) => g.trim()) ||
    content.mustDoTasks.some((t) => t.text.trim()) ||
    content.whoIWantToBe.trim() !== '' ||
    content.lookingForwardTo.trim() !== '' ||
    content.importantPeople.trim() !== '' ||
    content.thoughts.trim() !== ''
  );
}

interface SectionFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}

function SectionField({ label, value, onChange, placeholder, rows = 2 }: SectionFieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-primary)' }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full p-3 rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-1"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      />
    </div>
  );
}

export function JournalPage() {
  const t = useTranslations('journal');
  const tSimple = useTranslations('journalSimpleUI');
  const tMoods = useTranslations('journalMoodUI');
  const locale = useLocale() === 'de' ? 'de-DE' : 'en-US';
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string>(formatDateKey(today));
  const [content, setContent] = useState<JournalContent>({ ...EMPTY_JOURNAL_CONTENT });
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [appliedPrompt, setAppliedPrompt] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const monthKey = formatMonthKey(currentMonth);
  const { data: entries } = useJournalEntries(monthKey);
  const { data: entry, isLoading: entryLoading, error: entryError } = useJournalEntry(selectedDate);
  const { data: stats } = useJournalStats();
  const upsertMutation = useUpsertJournal();
  const deleteMutation = useDeleteJournal();

  const entryDates = new Set<string>();
  entries?.forEach((e) => {
    const d = new Date(e.date);
    entryDates.add(formatDateKey(d));
  });

  useEffect(() => {
    if (entry) {
      setContent(entry.content);
      setSelectedMoods(entry.moods ?? []);
      setAppliedPrompt(null);
      setIsDirty(false);
    } else if (entryError) {
      setContent({ ...EMPTY_JOURNAL_CONTENT, threeGoals: ['', '', ''], mustDoTasks: EMPTY_JOURNAL_CONTENT.mustDoTasks.map((t) => ({ ...t })) });
      setSelectedMoods([]);
      setIsDirty(false);
    }
  }, [entry, entryError]);

  // A prompt is a writing cue, so it is appended to the free-text field with a
  // blank line under it — the member answers beneath it and can apply several.
  const applyPrompt = useCallback((text: string) => {
    setContent((prev) => {
      const existing = prev.thoughts?.trim() ?? '';
      const thoughts = existing ? `${existing}\n\n${text}\n` : `${text}\n`;
      return { ...prev, thoughts };
    });
    setIsDirty(true);
    setAppliedPrompt(text);
  }, []);

  const toggleMood = useCallback((value: string) => {
    setSelectedMoods((prev) =>
      prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value],
    );
    setIsDirty(true);
  }, []);

  const updateField = useCallback((field: keyof JournalContent, value: unknown) => {
    setContent((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedDate || !hasContent(content)) return;
    upsertMutation.mutate({
      date: selectedDate,
      content,
      moods: selectedMoods,
    });
    setIsDirty(false);
  }, [selectedDate, content, selectedMoods, upsertMutation]);

  const handleDelete = useCallback(() => {
    if (!selectedDate) return;
    if (!window.confirm(t('confirmDelete'))) return;
    deleteMutation.mutate(selectedDate);
    setContent({ ...EMPTY_JOURNAL_CONTENT, threeGoals: ['', '', ''], mustDoTasks: EMPTY_JOURNAL_CONTENT.mustDoTasks.map((t) => ({ ...t })) });
    setSelectedMoods([]);
    setIsDirty(false);
  }, [selectedDate, deleteMutation, t]);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const goToToday = () => {
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(formatDateKey(today));
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  // 4 Jan 1970 was a Sunday; the grid starts on Sunday.
  const dayNames = Array.from({ length: 7 }, (_, i) =>
    new Date(1970, 0, 4 + i).toLocaleDateString(locale, { weekday: 'short' }),
  );

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const todayKey = formatDateKey(today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>{t('title')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
          {t('description')}
        </p>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Flame, color: '#ef4444', bg: 'rgba(239,68,68,0.15)', value: stats.currentStreak, label: t('currentStreak') },
            { icon: Award, color: '#eab308', bg: 'rgba(234,179,8,0.15)', value: stats.longestStreak, label: t('longestStreak') },
            { icon: BookOpen, color: '#6366f1', bg: 'rgba(99,102,241,0.15)', value: stats.totalEntries, label: t('totalEntries') },
            { icon: Flame, color: '#22c55e', bg: 'rgba(34,197,94,0.15)', value: stats.last30DaysCount, label: t('last30Days') },
          ].map(({ icon: Icon, color, bg, value, label }) => (
            <Card key={label} style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                  <Icon size={20} style={{ color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>{value}</p>
                  <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main content: Calendar + Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="p-1.5 rounded-md transition-colors hover:bg-white/5" aria-label={t('prevMonth')}>
                <ChevronLeft size={18} style={{ color: 'var(--theme-text-muted)' }} />
              </button>
              <CardTitle className="text-base font-semibold cursor-pointer hover:opacity-80" style={{ color: 'var(--theme-text)' }} onClick={goToToday}>
                {currentMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
              </CardTitle>
              <button onClick={nextMonth} className="p-1.5 rounded-md transition-colors hover:bg-white/5" aria-label={t('nextMonth')}>
                <ChevronRight size={18} style={{ color: 'var(--theme-text-muted)' }} />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {dayNames.map((name) => (
                <div key={name} className="text-center text-xs font-medium py-1" style={{ color: 'var(--theme-text-muted)' }}>{name}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="aspect-square" />;
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasEntry = entryDates.has(dateKey);
                const isSelected = dateKey === selectedDate;
                const isToday = dateKey === todayKey;
                const isFuture = new Date(year, month, day) > today;
                return (
                  <button
                    key={dateKey}
                    onClick={() => !isFuture && setSelectedDate(dateKey)}
                    disabled={isFuture}
                    className="aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all duration-150 relative"
                    style={{
                      background: isSelected ? 'var(--theme-primary)' : hasEntry ? 'rgba(197,168,128,0.15)' : 'transparent',
                      color: isSelected ? 'var(--theme-background)' : isFuture ? 'var(--theme-text-muted)' : 'var(--theme-text)',
                      opacity: isFuture ? 0.4 : 1,
                      fontWeight: isToday ? 700 : 400,
                      border: isToday && !isSelected ? '1px solid var(--theme-primary)' : '1px solid transparent',
                    }}
                  >
                    {day}
                    {hasEntry && !isSelected && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full" style={{ background: 'var(--theme-primary)' }} />
                    )}
                  </button>
                );
              })}
            </div>
            <button onClick={goToToday} className="w-full mt-3 py-1.5 text-xs font-medium rounded-md transition-colors hover:bg-white/5" style={{ color: 'var(--theme-primary)' }}>
              {t('goToToday')}
            </button>

            {/* Daily prompts */}
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--theme-border)' }}>
              <JournalPrompts onSelect={applyPrompt} />
              {appliedPrompt && (
                <p
                  role="status"
                  className="mt-2 text-xs"
                  style={{ color: 'var(--theme-primary)' }}
                >
                  {t('promptAdded', { field: t('thoughtsLabel') })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Editor */}
        <Card className="lg:col-span-2" style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base" style={{ color: 'var(--theme-text)' }}>
                  {selectedDate ? formatDisplayDate(selectedDate, locale) : t('selectDate')}
                </CardTitle>
                {selectedDate === todayKey && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--theme-primary)' }}>{t('today')}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {upsertMutation.isPending && (
                  <Loader2 size={16} className="animate-spin" style={{ color: 'var(--theme-text-muted)' }} />
                )}
                {(entry || hasContent(content)) && (
                  <Button variant="ghost" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending || !entry} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                    <Trash2 size={14} className="mr-1" /> {t('delete')}
                  </Button>
                )}
                <Button size="sm" onClick={handleSave} disabled={!hasContent(content) || upsertMutation.isPending} style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)' }}>
                  {upsertMutation.isPending ? t('saving') : t('save')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Mood selector */}
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--theme-text-muted)' }}>
                {t('feeling')} <span style={{ opacity: 0.7 }}>{t('selectAll')}</span>
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t('feeling')}>
                {MOODS.map((mood) => {
                  const isSelected = selectedMoods.includes(mood.value);
                  return (
                    <button
                      key={mood.value}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggleMood(mood.value)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150"
                      style={{
                        background: isSelected ? 'rgba(197,168,128,0.2)' : 'rgba(255,255,255,0.05)',
                        border: isSelected ? '1px solid var(--theme-primary)' : '1px solid var(--theme-border)',
                        color: isSelected ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                      }}
                    >
                      {mood.emoji} {tMoods(mood.value)}
                    </button>
                  );
                })}
              </div>
            </div>

            {entryLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--theme-text-muted)' }} />
              </div>
            ) : (
              <div className="space-y-5">
                {/* Minimal diary editor. Keep other existing fields in stored content
                    intact so older journal entries are never discarded on save. */}
                <SectionField
                  label={tSimple('thoughts')}
                  value={content.thoughts}
                  onChange={(v) => updateField('thoughts', v)}
                  placeholder={tSimple('placeholder')}
                  rows={8}
                />
              </div>
            )}

            {isDirty && (
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t('unsaved')}</p>
            )}
            {upsertMutation.isSuccess && !isDirty && (
              <p className="text-xs" style={{ color: 'var(--theme-primary)' }}>{t('saved')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
