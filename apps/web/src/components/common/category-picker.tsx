'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import apiClient from '@/lib/api-client';
import { chipStyle } from '@/lib/chip-style';

interface CategoryOption {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

/**
 * Topics a course or event belongs to. Explore lists posts, courses and events
 * by topic, but until this existed only posts could be given one.
 */
export function CategoryPicker({
  value,
  onChange,
  label,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const t = useTranslations('categoryPicker');
  const { data: categories = [] } = useQuery<CategoryOption[]>({
    queryKey: ['categories'],
    queryFn: () => apiClient.get('/categories').then((r) => r.data),
  });

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium mb-1" style={{ color: 'var(--theme-text)' }}>
        {label ?? t('label')}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const on = value.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(cat.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
              style={chipStyle(on)}
            >
              {cat.icon && <span>{cat.icon}</span>}
              {cat.name}
            </button>
          );
        })}
      </div>
      <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
        {t('hint')}
      </p>
    </fieldset>
  );
}
