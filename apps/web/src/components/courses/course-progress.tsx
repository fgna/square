import { useTranslations } from 'next-intl';
interface CourseProgressProps {
  percentage: number;
  showLabel?: boolean;
  completedLessons?: number;
  totalLessons?: number;
}

export function CourseProgress({ percentage, showLabel = true, completedLessons, totalLessons }: CourseProgressProps) {
  const t = useTranslations('courses');
  const clamped = Math.min(100, Math.max(0, percentage));
  const isComplete = clamped >= 100;

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex justify-between text-xs">
          <span style={{ color: 'var(--theme-text-muted)' }}>{t('progress')}</span>
          <span
            style={{ color: isComplete ? 'var(--theme-success)' : 'var(--theme-primary)' }}
            className="font-medium"
          >
            {isComplete ? t('complete') : `${Math.round(clamped)}%`}
          </span>
        </div>
      )}
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.08)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${clamped}%`,
            background: isComplete
              ? 'var(--theme-success)'
              : 'linear-gradient(90deg, var(--theme-primary), var(--theme-secondary))',
          }}
        />
      </div>
    </div>
  );
}
