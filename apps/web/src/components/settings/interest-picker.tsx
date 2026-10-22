'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useCategories } from '@/hooks/use-categories';
import { useInterests, useUpdateInterests } from '@/hooks/use-interests';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Sparkles, Check } from 'lucide-react';
import { chipStyle } from '@/lib/chip-style';

export function InterestPicker() {
  const t = useTranslations('interests');
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: interests, isLoading: interestsLoading } = useInterests();
  const updateInterests = useUpdateInterests();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync from server data on load
  useEffect(() => {
    if (interests && !dirty) {
      setSelected(new Set(interests.map((i) => i.id)));
    }
  }, [interests, dirty]);

  // Every click saves. There used to be a separate save button, and members
  // (and the founder, twice) picked topics, left the page and lost them.
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setDirty(true);
    setSaved(false);
    updateInterests.mutate(Array.from(next), {
      onSuccess: () => {
        setDirty(false);
        setSaved(true);
      },
    });
  };

  // Auto-clear saved indicator
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  const isLoading = categoriesLoading || interestsLoading;
  const allCategories = (categories as any[]) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles size={16} /> {t('title')}
        </CardTitle>
        <CardDescription>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        ) : allCategories.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            {t('none')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allCategories.map((cat: any) => {
              const isSelected = selected.has(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggle(cat.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={chipStyle(isSelected)}
                  aria-pressed={isSelected}
                  type="button"
                >
                  {isSelected && <Check size={12} />}
                  {cat.icon && <span>{cat.icon}</span>}
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}

        {allCategories.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {t(selected.size === 1 ? 'selectedOne' : 'selectedOther', { count: selected.size })}
            </p>
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--theme-text-muted)' }} aria-live="polite">
              {updateInterests.isPending ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  {t('saving')}
                </>
              ) : saved ? (
                <>
                  <Check size={12} style={{ color: 'var(--theme-primary)' }} />
                  {t('saved')}
                </>
              ) : null}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
