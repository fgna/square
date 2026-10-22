'use client';

import { useTranslations } from 'next-intl';
import { useJournalPrompts, JournalPrompt } from './use-journal';
import { Loader2, Lightbulb } from 'lucide-react';

interface JournalPromptsProps {
  onSelect: (text: string) => void;
}

export function JournalPrompts({ onSelect }: JournalPromptsProps) {
  const t = useTranslations('journal');
  const { data: prompts, isLoading } = useJournalPrompts();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--theme-text-muted)' }} />
      </div>
    );
  }

  if (!prompts || prompts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb size={16} style={{ color: 'var(--theme-primary)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
          {t('dailyPrompts')}
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {prompts.map((prompt: JournalPrompt) => {
          const categoryColor = prompt.color || 'var(--theme-primary)';
          return (
            <button
              key={prompt.id}
              onClick={() => onSelect(prompt.text)}
              className="w-full text-left p-3 rounded-lg transition-all duration-150 hover:scale-[1.01]"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--theme-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--theme-primary)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--theme-border)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              }}
            >
              <span
                className="inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded mb-1.5"
                style={{
                  background: `${categoryColor}20`,
                  color: categoryColor,
                }}
              >
                {prompt.category}
              </span>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--theme-text)' }}>
                {prompt.text}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
